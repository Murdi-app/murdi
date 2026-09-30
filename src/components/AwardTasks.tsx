'use client'
import { useCallback, useEffect, useState } from 'react'

// مهام الترسيات في «مكالمات اليوم» — ضي.
// اتصالٌ وواتساب معاً بالتوازي، ثم نتيجةٌ من المفردة الواحدة. ولا يظهر هنا
// من الترسية إلا الشركة وصاحب القرار والرقمان — لا قيمة ولا حدود ولا بريد.

// النوع من مصدره لا نسخةً عنه — كانت نسخةٌ هنا ستفترق عن `staffTasks` عند أول حقلٍ جديد
import type { StaffTask as Task } from '@/lib/awards'
const KIND: Record<Task['kind'], [string, string, string]> = {
  first: ['أول تواصل', '#EAF4F0', '#1A3D34'], reminder: ['مكالمة التذكير الوحيدة', '#FBEEEC', '#A5281B'],
  qualify: ['ردّ — التأهيل', '#FFF6E0', '#8A6D1F'], followup: ['متابعة العرض', '#EAF4F0', '#1A3D34'], codex: ['مهمة من Codex', '#EEF0FB', '#3A4A9B'],
}
// ما تكتبه بعد المكالمة: كلام العميل بحرفه، والاعتراض، والموعد، والخطوة التالية
type Capture = { said?: string; objection?: string; important?: boolean; appointment?: string; next_step?: string }

const G = '#1A3D34', M = '#6B8A80'
const pill = (bg: string, fg = '#fff'): React.CSSProperties => ({ background: bg, color: fg, border: 'none', padding: '9px 18px', borderRadius: 999, fontFamily: 'inherit', fontWeight: 900, fontSize: 13.5, cursor: 'pointer', textDecoration: 'none', display: 'inline-block' })

