import { buildPdfHtml } from '@/lib/pdfTemplate';
import { fill, type Award, type Settings } from '@/lib/awards';

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
export type GapRow = { month: string; spend: number; collect: number; cum: number };
export type GapResult = {
  inputs: Required<{ [K in keyof GapInputs]: NonNullable<GapInputs[K]> }>;
  estimated: (keyof GapInputs)[];
  rows: GapRow[];
  deepest: { amount: number; month: string };
  shift: number;
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
const monthLabel = (start: Date, i: number) => {
  const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1));
  return MONTHS_AR[d.getUTCMonth()] + ' ' + d.getUTCFullYear();
};

export function computeGap(a: Pick<Award, 'category' | 'contract_value' | 'awarded_at'>, raw: GapInputs, s: Settings): GapResult {
  const b = bench(s, a.category);
  const estimated: (keyof GapInputs)[] = [];
  const pick = <T,>(k: keyof GapInputs, given: T | null, fallback: T): T => { if (given === null || given === undefined) { estimated.push(k); return fallback; } return given; };

  const value = n(raw.contract_value) ?? n(a.contract_value);
  if (!value) throw new Error('قيمة العقد مطلوبة — لا تُقدَّر');
  const months = Math.min(60, Math.round(pick('months', n(raw.months), b.months)));
  const startRaw = String(raw.start_date || '').trim();
  const start = pick('start_date', /^\d{4}-\d{2}-\d{2}$/.test(startRaw) ? startRaw : null, a.awarded_at || new Date().toISOString().slice(0, 10));
  const method = pick<Method>('method', raw.method === 'claims' || raw.method === 'monthly' ? raw.method : null, b.method);
  const delay = pick('delay_days', raw.delay_days === 0 ? 0 : n(raw.delay_days), b.delay_days);
  const spend = pick('monthly_spend', n(raw.monthly_spend), Math.round((value * (1 - b.margin)) / months));

  const revenue = value / months;
  // الشهر الذي يُحصَّل فيه عمل الشهر i: بعد دورة الصرف، وشهرٍ للمستخلص إن كان الصرف بالمستخلصات
  const shift = Math.ceil(delay / 30) + (method === 'claims' ? 1 : 0);
  const d0 = new Date(start + 'T00:00:00Z');
  const rows: GapRow[] = [];
  let cum = 0, deepest = { amount: 0, month: monthLabel(d0, 0) };
  for (let i = 0; i < months + shift; i++) {
    const out = i < months ? spend : 0;
    const inn = i - shift >= 0 && i - shift < months ? revenue : 0;
    cum += inn - out;
    const month = monthLabel(d0, i);
    rows.push({ month, spend: Math.round(out), collect: Math.round(inn), cum: Math.round(cum) });
    if (cum < deepest.amount) deepest = { amount: Math.round(cum), month };
  }
  return {
    inputs: { contract_value: value, months, start_date: start, method, delay_days: delay, monthly_spend: spend },
    estimated, rows, deepest, shift,
  };
}

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

/** عنوان الاستشارة المختصرة — بنصّ المالك */
export const consultTitle = (a: Pick<Award, 'company_name' | 'tender_title'>) =>
  'استشارة د. عبدالحكيم المرضي الخاصة لـ' + a.company_name + ' — عقد «' + (String(a.tender_title || '').trim() || 'العقد') + '»';

/**
 * نصّ الطلب إلى مولّد الاستشارات (`@/lib/consultationGen`) — بأسلوب استشارة
 * التقييم نفسه وهيكلها. الأرقام كلها من `computeGap` لا من المولّد: هو يقرؤها
 * ويشرحها، والجدول يُحقن مكان `[[GAP_TABLE]]`، وسطر الختام من الإعدادات يُلحق بعده.
 */
