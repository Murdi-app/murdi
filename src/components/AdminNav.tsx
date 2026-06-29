'use client'
import { useRouter, usePathname } from 'next/navigation'

const LINKS = [
  { href: '/admin', label: 'لوحة التحكم' },
  { href: '/admin/approvals', label: 'الاعتمادات' },
  { href: '/admin/entities', label: 'الجهات' },
  { href: '/admin/services', label: 'الخدمات' },
  { href: '/admin/hunt', label: '🎯 صيد الفرص' },
  { href: '/admin/payments', label: '💳 المدفوعات' },
  { href: '/admin/leads', label: '📋 العملاء المحتملون' },
  { href: '/admin/outreach', label: '📨 مخاطبة الجهات' },
  { href: '/admin/payment-links', label: '🔗 طلبات روابط الدفع' },
]

export default function AdminNav() {
  const router = useRouter()
  const pathname = usePathname()
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 22, borderBottom: '2px solid #EAF2EE', paddingBottom: 0, flexWrap: 'wrap' }}>
      {LINKS.map((l) => {
        const active = pathname === l.href
        return (
          <div
            key={l.href}
            onClick={() => { if (!active) router.push(l.href) }}
            style={{
              padding: '10px 18px',
              color: active ? '#2E9E7B' : '#6B8A80',
              fontWeight: active ? 900 : 700,
              fontSize: 14,
              cursor: active ? 'default' : 'pointer',
              borderBottom: active ? '2px solid #2E9E7B' : '2px solid transparent',
              fontFamily: 'Cairo,sans-serif',
            }}
          >
            {l.label}
          </div>
        )
      })}
    </div>
  )
}
