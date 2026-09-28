import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { canonicalTitle, commercialFor, CATALOG } from '@/lib/serviceCatalog';
import { priceFor } from '@/lib/servicePricing';
import { notifyTeam } from '@/lib/notifyLead';
import { prettyPhone } from '@/lib/phone';
import { isPaidStatus } from '@/lib/serviceStatus';
import { isFrozen } from '@/lib/frozen';

// طلب خدمة — يُسعَّر في الخادم لا في المتصفح.
//
// كان العميل يُدخل صفّ الطلب بنفسه ومعه `price` و`quoted_price` و`status`،
// ومسار الدفع يحسب المستحق من `sr.price ?? sr.quoted_price`. أي أن من يفتح
// أدوات المتصفح كان يستطيع أن يطلب خدمة بـ٧٬٩٠٠ ويكتب سعرها ريالاً واحداً،
// بل ويكتب status='paid' فلا يدفع أصلاً. الثغرة كانت قائمة قبل اليوم.
//
// فصار الطلب يمرّ من هنا: العنوان يُصدَّق مقابل الفهرس، والسعر يُقرأ من
// طبقة التسعير في الخادم، والصفّ يُكتب بمفتاح الخدمة. والعميل لا يكتب رقماً.

const admin = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  );

const KNOWN = new Set(CATALOG.flatMap((c) => c.items));

