import { buildPdfHtml } from '@/lib/pdfTemplate';
import { type Award, type Settings } from '@/lib/awards';

// جدول فجوة السيولة لترسية — آلية الحساب والعرض وحدها.
//
// ★ المعايير (هامش القطاع · المدة · طريقة الصرف · دورة الصرف الحكومية) والنصوص
//   (العنوان · «تقديري…» · سطر الختام) في `award_settings` لا هنا — المستودع عام.
// ★ كل حقلٍ لم يُعطَ يُملأ بمعيار فئة الترسية، ويُعلَّم في الجدول «تقديري».
//
// النموذج: العقد يُنفَّذ على `months` شهراً، وكلفته الشهرية (الصرف) ثابتة =
// القيمة × (١ − الهامش) ÷ المدة ما لم تُعطَ. وإيراد كل شهرٍ = القيمة ÷ المدة،
// ويُحصَّل بعد `delay_days` من نهاية الشهر (صرف شهري)، أو بعدها وبعد شهرٍ لإعداد
// المستخلص واعتماده (مستخلصات). والفجوة = الرصيد التراكمي (المحصَّل − المصروف)،
// وأعمق نقطةٍ فيها أدنى رصيد وتاريخه.

export type Method = 'monthly' | 'claims';
export type GapInputs = {
  contract_value?: number | null;
  months?: number | null;
  start_date?: string | null;
  method?: Method | null;
  delay_days?: number | null;
  monthly_spend?: number | null;
};
type Bench = { margin: number; months: number; method: Method; delay_days: number };
export type GapRow = { ym: string; month: string; spend: number; collect: number; cum: number };
export type StartBasis = 'given' | 'bids_opened' | 'today_minus_45';
export type GapResult = {
  inputs: Required<{ [K in keyof GapInputs]: NonNullable<GapInputs[K]> }>;
  estimated: (keyof GapInputs)[];
  rows: GapRow[];
  deepest: { amount: number; month: string };
  shift: number;
  start_basis: StartBasis;
};

const n = (v: unknown): number | null => {
  const x = Number(String(v ?? '').replace(/[,٬\s]/g, ''));
  return String(v ?? '').trim() !== '' && Number.isFinite(x) && x > 0 ? x : null;
};

function bench(s: Settings, category: string): Bench {
  let all: Record<string, Partial<Bench>> = {};
  try { all = JSON.parse(String(s.gap_benchmarks || '{}')); } catch { throw new Error('gap_benchmarks ليست JSON صالحاً'); }
  const b = all[category] || all.other;
  if (!b || !(Number(b.months) > 0) || !(Number(b.delay_days) >= 0) || !(Number(b.margin) >= 0 && Number(b.margin) < 1)) {
    throw new Error('لا معيار صالح للفئة «' + category + '» في gap_benchmarks');
  }
  return { margin: Number(b.margin), months: Math.round(Number(b.months)), method: b.method === 'claims' ? 'claims' : 'monthly', delay_days: Number(b.delay_days) };
}

const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const ymOf = (d: Date) => d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0');
const ymLabel = (ym: string) => MONTHS_AR[Number(ym.slice(5, 7)) - 1] + ' ' + ym.slice(0, 4);
const addDays = (iso: string, days: number) => new Date(Date.parse(iso + 'T00:00:00Z') + days * 86400_000).toISOString().slice(0, 10);
/** اليوم بتوقيت الرياض — YYYY-MM-DD */
export const todayRiyadh = () => new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10);

/**
 * بدء التنفيذ إن لم يُعطَ: فتح العروض + ٤٥ يوماً، وإلا اليوم − ٤٥ يوماً.
 * ولا يكون اليوم أبداً — التقدير يقول «بدأ التنفيذ» أو «يبدأ في موعده»، لا «يبدأ الآن».
 */
function startFor(raw: string, bidsOpenedAt: string | null, today: string): { start: string; basis: StartBasis } {
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return { start: raw, basis: 'given' };
  if (bidsOpenedAt && /^\d{4}-\d{2}-\d{2}/.test(bidsOpenedAt)) {
    const st = addDays(bidsOpenedAt.slice(0, 10), 45);
    if (st !== today) return { start: st, basis: 'bids_opened' };
  }
  return { start: addDays(today, -45), basis: 'today_minus_45' };
}

