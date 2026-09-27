import type { Metadata } from 'next'

// الصفحة نفسها مكوّن عميل لا يُصدِّر metadata — فعنوانها ووصفها هنا.
// وكانت صفحات الإعلان الثلاث تحمل عنوان المنصة العام، فتظهر معاينةُ رابطها
// في واتساب وجوجل بلا ما يخصّها.
export const metadata: Metadata = {
  title: 'تمويل منشأتك — اعرف جاهزيتك في دقيقة | مُرضي',
  description: 'ثمانية أسئلة مجانية تكشف أين تقف منشأتك من التمويل، وما الذي ينقص ملفك، وأي الجهات تنطبق عليك شروطها. مستشار مالي معتمد — ترخيص رقم FL-457927015.',
  openGraph: {
    title: 'تمويل منشأتك — اعرف جاهزيتك في دقيقة | مُرضي',
    description: 'ثمانية أسئلة مجانية تكشف أين تقف منشأتك من التمويل، وما الذي ينقص ملفك، وأي الجهات تنطبق عليك شروطها. مستشار مالي معتمد — ترخيص رقم FL-457927015.',
    url: 'https://murdi.sa/test',
    siteName: 'مُرضي',
    images: [{ url: 'https://murdi.sa/og-image.png', width: 1200, height: 630 }],
    locale: 'ar_SA',
    type: 'website',
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
