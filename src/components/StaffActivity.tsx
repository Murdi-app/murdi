'use client'
import { useEffect, useState } from 'react'

// نشاط الموظفتين يوماً بيوم — في لوحة المالك. «تواصل» كل ما سجّلته من اتصالٍ أو واتساب
// أو نتيجة، و«تسجيل» ما كُتبت له نتيجة، و«ملفات» ما حرّكته مختلفاً. وما لا يُسجَّل في
// المنصة لا يظهر هنا — والصفر يُقرأ «لم يُسجَّل»، لا «لم تعمل» حتماً.

type Row = { day: string; name: string; job: string; touches: number; outcomes: number; files: number; last_at: string | null }
const G = '#1A3D34', M = '#6B8A80', RED = '#A5281B'
const JOB: Record<string, string> = { followup: 'ضي — حتى الدفع', assistant: 'رغد — بعد الدفع' }

export default function StaffActivity() {
  const [rows, setRows] = useState<Row[]>([])
  const [err, setErr] = useState('')
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    fetch('/api/admin/staff-activity?days=7').then(async (r) => {
      const d = await r.json().catch(() => ({}))
      if (!r.ok) setErr(d.error || 'تعذّرت قراءة النشاط'); else setRows(d.rows || [])
      setLoaded(true)
    }).catch(() => { setErr('انقطع الاتصال — النشاط لم يُحمَّل'); setLoaded(true) })
  }, [])
  const names = [...new Set(rows.map((r) => r.name))]
  const days = [...new Set(rows.map((r) => r.day))]
  const wd = (d: string) => new Date(d + 'T12:00:00Z').toLocaleDateString('ar-SA', { weekday: 'short', day: 'numeric', month: 'numeric' })
  const time = (t: string | null) => t ? new Date(t).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Riyadh' }) : '—'
  const weekend = (d: string) => [5, 6].includes(new Date(d + 'T12:00:00Z').getUTCDay())
  return (
    <div style={{ background: '#fff', border: '1.5px solid #E1EDE8', borderRadius: 16, padding: 16, marginBottom: 24 }}>
      <div style={{ color: G, fontWeight: 900, fontSize: 16, marginBottom: 4 }}>👥 نشاط الموظفتين — آخر ٧ أيام</div>
      <div style={{ color: M, fontSize: 12, marginBottom: 10 }}>تواصل · تسجيل نتيجة · ملفات حرّكتها · آخر نشاط. ومن لم يُسجَّل لها شيء حتى ١٢ ظهراً يصلك إشعار.</div>
      {err && <div style={{ color: RED, fontSize: 13, fontWeight: 800 }}>{err}</div>}
      {!loaded && <div style={{ color: M, fontSize: 13 }}>لحظة…</div>}
      {loaded && !err && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead><tr style={{ background: '#F4F7F6', color: G }}>
              <th style={{ padding: 6, textAlign: 'right' }}>اليوم</th>
              {names.map((n) => <th key={n} style={{ padding: 6, textAlign: 'right' }}>{n}<div style={{ color: M, fontWeight: 600, fontSize: 11 }}>{JOB[rows.find((r) => r.name === n)?.job || ''] || ''}</div></th>)}
            </tr></thead>
            <tbody>{days.map((d) => (
              <tr key={d} style={{ borderTop: '1px solid #EFF5F2', opacity: weekend(d) ? 0.55 : 1 }}>
                <td style={{ padding: 6, fontWeight: 800, color: G, whiteSpace: 'nowrap' }}>{wd(d)}</td>
                {names.map((n) => {
                  const r = rows.find((x) => x.day === d && x.name === n)
                  const zero = !r || !(r.touches > 0)
                  return <td key={n} style={{ padding: 6, color: zero && !weekend(d) ? RED : G, fontWeight: 700 }}>
                    {zero ? 'لم يُسجَّل شيء' : `${r!.touches} تواصل · ${r!.outcomes} تسجيل · ${r!.files} ملف · آخره ${time(r!.last_at)}`}
                  </td>
                })}
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  )
}
