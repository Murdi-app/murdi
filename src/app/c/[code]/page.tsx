'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

// عقد الخدمة أو سندها من الرابط القصير (murdi.sa/c/…) — يقرؤه العميل ويوقّعه
// بلا تسجيل دخول، ثم يظهر له رابط السداد ورابط المنصة. والسند لا يُوقَّع: يُقرأ
// ويُدفع. ولا يظهر رابط دفعٍ قبل التوقيع — والخادم يمنعه أيضاً.

const G = '#1A3D34', G2 = '#2E9E7B', M = '#6B8A80'
type Doc = { kind: 'contract' | 'voucher'; status: string; title: string; amount: number | null; paid: boolean; html: string; links: { pay: string; site: string } | null }

export default function ContractLink() {
  const { code } = useParams<{ code: string }>()
  const [doc, setDoc] = useState<Doc | null>(null)
  const [err, setErr] = useState('')
  const [name, setName] = useState('')
  const [idn, setIdn] = useState('')
  const [agree, setAgree] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = async () => {
    try {
      const r = await fetch('/api/c/' + encodeURIComponent(String(code)))
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setErr(d.error || 'تعذّر فتح الرابط'); return }
      setDoc(d)
    } catch { setErr('تعذّر الاتصال — أعد فتح الرابط') }
  }
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load() }, [code])

  const sign = async () => {
    setErr(''); setBusy(true)
    try {
      const r = await fetch('/api/c/' + encodeURIComponent(String(code)), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, id_number: idn, agree }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setErr(d.error || 'تعذّر التوقيع'); setBusy(false); return }
      await load()
    } catch { setErr('تعذّر الاتصال — لم يُحفظ التوقيع، أعد المحاولة') }
    setBusy(false)
  }

  const pill = (bg: string, fg = '#fff'): React.CSSProperties => ({ display: 'block', textAlign: 'center', background: bg, color: fg, padding: '14px', borderRadius: 999, fontWeight: 900, fontSize: 15, textDecoration: 'none', border: bg === '#fff' ? '1.5px solid ' + G : 'none', cursor: 'pointer', fontFamily: 'inherit' })
  const input: React.CSSProperties = { width: '100%', padding: '12px 14px', borderRadius: 12, border: '1.5px solid #D9E5DF', fontFamily: 'inherit', fontSize: 15, fontWeight: 700, color: G, boxSizing: 'border-box' }

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: '#F4F7F6', fontFamily: 'Tajawal, Cairo, sans-serif', padding: '20px 14px 60px' }}>
      <div style={{ maxWidth: 820, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 14 }}>
          <div style={{ color: G2, fontWeight: 900, fontSize: 26 }}>مُرضي</div>
          <div style={{ color: M, fontSize: 12.5, fontWeight: 700 }}>مستشار مالي معتمد — <span style={{ whiteSpace: 'nowrap' }}>ترخيص رقم FL-457927015</span></div>
        </div>
        {err && <div style={{ background: '#FDECEA', border: '1px solid #F3C4BE', color: '#A8342A', borderRadius: 12, padding: '12px 14px', fontWeight: 800, fontSize: 14, marginBottom: 12 }}>{err}</div>}
        {!doc && !err && <div style={{ textAlign: 'center', color: M, fontWeight: 700, padding: 40 }}>لحظة…</div>}
        {doc && (<>
          <div style={{ color: G, fontWeight: 900, fontSize: 18, marginBottom: 8 }}>
            {doc.kind === 'voucher' ? 'سند خدمة' : 'عقد خدمة'} «{doc.title}»
            {doc.status === 'signed' && <span style={{ color: G2, fontSize: 14 }}> — موقَّع ✓</span>}
          </div>
          <iframe title="الوثيقة" srcDoc={doc.html} style={{ width: '100%', height: '65vh', border: '1px solid #E1EDE8', borderRadius: 14, background: '#fff' }} />

          {doc.kind === 'contract' && doc.status === 'issued' && (
            <div style={{ background: '#fff', border: '1.5px solid #E1EDE8', borderRadius: 16, padding: 18, marginTop: 14 }}>
              <div style={{ color: G, fontWeight: 900, fontSize: 16, marginBottom: 4 }}>التوقيع على العقد</div>
              <div style={{ color: M, fontSize: 13, fontWeight: 700, lineHeight: 1.9, marginBottom: 12 }}>
                يوقّع مالك المنشأة أو المفوّض بالتوقيع عنها. اكتب اسمك ورقم هويتك كما في الهوية — يُطبعان في العقد مكان النقاط.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 10 }}>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="الاسم الثلاثي بالعربي" style={input} />
                <input value={idn} onChange={(e) => setIdn(e.target.value)} inputMode="numeric" placeholder="رقم الهوية أو الإقامة" style={input} />
              </div>
              <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 12, color: G, fontWeight: 800, fontSize: 13.5, lineHeight: 1.8 }}>
                <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} style={{ marginTop: 6 }} />
                قرأتُ العقد كاملاً، وأوافق عليه وأوقّعه إلكترونياً عن المنشأة — ويأخذ هذا التوقيع حكم التوقيع الخطي كما في البند الأخير من العقد.
              </label>
              <button onClick={sign} disabled={busy || !agree} style={{ ...pill(G), width: '100%', marginTop: 14, opacity: busy || !agree ? 0.5 : 1 }}>
                {busy ? 'لحظة…' : 'وقّع العقد'}
              </button>
              <div style={{ color: M, fontSize: 12, fontWeight: 700, textAlign: 'center', marginTop: 10 }}>وبعد التوقيع يظهر لك رابط السداد هنا مباشرة.</div>
            </div>
          )}

          {doc.links && !doc.paid && (
            <div style={{ background: '#fff', border: '1.5px solid #BFE0D3', borderRadius: 16, padding: 18, marginTop: 14, display: 'grid', gap: 10 }}>
              <div style={{ color: G, fontWeight: 900, fontSize: 16 }}>{doc.kind === 'contract' ? 'وصلنا العقد موقّعاً — شكراً لكم' : 'السداد'}</div>
              {doc.amount ? <div style={{ color: M, fontWeight: 800, fontSize: 14 }}>{doc.kind === 'contract' ? 'المقدَّم' : 'المبلغ'}: {doc.amount.toLocaleString('en-US')} ريال</div> : null}
              <a href={doc.links.pay} style={pill(G)}>رابط السداد</a>
              <a href={doc.links.site} style={pill('#fff', G)}>متابعة ملفك في المنصة</a>
            </div>
          )}
          {doc.paid && <div style={{ textAlign: 'center', color: G2, fontWeight: 900, marginTop: 14 }}>استلمنا سدادك — فريق مُرضي يتابع معك.</div>}
          <div style={{ textAlign: 'center', color: M, fontSize: 12.5, fontWeight: 700, marginTop: 16 }}>للاستفسار: <a href="tel:0570749196" style={{ color: G }}>0570749196</a></div>
        </>)}
      </div>
    </div>
  )
}