export function computeGap(a: Pick<Award, 'category' | 'contract_value' | 'bids_opened_at'>, raw: GapInputs, s: Settings, today = todayRiyadh()): GapResult {
  const b = bench(s, a.category);
  const estimated: (keyof GapInputs)[] = [];
  const pick = <T,>(k: keyof GapInputs, given: T | null, fallback: T): T => { if (given === null || given === undefined) { estimated.push(k); return fallback; } return given; };

  const value = n(raw.contract_value) ?? n(a.contract_value);
  if (!value) throw new Error('قيمة العقد مطلوبة — لا تُقدَّر');
  const months = Math.min(60, Math.round(pick('months', n(raw.months), b.months)));
  const st = startFor(String(raw.start_date || '').trim(), a.bids_opened_at || null, today);
  if (st.basis !== 'given') estimated.push('start_date');
  const method = pick<Method>('method', raw.method === 'claims' || raw.method === 'monthly' ? raw.method : null, b.method);
  const delay = pick('delay_days', raw.delay_days === 0 ? 0 : n(raw.delay_days), b.delay_days);
  const spend = pick('monthly_spend', n(raw.monthly_spend), Math.round((value * (1 - b.margin)) / months));

  const revenue = value / months;
  // الشهر الذي يُحصَّل فيه عمل الشهر i: بعد دورة الصرف، وشهرٍ للمستخلص إن كان الصرف بالمستخلصات
  const shift = Math.ceil(delay / 30) + (method === 'claims' ? 1 : 0);
  const d0 = new Date(st.start + 'T00:00:00Z');
  const rows: GapRow[] = [];
  let cum = 0;
  for (let i = 0; i < months + shift; i++) {
    const out = i < months ? spend : 0;
    const inn = i - shift >= 0 && i - shift < months ? revenue : 0;
    cum += inn - out;
    const ym = ymOf(new Date(Date.UTC(d0.getUTCFullYear(), d0.getUTCMonth() + i, 1)));
    rows.push({ ym, month: ymLabel(ym), spend: Math.round(out), collect: Math.round(inn), cum: Math.round(cum) });
  }
  return {
    inputs: { contract_value: value, months, start_date: st.start, method, delay_days: delay, monthly_spend: spend },
    estimated, rows, deepest: deepestOf(rows), shift, start_basis: st.basis,
  };
}

function deepestOf(rows: GapRow[]): { amount: number; month: string } {
  let d = { amount: 0, month: rows[0]?.month || '' };
  for (const r of rows) if (r.cum < d.amount) d = { amount: r.cum, month: r.month };
  return d;
}

// ═══ المنشأة بعقودها: استشارة واحدة وجدولٌ واحد ═══

type ContractInfo = Pick<Award, 'id' | 'company_name' | 'tender_title' | 'buyer_entity' | 'category'>;
export type GroupGap = {
  company: string;
  contracts: { award: ContractInfo; g: GapResult }[];
  rows: GapRow[];
  deepest: { amount: number; month: string };
  /** أعمق نقطةٍ من الشهر الجاري فصاعداً — ما يُخطَّط له */
  ahead: { amount: number; month: string } | null;
  today: string;
  executing: boolean;
};

/** يجمع جداول عقود المنشأة شهراً بشهر بالتقويم، ويعيد حساب الرصيد وأعمق نقطة */
export function combineGaps(parts: { award: ContractInfo; g: GapResult }[], today = todayRiyadh()): GroupGap {
  const by = new Map<string, { spend: number; collect: number }>();
  for (const { g } of parts) for (const r of g.rows) {
    const m = by.get(r.ym) || { spend: 0, collect: 0 };
    m.spend += r.spend; m.collect += r.collect; by.set(r.ym, m);
  }
  let cum = 0;
  const rows: GapRow[] = [...by.keys()].sort().map((ym) => {
    const m = by.get(ym) as { spend: number; collect: number };
    cum += m.collect - m.spend;
    return { ym, month: ymLabel(ym), spend: m.spend, collect: m.collect, cum };
  });
  const nowYm = today.slice(0, 7);
  const future = rows.filter((r) => r.ym >= nowYm);
  const ahead = future.length && future.some((r) => r.cum < 0) ? deepestOf(future) : null;
  return {
    company: String(parts[0]?.award.company_name || ''),
    contracts: parts, rows, deepest: deepestOf(rows), ahead, today,
    executing: parts.some(({ g }) => g.inputs.start_date <= today),
  };
}

