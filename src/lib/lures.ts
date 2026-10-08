import type { SupabaseClient } from '@supabase/supabase-js';
import { capacityOf } from '@/lib/creditVerdict';
import { buildFeasibilityScopes } from '@/lib/feasibilityScopes';

// «طُعمٌ قبل الدفع» (٨ أكتوبر، بأمر المالك) — رقمٌ عن منشأة العميل نفسها، محسوبٌ من بياناته
// الفعلية بالمحركات القائمة، يظهر قبل الدفع. طبقة عرضٍ فوق المحركات: لا تمسّ المطابقة ولا
// التقييم ولا الاستشارة.
// ★ القاعدة: لا رقم مختلَق. إن نقصت البيانات يُطلب الحقل الناقص وحده (missing)، وإن لم توجد
//   بيانات حقيقية وراء العدد (n) يُعاد null فلا يُعرض.

export type FundingLure = { lo: number; hi: number; n: number | null; chance: number; note?: string } | null;
export type ValueLure = { lo: number; hi: number; basis: 'profit' | 'revenue'; after?: { lo: number; hi: number; contractProfit: number } } | null;
export type ContractLure = { value: number; months: number; collectDays: number | null } | null;
export type Lures = {
  funding: { lure: FundingLure; missing: string[] };
  investment: { value: ValueLure; investors: number | null; missing: string[] };
  acquisition: { value: ValueLure; buyOpportunities: number | null; missing: string[] };
  feasibility: { program: { name: string; max: string; requirement: string } | null; families: number | null; funders: number | null; missing: string[] };
  contract: ContractLure;
  sector: string | null;
};

const num = (v: unknown): number | null => { const n = Number(v); return Number.isFinite(n) && v !== null && v !== '' ? n : null; };
const round = (n: number) => { const p = n >= 1_000_000 ? 100_000 : n >= 100_000 ? 10_000 : 1_000; return Math.round(n / p) * p; };

/** مضاعفات الربح بحسب القطاع — هي نفسها في نص التقييم الآلي (api/assessment/investment) */
function multiples(sector: string): [number, number] {
  const s = sector || '';
  if (/تقني|برمج|software|tech|تطبيق/i.test(s)) return [5, 7];
  if (/صح|طب|تعليم|مدرس|health|edu/i.test(s)) return [4, 6];
  if (/غذ|مطعم|زراع|food|agri/i.test(s)) return [4, 5];
  if (/تجزئ|خدم|retail|service/i.test(s)) return [3, 5];
  return [3, 4]; // صناعة · مقاولات · تجارة
}

export function valuationOf(f: Record<string, unknown> | null, sector: string): { value: ValueLure; missing: string[] } {
  const rev = num(f?.annual_revenue), profit = num(f?.net_profit);
  if (rev === null && profit === null) return { value: null, missing: ['الإيراد السنوي', 'صافي الربح'] };
  if (profit !== null && profit > 0) {
    const [a, b] = multiples(sector);
    return { value: { lo: round(profit * a), hi: round(profit * b), basis: 'profit' }, missing: [] };
  }
  if (rev !== null && rev > 0) return { value: { lo: round(rev * 0.8), hi: round(rev * 1.2), basis: 'revenue' }, missing: profit === null ? ['صافي الربح'] : [] };
  return { value: null, missing: ['الإيراد السنوي'] };
}

/** العقد القائم المسجّل في بيانات العميل — لا يُفترض عقدٌ لم يُسجَّل */
function contractOf(f: Record<string, unknown> | null): ContractLure {
  const v = num(f?.current_contract_value), m = num(f?.current_contract_months);
  if (v === null || v <= 0 || m === null || m <= 0) return null;
  const d = num(f?.current_contract_collect_days);
  return { value: v, months: m, collectDays: d !== null && d > 0 ? d : null };
}

/** «قيمتك بعد تنفيذ عقودك» (٨ أكتوبر): ربح العقد السنوي = قيمته × هامش الربح ÷ مدته بالسنوات (لا تقلّ عن سنة)،
 *  يُضاف إلى الربح الصافي الفعلي ويُضرب في مضاعف القطاع. الهامش: المسجّل للعقد، وإلا هامش القوائم.
 *  ★ لا يُعرض إلا بربحٍ فعلي موجب وعقدٍ مسجّل. */
function afterContract(f: Record<string, unknown> | null, sector: string, c: ContractLure): { lo: number; hi: number; contractProfit: number } | undefined {
  const profit = num(f?.net_profit), rev = num(f?.annual_revenue);
  if (!c || profit === null || profit <= 0) return undefined;
  const margin = num(f?.current_contract_margin) ?? (rev && rev > 0 ? profit / rev : null);
  if (margin === null || margin <= 0) return undefined;
  const yearly = (c.value * margin) / Math.max(1, c.months / 12);
  const [a, b] = multiples(sector);
  return { lo: round((profit + yearly) * a), hi: round((profit + yearly) * b), contractProfit: round(yearly) };
}

