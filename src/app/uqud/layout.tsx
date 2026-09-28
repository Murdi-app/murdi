import type { Metadata } from 'next'

// الصفحة نفسها مكوّن عميل لا يُصدِّر metadata — فعنوانها ووصفها هنا.
// وكانت صفحات الإعلان الثلاث تحمل عنوان المنصة العام، فتظهر معاينةُ رابطها
// في واتساب وجوجل بلا ما يخصّها.
export const metadata: Metadata = {
  title: 'تخطيط تنفيذ العقد وإدارة دورته النقدية | مُرضي',
  description: 'أربعة أسئلة عن عقدك وتخرج بقراءة أولية لدورته النقدية. مكتب استشارات مالية لا جهة تمويل — وقرار أي جهة يعود إليها وحدها. مستشار مالي معتمد — ترخيص رقم FL-457927015.',
  openGraph: {
    title: 'تخطيط تنفيذ العقد وإدارة دورته النقدية | مُرضي',
    description: 'أربعة أسئلة عن عقدك وتخرج بقراءة أولية لدورته النقدية. مكتب استشارات مالية لا جهة تمويل — وقرار أي جهة يعود إليها وحدها. مستشار مالي معتمد — ترخيص رقم FL-457927015.',
    url: 'https://murdi.sa/uqud',
    siteName: 'مُرضي',
    images: [{ url: 'https://murdi.sa/og-image.png', width: 1200, height: 630 }],
    locale: 'ar_SA',
    type: 'website',
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
