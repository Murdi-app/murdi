import type { Metadata } from 'next'

// الصفحة نفسها مكوّن عميل لا يُصدِّر metadata — فعنوانها ووصفها هنا.
// وكانت صفحات الإعلان الثلاث تحمل عنوان المنصة العام، فتظهر معاينةُ رابطها
// في واتساب وجوجل بلا ما يخصّها.
export const metadata: Metadata = {
  title: 'دراسة جدوى تقبلها جهات التمويل | مُرضي',
  description: 'سؤالان ويظهر سعرك أنت: فحص ائتماني للمشروع خلال ساعات، ودراسة اقتصادية وائتمانية كاملة. مستشار مالي معتمد — ترخيص رقم FL-457927015.',
  openGraph: {
    title: 'دراسة جدوى تقبلها جهات التمويل | مُرضي',
    description: 'سؤالان ويظهر سعرك أنت: فحص ائتماني للمشروع خلال ساعات، ودراسة اقتصادية وائتمانية كاملة. مستشار مالي معتمد — ترخيص رقم FL-457927015.',
    url: 'https://murdi.sa/jadwa',
    siteName: 'مُرضي',
    images: [{ url: 'https://murdi.sa/og-image.png', width: 1200, height: 630 }],
    locale: 'ar_SA',
    type: 'website',
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
