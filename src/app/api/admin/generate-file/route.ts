import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { generateFileContent, buildFileHTML, type FileClientData } from '@/lib/fileGenerate';
import { buildComputedStatements, renderStatementsHtml } from '@/lib/financialCompute';
import { checkFinancialIntegrity, normalizeDebt } from '@/lib/dataIntegrity';
import { generateFeasibility, buildFeasibilityHTML, type FeasibilityContext } from '@/lib/feasibilityGenerate';
import { logError } from '@/lib/logError';
import { requireAdmin } from '@/lib/requireAdmin';

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
export const maxDuration = 300;
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return NextResponse.json({ error: denied }, { status: 401 });
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 });

  let companyId = '', track = 'funding', region = '';
  let fundingAmount: number | undefined;
  let reqId = '';
  let purpose = '';
  let quickMode = false;
  try { const b = await req.json(); companyId = String(b.company_id || ''); track = (b.track === 'feasibility' || b.track === 'investment' || b.track === 'acquisition' || b.track === 'valuation' || b.track === 'negotiation' || b.track === 'intake' || b.track === 'feasibility') ? String(b.track) : 'funding'; region = String(b.region || ''); const fa = Number(b.funding_amount); if (fa > 0) fundingAmount = fa; reqId = String(b.service_request_id || ''); purpose = String(b.funding_purpose || ''); quickMode = b.mode === 'quick'; }
  catch { return NextResponse.json({ error: 'طلب غير صالح' }, { status: 400 }); }
  if (!companyId) return NextResponse.json({ error: 'company_id مطلوب' }, { status: 400 });
  if (reqId && (fundingAmount || purpose)) {
    try {
      const adm2 = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string);
      await adm2.from('service_inputs').upsert({ service_request_id: reqId, company_id: companyId,
        activity_kind: 'funding', inputs: { amount: fundingAmount || null, purpose: purpose || null },
        updated_at: new Date().toISOString() }, { onConflict: 'service_request_id' });
    } catch (e) { await logError('file.saveFundingInputs', e, { company_id: companyId }); }
  }

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
    fundingPurpose: purpose || (effective as { funding_purpose?: string }).funding_purpose || undefined,
    majorBuyers: (effective as { major_buyers?: string }).major_buyers || undefined,
    clientType: (effective as { client_type?: string }).client_type || undefined,
    collectionCycle: (effective as { collection_cycle?: string }).collection_cycle || undefined,
    hasFleet: (effective as { has_fleet?: boolean }).has_fleet || undefined,
    issuesInvoices: (effective as { issues_invoices?: boolean }).issues_invoices || undefined,
    hasCollateral: (effective as { has_collateral?: string }).has_collateral || undefined,
    yearsOperating: (effective as { years_operating?: number }).years_operating || undefined,
    debtDetail: (() => {
      const e = effective as { lender_name?: string; monthly_installment?: number; debt_type?: string; debt_status?: string };
      const parts: string[] = [];
      if (dn.remaining) parts.push('المتبقي ' + Number(dn.remaining).toLocaleString('en-US') + ' ريال');
      if (e.monthly_installment) parts.push('قسط شهري ' + Number(e.monthly_installment).toLocaleString('en-US') + ' ريال');
      if (e.lender_name) parts.push('لدى ' + e.lender_name);
      if (e.debt_status === 'committed') parts.push('منتظم السداد');
      return parts.length ? parts.join(' · ') : undefined;
    })(),
  };

  try {
    const { data: pin } = await admin.from('service_inputs')
      .select('inputs, updated_at').eq('company_id', companyId).eq('activity_kind', 'pitch')
      .order('updated_at', { ascending: false }).limit(1).maybeSingle();
    const pv = (pin?.inputs as { pitch?: Record<string, string> } | null)?.pitch;
    if (pv && typeof pv === 'object') client.pitchNums = pv;
  } catch {}

  if (track === 'feasibility') {
    try {
      const { data: fz } = await admin.from('service_inputs')
        .select('inputs, updated_at').eq('company_id', companyId).eq('activity_kind', 'feasibility')
        .order('updated_at', { ascending: false }).limit(1).maybeSingle();
      const raw = (fz?.inputs as Record<string, unknown> | null) || null;
      if (!raw) return NextResponse.json({ error: 'لا توجد مدخلات دراسة جدوى محفوظة لهذه الشركة' }, { status: 400 });
      const num = (k: string) => Number(String((raw as Record<string, unknown>)[k] ?? '').replace(/,/g, '')) || 0;
      const str = (k: string) => String((raw as Record<string, unknown>)[k] ?? '');
      const aud = ['financier', 'investor', 'regulator', 'internal'].includes(str('audience')) ? str('audience') : 'financier';
      const ctx: FeasibilityContext = {
        companyName: client.companyName,
        crNumber: client.crNumber,
        city: client.city,
        projectDescription: str('projectDescription') || 'مشروع غير موصوف',
        sectorText: str('sectorText') || String(client.sector || 'غير محدد'),
        audience: aud as FeasibilityContext['audience'],
        projectKind: str('projectKind') === 'expansion' ? 'expansion' : 'new',
        location: str('location') || undefined,
        capacityNote: str('capacityNote') || undefined,
        staffNote: str('staffNote') || undefined,
        existingRevenue: num('existingRevenue') || undefined,
        quick: quickMode,
        inputs: {
          capex: num('capex'), workingCapital: num('workingCapital'),
          unitPrice: num('unitPrice'), unitsYear1: num('unitsYear1'),
          growthRate: num('growthRate'), variableCostPct: num('variableCostPct'),
          fixedCostsAnnual: num('fixedCostsAnnual'), inflationRate: num('inflationRate') || 3,
          ownFunds: num('ownFunds'), financingAmount: num('financingAmount'),
          financingYears: num('financingYears') || 5, financingRate: num('financingRate'),
          // التوسعة: النشاط القائم يدخل قياس القدرة على السداد بدل أن يُقاس الفرع معزولاً
          existingEbitda: num('existingEbitda'), existingDebtService: num('existingDebtService'),
        },
      };
      // الجهات المرشحة تُقرأ من نتائج المطابقة المحفوظة — قراءة واحدة بلا أي نداء نموذج
      // مسار الجدوى أولاً (مطابقة مستقلة تُشغَّل من بطاقة الدراسة)، فإن لم يوجد فمطابقة التمويل إن سبق تشغيلها
      const cols = 'provider, product, region, requirements, amount_range, timeline, apply_channel, apply_url, required_docs, gaps, fit_score, verdict';
      const pull = (t: string) => admin.from('match_results').select(cols)
        .eq('company_id', companyId).eq('track', t).eq('status', 'new').gt('fit_score', 0)
        .order('fit_score', { ascending: false }).limit(24);  // = سقف مرحلة الإثراء، فلا يظهر صف بلا طريقة تقديم
      let { data: fnd } = await pull('feasibility');
      if (!fnd || !fnd.length) ({ data: fnd } = await pull('funding'));
      const { sections, result, credit, error } = await generateFeasibility(ctx);
      const html = buildFeasibilityHTML(ctx, sections, result, error || (sections.executiveSummary ? undefined : 'لم تصل الأقسام النصية من النموذج'), credit, (fnd || []) as never);
      return NextResponse.json({ ok: true, html, warn: error || undefined });
    } catch (e) {
      await logError('feasibility.generate', e, {});
      return NextResponse.json({ error: 'تعذر توليد الجدوى: ' + String(e).slice(0, 120) }, { status: 500 });
    }
  }
  try {
    try {
      const _adm = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string);
      const { data: _fd } = await _adm.from('financial_data').select('assessment_type')
        .eq('company_id', companyId).order('created_at', { ascending: false }).limit(1).single();
      const at = String(_fd?.assessment_type || '');
      if (track !== 'acquisition' && track !== 'valuation' && track !== 'negotiation' && track !== 'intake' && (at === 'investment' || at === 'funding')) track = at;
    } catch {}
    const content = await generateFileContent(client, track as 'funding' | 'investment' | 'acquisition' | 'valuation' | 'negotiation' | 'intake', region);
    const html = buildFileHTML(client, content, track as 'funding' | 'investment' | 'acquisition' | 'valuation' | 'negotiation' | 'intake', region, statementsHtml);
    return NextResponse.json({ ok: true, html });
  } catch (e) {
    await logError('file.generate', e, {});
    return NextResponse.json({ error: 'تعذر التوليد: ' + String(e).slice(0, 120) }, { status: 500 });
  }
}
