// مصدر الزائر — أول لمسة، تُحفظ ثلاثين يوماً.
//
// ★ ٢٨ سبتمبر ٢٠٢٦: ٩١٩ نقرة من تيك توك في يومين، وصفر صفوف تحمل مصدرها.
//   ثلاث علل اجتمعت:
//   (١) تيك توك لا يمرّر `src` ولا `gclid` — يمرّر `ttclid`، ولم يكن يُقرأ.
//   (٢) الحفظ كان في `sessionStorage`: يموت بإغلاق التبويب. ومن رأى الإعلان
//       ثم عاد بعد ساعة من شريط العناوين دخل بلا مصدر.
//   (٣) المنطق نفسه منسوخٌ في ستة أماكن (المكوّن الجذر + خمس صفحات)، وكلٌّ
//       يكتب فوق الآخر: آخرُ زيارةٍ تفوز لا أولُها.
//   فصار المصدر يُحسب هنا وحده، ويُحفظ في كوكي أول-طرف ثلاثين يوماً، وأول
//   مصدرٍ يفوز. والنماذج تقرؤه إن غاب من الرابط، والخادم يقرؤه إن غاب من الطلب.

export const SRC_COOKIE = 'murdi_src';
export const UTM_COOKIE = 'murdi_utm';
const MAX_AGE = 30 * 24 * 3600;
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const;

/** مصدر تيك توك بصفحة الهبوط: tiktok_uqud · tiktok_jadwa · tiktok_test — وإلا tiktok */
function tiktokFor(path: string): string {
  // `/t/jadwa` و`/t/test` صفحتا تيك توك — الاسم من الجزء الثاني
  const parts = String(path || '').split('/').filter(Boolean);
  const p = (parts[0] === 't' ? parts[1] : parts[0]) || '';
  return ['uqud', 'jadwa', 'test'].includes(p) ? 'tiktok_' + p : 'tiktok';
}

/** يستخرج المصدر من معاملات الرابط — أو '' إن لم يكن فيه مصدر */
export function detectSource(q: URLSearchParams, path = ''): string {
  const src = (q.get('src') || '').trim();
  if (src) return src.slice(0, 40);
  if (q.get('gclid') || q.get('gbraid') || q.get('wbraid')) return 'google-ads';
  // ★ `src` الصريح يُحفظ حرفياً ويسبق كل شيء (أعلاه) — فإعلان العقود الذي يهبط
  //   على /test يبقى `tiktok_uqud` ولا يُسمّى بالصفحة. والتسمية بصفحة الهبوط
  //   (tiktok_uqud · tiktok_jadwa · tiktok_test) لمن جاء بـ`ttclid` بلا `src` فقط.
  if (q.get('ttclid')) return tiktokFor(path);
  if (q.get('fbclid')) return 'meta';
  if (q.get('ScCid') || q.get('sccid')) return 'snapchat';
  if (q.get('twclid')) return 'x';
  const utm = (q.get('utm_source') || '').trim();
  if (utm) return utm.slice(0, 40);
  // مدير إعلانات ChatGPT يضيف هذين المعرّفين معاً
  if (q.get('campaign_id') && q.get('ad_id')) return 'chatgpt-ads';
  return '';
}

function readCookie(all: string, name: string): string {
  for (const part of String(all || '').split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    if (part.slice(0, i).trim() === name) {
      try { return decodeURIComponent(part.slice(i + 1).trim()); } catch { return part.slice(i + 1).trim(); }
    }
  }
  return '';
}

/** يُستدعى مرةً عند أول هبوطٍ على أي صفحة (المكوّن الجذر) — أول مصدرٍ يفوز */
export function captureFirstTouch(): void {
  if (typeof document === 'undefined') return;
  try {
    const q = new URLSearchParams(window.location.search);
    const src = detectSource(q, location.pathname);
    if (!src) return;
    if (readCookie(document.cookie, SRC_COOKIE)) return; // الأول يفوز
    const secure = location.protocol === 'https:' ? '; Secure' : '';
    const base = '; Path=/; Max-Age=' + MAX_AGE + '; SameSite=Lax' + secure;
    document.cookie = SRC_COOKIE + '=' + encodeURIComponent(src) + base;
    const utm: Record<string, string> = {};
    for (const k of UTM_KEYS) { const v = q.get(k); if (v) utm[k] = v.slice(0, 80); }
    utm.landing = location.pathname.slice(0, 80);
    utm.at = new Date().toISOString();
    document.cookie = UTM_COOKIE + '=' + encodeURIComponent(JSON.stringify(utm)) + base;
  } catch {
    // القياس لا يعطّل رحلة العميل إن منع المتصفح الكوكي
  }
}

/** المصدر الذي يُرسل مع النموذج: من الرابط الحالي، وإلا من الكوكي */
export function currentSource(): string {
  if (typeof window === 'undefined') return '';
  try {
    const fromUrl = detectSource(new URLSearchParams(window.location.search), window.location.pathname);
    if (fromUrl) return fromUrl;
    return readCookie(document.cookie, SRC_COOKIE).slice(0, 40);
  } catch {
    return '';
  }
}

/** للخادم: المصدر من كوكي الطلب — حين يصل النموذج بلا مصدر */
export function sourceFromRequest(req: Request): string {
  return readCookie(req.headers.get('cookie') || '', SRC_COOKIE).slice(0, 40);
}
