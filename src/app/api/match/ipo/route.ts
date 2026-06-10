import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
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
    .select('id, company_name, cr_number, city, sector, phone, account_status')
    .eq('user_id', user.id)
    .single();

  if (company === null || company.account_status !== 'active') {
    return NextResponse.json({ error: 'الحساب غير مفعّل' }, { status: 403 });
  }

  const { data: fd } = await supabase
    .from('financial_data')
    .select('*')
    .eq('company_id', company.id)
    .eq('assessment_type', 'ipo')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  const { data: rr } = await supabase
    .from('readiness_results')
    .select('readiness_score, verdict, top_obstacles')
    .eq('company_id', company.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (fd === null) return NextResponse.json({ error: 'لا توجد بيانات تقييم طرح' }, { status: 404 });

  const rev = Number(fd.annual_revenue) || 0;
  const profit = Number(fd.net_profit) || 0;
  const score = rr?.readiness_score ?? 0;
  const yes = (v: unknown) => (v === true ? 'نعم' : 'لا');
  const marketLabel = fd.target_market === 'main' ? 'السوق الرئيسية' : 'السوق الموازي (نمو)';

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const obstacleRows = (rr?.top_obstacles || []).map((o: string) =>
      '<li style="margin-bottom:4px">' + o + '</li>'
    ).join('');

    await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: 'hololalmurdi.fs@gmail.com',
      subject: 'تقييم طرح جديد — ' + company.company_name + ' (درجة ' + score + ')',
      html:
        '<div dir="rtl" style="font-family:Arial">' +
        '<h2>ملف طرح جديد</h2>' +
        '<p><b>الشركة:</b> ' + company.company_name + ' — سجل: ' + company.cr_number + '</p>' +
        '<p><b>الجوال:</b> ' + (company.phone || '—') + ' | <b>المدينة:</b> ' + (company.city || '—') + ' | <b>القطاع:</b> ' + (company.sector || '—') + '</p>' +
        '<p><b>IPO Readiness Score:</b> ' + score + '</p>' +
        '<p><b>الحكم:</b> ' + (rr?.verdict ?? '—') + '</p>' +
        '<p><b>السوق المقترح:</b> ' + marketLabel + '</p>' +
        '<hr/>' +
        '<p><b>الإيرادات:</b> ' + rev.toLocaleString() + ' ر.س | <b>صافي الربح:</b> ' + profit.toLocaleString() + ' ر.س</p>' +
        '<p><b>سنوات القوائم المعتمدة:</b> ' + (fd.num_statements_years ?? 0) + ' | <b>مراجع خارجي:</b> ' + yes(fd.external_auditor) + '</p>' +
        '<p><b>حوكمة:</b> ' + yes(fd.has_governance) + ' | <b>مجلس إدارة:</b> ' + yes(fd.has_board) + ' | <b>لجان:</b> ' + yes(fd.has_committees) + '</p>' +
        '<p><b>التزام ضريبي:</b> ' + yes(fd.tax_compliant) + ' | <b>زكاة:</b> ' + yes(fd.zakat_compliant) + '</p>' +
        '<p><b>تركّز أكبر عميل:</b> ' + (fd.top_client_pct ?? '—') + '%</p>' +
        '<hr/>' +
        '<p><b>أبرز العوائق:</b></p><ul>' + obstacleRows + '</ul>' +
        '</div>',
    });
  } catch {}

  return NextResponse.json({ ok: true });
}