export default function AwardTasks() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [outcomes, setOutcomes] = useState<string[]>([])
  const [services, setServices] = useState<Record<string, string>>({})
  const [svc, setSvc] = useState<Record<string, string>>({})
  const [cap, setCap] = useState<Record<string, Capture>>({})
  const setC = (id: string, k: keyof Capture, v: string | boolean) => setCap({ ...cap, [id]: { ...(cap[id] || {}), [k]: v } })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState('')
  const [pick, setPick] = useState<Record<string, string>>({})
  const [note, setNote] = useState<Record<string, string>>({})
  const [loaded, setLoaded] = useState(false)
  const [waiting, setWaiting] = useState(0)

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/staff/award-tasks')
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setErr(d.error || 'تعذّر تحميل مهام الترسيات'); return }
      setTasks(d.tasks || []); setOutcomes(d.outcomes || []); setServices(d.services || {}); setWaiting(Number(d.waiting) || 0)
    } catch { setErr('تعذّر الاتصال — مهام الترسيات لم تُحمَّل') }
    setLoaded(true)
  }, [])
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load() }, [load])

  const post = async (t: Task, action: 'check' | 'call' | 'whatsapp' | 'consult' | 'outcome' | 'yes', answer?: 'yes' | 'no'): Promise<boolean> => {
    setBusy(t.id + action); setErr('')
    try {
      const r = await fetch('/api/staff/award-tasks', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: t.id, action, answer, outcome: pick[t.id], service: svc[t.id] || null, note: note[t.id] || null,
          ...(action === 'outcome' || action === 'yes' ? {
            said: cap[t.id]?.said || null, objection: cap[t.id]?.objection || null, objection_important: cap[t.id]?.important === true,
            appointment_at: cap[t.id]?.appointment ? new Date(cap[t.id]?.appointment as string).toISOString() : null, next_step: cap[t.id]?.next_step || null,
          } : {}),
        }),
      })
      const d = await r.json().catch(() => ({}))
      setBusy('')
      if (!r.ok) { setErr(d.error || 'لم تُسجَّل'); return false }
      if (d.warn) setErr(d.warn)
      return true
    } catch { setBusy(''); setErr('انقطع الاتصال — لم تُسجَّل'); return false }
  }

  if (!loaded && !err) return null
  if (loaded && tasks.length === 0 && !err) return (
    <div style={{ background: '#FFFDF6', border: '1.5px solid #EAD9A8', borderRadius: 16, padding: '12px 16px', marginBottom: 16, color: '#6B5A2E', fontSize: 13.5, lineHeight: 1.9 }}>
      🏗️ ترسيات — لا اتصال مطلوبٌ منك الآن.{waiting ? ' ' + waiting.toLocaleString('ar-SA') + ' فرصة تنتظر رقماً موثّقاً بمصدره، وتظهر هنا وحدها حين يُعتمد.' : ''}
    </div>
  )

  return (
    <div style={{ background: '#FFFDF6', border: '1.5px solid #EAD9A8', borderRadius: 16, padding: 16, marginBottom: 16 }}>
      <div style={{ fontWeight: 900, color: G, fontSize: 16, marginBottom: 2 }}>🏗️ ترسيات — تواصلٌ اليوم ({tasks.length.toLocaleString('ar-SA')})</div>
      <div style={{ color: M, fontSize: 12.5, marginBottom: 10 }}>تحقّقي أولاً أن الرقم يصل لصاحب القرار، ثم اتصلي وأرسلي الواتساب معاً وسجّلي النتيجة. مكالمة التذكير مرةً واحدة ثم يُغلق الصف.</div>
      {err && <div style={{ background: '#FBEEEC', color: '#A5281B', borderRadius: 10, padding: '8px 12px', fontSize: 13, fontWeight: 700, marginBottom: 10 }}>{err}</div>}
      {tasks.map((t) => (
        <div key={t.id} style={{ background: '#fff', border: '1px solid #EFE6CC', borderRadius: 12, padding: 12, marginBottom: 8 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <b style={{ color: G, fontSize: 15 }}>{t.company}</b>
            {t.person && <span style={{ color: M, fontSize: 13, fontWeight: 700 }}>— {t.person}{t.role ? ' (' + t.role + ')' : ''}</span>}
            <span style={{ background: KIND[t.kind][1], color: KIND[t.kind][2], borderRadius: 99, padding: '2px 10px', fontSize: 11.5, fontWeight: 900 }}>
              {KIND[t.kind][0]}
            </span>
            {t.appointment && <span style={{ color: M, fontSize: 12, fontWeight: 800 }}>موعد: {new Date(t.appointment).toLocaleString('ar-SA', { dateStyle: 'short', timeStyle: 'short' })}</span>}
          </div>
          {t.codex_reason && <div style={{ color: '#3A4A9B', fontSize: 12.5, fontWeight: 700, marginTop: 4 }}>لماذا: {t.codex_reason}</div>}
          {t.question && (
            // سؤال التأهيل — يُسأل ولا يُقال للعميل حكمٌ على وضعه
            <div style={{ background: '#F7FBF9', border: '1px dashed #CFE3DA', borderRadius: 8, padding: '6px 10px', marginTop: 6, fontSize: 13, color: G }}>
              <b>اسألي:</b> {t.question}
            </div>
          )}
          {t.source && (
            <div style={{ color: M, fontSize: 12, marginTop: 4 }}>
              مصدر الرقم: {t.source_url ? <a href={t.source_url} target="_blank" rel="noopener noreferrer" style={{ color: G, fontWeight: 800 }}>{t.source}</a> : t.source}
            </div>
          )}
          {t.check ? (
            // التحقق أولاً: اتصلي، ثم أجيبي — والواتساب والنتيجة بعد «نعم»
            <div style={{ background: '#FFF6E0', border: '1px solid #EAD9A8', borderRadius: 10, padding: 10, marginTop: 10 }}>
              <div style={{ fontWeight: 900, color: G, fontSize: 14, marginBottom: 8 }}>هل يصل هذا الرقم لصاحب القرار{t.person ? ' (' + t.person + ')' : ''}؟</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                {t.phone && <a href={'tel:' + t.phone} style={pill(G)}>📞 اتصال {t.phone}</a>}
                <button disabled={busy === t.id + 'check'} onClick={async () => { if (await post(t, 'check', 'yes')) await load() }} style={pill('#1A5C46')}>نعم، يصل</button>
                <button disabled={busy === t.id + 'check'} onClick={async () => { if (await post(t, 'check', 'no')) await load() }} style={{ ...pill('#fff', '#A5281B'), border: '1.5px solid #A5281B' }}>لا يصل</button>
                <input value={note[t.id] || ''} onChange={(e) => setNote({ ...note, [t.id]: e.target.value })} placeholder="من ردّ؟ (اختياري)"
                  style={{ flex: '1 1 140px', border: '1px solid #D9E5DF', borderRadius: 8, padding: '7px 10px', fontFamily: 'inherit', fontSize: 13.5 }} />
              </div>
            </div>
          ) : (<>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
            {t.phone && (
              <a href={'tel:' + t.phone} onClick={() => { void post(t, 'call') }} style={pill(G)}>📞 اتصال {t.phone}</a>
            )}
            {t.wa_url && (
              <a href={t.wa_url} target="_blank" rel="noopener noreferrer" onClick={() => { void post(t, 'whatsapp') }} style={pill('#25D366')}>واتساب</a>
            )}
            <button disabled={busy === t.id + 'yes'} onClick={async () => { if (await post(t, 'yes')) await load() }}
              style={{ ...pill('#fff', G), border: '2px solid ' + G }}>{busy === t.id + 'yes' ? '…' : '✓ ردّ بنعم'}</button>
          </div>
          {t.consult && (
            // الاستشارة التي اعتمدها المالك: تُنزَّل ثم تُرفق في محادثة الواتساب (الواتساب لا يُرفق ملفاً من رابط)
            <div style={{ background: '#F7FBF9', border: '1px solid #CFE3DA', borderRadius: 10, padding: 10, marginTop: 10 }}>
              <div style={{ fontWeight: 900, color: G, fontSize: 14, marginBottom: 4 }}>📄 استشارة الفجوة — اعتمدها الدكتور</div>
              <div style={{ color: M, fontSize: 12.5, marginBottom: 8 }}>١) نزّلي الملف · ٢) افتحي الواتساب — الرسالة مكتوبة — وأرفقي الملف ثم أرسلي.</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <a href={t.consult.pdf_url} style={pill(G)}>⬇️ نزّلي الاستشارة PDF</a>
                {t.consult.wa_url
                  ? <a href={t.consult.wa_url} target="_blank" rel="noopener noreferrer" onClick={() => { void post(t, 'consult') }} style={pill('#25D366')}>💬 افتحي واتساب وأرفقيها</a>
                  : <span style={{ color: '#A5281B', fontSize: 12.5, fontWeight: 700 }}>لا رقم واتساب أو نص الرسالة غير معتمد</span>}
              </div>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10, alignItems: 'center' }}>
            {/* التأهيل: الخدمة المناسبة — لازمةٌ مع «ردّ بنعم» و«مهتم» و«تحوّل عميلاً» */}
            <select value={svc[t.id] || ''} onChange={(e) => setSvc({ ...svc, [t.id]: e.target.value })}
              style={{ border: '1.5px solid ' + (svc[t.id] ? '#D9E5DF' : '#EAD9A8'), borderRadius: 8, padding: '7px 10px', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 800 }}>
              <option value="">الخدمة المناسبة…</option>
              {Object.entries(services).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <select value={pick[t.id] || ''} onChange={(e) => setPick({ ...pick, [t.id]: e.target.value })}
              style={{ border: '1px solid #D9E5DF', borderRadius: 8, padding: '7px 10px', fontFamily: 'inherit', fontSize: 13.5 }}>
              <option value="">نتيجة المكالمة…</option>
              {outcomes.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
            <input value={note[t.id] || ''} onChange={(e) => setNote({ ...note, [t.id]: e.target.value })} placeholder="ملاحظة قصيرة"
              style={{ flex: '1 1 160px', border: '1px solid #D9E5DF', borderRadius: 8, padding: '7px 10px', fontFamily: 'inherit', fontSize: 13.5 }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, marginTop: 8 }}>
            <textarea rows={2} value={cap[t.id]?.said || ''} onChange={(e) => setC(t.id, 'said', e.target.value)} placeholder="ما قاله العميل بحرفه"
              style={{ gridColumn: '1 / -1', border: '1px solid #D9E5DF', borderRadius: 8, padding: '7px 10px', fontFamily: 'inherit', fontSize: 13.5 }} />
            <input value={cap[t.id]?.objection || ''} onChange={(e) => setC(t.id, 'objection', e.target.value)} placeholder="الاعتراض (إن وُجد)"
              style={{ border: '1px solid #D9E5DF', borderRadius: 8, padding: '7px 10px', fontFamily: 'inherit', fontSize: 13.5 }} />
            <label style={{ fontSize: 12.5, color: M, fontWeight: 800, display: 'flex', gap: 6, alignItems: 'center' }}>
              <input type="checkbox" checked={cap[t.id]?.important === true} onChange={(e) => setC(t.id, 'important', e.target.checked)} /> اعتراضٌ مهم (يصل الدكتور)
            </label>
            <label style={{ fontSize: 12, color: M, fontWeight: 700 }}>موعد العميل
              <input type="datetime-local" value={cap[t.id]?.appointment || ''} onChange={(e) => setC(t.id, 'appointment', e.target.value)}
                style={{ width: '100%', border: '1px solid #D9E5DF', borderRadius: 8, padding: '6px 8px', fontFamily: 'inherit', fontSize: 13 }} />
            </label>
            <input value={cap[t.id]?.next_step || ''} onChange={(e) => setC(t.id, 'next_step', e.target.value)} placeholder="الخطوة التالية"
              style={{ border: '1px solid #D9E5DF', borderRadius: 8, padding: '7px 10px', fontFamily: 'inherit', fontSize: 13.5 }} />
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8, alignItems: 'center' }}>
            <button disabled={!pick[t.id] || busy === t.id + 'outcome'} onClick={async () => { if (await post(t, 'outcome')) { setCap((c) => { const y = { ...c }; delete y[t.id]; return y }); await load() } }}
              style={{ ...pill(G), opacity: pick[t.id] ? 1 : 0.5 }}>{busy === t.id + 'outcome' ? '…' : 'سجّلي النتيجة'}</button>
          </div>
          </>)}
        </div>
      ))}
    </div>
  )
}
