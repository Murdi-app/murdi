'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'

// شريط الإدارة. كان أحد عشر تبويباً في صفٍّ يلتفّ — على جوال بعرض ٣٧٥ بكسل
// يصير أربعة صفوف تأكل نصف الشاشة قبل أن يظهر أي محتوى.
// الآن: صفٌّ واحد يُسحب بالإصبع، والأكثر استعمالاً أولاً — لا الترتيب الذي بُني به.
const LINKS = [
  { href: '/admin/inbox', label: '✅ صندوق التعميد', badge: true },
  { href: '/admin/services', label: 'الخدمات' },
  { href: '/admin/leads', label: '📋 مكتب المتابعة' },
  { href: '/admin/payments', label: '💳 المدفوعات' },
  { href: '/admin/apply', label: '📤 لوحة التقديم' },
  { href: '/admin/outreach', label: '✉️ المخاطبة' },
  { href: '/admin/entities', label: '🏦 سجلّ الجهات' },
  { href: '/admin/approvals', label: 'الاعتمادات' },
  { href: '/admin/hunt', label: '🎯 صيد الفرص' },
  { href: '/admin/client-hunt', label: '🪝 صيد العملاء' },
  { href: '/admin', label: 'لوحة التحكم' },
]

export default function AdminNav() {
  const router = useRouter()
  const pathname = usePathname()
  const [pending, setPending] = useState(0)

  // عدد ما ينتظر تعميده يظهر على التبويب نفسه — فيراه قبل أن يفتح
  useEffect(() => {
    let alive = true
    fetch('/api/admin/inbox?status=pending')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (alive && d) setPending(Number(d.pending) || 0) })
      .catch(() => {})
    return () => { alive = false }
  }, [pathname])

  return (
    <>
      <style>{`
        .mnav::-webkit-scrollbar{display:none}
        .mnav{-ms-overflow-style:none;scrollbar-width:none}
      `}</style>
      <div
        className="mnav"
        style={{
          display: 'flex',
          gap: 4,
          marginBottom: 20,
          borderBottom: '2px solid #EAF2EE',
          flexWrap: 'nowrap',
          overflowX: 'auto',
          overscrollBehaviorX: 'contain',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {LINKS.map((l) => {
          const active = pathname === l.href
          const show = l.badge && pending > 0
          return (
            <div
              key={l.href}
              onClick={() => { if (!active) router.push(l.href) }}
              style={{
                padding: '11px 14px',
                color: active ? '#2E9E7B' : '#6B8A80',
                fontWeight: active ? 900 : 700,
                fontSize: 13.5,
                cursor: active ? 'default' : 'pointer',
                borderBottom: active ? '2px solid #2E9E7B' : '2px solid transparent',
                fontFamily: 'Cairo,sans-serif',
                whiteSpace: 'nowrap',
                flex: '0 0 auto',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {l.label}
              {show && (
                <span style={{
                  background: '#B4622A', color: '#fff', borderRadius: 20,
                  minWidth: 19, height: 19, lineHeight: '19px', textAlign: 'center',
                  fontSize: 11, fontWeight: 900, padding: '0 5px',
                }}>{pending}</span>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}
