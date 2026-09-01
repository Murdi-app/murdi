'use client'
import { useEffect, useState } from 'react'

// شاشة مراسلة العملاء.
// الفكرة: الموظفة لا تكتب رسالة من الصفر ولا تنتظر أحداً. تختار العميل،
// تختار الحالة التي هي فيها، فتُملأ الرسالة باسمه واسم منشأته وتخرج.
// وإن احتاجت كلاماً خارج القوالب كتبته، ووقف عند المالك — لأن هناك
// يُقال الرقم ويُعطى الوعد.

type Tpl = { key: string; label: string; when: string }
type Co = { company_id: string; company_name: string; owner_name: string | null; phone: string | null; contact_email: string | null }
type Msg = {
  id: string; company_id: string | null; to_name: string | null; to_email: string
  subject: string; body: string; status: string; created_by_name: string | null
  sent_at: string | null; error_note: string | null; created_at: string
}

const C = { ink: '#1A3D34', soft: '#5E7C73', line: '#E4EFEA', bg: '#F7FBF9', gold: '#C9A84C', red: '#B4622A', green: '#1A6B55' }

const box: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid ' + C.line,
  fontFamily: 'Cairo,sans-serif', fontSize: 13, color: C.ink, background: '#fff', boxSizing: 'border-box',
}
const label: React.CSSProperties = { fontSize: 11.5, fontWeight: 800, color: C.soft, display: 'block', marginBottom: 5 }

