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
  delivery: string | null; delivery_checked_at: string | null
}
type Preview = { subject: string; body: string; from: string | null; needs_company: boolean }

// «مُرسلة» تعني سُلِّمت لمزوّد البريد. ووصولها خبر آخر يأتي منه، ويُترجم هنا
// بلغة مفهومة — لأن موظفة تقرأ «مُرسلة» وتظن أن العميل استلمها.
const DELIVERY: Record<string, { label: string; good: boolean }> = {
  delivered: { label: '✓ وصلت لصندوقه', good: true },
  sent: { label: 'خرجت — لم يُؤكَّد الوصول بعد', good: true },
  bounced: { label: '⚠ ارتدّت — البريد غير موجود', good: false },
  complained: { label: '⚠ صنّفها العميل مزعجة', good: false },
  delivery_delayed: { label: 'تأخّر التسليم', good: false },
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
  const [preview, setPreview] = useState<Preview | null>(null)

  const load = (check?: boolean) => {
    fetch('/api/admin/message' + (check ? '?check=1' : ''))
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return
        setRole(d.role || ''); setTpls(d.templates || [])
        setCos(d.companies || []); setMsgs(d.messages || [])
      })
      .catch(() => {})
  }
  useEffect(() => { load() }, [])

  // كلما تغيّر القالب أو العميل أو الاسم، تُبنى الرسالة من الخادم وتُعرض
  // كما ستخرج تماماً. لا تُرسل رسالة لم تُقرأ.
  useEffect(() => {
    if (free) { setPreview(null); return }
    let alive = true
    const p = new URLSearchParams({ preview: tplKey, company_id: companyId, to_name: toName })
    fetch('/api/admin/message?' + p.toString())
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (alive && d?.ok) setPreview({ subject: d.subject, body: d.body, from: d.from, needs_company: d.needs_company }) })
      .catch(() => {})
    return () => { alive = false }
  }, [tplKey, companyId, toName, free])

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
              متى تُستعمل: {chosen.when}
            </p>
          )}

          {/* المعاينة: ما سيصل العميل حرفاً بحرف، ومن أي صندوق، وإلى أي بريد */}
          {!free && preview && (
            <div style={{ marginTop: 12, border: '1px solid ' + C.line, borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ background: C.bg, padding: '9px 14px', borderBottom: '1px solid ' + C.line, fontSize: 11.5, lineHeight: 1.9 }}>
                <div><span style={{ color: C.soft, fontWeight: 800 }}>من:</span> <span dir="ltr">{preview.from || '—'}</span></div>
                <div>
                  <span style={{ color: C.soft, fontWeight: 800 }}>إلى:</span>{' '}
                  <span dir="ltr" style={{ fontWeight: 900, fontSize: 13, color: toEmail.includes('@') ? C.ink : C.red }}>
                    {toEmail || '— لم يُكتب بريد —'}
                  </span>
                  <span style={{ color: C.soft }}> — راجعي هذا السطر حرفاً بحرف قبل الإرسال</span>
                </div>
                <div><span style={{ color: C.soft, fontWeight: 800 }}>الموضوع:</span> <strong>{preview.subject}</strong></div>
              </div>
              <div style={{ padding: '13px 15px', fontSize: 13.5, lineHeight: 1.95, whiteSpace: 'pre-wrap', background: '#fff' }}>
                {preview.body}
              </div>
              {preview.needs_company && !companyId && (
                <div style={{ padding: '8px 14px', background: '#FFF7F3', color: C.red, fontSize: 11.5, fontWeight: 800, borderTop: '1px solid ' + C.line }}>
                  هذا القالب يذكر اسم المنشأة — اختاري العميل أولاً وإلا خرجت ناقصة.
                </div>
              )}
            </div>
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
            {busy ? '…' : free && role !== 'admin' ? 'أرسل للاعتماد' : 'راجعتُها — أرسل'}
          </button>
          {note && <span style={{ fontSize: 12.5, fontWeight: 800, color: note.startsWith('✕') ? C.red : C.green }}>{note}</span>}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 15, fontWeight: 900, margin: 0 }}>ما أُرسل</h2>
        <button type="button" onClick={() => load(true)}
          style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid ' + C.line, background: '#fff', color: C.soft, fontFamily: 'Cairo,sans-serif', fontWeight: 800, fontSize: 11.5, cursor: 'pointer' }}>
          ↻ تحقّق من وصولها
        </button>
      </div>
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
            {m.delivery && (
              <div style={{ fontSize: 11.5, fontWeight: 800, marginTop: 4, color: DELIVERY[m.delivery]?.good === false ? C.red : C.green }}>
                {DELIVERY[m.delivery]?.label || m.delivery}
              </div>
            )}
            {m.status === 'مُرسلة' && !m.delivery && (
              <div style={{ fontSize: 11.5, color: C.soft, marginTop: 4 }}>
                سُلِّمت لمزوّد البريد — اضغطي «تحقّق من وصولها» لتعرفي إن كانت وصلت فعلاً
              </div>
            )}
            {m.error_note && <div style={{ fontSize: 11.5, color: C.red, marginTop: 4 }}>{m.error_note}</div>}
          </div>
        ))}
      </div>
    </div>
  )
}
