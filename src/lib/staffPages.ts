// ما تراه كل موظفة — معرَّفاً مرةً واحدة.
//
// ★ كان التعريف في مكانين: قائمةٌ بيضاء في `layout` وعلامةُ `staff` في
//   `AdminNav`. وكلاهما يعرف «موظفة» ولا يعرف **أيّ موظفة**، فرأت المتابِعةُ
//   خمسة تبويبات أربعةٌ منها ليست عملها، ورأت المساعدةُ تبويب المتابعة وهي
//   لا تتابع. والتشتيت وحده يكفي سبباً — فما بالك بأن تفتح شاشةً تفعل فيها
//   ما ليس لها.
//
// ★ فصار الباب واحداً: هذا الملف. من أراد فتح صفحة لموظفة يفتحها هنا، فتُفتح
//   في الشريط وفي الحارس معاً — ولا يُفتح أحدهما وينسى الآخر.
//
// ★ والقائمة بيضاء عمداً: أي صفحة إدارة جديدة مغلقة على الموظفات حتى تُذكر.

export type StaffJob = 'assistant' | 'followup';

/** صفحات كل دور، بترتيب ظهورها — وأولها شاشته الأولى */
export const PAGES_BY_JOB: Record<StaffJob, { href: string; label: string; icon: string }[]> = {
  // المساعدة: تصيد العملاء وتكلّمهم وتراسلهم. ولا تتابع جهات تمويل.
  assistant: [
    { href: '/admin/hunt', label: 'صيد اليوم', icon: '🎯' },
    { href: '/admin/hot', label: 'الفرص الساخنة', icon: '🔥' },
    { href: '/admin/message', label: 'مراسلة العملاء', icon: '💬' },
  ],
  // المتابِعة: تلاحق مخاطبات الجهات وردودها. شاشة واحدة، ولا شيء يشتّتها.
  followup: [
    { href: '/admin/followup', label: 'المتابعة', icon: '📞' },
  ],
};

/** أول صفحة يُردّ إليها صاحب الدور */
export const homeFor = (job: StaffJob): string =>
  PAGES_BY_JOB[job]?.[0]?.href || '/admin/followup';

/** هل يُسمح لصاحب هذا الدور بهذا المسار؟ */
export const mayVisit = (job: StaffJob, pathname: string): boolean =>
  (PAGES_BY_JOB[job] || []).some((p) => String(pathname || '').startsWith(p.href));

const JOBS: StaffJob[] = ['assistant', 'followup'];
export const asJob = (v: unknown): StaffJob =>
  JOBS.find((j: StaffJob) => j === String(v ?? '')) || 'assistant';