export async function computeLures(sb: SupabaseClient, companyId: string, fz?: { investment?: number; ask?: number; isNew?: boolean }): Promise<Lures> {
  const [{ data: co }, { data: f }] = await Promise.all([
    sb.from('companies').select('id, sector').eq('id', companyId).maybeSingle(),
    sb.from('financial_data').select('*').eq('company_id', companyId).order('updated_at', { ascending: false }).limit(1).maybeSingle(),
  ]);
  const fd = (f || null) as Record<string, unknown> | null;
  const sector = String(co?.sector || fd?.sector || '');
  const rev = num(fd?.annual_revenue);

  // ١) تجهيز الملف التمويلي: سعة السداد (capacityOf) ← مدى تقديري، والعدد من مطابقاتٍ حقيقية لمنشآتٍ بحجمه
  const funding: Lures['funding'] = { lure: null, missing: [] };
  if (!fd || num(fd.net_profit) === null) funding.missing.push('صافي الربح');
  if (!fd || rev === null) funding.missing.push('الإيراد السنوي');
  if (fd && num(fd.net_profit) !== null) {
    const cap = capacityOf(fd);
    if (cap) {
      let n: number | null = null;
      const { data: own } = await sb.from('match_results').select('provider').eq('company_id', companyId).eq('track', 'funding').eq('status', 'new').gte('fit_score', 50);
      const set = new Set((own || []).map((r) => String(r.provider)));
      if (!set.size && rev) {
        const { data: peers } = await sb.from('financial_data').select('company_id, annual_revenue').gte('annual_revenue', rev * 0.5).lte('annual_revenue', rev * 2).neq('company_id', companyId);
        const ids = Array.from(new Set((peers || []).map((p) => String(p.company_id))));
        if (ids.length) {
          const { data: pm } = await sb.from('match_results').select('provider').in('company_id', ids).eq('track', 'funding').eq('status', 'new').gte('fit_score', 50);
          for (const r of pm || []) set.add(String(r.provider));
        }
      }
      n = set.size || null;
      // ★ فرصة الحصول على التمويل — سقفها ٦٠٪ (المالك، ٨ أكتوبر): من درجة جاهزية التمويل إن وُجدت،
      //   وإلا من نسبة سعة السداد إلى المبلغ المطلوب. وتُقال معها: ترتفع أو تنخفض بخطوات المستشار والفريق.
      const { data: sc } = await sb.from('readiness_results').select('readiness_score').eq('company_id', companyId).eq('result_type', 'funding').order('created_at', { ascending: false }).limit(1).maybeSingle();
      const score = num(sc?.readiness_score);
      const ratio = cap.ratio ?? (cap.principal > 0 ? 1 : 0);
      const chance = Math.max(15, Math.min(60, score !== null ? Math.round(score * 0.6) : ratio >= 1 ? 55 : ratio >= 0.6 ? 45 : ratio >= 0.3 ? 35 : 25));
      if (cap.principal > 0) {
        const hi = round(cap.principal);
        funding.lure = { lo: round(hi * 0.6), hi, n, chance };
      } else {
        funding.lure = { lo: 0, hi: 0, n, chance, note: 'ربحك الحالي بعد أقساطك القائمة لا يتّسع لتمويلٍ جديد — والتجهيز يبدأ بمعالجة ذلك' };
      }
    }
  }

  // ٢) الاستثمار والاستحواذ: القيمة التقديرية بمضاعفات القطاع (أو تقدير التقييم المحفوظ إن وُجد)
  const { data: rr } = await sb.from('readiness_results').select('valuation_estimate').eq('company_id', companyId).not('valuation_estimate', 'is', null).order('created_at', { ascending: false }).limit(1).maybeSingle();
  const saved = rr?.valuation_estimate as { lo?: number; hi?: number } | null;
  const calc = valuationOf(fd, sector);
  const value: ValueLure = saved && num(saved.lo) && num(saved.hi) ? { lo: round(Number(saved.lo)), hi: round(Number(saved.hi)), basis: 'profit' } : calc.value;
  const contract = contractOf(fd);
  const after = value && value.basis === 'profit' ? afterContract(fd, sector, contract) : undefined;
  if (value && after && after.hi > value.hi) value.after = after;
  const vMissing = value ? [] : calc.missing;
  // عدد المستثمرين: من مطابقات الاستثمار الحقيقية وحدها — ولا مطابقة استثمار بعد، فلا عدد
  const { data: inv } = await sb.from('match_results').select('provider, company_id').eq('track', 'investment').eq('status', 'new').gt('fit_score', 0);
  const investors = inv && inv.length ? new Set(inv.map((r) => String(r.provider))).size : null;
  // فرص الاستحواذ للمشتري: منشآتٌ على المنصة نيّتها البيع في قطاعه (عددٌ بلا أسماء)
  let buyOpportunities: number | null = null;
  if (sector) {
    const key = sector.split(/[\s\-—،,]+/).filter((w) => w.length > 2)[0] || sector;
    const { data: sellers } = await sb.from('financial_data').select('company_id, sector').eq('investment_intent', 'sell').neq('company_id', companyId);
    buyOpportunities = (sellers || []).filter((s) => String(s.sector || '').includes(key)).length;
  }

  // ٣) دراسة الجدوى: أنسب برنامجٍ حكومي مُتحقَّق منه لقطاعه + عدد عائلات الممولين التي تفتحها بوابة الجدوى
  const feasibility: Lures['feasibility'] = { program: null, families: null, funders: null, missing: [] };
  const { data: progs } = await sb.from('gov_programs').select('name, sector_keywords, max_text, requirement, verified, sort, max_investment').eq('verified', true).order('sort');
  const hit = (progs || []).find((p) => { const cap = Number(p.max_investment) || 0; if (cap && ((fz?.investment && fz.investment > cap) || (!fz?.investment && rev !== null && rev > cap))) return false; try { return new RegExp(String(p.sector_keywords), 'i').test(sector); } catch { return false; } });
  if (hit) feasibility.program = { name: String(hit.name), max: String(hit.max_text), requirement: String(hit.requirement) };
  if (!sector) feasibility.missing.push('قطاع المشروع');
  if (fz?.investment && fz.investment > 0) {
    feasibility.families = buildFeasibilityScopes({
      ask: fz.ask && fz.ask > 0 ? fz.ask : fz.investment * 0.6, totalInvestment: fz.investment, isNew: fz.isNew !== false,
      imports: false, importCountries: '', property: 'rent', capexKind: 'mixed',
      foreignOwner: !!fd?.owner_nationality && !/سعود/.test(String(fd.owner_nationality)), ownerNationality: String(fd?.owner_nationality || ''),
      largeBuyers: false, sectorText: sector,
    }).length;
    // عدد الجهات (٨ أكتوبر): من مطابقاتٍ حقيقية — مطابقات الجدوى المحفوظة، وجهات تمويلٍ طابقت منشآتٍ بحجم المشروع،
    // ومستثمرون من مطابقات الاستثمار. عددٌ بلا أسماء، ولا يُعرض إن لم تقم وراءه مطابقة.
    const scale = fz.ask && fz.ask > 0 ? fz.ask : fz.investment;
    const set = new Set<string>();
    const [{ data: fzm }, { data: peers }] = await Promise.all([
      sb.from('match_results').select('provider').eq('track', 'feasibility').eq('status', 'new').gt('fit_score', 0),
      sb.from('financial_data').select('company_id').gte('annual_revenue', scale * 0.5).lte('annual_revenue', scale * 2).neq('company_id', companyId),
    ]);
    for (const r of fzm || []) set.add(String(r.provider));
    const ids = Array.from(new Set((peers || []).map((p) => String(p.company_id))));
    if (ids.length) {
      const { data: pm } = await sb.from('match_results').select('provider').in('company_id', ids).eq('track', 'funding').eq('status', 'new').gte('fit_score', 50);
      for (const r of pm || []) set.add(String(r.provider));
    }
    for (const r of inv || []) set.add(String(r.provider));
    feasibility.funders = set.size || null;
  } else feasibility.missing.push('حجم الاستثمار في المشروع');

  return {
    funding,
    investment: { value, investors, missing: vMissing },
    acquisition: { value, buyOpportunities, missing: vMissing },
    feasibility,
    contract,
    sector: sector || null,
  };
}

