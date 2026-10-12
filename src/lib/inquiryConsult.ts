import type { SupabaseClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';
import { sendPush } from '@/lib/push';
import { OWNER_EMAIL } from '@/lib/notifyLead';

// الاستشارة المختصرة لمن سجّل من الإعلانات (١٢ أكتوبر، المالك).
//
// ★ «ودي إن الاستشارة تتولّد بعد ما تضع ضي أجوبة أسئلة الاستشارة بنصف ساعة، وكأنها
//   مني، والتوليد يعمل حتى لو جهازي مغلق». فهذه دالةٌ يوقظها `pg_cron` كل عشر دقائق
//   (`/api/cron/consults`): تأخذ كل طلبٍ لُصق ردُّه قبل نصف ساعة فأكثر، وتكتب استشارته
//   على قالب استشارة «مدارس حطين» الذي اعتمده، وتنشرها برابطٍ قصير (murdi.sa/r/…)
//   يظهر في بطاقة العميل عند ضي بزرّ «أرسلي الاستشارة» — ويُشعَر المالك بها.
// ★ والنموذج يكتب **محتوى** لا صفحة: JSON يُصبّ في القالب هنا. فلا يقدر أن يكسر الهوية،
//   ولا أن يضع سعراً أو اسم موظفة، ولا أن يخترع رقماً: كل رقمٍ في البطاقات العلوية
//   يُطابَق بما قاله العميل أو سجّلته ضي، وما لا أصل له يُسقط.

const MODELS = ['claude-opus-5-5', 'claude-opus-4-8', 'claude-sonnet-4-6'];
const DHAI_WA = '966570749196';
const WAIT_MIN = 30;
const MAX_TRIES = 3;

export type InquiryRow = {
  id: string; full_name: string | null; company_name: string | null; phone: string | null;
  service_title: string | null; note: string | null; contact_note: string | null; outcome: string | null;
  ask_message: string | null; ask_reply: string | null; ask_reply_at: string | null;
  consult_status: string | null; consult_tries: number | null; consult_at: string | null; consult_code: string | null;
};

type Content = {
  title: string; lede: string;
  stats: { v: string; l: string }[];
  verdict_title: string; verdict_body: string;
  reasons: { h: string; t: string }[];
  crux_title: string; crux_body: string; key: string; note?: string;
  study_title: string; study: { h: string; t: string }[];
  cta_line: string;
};

const BANNED: [RegExp, string][] = [
  [/أتعاب|سعر الخدمة|رسوم الخدمة|قيمة الخدمة|تكلفة الخدمة|تكلفة الدراسة|سعر الدراسة|خصم|مجان/, 'ذكر سعر أو أتعاب'],
  [/ذكاء اصطناعي|ChatGPT|Claude|نموذج لغوي/i, 'ذكر أداة'],
  [/هيئة السوق|ساما|البنك المركزي|مؤسسة النقد/, 'اسم جهة رقابية'],
  [/رغد|موظف/, 'ذكر موظفة'],
  [/نضمن|مضمون|ضمان الموافقة|موافقة مؤكدة/, 'وعدٌ بالموافقة'],
];

const toLatin = (s: string) => s.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[٬,]/g, '');
const numsOf = (s: string) => (toLatin(s).match(/\d+(?:\.\d+)?/g) || []);