const escHtml = (t: string) => t.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string));
const sar = (x: number) => Math.round(x).toLocaleString('en-US');
// السالب بين قوسين (عُرف المحاسبة) — لا يقلبه اتجاه الصفحة
const signed = (x: number) => (x < 0 ? '(' + sar(-x) + ')' : sar(x));
const dayLabel = (iso: string) => { const d = new Date(iso + 'T00:00:00Z'); return d.getUTCDate() + ' ' + MONTHS_AR[d.getUTCMonth()] + ' ' + d.getUTCFullYear(); };

const CATEGORY_AR: Record<string, string> = {
  construction: 'الإنشاءات والمقاولات', om_services: 'التشغيل والصيانة', supply_it: 'التوريد والتقنية',
  consulting: 'الاستشارات', transport: 'النقل', other: 'قطاعٍ عام',
};
const FIELD_AR: Record<keyof GapInputs, string> = {
  contract_value: 'قيمة العقد', months: 'المدة', start_date: 'بدء التنفيذ',
  method: 'طريقة الصرف', delay_days: 'مدة الصرف', monthly_spend: 'الصرف الشهري',
};
export const GAP_TABLE_MARK = '[[GAP_TABLE]]';
const AR_DIGITS = (x: number) => String(x).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);
/** عدد العقود بصيغته: «عقد» · «عقدين» · «٣ عقود» … «١٠ عقود» · «١١ عقداً» */
export const contractsWord = (k: number) => (k === 1 ? 'عقد' : k === 2 ? 'عقدين' : k <= 10 ? AR_DIGITS(k) + ' عقود' : AR_DIGITS(k) + ' عقداً');
const q = (t: string | null) => '«' + (String(t || '').trim() || 'العقد') + '»';

/** عنوان الاستشارة المختصرة — بنصّ المالك، ولعقدين فأكثر: «عقدا …» / «عقود …» */
export function consultTitle(company: string, titles: (string | null)[]): string {
  const t = titles.length === 1 ? 'عقد ' + q(titles[0])
    : titles.length === 2 ? 'عقدا ' + q(titles[0]) + ' و' + q(titles[1])
    : 'عقود ' + titles.map(q).join(' و');
  return 'استشارة د. عبدالحكيم المرضي الخاصة لـ' + company + ' — ' + t;
}
export const groupTitle = (gg: GroupGap) => consultTitle(gg.company, gg.contracts.map((c) => c.award.tender_title));

/** أداة السيولة باسمها الصحيح: عقود الصرف الشهري «فواتير أو مستحقات» لا «مستخلصات» */
const toolFor = (m: Method) => (m === 'claims' ? 'تمويل المستخلصات' : 'تمويل الفواتير أو المستحقات');

/**
 * ما يُرفض في نصّ المولّد — نبرةٌ لمنشأةٍ لا تعرفنا، ولا يقينٌ عن الجهة.
 * يُفحص النصّ به ويُعاد التوليد مرةً إن خالف (`@/app/api/admin/awards/gap`).
 */
export function consultViolations(text: string, gg: GroupGap): string[] {
  const bad: [RegExp, string][] = [
    [/بلا تجميل|دون تجميل/, '«بلا تجميل»'],
    [/أقوى منكم|أصغر منكم|رأيت (?:مؤسسات|شركات)|مؤسسات أخرى|شركات أخرى/, 'مقارنة بمنشآت أخرى'],
    [/اسمعوا مني|اسمعني/, '«اسمعوا مني»'],
    [/لا تتعثر|لن تتعثر|مؤكَّ?د|مضمون|مضمونة/, 'يقين عن الجهة («لا تتعثر» / «مؤكد» / «مضمون»)'],
    [/كفال/, 'ذكر الكفالة'],
    [/ثقتكم|تعاملكم معنا|شكراً لاختياركم/, 'شكرٌ على ثقةٍ أو تعامل — المنشأة لا تعرفنا بعد'],
    [/سطر الختام|يُضاف هنا/, 'إشارة إلى موضعٍ أو سطرٍ يُضاف'],
  ];
  if (gg.contracts.every((c) => c.g.inputs.method === 'monthly')) bad.push([/مستخلص/, '«المستخلصات» في عقود صرفها شهري']);
  if (gg.executing) bad.push([/قبل بدء التنفيذ|قبل أن تبدأوا التنفيذ|قبل التنفيذ/, '«قبل بدء التنفيذ» والتنفيذ قد بدأ']);
  return bad.filter(([re]) => re.test(text)).map(([, why]) => why);
}

