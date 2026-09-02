// رقم واحد صحيح — لا تسع صيغ متفرقة.
//
// سجّلت اليوم «برفية رمز مطبق الابداع» ورقمها مخزَّن `535175166` — تسع
// خانات بلا الصفر، لأن المستخدمة كتبته هكذا ولم يمنعها شيء. وكل زرّ واتساب
// في المنصة كان يبني الرابط بنفس السطر المكرَّر:
//
//     phone.replace(/[^0-9]/g,'').replace(/^0/,'966')
//
// وهو يعالج «٠٥xxxxxxxx» ويعجز عن «٥xxxxxxxx»: لا صفرَ ليُستبدل، فيخرج
// `wa.me/535175166` — رقمٌ لا وجود له. أي أن أفضل عميل في الأنبوب اليوم
// كان زرّ مراسلته معطّلاً، ولا أحد يعلم لأن الزرّ يفتح ولا يشتكي.
//
// فصار التطبيع من مصدر واحد يقبل ما يكتبه الناس فعلاً:
//   0555123456 · 555123456 · 966555123456 · +966 55 512 3456 · ٠٥٥٥١٢٣٤٥٦

/** يحوّل الأرقام العربية-الهندية إلى لاتينية قبل أي معالجة */
const toLatinDigits = (s: string): string =>
  s.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
   .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06F0));

/**
 * الرقم بصيغة واتساب الدولية بلا رمز `+` — أو null إن لم يكن جوالاً سعودياً
 * صالحاً. ولا نخمّن: ما لا ينطبق على الأشكال المعروفة يُرفض ولا يُرقَّع.
 */
export function waNumber(raw: unknown): string | null {
  const d = toLatinDigits(String(raw ?? '')).replace(/[^0-9]/g, '');
  if (!d) return null;

  if (/^9665[0-9]{8}$/.test(d)) return d;              // 966 5xxxxxxxx
  if (/^009665[0-9]{8}$/.test(d)) return d.slice(2);   // 00966 5xxxxxxxx
  if (/^05[0-9]{8}$/.test(d)) return '966' + d.slice(1); // 05xxxxxxxx
  if (/^5[0-9]{8}$/.test(d)) return '966' + d;         // 5xxxxxxxx — الحالة المكسورة
  return null;
}

/** رابط واتساب جاهز، أو null إن كان الرقم غير صالح — فلا يُعرض زرّ ميت */
export function waLink(raw: unknown, text?: string): string | null {
  const n = waNumber(raw);
  if (!n) return null;
  return 'https://wa.me/' + n + (text ? '?text=' + encodeURIComponent(text) : '');
}

/** «٠٥٥٥ ١٢٣ ٤٥٦» للعرض — وإن تعذّر التطبيع عُرض ما كتبه صاحبه كما هو */
export function prettyPhone(raw: unknown): string {
  const n = waNumber(raw);
  if (!n) return String(raw ?? '').trim();
  const local = '0' + n.slice(3);
  return local.slice(0, 4) + ' ' + local.slice(4, 7) + ' ' + local.slice(7);
}
