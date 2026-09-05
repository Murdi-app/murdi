import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireStaff } from '@/lib/requireStaff';
import { waNumber } from '@/lib/phone';
import { priceFor, COMMERCIAL } from '@/lib/servicePricing';
import { canonicalTitle } from '@/lib/serviceCatalog';

// فتح ملف عميلٍ باعته الموظفة بالهاتف.
//
// يصنع في نداءٍ واحد ما كان العميل يصنعه بيده في أربع خطوات: حسابه،
// ومنشأته، وأرقام مشروعه، وطلب الخدمة مسعَّراً. ثم يُعيد رابطاً يفتحه
// فيجد كل ذلك جاهزاً وأمامه زرّ الدفع.
//
// وثلاثة أشياء لا يفعلها عمداً:
//   • لا يولّد الوثيقة — تُجهَّز بعد تأكيد التحويل، وإلا سلّمنا ما لم يُدفع.
//   • لا يُسعَّر من الواجهة — السعر يُقرأ من طبقة التسعير في الخادم كما في
//     طلب العميل نفسه، فلا تكتب موظفةٌ رقماً.
//   • لا يمنح كلمة مرور — الرابط يضعها العميل بنفسه.

const SERVICE = 'دراسة الجدوى الاقتصادية';

const admin = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  );

const cut = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n);
const numOf = (v: unknown) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };

