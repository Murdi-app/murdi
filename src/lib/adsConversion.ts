// تحويلات Google Ads — «Murdi - Lead Submitted».
//
// ★ القاعدة التي بُني عليها هذا الملف: **التحويل يُطلق بعد نجاح الحفظ في
//   قاعدة البيانات، لا عند فتح النموذج ولا عند ضغط زر الإرسال ولا عند
//   فشل الطلب.** فإن أُطلق عند الضغط، عُدَّ كلُّ ضغطةٍ فاشلة عميلاً محتملاً
//   واشترينا نقراتٍ بحساب خاطئ.
//
// ★ ولا يضيف أحدٌ وسم <script> جديداً في أي صفحة: الوسم الأساسي
//   (AW-17947401948) محمَّلٌ مرةً واحدة في <head> بالتخطيط الجذر، وهذه
//   الدالة تستدعي gtag الموجودة أصلاً — لا غير.
//
// ────────────────────────────────────────────────────────────────────
// عطبان ظهرا في فحص ١٨ سبتمبر ٢٠٢٦، وهذا الملف علاجهما:
//
// (١) **الإحالات المحسَّنة مفعّلةٌ في الحساب والموقع لا يرسل شيئاً.**
//     أطلقتُ النبضة يدوياً على murdi.sa وقرأتُ ما خرج، فإذا فيه
//     `em=tv.1&emd=tvd.1` — وهذه شفرةُ جوجل لِـ«الحقل مطلوبٌ ولم يصل».
//     ولهذا يقف الإجراء على «تم الإعداد بشكل خاطئ» ولا يُحتسب،
//     والنبضة نفسها تعود 200 والوسم سليم. فصار التحويل يحمل معه
//     جوال العميل (وبريده إن وُجد)، ويُعمّيه gtag بـSHA-256 في متصفّح
//     العميل قبل الإرسال — فلا يغادر الرقمُ الجهازَ مقروءاً.
//
// (٢) **كان يسقط صامتاً إن لم تكن gtag قد حُمِّلت بعد.** ومن يصل من
//     الإعلان على شبكة بطيئة ثم يُنهي النموذج بسرعة، يُحفظ في القاعدة
//     ولا يراه جوجل. فصار ينتظر الوسم حتى ثماني ثوانٍ ثم يكفّ.

import { waNumber } from './phone';

const ADS_ID = 'AW-17947401948';

/** معرّف تحويل «Murdi - Lead Submitted» كما صدر من Google Ads */
export const LEAD_SUBMITTED = `${ADS_ID}/PWyPCLb8s_YcENy9_uIc`;

/** ما نعرفه عن صاحب الإحالة وقت إطلاقها — كلّه اختياري */
export type LeadIdentity = { phone?: unknown; email?: unknown };

/** الجوال بصيغة E.164 (`+9665…`) كما تشترطه الإحالات المحسَّنة */
function e164(raw: unknown): string | null {
  const n = waNumber(raw);
  return n ? '+' + n : null;
}

/** بريدٌ صالح الشكل بحروف صغيرة، أو null — ولا نرسل نصّاً مشوّهاً */
function cleanEmail(raw: unknown): string | null {
  const e = String(raw ?? '').trim().toLowerCase();
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) ? e : null;
}

/**
 * ينفّذ `fn` حالما تصير gtag جاهزة، ويحاول حتى ثماني ثوانٍ ثم يكفّ.
 * صامتٌ تماماً عند اليأس (مانع إعلانات · شبكة قطعت جوجل)، فالقياس يتبع
 * العمل ولا يعطّله.
 */
function whenTagReady(fn: () => void, tries = 0): void {
  try {
    if (typeof window === 'undefined') return;
    if (typeof window.gtag === 'function') { fn(); return; }
    if (tries >= 16) return;
    window.setTimeout(() => whenTagReady(fn, tries + 1), 500);
  } catch {
    /* لا شيء — لا يُوقف القياسُ العميلَ عن إتمام طلبه */
  }
}

/**
 * يُطلق حدث تحويلٍ واحداً، ومعه هويّة العميل إن عُرفت.
 *
 * `who` اختياري: بدونه يعمل كما كان، ومعه تكتمل الإحالة المحسَّنة
 * فيرتفع مطابقةُ النقرة بالعميل ويخرج الإجراء من حالة «الإعداد الخاطئ».
 */
export function fireConversion(sendTo: string, who?: LeadIdentity): void {
  whenTagReady(() => {
    const g = window.gtag;
    if (typeof g !== 'function') return;

    const ud: Record<string, string> = {};
    const phone = e164(who?.phone);
    if (phone) ud.phone_number = phone;
    const email = cleanEmail(who?.email);
    if (email) ud.email = email;
    if (Object.keys(ud).length > 0) g('set', 'user_data', ud);

    g('event', 'conversion', { send_to: sendTo });
  });
}
