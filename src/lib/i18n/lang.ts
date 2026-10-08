// اللغة: عربي (الأصل دائماً) أو English — يختارها الزائر بالزر، وتبقى في التبويب نفسه وحده.
//
// ★ ٨ أكتوبر (المالك): زر «عربي | English» في الرئيسية والخدمات ولوحة العميل والدخول.
//   الترجمة تجري في المتصفح على النص المعروض فقط (LangRuntime) — فلا تمسّ قيمةً
//   تُحفظ في القاعدة ولا منطقاً يقرأ العنوان العربي للخدمة. والعقود والسندات
//   وشاشات الإدارة والموظفات تبقى عربية دائماً.
// ★ والمنصة تُفتح بالعربية دائماً (أمر المالك): الاختيار في sessionStorage لا في كوكي
//   دائم — يبقى ما دام التبويب مفتوحاً، وكل زيارة جديدة تبدأ عربية.

export type Lang = 'ar' | 'en';
export const LANG_KEY = 'murdi_lang';

/** مسارات لا تُترجم أبداً: الإدارة والموظفات، والعقود والسندات وروابطها القصيرة */
export const NO_I18N_PATH = /^\/(admin|staff|c|p|s|check)(\/|$)/;

export function currentLang(): Lang {
  try { return typeof window !== 'undefined' && window.sessionStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'ar'; } catch { return 'ar'; }
}

export function setLang(l: Lang) {
  try { if (l === 'en') window.sessionStorage.setItem(LANG_KEY, 'en'); else window.sessionStorage.removeItem(LANG_KEY); } catch {}
  window.location.reload();
}

/** يسبق الرسم: يمحو كوكي اللغة القديم الدائم، ويقلب الاتجاه لمن اختار English في هذا التبويب،
 *  ويُخفي الصفحة لحظةً حتى تُترجم — ويُظهرها حتماً بعد ١٫٥ ثانية */
export const PRE_PAINT = `try{document.cookie='murdi_lang=; path=/; max-age=0';if(sessionStorage.getItem('murdi_lang')==='en'&&!${NO_I18N_PATH.toString()}.test(location.pathname)){var h=document.documentElement;h.lang='en';h.dir='ltr';h.classList.add('i18n-en','i18n-pending');setTimeout(function(){h.classList.remove('i18n-pending')},1500)}}catch(e){}`;
