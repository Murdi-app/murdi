// نواة خدمة «تمويل العقد» — تدفّق العقد بالمستخلصات.
//
// الفكرة كلها في جملة: صاحب العقد يربح على الورق ويُفلس في الحساب. يصرف
// على العمالة والمواد شهراً بشهر، ويُحصّل مستخلصه بعد تسعين إلى مئة وخمسين
// يوماً، منقوصاً منه محتجزٌ وقسطُ استردادٍ للدفعة المقدمة. فالفجوة النقدية
// التي تقتله ليست خسارة — هي فارق توقيت. وهذا الملف يحسبها بالريال وبالشهر.
//
// ولا نموذج مالي هنا يُقدَّر بالحدس: كل رقم مشتقّ من بنود عقده هو، وثمانيةُ
// مدخلاتٍ يقرؤها من الورقة التي بيده. ولذلك تُصدَّق — ولذلك تُباع.
//
// ★ لا علاقة لهذا الملف بـ matchEngine ولا بمسار التمويل. وحدة حساب مستقلة.

export interface ContractInputs {
  value: number;              // قيمة العقد بالريال
  months: number;             // مدة التنفيذ بالأشهر
  advancePct: number;         // الدفعة المقدمة كنسبة من القيمة (0–1)
  retentionPct: number;       // المحتجز من كل مستخلص (0–1)
  costPct: number;            // التكلفة المباشرة كنسبة من القيمة (0–1)
  collectDelay: number;       // شهور من تقديم المستخلص إلى صرفه
  advanceRecoverPct: number;  // ما يُستردّ من الدفعة عند كل مستخلص (0–1)
  perfBondPct: number;        // ضمان حسن الأداء (0–1)

  // اختيارية — تزيد الوثيقة دقةً ولا يتوقف الحساب عليها
  bidBondPct?: number;        // ضمان العطاء، لمن لم تُرسَ عليه بعد
  cashCoverPct?: number;      // الغطاء النقدي الذي تطلبه الجهة مقابل الضمان
  awarderName?: string;       // المُسند إليه — من يدفع
  awarderKind?: AwarderKind;  // جودته الائتمانية
  penaltyPct?: number;        // غرامة التأخير اليومية أو الإجمالية كما في العقد
  awarded?: boolean;          // هل رسا العقد فعلاً أم ما زال منافسة
}

export type AwarderKind = 'gov' | 'semi' | 'large' | 'private';

export interface MonthFlow {
  m: number;
  inflow: number;
  outflow: number;
  net: number;
  cum: number;
  label: string;   // ما الذي يحدث في هذا الشهر، بلغة صاحب العقد
}

export interface BondPack {
  bid: number;        // ضمان العطاء
  advance: number;    // ضمان الدفعة المقدمة — بكامل قيمة الدفعة عادةً
  perf: number;       // ضمان حسن الأداء
  total: number;
  cashCover: number;  // النقد المطلوب حجزه مقابلها
}

export interface ContractPack {
  rows: MonthFlow[];
  worst: MonthFlow | null;   // أعمق نقطة نقدية — الرقم الذي هو حاجته الحقيقية
  gap: number;               // قيمة الفجوة موجبةً
  gapPct: number;            // من قيمة العقد
  advance: number;
  totalCost: number;
  profit: number;
  marginPct: number;
  horizon: number;
  bonds: BondPack;
  fundsMoreThanEarns: boolean;  // يموّل أكثر مما سيربح — أخطر جملة في الوثيقة
  retentionAmount: number;
  retentionMonth: number;
}

export interface ContractScenario {
  name: string;
  gap: number;
  month: number;
  pctOfValue: number;
  delta: number;          // فرق الفجوة عن الحالة الفعلية
  exceedsProfit: boolean; // يحتاج نقداً أكثر مما سيربحه من العقد كلّه
}

const clamp01 = (v: number): number => (Number.isFinite(v) && v > 0 ? Math.min(v, 1) : 0);
const num = (v: number, min: number): number => (Number.isFinite(v) && v > min ? v : min);

// التكلفة وحدها لا تُسقَف عند مئة بالمئة. وعقدٌ تكلفته أعلى من قيمته حالٌ
// قائمة — يفوز بها من سعّر بالتقدير — وهي أهمّ ما تكشفه هذه الخدمة أصلاً.
// ولو قُصّت إلى ١٠٠٪ لخرج الخاسر متعادلاً وسكتنا عن الخبر الوحيد المهم.
const clampCost = (v: number): number => (Number.isFinite(v) && v > 0 ? Math.min(v, 3) : 0);

