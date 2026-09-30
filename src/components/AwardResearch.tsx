'use client'
import { useEffect, useState } from 'react'

// «ابحثي عن رقم» — شركاتٌ فازت بعقود ولا رقم منشوراً لها على الإنترنت المفتوح.
// ضي تبحث من حساباتها (مقاول · اعتماد · خرائط Google) وتضع الرقم ورابط صفحته،
// فيذهب توصيةً للمراجعة — ولا يصل الاتصال إليها إلا بعد قبوله.

type R = { id: string; company: string | null; buyer: string | null; title: string | null }
const SOURCES = ['مقاول (هيئة المقاولين)', 'اعتماد', 'خرائط Google', 'موقع الشركة', 'حساب الشركة الرسمي', 'دليل الغرفة التجارية']
const G = '#1A3D34'

export default function AwardResearch() {
  const [rows, setRows] = useState<R[]>([])
  const [f, setF] = useState<Record<string, { phone?: string; url?: string; source?: string }>>({})
  const [msg, setMsg] = useState<Record<string, string>>({})
  const [open, setOpen] = useState(false)
  useEffect(() => {
    fetch('/api/staff/award-tasks').then(r => r.json()).then(d => setRows(d.research || [])).catch(() => null)
  }, [])
  if (!rows.length) return null
  const set = (id: string, k: 'phone' | 'url' | 'source', v: string) => setF({ ...f, [id]: { ...(f[id] || {}), [k]: v } })
  const send = async (r: R) => {
    const v = f[r.id] || {}
    const res = await fetch('/api/staff/award-tasks', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: r.id, action: 'found', phone: v.phone, source_url: v.url, source: v.source || SOURCES[0] }),
    }).catch(() => null)
    const d = res ? await res.json().catch(() => ({})) : {}
    if (!res || !res.ok) { setMsg({ ...msg, [r.id]: d.error || 'لم يُرسل' }); return }
    setRows(rows.filter(x => x.id !== r.id))
  }
  const inp = { border: '1px solid #DDE7E2', borderRadius: 8, padding: '6px 10px', fontFamily: 'inherit', fontSize: 13 } as const
  return (
    <div style={{ background: '#F6FAF8', border: '1.5px solid #D5E6DE', borderRadius: 16, padding: '12px 16px', marginBottom: 16 }}>
      <div onClick={() => setOpen(!open)} style={{ cursor: 'pointer', fontWeight: 900, color: G, fontSize: 15 }}>
        🔎 ابحثي عن رقم ({rows.length.toLocaleString('ar-SA')}) <span style={{ fontWeight: 400, fontSize: 12.5, color: '#6B8A80' }}>{open ? 'طيّ' : 'عرض'}</span>
      </div>
      {open && (
        <>
          <p style={{ fontSize: 12.5, color: '#6B8A80', lineHeight: 1.9, margin: '6px 0 10px' }}>
            شركاتٌ فازت بعقد ولا رقم لها على الإنترنت. ابحثي في «مقاول» أو «اعتماد» أو خرائط Google، وضعي الرقم ورابط الصفحة التي ظهر فيها.
            لا تتصلي الآن — يُراجَع الرقم ثم تظهر الشركة في مهام الترسيات.
          </p>
          {rows.map(r => (
            <div key={r.id} style={{ background: '#fff', border: '1px solid #E1EDE8', borderRadius: 12, padding: 12, marginBottom: 8 }}>
              <div style={{ fontWeight: 800, color: G }}>{r.company}</div>
              <div style={{ fontSize: 12.5, color: '#6B8A80', marginBottom: 8 }}>{[r.title, r.buyer].filter(Boolean).join(' — ')}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <input placeholder="الرقم" dir="ltr" value={f[r.id]?.phone || ''} onChange={e => set(r.id, 'phone', e.target.value)} style={{ ...inp, width: 130 }} />
                <select value={f[r.id]?.source || SOURCES[0]} onChange={e => set(r.id, 'source', e.target.value)} style={inp}>
                  {SOURCES.map(s => <option key={s}>{s}</option>)}
                </select>
                <input placeholder="رابط الصفحة" dir="ltr" value={f[r.id]?.url || ''} onChange={e => set(r.id, 'url', e.target.value)} style={{ ...inp, flex: 1, minWidth: 180 }} />
                <button onClick={() => send(r)} style={{ background: G, color: '#fff', border: 0, borderRadius: 8, padding: '6px 16px', fontFamily: 'inherit', fontWeight: 700, cursor: 'pointer' }}>أرسليه للمراجعة</button>
              </div>
              {msg[r.id] && <div style={{ color: '#B4622A', fontSize: 12.5, marginTop: 6 }}>{msg[r.id]}</div>}
            </div>
          ))}
        </>
      )}
    </div>
  )
}
