import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { reasonsFor, unlockPitch, type ClientSignals } from '@/lib/serviceTriggers';
import { canonicalTitle } from '@/lib/serviceCatalog';
import { cycleDays, isImporter } from '@/lib/gapDemand';

// طبقة الدليل: لماذا هذه الخدمة لك أنت.
// تُبنى من بيانات العميل نفسه ومن نتائج مطابقته — لا من وصف تسويقي.
// قبل المطابقة: دليل من إجاباته يصنع السؤال. بعدها: نفس العائق وقد صار عدداً من السوق.
export async function GET() {
  const store = await cookies();
  const ss = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    { cookies: { getAll: () => store.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await ss.auth.getUser();
  if (!user) return NextResponse.json({ reasons: [], pitch: null });

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  );
  const { data: co } = await admin.from('companies')
    .select('id, goal').eq('user_id', user.id)
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (!co) return NextResponse.json({ reasons: [], pitch: null });

  const { data: fd } = await admin.from('financial_data')
    .select('*').eq('company_id', co.id)
    .order('created_at', { ascending: false }).limit(1).maybeSingle();

  // فجوات الجهات: أقوى دليل لأنه من السوق لا منّا
  const { data: rows } = await admin.from('match_results')
    .select('gaps').eq('company_id', co.id).eq('track', 'funding').gt('fit_score', 0);
  const gapCounts: Record<string, number> = {};
  for (const r of (rows || [])) {
    for (const g of ((r.gaps || []) as string[])) {
      const k = String(g).slice(0, 60);
      gapCounts[k] = (gapCounts[k] || 0) + 1;
    }
  }
  const totalFunders = (rows || []).length;

  const f = (fd || {}) as Record<string, unknown>;
  const num = (k: string) => Number(f[k] ?? 0) || 0;
  const yes = (k: string) => f[k] === true || f[k] === 'true';

  const intent = f.investment_intent ? 'investor'
    : String(co.goal || '') === 'ipo' ? 'listing'
    : String(f.assessment_type || '') === 'investment' ? 'investor' : 'funding';

  const signals: ClientSignals = {
    foreignOwner: String(f.ownership_type || '') === 'foreign' || Boolean(f.owner_nationality),
    ownerNationality: String(f.owner_nationality || '') || undefined,
    hasParentCompany: yes('has_parent_company'),
    hasStatements: f.has_financial_statements === undefined ? undefined : yes('has_financial_statements'),
    hasCollateral: f.has_collateral === undefined || f.has_collateral === null
      ? undefined : String(f.has_collateral) !== 'none',
    hasDebt: yes('has_debt'),
    annualInstalment: num('monthly_installment') * 12,
    annualRevenue: num('annual_revenue'),
    imports: isImporter(f.trades_cross_border, f.supplier_countries),
    sellsToLargeBuyers: String(f.client_type || '') === 'large',
    // كانت num() تُصيّر «90plus» صفراً، فيسقط شرط «٦٠ يوماً فأكثر» عمّن
    // دورته الأسوأ. القراءة الآن من cycleDays وحدها.
    collectionDays: cycleDays(f.collection_cycle) ?? undefined,
    governanceReady: f.has_governance === undefined ? undefined : yes('has_governance'),
    intent: intent as ClientSignals['intent'],
    projectKind: undefined,
    totalFunders,
    gapCounts,
  };

  const phase = totalFunders > 0 ? 'post' : 'pre';
  const reasons = reasonsFor(signals, phase).map(r => ({ ...r, service: canonicalTitle(r.service) }));
  return NextResponse.json({
    reasons,
    phase,
    pitch: phase === 'pre' ? unlockPitch(signals) : null,
  });
}
