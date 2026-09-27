// حكم سجلّ الجهات — معرَّفٌ مرةً واحدة تقرؤه الشاشة والخادم معاً.
//
// ★ كان مكتوباً بيده في ملفين: `admin/entities/page.tsx` و
//   `api/admin/entities/route.ts`. وهما متطابقان اليوم، لكنهما نسختان —
//   ومن أضاف حكماً في الشاشة وحدها ردّه الخادمُ «حكم غير معروف»، ومن
//   غيّر لفظاً في الخادم وحده لم يجد له زرّاً. وهذا بعينه ما وقع في
//   «نتيجة المكالمة» فعطّل تسجيلَ المكالمات كلّه (انظر `@/lib/outcomes`).
//   فيُقطع الطريق على تكراره قبل أن يقع.

export const VERDICTS = ['معتمدة', 'قيد التحقق', 'لا تُناسبنا', 'لا وجود لها'] as const;

export type Verdict = (typeof VERDICTS)[number];

export const isVerdict = (v: unknown): v is Verdict =>
  (VERDICTS as readonly string[]).includes(String(v ?? ''));

/** حالاتُ رابطٍ لا يُوصَل إليه — تُقرأ في الشاشة والخادم سواء. */
export const BROKEN_LINK = ['غير موجودة', 'تعذّر الوصول', 'محجوب آلياً'] as const;
