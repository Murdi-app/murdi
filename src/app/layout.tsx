import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

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
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="theme-color" content="#0B1C3D" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