/** ملء الفراغات بقيَم سوقية معلنة — لا لتخمين حال العميل بل لئلا ينكسر الحساب */
export function normalizeContract(i: Partial<ContractInputs>): ContractInputs {
  // مدة التحصيل صفرٌ حالٌ قائمة — سدادٌ فوري عند المستخلص. ولو كُتبت
  // `|| 3` لانقلب الصفر ثلاثة أشهر وصار العقد الأنظف أسوأ ملفٍ في الجدول.
  const cd = Number(i.collectDelay);
  const collectDelay = Number.isFinite(cd) && cd >= 0 ? Math.round(cd) : 3;
  return {
    value: num(Number(i.value), 0),
    months: Math.round(num(Number(i.months), 0)) || 12,
    advancePct: clamp01(Number(i.advancePct)),
    retentionPct: clamp01(Number(i.retentionPct)),
    costPct: clampCost(Number(i.costPct)) || 0.8,
    collectDelay,
    advanceRecoverPct: clamp01(Number(i.advanceRecoverPct)),
    perfBondPct: clamp01(Number(i.perfBondPct)),
    bidBondPct: clamp01(Number(i.bidBondPct)),
    cashCoverPct: clamp01(Number(i.cashCoverPct)),
    awarderName: typeof i.awarderName === 'string' ? i.awarderName : '',
    awarderKind: i.awarderKind,
    penaltyPct: clamp01(Number(i.penaltyPct)),
    awarded: i.awarded !== false,
  };
}

export function computeContract(raw: Partial<ContractInputs>): ContractPack {
  const i = normalizeContract(raw);

  const advance = i.value * i.advancePct;
  const perMonthWork = i.months > 0 ? i.value / i.months : 0;
  const perMonthCost = i.months > 0 ? (i.value * i.costPct) / i.months : 0;

  // الأفق: التنفيذ + مدة التحصيل + شهران للإفراج عن المحتجز وشهر هامش
  const horizon = i.months + i.collectDelay + 3;
  const retentionMonth = i.months + i.collectDelay + 2;
  const retentionAmount = i.value * i.retentionPct;

  const rows: MonthFlow[] = [];
  let cum = 0;
  let worst: MonthFlow | null = null;

  for (let m = 1; m <= horizon; m++) {
    let inflow = 0;
    let outflow = 0;
    const marks: string[] = [];

    // الدفعة المقدمة تصل في الشهر الأول — وهي لا تصل قبل إصدار ضمانها
    if (m === 1 && advance > 0) { inflow += advance; marks.push('الدفعة المقدمة'); }

    // التكاليف تُصرف أثناء التنفيذ وحده
    if (m <= i.months) { outflow += perMonthCost; marks.push('تنفيذ'); }

    // مستخلص شهر (m − مدة التحصيل) يُصرف الآن، منقوصاً منه المحتجز واسترداد الدفعة
    const workMonth = m - i.collectDelay;
    if (workMonth >= 1 && workMonth <= i.months) {
      const gross = perMonthWork;
      const net = gross - gross * i.retentionPct - gross * i.advanceRecoverPct;
      inflow += net;
      marks.push('مستخلص شهر ' + workMonth);
    }

    if (m === retentionMonth && retentionAmount > 0) { inflow += retentionAmount; marks.push('الإفراج عن المحتجز'); }

    const net = inflow - outflow;
    cum += net;
    const row: MonthFlow = { m, inflow, outflow, net, cum, label: marks.join(' · ') || 'بلا حركة' };
    if (worst === null || cum < worst.cum) worst = row;
    rows.push(row);
  }

  const totalCost = i.value * i.costPct;
  const profit = i.value - totalCost;
  const gap = worst !== null && worst.cum < 0 ? Math.abs(worst.cum) : 0;

  const bidBond = i.value * (i.bidBondPct || 0);
  const perfBond = i.value * i.perfBondPct;
  const bondsTotal = bidBond + advance + perfBond;

  return {
    rows,
    worst,
    gap,
    gapPct: i.value > 0 ? gap / i.value : 0,
    advance,
    totalCost,
    profit,
    marginPct: i.value > 0 ? profit / i.value : 0,
    horizon,
    retentionAmount,
    retentionMonth,
    bonds: {
      bid: bidBond,
      advance,                       // ضمان الدفعة يُصدَر بكامل قيمتها
      perf: perfBond,
      total: bondsTotal,
      cashCover: bondsTotal * (i.cashCoverPct || 0),
    },
    // الجملة التي تبيع الخدمة وحدها: أن يحتاج نقداً أكثر مما سيربح
    fundsMoreThanEarns: gap > profit && profit > 0,
  };
}

