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
  /** مقاول باطن أو مورّد: الفائز يعمل لمقاولٍ رئيسي لا للجهة مباشرة */
  is_subcontract: boolean; main_contractor: string | null;
  /** مقاولو الباطن والموردون الذين يذكرهم الخبر لهذه الترسية — تُستورد كلٌّ ترسيةً مستقلة */
  subs: string[];
  /** الشركة في الخبر هي المالكة التي أرست التنفيذ — والمنفّذ لم يُذكر: «ابحث عن المنفّذ» */
  executor_unknown: boolean;
  /** اسم الشركة كما ورد في الخبر (المالكة حين تكون الترسية باسم منفّذها) */
  news_company: string;
};

// ═══ المالكة والمنفّذ (٢٩ سبتمبر) ═══
// الأخبار كلها عن شركات مدرجة، وقيمتها في الطرف الآخر من العقد: حين تكون الشركة في الخبر
// هي المالكة التي أرست تنفيذاً (تشييد · إنشاء · توريد لصالحها)، فالترسية باسم المنفّذ.
const WORK = /تشييد|إنشاء|انشاء|بناء|تنفيذ أعمال|أعمال تشييد|أعمال إنشاء|تصميم وتنفيذ|أعمال مدنية|توريد/;
const OWN_ASSET = /مستشفى|مستشفي|مقر|مبنى|مبني|مصنع|فرع|برج|مجمع|فندق|مشروعها|مدرسة|مركز/;
/** إيجارٌ وتأجير واستئجار وبيع أرض ليست ترسيات */
const NOT_AWARD = /إيجار|ايجار|تأجير|تاجير|استئجار|بيع أرض|بيع ارض|شراء أرض|شراء ارض|بيع قطعة|شراء قطعة/;
/**
 * ★ ٣ أكتوبر (بأمر المالك): لا يُدخل ما ليس عقد تنفيذ — البيع والإيجار والتسويق والمزايدات
 * والتأمين والإعلان والوساطة والتمويل. (أدخل المستورد ١٩ في يوم، ١٦ منها مدرجة كبيرة أو ليست تنفيذاً.)
 */
