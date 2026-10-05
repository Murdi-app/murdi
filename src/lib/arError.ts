// رسالة خطأ تُعرض للعميل — لا تخرج إليه إنجليزيةٌ أبداً (شكوى عميل، ٥ أكتوبر).
// ما كان عربياً من رسائلنا يمرّ كما هو، وما جاء من المكتبات أو الخادم بالإنجليزية يُترجم أو يُستبدل.
export function arError(e: unknown, fallback = 'حدث خطأ غير متوقع — حاول مرة أخرى أو راسلنا على 0570749196'): string {
  const msg = e instanceof Error ? e.message : typeof e === 'string' ? e : (e as { message?: string } | null)?.message || '';
  if (!msg) return fallback;
  if (!/[A-Za-z]/.test(msg)) return msg;
  const m = msg.toLowerCase();
  if (m.includes('failed to fetch') || m.includes('network') || m.includes('load failed')) return 'تعذّر الاتصال — تحقّق من الإنترنت وحاول مجدداً';
  if (m.includes('rate limit') || m.includes('security purposes') || m.includes('too many')) return 'محاولات كثيرة متتالية — انتظر دقيقة ثم حاول مجدداً';
  if (m.includes('session') || m.includes('jwt') || m.includes('not authenticated')) return 'انتهت جلستك — سجّل الدخول مرة أخرى';
  if (m.includes('different from the old password')) return 'كلمة المرور الجديدة يجب أن تختلف عن القديمة';
  if (m.includes('password')) return 'كلمة المرور غير مقبولة — اختر كلمة أقوى (٦ أحرف على الأقل)';
  if (m.includes('expired') || m.includes('invalid') && m.includes('link')) return 'انتهت صلاحية الرابط — اطلب رابطاً جديداً';
  if (m.includes('duplicate') || m.includes('already exists')) return 'هذه البيانات مسجّلة من قبل';
  if (m.includes('payload too large') || m.includes('exceeded the maximum')) return 'حجم الملف أكبر من المسموح';
  return fallback;
}
