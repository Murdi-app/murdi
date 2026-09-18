// ═══════════════════════════════════════════════════════════════════════
// دراسة جدوى التطوير العقاري — نموذج شهري مستقل عن `feasibilityCompute`
// ═══════════════════════════════════════════════════════════════════════
//
// لماذا ملفٌّ مستقل؟ لأن محرّك الجدوى العام يقيس نشاطاً تشغيلياً: وحداتٌ
// تُباع سنوياً بهامشٍ متغيّر ومصاريف ثابتة. والتطوير العقاري ليس كذلك —
// هو **مشروعٌ ينتهي**: يُنفق أولاً ثم يُباع، والنقد فيه يتحرّك شهراً بشهر
// لا سنةً بسنة، والفرق بين نجاحه وفشله يقع داخل الشهور لا بين السنوات.
//
// وأربعة أشياء تعلّمناها في دراسة ٢٨ مليون دولار (سبتمبر ٢٠٢٦) وهي
// مُشفَّرة هنا، لأن إغفال أيٍّ منها يُنتج دراسةً تُرفض:
//
// ★ (١) **السقف يُقاس على حالة «بلا مبيعات» لا على الحالة المتوقعة.**
//   حين قِسنا التسهيل على الحالة الأساس خرج السحب ١٧ مليوناً لطلبٍ قدره
//   ١٠٥ — وهذا سؤالٌ قاتل في لجنة الائتمان: «ولماذا تطلب ما لا تستعمل؟»
//   فالصواب أن يُقاس السقف بما **يُنجز المشروع كاملاً دون تحصيل ريال**،
//   ثم يُقال للممول: والاستخدام المتوقع أقلّ. فيصير السقف حدَّ أمانٍ
//   مبرَّراً لا رقماً مُنتفخاً. وهذه دالة `facilityFloor`.
//
// ★ (٢) **ثمن الأرض يُؤجَّل ولا يُموَّل.** الأرض أكبر بندٍ وأقلّه إنتاجاً
//   للممول: ماله يتحوّل إلى ترابٍ لا إلى مبنى. فالمقدَّم نسبةٌ صغيرة
//   والباقي من حصيلة البيع — فيذهب التمويل إلى البناء، وتبقى الأرض
//   مملوكةً للمشروع ومؤشَّراً على صكّها.
//
// ★ (٣) **المراحل تحجز المخاطرة.** مشروعٌ واحد كبير = التزامٌ لا يقبل
//   التجزئة ولا يُوقَف في منتصفه. والمراحل تُنجَز تباعاً فيبقى الانكشاف
//   محصوراً في مرحلةٍ واحدة، وتُعاد حصيلة الأولى في التي تليها.
//
// ★ (٤) **دفعات المشتري تسبق التسليم.** جدول ١٠/٦٠/٣٠ عبر حساب الضمان
//   يعني أن ٧٠٪ من الثمن يصل **أثناء** البناء لا بعده — وهو ما يجعل
//   المشروع يسدّد نفسه قبل أن ينتهي. وإغفاله يُظهر حاجةً تمويلية وهمية.