const NOT_EXECUTION = /(?:^|[\s«"(])(?:و|ل|لـ)?(?:بيع|البيع|شراء|تسويق|التسويق|مزايد|المزايد|مزاد|المزاد|تأمين|التأمين|إعلاني|اعلاني|إعلانات|الإعلانات|وساطة|الوساطة|تمويل|التمويل|محصول|إيجار|الإيجار|تأجير|التأجير|استحواذ|الاستحواذ|اكتتاب|الاكتتاب)/;

/** الطرف الآخر: «مع X» أو «على X» (ترسيةٌ منها عليه) — شركةً لا جهة حكومية */
function counterpartyOf(t: string): string | null {
  const m = /(?:\sمع|\sعلى)\s+(?:شركة\s+)?[«"“]?([^«»"”،.\-]{2,50}?)[»"”]?(?=\s+(?:بقيمة|ب[\d٠-٩]|لـ|لغرض|لتقديم|لتنفيذ|لتشييد|لإنشاء|لانشاء|لبناء|لتوريد|لتصميم|لأعمال|لاعمال|لمدة)|\s*$|،)/.exec(t);
  const c = m ? clean(m[1]) : null;
  return c && !GOV.test(c) && !/إيراد|٪|%|لعام|العام/.test(c) ? c : null;
}

/**
 * هل الشركة في الخبر مالكةٌ أرست التنفيذ؟ فتُعاد بمنفّذها (أو null إن لم يُذكر).
 * — «ترسي / أرست … على X»: مالكة، والمنفّذ X.
 * — عقدٌ لعمل تنفيذي (تشييد · إنشاء · توريد) مع شركةٍ مقاوِلة والشركة نفسها ليست مقاولة: مالكة.
 * — عقد تشييد مرفقٍ لها (مستشفى · مقر · مصنع …) بلا طرفٍ مذكور: مالكة، والمنفّذ مجهول.
 */
function ownerRole(t: string, company: string): { owner: true; executor: string | null } | null {
  const cp = counterpartyOf(t);
  if (/(?:^|\s)(?:ترسي|أرست|ارست)\s/.test(t) || /ترسية[^،]*\sعلى\s/.test(t)) return { owner: true, executor: cp };
  // مرفقٌ لها (مستشفى · مقر · مصنع …) يُنفَّذ أو يُشيَّد، بلا جهةٍ حكومية ولا منفّذٍ مذكور:
  // «تنفيذ أعمال مستشفى الموسى» · «تنفيذ الأعمال الإنشائية لمستشفى» — مالكة، والمنفّذ مجهول
  if (!cp && !CONTRACTOR.test(company) && !buyerOf(t) && /تنفيذ|تشييد|إنشاء|انشاء|بناء|الإنشائية|الانشائية/.test(t) && OWN_ASSET.test(t)) return { owner: true, executor: null };
  // «مع شركة X لتقديم خدمات …»: الشركة في الخبر عميلةٌ، والمنفّذ X
  if (cp && !CONTRACTOR.test(company) && /(?:لغرض\s+)?(?:تقديم|لتقديم)\s+خدمات/.test(t)) return { owner: true, executor: cp };
  if (CONTRACTOR.test(company) || !WORK.test(t)) return null;
  if (cp && CONTRACTOR.test(cp)) return { owner: true, executor: cp };
  if (/لصالحها/.test(t) && cp) return { owner: true, executor: cp };
  return null;
}

// ═══ الموردون ومقاولو الباطن (البند د) ═══
// الجهة الحكومية مرسِيةٌ أصلية؛ والشركة المقاوِلة مرسِيةً تعني أن الفائز مقاول باطن أو مورّدٌ لها.
const GOV = /وزار|هيئ|أمان|امان|بلدي|جامع|مستشف|صندوق|مؤسسة (?:العامة|الموانئ)|الحرس|القوات|الشركة الوطنية للإسكان|المدينة|مجلس|إمارة|امارة|محافظ|رئاسة|مركز/;
const CONTRACTOR = /مقاول|للمقاولات|المقاولات|إنشاء|انشاء|إعمار|اعمار|للتشييد|البنية التحتية/;
/** هل المرسِي مقاولٌ رئيسي (لا جهةٌ حكومية)؟ — أو صرّح الخبر بالباطن */
function mainContractorOf(t: string, buyer: string | null): string | null {
  if (buyer && !GOV.test(buyer) && CONTRACTOR.test(buyer) && /باطن|لصالح|مقاول/.test(t)) return buyer;
  if (buyer && !GOV.test(buyer) && /باطن|لصالح المقاول|مقاول رئيسي/.test(t)) return buyer;
  const m = /(?:لصالح|من)\s+(?:المقاول\s+(?:الرئيسي\s+)?)?(?:شركة\s+)?[«"“]?([^«»"”،.]{2,50}?)[»"”]?\s+(?:كمقاول رئيسي|المقاول الرئيسي)/.exec(t);
  return m ? clean(m[1]) : null;
}
/** مقاولو الباطن والموردون المذكورون: «مع شركة X كمقاول باطن» · «وتتولى X … من الباطن» · «X مورّداً» */
function subsOf(t: string): string[] {
  const out: string[] = [];
  const re = /(?:مع|وتعاقدت مع|تعاقد مع|وتتولى|وستتولى|بمشاركة)\s+(?:شركة\s+)?[«"“]?([^«»"”،.]{2,50}?)[»"”]?\s+(?:كمقاول(?:\s+من)?\s+(?:ال)?باطن|من الباطن|كمورد|مورداً|موردا|لتوريد)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) {
    // «وتتولى X أعمال الكهرباء من الباطن» — الاسم ينتهي قبل وصف العمل
    const n = clean(m[1].replace(/^شركة\s+/, '').replace(/\s+(?:أعمال|اعمال|تنفيذ|توريد|تركيب|تشغيل|صيانة)(?:\s.*)?$/, ''));
    if (n.length >= 2 && !out.includes(n)) out.push(n);
  }
  return out;
}

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
  const v = /^(.{2,60}?)\s+(?:تعلن|تُعلن|تتسلم|تستلم|تُوقّع|توقّع|تُوقع|توقع|تفوز|توقيع|ترسي|أرست|ارست)/.exec(t);
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
export function parseItem(rawTitle: string, link: string, pubDate: string, outlet: string, rawDesc = ''): Parsed | null {
  // Google News تُلحق « - اسم المنفذ» بالعنوان
  const t = clean(unesc(rawTitle)).replace(/\s+-\s+[^-]{2,80}$/, '');
  // المقتطف (إن جاء) يُقرأ للباطن وحده — نصٌّ بلا وسوم
  const desc = clean(unesc(unesc(rawDesc)).replace(/<[^>]+>/g, ' '));
  if (!/ترسية|توقع عقد|توقّع عقد|تُوقع عقد|تُوقّع عقد|توقيع عقد|توقع عقدا|ترسي\s|أرست\s|ارست\s/.test(t)) return null;
  if (NOT_AWARD.test(t)) return null; // إيجار وتأجير واستئجار وبيع أرض — ليست ترسيات
  if (/يرسي|ترسية\s+\d+\s+مشروع/.test(t)) return null; // الفاعل جهةٌ حكومية أو خبرٌ إجمالي
  const company = companyOf(t);
  // فاعلٌ ليس شركةً منفِّذة: جهة حكومية، أو «تابعة لـ…»، أو خبرٌ عن مسؤول
  if (!company || /^(?:تابعة|إحدى|احدى|رئيس|وزير|أمير|مجلس|محافظة|باست|السعودية|الحكومة)|وزارة|هيئة|أمانة|امانة|بلدية|جامعة|بنك التنمية|^أرامكو|^ارامكو/.test(company)) return null;
  // سعوديٌّ لا غير: بالريال، أو من منفذٍ سعودي. وخبر الجنيه والدرهم والدينار ليس لنا
  if (/جنيه|درهم|دينار|مصر|قناة السويس|الإسكندرية|عُمان|عمان|الكويت|قطر|البحرين|الأردن/.test(t)) return null;
  if (!/ريال/.test(t) && !/ارقام|أرقام|مباشر|مال|الاقتصادية|سبق|عكاظ|الرياض|اليوم|أخبار 24|argaam|mubasher|maaal|aleqt/i.test(outlet)) return null;
  const d = new Date(pubDate);
  const own = ownerRole(t, company);
  if (own) {
    // المالكة في buyer_entity، والترسية باسم المنفّذ — أو «ابحث عن المنفّذ» إن لم يُذكر
    return {
      is_subcontract: false, main_contractor: null, subs: subsOf(t + ' ' + desc).filter((n) => n !== company && n !== own.executor),
      executor_unknown: !own.executor, news_company: company,
      company_name: own.executor || 'منفّذ «' + (tenderOf(t) || company) + '»',
      tender_title: tenderOf(t), headline: t.slice(0, 400), buyer_entity: company,
      contract_value: valueOf(t),
      awarded_at: Number.isFinite(d.getTime()) ? d.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
      category: categoryOf(t), link, outlet: clean(unesc(outlet)),
    };
  }
  const buyer = buyerOf(t);
  const main = mainContractorOf(t + ' ' + desc, buyer);
  return {
    is_subcontract: !!main, main_contractor: main,
    subs: subsOf(t + ' ' + desc).filter((n) => n !== company && n !== main),
    executor_unknown: false, news_company: company,
    company_name: company,
    tender_title: tenderOf(t),
    headline: t.slice(0, 400),
    buyer_entity: main ? null : buyer,
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
    const p = parseItem(g('title'), clean(unesc(g('link'))), g('pubDate'), g('source'), g('description'));
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
/** جهاتٌ ضخمة مالكةٌ للمشاريع — لا تُخاطَب، والمطلوب منفّذها الصغير أو المتوسط */
const MEGA_OWNER = /الدرعية|الدرعيه|نيوم|روشن|البحر الأحمر|البحر الاحمر|القدية|القديه|داون تاون|المربع الجديد|حديقة الملك سلمان|الرياض الخضراء|مطار الملك سلمان|العلا|أمالا|امالا|صندوق الاستثمارات|\b(?:Diriyah|NEOM|ROSHN|Red Sea Global|Qiddiya|PIF)\b/i;

/** مطابقٌ لـ `award_org_name_key` في القاعدة — فالمشغّل والمستورد يقرآن القائمة بالمفتاح نفسه */
const nameKey = (s: string) => String(s || '')
  .replace(/[ً-ْـ]/g, '')
  .replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
  .replace(/(^|\s)(شركه|الشركه|مؤسسه|المؤسسه|المحدوده|ذات|المسؤوليه|المسئوليه|شخص|واحد)(?=\s|$)/g, ' ')
  .replace(/[^ء-يa-zA-Z0-9]/g, '');

export async function screenParsed(sb: SupabaseClient, all: Parsed[], errors: string[]): Promise<{ keep: Parsed[]; notExec: number; listed: number; mega: number }> {
  const exec = all.filter((p) => !NOT_EXECUTION.test(p.headline + ' ' + (p.tender_title || '')));
  const notExec = all.length - exec.length;
  const { data: lc } = await sb.from('listed_companies').select('name_key, market');
  const tasi = new Set((lc || []).filter((r) => r.market === 'tasi').map((r) => String(r.name_key)));
  const known = new Set((lc || []).map((r) => String(r.name_key)));
  // المنفّذ المجهول («منفّذ …») لا يُقاس إدراجه — المدرجة هي المالكة، والمطلوب منفّذها
  const ask = Array.from(new Set(exec.filter((p) => !p.executor_unknown && !known.has(nameKey(p.company_name))).map((p) => p.company_name)));
  if (ask.length) {
    try {
      const { jsonOf } = await import('./claudeApi');
      // بحثٌ في الويب للتحقق (رمز التداول في تداول/أرقام/مباشر) — الذاكرة وحدها لم تعرف «أسمنت الرياض»
      const messages: { role: string; content: unknown }[] = [{ role: 'user', content:
        'لكل شركة سعودية أدناه (وردت في أخبار عقود): هل هي مدرجة في السوق الرئيسية «تاسي»، أم السوق الموازية «نمو»، أم غير مدرجة؟ '
        + 'ابحث عن رمز تداولها في تداول أو أرقام أو مباشر إن لم تتيقّن. الأخبار المالية التي تعلن فيها شركةٌ توقيع عقد غالباً إفصاحٌ لشركة مدرجة. '
        + 'أعد في آخر ردّك JSON فقط: {"companies":[{"name":"الاسم كما ورد","market":"tasi|nomu|none"}]}\n\n'
        + ask.map((n, i) => (i + 1) + '. ' + n).join('\n') }];
      let text = '';
      for (let turn = 0; turn < 6; turn++) {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY as string, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 4000, messages, tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: Math.min(12, ask.length * 2) }] }),
        });
        if (!res.ok) throw new Error('Claude ' + res.status);
        const data = await res.json() as { content: { type: string; text?: string }[]; stop_reason: string };
        text += data.content.filter((b) => b.type === 'text').map((b) => b.text || '').join('');
        if (data.stop_reason === 'pause_turn') { messages.push({ role: 'assistant', content: data.content }); continue; }
        break;
      }
      const all = text.match(/\{[\s\S]*"companies"[\s\S]*\}/g);
      const j = jsonOf<{ companies: { name: string; market: 'tasi' | 'nomu' | 'none' }[] }>(all ? all[all.length - 1] : '');
      const learned = (j?.companies || []).filter((c) => c.market === 'tasi' || c.market === 'nomu');
      for (const c of learned) {
        const k = nameKey(c.name);
        if (c.market === 'tasi') tasi.add(k);
        await sb.from('listed_companies').insert({ name: c.name, market: c.market, name_key: k, added_by: 'Claude — فرز الاستيراد' });
      }
    } catch (e) { errors.push('فرز الإدراج: ' + (e instanceof Error ? e.message : String(e))); }
  }
  const keep0 = exec.filter((p) => p.executor_unknown || !tasi.has(nameKey(p.company_name)));
  // ★ ٧ أكتوبر (بأمر المالك): تُسقط كل ترسيةٍ فوق ٥٠٠ مليون، وكل مشروعٍ مالكه جهةٌ ضخمة (الدرعية · نيوم ·
  //   روشن · البحر الأحمر · القدية وأمثالها) ما لم يُسمَّ فيه منفّذٌ ليس هو الجهة نفسها (مقاولٌ صغير أو متوسط —
  //   والكبير المدرج سقط قبلها بفرز تاسي).
  const keep = keep0.filter((p) => !(Number(p.contract_value) > 500_000_000)
    && !(MEGA_OWNER.test(p.company_name) || (p.executor_unknown && MEGA_OWNER.test(p.news_company + ' ' + (p.buyer_entity || '')))));
  return { keep, notExec, listed: exec.length - keep0.length, mega: keep0.length - keep.length };
}

