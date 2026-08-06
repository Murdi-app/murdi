import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { generateFileContent, buildFileHTML, type FileClientData } from '@/lib/fileGenerate';
import { buildComputedStatements, renderStatementsHtml } from '@/lib/financialCompute';
import { checkFinancialIntegrity, normalizeDebt } from '@/lib/dataIntegrity';
import { logError } from '@/lib/logError';

const ADMIN_EMAIL = 'hololalmurdi.fs@gmail.com';

async function getAdmin() {
  const cookieStore = await cookies();
  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await sb.auth.getUser();
  if (!user || user.email !== ADMIN_EMAIL) return null;
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  );
}

// POST { company_id, track } : يولّد ملف HTML احترافي
export async function POST(req: Request) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 });

  let companyId = '', track = 'funding', region = '';
  let fundingAmount: number | undefined;
  try { const b = await req.json(); companyId = String(b.company_id || ''); track = (b.track === 'investment' || b.track === 'acquisition') ? String(b.track) : 'funding'; region = String(b.region || ''); const fa = Number(b.funding_amount); if (fa > 0) fundingAmount = fa; }
  catch { return NextResponse.json({ error: 'طلب غير صالح' }, { status: 400 }); }
  if (!companyId) return NextResponse.json({ error: 'company_id مطلوب' }, { status: 400 });

  // القوائم المالية المُنجزة (إن وُجدت)
  let statementsHtml = '';
  try {
    const { data: srv } = await admin.from('service_requests')
      .select('id, admin_deliverable, service_title, status, updated_at')
      .eq('company_id', companyId)
      .order('updated_at', { ascending: false });
    const fin = (srv || []).find((x) => String(x.service_title || '').includes('قوائم'));
    if (fin) {
      const { data: si } = await admin.from('service_inputs').select('*').eq('service_request_id', fin.id).maybeSingle();
      const yrs = si?.inputs?.years;
      if (yrs) statementsHtml = renderStatementsHtml(buildComputedStatements(yrs));
    }
  } catch {}

  // بيانات الشركة
  const { data: company } = await admin
    .from('companies')
    .select('company_name, cr_number, sector, city, goal')
    .eq('id', companyId)
    .single();
  if (!company) return NextResponse.json({ error: 'الشركة غير موجودة' }, { status: 404 });

  // أحدث بيانات مالية
  const { data: fd } = await admin
    .from('financial_data')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  // أحدث تقييم
  const { data: rr } = await admin
    .from('readiness_results')
    .select('readiness_score, verdict, valuation_estimate')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  // طبقة التصحيح: إن وُجد تصحيح معتمد من المستشار، فهو مصدر الحقيقة
  const { data: corr } = await admin.from('admin_corrections').select('*').eq('company_id', companyId).order('created_at', { ascending: false }).limit(1).maybeSingle();

  const effective = {
    ...(fd || {}),
    ...(corr?.original_loan_amount != null ? { original_loan_amount: corr.original_loan_amount } : {}),
    ...(corr?.debt_remaining != null ? { debt_remaining: corr.debt_remaining } : {}),
    ...(corr?.annual_revenue != null ? { annual_revenue: corr.annual_revenue } : {}),
  };

  // بوابة السلامة: لا يخرج ملف يُخاطَب به طرف خارجي وهو يحمل تناقضاً
  const issues = checkFinancialIntegrity(effective);
  if (issues.length > 0) {
    const dn = normalizeDebt(effective);
    return NextResponse.json({ error: 'INTEGRITY_FAILED', issues, current: { original_loan_amount: dn.original, debt_remaining: dn.remaining, annual_revenue: dn.revenue }, companyId }, { status: 422 });
  }

  const dn = normalizeDebt(effective);

  const client: FileClientData = {
    companyName: company.company_name || 'الشركة',
    crNumber: company.cr_number || undefined,
    sector: company.sector || undefined,
    city: company.city || undefined,
    goal: company.goal || undefined,
    fundingAmount,
    revenue: dn.revenue ?? undefined,
    profit: (effective as { net_profit?: number }).net_profit ?? undefined,
    liabilities: dn.remaining ?? undefined,
    readinessScore: rr?.readiness_score ?? undefined,
    verdict: rr?.verdict ?? undefined,
    valuationEstimate: rr?.valuation_estimate ?? undefined,
  };

  try {
    const { data: pin } = await admin.from('service_inputs')
      .select('inputs, updated_at').eq('company_id', companyId).eq('activity_kind', 'pitch')
      .order('updated_at', { ascending: false }).limit(1).maybeSingle();
    const pv = (pin?.inputs as { pitch?: Record<string, string> } | null)?.pitch;
    if (pv && typeof pv === 'object') client.pitchNums = pv;
  } catch {}

  try {
    try {
      const _adm = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string);
      const { data: _fd } = await _adm.from('financial_data').select('assessment_type')
        .eq('company_id', companyId).order('created_at', { ascending: false }).limit(1).single();
      const at = String(_fd?.assessment_type || '');
      if (track !== 'acquisition' && (at === 'investment' || at === 'funding')) track = at;
    } catch {}
    const content = await generateFileContent(client, track as 'funding' | 'investment' | 'acquisition', region);
    const html = buildFileHTML(client, content, track as 'funding' | 'investment' | 'acquisition', region, statementsHtml);
    return NextResponse.json({ ok: true, html });
  } catch (e) {
    await logError('file.generate', e, {});
    return NextResponse.json({ error: 'تعذر التوليد: ' + String(e).slice(0, 120) }, { status: 500 });
  }
}