/**
 * نفس العقد، شروط تعاقدية أخرى.
 *
 * وهذا أهم ما في الخدمة: العقد نفسه — القيمة والمدة والتكلفة — تتضاعف
 * حاجته النقدية أربع مرات بتغيّر بندين لا ينتبه لهما أحد وقت التوقيع.
 * ومن لم يوقّع بعد يستطيع تغييرهما؛ ومن وقّع يعرف على الأقل حجم ما التزم به.
 */
export function contractScenarios(raw: Partial<ContractInputs>): ContractScenario[] {
  const base = normalizeContract(raw);
  const actual = computeContract(base);

  const variants: { name: string; patch: Partial<ContractInputs> }[] = [
    { name: 'شروط عقدك كما هي', patch: {} },
    { name: 'لو أُلغيت الدفعة المقدمة', patch: { advancePct: 0, advanceRecoverPct: 0 } },
    { name: 'لو تأخّر صرف المستخلص شهرين إضافيين', patch: { collectDelay: base.collectDelay + 2 } },
    { name: 'بلا دفعة مقدمة ومع تأخّر شهرين', patch: { advancePct: 0, advanceRecoverPct: 0, collectDelay: base.collectDelay + 2 } },
    { name: 'لو رُفع المحتجز إلى ١٠٪', patch: { retentionPct: 0.10 } },
    { name: 'لو زادت تكلفتك ٥٪ عمّا قدّرت', patch: { costPct: Math.min(base.costPct + 0.05, 0.99) } },
  ];

  const out: ContractScenario[] = [];
  for (let k = 0; k < variants.length; k++) {
    const v = variants[k];
    const p = computeContract({ ...base, ...v.patch });
    const delta = p.gap - actual.gap;
    // صفٌّ لا يتغيّر فيه شيء يُضعف الجدول ولا يُقوّيه: المحتجز مثلاً لا يمسّ
    // أعمق نقطة إن كانت قبل أول تحصيل. فيُحذف الصفّ ولا يُترك رقماً مكرَّراً
    // يظنّه القارئ خطأً في الحساب. والحالة الفعلية تبقى دائماً.
    if (k > 0 && Math.round(delta) === 0) continue;
    out.push({
      name: v.name,
      gap: p.gap,
      month: p.worst !== null ? p.worst.m : 0,
      pctOfValue: p.gapPct,
      delta,
      exceedsProfit: p.gap > actual.profit && actual.profit > 0,
    });
  }
  return out;
}

// ── هيكل التمويل: أي أداة في أي لحظة ─────────────────────────────────
//
// العقد لا يُموَّل بمنتج واحد، وهذا ما يجهله من يطرق باباً واحداً فيُردّ
// فيظن أن التمويل مغلق عليه. كل لحظة من لحظات العقد لها أداتها واسمها.

export interface FundingLeg {
  moment: string;      // متى
  need: string;        // ما الذي يلزمه فيها
  instrument: string;  // اسم الأداة كما تعرفها الجهة
  amount: number | null;
  family: string;      // عائلة المنتج — بها تُطابَق الجهات
  note: string;
}