export interface RealEstateInputs {
  /** مساحة الأرض بالمتر المربع */
  plotArea: number;
  /** سعر متر الأرض */
  landPricePerSqm: number;
  /** معامل البناء — إجمالي المسطحات ÷ مساحة الأرض */
  far: number;
  /** كفاءة المساحة القابلة للبيع من إجمالي المسطحات (0–1) */
  efficiency: number;
  /** كلفة البناء لمتر المسطح */
  buildCostPerSqm: number;
  /** سعر بيع متر المساحة الصافية */
  salePricePerSqm: number;
  /** متوسط مساحة الوحدة */
  avgUnitSqm: number;
  /** عدد المراحل التنفيذية */
  phases: number;
  /** مدة بناء المرحلة بالأشهر */
  phaseBuildMonths: number;
  /** الفجوة بين بدء مرحلة والتي تليها بالأشهر */
  phaseOffsetMonths: number;
  /** شهر إطلاق بيع المرحلة الأولى */
  firstSaleMonth: number;
  /** معدّل البيع — وحدة/شهر لكامل المشروع */
  absorptionPerMonth: number;
  /** التكاليف غير المباشرة كنسبة من الإنشاء (تصميم·رخص·بنية·إدارة·طوارئ) */
  softCostPct: number;
  /** التسويق والعمولات كنسبة من المبيعات */
  marketingPct: number;
  /** الدفعة المقدمة من ثمن الأرض (0–1) */
  landDownPct: number;
  /** عدد أقساط ثمن الأرض المؤجّل */
  landDeferMonths: number;
  /** كلفة التمويل السنوية (نسبة عشرية) */
  financeRate: number;
  /** فترة السماح بالأشهر */
  graceMonths: number;
  /** سقف التسهيل — إن تُرك صفراً حُسب تلقائياً بـ`facilityFloor` */
  facility?: number;
  /** جدول دفعات المشتري: تعاقد · إنجاز · تسليم (مجموعها 1) */
  payContract?: number;
  payProgress?: number;
  payHandover?: number;
}

export interface MonthRow {
  month: number;
  receipts: number;    // متحصلات البيع
  outflows: number;    // مصروفات (أرض · إنشاء · غير مباشرة · تسويق)
  drawn: number;       // المسحوب من التسهيل هذا الشهر
  balance: number;     // الرصيد المستخدم آخر الشهر
  cash: number;        // النقد بيد المشروع
}

export interface RealEstateResult {
  // المقاسات
  gfa: number; nsa: number; units: number; unitPrice: number;
  // الأرقام
  landCost: number; constructionCost: number; softCosts: number;
  marketingCost: number; totalCost: number; gdv: number;
  financeCost: number; profit: number;
  marginOnGdv: number; marginOnCost: number;
  // التمويل
  facility: number; facilityFloor: number;
  peakBalance: number; peakPctOfFacility: number;
  totalDrawn: number; payoffMonth: number | null;
  // الجدوى
  irr: number | null; npv: number;
  breakEvenUnits: number; breakEvenPct: number;
  // التفصيل
  months: MonthRow[];
  horizonMonths: number;
}

const DISCOUNT = 0.12;

/** منحنى S مبسّط لتوزيع كلفة الإنشاء على مدة المرحلة */
function sCurve(n: number): number[] {
  if (n <= 1) return [1];
  const w = Array.from({ length: n }, (_, i) => {
    const x = (i - (n - 1) / 2) / ((n - 1) / 2);
    return 1 - Math.pow(Math.abs(x), 1.6);
  });
  const s = w.reduce((a, b) => a + b, 0);
  return w.map((x) => x / s);
}

function npvOf(rate: number, flows: number[]): number {
  return flows.reduce((s, c, t) => s + c / Math.pow(1 + rate, t / 12), 0);
}

function irrOf(flows: number[]): number | null {
  let lo = -0.949, hi = 5;
  const f = (r: number) => npvOf(r, flows);
  if (f(lo) * f(hi) > 0) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid) > 0) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

/** المقاسات المشتقّة من الأرض ومعامل البناء */
function dims(i: RealEstateInputs) {
  const gfa = i.plotArea * i.far;
  const nsa = gfa * i.efficiency;
  const units = Math.max(1, Math.round(nsa / i.avgUnitSqm));
  return { gfa, nsa, units };
}

/**
 * ★ حدّ السقف المبرَّر: ما يلزم لإنجاز المشروع كاملاً **دون تحصيل أي
 *   مبيعات**. وهذا هو الرقم الذي يُطلب، لا ذروة الحالة المتوقعة.
 *   = مقدَّم الأرض + كامل الإنشاء + التكاليف غير المباشرة.
 */
