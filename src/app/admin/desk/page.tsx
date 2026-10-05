'use client'
import { useEffect, useState } from 'react'
import AdminNav from '@/components/AdminNav'
import { waLink } from '@/lib/phone'
import { OPEN_PAID_STATUSES } from '@/lib/serviceStatus'

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
  created_at: string; updated_at: string | null; paid_at: string | null; company: Co | null
  price: number | null
  payment: { id: string; amount_sar: number | null; method: string | null; receipt_url: string | null; created_at: string } | null
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

type FileInfo = { events: { title: string; detail: string | null; actor: string | null; created_at: string }[]; has_financials: boolean; matches: number }
// الخدمات التي مخرَجها جدول جهات — نسخة مطابقة لما في run-match
const MATCH_BEARING = ['تجهيز ملف التمويل والتفاوض', 'دراسة الجدوى الاقتصادية', 'تمويل العقد', 'ملف الممر الأجنبي', 'تجهيز ملف عرض المستثمر والتفاوض']

export default function DeskPage() {
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState('')
  const [reqs, setReqs] = useState<Req[]>([])
  const [matches, setMatches] = useState<MatchReq[]>([])
  const [busy, setBusy] = useState('')
  const [err, setErr] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showAll, setShowAll] = useState(false)
  // ★ مَن يقرّر في هذا المكتب يقوله **الخادم** لا الشاشة (٢٧ سبتمبر).
  //   فالقرار — اعتماداً أو رفضاً أو تأكيد تحويل — واقعٌ على عميلٍ لم يدفع
  //   بعد، وذاك صفُّ ضي بقسمة المالك. ورغد تفتح المكتب لترى ملفّاتها
  //   المدفوعة وأرقام أصحابها، فلا تُعرض لها أزرارٌ سيردّها الخادم.
  const [mayDecide, setMayDecide] = useState(false)
  const [job, setJob] = useState('')
  const [files, setFiles] = useState<Record<string, FileInfo>>({})
  const [logF, setLogF] = useState<Record<string, { done?: string; missing?: string; next?: string; status?: string; milestone?: string; funder?: string; amount?: string; expected?: string }>>({})
  const [funding, setFunding] = useState<Record<string, { funder: string; approved: number; expected: string; booked: boolean }>>({})
  const [mRun, setMRun] = useState<Record<string, string>>({})

  const load = async () => {
    // انقطاع الشبكة كان يُبقي «جارٍ التحميل» إلى الأبد
    let r: Response
    try { r = await fetch('/api/staff/desk') }
    catch { setErr('تعذّر الاتصال بالخادم — أعيدي فتح الصفحة'); setLoading(false); return }
    if (!r.ok) {
      const d = await r.json().catch(() => ({}))
      setDenied(d.error || 'غير مصرح'); setLoading(false); return
    }
    const d = await r.json()
    setReqs(d.requests || []); setMatches(d.matches || [])
    setMayDecide(d.may_decide === true)
    setJob(String(d.job || '')); setFiles(d.files || {}); setFunding(d.funding || {})
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
    let r: Response
    try {
      r = await fetch('/api/staff/desk', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, id, action }),
      })
    } catch { setBusy(''); setErr('تعذّر الاتصال — لم يُنفَّذ القرار'); return }
    setBusy('')
    const d = await r.json().catch(() => ({}))
    if (!r.ok) { setErr(d.error || 'تعذّر تنفيذ القرار'); return }
    await load()
    // التحويل أُكّد، لكن شيئاً بعده لم يكتمل — يُقال ولا يُطوى مع الصف
    if (d.note) setErr('أُكّد التحويل — ' + d.note)
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

  // ★ المسعَّر آلياً صار ينتظر كلمتها أيضاً (٢١ سبتمبر): يُقبل بتأكيد
  //   التحويل حين يصل إيصاله، ويُرفض إن لم يكن جادّاً.
  const isWaiting = (s: string) => s === 'submitted' || s === 'priced'
  const waiting = reqs.filter(r => isWaiting(r.status))
  const rest = reqs.filter(r => !isWaiting(r.status))
  const shown = showAll ? rest : rest.slice(0, 12)

  // ★ ملفّات العميل الذي أتمّ اتفاقه — صفُّ مَن تتابع ما بعد الاتفاق (٢٧ سبتمبر).
  //
  //   وكانت هذه الصفوف تسقط في قائمة «البقية للعلم» مرتَّبةً بالأحدث ومقصوصةً
  //   عند اثني عشر — أي أن أقدمَ ملفٍّ واقف، وهو **أولى ما يُعمل**، يقع في
  //   الذيل أو خارج الشاشة أصلاً. فوقفت خمسةُ ملفّات بين ستة أيام وأربعين
  //   ولم يرها أحد. فصارت تُرفع إلى الرأس، **والأقدمُ سكوناً أولاً**.
  const ACTIVE: readonly string[] = OPEN_PAID_STATUSES
  // السكون من آخر حركةٍ حقيقية: تغيّرُ الطلب أو آخرُ أثرٍ في خطّ الصفقة — أيّهما أحدث
  const idleDays = (r: Req) => {
    const ev = files[String(r.company_id)]?.events?.[0]?.created_at
    const a = r.updated_at || r.created_at
    return daysAgo(ev && Date.parse(ev) > Date.parse(a) ? ev : a)
  }
  const active = reqs
    .filter(r => ACTIVE.includes(r.status))
    .sort((a, b) => idleDays(b) - idleDays(a))

  // «سجّلي ما تم» — يحرّك تاريخ الملف ويكتب أثره في خطّ الصفقة
  const saveLog = async (r: Req) => {
    const f = logF[r.id] || {}
    if (!f.done?.trim() && !f.milestone) { setErr('اكتبي ما تمّ على ملف ' + (r.company?.company_name || '')); return }
    if (f.milestone === 'approved' && (!f.funder?.trim() || !f.amount?.trim() || !f.expected)) { setErr('«وافقت الجهة» يحتاج: اسم الجهة، والمبلغ المعتمد، وموعد الصرف المتوقع'); return }
    setBusy(r.id); setErr('')
    const res = await fetch('/api/staff/desk', { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'log', id: r.id, done: f.done, missing: f.missing, next: f.next, status: f.status, milestone: f.milestone, funder: f.funder, amount: f.amount, expected: f.expected }) }).catch(() => null)
    setBusy('')
    const d = res ? await res.json().catch(() => ({})) : {}
    if (!res || !res.ok) { setErr(d.error || 'لم يُسجَّل'); return }
    setLogF({ ...logF, [r.id]: {} }); await load()
  }
  // تشغيل المطابقة لمن دفع خدمةً فيها جدول جهات — دفعةً بعد دفعة حتى تنتهي
  const runMatch = async (companyId: string) => {
    setMRun({ ...mRun, [companyId]: 'جارٍ التشغيل…' })
    let batch = 0, spend = true
    for (let i = 0; i < 40; i++) {
      const res = await fetch('/api/admin/run-match', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, track: 'funding', batch, spend }) }).catch(() => null)
      const d = res ? await res.json().catch(() => ({})) : {}
      if (!res || !res.ok) { setMRun(m => ({ ...m, [companyId]: d.error || 'تعذّر التشغيل' })); return }
      if (d.done) { setMRun(m => ({ ...m, [companyId]: 'انتهت — ' + (d.count || 0) + ' جهة مناسبة' })); await load(); return }
      batch = Number(d.next || batch + 1); spend = false
      setMRun(m => ({ ...m, [companyId]: 'جارٍ… ' + batch + (d.total ? ' من ' + d.total : '') }))
    }
  }
  const showFiles = job === 'assistant' || job === 'admin' || !mayDecide

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

      <h1 style={{ fontSize: 22, fontWeight: 900, color: '#1A3D34', margin: '0 0 4px' }}>
        {mayDecide ? 'مكتب الطلبات' : 'ملفّات العملاء'}
      </h1>
      <p style={{ fontSize: 13, color: '#6B8A80', margin: '0 0 22px', lineHeight: 1.9, maxWidth: 640 }}>
        {mayDecide
          ? 'ما ينتظر كلمتك أولاً، ثم بقية الطلبات للعلم. وكل اعتماد أو رفض يصل المكتب فوراً.'
          : 'ملفّات العملاء وأرقامهم — للاطلاع والاتصال. واعتمادُ الطلبات وتأكيد التحويلات ليس من عملك، فابدئي بالملفّات المدفوعة.'}
      </p>

      {err && (
        <div style={{ background: '#FBEEEC', color: '#C0564B', border: '1px solid #F0D6D1', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 14 }}>{err}</div>
      )}

      {/* ===== ملفّات العملاء الذين أتمّوا اتفاقهم — رأسُ شاشة مَن تتابع ===== */}
      {showFiles && (
        <>
          <h2 style={{ fontSize: 16, fontWeight: 900, color: '#1A3D34', margin: '0 0 2px' }}>
            ملفّات تنتظرك · {active.length}
          </h2>
          <p style={{ fontSize: 12.5, color: '#6B8A80', margin: '0 0 12px', lineHeight: 1.8 }}>
            هؤلاء أتمّوا اتفاقهم معنا، فهم أولى من كل شيء. الأقدمُ وقوفاً أولاً — اقرئي آخر ما سُجّل، وسجّلي ما تمّ عليه وما ينقصه. ولا تتصلي بصاحب الملف إلا حين يطلب توجيهك ذلك صراحةً، ولا تذكري له اسم جهةٍ لم يُعرض عليها ملفه ولا أي تفصيل من جانب الجهات.
          </p>
          {active.length === 0 && (
            <div style={{ ...CARD, color: '#8CA49B', fontSize: 13 }}>لا ملفّ واقفاً الآن.</div>
          )}
          {active.map(r => {
            const d = idleDays(r)
            const hot = d >= 7
            return (
              <div key={r.id} style={{ ...CARD, borderRight: '4px solid ' + (hot ? '#C0564B' : '#C9A84C') }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 220 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 900, color: '#1A3D34' }}>
                      {r.company?.company_name || 'منشأة بلا اسم'}
                    </div>
                    <div style={{ fontSize: 12, color: '#8CA49B', marginTop: 2 }}>
                      {r.service_title || 'خدمة'} · {statOf(r.status).t}
                    </div>
                  </div>
                  <span style={{
                    background: hot ? '#FBEEEC' : '#FBF5E8', color: hot ? '#C0564B' : '#9A7B2E',
                    borderRadius: 999, padding: '4px 12px', fontSize: 11.5, fontWeight: 900,
                  }}>
                    {d === 0 ? 'تحرّك اليوم' : 'واقف منذ ' + d + ' يوماً'}
                  </span>
                </div>
                <Contact c={r.company} />
                {(() => {
                  const fi = files[String(r.company_id)] || { events: [], has_financials: false, matches: 0 }
                  const f = logF[r.id] || {}
                  const inp = { border: '1px solid #DDE7E2', borderRadius: 8, padding: '7px 10px', fontFamily: 'inherit', fontSize: 13, width: '100%', boxSizing: 'border-box' as const }
                  return (
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed #E4EFEA' }}>
                      <div style={{ fontSize: 12.5, color: '#5E7C73', lineHeight: 1.9 }}>
                        <b style={{ color: '#1A3D34' }}>آخر ما سُجّل على الملف:</b>
                        {fi.events.length === 0 && <div style={{ color: '#B4622A' }}>لم يُسجَّل عليه شيء بعد — سجّلي أول ما تم أدناه.</div>}
                        {fi.events.map((e, i) => (
                          <div key={i}>· {fmt(e.created_at)} — {e.title}{e.detail ? ' (' + e.detail + ')' : ''}</div>
                        ))}
                        <div style={{ marginTop: 4 }}>
                          البيانات المالية: {fi.has_financials ? '✓ موجودة' : '✗ غير مدخلة — اطلبيها من العميل أولاً'}
                          {MATCH_BEARING.includes(String(r.service_title || '')) && <> · جهات مطابقة: {fi.matches ? fi.matches + ' جهة' : 'لم تُشغَّل بعد'}</>}
                        </div>
                      </div>
                      <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
                        {funding[r.id] && (
                          <div style={{ fontSize: 12.5, background: '#E9F5EF', color: '#1E7A5E', borderRadius: 8, padding: '6px 10px' }}>
                            ✓ وافقت {funding[r.id].funder} على {Number(funding[r.id].approved).toLocaleString('ar-SA')} ريال — الصرف المتوقع {funding[r.id].expected}{funding[r.id].booked ? ' · قُيِّد التمويل' : ''}
                          </div>
                        )}
                        <select value={f.milestone || ''} onChange={e => setLogF({ ...logF, [r.id]: { ...f, milestone: e.target.value } })} style={inp}>
                          <option value="">— مرحلة التمويل (اختياري) —</option>
                          <option value="approved">وافقت الجهة على التمويل</option>
                          {funding[r.id] && !funding[r.id].booked && <option value="booked">قُيِّد التمويل (صُرف للعميل)</option>}
                        </select>
                        {f.milestone === 'approved' && (
                          <div style={{ display: 'grid', gap: 6, gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))' }}>
                            <input placeholder="اسم الجهة *" value={f.funder || ''} onChange={e => setLogF({ ...logF, [r.id]: { ...f, funder: e.target.value } })} style={inp} />
                            <input placeholder="المبلغ المعتمد (ريال) *" inputMode="numeric" value={f.amount || ''} onChange={e => setLogF({ ...logF, [r.id]: { ...f, amount: e.target.value } })} style={inp} />
                            <label style={{ fontSize: 12, color: '#6B8A80' }}>موعد الصرف المتوقع *<input type="date" value={f.expected || ''} onChange={e => setLogF({ ...logF, [r.id]: { ...f, expected: e.target.value } })} style={inp} /></label>
                          </div>
                        )}
                        {f.milestone === 'booked' && (
                          <input placeholder={'المبلغ الذي صُرف فعلاً (اتركيه فارغاً إن كان ' + Number(funding[r.id]?.approved || 0).toLocaleString('ar-SA') + ')'} inputMode="numeric" value={f.amount || ''} onChange={e => setLogF({ ...logF, [r.id]: { ...f, amount: e.target.value } })} style={inp} />
                        )}
                        <textarea placeholder="ما الذي تمّ؟ (مثال: كلمت الجهة المُسندة — طلبوا قوائم سنتين، وبلّغت المكتب)" value={f.done || ''} onChange={e => setLogF({ ...logF, [r.id]: { ...f, done: e.target.value } })} rows={2} style={inp} />
                        <input placeholder="ما الذي ينقص الملف؟ (اختياري)" value={f.missing || ''} onChange={e => setLogF({ ...logF, [r.id]: { ...f, missing: e.target.value } })} style={inp} />
                        <input placeholder="الخطوة التالية وموعدها (اختياري)" value={f.next || ''} onChange={e => setLogF({ ...logF, [r.id]: { ...f, next: e.target.value } })} style={inp} />
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                          <select value={f.status || r.status} onChange={e => setLogF({ ...logF, [r.id]: { ...f, status: e.target.value } })} style={{ ...inp, width: 'auto' }}>
                            <option value="in_progress">قيد التجهيز (نجمع المستندات ونُعدّ الملف)</option>
                            <option value="in_follow_up">قيد المتابعة (الملف عند الجهات)</option>
                          </select>
                          <button disabled={busy === r.id} onClick={() => saveLog(r)} style={BTN('#1A3D34')}>سجّلي ما تم</button>
                          {MATCH_BEARING.includes(String(r.service_title || '')) && fi.has_financials && (
                            <button onClick={() => runMatch(String(r.company_id))} style={BTN('#fff', '#1A3D34')}>🎯 شغّلي المطابقة</button>
                          )}
                          {mRun[String(r.company_id)] && <span style={{ fontSize: 12.5, color: '#5E7C73' }}>{mRun[String(r.company_id)]}</span>}
                        </div>
                      </div>
                    </div>
                  )
                })()}
              </div>
            )
          })}
          <div style={{ height: 26 }} />
        </>
      )}

      {/* ===== طلبات المطابقة — صفُّ مَن تقرّر وحدها، فلا تُعرض لغيرها ===== */}
      {mayDecide && matches.length > 0 && (
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
                {mayDecide && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button disabled={busy === m.id} onClick={() => decide('match', m.id, 'approve')} style={BTN('#1A3D34')}>
                      {busy === m.id ? '…' : 'امنح'}
                    </button>
                    <button disabled={busy === m.id} onClick={() => decide('match', m.id, 'reject')} style={BTN('#fff', '#C0564B')}>
                      {confirm === 'match:' + m.id + ':reject' ? 'تأكيد الرفض' : 'ارفض'}
                    </button>
                  </div>
                )}
              </div>
              <Contact c={m.company} />
            </div>
          ))}
          <div style={{ height: 26 }} />
        </>
      )}

      {/* ===== طلبات خدمة تنتظر ===== */}
      <h2 style={{ fontSize: 16, fontWeight: 900, color: '#1A3D34', margin: '0 0 2px' }}>
        {mayDecide ? 'ينتظر كلمتك' : 'طلباتٌ لم تُدفع بعد'} · {waiting.length}
      </h2>
      <p style={{ fontSize: 12.5, color: '#6B8A80', margin: '0 0 12px', lineHeight: 1.8 }}>
        {mayDecide
          ? 'اعتمدي ما اكتملت بيانات صاحبه، واتصلي بمن نقصته بيانات قبل أن ترفضي — فالرفض يغلق باباً. والطلب المسعَّر يُقبل بتأكيد تحويله: افتحي الإيصال، وطابقي المبلغ، ثم أكّدي.'
          : 'هذه للعلم فقط — أصحابها لم يدفعوا بعد، ومتابعتهم ليست من عملك.'}
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
              {r.status === 'priced' && (
                <div style={{ marginTop: 8, fontSize: 12.5, lineHeight: 1.9, color: '#3E5C53' }}>
                  <span style={{ background: '#FBF3DC', color: '#B8860B', borderRadius: 999, padding: '3px 10px', fontWeight: 900, fontSize: 11.5 }}>
                    بانتظار الدفع{r.price ? ' · ' + Number(r.price).toLocaleString('en-US') + ' ريال' : ''}
                  </span>
                  {r.payment ? (
                    <span style={{ marginRight: 8 }}>
                      وصل تحويلٌ بـ<b>{Number(r.payment.amount_sar || 0).toLocaleString('en-US')} ريال</b>
                      {r.payment.receipt_url
                        ? <> · <a href={r.payment.receipt_url} target="_blank" rel="noreferrer" style={{ color: '#1A6B52', fontWeight: 800 }}>افتحي الإيصال</a></>
                        : ' · بلا إيصال مرفق — اطلبيه من العميل قبل التأكيد'}
                    </span>
                  ) : (
                    <span style={{ marginRight: 8, color: '#8CA49B' }}>لم يصل تحويلٌ بعد — اتصلي بالعميل وذكّريه بالدفع.</span>
                  )}
                </div>
              )}
            </div>
            {mayDecide && (
              <div style={{ display: 'flex', gap: 8 }}>
                {r.status === 'priced' ? (
                  <button disabled={busy === r.id || !r.payment} onClick={() => decide('service', r.id, 'approve')}
                    title={r.payment ? '' : 'يُقبل حين يصل التحويل'}
                    style={{ ...BTN('#1A3D34'), opacity: r.payment ? 1 : 0.4, cursor: r.payment ? 'pointer' : 'not-allowed' }}>
                    {busy === r.id ? '…' : 'أكّدي التحويل واقبلي'}
                  </button>
                ) : (
                  <button disabled={busy === r.id} onClick={() => decide('service', r.id, 'approve')} style={BTN('#1A3D34')}>
                    {busy === r.id ? '…' : 'اعتمدي'}
                  </button>
                )}
                <button disabled={busy === r.id} onClick={() => decide('service', r.id, 'reject')} style={BTN('#fff', '#C0564B')}>
                  {confirm === 'service:' + r.id + ':reject' ? 'تأكيد الرفض' : 'ارفضي'}
                </button>
              </div>
            )}
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
