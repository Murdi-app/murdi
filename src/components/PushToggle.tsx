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
type Device = { id: string; label: string | null; created_at: string; last_sent_at: string | null; last_error: string | null; failures: number | null }

const when = (d: string | null) => d
  ? new Date(d).toLocaleString('ar-SA', { timeZone: 'Asia/Riyadh', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  : 'لم يُرسل بعد'

export default function PushToggle() {
  const [state, setState] = useState<State>('checking')
  const [note, setNote] = useState('')
  const [devices, setDevices] = useState<Device[]>([])
  const [verdict, setVerdict] = useState('')
  const [testing, setTesting] = useState(false)

  // ★ الزرّ وحده لا يكفي: «مفعَّلة» في المتصفح لا تعني أن الإشعار يصل.
  //   فيُعرض ما يعرفه الخادم — كم جهازاً مسجَّلاً، ومتى آخر إرسالٍ إليه،
  //   وهل ردّ بخطأ — ومعه زرُّ تجربةٍ يفصل بين عطب المنصة وعطب الجهاز.
  async function test() {
    setTesting(true); setVerdict('')
    try {
      const r = await fetch('/api/push/subscribe', { method: 'PUT' })
      const d = await r.json()
      if (!r.ok) { setVerdict(d?.error || 'تعذّر الإرسال'); setTesting(false); return }
      setDevices(d.devices || [])
      const s = Number(d?.result?.sent || 0)
      const f = Number(d?.result?.failed || 0)
      const rm = Number(d?.result?.removed || 0)
      setVerdict(
        s > 0
          ? 'أرسله الخادم إلى ' + s + (s === 1 ? ' جهاز' : ' أجهزة') + ' بلا خطأ'
            + (rm ? ' · وحُذف ' + rm + ' اشتراكاً ميتاً' : '')
            + '. فإن لم يظهر على شاشتك فالإذن موقوف على الجهاز نفسه أو وضعُ التركيز يكتمه — لا المنصة.'
          : 'لم يخرج الإشعار: ' + String(d?.result?.reason || (f ? f + ' محاولة فاشلة' : 'لا أجهزة مسجَّلة'))
      )
    } catch { setVerdict('انقطع الاتصال بالخادم') }
    setTesting(false)
  }

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
      // ★ «مفعّلة» كانت تُقرأ من المتصفح وحده: يقول الجهاز إنه مشترك، والخادم
      //   يرسل إلى عنوانٍ آخر قديم — فتبدو الإشعارات مفعّلة ولا يصل شيء.
      //   فعند كل فتحٍ يُرسل الجهاز عنوانه الحالي إلى الخادم بصمت.
      if (sub) {
        const j = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
        await fetch('/api/push/subscribe', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: j.endpoint, keys: j.keys, label: navigator.userAgent.slice(0, 70), silent: true }),
        }).catch(() => {})
      }
      fetch('/api/push/subscribe').then(r => r.ok ? r.json() : null)
        .then(d => { if (d?.devices) setDevices(d.devices) }).catch(() => {})
    } catch { setState('off') }
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void detect() }, [])

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

  // ★ التجديد: آيفون قد يُبقي الاشتراك «حيّاً» عند آبل بعد تحديث النظام أو
  //   إعادة تثبيت التطبيق، فيُقبل الإرسال ولا يظهر شيء. العلاج اشتراكٌ جديد
  //   يحلّ محلّ القديم — وهذا الزرّ يفعله في ضغطة.
  async function renew() {
    setState('working'); setNote(''); setVerdict('')
    try {
      const res = await fetch('/api/push/subscribe')
      const { publicKey } = await res.json()
      if (!publicKey) { setNote('مفاتيح الإشعار غير مهيأة على الخادم'); setState('on'); return }
      const reg = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready
      const old = await reg.pushManager.getSubscription()
      const oldEndpoint = old?.endpoint || ''
      if (old) await old.unsubscribe()
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: b64ToU8(publicKey) as unknown as BufferSource,
      })
      const j = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
      const r = await fetch('/api/push/subscribe', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: j.endpoint, keys: j.keys, label: navigator.userAgent.slice(0, 70), replaces: oldEndpoint }),
      })
      if (!r.ok) { setNote('تعذّر حفظ الاشتراك الجديد — أعد المحاولة'); setState('off'); return }
      setState('on'); setNote('جُدّد الاشتراك — ووصلك إشعار تجربة الآن. إن لم يظهر فالإذن موقوف في إعدادات الجوال.')
      fetch('/api/push/subscribe').then(x => x.ok ? x.json() : null).then(d => { if (d?.devices) setDevices(d.devices) }).catch(() => {})
    } catch (e) {
      setNote('تعذّر التجديد: ' + String((e as Error)?.message || ''))
      setState('on')
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
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ color: '#1A5C46', fontSize: 13.5, fontWeight: 800, lineHeight: 1.9 }}>
          ✓ إشعارات هذا الجهاز مفعّلة — يصلك كل تسجيل وكل تقييم في لحظته.
          {note && <div style={{ color: '#6B8A80', fontSize: 12.5, fontWeight: 700 }}>{note}</div>}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={test} disabled={testing}
            style={{ background: '#1A3D34', color: '#fff', border: 'none', padding: '8px 18px', borderRadius: 999, fontFamily: 'Cairo', fontWeight: 900, fontSize: 12.5, cursor: 'pointer' }}>
            {testing ? 'جارٍ…' : 'جرّبها الآن'}
          </button>
          <button onClick={renew}
            style={{ background: '#fff', color: '#1A3D34', border: '1px solid #BFE0D3', padding: '8px 16px', borderRadius: 999, fontFamily: 'Cairo', fontWeight: 900, fontSize: 12.5, cursor: 'pointer' }}>
            جدّد الاشتراك
          </button>
          <button onClick={disable}
            style={{ background: 'transparent', color: '#8A6D1F', border: '1px solid #E0D2A8', padding: '8px 16px', borderRadius: 999, fontFamily: 'Cairo', fontWeight: 800, fontSize: 12.5, cursor: 'pointer' }}>
            أوقفها على هذا الجهاز
          </button>
        </div>
      </div>

      {verdict && (
        <div style={{ marginTop: 10, background: '#fff', border: '1px solid #CBE6DA', borderRadius: 10, padding: '9px 13px', color: '#1A3D34', fontSize: 12.5, fontWeight: 700, lineHeight: 1.95 }}>
          {verdict}
        </div>
      )}

      {devices.length > 0 && (
        <div style={{ marginTop: 10, fontSize: 12, color: '#5E7C73', lineHeight: 1.95 }}>
          <b style={{ color: '#1A5C46' }}>أجهزتك المسجَّلة ({devices.length}):</b>
          {devices.map(d => (
            <div key={d.id} style={{ marginTop: 3 }}>
              · {/iphone|ipad/i.test(d.label || '') ? 'آيفون' : /macintosh|windows/i.test(d.label || '') ? 'حاسوب' : 'جهاز'}
              {' — آخر إرسال: ' + when(d.last_sent_at)}
              {d.last_error ? <span style={{ color: '#B4453C', fontWeight: 800 }}>{' · خطأ: ' + d.last_error}</span> : ''}
            </div>
          ))}
        </div>
      )}
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