/**
 * نصّ الطلب إلى مولّد الاستشارات (`@/lib/consultationGen`) — بهيكل استشارة
 * التقييم. الأرقام كلها من الحساب لا من المولّد: هو يقرؤها ويشرحها، والجدول
 * يُحقن مكان `[[GAP_TABLE]]`، وسطر الختام من الإعدادات يُلحق بعده.
 */
export function gapConsultPrompt(gg: GroupGap, s: Settings): string {
  const est = String(s.gap_estimate_note || 'تقديري').trim();
  const multi = gg.contracts.length > 1;
  const contractLines = gg.contracts.map(({ award: a, g }, i) => {
    const mark = (k: keyof GapInputs) => (g.estimated.includes(k) ? ' — «' + est + '» (من معيار القطاع)' : ' — من أرقامهم');
    const startNote = g.start_basis === 'bids_opened' ? ' (فتح العروض + ٤٥ يوماً)' : g.start_basis === 'today_minus_45' ? ' (تقدير: بدأ التنفيذ قبل نحو ٤٥ يوماً)' : '';
    return (multi ? '\nالعقد ' + (i + 1) + ':\n' : '')
      + '- العقد: ' + (String(a.tender_title || '').trim() || 'غير مسمّى') + '\n'
      + '- الجهة المالكة للعقد (المدين): ' + (String(a.buyer_entity || '').trim() || 'جهة حكومية') + ' — جهة حكومية\n'
      + '- القطاع: ' + (CATEGORY_AR[a.category] || 'غير محدد') + '\n'
      + '- قيمة العقد: ' + sar(g.inputs.contract_value) + ' ريال' + mark('contract_value') + '\n'
      + '- المدة: ' + g.inputs.months + ' شهراً' + mark('months') + '\n'
      + '- بدء التنفيذ: ' + dayLabel(g.inputs.start_date) + startNote + mark('start_date') + '\n'
      + '- طريقة الصرف: ' + (g.inputs.method === 'claims' ? 'مستخلصات' : 'شهري (فواتير شهرية)') + mark('method') + '\n'
      + '- مدة الصرف بعد الاستحقاق: ' + g.inputs.delay_days + ' يوماً' + mark('delay_days') + '\n'
      + '- الصرف الشهري على التنفيذ: ' + sar(g.inputs.monthly_spend) + ' ريال' + mark('monthly_spend') + '\n'
      + '- الإيراد الشهري المستحق: ' + sar(g.inputs.contract_value / g.inputs.months) + ' ريال\n'
      + '- أول تحصيل بعد: ' + g.shift + ' أشهر من بدء التنفيذ\n'
      + '- أداة السيولة المناسبة له باسمها: ' + toolFor(g.inputs.method) + '\n';
  }).join('');
  const totalSpend = gg.rows.reduce((x, r) => x + r.spend, 0);
  const totalIn = gg.rows.reduce((x, r) => x + r.collect, 0);
  const firstPositive = gg.rows.find((r, i) => i > 0 && r.cum >= 0 && gg.rows[i - 1].cum < 0)?.month || 'بعد نهاية العقود';
  const negMonths = gg.rows.filter((r) => r.cum < 0).length;
  const estFields = [...new Set(gg.contracts.flatMap((c) => c.g.estimated.map((k) => FIELD_AR[k])))];
  const tools = [...new Set(gg.contracts.map((c) => toolFor(c.g.inputs.method)))];
  const title = groupTitle(gg);
  return 'أنت تكتب نيابة عن د. عبدالحكيم المرضي — مستشار مالي سعودي، دكتوراه إدارة أعمال، عضوية البورد الأمريكي، 15 سنة خبرة في القطاع المالي. أسلوبه في هذه الاستشارة: واضح، محترم، عملي، بصيغة المستشار الذي يشرح ويقترح — لا المحاسِب الذي يحاسِب. والمنشأة لا تعرفنا بعد، فالاحترام أولاً.\n\n'
    + 'هذه "استشارة مختصرة" (700-1000 كلمة) موضوعها فجوة السيولة في تنفيذ ' + (multi ? 'عقود المنشأة مجتمعةً' : 'العقد') + ':\n'
    + '- المنشأة: ' + gg.company + '\n'
    + '- تاريخ اليوم: ' + dayLabel(gg.today) + '\n'
    + contractLines
    + (multi ? '\nالعقود مجتمعةً (الجدول واحد يجمعها شهراً بشهر):\n' : '\n')
    + '- أعمق نقطة في الفجوة: ' + sar(Math.abs(gg.deepest.amount)) + ' ريال في ' + gg.deepest.month + '\n'
    + (gg.ahead ? '- أعمق نقطة من الشهر الجاري فصاعداً: ' + sar(Math.abs(gg.ahead.amount)) + ' ريال في ' + gg.ahead.month + '\n' : '- الرصيد من الشهر الجاري فصاعداً لا يعود سالباً\n')
    + '- عدد الأشهر والرصيد سالب: ' + negMonths + ' · يعود الرصيد موجباً في: ' + firstPositive + '\n'
    + '- مجموع الصرف: ' + sar(totalSpend) + ' ريال · مجموع التحصيل: ' + sar(totalIn) + ' ريال\n'
    + (estFields.length ? '- الحقول التقديرية: ' + estFields.join('، ') + '\n' : '')
    + (gg.executing
      ? '- المنشأة بدأت التنفيذ (تقديراً): خاطبها كمن ينفّذ الآن. لا تكتب «قبل بدء التنفيذ»، والخطة تبدأ من الآن.\n'
      : '- التنفيذ لم يبدأ بعد، وموعده في المستقبل.\n')
    + '\nهيكل الاستشارة (Markdown) — بهذه العناوين حرفياً وبهذا الترتيب:\n'
    + '# ' + title + '\n'
    + '## أولاً: قراءتي ' + (multi ? 'لعقودكم' : 'لعقدكم') + ' — ' + (multi ? 'لكل عقدٍ ' : '') + 'القيمة والمدة وطريقة الصرف والصرف الشهري، وما تعنيه دورة الصرف. اكتب بجانب كل رقمٍ من معيار القطاع «(' + est + ')» حرفياً، ولا تكتبها بجانب ما هو من أرقامهم.\n'
    + '## ثانياً: جدول الفجوة شهراً بشهر — جملتان فقط تقدّمان الجدول' + (multi ? ' (وتذكران أنه يجمع العقود)' : '') + '، ثم سطرٌ وحده فيه ' + GAP_TABLE_MARK + ' حرفياً (يُستبدل بالجدول وتحته إطارٌ بأعمق نقطة وتاريخها). لا تكتب الجدول بنفسك، ولا جملةً بعده عن أعمق نقطة — الإطار يذكرها مرةً واحدة.\n'
    + '## ثالثاً: ما يعنيه هذا لكم — نقاط القوة، وأولها أن المدين جهة حكومية فمخاطر التعثر منخفضة والتأخير تأخير توقيت، ثم المخاطر بالأرقام أعلاه (حجم الفجوة، مدتها، أثر تأخر صرفٍ إضافي).\n'
    + '## رابعاً: خطة سدّ الفجوة — بعنوانين فرعيين: «أول ٣٠ يوماً» و«حتى ٩٠ يوماً»، بأدوات نقدية فقط: ' + tools.join(' · ') + '، ورأس مال عامل. كل بندٍ مرتبط بأرقام ' + (multi ? 'العقود' : 'هذا العقد') + '.\n'
    + '## خامساً: كلمة أخيرة — فقرة قصيرة واقعية ومحترمة. لا تختمها بعبارة عن سدّ الفجوة؛ سطر الختام يُضاف بعدها.\n\n'
    + 'قواعد صارمة:\n'
    + '- استعمل الأرقام أعلاه كما هي ولا تخترع رقماً آخر.\n'
    + '- المنشأة لم تتعامل معنا بعد: لا تشكرها على ثقةٍ أو تعامل، وابدأ بما يفيدها.\n'
    + '- لا تكتب أي إشارة إلى سطر الختام أو إلى ما يُضاف لاحقاً؛ انتهِ بآخر جملةٍ من «خامساً».\n'
    + '- أي موعدٍ تذكره في الخطة يقع بعد ' + dayLabel(gg.today) + ' — لا اليوم ولا قبله.\n'
    + '- لا مقارنة بمنشآت أخرى (لا «رأيت مؤسسات» ولا «أقوى منكم»)، ولا «بلا تجميل» ولا «اسمعوا مني».\n'
    + '- عن الجهة: لا «لا تتعثر» ولا «مؤكد» ولا «مضمون»؛ اكتب «مخاطر التعثر منخفضة، والتأخير تأخير توقيت».\n'
    + (gg.contracts.every((c) => c.g.inputs.method === 'monthly') ? '- العقود بصرفٍ شهري: الأداة «تمويل الفواتير أو المستحقات»، ولا تستعمل كلمة «المستخلصات» إطلاقاً.\n' : '- سمِّ الأداة لكل عقدٍ باسمها المعطى أعلاه.\n')
    + '- ممنوع ذكر اسم أي جهة تمويل أو بنك أو منصة أو برنامج، وأي سعر أو رسم أو نسبة ربح أو تكلفة تمويل أو أتعاب، والكفالة.\n'
    + '- كل جملة مخصصة لهذه المنشأة وأرقامها. أكمل حتى نهاية «خامساً».\n'
    + '- الهوية: الاستشارة باسم د. عبدالحكيم المرضي وفريقه عبر منصة مُرضي — ممنوع ذكر أو تلميح لأي ذكاء اصطناعي أو نموذج أو تقنية.';
}

