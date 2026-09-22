'use client';

import { useEffect } from 'react';

// يحفظ مصدر أول زيارة إعلانية على مستوى المنصة كلها، لا في النماذج وحدها.
// بذلك لا تضيع نسبة العميل إلى حملته حين يدخل صفحة خدمات ثم ينتقل إلى الطلب.
export default function TrafficSourceCapture() {
  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search);
      const hasGoogleClick = Boolean(q.get('gclid') || q.get('gbraid') || q.get('wbraid'));
      // مدير إعلانات ChatGPT يضيف هذين المعرّفين من حقول التتبّع التي ظهرت
      // في إعداد الحملة. وجودهما معاً يميّز النقرة حتى لو لم يُضَف utm_source.
      const hasChatGPTAd = Boolean(q.get('campaign_id') && q.get('ad_id'));
      const source = q.get('src')
        || (hasGoogleClick ? 'google-ads' : '')
        || q.get('utm_source')
        || (hasChatGPTAd ? 'chatgpt-ads' : '')
        || '';

      // لا نستبدل مصدراً إعلانياً معلوماً بزيارة داخلية بلا مصدر.
      if (source) sessionStorage.setItem('murdi_src', source.slice(0, 40));
    } catch {
      // القياس لا يعطّل رحلة العميل إن منع المتصفح التخزين.
    }
  }, []);

  return null;
}
