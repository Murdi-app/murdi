import type { Metadata } from 'next'

const TITLE = 'قيّم جاهزية منشأتك وملفها في دقيقة | مُرضي'
const DESC = 'تقييم مجاني من مكتب استشارات أعمال: أين تقف منشأتك اليوم، وما الذي ينقص ملفها، ومن أين تبدأ ترتيبه.'

// العنوان والوصف والمعاينة كلها هنا — وبلا صورة المعاينة العامة (عليها نصّ المنصة)
export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  openGraph: { title: TITLE, description: DESC, url: 'https://murdi.sa/t/test', siteName: 'مُرضي', locale: 'ar_SA', type: 'website' },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