/** كتلة الجدول التي تُحقن مكان العلامة — أسطرٌ تبدأ بوسم وتنتهي بسطر `</div>` (هكذا يمرّرها `buildPdfHtml`) */
function gapTableBlock(gg: GroupGap): string {
  const rows = gg.rows.map((r) => {
    const deep = r.cum === gg.deepest.amount && r.month === gg.deepest.month;
    return '<tr' + (deep ? ' class="gd"' : '') + '><td>' + r.month + '</td><td>' + (r.spend ? sar(r.spend) : '—') + '</td><td>' + (r.collect ? sar(r.collect) : '—') + '</td><td class="gc">' + signed(r.cum) + '</td></tr>';
  }).join('');
  const head = gg.contracts.length > 1 ? '<div class="gn">يجمع الجدول ' + contractsWord(gg.contracts.length) + ': ' + gg.contracts.map((c) => escHtml(q(c.award.tender_title))).join(' · ') + '</div>' : '';
  return [
    '<div class="gap">',
    head,
    '<table><tr><th>الشهر</th><th>الصرف على التنفيذ</th><th>التحصيل من الجهة</th><th>الرصيد التراكمي (السالب = فجوة)</th></tr>' + rows + '</table>',
    '<div class="gk">أعمق نقطة في الفجوة: <b>' + sar(Math.abs(gg.deepest.amount)) + ' ريال</b> في <b>' + gg.deepest.month + '</b></div>',
    '</div>',
  ].filter(Boolean).join('\n');
}

