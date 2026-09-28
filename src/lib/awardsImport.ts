import type { SupabaseClient } from '@supabase/supabase-js';

// مستورد الترسيات من الأخبار — يومياً.
//
// ★ لماذا الأخبار لا تداول ولا اعتماد: موقع تداول يردّ 403 (حماية بوتات) على
//   كل طلبٍ آلي، و«اعتماد» محمي بـCAPTCHA — والتجاوز ممنوع. أما إفصاحات
//   الشركات المدرجة (ترسية · توقيع عقد) فتنشرها أرقام ومباشر ومال وغيرها
//   في اليوم نفسه، وتجمعها خلاصة Google News العامة (RSS). فهي المصدر
//   المشروع، وتُسجَّل بمصدر `news` ومعها رابط الخبر.
// ★ والمستورَد يدخل «جديدة» بفئةٍ مقدَّرة — ولا يُخاطَب أحدٌ منه قبل أن
//   يؤهّله المالك. وما لا تُعرف شركته من العنوان لا يُدخل أصلاً.

const QUERIES = ['ترسية مشروع', 'تتسلم ترسية', 'توقع عقداً بقيمة', 'توقيع عقد مع'];
const UA = 'Mozilla/5.0 (compatible; MurdiAwardsBot/1.0; +https://murdi.sa)';

export type Parsed = {
  company_name: string; tender_title: string | null; headline: string; buyer_entity: string | null;
  contract_value: number | null; awarded_at: string; category: string; link: string; outlet: string;
};

const clean = (s: string) => s.replace(/[‎‏‪-‮]/g, '').replace(/\s+/g, ' ').trim();
const unesc = (s: string) => s
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

/** اسم الشركة من العنوان: ما بين علامتي تنصيص، وإلا ما قبل الفعل */
function companyOf(t: string): string | null {
  // «تعلن شركة X عن…» / «إعلان شركة X عن…» — صيغة إفصاحات تداول كما تُنشر
  const a = /^(?:تعلن|إعلان|اعلان)\s+(?:شركة\s+)?(.{2,60}?)\s+(?:عن|بشأن)\s/.exec(t);
  if (a) return clean(a[1].replace(/\s*\([^)]*\)\s*/g, ' '));
  const q = /^[«"“]([^«»"”]{2,60})[»"”]/.exec(t);
  if (q) return clean(q[1]);
  const v = /^(.{2,60}?)\s+(?:تعلن|تتسلم|تستلم|تُوقّع|توقّع|تُوقع|توقع|تفوز|توقيع)/.exec(t);
  return v ? clean(v[1].replace(/^شركة\s+/, '')) : null;
}

/** القيمة بالريال — والدولار يُحوَّل بسعر الربط */
function valueOf(t: string): number | null {
  const m = /([\d.,٫٬]+)\s*(مليون|مليار)\s*(ريال|دولار)/.exec(t);
  if (!m) return null;
  const n = Number(m[1].replace(/[٬,]/g, '').replace('٫', '.'));
  if (!Number.isFinite(n)) return null;
  return Math.round(n * (m[2] === 'مليار' ? 1e9 : 1e6) * (m[3] === 'دولار' ? 3.75 : 1));
}

/** الجهة المرسِية: بعد «من» في الترسية، أو بعد «مع» في العقد */
function buyerOf(t: string): string | null {
  const m = /(?:ترسية[^،]*?\s+من|عقد[\u064Bا]*\s+مع)\s+[«"“]?([^«»"”،.\-]{2,50}?)[»"”]?(?:\s+(?:بقيمة|ب[\d٠-٩]|لـ|لتنفيذ|لتصنيع|لتوفير|لمدة)|\s*$|،)/.exec(t);
  const b = m ? clean(m[1]) : null;
  // «من إيراداتها…» ليست جهة
  return b && !/إيراد|٪|%|لعام|العام/.test(b) ? b : null;
}

/**
 * اسم المشروع لا عنوان الخبر: كان العنوان كلّه يُحفظ اسماً للمنافسة، فتقول
 * الرسالة «مبارك لكم «"فلان" توقع عقداً…»». يُؤخذ ما بعد «عقد/ترسية» حتى
 * «بقيمة/من/مع»، وتُحذف لام الغاية قبل المصدر («لتنفيذ» ← «تنفيذ»).
 */