export function fundingStructure(raw: Partial<ContractInputs>, p: ContractPack): FundingLeg[] {
  const i = normalizeContract(raw);
  const legs: FundingLeg[] = [];

  if (!i.awarded || (i.bidBondPct || 0) > 0) {
    legs.push({
      moment: 'قبل التقديم',
      need: 'ضمان ابتدائي (عطاء) لا يُقبل عرضك بدونه',
      instrument: 'ضمان عطاء',
      amount: p.bonds.bid > 0 ? p.bonds.bid : null,
      family: 'ضمانات وكفالات',
      note: 'يُصدَر بغطاء نقدي جزئي لا بكامل قيمته — وهذا ما لا يعرفه أكثر من يُستبعد في هذه اللحظة.',
    });
  }

  if (p.advance > 0) {
    legs.push({
      moment: 'بعد الترسية · خلال أيام',
      need: 'ضمان الدفعة المقدمة — لا تُصرف لك الدفعة قبله',
      instrument: 'ضمان دفعة مقدمة',
      amount: p.bonds.advance,
      family: 'ضمانات وكفالات',
      note: 'يُصدَر بكامل قيمة الدفعة، ويتناقص مع استردادها من مستخلصاتك.',
    });
  }

  if (p.bonds.perf > 0) {
    legs.push({
      moment: 'بعد الترسية · خلال أيام',
      need: 'ضمان حسن الأداء، وإلا سقطت الترسية عنك',
      instrument: 'ضمان حسن أداء',
      amount: p.bonds.perf,
      family: 'ضمانات وكفالات',
      note: 'أضيق اللحظات وقتاً: تُمنح أياماً معدودة، ولا تكفي لفتح حساب ودراسة ملف من الصفر.',
    });
  }

  if (p.gap > 0) {
    legs.push({
      moment: 'أثناء التنفيذ · الشهر ' + (p.worst !== null ? p.worst.m : '—'),
      need: 'رأس المال العامل حتى يُصرف أول مستخلص',
      instrument: 'رأس مال عامل · أو تسييل مستخلصات',
      amount: p.gap,
      family: 'رأس مال عامل · تمويل ذمم وفواتير',
      note: 'وتسييل المستخلص أقرب للقبول من قرضٍ عام، لأن سداده من مالٍ مستحقٍّ لك على جهة معروفة.',
    });
  }

  legs.push({
    moment: 'أثناء التنفيذ',
    need: 'شراء المواد من مورّديك بلا استنزاف نقدك',
    instrument: 'اعتماد مستندي · أو تمويل مورّدين',
    amount: null,
    family: 'اعتمادات مستندية',
    note: 'يؤجّل دفعك للمورّد إلى ما بعد تحصيلك، فيضيق فارق التوقيت الذي يصنع الفجوة أصلاً.',
  });

  if (p.retentionAmount > 0) {
    legs.push({
      moment: 'بعد التسليم · الشهر ' + p.retentionMonth,
      need: 'ربحك محتجَزٌ سنة ضمان ولا تستطيع الدخول في العقد التالي',
      instrument: 'ضمان بدل محتجزات',
      amount: p.retentionAmount,
      family: 'ضمانات وكفالات',
      note: 'يُستبدل بالمحتجز فيُفرج عن نقدك مبكراً — وهو أكثر ما يُهمَل من أدوات العقد.',
    });
  }

  return legs;
}

/** جودة المُسند إليه — من يدفعك ومتى يدفع، وهو أول ما تسأل عنه لجنة الائتمان */
export function awarderNote(kind: AwarderKind | undefined): string {
  if (kind === 'gov') return 'جهة حكومية على منصة اعتماد: السداد شبه مضمون، والتأخير وارد لا الامتناع. وهذا أقوى ما في ملفك — لأن الجهة الممولة تُقرض في الحقيقة قوةَ من يدفعك لا قوتك أنت.';
  if (kind === 'semi') return 'جهة شبه حكومية أو شركة كبرى مملوكة للدولة: تصنيفها الائتماني يُقرأ لصالحك، ودورة اعتمادها أطول من الحكومي أحياناً — فتُحسب في التدفق لا في الأمل.';
  if (kind === 'large') return 'شركة خاصة كبيرة: يُطلب تصنيفها وسجل سدادها معك، وتُقرأ مدة سدادها الفعلية لا المكتوبة في العقد.';
  if (kind === 'private') return 'مُسنِدٌ من القطاع الخاص: هنا يضعف الملف عادةً، ويُعوَّض بتأمين ائتمان تجاري أو بشرط تنازلٍ عن المستحق لصالح الجهة الممولة.';
  return 'لم يُحدَّد المُسند إليه بعد — وهو أول سؤال تسأله لجنة الائتمان، لأنها تُقرض قوة من يدفعك لا قوتك.';
}

// ── عرضٌ للأرقام ──────────────────────────────────────────────────────

export const money = (v: number | null | undefined): string =>
  v === null || v === undefined || !Number.isFinite(v) ? '—' : Math.round(v).toLocaleString('en-US');

