'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'

// شريط الإدارة — نسخة واحدة تظهر في كل صفحة، وكل التبويبات ظاهرة دائماً.
// قبلها كان الشريط صفّاً واحداً يُسحب بالإصبع وشريط تمريره مخفي، فكانت
// التبويبات البعيدة تُقصّ خارج الشاشة بلا أي إشارة تدلّ عليها — تختفي فعلياً.
// وكانت «لوحة التحكم» و«المدفوعات» تحملان شريطاً خاصاً بستة تبويبات فقط،
// فيختلف ما يراه المستخدم من صفحة لأخرى. الآن: شريط واحد، يلتفّ في صفوف،
// لا شيء يُقصّ ولا شيء يُخفى.

// خرج «صيد الفرص» و«صيد العملاء» من الشريط وحلّت محلّهما «الفرص الساخنة».
// السبب تجاري لا تقني: الصيد يبحث عمّن لا يعرفك — ٣٠٠ اسم مسحوب و١٨٠ قائمة
// يومية بنسبة ردّ الاتصال البارد. وفي القاعدة نفسها ٦٧ شخصاً أنهوا التقييم
// بأنفسهم وكتبوا أرقامهم ولم يُتّصل بأحد منهم. الاتصال بهؤلاء أرخص وأسرع
// وأعلى تحويلاً من أي صيد. والصفحتان القديمتان باقيتان لمن أرادهما بالرابط.

// staff: true تعني أن الموظفة ترى هذا التبويب. والباقي للمالك وحده.
// وهذا الإخفاء تجميلي فقط — الحماية الحقيقية في requireStaff داخل كل مسار،
// وفي القائمة البيضاء STAFF_PAGES داخل layout.
type Link = { href: string; label: string; icon: string; badge?: boolean; staff?: boolean }

const LINKS: Link[] = [
  { href: '/admin/inbox', label: 'التعميد', icon: '✅', badge: true },
  { href: '/admin/deal', label: 'لوحة الصفقة', icon: '🧭', staff: true },
  { href: '/admin/services', label: 'الخدمات', icon: '🗂' },
  { href: '/admin/leads', label: 'المتابعة', icon: '📋', staff: true },
  { href: '/admin/message', label: 'مراسلة العملاء', icon: '💬', staff: true },
  { href: '/admin/payments', label: 'المدفوعات', icon: '💳' },
  { href: '/admin/payment-links', label: 'روابط الدفع', icon: '📨' },
  { href: '/admin/apply', label: 'التقديم', icon: '📤' },
  { href: '/admin/outreach', label: 'المخاطبة', icon: '✉️' },
  { href: '/admin/entities', label: 'سجلّ الجهات', icon: '🏦' },
  { href: '/admin/approvals', label: 'الاعتمادات', icon: '📑' },
  { href: '/admin/hot', label: 'الفرص الساخنة', icon: '🔥', staff: true },
  { href: '/admin', label: 'لوحة التحكم', icon: '📊' },
]

// الشريط يُركَّب من جديد مع كل انتقال بين التبويبات، وكان الدور يبدأ فارغاً
// فتظهر التبويبات كلها لحظةً ثم تنكمش — فترى الموظفة شاشة المالك ترفّ أمامها
// عند كل ضغطة. والعلاج شقّان: لا يُرسم شيء قبل معرفة الدور، والدور يُحفظ في
// ذاكرة الجلسة فيُقرأ فوراً في المرات التالية بلا سؤال الخادم ولا رفّة.
const ROLE_KEY = 'murdi.nav.role'

export default function AdminNav() {
  const router = useRouter()
  const pathname = usePathname()
  const [pending, setPending] = useState(0)
  const [role, setRole] = useState<'admin' | 'staff' | ''>('')

  // من الجالس أمام الشاشة؟ الذاكرة أولاً (فورية)، ثم يُصدَّق من الخادم
  useEffect(() => {
    let alive = true
    try {
      const cached = sessionStorage.getItem(ROLE_KEY)
      if (cached === 'admin' || cached === 'staff') setRole(cached)
    } catch { /* متصفح يمنع التخزين — يُسأل الخادم فقط */ }

    fetch('/api/admin/whoami')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!alive || !d?.role) return
        if (d.role === 'admin' || d.role === 'staff') {
          setRole(d.role)
          try { sessionStorage.setItem(ROLE_KEY, d.role) } catch {}
        }
      })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  // عدد ما ينتظر تعميده يظهر على التبويب نفسه — فيراه قبل أن يفتح
  useEffect(() => {
    let alive = true
    fetch('/api/admin/inbox?status=pending')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (alive && d) setPending(Number(d.pending) || 0) })
      .catch(() => {})
    return () => { alive = false }
  }, [pathname])

  const visible = role === 'staff' ? LINKS.filter(l => l.staff === true) : LINKS

  // قبل أن يُعرف الدور لا تُرسم تبويبة واحدة — يُحجز مكان الشريط فقط
  // حتى لا تقفز الصفحة. رسمُ الكلّ ثم إخفاؤه هو عين الخلل الذي نعالجه.
  if (!role) {
    return (
      <div
        aria-hidden
        style={{
          minHeight: 38,
          marginBottom: 20,
          paddingBottom: 12,
          borderBottom: '1px solid #EAF2EE',
        }}
      />
    )
  }

  return (
    <nav
      dir="rtl"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: 20,
        paddingBottom: 12,
        borderBottom: '1px solid #EAF2EE',
        fontFamily: 'Cairo,sans-serif',
      }}
    >
      {visible.map((l) => {
        // «/admin» تطابق تامّ فقط، وإلا صارت كل صفحات الإدارة نشطة معاً
        const active = l.href === '/admin'
          ? pathname === '/admin'
          : (pathname || '').startsWith(l.href)
        const show = l.badge && pending > 0
        return (
          <button
            key={l.href}
            type="button"
            onClick={() => { if (!active) router.push(l.href) }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '8px 13px',
              borderRadius: 999,
              cursor: active ? 'default' : 'pointer',
              fontFamily: 'Cairo,sans-serif',
              fontSize: 12.5,
              fontWeight: active ? 900 : 700,
              lineHeight: 1.6,
              whiteSpace: 'nowrap',
              transition: 'background .15s ease, color .15s ease, border-color .15s ease',
              background: active ? '#1A3D34' : '#fff',
              color: active ? '#fff' : '#5E7C73',
              border: '1px solid ' + (active ? '#1A3D34' : '#E4EFEA'),
              boxShadow: active ? '0 1px 3px rgba(26,61,52,.18)' : 'none',
            }}
          >
            <span style={{ fontSize: 12.5, opacity: active ? 1 : .75 }}>{l.icon}</span>
            <span>{l.label}</span>
            {show && (
              <span style={{
                background: active ? '#C9A84C' : '#B4622A',
                color: '#fff',
                borderRadius: 999,
                minWidth: 18,
                height: 18,
                lineHeight: '18px',
                textAlign: 'center',
                fontSize: 10.5,
                fontWeight: 900,
                padding: '0 5px',
              }}>{pending}</span>
            )}
          </button>
        )
      })}
    </nav>
  )
}
