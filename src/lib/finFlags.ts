// ★ ٧ أكتوبر (بأمر المالك — كينجدوم): حقلٌ ماليٌّ أدخله العميل خطأً يبقى كما هو في القاعدة
//   (`financial_data.flags = {"net_profit": "السبب"}`)، لكن لا يُعتمد عليه في أي حساب أو ملف:
//   يُصفَّر في الذاكرة عند التحميل في مسارات الملف والحكم والمطابقة والمخاطبة.
export function stripUnreliable<T>(fd: T): T {
  const row = fd as unknown as Record<string, unknown> | null | undefined;
  const flags = row && typeof row.flags === 'object' ? (row.flags as Record<string, unknown>) : null;
  if (row && flags) for (const k of Object.keys(flags)) if (k in row) row[k] = null;
  return fd;
}
