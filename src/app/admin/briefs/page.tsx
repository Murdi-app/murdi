'use client'
import { useEffect, useState } from 'react'
import AdminNav from '@/components/AdminNav'

// التوجيهات المرسلة — كل توجيهٍ بنصّه ولمن ومتى، وهل ضغطت الموظفة «قرأته».
type B = { id: string; brief_date: string; recipient: string; to_email: string; subject: string; body: string; status: string; sent_at: string | null; read_at: string | null; note: string | null }
const G = '#1A3D34'
const NAME: Record<string, string> = { dhai: 'ضي', raghad: 'رغد' }
const t = (d: string | null) => d ? new Date(d).toLocaleString('ar-SA', { timeZone: 'Asia/Riyadh', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '—'
const ST: Record<string, string> = { sent: 'أُرسل', draft: 'مسوّدة لم تخرج', sending: 'يُرسل الآن', cancelled: 'أُلغي' }

export default function BriefsPage() {
  const [rows, setRows] = useState<B[]>([])
  const [err, setErr] = useState('')
  const [open, setOpen] = useState('')
  const [who, setWho] = useState('')
  useEffect(() => {
    fetch('/api/admin/briefs').then(async r => { const d = await r.json().catch(() => ({})); if (!r.ok) setErr(d.error || 'تعذّر التحميل'); else setRows(d.briefs || []) }).catch(() => setErr('تعذّر الاتصال'))
  }, [])
  const shown = rows.filter(r => !who || r.recipient === who)
  const sent = rows.filter(r => r.status === 'sent')
  const readPct = sent.length ? Math.round(100 * sent.filter(r => r.read_at).length / sent.length) : 0
  return (
    <div dir="rtl" style={{ fontFamily: 'Cairo,sans-serif', maxWidth: 940, margin: '0 auto', padding: '24px 16px 60px', color: G }}>
      <AdminNav />
      <h1 style={{ fontSize: 22, fontWeight: 900, margin: '0 0 4px' }}>📨 التوجيهات المرسلة</h1>
      <p style={{ fontSize: 13, color: '#6B8A80', margin: '0 0 14px', lineHeight: 1.9 }}>
        آخر ٣٠ يوماً. يخرج كل توجيه باسمك من partners@murdi.sa، ونسخةٌ مخفية منه تصل صندوقك نفسه. نسبة القراءة: {readPct.toLocaleString('ar-SA')}٪
      </p>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {[['', 'الكل'], ['dhai', 'ضي'], ['raghad', 'رغد']].map(([k, l]) => (
          <button key={k} onClick={() => setWho(k)} style={{ padding: '6px 16px', borderRadius: 999, border: '1px solid ' + (who === k ? G : '#DDE7E2'), background: who === k ? G : '#fff', color: who === k ? '#fff' : '#6B8A80', fontFamily: 'inherit', fontWeight: 700, cursor: 'pointer' }}>{l}</button>
        ))}
      </div>
      {err && <div style={{ color: '#C0564B', marginBottom: 12 }}>{err}</div>}
      {shown.map(r => (
        <div key={r.id} style={{ background: '#fff', border: '1.5px solid #EAF2EE', borderRadius: 14, padding: '12px 16px', marginBottom: 10 }}>
          <div onClick={() => setOpen(open === r.id ? '' : r.id)} style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <div>
              <b>{NAME[r.recipient] || r.recipient}</b> · {r.subject}
              <div style={{ fontSize: 12.5, color: '#6B8A80', marginTop: 2 }}>
                {ST[r.status] || r.status} {r.sent_at ? '· خرج ' + t(r.sent_at) : ''}
              </div>
            </div>
            <span style={{ alignSelf: 'center', borderRadius: 999, padding: '4px 12px', fontSize: 12, fontWeight: 800, background: r.read_at ? '#E9F5EF' : '#FBEEEC', color: r.read_at ? '#1E7A5E' : '#C0564B' }}>
              {r.read_at ? '✓ قرأته ' + t(r.read_at) : r.status === 'sent' ? 'لم تقرأه بعد' : '—'}
            </span>
          </div>
          {open === r.id && (
            <div style={{ whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.95, marginTop: 10, paddingTop: 10, borderTop: '1px dashed #E4EFEA' }}>
              {r.body}
              {r.note && <div style={{ fontSize: 12, color: '#8CA49B', marginTop: 8 }}>ملاحظة: {r.note}</div>}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