export function facilityFloor(i: RealEstateInputs): number {
  const { gfa } = dims(i);
  const land = i.plotArea * i.landPricePerSqm;
  const constr = gfa * i.buildCostPerSqm;
  return land * i.landDownPct + constr * (1 + i.softCostPct);
}

/** النموذج الشهري الكامل */
export function computeRealEstate(i: RealEstateInputs): RealEstateResult {
  const { gfa, nsa, units } = dims(i);
  const landCost = i.plotArea * i.landPricePerSqm;
  const constructionCost = gfa * i.buildCostPerSqm;
  const softCosts = constructionCost * i.softCostPct;
  const gdv = nsa * i.salePricePerSqm;
  const marketingCost = gdv * i.marketingPct;
  const totalCost = landCost + constructionCost + softCosts + marketingCost;
  const unitPrice = gdv / units;

  const pc = i.payContract ?? 0.10;
  const pp = i.payProgress ?? 0.60;
  const ph = i.payHandover ?? 0.30;

  const lastStart = i.firstSaleMonth + (i.phases - 1) * i.phaseOffsetMonths;
  const H = Math.max(60, lastStart + i.phaseBuildMonths + Math.ceil(units / Math.max(1, i.absorptionPerMonth)) + 12);

  const inn = new Array<number>(H + 1).fill(0);
  const out = new Array<number>(H + 1).fill(0);

  // الأرض: مقدَّمٌ في الشهر الأول، والمؤجَّل أقساطاً تبدأ بعد السماح
  out[1] += landCost * i.landDownPct;
  const defer = landCost * (1 - i.landDownPct);
  const dStart = i.graceMonths + 2;
  for (let m = dStart; m < dStart + i.landDeferMonths && m <= H; m++) {
    out[m] += defer / i.landDeferMonths;
  }

  const share = 1 / i.phases;
  for (let p = 0; p < i.phases; p++) {
    const buildStart = Math.max(1, i.firstSaleMonth - 4) + p * i.phaseOffsetMonths;
    const buildEnd = buildStart + i.phaseBuildMonths - 1;
    const saleStart = i.firstSaleMonth + p * i.phaseOffsetMonths;

    const w = sCurve(i.phaseBuildMonths);
    const phaseBuild = (constructionCost + softCosts) * share;
    for (let k = 0; k < i.phaseBuildMonths; k++) {
      const m = buildStart + k;
      if (m <= H) out[m] += phaseBuild * w[k];
    }

    let remaining = units * share;
    let m = saleStart;
    while (remaining > 0.001 && m <= H) {
      const u = Math.min(i.absorptionPerMonth, remaining);
      remaining -= u;
      const value = u * unitPrice;
      out[m] += value * i.marketingPct;
      inn[m] += value * pc;
      const spread = Math.max(1, buildEnd - m + 1);
      for (let j = m; j <= Math.min(buildEnd, H); j++) inn[j] += (value * pp) / spread;
      inn[Math.min(buildEnd + 2, H)] += value * ph;
      m++;
    }
  }

  const floor = facilityFloor(i);
  const facility = i.facility && i.facility > 0 ? i.facility : floor;

  let balance = 0, cash = 0, accrued = 0, totalDrawn = 0, profitPaid = 0;
  const months: MonthRow[] = [];
  for (let m = 1; m <= H; m++) {
    const net = inn[m] - out[m];
    let draw = 0;
    const need = -(cash + net);
    if (need > 0 && totalDrawn < facility) {
      draw = Math.min(need, facility - totalDrawn);
      totalDrawn += draw; balance += draw;
    }
    cash += net + draw;
    accrued += (balance * i.financeRate) / 12;
    if (m > i.graceMonths) {
      const payP = Math.min(accrued, Math.max(cash, 0));
      cash -= payP; accrued -= payP; profitPaid += payP;
      if (cash > 0 && balance > 0) {
        const sweep = Math.min(cash * 0.75, balance);
        balance -= sweep; cash -= sweep;
      }
    }
    months.push({ month: m, receipts: inn[m], outflows: out[m], drawn: draw, balance, cash });
  }

  const financeCost = profitPaid + accrued;
  const profit = gdv - totalCost - financeCost;
  const peakBalance = months.reduce((mx, r) => Math.max(mx, r.balance), 0);
  const payoff = months.find((r) => r.month > i.graceMonths && r.balance <= 1)?.month ?? null;
  const flows = [0, ...months.map((r) => r.receipts - r.outflows)];
  const breakEvenUnits = Math.ceil(totalCost / unitPrice);

  return {
    gfa, nsa, units, unitPrice,
    landCost, constructionCost, softCosts, marketingCost, totalCost, gdv,
    financeCost, profit,
    marginOnGdv: gdv > 0 ? profit / gdv : 0,
    marginOnCost: totalCost + financeCost > 0 ? profit / (totalCost + financeCost) : 0,
    facility, facilityFloor: floor,
    peakBalance, peakPctOfFacility: facility > 0 ? peakBalance / facility : 0,
    totalDrawn, payoffMonth: payoff,
    irr: irrOf(flows), npv: npvOf(DISCOUNT, flows),
    breakEvenUnits, breakEvenPct: breakEvenUnits / units,
    months, horizonMonths: H,
  };
}