export async function POST(req: Request) {
  const { who, error: denied } = await requireStaff();
  if (denied || !who) return NextResponse.json({ error: denied || 'غير مصرح' }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const fullName = cut(b?.full_name, 120);
  const email = cut(b?.email, 160).toLowerCase();
  const phone = waNumber(b?.phone);
  const companyName = cut(b?.company_name, 200) || ('مشروع ' + fullName);
  const city = cut(b?.city, 80) || null;
  const sector = cut(b?.sector, 120) || null;
  const raw = (b?.inputs && typeof b.inputs === 'object') ? b.inputs as Record<string, unknown> : {};

  if (!fullName) return NextResponse.json({ error: 'الاسم مطلوب' }, { status: 400 });
  if (!phone) return NextResponse.json({ error: 'رقم الجوال غير صحيح — اكتبيه 05xxxxxxxx' }, { status: 400 });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'البريد غير صحيح — وبلا بريدٍ لا يُفتح حساب ولا يُرسل رابط' }, { status: 400 });
  }

  const inputs = {
    capex: numOf(raw.capex), workingCapital: numOf(raw.workingCapital),
    unitPrice: numOf(raw.unitPrice), unitsYear1: numOf(raw.unitsYear1),
    growthRate: numOf(raw.growthRate), variableCostPct: numOf(raw.variableCostPct),
    fixedCostsAnnual: numOf(raw.fixedCostsAnnual), inflationRate: numOf(raw.inflationRate),
    ownFunds: numOf(raw.ownFunds), financingAmount: numOf(raw.financingAmount),
    financingYears: numOf(raw.financingYears) || 4, financingRate: numOf(raw.financingRate) || 8,
  };
  if (inputs.unitPrice <= 0 || inputs.unitsYear1 <= 0 || (inputs.capex + inputs.workingCapital) <= 0) {
    return NextResponse.json({ error: 'أرقام المشروع ناقصة — لا يُفتح ملف بلا سعر ووحدات وتكلفة' }, { status: 400 });
  }

  const sb = admin();
  const origin = new URL(req.url).origin;

  // ═══ الحساب ═══
  // من سبق أن سجّل ببريده لا يُفتح له ثانٍ — يُستعمل حسابه القائم، ويُرسل
  // له رابط دخول بدل رابط تعيين. وإلا صار للرجل حسابان وضاع بينهما ملفه.
  let userId = '';
  let isNew = false;
  const { data: created, error: cErr } = await sb.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name: fullName, phone, source: 'intake', opened_by: who.email },
  });
  if (created?.user?.id) { userId = created.user.id; isNew = true; }
  else {
    // البريد مستعمل — نبحث عن صاحبه بدل أن نفشل
    const { data: list } = await sb.auth.admin.listUsers({ page: 1, perPage: 200 });
    const hit = (list?.users || []).find((u) => String(u.email || '').toLowerCase() === email);
    if (!hit) return NextResponse.json({ error: 'تعذّر فتح الحساب: ' + (cErr?.message || 'سبب غير معروف') }, { status: 500 });
    userId = hit.id;
  }

  // ═══ المنشأة ═══
  const { data: existingCo } = await sb.from('companies').select('id, company_name').eq('user_id', userId).maybeSingle();
  let companyId = existingCo?.id as string | undefined;
  if (!companyId) {
    const { data: co, error: coErr } = await sb.from('companies').insert({
      user_id: userId, company_name: companyName, owner_name: fullName,
      phone, city, sector, account_status: 'active',
      admin_note: 'فُتح من مكالمة — ' + (who.role === 'admin' ? 'د. عبدالحكيم' : who.email),
    }).select('id').single();
    if (coErr || !co) return NextResponse.json({ error: 'تعذّر إنشاء المنشأة: ' + (coErr?.message || '') }, { status: 500 });
    companyId = co.id;
  }

  // ═══ الطلب — مسعَّراً من الخادم لا من الواجهة ═══
  const title = canonicalTitle(SERVICE);
  const opt = COMMERCIAL[title]?.options?.find((o) => o.key === 'quick');
  const amount = typeof opt?.price === 'number' ? opt.price : 990;

  const { data: open } = await sb.from('service_requests')
    .select('id, status')
    .eq('company_id', companyId).eq('service_title', title)
    .not('status', 'in', '("completed","cancelled")')
    .maybeSingle();

  let requestId = open?.id as string | undefined;
  if (!requestId) {
    const { data: sr, error: srErr } = await sb.from('service_requests').insert({
      company_id: companyId, service_title: title, service_category: 'قبل أن تضع رأس مالك',
      status: 'priced', price: amount, quoted_price: amount, priced_at: new Date().toISOString(),
      option_key: 'quick',
      client_inputs: { option: 'quick', totalInvestment: inputs.capex + inputs.workingCapital, projectKind: 'new' },
    }).select('id').single();
    if (srErr || !sr) return NextResponse.json({ error: 'تعذّر إنشاء الطلب: ' + (srErr?.message || '') }, { status: 500 });
    requestId = sr.id;
  }

  // ═══ أرقام مشروعه — يقرؤها مولّد الفحص كما لو أدخلها المكتب ═══
  await sb.from('service_inputs').upsert({
    service_request_id: requestId, company_id: companyId,
    activity_kind: 'feasibility', inputs,
    updated_by: who.email, updated_at: new Date().toISOString(),
  }, { onConflict: 'service_request_id' });

  // ═══ الرابط ═══
  // «دعوة» لمن فُتح حسابه الآن، و«استرجاع» لمن كان له حساب — كلاهما يُنهي
  // بتعيين كلمة مرور ثم ينزل على ملفه مباشرة.
  const redirectTo = origin + '/goal?tab=services';
  let link = '';
  try {
    const { data: gen } = await sb.auth.admin.generateLink({
      type: isNew ? 'invite' : 'recovery',
      email,
      options: { redirectTo },
    });
    link = String(gen?.properties?.action_link || '');
  } catch { /* يُعالَج أدناه */ }
  if (!link) link = origin + '/auth/login';

  const tier = priceFor(title, inputs.capex + inputs.workingCapital);
  const full = tier.amount != null ? tier.amount.toLocaleString('en-US') + ' ريال' : 'بعرض خاص';

  const message =
    'أهلاً ' + fullName + '،\n\n'
    + 'هذا رابط ملفك في منصة مُرضي — بياناتك وأرقام مشروعك مسجّلة بالفعل:\n'
    + link + '\n\n'
    + 'افتحه، وضع كلمة المرور، وستجد ' + (opt?.label || 'الفحص الائتماني للمشروع') + ' بـ٩٩٠ ريال جاهزاً للدفع.\n'
    + 'ويصلك خلال ساعات من تأكيد التحويل: صفحة القرار والمؤشرات المالية، وتغطية خدمة الدين وسيناريوهات الضغط، '
    + 'وحدود الأمان ونقطة التعادل وأعمق نقطة سيولة يمرّ بها مشروعك.\n\n'
    + 'وقيمته تُخصم بالكامل من الدراسة الائتمانية الكاملة (' + full + ') إن أكملتها خلال ثلاثين يوماً.\n\n'
    + 'وإن احتجت أي شيء فأنا معك.\n'
    + (who.role === 'admin' ? 'د. عبدالحكيم المرضي' : 'فريق الدكتور عبدالحكيم المرضي')
    + '\nمُرضي للاستشارات المالية';

  await sb.from('deal_events').insert({
    company_id: companyId, kind: 'service',
    title: 'فُتح ملف من مكالمة: ' + companyName,
    detail: (opt?.label || 'الفحص') + ' بـ' + amount + ' ريال — بانتظار دفعه · فتحه ' + (who.role === 'admin' ? 'د. عبدالحكيم' : who.email),
    actor: who.role === 'admin' ? 'owner' : 'staff', needs_owner: false,
  });

  return NextResponse.json({ ok: true, link, message, company_name: companyName, request_id: requestId, existing: !isNew });
}
