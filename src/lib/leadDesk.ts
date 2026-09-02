import { waNumber } from '@/lib/phone';
// مكتب المتابعة: ٦٩ اسماً وهاتفاً دخلوا التقييم السريع منذ يونيو، ولم يُتواصل مع أحد.
// الجدول لا تقرؤه أي صفحة في المنصة. هذا الملف يرتّبهم ويكتب أول جملة تُقال لكل واحد،
// لأن العائق ليس نقص العملاء بل نقص الوقت: من أتصل به أولاً، وبماذا أبدأ.
// منطق خالص بلا قاعدة بيانات — يُختبر وحده.

export interface RawLead {
  id: string;
  created_at: string;
  full_name: string | null;
  phone: string | null;
  track: string | null;
  score: number | null;
  completed: boolean | null;
  contacted: boolean | null;
  src: string | null;
  answers?: unknown;
}

// عمود completed لا تكتبه الواجهة إطلاقاً: الصف لا يُنشأ أصلاً إلا بعد الأسئلة الثمانية
// وبعد الاسم والجوال. فالاعتماد عليه يجعل خمسين ملفاً مكتملاً تظهر «لم يُكمل».
// الحقيقة في البيانات نفسها: ثمانية أجوبة = تقييم تام.
export const QUESTION_COUNT = 8;
export function isComplete(l: Pick<RawLead, 'completed' | 'answers'>): boolean {
  const a = l.answers;
  if (Array.isArray(a)) return a.length >= QUESTION_COUNT;
  return Boolean(l.completed);
}

export type Band = 'ready' | 'gap' | 'weak' | 'unknown';
export type Temp = 'hot' | 'warm' | 'cold' | 'stale';

export interface Lead extends RawLead {
  days: number;            // منذ كم يوم دخل
  band: Band;              // ماذا تقول درجته
  temp: Temp;              // حرارة المتابعة
  registered: boolean;     // فتح حساباً في المنصة فعلاً
  rank: number;            // الأصغر أولاً
  headline: string;        // سبب الاتصال به الآن، لك أنت
  opener: string;          // أول رسالة تُرسل له
  waLink: string;          // رابط واتساب جاهز
}

// التطبيع صار في src/lib/phone.ts — مصدر واحد لكل المنصة. ويبقى الرجوع
// إلى الأرقام كما هي حين لا ينطبق شكلٌ معروف، لأن المطابقة بآخر تسع خانات
// تعتمد عليه ولا يصحّ أن تفقد صفّاً لأن رقمه غريب الشكل.
export function normPhone(p: string | null | undefined): string {
  const d = String(p || '').replace(/\D/g, '');
  if (!d) return '';
  return waNumber(p) ?? d;
}

export function daysSince(iso: string, now = Date.now()): number {
  const t = Date.parse(iso);
  if (!t) return 9999;
  return Math.max(0, Math.floor((now - t) / 86400000));
}

// الدرجة تقول شيئاً واحداً: هل هو جاهز للتقديم أم لا. وكلا الجوابين يبيع —
// الجاهز يشتري المطابقة، وغير الجاهز يشتري رفع الجاهزية. الفرق في الجملة الأولى فقط.
export function bandOf(score: number | null, completed: boolean | null): Band {
  if (!completed || score === null || score === undefined) return 'unknown';
  if (score >= 75) return 'ready';
  if (score >= 50) return 'gap';
  return 'weak';
}

export function tempOf(days: number, completed: boolean | null): Temp {
  if (!completed) return days <= 7 ? 'warm' : 'stale';
  if (days <= 7) return 'hot';
  if (days <= 21) return 'warm';
  if (days <= 60) return 'cold';
  return 'stale';
}

// التأهّل يسبق الحداثة، لا العكس. القائمة لم يُمسّ منها أحد منذ يونيو،
// فلو رتّبناها بالأحدث لاتصل بأربعة ثم وقف. والحاجة للمال لا تبرد في شهر:
// مؤهَّل عمره أربعون يوماً أقرب للإغلاق من ضعيف دخل أمس.
// فالنطاق يحكم أولاً، والحرارة ترتّب داخل النطاق.
const BAND_W: Record<Band, number> = { ready: 0, gap: 100, weak: 200, unknown: 300 };
const TEMP_W: Record<Temp, number> = { hot: 0, warm: 10, cold: 20, stale: 30 };

const FIRST = (n: string | null) => {
  const s = String(n || '').trim().replace(/\s+/g, ' ');
  if (!s) return 'أهلاً';
  const parts = s.split(' ');
  return parts[0].length >= 2 ? parts[0] : s;
};

// «قبل يومين» ليست «قبل شهرين»: الافتتاحية التي تتجاهل الزمن تكشف أنها قالب
function whenPhrase(days: number): string {
  if (days <= 1) return 'أمس';
  if (days <= 3) return 'قبل يومين';
  if (days <= 10) return 'هذا الأسبوع';
  if (days <= 35) return 'قبل أسابيع';
  return 'قبل فترة';
}