function prompt(r: InquiryRow, retryNote = ''): string {
  const who = r.company_name || r.full_name || 'المنشأة';
  return `أنت الدكتور عبدالحكيم المرضي، مستشار مالي معتمد، صاحب منصة مُرضي. تكتب **استشارة مبدئية مختصرة** لعميلٍ سجّل طلب «${r.service_title || 'دراسة الجدوى'}» ثم أجاب على أسئلتنا. الهدف: أن يقرأها فيقول «أطلب الآن» — بذكاءٍ وإغراءٍ مهني، بلا حشو ولا تشعّب.

## معطيات العميل (لا تستعمل غيرها)
- الاسم: ${who}${r.company_name && r.full_name ? ' — ' + r.full_name : ''}
- ما اختاره في نموذج التسجيل: ${(r.note || '').replace(/\n+/g, ' | ')}
- ما سجّله فريقنا من المكالمة: ${r.contact_note || '—'}${r.outcome ? ' (نتيجة: ' + r.outcome + ')' : ''}
- الأسئلة التي أرسلناها له:
${r.ask_message || ''}
- ردّه بنصّه:
${r.ask_reply || ''}

## القواعد — كلها ملزمة
١) لا تذكر أي معلومة أو رقم غير موجود في المعطيات أعلاه. لا تخترع إيراداً ولا تكلفةً ولا نسبة ولا جهة. إن لم يذكر رقماً فلا رقم.
٢) لا سعر ولا أتعاب ولا خصم ولا كلمة «مجاني» — إطلاقاً.
٣) لا تسمِّ أي جهة تمويل بعينها إلا ما ورد في «الأبواب المعروضة له» في المعطيات، ولا تسمِّ أي جهة رقابية. ويجوز الحديث عن «البنوك وشركات التمويل المرخّصة» و«المستثمرين في قطاعه» عموماً.
٤) لا تذكر أي موظف ولا أداة ولا ذكاء اصطناعي. اكتب بصوت المكتب: «راجعنا»، «نرى»، «قراءتنا».
٥) الخلاصة صادقة وإيجابية: مشروعه قابل للتمويل و/أو الاستثمار — واذكر السبب الحقيقي من معطياته. وإن كان في وضعه عائق ظاهر (مساهمة قليلة، لا قوائم مالية، تمويل قائم، فكرة لم تبدأ، نطاق واسع) فسمِّه بهدوء واجعل حلّه **الهيكلة والدراسة** — هذا ما يجعله يحتاجنا. لا وعد بموافقة.
٦) لهجة مهنية سعودية راقية، عربية فصيحة سهلة، جُمل قصيرة. خاطبه بـ«كم» إن كانت شركة/منشأة قائمة، وبالمفرد إن كان فرداً بفكرة.
٧) الاختصار: كل حقلٍ جملة أو جملتان. الوثيقة كلها تُقرأ في دقيقتين.
٨) استعمل **نجمتين** لإبراز كلمات قليلة فقط.

## المطلوب: JSON فقط، بهذا الشكل بالضبط، بلا أي نص خارجه
{
 "title": "عنوان قوي قصير عن مشروعه وقابليته (مثل: توسعة مدارسكم: قابلة للتمويل، وقابلة للاستثمار)",
 "lede": "جملة: قرأنا ما أرسلتموه… وهذه خلاصتنا قبل أي كلام عن خدمة",
 "stats": [{"v":"القيمة كما قالها","l":"وصفها"}],  // ٢ إلى ٣ بطاقات من أرقامه/معطياته هو فقط (مثل الإيراد، حجم المشروع، القطاع، المدينة)
 "verdict_title": "قراءتنا في سطر",
 "verdict_body": "جملتان: لماذا ملفه يُقرأ بارتياح",
 "reasons": [{"h":"عنوان قصير","t":"جملة"}],  // ٢ إلى ٣ أسباب من معطياته
 "crux_title": "النقطة التي تحسم ملفك/ملفكم",
 "crux_body": "العائق أو السؤال الحاسم في وضعه، من معطياته",
 "key": "الحل بالهيكلة: كيف يُرتَّب (تمويل/مستثمر/مراحل/ترتيب المستندات) — جملتان أو ثلاث",
 "note": "اختياري: ملاحظة واحدة ذكية (مثلاً أن الممول يوافق على رقمٍ معروف مصدره لا على نطاق)",
 "study_title": "ما الذي تفتحه دراسة الجدوى لك/لكم (أو: ما الذي يفتحه ملف التمويل — حسب الخدمة)",
 "study": [{"h":"عنوان","t":"جملة"}],  // ٣ بنود
 "cta_line": "جملة تحثّه على البدء الآن دون ضغط، مرتبطة بوضعه (لا سعر)"
}${retryNote}`;
}