// السالب في مستندٍ يُقرأ من اليمين يخرج «96,000-» فيلتبس على القارئ موضع
// الإشارة. والعرف المحاسبي يحلّها بالقوسين، وهو ما تقرؤه لجنة الائتمان.
export const signed = (v: number | null | undefined): string =>
  v === null || v === undefined || !Number.isFinite(v) ? '—' : (v < 0 ? '(' + money(-v) + ')' : money(v));

export const pct = (v: number, digits = 1): string =>
  !Number.isFinite(v) ? '—' : (v * 100).toFixed(digits) + '٪';

/** «كم ضعفاً» — لا بالمئة. فـ٤٠٠٪ ليست «٤٠٠ ضعف» بل أربعة أضعاف. */
export const times = (v: number): string =>
  !Number.isFinite(v) || v <= 0 ? '—' : (v >= 10 ? Math.round(v).toString() : v.toFixed(1)) + (v < 2 ? ' ضعف' : v <= 10 ? ' أضعاف' : ' ضعفاً');

// العدد العربي يُطابق معدوده: واحد ثم مثنّى ثم جمعُ قلّة من ثلاثة إلى عشرة
// ثم تمييزٌ مفرد منصوب. وخطأٌ في السطر الأول يُسقط ثقة القارئ قبل أن يصل
// إلى الرقم — و«٣ شهراً» و«٣ جهة» يقرؤهما صاحب العقد ركاكةَ آلة.
export function arCount(n: number, one: string, two: string, few: string, many: string): string {
  const k = Math.abs(Math.round(n));
  if (k === 1) return one;
  if (k === 2) return two;
  if (k >= 3 && k <= 10) return k + ' ' + few;
  return k + ' ' + many;
}

export const arMonths = (n: number): string => arCount(n, 'شهر واحد', 'شهران', 'أشهر', 'شهراً');
export const arEntities = (n: number): string => arCount(n, 'جهة واحدة', 'جهتان', 'جهات', 'جهة');

/** جدول التدفق الشهري — يُختصر إلى ما يُقرأ: البداية وأعمق نقطة والنهاية */
export function renderContractFlow(p: ContractPack): string {
  if (p.rows.length === 0) return '';
  const worstM = p.worst !== null ? p.worst.m : -1;
  const keep = new Set<number>();
  for (const r of p.rows) {
    if (r.m <= 6) keep.add(r.m);
    if (r.m === worstM || r.m === worstM + 1) keep.add(r.m);
    if (r.m === p.retentionMonth) keep.add(r.m);
    if (r.m === p.rows.length) keep.add(r.m);
  }
  const shown = p.rows.filter((r) => keep.has(r.m));

  let prev = 0;
  const body = shown.map((r) => {
    const jumped = r.m - prev > 1;
    prev = r.m;
    const isWorst = r.m === worstM;
    return (jumped ? '<tr class="skip"><td colspan="5">…</td></tr>' : '')
      + '<tr' + (isWorst ? ' class="worst"' : '') + '>'
      + '<td><b>' + r.m + '</b> <span class="lbl">' + r.label + '</span></td>'
      + '<td class="n">' + money(r.inflow) + '</td>'
      + '<td class="n">' + money(r.outflow) + '</td>'
      + '<td class="n">' + signed(r.net) + '</td>'
      + '<td class="n">' + signed(r.cum) + '</td>'
      + '</tr>';
  }).join('');

  return '<table><tr><th>الشهر</th><th class="l">داخل</th><th class="l">خارج</th><th class="l">صافي الشهر</th><th class="l">التراكمي</th></tr>' + body + '</table>';
}

export function renderScenarios(list: ContractScenario[]): string {
  const body = list.map((s, idx) => '<tr' + (idx === 0 ? ' class="worst"' : '') + '>'
    + '<td>' + s.name + '</td>'
    + '<td class="n">' + money(s.gap) + '</td>'
    + '<td class="n">' + (s.month > 0 ? 'الشهر ' + s.month : '—') + '</td>'
    + '<td class="n">' + pct(s.pctOfValue) + '</td>'
    + '</tr>').join('');
  return '<table><tr><th>الحالة التعاقدية</th><th class="l">الفجوة النقدية</th><th class="l">متى</th><th class="l">من قيمة العقد</th></tr>' + body + '</table>';
}
