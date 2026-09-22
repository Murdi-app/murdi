'use client';

import { useEffect } from 'react';

// يحفظ مصدر أول زيارة إعلانية على مستوى المنصة كلها، لا في النماذج وحدها.
// بذلك لا تضيع نسبة العميل إلى حملته حين يدخل صفحة خدمات ثم ينتقل إلى الطلب.
export default function TrafficSourceCapture() {
  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search);
      const hasGoogleClick = Boolean(q.get('gclid') || q.get('gbraid') || q.get('wbraid'));
      const source = q.get('src') || (hasGoogleClick ? 'google-ads' : '') || q.get('utm_source') || '';

      // لا نستبدل مصدراً إعلانياً معلوماً بزيارة داخلية بلا مصدر.
      if (source) sessionStorage.setItem('murdi_src', source.slice(0, 40));
    } catch {
      // القياس لا يعطّل رحلة العميل إن منع المتصفح التخزين.
    }
  }, []);

  return null;
}
