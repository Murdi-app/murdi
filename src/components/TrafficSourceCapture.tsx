'use client';

import { useEffect } from 'react';
import { captureFirstTouch } from '@/lib/attribution';

// يحفظ مصدر أول زيارةٍ إعلانية على مستوى المنصة كلها — في كوكي ثلاثين يوماً،
// وأول مصدرٍ يفوز. التعريف في `@/lib/attribution` وحده؛ وكان منسوخاً هنا
// وفي خمس صفحات، ويُحفظ في الجلسة فيموت بإغلاق التبويب، ولا يعرف تيك توك.
export default function TrafficSourceCapture() {
  useEffect(() => { captureFirstTouch(); }, []);
  return null;
}