export function openerFor(l: RawLead, band: Band, days: number): string {
  const name = FIRST(l.full_name);
  const when = whenPhrase(days);
  const head = 'السلام عليكم ' + name + '، معك د. عبدالحكيم المرضي من منصة مُرضي.';
  const seen = ' دخلت التقييم السريع ' + when + ' ';

  if (band === 'ready') {
    return head + seen + 'وخرجت نتيجتك في النطاق المؤهَّل.\n'
      + 'الخطوة التي تلي التقييم ليست تقييماً آخر — بل معرفة الجهات التي تنطبق شروطها عليك بالاسم، وحدود مبالغها، وطريقة التقديم لكل واحدة.\n'
      + 'أعطني دقيقتين ونحدد ملفك: كم تطلب، ولأي غرض؟';
  }
  if (band === 'gap') {
    return head + seen + 'ونتيجتك تقول إنك قريب لكن ينقصك شيء محدد.\n'
      + 'الأهم أن نعرف ما هو بالضبط قبل أن تتقدّم لأي جهة، فالرفض الأول يُسجَّل عليك ويصعّب ما بعده.\n'
      + 'وش نشاط المنشأة وكم المبلغ المطلوب؟';
  }
  if (band === 'weak') {
    return head + seen + 'ونتيجتك تقول إن التقديم اليوم سابق لأوانه.\n'
      + 'وهذه ليست نهاية — أغلب الملفات التي رفعناها بدأت من هنا. المطلوب ترتيب قبل الطرق على الأبواب.\n'
      + 'أعطني نبذة عن المنشأة وأقول لك بصراحة كم تحتاج من وقت.';
  }
  return head + ' بدأت التقييم السريع ' + when + ' ولم تكمله.\n'
    + 'إن كان الوقت هو السبب فلا بأس — أخبرني بنشاط المنشأة والمبلغ الذي تفكر فيه، وأعطيك قراءة مختصرة بلا التزام.';
}

function headlineFor(band: Band, temp: Temp, days: number, registered: boolean): string {
  if (registered) return 'سجّل في المنصة أصلاً — راجع حسابه قبل الاتصال';
  const age = days >= 9999 ? '' : ' · منذ ' + days + ' يوماً';
  if (band === 'ready') return (temp === 'hot' ? 'مؤهَّل وطازج — اتصل اليوم' : 'مؤهَّل ولم يُتواصل معه') + age;
  if (band === 'gap') return 'قريب من التأهّل — فجوة محددة تُباع' + age;
  if (band === 'weak') return 'يحتاج رفع جاهزية — تذكرة أكبر ونفَس أطول' + age;
  return 'لم يُكمل التقييم — رسالة واحدة تكفي' + age;
}

export function buildLeads(
  rows: RawLead[],
  registeredPhones: string[] = [],
  now = Date.now()
): Lead[] {
  const reg = new Set(registeredPhones.map(p => normPhone(p)).filter(p => p.length >= 9).map(p => p.slice(-9)));

  const out = rows.map((l) => {
    const days = daysSince(l.created_at, now);
    const done = isComplete(l);
    const band = bandOf(l.score, done);
    const temp = tempOf(days, done);
    const ph = normPhone(l.phone);
    const registered = ph.length >= 9 && reg.has(ph.slice(-9));
    const opener = openerFor(l, band, days);
    // من تواصلتَ معه يخرج من الصف لا من القائمة — والمسجَّل يُؤخَّر لأن له مساراً آخر
    const rank = (l.contacted ? 1000 : 0) + (registered ? 500 : 0) + TEMP_W[temp] + BAND_W[band] + Math.min(days, 99) / 100;
    return {
      ...l, completed: done, days, band, temp, registered, rank,
      headline: headlineFor(band, temp, days, registered),
      opener,
      waLink: ph ? 'https://wa.me/' + ph + '?text=' + encodeURIComponent(opener) : '',
    };
  });

  out.sort((a, b) => a.rank - b.rank);
  return out;
}

export function leadStats(rows: Lead[]) {
  const open = rows.filter(r => !r.contacted && !r.registered);
  return {
    total: rows.length,
    contacted: rows.filter(r => r.contacted).length,
    registered: rows.filter(r => r.registered).length,
    open: open.length,
    ready: open.filter(r => r.band === 'ready').length,
    gap: open.filter(r => r.band === 'gap').length,
    weak: open.filter(r => r.band === 'weak').length,
    unknown: open.filter(r => r.band === 'unknown').length,
    today: open.filter(r => r.temp === 'hot').length,
  };
}

export const BAND_LABEL: Record<Band, string> = {
  ready: 'مؤهَّل', gap: 'فجوة محددة', weak: 'يحتاج رفعاً', unknown: 'لم يُكمل',
};
export const TEMP_LABEL: Record<Temp, string> = {
  hot: 'هذا الأسبوع', warm: 'خلال ٣ أسابيع', cold: 'خلال شهرين', stale: 'قديم',
};
