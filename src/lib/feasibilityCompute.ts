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
  fixedCosts: number; ebitda: number;
  depreciation: number;    // استهلاك الأصول الرأسمالية — مصروف غير نقدي
  financeCharge: number;   // كلفة التمويل وحدها (ربح المرابحة) — مصروف في قائمة الدخل
  debtService: number;     // القسط السنوي كاملاً (أصل + كلفة) — خروج نقدي
  netProfit: number;       // صافي الربح المحاسبي = ebitda − استهلاك − كلفة تمويل
  cashFlow: number;        // صافي التدفق النقدي = ebitda − القسط الكامل
  cumulativeCash: number;
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

  // الاستهلاك: التكلفة الرأسمالية على خمس سنوات (قسط ثابت) — مصروف غير نقدي
  const depreciation = capex / 5;
  // كلفة التمويل وحدها في المرابحة المسطّحة = الأصل × النسبة، والباقي من القسط سداد أصل
  const annualCharge = principal > 0 ? principal * rate : 0;

  const years: YearProjection[] = [];
  let cumulative = -(n(i.ownFunds) > 0 ? totalInvestment - principal : totalInvestment);
  for (let y = 1; y <= 5; y++) {
    const units = n(i.unitsYear1) * Math.pow(1 + n(i.growthRate) / 100, y - 1);
    const revenue = units * n(i.unitPrice);
    const variableCosts = revenue * vPct;
    const contribution = revenue - variableCosts;
    const fixedCosts = n(i.fixedCostsAnnual) * Math.pow(1 + n(i.inflationRate) / 100, y - 1);
    const ebitda = contribution - fixedCosts;
    const financeCharge = y <= yrs ? annualCharge : 0;
    const debtService = y <= yrs ? annualInstalment : 0;
    const netProfit = ebitda - depreciation - financeCharge;
    const cashFlow = ebitda - debtService;
    cumulative += cashFlow;
    years.push({ year: y, revenue, variableCosts, contribution, fixedCosts, ebitda, depreciation, financeCharge, debtService, netProfit, cashFlow, cumulativeCash: cumulative });
  }

  const firstFixed = n(i.fixedCostsAnnual);
  const breakEvenRevenue = contributionMarginPct > 0 ? firstFixed / (contributionMarginPct / 100) : 0;
  const breakEvenUnits = n(i.unitPrice) > 0 ? breakEvenRevenue / n(i.unitPrice) : 0;

  let paybackYears: number | null = null;
  for (let k = 0; k < years.length; k++) {
    if (years[k].cumulativeCash >= 0) {
      const prev = k === 0 ? years[0].cumulativeCash - years[0].cashFlow : years[k - 1].cumulativeCash;
      const need = -prev, gain = years[k].cashFlow;
      paybackYears = gain > 0 ? k + need / gain : k + 1;
      break;
    }
  }
  return { years, totalInvestment, fundingGap, contributionMarginPct, breakEvenRevenue, breakEvenUnits, paybackYears, annualInstalment };
}

const f = (v: number) => Math.round(v).toLocaleString('en-US');