export async function POST(req: Request) {
  const store = await cookies();
  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    { cookies: { getAll: () => store.getAll(), setAll: () => {} } }
  );
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const title = canonicalTitle(String(b?.service_title || '').trim());
  const optionKey = b?.option_key ? String(b.option_key) : null;
  const inputs = (b?.client_inputs && typeof b.client_inputs === 'object') ? b.client_inputs : null;

  if (!title || !KNOWN.has(title)) {
    return NextResponse.json({ error: 'خدمة غير معروفة' }, { status: 400 });
  }

  const sa = admin();
  // الأحدث إن تعدّدت المنشآت — كان `maybeSingle` يفشل مع صفّين فيقول
  // «لا يوجد ملف منشأة» لعميلٍ لوحتُه أمامه (والوحة تأخذ الأحدث)
  const { data: co } = await sa
    .from('companies')
    .select('id, company_name, owner_name, phone, admin_note')
    .eq('user_id', auth.user.id)
    .order('created_at', { ascending: false }).limit(1)
    .maybeSingle();
  if (!co) return NextResponse.json({ error: 'لا يوجد ملف منشأة' }, { status: 404 });

  // طلب مفتوح واحد لكل خدمة — النقر المتكرر لا يُنشئ طوابير ولا فواتير.
  // المرفوض والمُلغى والمُكتمل ليست مفتوحة.
  const { data: live, error: liveErr } = await sa
    .from('service_requests')
    .select('id, status, price, option_key, paid_at')
    .eq('company_id', co.id)
    .eq('service_title', title)
    .not('status', 'in', '("completed","cancelled","rejected")')
    .order('created_at', { ascending: false });
  if (liveErr) return NextResponse.json({ error: 'تعذّرت قراءة طلباتك — أعد المحاولة' }, { status: 500 });
  // ما ينتظر (مُقدَّم أو مسعَّر) يُعاد كما هو — ومعه سعره، وإلا اختفى زرّ الدفع
  const pending = (live || []).find((r) => !isPaidStatus(r.status));
  if (pending) return NextResponse.json({ ok: true, already: true, id: pending.id, status: pending.status, price: pending.price });
  // ★ والمدفوع يسدّ إعادة طلب الخدمة نفسها — إلا الترقية من الفحص (٩٩٠) إلى
  //   الكامل: كان الفحص المدفوع يسدّ طلب الكامل للأبد، والوعد «تُخصم قيمته
  //   خلال شهر» لا طريق إليه من حساب العميل.
  const paidLive = (live || []).find((r) => isPaidStatus(r.status));
  const upgrading = !!paidLive && paidLive.option_key === 'quick' && optionKey !== 'quick';
  if (paidLive && !upgrading) return NextResponse.json({ ok: true, already: true, id: paidLive.id, status: paidLive.status, price: null });

  const c = commercialFor(title);
  const category = CATALOG.find((cat) => cat.items.includes(title))?.label || null;

  // السعر من الخادم وحده. والخيار يُصدَّق مقابل خيارات الخدمة نفسها.
  let amount: number | null = null;
  if (optionKey && c?.options?.length) {
    const opt = c.options.find((o) => o.key === optionKey);
    if (!opt) return NextResponse.json({ error: 'خيار غير معروف لهذه الخدمة' }, { status: 400 });
    amount = typeof opt.price === 'number' ? opt.price : null;
  } else {
    // الشرائح تحتاج حجم الاستثمار، وهو مُدخَل يُراجعه المكتب — فلا يُسعَّر آلياً
    const investment = c?.tiersBy === 'investment' ? Number((inputs as Record<string, unknown>)?.totalInvestment || 0) : undefined;
    const p = priceFor(title, investment);
    amount = c?.tiersBy === 'investment' ? null : p.amount;
  }

  // ★ ما سعره «للسنة الواحدة» (القوائم المعتمدة) لا يُسعَّر آلياً: كان يُصدَر
  //   للدفع فوراً بسعر سنة، فيدفع من يحتاج ثلاث سنوات ثم يُطالَب بالفرق.
  //   فيقف عند المكتب ليُثبَّت نطاقه أولاً.
  if (c?.priceUnit) amount = null;

  // ★ خصم الفحص من الكامل: ما دُفع في الفحص خلال ثلاثين يوماً يُخصم من
  //   سعر الكامل آلياً — كان الخصم زرّاً يدوياً في لوحة المالك، والوعد
  //   مكتوبٌ للعميل «دفعتَ الفرق لا أكثر».
  let creditedFrom: string | null = null;
  if (optionKey !== 'quick' && typeof amount === 'number' && amount > 0) {
    const { data: quick } = await sa.from('service_requests')
      .select('id, price, paid_at')
      .eq('company_id', co.id).eq('service_title', title).eq('option_key', 'quick')
      .not('paid_at', 'is', null)
      .gte('paid_at', new Date(Date.now() - 30 * 86400_000).toISOString())
      .order('paid_at', { ascending: false }).limit(1).maybeSingle();
    // يُخصم الفحص مرةً واحدة: إن خُصم في طلبٍ سابق لم يُخصم ثانيةً
    const { data: used } = quick
      ? await sa.from('service_requests').select('id').eq('credited_from', quick.id).limit(1).maybeSingle()
      : { data: null };
    const q = Number(quick?.price || 0);
    if (quick && !used && q > 0 && q < amount) { amount = amount - q; creditedFrom = String(quick.id); }
  }

  // ما له سعر معلن يمضي إلى الدفع فوراً — ولا يجلس العميل ينتظر تسعيراً
  // مكتوباً أمامه في نفس الصفحة. وما لا سعر معلن له يقف عند المكتب.
  const priced = typeof amount === 'number' && amount > 0;

  const { data: row, error } = await sa
    .from('service_requests')
    .insert({
      company_id: co.id,
      service_title: title,
      service_category: category,
      status: priced ? 'priced' : 'submitted',
      price: priced ? amount : null,
      quoted_price: priced ? amount : null,
      priced_at: priced ? new Date().toISOString() : null,
      option_key: optionKey,
      client_inputs: inputs,
      credited_from: creditedFrom,
    })
    .select('id, status, price')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // ★ الملف الموقوف بأمر المالك يبقى له أن يطلب — وهذا ما يُنتظر منه (الدراسة
  //   الكاملة مثلاً). فيمضي الطلب، ويُعلَّم للمالك أنه من ملفٍ موقوف ليقرّر.
  const frozen = isFrozen(co.admin_note);
  await sa.from('deal_events').insert({
    company_id: co.id,
    kind: 'service',
    title: (frozen ? '⛔ ملفٌّ موقوف طلب خدمة: ' : 'طلب العميل خدمة: ') + title,
    detail: (priced ? 'سُعِّرت آلياً بـ' + amount + ' ريال — بانتظار الدفع' : 'تحتاج تسعيرك')
      + (creditedFrom ? ' · خُصم منها ما دُفع في الفحص' : ''),
    actor: 'system',
    needs_owner: !priced || frozen,
  });

  // إشعار الجوال على طلب الخدمة نفسه.
  //
  // فالطلب كان يدخل صامتاً: بريدٌ لا يُفتح ولوحةٌ لا تُزار، فوقف طلب «تمويل
  // العقد» من ٧ سبتمبر إلى ١٢ منه مسعَّراً بلا إصدارٍ للدفع — والعميل يفتح
  // حسابه ويرى «بانتظار التجهيز» ولا يملك زرّ دفع. والعميل حين يطلب يكون
  // أحرّ ما يكون، وحرارته تبرد بالساعات لا بالأيام.
  //
  // ★ وكان إشعار جوالٍ بلا `to` (٢٤ سبتمبر) — أي للمالك وحده، إذ الاشتراكات
  //   كلّها أجهزته. والتسعيرُ قرارُه هو، لكن **المكالمة** التي تُتبع الطلب
  //   عملُ الموظفة، ولا تتصل بمن لا تعلم به. فصار للمكتب كلّه.
  await notifyTeam({
    subject: (frozen ? '⛔ ملفٌّ موقوف طلب خدمة: ' : priced ? 'طلب خدمة مسعَّر: ' : 'طلب خدمة يحتاج تسعيرك: ') + title
      + ' — ' + String(co.company_name || 'منشأة'),
    head: priced
      ? 'سُعِّر آلياً وينتظر تحويل صاحبه — ذكّروه برابطه'
      : 'ينتظر تسعير المالك قبل أن يُصدَر للدفع',
    facts: [
      ['الخدمة', title],
      ['المنشأة', co.company_name],
      ['صاحبها', co.owner_name],
      ['الجوال', co.phone ? prettyPhone(co.phone) : ''],
      // الإشعار يصل الفريق كلّه — والسعر لا يُكتب للموظفة (قاعدة المالك)
      ['الحالة', priced ? 'مسعَّر — بانتظار الدفع' : 'بانتظار التسعير'],
    ],
    url: '/admin/arrivals',
    pushTitle: priced ? '💳 طلب خدمة — مسعَّر آلياً' : '🧾 طلب خدمة يحتاج تسعيرك',
    pushBody: String(co.company_name || 'منشأة') + ' — ' + title
      + (priced ? ' — بانتظار دفعه' : ' — سعّرها ثم أصدرها للدفع'),
    tag: 'srv-' + row.id,
  }).catch(() => {});

  return NextResponse.json({ ok: true, id: row.id, status: row.status, price: row.price });
}
