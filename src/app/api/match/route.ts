import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

export async function POST() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (user === null) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

  const { data: company } = await supabase
    .from('companies')
    .select('id, company_name, cr_number, city, sector, account_status')
    .eq('user_id', user.id)
    .single();

  if (company === null || company.account_status !== 'active') {
    return NextResponse.json({ error: 'الحساب غير مفعّل' }, { status: 403 });
  }

  // آخر بيانات مالية + آخر نتيجة جاهزية
  const { data: fd } = await supabase
    .from('financial_data')
    .select('*')
    .eq('company_id', company.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  const { data: rr } = await supabase
    .from('readiness_results')
    .select('readiness_score, verdict')
    .eq('company_id', company.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (fd === null) return NextResponse.json({ error: 'لا توجد بيانات تقييم' }, { status: 404 });

  // ===== جلب المنتجات عبر service role (محجوبة عن العميل بالـ RLS) =====
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  );

  const { data: products } = await adminClient
    .from('financing_products')
    .select('*');

  const rev = Number(fd.annual_revenue) || 0;
  const years = Number(fd.years_operating) || 0;
  const monthsLate = Number(fd.months_late) || 0;
  const isLate = fd.has_debt === true && fd.debt_status === 'late';

  type Match = { product: Record<string, unknown>; fit: number; reasons: string[] };
  const matches: Match[] = [];

  for (const p of products || []) {
    const reasons: string[] = [];
    let fit = 0;

    // شروط إقصائية
    if (p.min_revenue && rev < Number(p.min_revenue)) continue;
    if (p.min_years_operating && years < Number(p.min_years_operating)) continue;
    if (isLate && p.accepts_late_debt !== true) continue;
    if (isLate && p.accepts_late_debt === true && monthsLate > Number(p.max_months_late || 0)) continue;
    if (p.requires_statements === true && fd.has_financial_statements !== true) continue;
    if (p.requires_zakat === true && fd.zakat_compliant !== true) continue;
    if (fd.cr_valid !== true) continue; // سجل غير ساري = لا مطابقة إطلاقاً

    // حساب نسبة الملاءمة
    const types: string[] = p.funding_types || [];
    if (types.length === 0 || types.includes(fd.funding_type)) {
      fit += 40; reasons.push('نوع التمويل المطلوب متوفر لدى هذه الجهة');
    } else {
      fit += 10; reasons.push('الجهة تقدم منتجات قريبة من النوع المطلوب');
    }

    if (rev >= Number(p.min_revenue || 0) * 2) { fit += 20; reasons.push('الإيرادات أعلى بوضوح من حد القبول'); }
    else { fit += 12; reasons.push('الإيرادات تحقق حد القبول'); }

    if (fd.has_debt === false) { fit += 20; reasons.push('لا توجد ديون قائمة'); }
    else if (fd.debt_status === 'committed') { fit += 15; reasons.push('سجل سداد منتظم'); }
    else { fit += 5; }

    if (fd.tax_compliant === true && fd.zakat_compliant === true) { fit += 10; reasons.push('الالتزام الضريبي والزكوي مكتمل'); }
    if (fd.has_financial_statements === true) { fit += 10; reasons.push('توجد قوائم مالية'); }

    matches.push({ product: p, fit: Math.min(fit, 98), reasons });
  }

  matches.sort((a, b) => b.fit - a.fit);

  // ===== ما يراه العميل: بدون أسماء جهات =====
  const TYPE_LABELS: Record<string, string> = {
    working_capital: 'رأس مال عامل',
    pos: 'تمويل نقاط البيع',
    invoices: 'تمويل الفواتير والمستخلصات',
    assets: 'تمويل أصول ومعدات',
    real_estate: 'عقاري تجاري',
  };

  const clientView = matches.slice(0, 5).map((m) => ({
    funding_type: TYPE_LABELS[(m.product.funding_types as string[] || [])[0]] || 'منتج تمويلي',
    fit_percent: m.fit,
    reasons: m.reasons,
    next_step: 'فريق مُرضي سيتولى التواصل وتجهيز ملفك للتقديم',
  }));

  // حفظ النتيجة
  await adminClient.from('funding_matches').insert({
    company_id: company.id,
    match_count: matches.length,
    funding_types: clientView.map((c) => c.funding_type),
    provider_details: matches.slice(0, 5).map((m) => ({
      product: m.product,
      fit: m.fit,
    })),
  });

  // ===== الإيميل السري للأدمن =====
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const rows = matches.slice(0, 5).map((m) =>
      '<tr><td style="padding:8px;border:1px solid #ddd">' + (m.product.provider_name || m.product.name || '—') +
      '</td><td style="padding:8px;border:1px solid #ddd">' + (m.product.product_name || '—') +
      '</td><td style="padding:8px;border:1px solid #ddd">' + m.fit + '%</td></tr>'
    ).join('');

    await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: 'hololalmurdi.fs@gmail.com',
      subject: 'مطابقة تمويل جديدة — ' + company.company_name,
      html:
        '<div dir="rtl" style="font-family:Arial">' +
        '<h2>مطابقة تمويل جديدة</h2>' +
        '<p><b>الشركة:</b> ' + company.company_name + ' — سجل: ' + company.cr_number + '</p>' +
        '<p><b>المدينة:</b> ' + (company.city || '—') + ' | <b>القطاع:</b> ' + (company.sector || '—') + '</p>' +
        '<p><b>درجة الجاهزية:</b> ' + (rr?.readiness_score ?? '—') + ' — ' + (rr?.verdict ?? '') + '</p>' +
        '<p><b>نوع التمويل المطلوب:</b> ' + (fd.funding_type === 'other' ? fd.funding_type_other : (TYPE_LABELS[fd.funding_type] || fd.funding_type)) + '</p>' +
        '<p><b>الإيرادات:</b> ' + rev.toLocaleString() + ' ر.س | <b>عمر النشاط:</b> ' + years + ' سنة</p>' +
        '<p><b>الديون:</b> ' + (fd.has_debt ? (Number(fd.debt_remaining).toLocaleString() + ' ر.س — ' + (fd.debt_status === 'late' ? 'متأخر ' + monthsLate + ' شهر' : 'ملتزم')) : 'لا يوجد') + '</p>' +
        '<table style="border-collapse:collapse;margin-top:12px"><tr style="background:#E8F5EF">' +
        '<th style="padding:8px;border:1px solid #ddd">الجهة</th><th style="padding:8px;border:1px solid #ddd">المنتج</th><th style="padding:8px;border:1px solid #ddd">الملاءمة</th></tr>' +
        rows + '</table></div>',
    });
  } catch {
    // فشل الإيميل لا يكسر تجربة العميل
  }

  return NextResponse.json({
    ok: true,
    match_count: matches.length,
    matches: clientView,
  });
}
