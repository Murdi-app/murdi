import type { Metadata } from 'next'

const TITLE = 'دراسة جدوى ائتمانية واقتصادية لمشروعك | مُرضي'
const DESC = 'مكتب استشارات أعمال. خمسة أسئلة سريعة عن مشروعك، ويتصل بك فريقنا اليوم بقراءة أولية لمشروعك ودراسة جدوى ائتمانية واقتصادية.'

// العنوان والوصف والمعاينة كلها هنا — وبلا صورة المعاينة العامة (عليها نصّ المنصة)
export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  openGraph: { title: TITLE, description: DESC, url: 'https://murdi.sa/t/jadwa', siteName: 'مُرضي', locale: 'ar_SA', type: 'website' },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
