'use client'
import { useCallback, useEffect, useState } from 'react'
import AdminNav from '@/components/AdminNav'

// الاستشارات التي تنتظر اعتماد الدكتور — لا تصل الموظفة قبل اعتمادها
type Row = { id: string; full_name: string | null; company_name: string | null; ask_reply: string | null; consult_error: string | null; consult_code: string | null; consult_sent_at: string | null; has_draft: boolean; consult_at: string | null }
const G = '#1A3D34', SOFT = '#5E7C73', LINE = '#E4EFEA'
const btn = (p: boolean): React.CSSProperties => ({ background: p ? G : '#fff', color: p ? '#fff' : G, border: '1px solid ' + (p ? G : LINE), borderRadius: 999, padding: '8px 16px', fontFamily: 'Cairo', fontWeight: 800, fontSize: 13, cursor: 'pointer', textDecoration: 'none', display: 'inline-block' })

export default function ConsultsPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [err, setErr] = useState('')
  const load = useCallback(async () => {
    const j = await fetch('/api/admin/consults', { cache: 'no-store' }).then(r => r.json()).catch(() => null)
    if (!j || j.error) { setErr(j?.error || 'تعذّر التحميل'); return }
    setRows(j.rows || [])
  }, [])
  useEffect(() => { load() }, [load])
  return (
    <div dir="rtl" style={{ fontFamily: 'Cairo,sans-serif', color: G, background: '#F7FBF9', minHeight: '100vh' }}>
      <AdminNav />
      <div style={{ maxWidth: 820, margin: '0 auto', padding: '18px 16px 60px' }}>
        <h1 style={{ fontSize: 21, fontWeight: 900, margin: '0 0 4px' }}>استشارات تنتظر اعتمادك</h1>
        <p style={{ fontSize: 13, color: SOFT, margin: '0 0 16px', lineHeight: 1.9 }}>
          هذه لم تصل الموظفة بعد. افتح الاستشارة، ثم <b>اعتمدها</b> فتظهر عندها للإرسال، أو اكتب ملاحظتك و<b>أعد كتابتها</b> فتُكتب من جديد على ملاحظتك خلال ١٠ دقائق.
        </p>
        {err && <p style={{ color: '#B4453C', fontWeight: 800 }}>{err}</p>}
        {rows.length === 0 && !err && <p style={{ color: SOFT }}>لا شيء ينتظرك الآن ✓</p>}
        <div style={{ display: 'grid', gap: 12 }}>{rows.map(r => <Card key={r.id} r={r} reload={load} />)}</div>
      </div>
    </div>
  )
}

function Card({ r, reload }: { r: Row; reload: () => void }) {
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const act = async (action: 'approve' | 'rewrite') => {
    setBusy(true); setMsg('')
    const res = await fetch('/api/admin/consults', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: r.id, action, note }) })
    const j = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setMsg(j.error || 'لم يُحفظ'); return }
    reload()
  }
  return (
    <div style={{ background: '#fff', border: '1px solid ' + LINE, borderRadius: 14, padding: '14px 16px' }}>
      <b style={{ fontSize: 15.5 }}>{r.company_name || r.full_name}</b>{r.company_name && r.full_name ? <span style={{ color: SOFT, fontSize: 12.5 }}> · {r.full_name}</span> : null}
      {r.consult_sent_at && <div style={{ fontSize: 12, color: '#8A6D1F', fontWeight: 800, marginTop: 4 }}>نسخة مصحّحة لاستشارةٍ وصلته — اعتمادها يستبدل ما في رابطه</div>}
      <div style={{ fontSize: 12.5, background: '#FBF8F0', borderRadius: 8, padding: '8px 11px', marginTop: 8, lineHeight: 1.9 }}><b>لماذا حُجزت:</b> {r.consult_error || '—'}</div>
      {r.ask_reply && <details style={{ marginTop: 8, fontSize: 12.5 }}><summary style={{ cursor: 'pointer', color: SOFT, fontWeight: 800 }}>ردّ العميل</summary><div style={{ whiteSpace: 'pre-wrap', marginTop: 6, lineHeight: 1.9 }}>{r.ask_reply}</div></details>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
        {r.consult_code && <a href={'/r/' + r.consult_code + (r.has_draft ? '?draft=1' : '')} target="_blank" rel="noreferrer" style={btn(false)}>افتح الاستشارة</a>}
        <button disabled={busy} onClick={() => act('approve')} style={btn(true)}>✅ اعتمدها</button>
      </div>
      <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="ملاحظتك لإعادة كتابتها (مثال: ركّز على الشراكة مع مستثمر، ولا تذكر التمويل القائم)" style={{ width: '100%', boxSizing: 'border-box', marginTop: 10, border: '1px solid ' + LINE, borderRadius: 8, padding: '8px 10px', fontFamily: 'Cairo', fontSize: 13 }} />
      <button disabled={busy || !note.trim()} onClick={() => act('rewrite')} style={{ ...btn(false), marginTop: 6 }}>✍️ أعد كتابتها بملاحظتي</button>
      {msg && <div style={{ color: '#B4453C', fontSize: 12, fontWeight: 800, marginTop: 6 }}>{msg}</div>}
    </div>
  )
}
