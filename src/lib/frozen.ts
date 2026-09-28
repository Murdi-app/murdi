// المنشأة الموقوفة بأمر المالك — علامتها «⛔» في أول `companies.admin_note`.
//
// ★ كانت العلامة تُقرأ بـ`startsWith('⛔')` في كل شاشةٍ بنفسها، وبعضها يقرأ
//   `outreach_paused` بدلها — تعريفان يفترقان. فصار التعريف هنا، والمنظر
//   `hot_list` يقرأ العلامة نفسها (`admin_note LIKE '⛔%'`).
//
// والموقوف: لا يُتّصل به من صفوف الموظفتين، ولا تُشغَّل له مطابقة. ويبقى
// له أن يطلب خدمةً — فيصل طلبه المالكَ معلَّماً أنه من ملفٍ موقوف.
export const FROZEN_MARK = '⛔';

export const isFrozen = (adminNote: unknown): boolean =>
  String(adminNote || '').trim().startsWith(FROZEN_MARK);

/** ما يُقال للعميل الموقوف حين يطلب ما لا يُتاح له الآن */
export const FROZEN_CLIENT_MSG = 'ملفك متوقف مؤقتاً لدى الفريق — تواصل معنا على واتساب 0570749196 ونكمل معك.';