export function renderProjectionTable(r: FeasibilityResult): string {
  const head = ['السنة', 'الإيرادات', 'التكاليف المتغيرة', 'المصاريف الثابتة', 'الأرباح قبل الاستهلاك والتمويل', 'الاستهلاك', 'كلفة التمويل', 'صافي الربح', 'قسط السداد', 'صافي التدفق النقدي', 'النقد التراكمي'];
  const rows = r.years.map(y => '<tr><td>' + [
    'السنة ' + y.year, f(y.revenue), f(y.variableCosts), f(y.fixedCosts), f(y.ebitda), f(y.depreciation), f(y.financeCharge), f(y.netProfit), f(y.debtService), f(y.cashFlow), f(y.cumulativeCash),
  ].join('</td><td>') + '</td></tr>').join('');
  return '<table class="fz sm"><thead><tr><th>' + head.join('</th><th>') + '</th></tr></thead><tbody>' + rows + '</tbody></table>'
    + '<div class="note"><b>قراءة الجدول:</b> «صافي الربح» ربح محاسبي بعد خصم الاستهلاك وكلفة التمويل وحدها، أما «قسط السداد» فيشمل سداد أصل التمويل وهو خروج نقدي لا مصروف — ولذلك يُخصم في عمود التدفق النقدي فقط. الاستهلاك محسوب على التكلفة الرأسمالية بقسط ثابت على خمس سنوات.</div>';
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

// ═══ طبقة الائتمان: ما يقرؤه محلل التمويل قبل أي شيء ═══
export interface CreditYear { year: number; netProfit: number; depreciation: number; financeCharge: number; cfads: number; debtService: number; dscr: number | null }
export interface MonthRow { month: number; revenue: number; variable: number; fixed: number; net: number; cumulative: number }
export interface Scenario { name: string; year1Net: number; dscrY1: number | null; breakEvenRevenue: number; verdict: string }
export interface CreditPack {
  years: CreditYear[]; minDscr: number | null; avgDscr: number | null; verdict: string;
  months: MonthRow[]; deepestMonth: MonthRow | null; workingCapitalNeeded: number;
  scenarios: Scenario[];
}

export function computeCredit(i: FeasibilityInputs, r: FeasibilityResult): CreditPack {
  const dep = n(i.capex) / 5; // استهلاك على خمس سنوات
  // التدفق المتاح لخدمة الدين = صافي الربح + الاستهلاك (غير نقدي) + كلفة التمويل (لأنها جزء من القسط)
  // وهو يساوي الأرباح قبل الاستهلاك والتمويل — فلا يُضاف الاستهلاك إلا بعد أن يكون قد خُصم
  const years: CreditYear[] = r.years.map(y => {
    const cfads = y.netProfit + y.depreciation + y.financeCharge;
    const ds = y.debtService;
    return { year: y.year, netProfit: y.netProfit, depreciation: y.depreciation, financeCharge: y.financeCharge, cfads, debtService: ds, dscr: ds > 0 ? cfads / ds : null };
  });
  const ds = years.map(y => y.dscr).filter((x): x is number => x !== null);
  const minDscr = ds.length ? Math.min(...ds) : null;
  const avgDscr = ds.length ? ds.reduce((a, b) => a + b, 0) / ds.length : null;
  const verdict = minDscr === null ? 'لا يوجد تمويل بأقساط — لا تنطبق نسبة التغطية'
    : minDscr >= 1.5 ? 'تغطية مريحة: التدفق يغطي القسط بفارق واضح في كل السنوات'
    : minDscr >= 1.25 ? 'تغطية مقبولة ائتمانياً: أدنى نسبة ضمن الحد المتعارف عليه'
    : minDscr >= 1 ? 'تغطية حدّية: التدفق يغطي القسط بهامش ضيق، ويُنصح بتمديد الأجل أو رفع المساهمة'
    : 'تغطية غير كافية: التدفق أقل من القسط في سنة واحدة على الأقل — يلزم إعادة هيكلة الطلب';

  // تدفق شهري للسنة الأولى: تصاعد من 50% إلى الطاقة الكاملة بالشهر السادس
  const ramp = (m: number) => m >= 6 ? 1 : 0.5 + 0.1 * (m - 1);
  const rampSum = Array.from({ length: 12 }, (_, k) => ramp(k + 1)).reduce((a, b) => a + b, 0);
  const y1 = r.years[0];
  const months: MonthRow[] = [];
  let cum = -(n(i.capex) + n(i.workingCapital) - n(i.financingAmount) - n(i.ownFunds));
  for (let m = 1; m <= 12; m++) {
    const share = ramp(m) / rampSum;
    const revenue = y1.revenue * share;
    const variable = y1.variableCosts * share;
    const fixed = y1.fixedCosts / 12;                 // الثابتة لا تتصاعد
    const net = revenue - variable - fixed - (y1.debtService / 12);
    cum += net;
    months.push({ month: m, revenue, variable, fixed, net, cumulative: cum });
  }
  const deepestMonth = months.reduce((a, b) => (b.cumulative < a.cumulative ? b : a), months[0]);
  const workingCapitalNeeded = Math.max(0, -deepestMonth.cumulative);

  // ثلاثة سيناريوهات
  const mk = (name: string, revMul: number, costMul: number): Scenario => {
    const rev = y1.revenue * revMul;
    const varc = y1.variableCosts * revMul * costMul;
    const fixed = y1.fixedCosts * costMul;
    const eb = rev - varc - fixed;
    const cfads = eb;                 // نفس أساس الجدول الرئيسي: لا إضافة استهلاك لم يُخصم
    const svc = y1.debtService;
    const cm = rev > 0 ? (rev - varc) / rev : 0;
    const be = cm > 0 ? fixed / cm : 0;
    const d = svc > 0 ? cfads / svc : null;
    return { name, year1Net: eb - dep - y1.financeCharge, dscrY1: d,
      breakEvenRevenue: be,
      verdict: d === null ? '—' : d >= 1.25 ? 'يتحمّل' : d >= 1 ? 'حدّي' : 'لا يتحمّل' };
  };
  return { years, minDscr, avgDscr, verdict, months, deepestMonth, workingCapitalNeeded,
    scenarios: [mk('متحفّظ: مبيعات −20% وتكاليف +10%', 0.8, 1.1), mk('أساسي: كما قُدّم', 1, 1), mk('متفائل: مبيعات +15%', 1.15, 1)] };
}

export function renderCreditTable(c: CreditPack): string {
  const rows = c.years.map(y => '<tr><td>' + ['السنة ' + y.year, f(y.netProfit), f(y.depreciation), f(y.financeCharge), f(y.cfads), f(y.debtService),
    y.dscr === null ? '—' : y.dscr.toFixed(2) + '×'].join('</td><td>') + '</td></tr>').join('');
  return '<table class="fz"><thead><tr><th>السنة</th><th>صافي الربح</th><th>+ الاستهلاك</th><th>+ كلفة التمويل</th><th>التدفق المتاح للسداد</th><th>خدمة الدين (القسط)</th><th>نسبة التغطية</th></tr></thead><tbody>' + rows + '</tbody></table>'
    + '<div class="note"><b>نسبة تغطية خدمة الدين (DSCR):</b> ' + (c.minDscr === null ? '—' : 'أدناها ' + c.minDscr.toFixed(2) + '× ومتوسطها ' + (c.avgDscr as number).toFixed(2) + '×') + ' — ' + c.verdict + '. الحد المتعارف عليه لدى جهات التمويل هو 1.25×. التدفق المتاح للسداد يُبنى بإرجاع المصروفات غير النقدية (الاستهلاك) وكلفة التمويل إلى صافي الربح، فيقابَل بالقسط كاملاً أصلاً وكلفةً.</div>';
}

export function renderMonthlyTable(c: CreditPack): string {
  const rows = c.months.map(m => '<tr><td>' + ['الشهر ' + m.month, f(m.revenue), f(m.variable), f(m.fixed), f(m.net), f(m.cumulative)].join('</td><td>') + '</td></tr>').join('');
  return '<table class="fz"><thead><tr><th>الشهر</th><th>الإيرادات</th><th>التكاليف المتغيرة</th><th>المصاريف الثابتة</th><th>صافي الشهر</th><th>النقد التراكمي</th></tr></thead><tbody>' + rows + '</tbody></table>'
    + '<div class="note"><b>أعمق نقطة نقدية:</b> الشهر ' + (c.deepestMonth?.month || '—') + ' عند ' + f(c.deepestMonth?.cumulative || 0) + ' ريال — أي أن رأس المال العامل اللازم لتجاوز السنة الأولى لا يقل عن <b>' + f(c.workingCapitalNeeded) + ' ريال</b>. التصاعد المفترض: 50% من الطاقة في الشهر الأول وبلوغ الطاقة الكاملة في الشهر السادس.</div>';
}

export function renderScenarioTable(c: CreditPack): string {
  const rows = c.scenarios.map(s => '<tr><td>' + [s.name, f(s.year1Net), s.dscrY1 === null ? '—' : s.dscrY1.toFixed(2) + '×', f(s.breakEvenRevenue), s.verdict].join('</td><td>') + '</td></tr>').join('');
  return '<table class="fz"><thead><tr><th>السيناريو</th><th>صافي ربح السنة الأولى</th><th>نسبة التغطية</th><th>نقطة التعادل</th><th>الحكم</th></tr></thead><tbody>' + rows + '</tbody></table>';
}
