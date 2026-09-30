// بكسل تيك توك — أحداثٌ فقط.
//
// ★ لا يُرسل لتيك توك بريدٌ ولا جوالٌ ولا اسم، ولو مُعمّى: لا `ttq.identify` في أي مكان، والحدث
//   يحمل اسم الصفحة وقيمة صفر لا غير. (والمطابقة المتقدمة الآلية تُطفأ أيضاً من إعدادات البكسل
//   في TikTok Events Manager — الكود لا يرسل ما يُطابَق.)
// ★ والحدث يُطلق بعد نجاح الحفظ في الخادم فقط — كتحويل جوجل (`@/lib/adsConversion`).

export const TIKTOK_PIXEL_ID = 'DAU502JC77UAD07QTRMG';

type Ttq = { track: (e: string, p?: Record<string, unknown>) => void; page: () => void };
declare global { interface Window { ttq?: Ttq } }

/** يطلق حدث تحويل بعد الحفظ — وينتظر البكسل حتى ثماني ثوانٍ إن لم يكن قد حُمِّل بعد */
export function tiktokEvent(name: 'SubmitForm' | 'Contact'): void {
  if (typeof window === 'undefined') return;
  const props = { content_name: window.location.pathname, value: 0, currency: 'SAR' };
  const started = Date.now();
  const tryFire = () => {
    const t = window.ttq;
    if (t && typeof t.track === 'function') { try { t.track(name, props); } catch { /* القياس لا يكسر الرحلة */ } return; }
    if (Date.now() - started < 8000) setTimeout(tryFire, 400);
  };
  tryFire();
}
