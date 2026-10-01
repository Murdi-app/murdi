'use client'
import { useEffect, useState } from 'react'

// إعدادات الأتعاب والرسائل — في شاشة الخدمات للمالك. النسبة هنا هي ما تبدأ به
// مسودّة كل عقد؛ ويُعدّلها المالك لكل عميل في عقده قبل إصداره.

type S = { completionPct: Record<string, number>; cfUpfront: { upTo: number | null; price: number }[]; vatRate: number; msgIssued: string; msgSigned: string; firstDelivery: Record<string, string> }
const G = '#1A3D34', M = '#6B8A80'
const inp: React.CSSProperties = { border: '1.5px solid #EAF2EE', borderRadius: 10, padding: '7px 10px', fontFamily: 'Cairo', fontSize: 12.5, width: '100%', boxSizing: 'border-box' }

export default function FeeSettingsPanel() {
  const [open, setOpen] = useState(false)
  const [s, setS] = useState<S | null>(null)
  const [services, setServices] = useState<string[]>([])
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  const load = async () => {
    try {
      const r = await fetch('/api/admin/fee-settings')
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setErr(d.error || 'تعذّرت قراءة الإعدادات'); return }
      setS(d.settings); setServices(d.services || [])
    } catch { setErr('انقطع الاتصال — الإعدادات لم تُحمَّل') }
  }
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (open && !s) void load() }, [open, s])

  const save = async (key: string, value: unknown) => {
    setMsg(''); setErr('')
    try {
      const r = await fetch('/api/admin/fee-settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key, value }) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setErr(d.error || 'لم يُحفظ'); return }
      setMsg('حُفظ ✓'); await load()
    } catch { setErr('انقطع الاتصال — لم يُحفظ') }
  }

  const btn: React.CSSProperties = { background: G, color: '#fff', border: 'none', padding: '7px 16px', borderRadius: 30, fontFamily: 'Cairo', fontWeight: 900, fontSize: 12, cursor: 'pointer', marginTop: 8 }
  return (
    <div style={{ background: '#fff', border: '1.5px solid #EAD9A8', borderRadius: 14, padding: '12px 16px', marginBottom: 16 }}>
      <button onClick={() => setOpen(!open)} style={{ background: 'none', border: 'none', color: '#9A7B2E', fontFamily: 'Cairo', fontWeight: 900, fontSize: 14, cursor: 'pointer', padding: 0 }}>
        ⚙️ إعدادات الأتعاب والرسائل {open ? '▴' : '▾'}
      </button>
      {open && (
        <div style={{ marginTop: 10, display: 'grid', gap: 14 }}>
          {err && <div style={{ background: '#FDECEA', color: '#A8342A', borderRadius: 10, padding: '8px 12px', fontSize: 12.5, fontWeight: 800 }}>{err}</div>}
          {msg && <div style={{ color: '#1A7A5A', fontSize: 12.5, fontWeight: 900 }}>{msg}</div>}
          {!s ? <div style={{ color: M, fontSize: 12.5 }}>لحظة…</div> : (<>
            <div>
              <div style={{ color: G, fontWeight: 900, fontSize: 13, marginBottom: 6 }}>نسبة أتعاب استكمال الخدمة (الافتراضية — تُعدَّل لكل عميل في عقده)</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 8 }}>
                {['default', ...services].map((k) => (
                  <label key={k} style={{ fontSize: 11.5, color: M, fontWeight: 700 }}>{k === 'default' ? 'لأي خدمة لم تُسمَّ' : k} ٪
                    <input type="number" step="0.1" value={s.completionPct[k] ?? ''} onChange={(e) => setS({ ...s, completionPct: { ...s.completionPct, [k]: e.target.value === '' ? (undefined as unknown as number) : Number(e.target.value) } })} style={inp} />
                  </label>
                ))}
              </div>
              <button style={btn} onClick={() => save('completion_pct', Object.fromEntries(Object.entries(s.completionPct).filter(([, v]) => v !== undefined && !Number.isNaN(v))))}>احفظ النسب</button>
            </div>
            <div>
              <div style={{ color: G, fontWeight: 900, fontSize: 13, marginBottom: 6 }}>مقدَّم «تمويل العقد» بحسب قيمة العقد</div>
              {s.cfUpfront.map((t, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 6 }}>
                  <input type="number" placeholder={i === s.cfUpfront.length - 1 ? 'بلا حدّ أعلى' : 'حتى قيمة عقد (ريال)'} value={t.upTo ?? ''} disabled={i === s.cfUpfront.length - 1}
                    onChange={(e) => { const x = [...s.cfUpfront]; x[i] = { ...t, upTo: e.target.value === '' ? null : Number(e.target.value) }; setS({ ...s, cfUpfront: x }) }} style={inp} />
                  <input type="number" placeholder="المقدَّم (ريال)" value={t.price}
                    onChange={(e) => { const x = [...s.cfUpfront]; x[i] = { ...t, price: Number(e.target.value) }; setS({ ...s, cfUpfront: x }) }} style={inp} />
                </div>
              ))}
              <button style={btn} onClick={() => save('contract_finance_upfront', s.cfUpfront)}>احفظ الشرائح</button>
            </div>
            <div>
              <div style={{ color: G, fontWeight: 900, fontSize: 13, marginBottom: 6 }}>ضريبة القيمة المضافة على الأسعار ٪ (٠ = لا تُذكر في السند)</div>
              <input type="number" value={s.vatRate} onChange={(e) => setS({ ...s, vatRate: Number(e.target.value) })} style={{ ...inp, maxWidth: 160 }} />
              <div><button style={btn} onClick={() => save('vat_rate', s.vatRate)}>احفظ</button></div>
            </div>
            <div>
              <div style={{ color: G, fontWeight: 900, fontSize: 13, marginBottom: 6 }}>الرسالة الأولى — عند إصدار العقد أو السند</div>
              <div style={{ color: M, fontSize: 11, marginBottom: 4 }}>المتغيرات: {'{الاسم} {الخدمة} {الوثيقة} {رابط العقد}'}</div>
              <textarea rows={8} value={s.msgIssued} onChange={(e) => setS({ ...s, msgIssued: e.target.value })} style={{ ...inp, lineHeight: 1.9 }} />
              <button style={btn} onClick={() => save('msg_issued', s.msgIssued)}>احفظ الرسالة الأولى</button>
            </div>
            <div>
              <div style={{ color: G, fontWeight: 900, fontSize: 13, marginBottom: 6 }}>الرسالة الثانية — بعد التوقيع</div>
              <div style={{ color: M, fontSize: 11, marginBottom: 4 }}>المتغيرات: {'{المبلغ} {رابط الدفع} {رابط المنصة} {ما يصلكم}'}</div>
              <textarea rows={7} value={s.msgSigned} onChange={(e) => setS({ ...s, msgSigned: e.target.value })} style={{ ...inp, lineHeight: 1.9 }} />
              <button style={btn} onClick={() => save('msg_signed', s.msgSigned)}>احفظ الرسالة الثانية</button>
            </div>
            <div>
              <div style={{ color: G, fontWeight: 900, fontSize: 13, marginBottom: 6 }}>«ما يصلكم» لكل خدمة في الرسالة الثانية</div>
              {['تمويل العقد', ...services.filter((x) => x !== 'تمويل العقد')].map((k) => (
                <label key={k} style={{ display: 'block', fontSize: 11.5, color: M, fontWeight: 700, marginBottom: 6 }}>{k}
                  <input value={s.firstDelivery[k] || ''} onChange={(e) => setS({ ...s, firstDelivery: { ...s.firstDelivery, [k]: e.target.value } })} style={inp} />
                </label>
              ))}
              <button style={btn} onClick={() => save('first_delivery', Object.fromEntries(Object.entries(s.firstDelivery).filter(([, v]) => String(v || '').trim())))}>احفظ</button>
            </div>
          </>)}
        </div>
      )}
    </div>
  )
}
