// حارسان على باب المخاطبة — يمنعان خطأين وقعا فعلاً، لا خطأين متخيَّلين.
//
// ★ الأول: رقم مالك العميل لا يخرج إلى جهة تمويل أبداً. وقع مرة، فاتصلت
//   الجهة بالعميل مباشرةً وخرج المكتب من بين الطرفين — وهذا يُسقط الوساطة
//   وأتعابها معاً. الرقم الذي يخرج هو رقم المكتب وحده.
//
// ★ الثاني: ملفُ عميلٍ بعينه لا يُرسل إلى صندوق خدمة العملاء. وكيل الخدمة
//   لا يملك فتح ملف ائتماني، ومؤشّر أدائه إغلاق التذكرة — فالمخرج الوحيد
//   أمامه «زُر الفرع» أو «قدّم عبر الموقع». التحويل بنيوي لا سوء حظ:
//   قِيس في ٢٠٢٦-٠٩-٠٢ على عشر مخاطبات لعميل واحد، ثلاثة ردود كلها تحويل.
//
// والحارسان يمنعان ولا يُصلحان بصمت: تصحيحٌ صامت يُخفي الخطأ فيتكرر.

// رقما المكتب — وهما وحدهما ما يجوز خروجه في رسالة إلى جهة.
//
// ولهما وظيفتان لا واحدة، والخلط بينهما وقع مرتين في يوم:
//   • 0560721110 — يُعطى لجهة التمويل إذا طلبت رقم تواصل
//   • 0570314005 — الرقم الرئيسي للمنصة، وهو ما يراه العملاء
//
// والحارس يقبلهما معاً ولا يفاضل: وظيفته منع رقم العميل ومالكه من الخروج،
// لا فرض رقمٍ بعينه. وحصرُه في واحد جعله يوماً يمنع رقم الشركة نفسه.
export const OFFICE_PHONES = ['0560721110', '0570314005'] as const;

/** الرقم الذي يُعطى لجهة التمويل حين تطلب رقم تواصل */
export const OFFICE_PHONE = '0560721110';

/** الرقم الرئيسي للمنصة — للعملاء والعموم */
export const PLATFORM_PHONE = '0570314005';

/** آخر تسع خانات — بها تُقارَن الأرقام مهما اختلفت صيغتها */
const tail9 = (v: string): string => {
  const d = String(v || '').replace(/\D/g, '');
  return d.length >= 9 ? d.slice(-9) : '';
};

const OFFICE_TAILS = new Set<string>(OFFICE_PHONES.map((p: string) => tail9(p)));

// أي تتابع أرقام سعودي محتمل داخل النص، ولو فُصل بمسافات أو شُرَط أو نقاط
const PHONE_RE = /(?:\+?\s*9\s*6\s*6|0)(?:[\s\-.()]*\d){8,10}/g;

/**
 * أرقام الجوال الظاهرة في النص التي ليست رقم المكتب.
 * تُعاد كما وردت في النص ليراها المستعمل كما كتبها.
 */
export function foreignPhones(body: string, allow: string[] = []): string[] {
  const allowTails = new Set<string>([...OFFICE_TAILS, ...allow.map(tail9).filter((t: string) => t !== '')]);
  const found = String(body || '').match(PHONE_RE) || [];
  const out: string[] = [];
  for (const raw of found) {
    const t = tail9(raw);
    // ما دون تسع خانات ليس جوالاً — قد يكون مبلغاً أو سنةً أو رقم سجل
    if (t === '' || allowTails.has(t)) continue;
    // السعودي يبدأ بـ5 بعد المفتاح؛ وغيره أرقام أخرى لا تخصّ هذا الحارس
    if (!t.startsWith('5')) continue;
    if (!out.includes(raw.trim())) out.push(raw.trim());
  }
  return out;
}

// صناديق لا يجلس خلفها من يملك قراراً ائتمانياً
const DESK_LOCAL = /^(info|support|contactus|contact-us|contact|customercare|customer-care|customerservice|customer|care|help|helpdesk|service|services|enquiries|enquiry|inquiries|inquiry|hello|hi|admin|office|mail|email|general|feedback|complaints|ecorporate|e-corporate|callcenter|call-center|cc|noreply|no-reply|donotreply)$/i;

/** هل هذا العنوان صندوق خدمة عملاء لا باب قرار؟ */
export function isServiceDesk(email: string): boolean {
  const at = String(email || '').indexOf('@');
  if (at <= 0) return false;
  const local = String(email).slice(0, at).trim().toLowerCase();
  if (DESK_LOCAL.test(local)) return true;
  // ticket@ · support.sme@ · info.corporate@ — اللاحقة لا تُغيّر جنس الصندوق
  const head = local.split(/[.\-_+]/)[0] || '';
  return DESK_LOCAL.test(head) || /^(ticket|tickets|case|cases)$/i.test(head);
}

export type GuardInput = {
  to: string;
  subject?: string | null;
  body: string;
  /** أرقام العميل ومالكه كما في ملفه — تُمنع صراحةً */
  clientPhones?: (string | null | undefined)[];
};

export type GuardVerdict = {
  ok: boolean;
  /** ما يُكتب في سجل الرسالة وما يُعرض للمستعمل — بلا غموض */
  reasons: string[];
};

/**
 * يُستدعى قبل كل إرسال. ويمنع — لا يُنبّه ثم يُرسل.
 *
 * ولا يُقدَّم له تجاوز: باب التجاوز يُستعمل في أول ليلة مزدحمة، ثم يصير
 * هو الطريق. والحارس الذي يُتجاوَز ليس حارساً.
 */
export function guardOutreach(g: GuardInput): GuardVerdict {
  const reasons: string[] = [];

  const clientTails = (g.clientPhones || [])
    .map((p) => tail9(String(p || '')))
    .filter((t: string) => t !== '');

  const leaked = foreignPhones(g.body);
  const isClientNumber = leaked.some((raw: string) => clientTails.includes(tail9(raw)));

  if (leaked.length > 0) {
    reasons.push(
      (isClientNumber ? 'الرسالة تحمل رقم جوال العميل' : 'الرسالة تحمل رقم جوال ليس من رقمَي المكتب')
      + ' (' + leaked.join(' · ') + '). '
      + 'ولا يخرج إلى الجهات إلا ' + OFFICE_PHONE + ' أو ' + PLATFORM_PHONE + ' — '
      + 'لأن الجهة إن اتصلت بالعميل مباشرةً خرج المكتب من بين الطرفين.'
    );
  }

  if (isServiceDesk(g.to)) {
    reasons.push(
      'العنوان «' + g.to + '» صندوق خدمة عملاء لا باب قرار. '
      + 'وكيل الخدمة لا يملك فتح ملف ائتماني، ومخرجه الوحيد تحويلك إلى الفرع أو الموقع. '
      + 'الترتيب الصحيح: التسجيل شريكاً لدى إدارة الشراكات، ثم إنسانٌ باسمه، ثم تعريفٌ من طرف ثالث، والباب العام آخِراً.'
    );
  }

  return { ok: reasons.length === 0, reasons };
}
