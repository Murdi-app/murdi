import type { Metadata } from 'next'

const TITLE = 'دراسة جدوى احترافية لمشروعك | مُرضي'
const DESC = 'مكتب استشارات أعمال. سؤالان عن مشروعك، ويظهر سعر دراستك أنت: قراءة سريعة خلال ساعات، ودراسة جدوى كاملة.'

// العنوان والوصف والمعاينة كلها هنا — وبلا صورة المعاينة العامة (عليها نصّ المنصة)
export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  openGraph: { title: TITLE, description: DESC, url: 'https://murdi.sa/t/jadwa', siteName: 'مُرضي', locale: 'ar_SA', type: 'website' },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
