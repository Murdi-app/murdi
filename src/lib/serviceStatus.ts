// حالاتٌ لا يجوز أن يدهسها توليدُ مُخرَج.
//
// كانت مسارات التوليد الأربعة (الحكم الائتماني · تجهيز الخدمة · ملف العقد ·
// الملف الاحترافي) تكتب `status: 'in_progress'` بلا شرط. وأثرُ ذلك اثنان:
//
// (١) ما سُلِّم للعميل يُستبدل من تحته بنسخةٍ لم يرها — وهذا كان محروساً.
// (٢) و**ما دُفع يُفقد**: الطلب المدفوع يعود «قيد التجهيز»، فيختفي زرُّ
//     «سلّم المحتوى» عند المكتب لأنه مشروطٌ بـ`paid`، ويضيع أثرُ الدفع في
//     الحالة. أي أن مجرّد إعادة توليد المُخرَج كانت تُنسي المنصةَ أن العميل
//     دفع. وهذا لم يكن محروساً.
//
// فالقاعدة: التوليد يكتب المحتوى، ولا يُنزل الطلبَ في مساره أبداً.

const PROTECTED = new Set(['paid', 'delivered', 'completed']);

/** هل تُترك حالةُ الطلب كما هي عند حفظ مُخرَجٍ جديد؟ */
export function keepServiceStatus(status: unknown): boolean {
  return PROTECTED.has(String(status || ''));
}

/**
 * حقولُ التحديث عند حفظ مُخرَج: المحتوى دائماً، والحالة فقط إن لم تكن محميّة.
 * تُستعمل هكذا: `.update(deliverableUpdate(html, cur?.status))`
 */
export function deliverableUpdate(html: string, currentStatus: unknown) {
  return {
    admin_deliverable: html,
    ...(keepServiceStatus(currentStatus) ? {} : { status: 'in_progress' }),
    updated_at: new Date().toISOString(),
  };
}
