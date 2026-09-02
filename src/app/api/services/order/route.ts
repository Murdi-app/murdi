import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { canonicalTitle, commercialFor, CATALOG } from '@/lib/serviceCatalog';
import { priceFor } from '@/lib/servicePricing';

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
  const { data: co } = await sa
    .from('companies')
    .select('id')
    .eq('user_id', auth.user.id)
    .maybeSingle();
  if (!co) return NextResponse.json({ error: 'لا يوجد ملف منشأة' }, { status: 404 });

  // طلب مفتوح واحد لكل خدمة — النقر المتكرر لا يُنشئ طوابير ولا فواتير
  const { data: open } = await sa
    .from('service_requests')
    .select('id, status, price')
    .eq('company_id', co.id)
    .eq('service_title', title)
    .not('status', 'in', '("completed","cancelled")')
    .maybeSingle();
  if (open) return NextResponse.json({ ok: true, already: true, id: open.id, status: open.status });

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
    })
    .select('id, status, price')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await sa.from('deal_events').insert({
    company_id: co.id,
    kind: 'service',
    title: 'طلب العميل خدمة: ' + title,
    detail: priced ? 'سُعِّرت آلياً بـ' + amount + ' ريال — بانتظار الدفع' : 'تحتاج تسعيرك',
    actor: 'system',
    needs_owner: !priced,
  });

  return NextResponse.json({ ok: true, id: row.id, status: row.status, price: row.price });
}
