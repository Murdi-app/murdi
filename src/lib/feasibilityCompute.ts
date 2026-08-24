// دوال دراسة الجدوى — توقعات مستقبلية (منفصلة عن financialCompute التي تحسب أرقاماً تاريخية)
export interface FeasibilityInputs {
  capex: number;            // التكلفة الرأسمالية
  workingCapital: number;   // رأس مال عامل مطلوب
  unitPrice: number;        // سعر الوحدة أو متوسط قيمة الخدمة
  unitsYear1: number;       // الوحدات المتوقعة السنة الأولى
  growthRate: number;       // نمو المبيعات السنوي (نسبة مئوية)
  variableCostPct: number;  // التكلفة المتغيرة كنسبة من الإيراد
  fixedCostsAnnual: number; // مصاريف ثابتة سنوية (رواتب وإيجار وغيرها)
  inflationRate: number;    // نمو المصاريف الثابتة سنوياً
  ownFunds: number;         // ما يملكه المؤسس
  financingAmount: number;  // التمويل المطلوب
  financingYears: number;   // مدة السداد
  financingRate: number;    // كلفة التمويل السنوية (نسبة مئوية)
}

export interface YearProjection {
  year: number; revenue: number; variableCosts: number; contribution: number;
  fixedCosts: number; ebitda: number; financingCost: number; netProfit: number; cumulativeCash: number;
}

export interface FeasibilityResult {
  years: YearProjection[];
  totalInvestment: number;
  fundingGap: number;
  contributionMarginPct: number;
  breakEvenRevenue: number;
  breakEvenUnits: number;
  paybackYears: number | null;
  annualInstalment: number;
}

const n = (v: unknown) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };

export function computeFeasibility(i: FeasibilityInputs): FeasibilityResult {
  const capex = n(i.capex), wc = n(i.workingCapital);
  const totalInvestment = capex + wc;
  const fundingGap = totalInvestment - n(i.ownFunds) - n(i.financingAmount);
  const vPct = Math.min(Math.max(n(i.variableCostPct), 0), 100) / 100;
  const contributionMarginPct = (1 - vPct) * 100;

  const yrs = Math.max(1, Math.min(n(i.financingYears) || 5, 30));
  const rate = n(i.financingRate) / 100;
  const principal = n(i.financingAmount);
  const annualInstalment = principal > 0 ? (principal * (1 + rate * yrs)) / yrs : 0;

  const years: YearProjection[] = [];
  let cumulative = -(n(i.ownFunds) > 0 ? totalInvestment - principal : totalInvestment);
  for (let y = 1; y <= 5; y++) {
    const units = n(i.unitsYear1) * Math.pow(1 + n(i.growthRate) / 100, y - 1);
    const revenue = units * n(i.unitPrice);
    const variableCosts = revenue * vPct;
    const contribution = revenue - variableCosts;
    const fixedCosts = n(i.fixedCostsAnnual) * Math.pow(1 + n(i.inflationRate) / 100, y - 1);
    const ebitda = contribution - fixedCosts;
    const financingCost = y <= yrs ? annualInstalment : 0;
    const netProfit = ebitda - financingCost;
    cumulative += netProfit;
    years.push({ year: y, revenue, variableCosts, contribution, fixedCosts, ebitda, financingCost, netProfit, cumulativeCash: cumulative });
  }

  const firstFixed = n(i.fixedCostsAnnual);
  const breakEvenRevenue = contributionMarginPct > 0 ? firstFixed / (contributionMarginPct / 100) : 0;
  const breakEvenUnits = n(i.unitPrice) > 0 ? breakEvenRevenue / n(i.unitPrice) : 0;

  let paybackYears: number | null = null;
  for (let k = 0; k < years.length; k++) {
    if (years[k].cumulativeCash >= 0) {
      const prev = k === 0 ? years[0].cumulativeCash - years[0].netProfit : years[k - 1].cumulativeCash;
      const need = -prev, gain = years[k].netProfit;
      paybackYears = gain > 0 ? k + need / gain : k + 1;
      break;
    }
  }
  return { years, totalInvestment, fundingGap, contributionMarginPct, breakEvenRevenue, breakEvenUnits, paybackYears, annualInstalment };
}

const f = (v: number) => Math.round(v).toLocaleString('en-US');

export function renderProjectionTable(r: FeasibilityResult): string {
  const head = ['السنة', 'الإيرادات', 'التكاليف المتغيرة', 'هامش المساهمة', 'المصاريف الثابتة', 'الأرباح قبل التمويل', 'كلفة التمويل', 'صافي الربح', 'النقد التراكمي'];
  const rows = r.years.map(y => '<tr><td>' + [
    'السنة ' + y.year, f(y.revenue), f(y.variableCosts), f(y.contribution), f(y.fixedCosts), f(y.ebitda), f(y.financingCost), f(y.netProfit), f(y.cumulativeCash),
  ].join('</td><td>') + '</td></tr>').join('');
  return '<table class="fz"><thead><tr><th>' + head.join('</th><th>') + '</th></tr></thead><tbody>' + rows + '</tbody></table>';
}

export function renderFeasibilitySummary(r: FeasibilityResult): string {
  const rows: [string, string][] = [
    ['إجمالي الاستثمار المطلوب', f(r.totalInvestment) + ' ريال'],
    ['فجوة التمويل بعد المساهمة والتمويل المطلوب', f(r.fundingGap) + ' ريال'],
    ['هامش المساهمة', r.contributionMarginPct.toFixed(1) + '%'],
    ['نقطة التعادل (إيراداً سنوياً)', f(r.breakEvenRevenue) + ' ريال'],
    ['نقطة التعادل (وحدات سنوياً)', f(r.breakEvenUnits)],
    ['فترة الاسترداد', r.paybackYears === null ? 'لا تُسترد خلال خمس سنوات بهذه الافتراضات' : r.paybackYears.toFixed(1) + ' سنة'],
    ['القسط السنوي للتمويل', f(r.annualInstalment) + ' ريال'],
  ];
  return '<table class="fz"><tbody>' + rows.map(([k, v]) => '<tr><th>' + k + '</th><td>' + v + '</td></tr>').join('') + '</tbody></table>';
}
