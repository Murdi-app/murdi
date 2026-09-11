'use client'
import { useEffect, useState } from 'react'
import AdminNav from '@/components/AdminNav'
import { waLink } from '@/lib/phone'

// مكتب الطلبات — شاشة المساعِدة.
//
// ما فيها: كل طلب خدمة، وكل طلب مطابقة ينتظر، وبيانات صاحبه كاملة ليُتّصل به.
// وما ليس فيها — وهو الأهم: لا تسعير، ولا مُخرَجات مولَّدة، ولا عقود، ولا
// نسب أتعاب، ولا محادثة بحث. وليست مخفيّةً بل غير مُرسَلة: المسار
// `/api/staff/desk` يذكر أعمدته بأسمائها، فما سواها لا يغادر الخادم.
//
// وكل اعتماد أو رفض يصل المالك بريداً وإشعاراً لحظتَه.

type Co = {
  id: string; company_name: string | null; owner_name: string | null
  phone: string | null; city: string | null; sector: string | null
  account_status: string | null; contact_email: string | null
}
type Req = {
  id: string; company_id: string; service_title: string | null; service_category: string | null
  status: string; client_note: string | null; track: string | null
  created_at: string; paid_at: string | null; company: Co | null
}
type MatchReq = {
  id: string; company_id: string; track: string; status: string
  requested_at: string; company: Co | null
}

const STAT: Record<string, { t: string; bg: string; fg: string }> = {
  submitted: { t: 'ينتظر كلمتك', bg: '#FBF5E8', fg: '#9A7B2E' },
  in_progress: { t: 'معتمَد — عند المكتب', bg: '#EAF7F0', fg: '#1E7A5A' },
  priced: { t: 'بانتظار دفع العميل', bg: '#FBF3DC', fg: '#B8860B' },
  paid: { t: 'مدفوع — بانتظار التسليم', bg: '#E8F5EF', fg: '#1A7A4C' },
  delivered: { t: 'سُلّم للعميل', bg: '#EAF7F0', fg: '#1E7A5A' },
  in_follow_up: { t: 'قيد المتابعة مع الجهات', bg: '#EAF7F0', fg: '#9A7B2E' },
  completed: { t: 'مكتمل', bg: '#EAF7F0', fg: '#1E7A5A' },
  rejected: { t: 'مرفوض', bg: '#FBEEEC', fg: '#C0564B' },
  cancelled: { t: 'ملغى', bg: '#F2F5F4', fg: '#7E938C' },
}
const statOf = (s: string) => STAT[s] || { t: s || 'غير محددة', bg: '#F2F5F4', fg: '#7E938C' }

const fmt = (d: string | null) => d
  ? new Date(d).toLocaleString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  : '—'
const daysAgo = (d: string | null) =>
  d ? Math.floor((Date.now() - new Date(d).getTime()) / 86400000) : 0

const CARD: React.CSSProperties = {
  background: '#fff', border: '1px solid #E4EFEA', borderRadius: 14,
  padding: '16px 18px', marginBottom: 12,
}
const BTN = (bg: string, fg = '#fff'): React.CSSProperties => ({
  background: bg, color: fg, border: 'none', borderRadius: 9,
  padding: '9px 18px', fontFamily: 'Cairo,sans-serif', fontWeight: 800,
  fontSize: 12.5, cursor: 'pointer',
})