/**
 * ★ اختبار الإجهاد — والمركّب منه هو ما يُقنع لجنة الائتمان لا المنفرد.
 *   دراسةٌ تعرض السيناريو المتفائل وحده تُقرأ دعايةً؛ ودراسةٌ تُظهر
 *   بقاء المشروع موجباً تحت أربعة انحرافاتٍ مجتمعة تُقرأ قياساً.
 */
export interface StressCase { label: string; result: RealEstateResult }

export function stressRealEstate(i: RealEstateInputs): StressCase[] {
  const mk = (label: string, o: Partial<RealEstateInputs>) => ({
    label, result: computeRealEstate({ ...i, ...o }),
  });
  const slow = Math.max(1, Math.round(i.absorptionPerMonth * (2 / 3)));
  return [
    mk('الحالة الأساس', {}),
    mk('تباطؤ البيع إلى الثلثين', { absorptionPerMonth: slow }),
    mk('انخفاض السعر ١٠٪', { salePricePerSqm: i.salePricePerSqm * 0.9 }),
    mk('ارتفاع كلفة البناء ١٥٪', { buildCostPerSqm: i.buildCostPerSqm * 1.15 }),
    mk('تأخّر ستة أشهر', { firstSaleMonth: i.firstSaleMonth + 6 }),
    mk('الإجهاد المركّب', {
      absorptionPerMonth: slow,
      salePricePerSqm: i.salePricePerSqm * 0.9,
      buildCostPerSqm: i.buildCostPerSqm * 1.15,
      firstSaleMonth: i.firstSaleMonth + 6,
    }),
  ];
}

/** ملخّصٌ سنوي يُعرض في الوثيقة بدل ستين سطراً شهرياً */
export function annualSummary(r: RealEstateResult) {
  const years: { year: number; receipts: number; outflows: number; drawn: number; endBalance: number }[] = [];
  for (let y = 1; y * 12 - 11 <= r.horizonMonths; y++) {
    const slice = r.months.filter((m) => m.month > (y - 1) * 12 && m.month <= y * 12);
    if (!slice.length) break;
    const receipts = slice.reduce((s, m) => s + m.receipts, 0);
    const outflows = slice.reduce((s, m) => s + m.outflows, 0);
    if (receipts + outflows < 1 && !slice.some((m) => m.balance > 1)) break;
    years.push({
      year: y, receipts, outflows,
      drawn: slice.reduce((s, m) => s + m.drawn, 0),
      endBalance: slice[slice.length - 1].balance,
    });
  }
  return years;
}
