'use client'
import { useCallback, useEffect, useState } from 'react'

// مهام الترسيات في «مكالمات اليوم» — ضي.
// اتصالٌ وواتساب معاً بالتوازي، ثم نتيجةٌ من المفردة الواحدة. ولا يظهر هنا
// من الترسية إلا الشركة وصاحب القرار والرقمان — لا قيمة ولا حدود ولا بريد.

type Task = { id: string; kind: 'first' | 'reminder'; company: string; person: string | null; role: string | null; phone: string | null; whatsapp: string | null; wa_url: string | null; since: string | null; check: boolean; source: string | null; source_url: string | null }

const G = '#1A3D34', M = '#6B8A80'
const pill = (bg: string, fg = '#fff'): React.CSSProperties => ({ background: bg, color: fg, border: 'none', padding: '9px 18px', borderRadius: 999, fontFamily: 'inherit', fontWeight: 900, fontSize: 13.5, cursor: 'pointer', textDecoration: 'none', display: 'inline-block' })

export default function AwardTasks() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [outcomes, setOutcomes] = useState<string[]>([])
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState('')
  const [pick, setPick] = useState<Record<string, string>>({})
  const [note, setNote] = useState<Record<string, string>>({})
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/staff/award-tasks')
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setErr(d.error || 'تعذّر تحميل مهام الترسيات'); return }
      setTasks(d.tasks || []); setOutcomes(d.outcomes || [])
    } catch { setErr('تعذّر الاتصال — مهام الترسيات لم تُحمَّل') }
    setLoaded(true)
  }, [])
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load() }, [load])

  const post = async (t: Task, action: 'check' | 'call' | 'whatsapp' | 'outcome' | 'yes', answer?: 'yes' | 'no'): Promise<boolean> => {
    setBusy(t.id + action); setErr('')
    try {
      const r = await fetch('/api/staff/award-tasks', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: t.id, action, answer, outcome: pick[t.id], note: note[t.id] || null }),
      })
      const d = await r.json().catch(() => ({}))
      setBusy('')
      if (!r.ok) { setErr(d.error || 'لم تُسجَّل'); return false }
      if (d.warn) setErr(d.warn)
      return true
    } catch { setBusy(''); setErr('انقطع الاتصال — لم تُسجَّل'); return false }
  }

  if (!loaded && !err) return null
  if (loaded && tasks.length === 0 && !err) return null

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
            <span style={{ background: t.kind === 'reminder' ? '#FBEEEC' : '#EAF4F0', color: t.kind === 'reminder' ? '#A5281B' : G, borderRadius: 99, padding: '2px 10px', fontSize: 11.5, fontWeight: 900 }}>
              {t.kind === 'reminder' ? 'مكالمة التذكير الوحيدة' : 'أول تواصل'}
            </span>
          </div>
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
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10, alignItems: 'center' }}>
            <select value={pick[t.id] || ''} onChange={(e) => setPick({ ...pick, [t.id]: e.target.value })}
              style={{ border: '1px solid #D9E5DF', borderRadius: 8, padding: '7px 10px', fontFamily: 'inherit', fontSize: 13.5 }}>
              <option value="">نتيجة المكالمة…</option>
              {outcomes.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
            <input value={note[t.id] || ''} onChange={(e) => setNote({ ...note, [t.id]: e.target.value })} placeholder="ملاحظة قصيرة"
              style={{ flex: '1 1 160px', border: '1px solid #D9E5DF', borderRadius: 8, padding: '7px 10px', fontFamily: 'inherit', fontSize: 13.5 }} />
            <button disabled={!pick[t.id] || busy === t.id + 'outcome'} onClick={async () => { if (await post(t, 'outcome')) await load() }}
              style={{ ...pill(G), opacity: pick[t.id] ? 1 : 0.5 }}>{busy === t.id + 'outcome' ? '…' : 'سجّلي النتيجة'}</button>
          </div>
          </>)}
        </div>
      ))}
    </div>
  )
}