/** طُعم التقييم المختصر المجاني (زائرٌ بلا حساب): أعدادٌ حقيقية بحسب شريحة الإيراد وحدها — لا مدى تمويل،
 *  فلا ربح معروف. والمدى يُحسب بعد التسجيل. */
export const MINI_REV_BRACKETS: [number, number][] = [[0, 1_000_000], [1_000_000, 3_000_000], [3_000_000, 10_000_000], [10_000_000, 1e12]];
export async function miniLures(sb: SupabaseClient, revIdx: number): Promise<{ funders: number | null; investors: number | null }> {
  const b = MINI_REV_BRACKETS[revIdx];
  let funders: number | null = null;
  if (b) {
    const { data: peers } = await sb.from('financial_data').select('company_id').gte('annual_revenue', b[0]).lt('annual_revenue', b[1]);
    const ids = Array.from(new Set((peers || []).map((p) => String(p.company_id))));
    if (ids.length) {
      const { data: pm } = await sb.from('match_results').select('provider').in('company_id', ids).eq('track', 'funding').eq('status', 'new').gte('fit_score', 50);
      funders = new Set((pm || []).map((r) => String(r.provider))).size || null;
    }
  }
  const { data: inv } = await sb.from('match_results').select('provider').eq('track', 'investment').eq('status', 'new').gt('fit_score', 0);
  const investors = inv && inv.length ? new Set(inv.map((r) => String(r.provider))).size : null;
  return { funders, investors };
}