export default function DeskPage() {
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState('')
  const [reqs, setReqs] = useState<Req[]>([])
  const [matches, setMatches] = useState<MatchReq[]>([])
  const [busy, setBusy] = useState('')
  const [err, setErr] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showAll, setShowAll] = useState(false)

  const load = async () => {
    const r = await fetch('/api/staff/desk')
    if (!r.ok) {
      const d = await r.json().catch(() => ({}))
      setDenied(d.error || 'غير مصرح'); setLoading(false); return
    }
    const d = await r.json()
    setReqs(d.requests || []); setMatches(d.matches || [])
    setLoading(false)
  }
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load() }, [])

  // الرفض يُسأل عنه مرتين — والاعتماد مرة. فالرفض يغلق باباً على العميل،
  // والاعتماد يفتح عملاً على المكتب، وليسا سواءً في الرجوع عنهما.
  const decide = async (kind: 'service' | 'match', id: string, action: 'approve' | 'reject') => {
    const key = kind + ':' + id + ':' + action
    if (action === 'reject' && confirm !== key) {
      setConfirm(key)
      setTimeout(() => setConfirm(c => (c === key ? '' : c)), 5000)
      return
    }
    setBusy(id); setErr(''); setConfirm('')
    const r = await fetch('/api/staff/desk', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, id, action }),
    })
    setBusy('')
    if (!r.ok) { const d = await r.json().catch(() => ({})); setErr(d.error || 'تعذّر تنفيذ القرار'); return }
    await load()
  }

  const Contact = ({ c }: { c: Co | null }) => {
    if (!c) return null
    const wa = waLink(c.phone, 'السلام عليكم ورحمة الله\n\nمعك مكتب مُرضي بخصوص طلبك في المنصة.')
    return (
      <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed #E4EFEA', fontSize: 12.5, color: '#5E7C73', lineHeight: 2 }}>
        <div>
          <b style={{ color: '#1A3D34' }}>{c.company_name || 'منشأة بلا اسم'}</b>
          {c.owner_name ? ' · ' + c.owner_name : ''}
          {c.city ? ' · ' + c.city : ''}
          {c.sector ? ' · ' + c.sector : ''}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 4 }}>
          {c.phone && <a href={'tel:' + c.phone} style={{ color: '#1A3D34', fontWeight: 800, textDecoration: 'none', direction: 'ltr' }}>{c.phone}</a>}
          {wa && <a href={wa} target="_blank" rel="noreferrer" style={{ ...BTN('#2E9E7B'), textDecoration: 'none', padding: '5px 12px', fontSize: 11.5 }}>واتساب</a>}
          {c.contact_email && <a href={'mailto:' + c.contact_email} style={{ color: '#5E7C73', direction: 'ltr' }}>{c.contact_email}</a>}
        </div>
      </div>
    )
  }

  const waiting = reqs.filter(r => r.status === 'submitted')
  const rest = reqs.filter(r => r.status !== 'submitted')
  const shown = showAll ? rest : rest.slice(0, 12)

  if (loading) return (
    <div dir="rtl" style={{ padding: 40, fontFamily: 'Tajawal,sans-serif', color: '#6B8A80' }}>جارٍ التحميل…</div>
  )
  if (denied) return (
    <div dir="rtl" style={{ padding: 40, fontFamily: 'Tajawal,sans-serif', color: '#1A3D34' }}>
      <AdminNav />
      <div style={{ fontSize: 18, fontWeight: 900 }}>{denied}</div>
    </div>
  )

  return (
    <div dir="rtl" style={{ padding: '20px 18px 60px', fontFamily: 'Tajawal,sans-serif', background: '#FBFCFB', minHeight: '100vh' }}>
      <AdminNav />

      <h1 style={{ fontSize: 22, fontWeight: 900, color: '#1A3D34', margin: '0 0 4px' }}>مكتب الطلبات</h1>
      <p style={{ fontSize: 13, color: '#6B8A80', margin: '0 0 22px', lineHeight: 1.9, maxWidth: 640 }}>
        ما ينتظر كلمتك أولاً، ثم بقية الطلبات للعلم. وكل اعتماد أو رفض يصل المكتب فوراً.
      </p>

      {err && (
        <div style={{ background: '#FBEEEC', color: '#C0564B', border: '1px solid #F0D6D1', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 14 }}>{err}</div>
      )}

      {/* ===== طلبات المطابقة ===== */}
      {matches.length > 0 && (
        <>
          <h2 style={{ fontSize: 16, fontWeight: 900, color: '#1A3D34', margin: '0 0 2px' }}>
            طلبات المطابقة · {matches.length}
          </h2>
          <p style={{ fontSize: 12.5, color: '#6B8A80', margin: '0 0 12px', lineHeight: 1.8 }}>
            العميل طلب أن نبحث له عن جهات. لا تعمل المطابقة حتى تُمنح — فامنحها لمن اكتمل ملفه.
          </p>
          {matches.map(m => (
            <div key={m.id} style={CARD}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 14.5, fontWeight: 900, color: '#1A3D34' }}>
                    مطابقة {m.track === 'investment' ? 'جهات الاستثمار' : 'جهات التمويل'}
                  </div>
                  <div style={{ fontSize: 12, color: '#8CA49B', marginTop: 2 }}>
                    طُلبت {fmt(m.requested_at)} · منذ {daysAgo(m.requested_at)} يوماً
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button disabled={busy === m.id} onClick={() => decide('match', m.id, 'approve')} style={BTN('#1A3D34')}>
                    {busy === m.id ? '…' : 'امنح'}
                  </button>
                  <button disabled={busy === m.id} onClick={() => decide('match', m.id, 'reject')} style={BTN('#fff', '#C0564B')}>
                    {confirm === 'match:' + m.id + ':reject' ? 'تأكيد الرفض' : 'ارفض'}
                  </button>
                </div>
              </div>
              <Contact c={m.company} />
            </div>
          ))}
          <div style={{ height: 26 }} />
        </>
      )}

      {/* ===== طلبات خدمة تنتظر ===== */}
      <h2 style={{ fontSize: 16, fontWeight: 900, color: '#1A3D34', margin: '0 0 2px' }}>
        ينتظر كلمتك · {waiting.length}
      </h2>
      <p style={{ fontSize: 12.5, color: '#6B8A80', margin: '0 0 12px', lineHeight: 1.8 }}>
        اعتمدي ما اكتملت بيانات صاحبه، واتصلي بمن نقصته بيانات قبل أن ترفضي — فالرفض يغلق باباً.
      </p>
      {waiting.length === 0 && (
        <div style={{ ...CARD, color: '#8CA49B', fontSize: 13 }}>لا شيء ينتظر. وهذا خبر جيد.</div>
      )}
      {waiting.map(r => (
        <div key={r.id} style={CARD}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ minWidth: 220 }}>
              <div style={{ fontSize: 14.5, fontWeight: 900, color: '#1A3D34' }}>{r.service_title || 'خدمة بلا عنوان'}</div>
              <div style={{ fontSize: 12, color: '#8CA49B', marginTop: 2 }}>
                {r.service_category || 'خدمة'} · وصل {fmt(r.created_at)}
                {daysAgo(r.created_at) >= 2 ? ' · منذ ' + daysAgo(r.created_at) + ' يوماً' : ''}
              </div>
              {r.client_note && (
                <div style={{ marginTop: 8, background: '#F7FBF9', borderRadius: 8, padding: '9px 12px', fontSize: 12.5, color: '#3E5C53', lineHeight: 1.9, whiteSpace: 'pre-wrap' }}>
                  {r.client_note}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button disabled={busy === r.id} onClick={() => decide('service', r.id, 'approve')} style={BTN('#1A3D34')}>
                {busy === r.id ? '…' : 'اعتمدي'}
              </button>
              <button disabled={busy === r.id} onClick={() => decide('service', r.id, 'reject')} style={BTN('#fff', '#C0564B')}>
                {confirm === 'service:' + r.id + ':reject' ? 'تأكيد الرفض' : 'ارفضي'}
              </button>
            </div>
          </div>
          <Contact c={r.company} />
        </div>
      ))}

      {/* ===== البقية للعلم ===== */}
      <div style={{ height: 26 }} />
      <h2 style={{ fontSize: 16, fontWeight: 900, color: '#1A3D34', margin: '0 0 2px' }}>
        بقية الطلبات · {rest.length}
      </h2>
      <p style={{ fontSize: 12.5, color: '#6B8A80', margin: '0 0 12px', lineHeight: 1.8 }}>
        للعلم والمتابعة — تعرفين أين وصل كل طلب فتُجيبين العميل إن سأل.
      </p>
      {shown.map(r => {
        const s = statOf(r.status)
        return (
          <div key={r.id} style={{ ...CARD, padding: '13px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div>
                <span style={{ fontSize: 13.5, fontWeight: 800, color: '#1A3D34' }}>{r.service_title || 'خدمة'}</span>
                <span style={{ fontSize: 12, color: '#8CA49B' }}>
                  {r.company?.company_name ? ' · ' + r.company.company_name : ''}
                </span>
              </div>
              <span style={{ background: s.bg, color: s.fg, borderRadius: 999, padding: '4px 12px', fontSize: 11.5, fontWeight: 900 }}>{s.t}</span>
            </div>
            <Contact c={r.company} />
          </div>
        )
      })}
      {!showAll && rest.length > shown.length && (
        <button onClick={() => setShowAll(true)} style={{ ...BTN('#fff', '#1A3D34'), border: '1px solid #E4EFEA' }}>
          اعرضي الباقي ({rest.length - shown.length})
        </button>
      )}
    </div>
  )
}