export async function importAwardsFromNews(sb: SupabaseClient, days = 3): Promise<{ found: number; inserted: number; skipped: number; blocked: number; not_execution: number; listed_tasi: number; mega_dropped: number; errors: string[] }> {
  const errors: string[] = [];
  const all: Parsed[] = [];
  for (const q of QUERIES) {
    try { all.push(...await fetchQuery(q, days)); } catch (e) { errors.push(q + ': ' + (e instanceof Error ? e.message : String(e))); }
  }
  // ★ ٣ أكتوبر (بأمر المالك) — فرزٌ قبل الإدخال لا بعده:
  //   ١) ما ليس عقد تنفيذ (بيع · إيجار · تسويق · مزايدة · تأمين …) لا يُدخل.
  //   ٢) المدرجة في السوق الرئيسية (تاسي) لا تُدخل — تُعرف من `listed_companies`، وما لم يكن فيها
  //      يُسأل عنه Claude دفعةً واحدة، ويُضاف ما يثبت إدراجه إلى القائمة فلا يُسأل عنه ثانية.
  //      ونمو (السوق الموازية) يبقى. وإن تعذّر السؤال دخل الخبر كالسابق ومشغّل القاعدة يعلّمه.
  const filtered = await screenParsed(sb, all, errors);
  all.length = 0; all.push(...filtered.keep);
  const since = new Date(Date.now() - 10 * 86400_000).toISOString().slice(0, 10);
  const { data: recent, error } = await sb.from('contract_awards').select('company_name, buyer_entity, contract_value, awarded_at, created_at')
    .or('awarded_at.gte.' + since + ',created_at.gte.' + since);
  if (error) throw new Error('قراءة الترسيات: ' + error.message);
  const seen = new Set((recent || []).map((r) => norm(String(r.company_name))));
  // التكرار بين الاسم العربي واللاتيني («اس ام سي» / «SMC»): القيمة نفسها وتاريخ الخبر خلال ٧ أيام
  const byValue: { v: number; d: string }[] = (recent || [])
    .filter((r) => Number(r.contract_value) > 0)
    .map((r) => ({ v: Number(r.contract_value), d: String(r.awarded_at || r.created_at).slice(0, 10) }));
  // «148.5» و«148.45» مليوناً خبرٌ واحد: فرقٌ دون نصف بالمئة تقريبٌ لا عقدٌ آخر
  const sameValue = (v: number | null, d: string) => !!v && byValue.some((x) => Math.abs(x.v - v) <= v * 0.005 && Math.abs(Date.parse(x.d) - Date.parse(d)) <= 7 * 86400_000);
  let inserted = 0, skipped = 0, blocked = 0;
  for (const p of all) {
    if (sameValue(p.contract_value, p.awarded_at)) { skipped++; continue; }
    // المنفّذ المجهول لا يُقارن باسمه («منفّذ …» يتشابه) — بالمالكة والقيمة وحدهما
    const k = p.executor_unknown ? 'owner:' + norm(p.news_company) : norm(p.company_name);
    if (sameAs(seen, k)) { skipped++; continue; }
    seen.add(k);
    if (p.contract_value) byValue.push({ v: p.contract_value, d: p.awarded_at });
    // الترسية نفسها — ومقاول الباطن يحمل اسم مقاوله الرئيسي (مشغّل القاعدة يربطهما)
    const rows: Record<string, unknown>[] = [{
      source: 'news', source_ref: p.link.slice(0, 500),
      company_name: p.company_name, tender_title: p.tender_title, buyer_entity: p.buyer_entity,
      category: p.category, contract_value: p.contract_value, awarded_at: p.awarded_at,
      is_subcontract: p.is_subcontract, main_contractor: p.main_contractor,
      notes: (p.executor_unknown ? 'ابحث عن المنفّذ — «' + p.news_company + '» هي المالكة التي أرست التنفيذ، والخبر لا يسمّي المقاول أو المورّد.\n'
        : p.buyer_entity === p.news_company ? 'المالكة «' + p.news_company + '» أرست التنفيذ على هذه المنشأة.\n' : '')
        + 'من الأخبار — ' + (p.outlet || 'مصدر') + ': ' + p.headline + '\n' + p.link.slice(0, 500),
    }];
    // ومن ذكرهم الخبر مقاولي باطن أو موردين: ترسيةٌ مستقلة لكلٍّ، مربوطةٌ بالفائز
    for (const sub of p.subs) {
      const sk = norm(sub);
      if (sameAs(seen, sk)) { skipped++; continue; }
      seen.add(sk);
      rows.push({
        source: 'news', source_ref: p.link.slice(0, 500),
        company_name: sub, tender_title: p.tender_title, buyer_entity: null,
        category: p.category, contract_value: null, awarded_at: p.awarded_at,
        is_subcontract: true, main_contractor: p.company_name,
        notes: 'مقاول باطن/مورّد لـ' + p.company_name + ' — من الأخبار: ' + p.headline + '\n' + p.link.slice(0, 500),
      });
    }
    for (const row of rows) {
      const { error: iErr } = await sb.from('contract_awards').insert(row);
      // منشأةٌ «لا تتواصل» يرفضها مشغّل القاعدة — تُعدّ ولا تُعدّ خطأً
      if (iErr) { if (/duplicate|unique/i.test(iErr.message)) skipped++; else if (/do_not_contact/.test(iErr.message)) blocked++; else errors.push(String(row.company_name) + ': ' + iErr.message); }
      else inserted++;
    }
  }
  return { found: all.length, inserted, skipped, blocked, not_execution: filtered.notExec, listed_tasi: filtered.listed, mega_dropped: filtered.mega, errors };
}