export function gapConsultPrompt(a: Pick<Award, 'company_name' | 'tender_title' | 'buyer_entity' | 'category'>, g: GapResult, s: Settings): string {
  const est = String(s.gap_estimate_note || 'تقديري').trim();
  const mark = (k: keyof GapInputs) => (g.estimated.includes(k) ? ' — «' + est + '» (من معيار القطاع)' : ' — من أرقامهم');
  const totalSpend = g.rows.reduce((x, r) => x + r.spend, 0);
  const totalIn = g.rows.reduce((x, r) => x + r.collect, 0);
  const firstPositive = g.rows.find((r, i) => i > 0 && r.cum >= 0 && g.rows[i - 1].cum < 0)?.month || 'بعد نهاية العقد';
  const negMonths = g.rows.filter((r) => r.cum < 0).length;
  const title = consultTitle(a);
  return 'أنت تكتب نيابة عن د. عبدالحكيم المرضي — مستشار مالي سعودي، دكتوراه إدارة أعمال، عضوية البورد الأمريكي، 15 سنة خبرة في القطاع المالي وعلاقات مباشرة مع جهات التمويل السعودية. أسلوبه: مباشر، عملي، صريح بلا مجاملات فارغة، يحلل بعمق ويعطي خطوات قابلة للتنفيذ فوراً.\n\n'
    + 'هذه "استشارة مختصرة" (700-1000 كلمة) لمنشأةٍ رُسّي عليها عقد، موضوعها فجوة السيولة في تنفيذ العقد:\n'
    + '- المنشأة: ' + a.company_name + '\n'
    + '- العقد: ' + (String(a.tender_title || '').trim() || 'غير مسمّى') + '\n'
    + '- الجهة المالكة للعقد (المدين): ' + (String(a.buyer_entity || '').trim() || 'جهة حكومية') + ' — جهة حكومية\n'
    + '- القطاع: ' + (CATEGORY_AR[a.category] || 'غير محدد') + '\n'
    + '- قيمة العقد: ' + sar(g.inputs.contract_value) + ' ريال' + mark('contract_value') + '\n'
    + '- المدة: ' + g.inputs.months + ' شهراً' + mark('months') + '\n'
    + '- بدء التنفيذ: ' + dayLabel(g.inputs.start_date) + mark('start_date') + '\n'
    + '- طريقة الصرف: ' + (g.inputs.method === 'claims' ? 'مستخلصات' : 'شهري') + mark('method') + '\n'
    + '- مدة الصرف بعد الاستحقاق: ' + g.inputs.delay_days + ' يوماً' + mark('delay_days') + '\n'
    + '- الصرف الشهري على التنفيذ: ' + sar(g.inputs.monthly_spend) + ' ريال' + mark('monthly_spend') + '\n'
    + '- الإيراد الشهري المستحق: ' + sar(g.inputs.contract_value / g.inputs.months) + ' ريال\n'
    + '- أول تحصيل بعد: ' + g.shift + ' أشهر من بدء التنفيذ\n'
    + '- أعمق نقطة في الفجوة: ' + sar(Math.abs(g.deepest.amount)) + ' ريال في ' + g.deepest.month + '\n'
    + '- عدد الأشهر والرصيد سالب: ' + negMonths + ' · يعود الرصيد موجباً في: ' + firstPositive + '\n'
    + '- مجموع الصرف: ' + sar(totalSpend) + ' ريال · مجموع التحصيل: ' + sar(totalIn) + ' ريال\n'
    + (g.estimated.length ? '- الحقول التقديرية: ' + g.estimated.map((k) => FIELD_AR[k]).join('، ') + '\n' : '')
    + '\nهيكل الاستشارة (Markdown) — بهذه العناوين حرفياً وبهذا الترتيب:\n'
    + '# ' + title + '\n'
    + '## أولاً: قراءتي لعقدكم — القيمة والمدة وطريقة الصرف والصرف الشهري، وما تعنيه دورة الصرف. اكتب بجانب كل رقمٍ من معيار القطاع «(' + est + ')» حرفياً، ولا تكتبها بجانب ما هو من أرقامهم.\n'
    + '## ثانياً: جدول الفجوة شهراً بشهر — جملتان فقط تقدّمان الجدول، ثم سطرٌ وحده فيه ' + GAP_TABLE_MARK + ' حرفياً (يُستبدل بالجدول)، ثم جملة عن أعمق نقطة وتاريخها. لا تكتب الجدول بنفسك.\n'
    + '## ثالثاً: ما يعنيه هذا لكم — نقاط القوة (وأولها أن المدين جهة حكومية لا تتعثر في السداد وإن تأخرت) والمخاطر بالأرقام أعلاه (حجم الفجوة، مدتها، أثر تأخر صرفٍ إضافي).\n'
    + '## رابعاً: خطة سدّ الفجوة — مرتبة زمنياً بعنوانين فرعيين: «أول ٣٠ يوماً» و«حتى ٩٠ يوماً»، بأدوات نقدية فقط: تمويل المستخلصات أو الفواتير، ورأس مال عامل. كل بند مرتبط بأرقام هذا العقد.\n'
    + '## خامساً: كلمة أخيرة — فقرة قصيرة شخصية واقعية. لا تختمها بعبارة عن سدّ الفجوة؛ سطر الختام يُضاف بعدها.\n\n'
    + 'قواعد صارمة: استعمل الأرقام أعلاه كما هي ولا تخترع رقماً آخر. ممنوع ذكر اسم أي جهة تمويل أو بنك أو منصة أو برنامج. ممنوع ذكر أي سعر أو رسم أو نسبة ربح أو تكلفة تمويل أو أتعاب. ممنوع ذكر الكفالة. '
    + 'كل جملة مخصصة لهذا العقد وأرقامه — لا عبارة تصلح لغيره. أكمل حتى نهاية «خامساً». قواعد الهوية: الاستشارة باسم د. عبدالحكيم المرضي وفريقه عبر منصة مُرضي — ممنوع ذكر أو تلميح لأي ذكاء اصطناعي أو نموذج أو تقنية.';
}

