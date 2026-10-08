import type { SupabaseClient } from '@supabase/supabase-js';
import { capacityOf } from '@/lib/creditVerdict';
import { buildFeasibilityScopes } from '@/lib/feasibilityScopes';

// «طُعمٌ قبل الدفع» (٨ أكتوبر، بأمر المالك) — رقمٌ عن منشأة العميل نفسها، محسوبٌ من بياناته
// الفعلية بالمحركات القائمة، يظهر قبل الدفع. طبقة عرضٍ فوق المحركات: لا تمسّ المطابقة ولا
// التقييم ولا الاستشارة.
// ★ القاعدة: لا رقم مختلَق. إن نقصت البيانات يُطلب الحقل الناقص وحده (missing)، وإن لم توجد
//   بيانات حقيقية وراء العدد (n) يُعاد null فلا يُعرض.

export type FundingLure = { lo: number; hi: number; n: number | null; note?: string } | null;
export type ValueLure = { lo: number; hi: number; basis: 'profit' | 'revenue' } | null;
export type Lures = {
  funding: { lure: FundingLure; missing: string[] };
  investment: { value: ValueLure; investors: number | null; missing: string[] };
  acquisition: { value: ValueLure; buyOpportunities: number | null; missing: string[] };
  feasibility: { program: { name: string; max: string; requirement: string } | null; families: number | null; missing: string[] };
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
      if (cap.principal > 0) {
        const hi = round(cap.principal);
        funding.lure = { lo: round(hi * 0.6), hi, n };
      } else {
        funding.lure = { lo: 0, hi: 0, n, note: 'ربحك الحالي بعد أقساطك القائمة لا يتّسع لتمويلٍ جديد — والتجهيز يبدأ بمعالجة ذلك' };
      }
    }
  }

  // ٢) الاستثمار والاستحواذ: القيمة التقديرية بمضاعفات القطاع (أو تقدير التقييم المحفوظ إن وُجد)
  const { data: rr } = await sb.from('readiness_results').select('valuation_estimate').eq('company_id', companyId).not('valuation_estimate', 'is', null).order('created_at', { ascending: false }).limit(1).maybeSingle();
  const saved = rr?.valuation_estimate as { lo?: number; hi?: number } | null;
  const calc = valuationOf(fd, sector);
  const value: ValueLure = saved && num(saved.lo) && num(saved.hi) ? { lo: round(Number(saved.lo)), hi: round(Number(saved.hi)), basis: 'profit' } : calc.value;
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
  const feasibility: Lures['feasibility'] = { program: null, families: null, missing: [] };
  const { data: progs } = await sb.from('gov_programs').select('name, sector_keywords, max_text, requirement, verified, sort').eq('verified', true).order('sort');
  const hit = (progs || []).find((p) => { try { return new RegExp(String(p.sector_keywords), 'i').test(sector); } catch { return false; } });
  if (hit) feasibility.program = { name: String(hit.name), max: String(hit.max_text), requirement: String(hit.requirement) };
  if (!sector) feasibility.missing.push('قطاع المشروع');
  if (fz?.investment && fz.investment > 0) {
    feasibility.families = buildFeasibilityScopes({
      ask: fz.ask && fz.ask > 0 ? fz.ask : fz.investment * 0.6, totalInvestment: fz.investment, isNew: fz.isNew !== false,
      imports: false, importCountries: '', property: 'rent', capexKind: 'mixed',
      foreignOwner: !!fd?.owner_nationality && !/سعود/.test(String(fd.owner_nationality)), ownerNationality: String(fd?.owner_nationality || ''),
      largeBuyers: false, sectorText: sector,
    }).length;
  } else feasibility.missing.push('حجم الاستثمار في المشروع');

  return {
    funding,
    investment: { value, investors, missing: vMissing },
    acquisition: { value, buyOpportunities, missing: vMissing },
    feasibility,
    sector: sector || null,
  };
}