const inline = (t: string) => escHtml(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*(?!\s)([^*]+?)\*/g, '$1$2');

/**
 * نصّ المولّد (Markdown) إلى HTML — هنا لا في `buildPdfHtml`: ذاك يحذف علامات
 * العناوين ويبتلع الأسطر حول «---» فتلتصق الأقسام فقرةً واحدة. فيُسلَّم إليه
 * HTML جاهزاً في كتلةٍ واحدة آخرُ سطرها `</div>` فيمرّرها كما هي، بترويسته وهويته.
 */
function mdToHtml(md: string, table: string): string {
  const out: string[] = [];
  let list = false;
  // بعد الجدول: جملة «أعمق نقطة» تُحذف — الإطار تحت الجدول يذكرها مرةً واحدة
  let afterTable = false;
  const close = () => { if (list) { out.push('</ul>'); list = false; } };
  for (const raw of md.split('\n')) {
    const t = raw.trim();
    if (t === GAP_TABLE_MARK) { close(); out.push(table); afterTable = true; continue; }
    if (afterTable && t) {
      if (/^#/.test(t)) afterTable = false;
      else if (/أعمق\s+نقط/.test(t)) continue;   // «نقطة» و«نقطةٍ» بتشكيلها
      else afterTable = false;
    }
    if (!t || /^(-{3,}|\*{3,}|_{3,})$/.test(t)) { close(); continue; }
    const h = /^(#{1,4})\s+(.*)$/.exec(t);
    if (h) { close(); const n = h[1].length; out.push(n === 1 ? '<h1 class="ct">' + inline(h[2]) + '</h1>' : n === 2 ? '<h2 class="cs">' + inline(h[2]) + '</h2>' : '<h3 class="cu">' + inline(h[2]) + '</h3>'); continue; }
    const li = /^(?:[-•*]|\d+[.)])\s+(.*)$/.exec(t);
    if (li) { if (!list) { out.push('<ul class="cl">'); list = true; } out.push('<li>' + inline(li[1]) + '</li>'); continue; }
    close(); out.push('<p class="cp">' + inline(t) + '</p>');
  }
  close();
  return out.join('\n');
}

/** الاستشارة كاملةً HTML بقالب `buildPdfHtml`: نصّ المولّد + الجدول مكان العلامة + سطر الختام */
export function consultHtml(gg: GroupGap, s: Settings, content: string): string {
  const closing = String(s.gap_closing_line || '').trim();
  // سطرٌ يشير إلى «سطر الختام» أو موضعٍ يُضاف لا يبقى في النصّ أبداً
  let md = String(content || '').split('\n').filter((l) => !/سطر الختام|يُضاف هنا/.test(l)).join('\n').trim();
  if (!md.includes(GAP_TABLE_MARK)) md += '\n\n' + GAP_TABLE_MARK;
  const body = mdToHtml(md, gapTableBlock(gg)) + (closing && !md.trimEnd().endsWith(closing) ? '\n<p class="cz">' + escHtml(closing) + '</p>' : '');
  const style = '<style>.consult{line-height:1.95;font-size:13.5px}.consult .ct{font-size:20px;color:#1A3D34;margin:0 0 14px;line-height:1.6}'
    + '.consult .cs{font-size:16px;color:#1A3D34;margin:20px 0 6px;padding-bottom:4px;border-bottom:1px solid #EAF2EE}'
    + '.consult .cu{font-size:14px;color:#2E9E7B;margin:12px 0 4px}.consult .cp{margin:6px 0}.consult .cl{margin:4px 0;padding-right:20px}.consult li{margin:3px 0}'
    + '.consult .cz{font-size:16px;font-weight:900;color:#2E9E7B;margin-top:16px}'
    + '.gap table{width:100%;border-collapse:collapse;font-size:11.5px;line-height:1.5;margin:8px 0}.gap th,.gap td{border:1px solid #EAF2EE;padding:3px 7px;text-align:right}'
    + '.gap th{background:#EAF2EE;color:#1A3D34}.gap td.gc{text-align:left}.gap tr.gd td{background:#EAF2EE;font-weight:900}.gap tr{page-break-inside:avoid}'
    + '.gn{font-size:12px;color:#6B8A80;margin:4px 0}.gk{border:2px solid #2E9E7B;border-radius:10px;padding:8px 12px;margin:8px 0;font-size:14px}</style>';
  // كتلةٌ واحدة: أولها وسم وآخرها سطر `</div>` — فيمرّرها القالب كما هي
  const block = ['<div class="consult">', style, body.split('\n').map((l) => (l.startsWith('<') ? l : '<span>' + l + '</span>')).join('\n'), '</div>'].join('\n');
  return buildPdfHtml(groupTitle(gg), block).replace(/<script>[\s\S]*?<\/script>/, '');
}
