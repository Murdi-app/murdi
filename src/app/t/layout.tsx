import type { Metadata } from 'next'

// صفحات هبوط تيك توك وحدها (`/t/*`). رفضت المنصة `/jadwa` و`/test` «فرصةً مالية
// مضلّلة» مع قبول المقاطع — فهذه نسختان بإطار «استشارات أعمال»: بلا واتساب ولا
// رقم ولا رابطٍ يخرج، وبلا مفردات المال الممنوعة في نصٍّ ولا عنوانٍ ولا معاينة.
// والصفحات الأصلية باقية لجوجل كما هي. ولا تُفهرس: لا تُنافس صفحات جوجل ولا
// يصلها أحدٌ إلا من الإعلان.
export const metadata: Metadata = {
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
