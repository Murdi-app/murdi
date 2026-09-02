'use client'
import { useEffect, useState } from 'react'

// زرّ تفعيل إشعارات الجوال.
//
// الإذن لا يُطلب إلا بنقرة من صاحبه: المتصفحات ترفض طلباً يخرج تلقائياً عند
// فتح الصفحة، وتحجب الموقع بعدها. فالزرّ هو الباب الوحيد.
//
// وعلى آيفون لا تعمل إشعارات الويب إلا إذا أُضيف الموقع إلى الشاشة الرئيسية
// أولاً — وهذا لا يُقال بعد الفشل، بل قبله، وإلا ظنّ صاحبه أن المنصة معطوبة.

const b64ToU8 = (s: string) => {
  const pad = '='.repeat((4 - (s.length % 4)) % 4)
  const b = (s + pad).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

type State = 'checking' | 'unsupported' | 'ios-needs-install' | 'off' | 'on' | 'blocked' | 'working'

export default function PushToggle() {
  const [state, setState] = useState<State>('checking')
  const [note, setNote] = useState('')

  useEffect(() => { void detect() }, [])

  async function detect() {
    if (typeof window === 'undefined') return
    const isStandalone =
      window.matchMedia?.('(display-mode: standalone)')?.matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)

    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      // آيفون خارج الشاشة الرئيسية لا يملك PushManager أصلاً — والسبب معروف
      setState(isIOS && !isStandalone ? 'ios-needs-install' : 'unsupported')
      return
    }
    if (Notification.permission === 'denied') { setState('blocked'); return }

    try {
      const reg = await navigator.serviceWorker.getRegistration()
      const sub = await reg?.pushManager.getSubscription()
      setState(sub ? 'on' : 'off')
    } catch { setState('off') }
  }

  async function enable() {
    setState('working'); setNote('')
    try {
      const res = await fetch('/api/push/subscribe')
      const { publicKey } = await res.json()
      if (!publicKey) { setNote('مفاتيح الإشعار غير مهيأة على الخادم'); setState('off'); return }

      const perm = await Notification.requestPermission()
      if (perm !== 'granted') { setState(perm === 'denied' ? 'blocked' : 'off'); return }

      const reg = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: b64ToU8(publicKey) as unknown as BufferSource,
      })

      const j = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
      const r = await fetch('/api/push/subscribe', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: j.endpoint, keys: j.keys, label: navigator.userAgent.slice(0, 70) }),
      })
      if (!r.ok) { setNote('تعذّر حفظ الاشتراك — أعد المحاولة'); setState('off'); return }
      setState('on'); setNote('وصلك إشعار تجربة الآن.')
    } catch (e) {
      setNote('تعذّر التفعيل: ' + String((e as Error)?.message || ''))
      setState('off')
    }
  }

  async function disable() {
    setState('working')
    try {
      const reg = await navigator.serviceWorker.getRegistration()
      const sub = await reg?.pushManager.getSubscription()
      if (sub) {
        await fetch('/api/push/subscribe', {
          method: 'DELETE', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
        await sub.unsubscribe()
      }
      setState('off'); setNote('')
    } catch { setState('on') }
  }

  const box = (bg: string, border: string, children: React.ReactNode) => (
    <div style={{ background: bg, border: '1.5px solid ' + border, borderRadius: 14, padding: '14px 18px', marginBottom: 20 }}>
      {children}
    </div>
  )

  if (state === 'checking') return null

  if (state === 'ios-needs-install') return box('#F7FBF9', '#DCEAE4', (
    <div style={{ color: '#1A3D34', fontSize: 13.5, fontWeight: 700, lineHeight: 1.95 }}>
      <b>لاستقبال الإشعارات على الآيفون:</b> افتح murdi.sa في سفاري ← زر المشاركة ↑ ← «إضافة إلى الشاشة الرئيسية»،
      ثم افتح المنصة من الأيقونة وفعّل الإشعارات من هنا. هذا شرط آبل لا شرطنا.
    </div>
  ))

  if (state === 'unsupported') return box('#F7FBF9', '#DCEAE4', (
    <div style={{ color: '#6B8A80', fontSize: 13, fontWeight: 700 }}>
      هذا المتصفح لا يدعم إشعارات الويب. جرّب كروم أو سفاري.
    </div>
  ))

  if (state === 'blocked') return box('#FBEEEC', '#F0D6D2', (
    <div style={{ color: '#8A3B33', fontSize: 13.5, fontWeight: 700, lineHeight: 1.9 }}>
      الإشعارات <b>محجوبة</b> لهذا الموقع في إعدادات متصفحك. افتح إعدادات الموقع واسمح بالإشعارات، ثم أعد تحميل الصفحة.
    </div>
  ))

  if (state === 'on') return box('#EAF6F1', '#BFE0D3', (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <div style={{ color: '#1A5C46', fontSize: 13.5, fontWeight: 800, lineHeight: 1.9 }}>
        ✓ إشعارات هذا الجهاز مفعّلة — يصلك كل تسجيل وكل تقييم في لحظته.
        {note && <div style={{ color: '#6B8A80', fontSize: 12.5, fontWeight: 700 }}>{note}</div>}
      </div>
      <button onClick={disable}
        style={{ background: 'transparent', color: '#8A6D1F', border: '1px solid #E0D2A8', padding: '8px 16px', borderRadius: 999, fontFamily: 'Cairo', fontWeight: 800, fontSize: 12.5, cursor: 'pointer' }}>
        أوقفها على هذا الجهاز
      </button>
    </div>
  ))

  return box('#FBF5E8', '#E8D9AE', (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <div style={{ color: '#8A6D1F', fontSize: 13.5, fontWeight: 800, lineHeight: 1.9 }}>
        فعّل إشعارات الجوال — يصلك كل عميل جديد في لحظته، لا في ملخّص الغد.
        {note && <div style={{ color: '#B4453C', fontSize: 12.5, fontWeight: 700 }}>{note}</div>}
      </div>
      <button onClick={enable} disabled={state === 'working'}
        style={{ background: '#1A3D34', color: '#fff', border: 'none', padding: '11px 24px', borderRadius: 999, fontFamily: 'Cairo', fontWeight: 900, fontSize: 13.5, cursor: 'pointer' }}>
        {state === 'working' ? 'جارٍ…' : 'فعّل الإشعارات على هذا الجهاز'}
      </button>
    </div>
  ))
}