export default function MessagePage() {
  const [role, setRole] = useState('')
  const [tpls, setTpls] = useState<Tpl[]>([])
  const [cos, setCos] = useState<Co[]>([])
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [companyId, setCompanyId] = useState('')
  const [toName, setToName] = useState('')
  const [toEmail, setToEmail] = useState('')
  const [tplKey, setTplKey] = useState('intro')
  const [free, setFree] = useState(false)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')

  const load = () => {
    fetch('/api/admin/message')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return
        setRole(d.role || ''); setTpls(d.templates || [])
        setCos(d.companies || []); setMsgs(d.messages || [])
      })
      .catch(() => {})
  }
  useEffect(load, [])

  // اختيار العميل يملأ اسمه وبريده — لا تُكتب البيانات يدوياً فتُخطئ
  const pick = (id: string) => {
    setCompanyId(id)
    const c = cos.find(x => x.company_id === id)
    if (c) { setToName(c.owner_name || ''); setToEmail(c.contact_email || '') }
  }

  const send = async () => {
    setBusy(true); setNote('')
    const payload: Record<string, unknown> = { company_id: companyId || null, to_name: toName, to_email: toEmail }
    if (free) { payload.subject = subject; payload.body = body } else { payload.template_key = tplKey }
    try {
      const r = await fetch('/api/admin/message', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      const d = await r.json()
      if (!r.ok) setNote('✕ ' + (d?.error || 'تعذّر الإرسال'))
      else if (d.queued) setNote('⏳ حُفظت وتنتظر اعتماد المالك')
      else { setNote('✓ أُرسلت'); setSubject(''); setBody('') }
      load()
    } catch { setNote('✕ تعذّر الاتصال') }
    setBusy(false)
  }

  const act = async (id: string, action: 'approve' | 'reject') => {
    setBusy(true)
    try {
      const r = await fetch('/api/admin/message', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action }),
      })
      const d = await r.json()
      setNote(r.ok ? (action === 'approve' ? '✓ اعتُمدت وأُرسلت' : 'أُلغيت') : '✕ ' + (d?.error || ''))
      load()
    } catch { setNote('✕ تعذّر الاتصال') }
    setBusy(false)
  }

  const chosen = tpls.find(t => t.key === tplKey)
  const waiting = msgs.filter(m => m.status === 'بانتظار الاعتماد')
  const ready = toEmail.includes('@') && (!free || (subject.trim() && body.trim()))

  return (
    <div dir="rtl" style={{ fontFamily: 'Cairo,sans-serif', color: C.ink }}>
      <h1 style={{ fontSize: 21, fontWeight: 900, margin: '0 0 4px' }}>مراسلة العملاء</h1>
      <p style={{ fontSize: 12.5, color: C.soft, margin: '0 0 18px', lineHeight: 1.8 }}>
        من هنا تُرسل رسائل العملاء. أما مخاطبة جهات التمويل فتُدار من مكان واحد
        في «المخاطبة» — لأن وصول رسالتين بخطّين مختلفين إلى نفس البنك يُفسد الملف.
      </p>

      {role === 'admin' && waiting.length > 0 && (
        <div style={{ border: '1px solid ' + C.gold, background: '#FFFDF5', borderRadius: 12, padding: 14, marginBottom: 18 }}>
          <div style={{ fontWeight: 900, fontSize: 13.5, marginBottom: 10 }}>
            ينتظر تعميدك ({waiting.length})
          </div>
          {waiting.map(m => (
            <div key={m.id} style={{ borderTop: '1px solid ' + C.line, paddingTop: 10, marginTop: 10 }}>
              <div style={{ fontSize: 12.5, fontWeight: 800 }}>{m.subject}</div>
              <div style={{ fontSize: 11.5, color: C.soft, margin: '3px 0 6px' }}>
                {m.created_by_name} ← {m.to_name || m.to_email}
              </div>
              <div style={{ fontSize: 12, whiteSpace: 'pre-wrap', lineHeight: 1.8, background: '#fff', padding: 10, borderRadius: 8, border: '1px solid ' + C.line }}>
                {m.body}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button type="button" disabled={busy} onClick={() => act(m.id, 'approve')}
                  style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: C.green, color: '#fff', fontFamily: 'Cairo,sans-serif', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>
                  اعتمد وأرسل
                </button>
                <button type="button" disabled={busy} onClick={() => act(m.id, 'reject')}
                  style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid ' + C.line, background: '#fff', color: C.red, fontFamily: 'Cairo,sans-serif', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>
                  لا تُرسل
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ border: '1px solid ' + C.line, borderRadius: 12, padding: 16, background: '#fff', marginBottom: 22 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 12 }}>
          <div>
            <label style={label}>العميل</label>
            <select style={box} value={companyId} onChange={e => pick(e.target.value)}>
              <option value="">— بلا عميل مسجّل —</option>
              {cos.map(c => <option key={c.company_id} value={c.company_id}>{c.company_name}</option>)}
            </select>
          </div>
          <div>
            <label style={label}>اسم المُخاطَب</label>
            <input style={box} value={toName} onChange={e => setToName(e.target.value)} placeholder="نايف" />
          </div>
          <div>
            <label style={label}>بريده</label>
            <input style={box} value={toEmail} onChange={e => setToEmail(e.target.value)} placeholder="name@company.com" dir="ltr" />
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <label style={label}>الرسالة</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {tpls.map(t => (
              <button key={t.key} type="button" onClick={() => { setFree(false); setTplKey(t.key) }}
                style={{
                  padding: '7px 13px', borderRadius: 999, cursor: 'pointer', fontFamily: 'Cairo,sans-serif',
                  fontSize: 12, fontWeight: !free && tplKey === t.key ? 900 : 700,
                  background: !free && tplKey === t.key ? C.ink : '#fff',
                  color: !free && tplKey === t.key ? '#fff' : C.soft,
                  border: '1px solid ' + (!free && tplKey === t.key ? C.ink : C.line),
                }}>{t.label}</button>
            ))}
            <button type="button" onClick={() => setFree(true)}
              style={{
                padding: '7px 13px', borderRadius: 999, cursor: 'pointer', fontFamily: 'Cairo,sans-serif',
                fontSize: 12, fontWeight: free ? 900 : 700,
                background: free ? C.gold : '#fff', color: free ? '#fff' : C.soft,
                border: '1px solid ' + (free ? C.gold : C.line),
              }}>✍️ نصّ حرّ</button>
          </div>

          {!free && chosen && (
            <p style={{ fontSize: 11.5, color: C.soft, margin: '10px 0 0', lineHeight: 1.7 }}>
              متى تُستعمل: {chosen.when} — تُملأ باسمه واسم منشأته وتخرج فوراً.
            </p>
          )}

          {free && (
            <div style={{ marginTop: 12 }}>
              <p style={{ fontSize: 11.5, color: C.red, margin: '0 0 10px', lineHeight: 1.7, fontWeight: 700 }}>
                {role === 'admin'
                  ? 'تُرسل فوراً — أنت المالك.'
                  : 'النصّ الحرّ لا يخرج إلا بعد اعتماد المالك. اكتبي ما تريدين ولا تنتظري: يصله فوراً.'}
              </p>
              <input style={{ ...box, marginBottom: 10 }} value={subject} onChange={e => setSubject(e.target.value)} placeholder="عنوان الرسالة" />
              <textarea style={{ ...box, minHeight: 170, lineHeight: 1.9, resize: 'vertical' }} value={body}
                onChange={e => setBody(e.target.value)} placeholder="نصّ الرسالة…" />
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14 }}>
          <button type="button" disabled={busy || !ready} onClick={send}
            style={{
              padding: '10px 26px', borderRadius: 10, border: 'none',
              background: ready && !busy ? C.ink : '#C9D8D2', color: '#fff',
              fontFamily: 'Cairo,sans-serif', fontWeight: 900, fontSize: 13,
              cursor: ready && !busy ? 'pointer' : 'default',
            }}>
            {busy ? '…' : free && role !== 'admin' ? 'أرسل للاعتماد' : 'أرسل'}
          </button>
          {note && <span style={{ fontSize: 12.5, fontWeight: 800, color: note.startsWith('✕') ? C.red : C.green }}>{note}</span>}
        </div>
      </div>

      <h2 style={{ fontSize: 15, fontWeight: 900, margin: '0 0 10px' }}>ما أُرسل</h2>
      {msgs.length === 0 && <p style={{ fontSize: 12.5, color: C.soft }}>لا شيء بعد.</p>}
      <div style={{ display: 'grid', gap: 8 }}>
        {msgs.map(m => (
          <div key={m.id} style={{ border: '1px solid ' + C.line, borderRadius: 10, padding: '10px 13px', background: m.status === 'فشل' ? '#FFF6F2' : C.bg }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12.5, fontWeight: 800 }}>{m.subject}</span>
              <span style={{ fontSize: 11, fontWeight: 800, color: m.status === 'مُرسلة' ? C.green : m.status === 'فشل' ? C.red : C.gold }}>
                {m.status}
              </span>
            </div>
            <div style={{ fontSize: 11.5, color: C.soft, marginTop: 3 }}>
              {m.to_name ? m.to_name + ' · ' : ''}<span dir="ltr">{m.to_email}</span>
              {m.created_by_name ? ' · ' + m.created_by_name : ''}
              {m.sent_at ? ' · ' + new Date(m.sent_at).toLocaleString('ar-SA') : ''}
            </div>
            {m.error_note && <div style={{ fontSize: 11.5, color: C.red, marginTop: 4 }}>{m.error_note}</div>}
          </div>
        ))}
      </div>
    </div>
  )
}