function tenderOf(t: string): string | null {
  // «عقداً مع فلان بقيمة…» لا يسمّي مشروعاً — فلا اسم، ولا يُخترع
  if (/(?:عقد[\u064Bا]*)\s+مع\s/.test(t) && !/(?:عقد[\u064Bا]*)\s+مع\s[^،]+?\s+(?:لـ?\s?ت|لتنفيذ|لتوريد|لتوفير|لتصنيع|لتشغيل)/.test(t)) return null;
  const m = /(?:عقد[\u064Bا]*|ترسية)\s+(?:مع\s+[«"“]?[^«»"”]{2,40}?[»"”]?\s+)?(.+?)(?=\s+بقيمة|\s+بـ?\s?[\d٠-٩]|\s+من\s|\s+مع\s|\s+لمدة|\s+-\s|$)/.exec(t);
  if (!m) return null;
  let x = clean(m[1]).replace(/^لـ?\s?(?=ت)/, '').replace(/[«»"“”]/g, '').trim();
  if (x.length < 9) return null; // «مشروعين» ليس اسماً
  if (x.length > 160) x = x.slice(0, 160).replace(/\s+\S*$/, '') + '…';
  return x;
}

function categoryOf(t: string): string {
  if (/تشييد|إنشاء|إنشائي|مقاولات|بناء|تنفيذ أعمال|طرق|جسور/.test(t)) return 'construction';
  if (/تشغيل|صيانة|نظافة|حراسة|إدارة مرافق/.test(t)) return 'om_services';
  if (/توريد|تقنية|حوسبة|أنظمة|برمجيات|رخص|تصنيع|أنابيب|معدات|أجهزة/.test(t)) return 'supply_it';
  if (/استشار/.test(t)) return 'consulting';
  if (/نقل|تأجير سيارات|لوجست|شحن/.test(t)) return 'transport';
  return 'other';
}

export { tenderOf };
export function parseItem(rawTitle: string, link: string, pubDate: string, outlet: string): Parsed | null {
  // Google News تُلحق « - اسم المنفذ» بالعنوان
  const t = clean(unesc(rawTitle)).replace(/\s+-\s+[^-]{2,80}$/, '');
  if (!/ترسية|توقع عقد|توقّع عقد|تُوقع عقد|تُوقّع عقد|توقيع عقد|توقع عقدا/.test(t)) return null;
  if (/يرسي|ترسية\s+\d+\s+مشروع/.test(t)) return null; // الفاعل جهةٌ حكومية أو خبرٌ إجمالي
  const company = companyOf(t);
  // فاعلٌ ليس شركةً منفِّذة: جهة حكومية، أو «تابعة لـ…»، أو خبرٌ عن مسؤول
  if (!company || /^(?:تابعة|إحدى|احدى|رئيس|وزير|أمير|مجلس|محافظة|باست|السعودية|الحكومة)|وزارة|هيئة|بنك التنمية|^أرامكو|^ارامكو/.test(company)) return null;
  // سعوديٌّ لا غير: بالريال، أو من منفذٍ سعودي. وخبر الجنيه والدرهم والدينار ليس لنا
  if (/جنيه|درهم|دينار|مصر|قناة السويس|الإسكندرية|عُمان|عمان|الكويت|قطر|البحرين|الأردن/.test(t)) return null;
  if (!/ريال/.test(t) && !/ارقام|أرقام|مباشر|مال|الاقتصادية|سبق|عكاظ|الرياض|اليوم|أخبار 24|argaam|mubasher|maaal|aleqt/i.test(outlet)) return null;
  const d = new Date(pubDate);
  return {
    company_name: company,
    tender_title: tenderOf(t),
    headline: t.slice(0, 400),
    buyer_entity: buyerOf(t),
    contract_value: valueOf(t),
    awarded_at: Number.isFinite(d.getTime()) ? d.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
    category: categoryOf(t),
    link,
    outlet: clean(unesc(outlet)),
  };
}

async function fetchQuery(q: string, days: number): Promise<Parsed[]> {
  const url = 'https://news.google.com/rss/search?q=' + encodeURIComponent(q + ' when:' + days + 'd') + '&hl=ar&gl=SA&ceid=SA:ar';
  const r = await fetch(url, { headers: { 'User-Agent': UA }, cache: 'no-store' });
  if (!r.ok) throw new Error('RSS ' + r.status);
  const x = await r.text();
  const out: Parsed[] = [];
  for (const it of x.match(/<item>[\s\S]*?<\/item>/g) || []) {
    const g = (tag: string) => (new RegExp('<' + tag + '[^>]*>([\\s\\S]*?)</' + tag + '>').exec(it) || [])[1] || '';
    const p = parseItem(g('title'), clean(unesc(g('link'))), g('pubDate'), g('source'));
    if (p) out.push(p);
  }
  return out;
}

// مفتاح المقارنة: أول كلمتين مميّزتين من الاسم — بلا تنصيص ولا كلماتٍ عامة
// («شركة · الشركة · السعودية · مجموعة · العربية»)، وهمزات الألف واحدة. فـ«إس إم سي»
// و«اس ام سي السعودية» و«اس ام سي للرعاية الصحية» منشأةٌ واحدة، و«السعودية
// للكهرباء» غير «السعودية للأبحاث».
const GENERIC = new Set(['شركه', 'الشركه', 'السعوديه', 'مجموعه', 'المجموعه', 'العربيه', 'المحدوده', 'القابضه']);
const norm = (s: string) => clean(s).replace(/[«»"“”']/g, '')
  .replace(/[إأآ]/g, 'ا').replace(/ة/g, 'ه').toLowerCase()
  .split(/\s+/).filter((w) => w && !GENERIC.has(w))
  // الكلمة الأولى تكفي إن كانت اسماً (٣ أحرف فأكثر)؛ والقصيرة («اس ام سي») تُضمّ إليها التالية
  .reduce((acc: string[], w, i, arr) => (i === 0 ? (w.length >= 3 ? [w] : [w, arr[1] || '']) : acc), []).join('');
const sameAs = (seen: Set<string>, k: string) => k.length > 0 && seen.has(k);

/** يستورد ويُدخل الجديد — ويمنع التكرار: الشركة نفسها خلال عشرة أيام خبرٌ واحد */
export async function importAwardsFromNews(sb: SupabaseClient, days = 3): Promise<{ found: number; inserted: number; skipped: number; errors: string[] }> {
  const errors: string[] = [];
  const all: Parsed[] = [];
  for (const q of QUERIES) {
    try { all.push(...await fetchQuery(q, days)); } catch (e) { errors.push(q + ': ' + (e instanceof Error ? e.message : String(e))); }
  }
  const since = new Date(Date.now() - 10 * 86400_000).toISOString().slice(0, 10);
  const { data: recent, error } = await sb.from('contract_awards').select('company_name, awarded_at, created_at')
    .or('awarded_at.gte.' + since + ',created_at.gte.' + since);
  if (error) throw new Error('قراءة الترسيات: ' + error.message);
  const seen = new Set((recent || []).map((r) => norm(String(r.company_name))));
  let inserted = 0, skipped = 0;
  for (const p of all) {
    const k = norm(p.company_name);
    if (sameAs(seen, k)) { skipped++; continue; }
    seen.add(k);
    const { error: iErr } = await sb.from('contract_awards').insert({
      source: 'news', source_ref: p.link.slice(0, 500),
      company_name: p.company_name, tender_title: p.tender_title, buyer_entity: p.buyer_entity,
      category: p.category, contract_value: p.contract_value, awarded_at: p.awarded_at,
      notes: 'من الأخبار — ' + (p.outlet || 'مصدر') + ': ' + p.headline + '\n' + p.link.slice(0, 500),
    });
    if (iErr) { if (/duplicate|unique/i.test(iErr.message)) skipped++; else errors.push(p.company_name + ': ' + iErr.message); }
    else inserted++;
  }
  return { found: all.length, inserted, skipped, errors };
}
