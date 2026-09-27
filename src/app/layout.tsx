import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import WhatsAppFab from "@/components/WhatsAppFab";
import TrafficSourceCapture from "@/components/TrafficSourceCapture";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: 'مُرضي | منصة جاهزية رأس المال',
  description: 'اعرف جاهزية شركتك للتمويل والاستثمار والطرح — وفق منهجية د. عبدالحكيم المرضي',
  icons: { icon: '/murdi-icon.png', apple: '/murdi-icon.png' },
  openGraph: {
    title: 'مُرضي | منصة جاهزية رأس المال',
    description: 'اعرف جاهزية شركتك للتمويل والاستثمار والطرح — وفق منهجية د. عبدالحكيم المرضي',
    url: 'https://murdi.sa',
    siteName: 'مُرضي',
    images: [{ url: 'https://murdi.sa/og-image.png', width: 1200, height: 630 }],
    locale: 'ar_SA',
    type: 'website',
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Murdi",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <head>
        {/* Google tag (gtag.js) — Google Ads AW-17947401948.
            يُوضع أول ما يُفتح <head> ليُلتقط gclid قبل أي شيء آخر، ومرةً واحدة
            لا غير: هذا هو التخطيط الجذر، فيُصيّر في كل صفحة مرةً واحدة. */}
        <script async src="https://www.googletagmanager.com/gtag/js?id=AW-17947401948" />
        <script
          dangerouslySetInnerHTML={{
            __html: `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'AW-17947401948');`,
          }}
        />
        {/* ★ خطّا الهوية (Tajawal وCairo) لم يكونا محمَّلين إلا في صفحاتٍ
            تستوردهما بنفسها — فكانت صفحات الإعلان (`/test` · `/uqud` · `/jadwa`)
            تُعرض بخط النظام. يُحمَّلان هنا مرةً للمنصة كلها. وبالاسم الصريح لا
            عبر next/font: الأنماط في عشرات الملفات تسمّي 'Tajawal' نصّاً، وnext/font
            يُعمّي اسم العائلة فلا يطابقها. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&family=Cairo:wght@400;600;700;900&display=swap" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="theme-color" content="#1A3D34" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        {/* iOS يخزّن أيقونة الشاشة الرئيسية بالمسار لا بالمحتوى: حذفُ الأيقونة
            وإعادةُ إضافتها لا يُحدّثها ما دام الاسم واحداً. فتغيّر الاسم. */}
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon-v2.png" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      {/* الفقاعة في التخطيط الجذر لا في كل صفحة: بابٌ واحد يظهر في الواجهة
          وصفحة الخدمات والتسجيل وكل ما سواها، ويُخفي نفسه في شاشات الإدارة. */}
      <body className="min-h-full flex flex-col">
        <TrafficSourceCapture />
        {children}
        <WhatsAppFab />
      </body>
    </html>
  );
}