async function callModel(p: string): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY غير مضبوط');
  for (const model of MODELS) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model, max_tokens: 3000, messages: [{ role: 'user', content: p }] }),
      });
      if (!res.ok) continue;
      const j = await res.json() as { content?: { type: string; text?: string }[] };
      const t = (j.content || []).filter((c) => c.type === 'text').map((c) => c.text || '').join('').trim();
      if (t.length > 100) return t;
    } catch { continue; }
  }
  return null;
}

export function parse(text: string): Content | null {
  const m = /\{[\s\S]*\}/.exec(text);
  if (!m) return null;
  try {
    const c = JSON.parse(m[0].replace(/\/\/[^\n"]*\n/g, '\n')) as Content;
    if (!c.title || !c.verdict_title || !Array.isArray(c.reasons) || !Array.isArray(c.study)) return null;
    c.stats = Array.isArray(c.stats) ? c.stats : [];
    return c;
  } catch { return null; }
}

/** المخالفات — وتُسقط البطاقات التي فيها رقمٌ لا أصل له في المعطيات */
export function check(c: Content, r: InquiryRow): string[] {
  const source = toLatin([r.note, r.contact_note, r.ask_reply].join(' '));
  c.stats = c.stats.filter((s) => numsOf(s.v).every((n) => source.includes(n))).slice(0, 3);
  const all = JSON.stringify(c);
  const bad = BANNED.filter(([re]) => re.test(all)).map(([, why]) => why);
  // رقمٌ في المتن لا أصل له في كلام العميل (ما عدا الأرقام الصغيرة كالعدّ والنِّسب الشائعة)
  const stray = numsOf(all.replace(/"(stats)":\[[^\]]*\]/, '')).filter((n) => Number(n) > 30 && !source.includes(n));
  if (stray.length) bad.push('أرقام لا أصل لها: ' + Array.from(new Set(stray)).slice(0, 4).join('، '));
  return bad;
}

const esc = (s: string) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const rich = (s: string) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

export function consultHtml(c: Content, r: InquiryRow): string {
  const who = r.company_name || r.full_name || '';
  const wa = 'https://wa.me/' + DHAI_WA + '?text=' + encodeURIComponent('أرغب في البدء — ' + (r.service_title || 'دراسة الجدوى') + (who ? ' · ' + who : ''));
  return `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow">
<title>استشارة مبدئية — ${esc(who)}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap');
*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{margin:0;background:#F4F7F6;font-family:Cairo,system-ui,sans-serif;color:#12302A;line-height:1.95;padding:20px 14px 50px}
.doc{max-width:760px;margin:0 auto;background:#fff;border:1px solid #E1EDE8;border-radius:16px;padding:30px 26px}
.hd{border-bottom:2px solid #EDF4F1;padding-bottom:14px;margin-bottom:4px}
.eyebrow{font-size:11px;letter-spacing:.10em;color:#9DB3AB;font-weight:900}
.org{font-size:14px;font-weight:900;color:#1A3D34;margin-top:6px}
.orgl{font-size:11px;color:#9DB3AB;font-weight:700}
h1{font-size:24px;margin:14px 0 4px;line-height:1.5}
h2{font-size:16.5px;margin:28px 0 8px;padding-bottom:6px;border-bottom:2px solid #EDF4F1}
p{font-size:13.8px;margin:0 0 10px}
.lede{font-size:13.5px;color:#5E7C73}
.stats{display:flex;flex-wrap:wrap;gap:10px;margin:16px 0 4px}
.stat{flex:1 1 140px;background:#F7FAF9;border:1.5px solid #E7F1ED;border-radius:12px;padding:12px;text-align:center}
.sv{font-size:18px;font-weight:900;line-height:1.5}
.sl2{font-size:11.5px;color:#8AA49B;font-weight:700}
.verdict{background:#EFF9F4;border:1.5px solid #BFE3D3;border-radius:12px;padding:16px 18px;margin:18px 0 6px}
.verdict .t{font-size:17px;font-weight:900;color:#1A3D34}
.key{background:#F6FAF8;border-right:4px solid #2E9E7B;border-radius:9px;padding:13px 15px;margin:12px 0;font-size:13.4px}
.note{background:#FBF8F0;border-right:4px solid #C9A227;border-radius:9px;padding:13px 15px;margin:12px 0;font-size:13.4px}
ul{font-size:13.8px;padding-right:20px;margin:0 0 10px}
li{margin-bottom:7px}
.cta{background:#1A3D34;color:#EAF2EE;border-radius:14px;padding:20px;margin:26px 0 6px;text-align:center}
.cta .t{font-size:17px;font-weight:900;margin-bottom:4px}
.cta p{color:#CFE2DA;font-size:13.2px}
.btn{display:inline-block;background:#2E9E7B;color:#fff;text-decoration:none;font-weight:900;font-size:15px;padding:11px 26px;border-radius:10px;margin-top:6px}
.sig{margin-top:30px;padding-top:14px;border-top:2px solid #EDF4F1}
.sn{font-size:15px;font-weight:900}
.sl{font-size:11.8px;color:#8AA49B;font-weight:700;line-height:1.9}
.foot{font-size:11px;color:#9DB3AB;text-align:center;padding-top:12px;margin-top:14px;border-top:1px solid #EFF5F2}
strong{font-weight:900}
</style></head><body><div class="doc">
<div class="hd">
  <div class="eyebrow">استشارة مبدئية · سرّية وخاصة</div>
  <div class="org">${esc(who)}</div>
  <div class="orgl">حلول المرضي للاستشارات المالية · مستشار مالي معتمد — ترخيص رقم FL-457927015</div>
</div>
<h1>${rich(c.title)}</h1>
<p class="lede">${rich(c.lede)}</p>
${c.stats.length ? '<div class="stats">' + c.stats.map((s) => `<div class="stat"><div class="sv">${esc(s.v)}</div><div class="sl2">${esc(s.l)}</div></div>`).join('') + '</div>' : ''}
<div class="verdict"><div class="t">${rich(c.verdict_title)}</div><p style="margin:6px 0 0">${rich(c.verdict_body)}</p></div>
<h2>لماذا نراه قابلاً للتمويل والاستثمار</h2>
<ul>${c.reasons.slice(0, 3).map((x) => `<li><strong>${esc(x.h)}.</strong> ${rich(x.t)}</li>`).join('')}</ul>
<h2>${rich(c.crux_title)}</h2>
<p>${rich(c.crux_body)}</p>
<div class="key">${rich(c.key)}</div>
${c.note ? `<div class="note">${rich(c.note)}</div>` : ''}
<h2>${rich(c.study_title)}</h2>
<ul>${c.study.slice(0, 3).map((x) => `<li><strong>${esc(x.h)}.</strong> ${rich(x.t)}</li>`).join('')}</ul>
<div class="cta">
  <div class="t">الخطوة التالية: بسيطة</div>
  <p>${rich(c.cta_line)} تواصلوا مع زميلتنا <strong>ضي</strong> لإكمال تسجيل منشأتكم وطلب الخدمة، ونبدأ العمل على ملفكم مباشرة.</p>
  <a class="btn" href="${wa}">اطلب الخدمة الآن</a>
</div>
<div class="sig">
  <div class="sn">د. عبدالحكيم المرضي</div>
  <div class="sl">مستشار مالي معتمد — ترخيص رقم FL-457927015<br>حلول المرضي للاستشارات المالية · منصة مُرضي · الرياض</div>
</div>
<div class="foot">أُعدّت هذه الاستشارة خصيصاً لـ${esc(who)} بناءً على ما قدّمه من معطيات، وهي سرّية. وما ورد فيها قراءة مهنية مبدئية، ولا تُعدّ ضماناً لموافقة أي جهة ممولة أو مستثمر.</div>
</div></body></html>`;
}

const SELECT = 'id, full_name, company_name, phone, service_title, note, contact_note, outcome, ask_message, ask_reply, ask_reply_at, consult_status, consult_tries, consult_at, consult_code';

/** يولّد استشارة طلبٍ واحد — يُستدعى من النبض */
export async function generateInquiryConsult(sb: SupabaseClient, r: InquiryRow): Promise<string> {
  const tries = Number(r.consult_tries || 0) + 1;
  await sb.from('service_inquiries').update({ consult_status: 'generating', consult_tries: tries, consult_error: null, consult_at: new Date().toISOString() }).eq('id', r.id);
  const fail = async (why: string) => {
    await sb.from('service_inquiries').update({ consult_status: tries >= MAX_TRIES ? 'failed' : 'retry', consult_error: why, consult_at: new Date().toISOString() }).eq('id', r.id);
    if (tries >= MAX_TRIES) await sendPush({ title: 'تعذّر توليد استشارة', body: (r.company_name || r.full_name || '') + ' — ' + why, url: '/admin/journey', tag: 'iq-consult-' + r.id }, OWNER_EMAIL).catch(() => null);
    return 'فشل: ' + why;
  };

  let c: Content | null = null, bad: string[] = [];
  for (let i = 0; i < 2; i++) {
    const text = await callModel(prompt(r, bad.length ? '\n\nتنبيه: مسودةٌ سابقة رُفضت لأنها خالفت: ' + bad.join('، ') + '. تجنّب ذلك تماماً.' : ''));
    if (!text) return fail('النموذج لم يردّ');
    c = parse(text);
    if (!c) { bad = ['الصيغة ليست JSON المطلوب']; continue; }
    bad = check(c, r);
    if (!bad.length) break;
  }
  if (!c || bad.length) return fail('خالفت القواعد: ' + bad.join('، '));

  const code = r.consult_code || randomBytes(6).toString('base64url');
  const html = consultHtml(c, r);
  const { error } = await sb.from('service_inquiries').update({
    consult_status: 'ready', consult_html: html, consult_code: code, consult_at: new Date().toISOString(), consult_error: null,
  }).eq('id', r.id);
  if (error) return fail('لم تُحفظ — ' + error.message);
  await sendPush({
    title: 'استشارة جاهزة — ' + (r.company_name || r.full_name || ''),
    body: c.title + ' · نزلت في بطاقة العميل عند ضي للإرسال',
    url: '/r/' + code, tag: 'iq-consult-' + r.id,
  }, OWNER_EMAIL).catch(() => null);
  return 'جاهزة: ' + (r.company_name || r.full_name);
}

/** النبض: كل من لُصق ردّه قبل نصف ساعة ولم تُكتب استشارته */
export async function runInquiryConsults(sb: SupabaseClient): Promise<string[]> {
  const before = new Date(Date.now() - WAIT_MIN * 60_000).toISOString();
  const hourAgo = new Date(Date.now() - 3600_000).toISOString();
  const { data, error } = await sb.from('service_inquiries').select(SELECT)
    .not('ask_reply', 'is', null).lte('ask_reply_at', before)
    .or('consult_status.is.null,and(consult_status.eq.retry,consult_at.lte.' + hourAgo + '),and(consult_status.eq.generating,consult_at.lte.' + hourAgo + ')')
    .order('ask_reply_at').limit(3);
  if (error) throw new Error(error.message);
  const out: string[] = [];
  for (const r of (data || []) as InquiryRow[]) out.push(await generateInquiryConsult(sb, r));
  return out;
}

// ═══ أسئلة الاستشارة لكل وافدٍ جديد ═══
// الأربعة والعشرون الأوائل كُتبت أسئلتهم باليد (١٢ أكتوبر). ومن يصل بعدهم تُكتب أسئلته
// في النبض نفسه — أربعة أسئلة بسيطة على وضعه — فتجدها ضي في بطاقته جاهزة للإرسال.
const N = '١٢٣٤٥';

function askPrompt(r: InquiryRow): string {
  return `عميلٌ سجّل في منصة مُرضي طلب «${r.service_title || 'دراسة الجدوى'}». هذه إجاباته في نموذج التسجيل:
${(r.note || '').replace(/\n+/g, ' | ')}
${r.contact_note ? 'وما سجّله فريقنا من المكالمة: ' + r.contact_note : ''}

اكتب **أربعة أسئلة** قصيرة جداً بلهجة سعودية مهذبة (واتساب)، تسأله عن الناقص في وضعه فقط حتى نكتب له استشارة مختصرة: مثل نوع المشروع بالضبط، الموقع، الإيراد إن كان قائماً، التكلفة التقريبية، الخبرة، التمويل القائم، وين وصل (فكرة/تراخيص). لا تسأل عن شيء أجاب عنه. لا سعر. سؤال لكل سطر بلا ترقيم.
أعد JSON فقط: {"plural": true|false, "questions": ["...","...","...","..."]}  — plural=true إن كانت شركة أو منشأة قائمة.`;
}

export function askMessage(r: InquiryRow, qs: string[], plural: boolean): string {
  const first = String(r.full_name || '').trim().split(/\s+/)[0];
  const greet = first && !/^(شركة|مؤسسة|مصنع)$/.test(first) ? ' أ. ' + first : '';
  let m = `السلام عليكم${greet}
معك ضي من منصة مُرضي.
الدكتور عبدالحكيم اطّلع على طلبك، ويجهّز لك استشارة مختصرة على وضعك — بدون أي التزام.
يحتاج منك إجابات سريعة (سطر لكل سؤال يكفي):

${qs.slice(0, 4).map((q, i) => N[i] + '- ' + q.replace(/^[\d١-٩\-.)\s]+/, '').trim()).join('\n')}

وأول ما توصلنا إجاباتك نرسل لك الاستشارة بإذن الله 🌿`;
  if (plural) for (const [a, b] of [['طلبك', 'طلبكم'], ['ويجهّز لك', 'ويجهّز لكم'], ['على وضعك', 'على وضعكم'], ['يحتاج منك', 'يحتاج منكم'], ['إجاباتك', 'إجاباتكم'], ['نرسل لك', 'نرسل لكم']]) m = m.replace(a, b);
  return m;
}

export async function runInquiryAsks(sb: SupabaseClient): Promise<string[]> {
  const since = new Date(Date.now() - 14 * 86400_000).toISOString();
  const { data, error } = await sb.from('service_inquiries').select(SELECT)
    .is('ask_message', null).gte('created_at', since)
    .in('service_title', ['دراسة الجدوى الاقتصادية', 'تمويل العقد'])
    .not('full_name', 'ilike', 'اختبار%')
    .or('outcome.is.null,outcome.neq."غير مهتم"')
    .order('created_at').limit(5);
  if (error) throw new Error(error.message);
  const out: string[] = [];
  for (const r of (data || []) as InquiryRow[]) {
    const text = await callModel(askPrompt(r));
    const m = text ? /\{[\s\S]*\}/.exec(text) : null;
    let j: { plural?: boolean; questions?: string[] } | null = null;
    try { j = m ? JSON.parse(m[0]) : null; } catch { j = null; }
    const qs = (j?.questions || []).filter((q) => typeof q === 'string' && q.trim().length > 3);
    if (qs.length < 3 || BANNED.some(([re]) => re.test(qs.join(' ')))) { out.push('تعذّرت أسئلة: ' + (r.company_name || r.full_name)); continue; }
    await sb.from('service_inquiries').update({ ask_message: askMessage(r, qs, !!j?.plural) }).eq('id', r.id).is('ask_message', null);
    out.push('أسئلة: ' + (r.company_name || r.full_name));
  }
  return out;
}
