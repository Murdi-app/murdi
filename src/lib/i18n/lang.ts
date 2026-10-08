// اللغة: عربي (الأصل) أو English — تُحفظ في كوكي murdi_lang لسنة.
//
// ★ ٨ أكتوبر (المالك): زر «عربي | English» في الرئيسية والخدمات ولوحة العميل والدخول.
//   الترجمة تجري في المتصفح على النص المعروض فقط (LangRuntime) — فلا تمسّ قيمةً
//   تُحفظ في القاعدة ولا منطقاً يقرأ العنوان العربي للخدمة. والعقود والسندات
//   وشاشات الإدارة والموظفات تبقى عربية دائماً.

export type Lang = 'ar' | 'en';
export const LANG_COOKIE = 'murdi_lang';

/** مسارات لا تُترجم أبداً: الإدارة والموظفات، والعقود والسندات وروابطها القصيرة */
export const NO_I18N_PATH = /^\/(admin|staff|c|p|s|check)(\/|$)/;

export function currentLang(): Lang {
  if (typeof document === 'undefined') return 'ar';
  return /(?:^|;\s*)murdi_lang=en(?:;|$)/.test(document.cookie) ? 'en' : 'ar';
}

export function setLang(l: Lang) {
  document.cookie = LANG_COOKIE + '=' + l + '; path=/; max-age=31536000; samesite=lax';
  window.location.reload();
}

/** السكربت الذي يسبق الرسم: يقلب الاتجاه ويُخفي الصفحة لحظةً حتى تُترجم — ويُظهرها حتماً بعد ١٫٥ ثانية */
export const PRE_PAINT = `try{if(/(?:^|;\\s*)murdi_lang=en(?:;|$)/.test(document.cookie)&&!${NO_I18N_PATH.toString()}.test(location.pathname)){var h=document.documentElement;h.lang='en';h.dir='ltr';h.classList.add('i18n-en','i18n-pending');setTimeout(function(){h.classList.remove('i18n-pending')},1500)}}catch(e){}`;