/** كتلة الجدول التي تُحقن مكان العلامة — أسطرٌ تبدأ بوسم وتنتهي بسطر `</div>` (هكذا يمرّرها `buildPdfHtml`) */
function gapTableBlock(g: GapResult): string {
  const rows = g.rows.map((r) => {
    const deep = r.cum === g.deepest.amount && r.month === g.deepest.month;
    return '<tr' + (deep ? ' class="gd"' : '') + '><td>' + r.month + '</td><td>' + (r.spend ? sar(r.spend) : '—') + '</td><td>' + (r.collect ? sar(r.collect) : '—') + '</td><td class="gc">' + signed(r.cum) + '</td></tr>';
  }).join('');
  return [
    '<div class="gap">',
    '<table><tr><th>الشهر</th><th>الصرف على التنفيذ</th><th>التحصيل من الجهة</th><th>الرصيد التراكمي (السالب = فجوة)</th></tr>' + rows + '</table>',
    '<div class="gk">أعمق نقطة في الفجوة: <b>' + sar(Math.abs(g.deepest.amount)) + ' ريال</b> في <b>' + g.deepest.month + '</b></div>',
    '</div>',
  ].join('\n');
}

/** الاستشارة كاملةً HTML بقالب `buildPdfHtml`: نصّ المولّد + الجدول مكان العلامة + سطر الختام */
export function consultHtml(a: Pick<Award, 'company_name' | 'tender_title'>, g: GapResult, s: Settings, content: string): string {
  const closing = String(s.gap_closing_line || '').trim();
  let md = String(content || '').trim();
  md = md.includes(GAP_TABLE_MARK) ? md.replace(GAP_TABLE_MARK, '\n' + gapTableBlock(g) + '\n') : md + '\n\n' + gapTableBlock(g);
  if (closing && !md.trimEnd().endsWith(closing)) md += '\n\n**' + closing + '**';
  const style = [
    '<div class="gstyle"><style>',
    '.gap table{width:100%;border-collapse:collapse;font-size:11.5px;line-height:1.5;margin:8px 0}.gap th,.gap td{border:1px solid #EAF2EE;padding:3px 7px;text-align:right}',
    '.gap th{background:#EAF2EE;color:#1A3D34}.gap td.gc{text-align:left}.gap tr.gd td{background:#EAF2EE;font-weight:900}',
    '.gk{border:2px solid #2E9E7B;border-radius:10px;padding:8px 12px;margin:8px 0;font-size:14px}h1{font-size:20px}h2{font-size:16px;margin-top:18px}',
    '.gap tr{page-break-inside:avoid}',
    '</style>',
    '</div>',
  ].join('\n');
  return buildPdfHtml(consultTitle(a), style + '\n' + md).replace(/<script>[\s\S]*?<\/script>/, '');
}
