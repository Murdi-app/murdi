// إدخال الأرقام في نماذج المنصة.
//
// كانت الخانات `type="number"`، والمتصفح يرفض الفاصلة فيها رفضاً صامتاً:
// من يكتب إيراده كما يقرؤه — 13,326,459.15 — تسقط فاصلته، وفي بعض المتصفحات
// تسقط القيمة كلها فتُقرأ فارغة. فيرسل العميل رقماً ولا يصل شيء، ولا أحد
// يعرف. وأهمّ رقم في التقييم هو الإيراد، وهو أطولها فاصلةً.
//
// فصارت الخانات نصّية تقبل ما يكتبه الإنسان، ويُنظَّف هنا: الأرقام العربية
// تُردّ إلى لاتينية، والفواصل والمسافات تُحذف، والنقطة العشرية تبقى واحدة.

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

/** يُنظّف ما كتبه المستخدم ويُبقيه نصّاً صالحاً للحفظ والقراءة */
export function cleanNum(raw: string, allowNegative = false): string {
  let s = String(raw ?? '');

  // الأرقام العربية والفارسية تُردّ إلى لاتينية — يكتبها كثيرون من جوالهم
  let out = '';
  for (const ch of s) {
    const a = AR_DIGITS.indexOf(ch);
    const f = FA_DIGITS.indexOf(ch);
    out += a >= 0 ? String(a) : f >= 0 ? String(f) : ch;
  }
  s = out;

  // الفاصلة العربية والإنجليزية والمسافات فواصل آلاف لا معنى لها في القيمة،
  // والفاصلة العشرية العربية (٫) تُردّ نقطةً
  s = s.replace(/٫/g, '.').replace(/[,،\s_]/g, '');

  const neg = allowNegative && s.trim().startsWith('-');
  s = s.replace(/[^0-9.]/g, '');

  // نقطة عشرية واحدة لا أكثر: «1.2.3» تصير «1.23»
  const first = s.indexOf('.');
  if (first !== -1) {
    s = s.slice(0, first + 1) + s.slice(first + 1).replace(/\./g, '');
  }
  return (neg ? '-' : '') + s;
}

/** رقماً للحساب — وصفرٌ لما لا يُقرأ، لا NaN يتسرّب إلى الجداول */
export function toNum(raw: string | number | null | undefined): number {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0;
  const x = Number(cleanNum(String(raw ?? ''), true));
  return Number.isFinite(x) ? x : 0;
}

/** عرضٌ بفواصل الآلاف تحت الخانة — يقرأ به المستخدم ما أدخله قبل أن يرسله */
export function fmtNum(raw: string | number | null | undefined): string {
  const s = typeof raw === 'number' ? String(raw) : cleanNum(String(raw ?? ''), true);
  if (s === '' || s === '-' || s === '.') return '';
  const neg = s.startsWith('-');
  const body = neg ? s.slice(1) : s;
  const dot = body.indexOf('.');
  const intPart = dot === -1 ? body : body.slice(0, dot);
  const decPart = dot === -1 ? '' : body.slice(dot + 1, dot + 3);
  const n = Number(intPart);
  if (!Number.isFinite(n)) return '';
  return (neg ? '-' : '') + n.toLocaleString('en-US') + (decPart !== '' ? '.' + decPart : '');
}
