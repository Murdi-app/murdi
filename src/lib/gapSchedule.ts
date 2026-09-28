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

/** صفحةٌ واحدة بهوية مُرضي (`buildPdfHtml`) — بلا ألوانٍ غير ألوانه */
export function gapHtml(a: Pick<Award, 'company_name' | 'tender_title' | 'buyer_entity'>, g: GapResult, s: Settings): string {
  const est = String(s.gap_estimate_note || '').trim();
  const mark = (k: keyof GapInputs) => (g.estimated.includes(k) && est ? ' <span class="e">(' + est + ')</span>' : '');
  const title = fill(String(s.gap_title || ''), a).trim() || 'جدول فجوة السيولة';
  const dense = g.rows.length > 24;
  const rows = g.rows.map((r) => {
    const deep = r.cum === g.deepest.amount && r.month === g.deepest.month;
    return '<tr' + (deep ? ' class="d"' : '') + '><td>' + r.month + '</td><td>' + (r.spend ? sar(r.spend) : '—') + '</td><td>' + (r.collect ? sar(r.collect) : '—') + '</td><td class="c">' + signed(r.cum) + '</td></tr>';
  }).join('');
  const body = `
<style>
.hd{padding-bottom:8px!important;margin-bottom:10px!important}.hd .n{font-size:22px!important}
body{padding:0!important;line-height:1.6!important;font-size:${dense ? 10 : 11.5}px}
h1{font-size:17px;margin:0 0 2px;color:#1A3D34}.sub{color:#6B8A80;font-size:12px;margin-bottom:8px}
.in{display:grid;grid-template-columns:1fr 1fr 1fr;gap:3px 14px;font-size:11px;margin-bottom:8px;color:#1A3D34}
.in b{font-weight:700}.e{color:#6B8A80;font-size:10px}
table{width:100%;border-collapse:collapse}th,td{border:1px solid #EAF2EE;padding:${dense ? 1 : 3}px 6px;text-align:right}
th{background:#EAF2EE;color:#1A3D34}td.c{text-align:left}tr.d td{background:#EAF2EE;font-weight:900;color:#1A3D34}
.k{border:2px solid #2E9E7B;border-radius:10px;padding:8px 12px;margin:10px 0 6px;font-size:13px}
.end{font-size:15px;font-weight:900;color:#2E9E7B;margin-top:8px}
</style>
<h1>${title}</h1>
<div class="sub">${a.company_name}${a.buyer_entity ? ' · ' + a.buyer_entity : ''}</div>
<div class="in">
<div>قيمة العقد: <b>${sar(g.inputs.contract_value)} ريال</b></div>
<div>المدة: <b>${g.inputs.months} شهراً</b>${mark('months')}</div>
<div>بدء التنفيذ: <b>${dayLabel(g.inputs.start_date)}</b>${mark('start_date')}</div>
<div>طريقة الصرف: <b>${g.inputs.method === 'claims' ? 'مستخلصات' : 'شهري'}</b>${mark('method')}</div>
<div>مدة الصرف: <b>${g.inputs.delay_days} يوماً</b>${mark('delay_days')}</div>
<div>الصرف الشهري: <b>${sar(g.inputs.monthly_spend)} ريال</b>${mark('monthly_spend')}</div>
</div>
<table><tr><th>الشهر</th><th>الصرف على التنفيذ</th><th>التحصيل من الجهة</th><th>الرصيد التراكمي (السالب = فجوة)</th></tr>${rows}</table>
<div class="k">أعمق نقطة في الفجوة: <b>${sar(Math.abs(g.deepest.amount))} ريال</b> في <b>${g.deepest.month}</b></div>
<div class="end">${String(s.gap_closing_line || '').trim()}</div>`;
  // الطباعة هنا على الخادم — لا نافذة طباعة
  return buildPdfHtml(title, body).replace(/<script>[\s\S]*?<\/script>/, '');
}
