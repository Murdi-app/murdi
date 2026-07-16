'use client'
import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import AdminNav from '@/components/AdminNav'
import { COMMISSION_SERVICES } from '@/lib/contracts'
import { SERVICES } from '@/lib/serviceSuggestion'
import { ACTIVITIES, fieldsFor } from '@/lib/financialActivities'

const ADMIN_EMAIL = 'hololalmurdi.fs@gmail.com'
const fmtDate = (d: string) => d ? new Date(d).toLocaleString('ar-SA', { year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }) : '—'
const isNew = (d: string) => d ? (Date.now() - new Date(d).getTime()) < 48*60*60*1000 : false

const STAT: Record<string, { t: string; bg: string; fg: string }> = {
  submitted: { t: 'بانتظار التجهيز', bg: '#FBF5E8', fg: '#9A7B2E' },
  in_progress: { t: 'تم التجهيز — بانتظار الإصدار', bg: '#EAF0FB', fg: '#3B5BA5' },
  priced: { t: 'مُسعّرة — بانتظار دفع العميل', bg: '#FBF3DC', fg: '#B8860B' },
  paid: { t: 'مدفوعة — بانتظار التسليم', bg: '#E8F5EF', fg: '#1A7A4C' },
  delivered: { t: 'صادرة للعميل', bg: '#EAF7F0', fg: '#1E7A5A' },
  in_follow_up: { t: 'قيد المتابعة مع الجهات', bg: '#EAF0FB', fg: '#3B5BA5' },
  completed: { t: 'مكتملة', bg: '#EAF7F0', fg: '#1E7A5A' },
  rejected: { t: 'مرفوضة', bg: '#FBEEEC', fg: '#C0564B' },
}

export default function AdminServicesPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [reqs, setReqs] = useState<any[]>([])
  const [busy, setBusy] = useState('')
  const [edits, setEdits] = useState<Record<string, { deliverable: string; price: string }>>({})
  const [contracts, setContracts] = useState<Record<string, any>>({})
  const [cEdits, setCEdits] = useState<Record<string, any>>({})
  const [integrity, setIntegrity] = useState<Record<string, any>>({})
  const [fixEdits, setFixEdits] = useState<Record<string, any>>({})
  const [inputsOpen, setInputsOpen] = useState<Record<string, boolean>>({})
  const [inputsData, setInputsData] = useState<Record<string, { activity_kind: string; inputs: Record<string, string> }>>({})
  const [addOpen, setAddOpen] = useState(false)
  const [addCompanies, setAddCompanies] = useState<any[]>([])
  const [addCompanyId, setAddCompanyId] = useState('')
  const [addService, setAddService] = useState('')

  const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string)

  async function load() {
    const res = await fetch('/api/admin/service-requests')
    if (res.ok) { const d = await res.json(); setReqs(d.requests || []) }
    const cr = await fetch('/api/admin/contracts')
    if (cr.ok) { const cd = await cr.json(); const map: Record<string, any> = {}; for (const c of (cd.contracts || [])) { if (c.service_request_id && !map[c.service_request_id]) map[c.service_request_id] = c; } setContracts(map); }
    setLoading(false)
  }

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || user.email !== ADMIN_EMAIL) { router.push('/'); return }
      await load()
    })()
  }, [])

  async function openAdd() {
    setAddOpen(true)
    if (addCompanies.length === 0) {
      const { data } = await supabase.from('companies').select('id, company_name').eq('account_status', 'active').order('created_at', { ascending: false })
      setAddCompanies(data || [])
    }
  }

  async function createRequest() {
    if (!addCompanyId || !addService) { alert('اختر العميل والخدمة'); return }
    setBusy('add')
    const res = await fetch('/api/admin/service-requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ company_id: addCompanyId, service_title: addService }) })
    if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.error || 'تعذر الإنشاء'); setBusy(''); return }
    setAddOpen(false); setAddCompanyId(''); setAddService('')
    await load()
    setBusy('')
  }

  async function openInputs(r: any) {
    setInputsOpen(p => ({ ...p, [r.id]: !p[r.id] }))
    if (inputsData[r.id]) return
    const res = await fetch('/api/admin/service-inputs?service_request_id=' + r.id)
    const d = await res.json().catch(() => ({}))
    const rec = d.record
    setInputsData(p => ({ ...p, [r.id]: { activity_kind: rec?.activity_kind || 'trade', inputs: rec?.inputs || {} } }))
  }

  async function saveInputs(r: any) {
    const cur = inputsData[r.id]
    if (!cur) return
    setBusy(r.id)
    const link: Record<string,string> = { cash_in_banks:'opening_cash', accounts_receivable:'opening_ar', inventory:'opening_inventory', accounts_payable:'opening_ap', fixed_assets:'opening_fixed_assets', eos_provision:'eos_opening' }
    for (const endK in link) {
      const openK = link[endK]
      const y1end = cur.inputs[endK + '__y1']
      if (y1end && !cur.inputs[openK + '__y2']) cur.inputs[openK + '__y2'] = y1end
    }
    const years: Record<string, Record<string,string>> = { '1': {}, '2': {} }
    for (const k in cur.inputs) {
      const v = cur.inputs[k]
      if (k.endsWith('__y1')) years['1'][k.slice(0,-4)] = v
      else if (k.endsWith('__y2')) years['2'][k.slice(0,-4)] = v
      else { years['1'][k] = v; years['2'][k] = v }
    }
    const payload = { multi_year: true, years }
    await fetch('/api/admin/service-inputs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ service_request_id: r.id, company_id: r.company_id, activity_kind: cur.activity_kind, inputs: payload }) })
    setBusy('')
    alert('✅ حُفظت الأرقام — الآن اضغط «جهّز الخدمة» لتوليد القوائم')
  }

  async function prepare(id: string) {
    setBusy(id)
    const res = await fetch('/api/admin/prepare-service', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId: id }) })
    if (res.status === 422) {
      const d = await res.json()
      setIntegrity(p => ({ ...p, [id]: d }))
      setFixEdits(p => ({ ...p, [id]: { original_loan_amount: d.current?.original_loan_amount ?? '', debt_remaining: d.current?.debt_remaining ?? '', annual_revenue: d.current?.annual_revenue ?? '', source_note: '' } }))
      setBusy('')
      return
    }
    setIntegrity(p => { const c = { ...p }; delete c[id]; return c })
    if (res.ok) { const d = await res.json(); setEdits(p => ({ ...p, [id]: { deliverable: d.deliverable || '', price: edits[id]?.price || '' } })) }
    await load()
    setBusy('')
  }

  async function saveCorrection(reqId: string, companyId: string) {
    const e = fixEdits[reqId] || {}
    if (!e.source_note || String(e.source_note).trim().length < 5) { alert('اكتب مصدر التصحيح (المستند الرسمي الذي استندت إليه)'); return }
    setBusy(reqId)
    const res = await fetch('/api/admin/corrections', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ company_id: companyId, original_loan_amount: e.original_loan_amount, debt_remaining: e.debt_remaining, annual_revenue: e.annual_revenue, source_note: e.source_note }) })
    if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.error || 'تعذّر حفظ التصحيح'); setBusy(''); return }
    setBusy('')
    await prepare(reqId)
  }

  async function generateFile(r: any) {
    setBusy(r.id)
    const track = r.service_title === 'تجهيز ملف عرض المستثمر والتفاوض' ? 'investment' : 'funding'
    try {
      // نولّد نسختين: عربية (محلي) + إنجليزية (دولي). احفظ كل واحدة PDF وارفعها في قسم المخاطبة.
      const regions = ['محلي', 'دولي']
      let okCount = 0
      for (const region of regions) {
        const res = await fetch('/api/admin/generate-file', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ company_id: r.company_id, track, region }) })
        const d = await res.json()
        if (res.status === 422) {
          setIntegrity(p => ({ ...p, [r.id]: d }))
          setFixEdits(p => ({ ...p, [r.id]: { original_loan_amount: d.current?.original_loan_amount ?? '', debt_remaining: d.current?.debt_remaining ?? '', annual_revenue: d.current?.annual_revenue ?? '', source_note: '' } }))
          setBusy('')
          return
        }
        if (d.ok && d.html) {
          const w = window.open('', '_blank')
          if (w) { w.document.write(d.html); w.document.close() }
          okCount++
        }
      }
      if (okCount === 0) alert('تعذّر توليد الملفات')
    } catch {
      alert('تعذّر الاتصال بالخادم')
    }
    setBusy('')
  }

  async function save(id: string, deliverable: string, price: string, status?: string) {
    setBusy(id)
    await fetch('/api/admin/service-requests', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, admin_deliverable: deliverable, price: price ? Number(price) : null, status }) })
    await load()
    setBusy('')
  }

  async function createContract(sr: any) {
    setBusy(sr.id)
    const type = COMMISSION_SERVICES[sr.service_title]
    await fetch('/api/admin/contracts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ serviceRequestId: sr.id, companyId: sr.company_id, contractType: type }) })
    await load()
    setBusy('')
  }

  async function saveContract(c: any, status?: string) {
    setBusy(c.service_request_id)
    const e = cEdits[c.id] || {}
    await fetch('/api/admin/contracts', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: c.id, contract_body: e.contract_body ?? c.contract_body, client_name: e.client_name ?? c.client_name, client_id_number: e.client_id_number ?? c.client_id_number, establishment_name: e.establishment_name ?? c.establishment_name, establishment_cr: e.establishment_cr ?? c.establishment_cr, fee_percent: (e.fee_percent ?? c.fee_percent) ? Number(e.fee_percent ?? c.fee_percent) : null, status }) })
    if (status === 'issued') {
      await fetch('/api/admin/service-requests', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: c.service_request_id, status: 'in_follow_up' }) })
    }
    if (status === 'completed') {
      await fetch('/api/admin/service-requests', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: c.service_request_id, status: 'completed' }) })
    }
    await load()
    setBusy('')
  }

  if (loading) return <div dir="rtl" style={{ minHeight:'100vh', background:'#FBFCFB', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Cairo,sans-serif', color:'#2E9E7B', fontWeight:700 }}>جارٍ التحميل...</div>

  return (
    <div dir="rtl" style={{ minHeight:'100vh', background:'#FBFCFB', fontFamily:'Cairo,sans-serif' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Amiri:wght@700&family=Cairo:wght@400;600;700;900&display=swap');`}</style>
      <div style={{ background:'#fff', padding:'16px 32px', display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'1px solid #EAF2EE' }}>
        <div style={{ fontSize:22, fontWeight:700, color:'#1A3D34', fontFamily:'Amiri,serif' }}>مُرضي <span style={{ fontSize:13, color:'#C9A84C', fontWeight:900, fontFamily:'Cairo' }}>ADMIN</span></div>
        <button onClick={()=>router.push('/goal')} style={{ padding:'8px 18px', borderRadius:30, border:'1px solid #E8F5EF', background:'transparent', color:'#6B8A80', cursor:'pointer', fontSize:13, fontFamily:'Cairo', fontWeight:700 }}>المركز الرئيسي</button>
      </div>
      <div style={{ background:'#fff', padding:'0 32px' }}>
        <AdminNav />
      </div>

      <div style={{ maxWidth:900, margin:'0 auto', padding:'32px 24px' }}>
        <h1 style={{ fontSize:24, fontWeight:900, color:'#1A3D34', marginBottom:6 }}>طلبات الخدمات</h1>
        <p style={{ color:'#6B8A80', fontSize:14, fontWeight:600, marginBottom:16 }}>جهّز الخدمة، حدّد السعر بعد التفاوض، ثم أصدرها للعميل</p>

        {!addOpen && (
          <button onClick={openAdd} style={{ background:'#1A3D34', color:'#fff', border:'none', padding:'10px 22px', borderRadius:30, fontFamily:'Cairo', fontWeight:900, fontSize:13, cursor:'pointer', marginBottom:24 }}>➕ إنشاء طلب خدمة نيابةً عن العميل</button>
        )}

        {addOpen && (
          <div style={{ background:'#F7FAF9', border:'2px solid #E1EDE8', borderRadius:14, padding:'18px 20px', marginBottom:24 }}>
            <div style={{ color:'#1A3D34', fontWeight:900, fontSize:14, marginBottom:12 }}>➕ إنشاء طلب خدمة نيابةً عن العميل</div>
            <div style={{ color:'#6B8A80', fontSize:12.5, marginBottom:14, lineHeight:1.8 }}>يُنشأ الطلب بحالة «بانتظار التجهيز» تماماً كما لو طلبه العميل بنفسه. استخدمه بعد إغلاق الصفقة هاتفياً.</div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
              <div>
                <div style={{ color:'#6B8A80', fontSize:11.5, fontWeight:700, marginBottom:5 }}>العميل</div>
                <select value={addCompanyId} onChange={e => setAddCompanyId(e.target.value)} style={{ width:'100%', border:'1.5px solid #EAF2EE', borderRadius:10, padding:'10px 12px', fontFamily:'Cairo', fontSize:13, background:'#fff', color:'#1A3D34' }}>
                  <option value="">— اختر العميل —</option>
                  {addCompanies.map((c: any) => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                </select>
              </div>
              <div>
                <div style={{ color:'#6B8A80', fontSize:11.5, fontWeight:700, marginBottom:5 }}>الخدمة</div>
                <select value={addService} onChange={e => setAddService(e.target.value)} style={{ width:'100%', border:'1.5px solid #EAF2EE', borderRadius:10, padding:'10px 12px', fontFamily:'Cairo', fontSize:13, background:'#fff', color:'#1A3D34' }}>
                  <option value="">— اختر الخدمة —</option>
                  {Object.keys(SERVICES).map(k => <option key={k} value={k}>{k}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display:'flex', gap:10 }}>
              <button onClick={createRequest} disabled={busy === 'add'} style={{ background:'#2E9E7B', color:'#fff', border:'none', padding:'9px 22px', borderRadius:30, fontFamily:'Cairo', fontWeight:900, fontSize:13, cursor:'pointer' }}>{busy === 'add' ? 'جارٍ...' : '✅ إنشاء الطلب'}</button>
              <button onClick={() => setAddOpen(false)} style={{ background:'transparent', color:'#6B8A80', border:'1.5px solid #E8F5EF', padding:'9px 20px', borderRadius:30, fontFamily:'Cairo', fontWeight:700, fontSize:13, cursor:'pointer' }}>إلغاء</button>
            </div>
          </div>
        )}

        {reqs.length === 0 && <div style={{ color:'#9DB3AB', textAlign:'center', padding:40 }}>لا توجد طلبات بعد</div>}

        {reqs.map((r) => {
          const e = edits[r.id] || { deliverable: r.admin_deliverable || '', price: r.price ? String(r.price) : '' }
          const st = STAT[r.status] || STAT.submitted
          return (
            <div key={r.id} style={{ background:'#fff', border:'2px solid #EAF2EE', borderRadius:16, padding:20, marginBottom:16 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:8, marginBottom:10 }}>
                <div>
                  <div style={{ fontSize:16, fontWeight:900, color:'#1A3D34' }}>{isNew(r.created_at) && <span style={{ background:'#2E9E7B', color:'#fff', fontSize:10, fontWeight:900, padding:'2px 8px', borderRadius:20, marginLeft:6 }}>جديد</span>}{r.service_title}</div>
                  <div style={{ color:'#6B8A80', fontSize:13, fontWeight:600, marginTop:2 }}>{(r.companies?.company_name) || 'شركة'} · {r.companies?.phone || '—'}</div>
                  <div style={{ color:'#9DB3AB', fontSize:11.5, fontWeight:600, marginTop:2 }}>📅 {fmtDate(r.created_at)}</div>
                </div>
                <span style={{ padding:'4px 14px', borderRadius:20, fontSize:12, fontWeight:700, background:st.bg, color:st.fg }}>{st.t}</span>
              </div>

              {r.service_title === 'تجهيز ملف عرض المستثمر والتفاوض' && r.status !== 'delivered' && r.status !== 'completed' && (
                <div style={{ background:'#EAF0FB', border:'1.5px solid #B9CCEC', borderRadius:10, padding:'8px 14px', marginBottom:10, color:'#3B5BA5', fontWeight:900, fontSize:12.5 }}>
                  🎤 المرحلة ١: العرض التقديمي — حدّد مبلغه وأصدره للدفع. بعد تسليمه يظهر عقد تجهيز الملف (المرحلة ٢).
                </div>
              )}
              {(!COMMISSION_SERVICES[r.service_title] || r.service_title === 'تجهيز ملف عرض المستثمر والتفاوض') && (<>
              <button onClick={() => prepare(r.id)} disabled={busy === r.id} style={{ background:'#C9A84C', color:'#1A3D34', border:'none', padding:'9px 20px', borderRadius:30, fontFamily:'Cairo', fontWeight:900, fontSize:13, cursor:'pointer', marginBottom:12 }}>{busy === r.id ? 'جارٍ التجهيز...' : '✨ جهّز الخدمة بمنهجية مُرضي'}</button>

              {r.service_title === 'إعداد القوائم المالية المعتمدة' && (
                <div style={{ marginBottom:14 }}>
                  <button onClick={() => openInputs(r)} style={{ background:'#1A3D34', color:'#fff', border:'none', padding:'8px 18px', borderRadius:30, fontFamily:'Cairo', fontWeight:900, fontSize:12.5, cursor:'pointer' }}>
                    {inputsOpen[r.id] ? '▲ إخفاء أرقام العميل' : '🔢 أدخل أرقام العميل لتوليد قوائم فعلية'}
                  </button>

                  {inputsOpen[r.id] && inputsData[r.id] && (() => {
                    const cur = inputsData[r.id]
                    const setKind = (k: string) => setInputsData(p => ({ ...p, [r.id]: { ...cur, activity_kind: k } }))
                    const setVal = (k: string, v: string) => setInputsData(p => ({ ...p, [r.id]: { ...cur, inputs: { ...cur.inputs, [k]: v } } }))
                    const flds = fieldsFor(cur.activity_kind)
                    const groups: Record<string, string> = { income: '📈 الدخل والتكاليف', assets: '🏦 الأصول', liabilities: '📉 الالتزامات', equity: '💼 حقوق الملكية' }
                    const inp: React.CSSProperties = { width:'100%', border:'1.5px solid #D8E8E0', borderRadius:8, padding:'8px 10px', fontFamily:'Cairo', fontSize:12.5, background:'#fff' }
                    return (
                      <div style={{ background:'#F7FAF9', border:'2px solid #D8E8E0', borderRadius:12, padding:'16px 18px', marginTop:10 }}>
                        <div style={{ color:'#6B8A80', fontSize:12, fontWeight:700, marginBottom:6 }}>نوع النشاط (يكيّف القوائم تلقائياً)</div>
                        <select value={cur.activity_kind} onChange={e => setKind(e.target.value)} style={{ ...inp, marginBottom:16 }}>
                          {ACTIVITIES.map(a => <option key={a.key} value={a.key}>{a.name}</option>)}
                        </select>

                        {(['income','assets','liabilities','equity'] as const).map(g => {
                          const gf = flds.filter(f => f.group === g)
                          if (gf.length === 0) return null
                          return (
                            <div key={g} style={{ marginBottom:14 }}>
                              <div style={{ color:'#1A3D34', fontWeight:900, fontSize:12.5, marginBottom:8 }}>{groups[g]}</div>
                              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                                {gf.map(f => (
                                  <div key={f.key}>
                                    <div style={{ color:'#6B8A80', fontSize:11.5, marginBottom:3 }}>{f.label}{f.hint && <span style={{ color:'#B0C4BC' }}> · {f.hint}</span>}</div>
                                    <div style={{ display:'flex', gap:6 }}>
                                      <input type="number" value={cur.inputs[f.key + '__y1'] ?? ''} onChange={e => setVal(f.key + '__y1', e.target.value)} placeholder="سنة ١" style={inp} />
                                      <input type="number" value={cur.inputs[f.key + '__y2'] ?? ''} onChange={e => setVal(f.key + '__y2', e.target.value)} placeholder="سنة ٢" style={inp} />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )
                        })}

                        <button onClick={() => saveInputs(r)} disabled={busy === r.id} style={{ background:'#2E9E7B', color:'#fff', border:'none', padding:'9px 22px', borderRadius:30, fontFamily:'Cairo', fontWeight:900, fontSize:13, cursor:'pointer', marginTop:6 }}>{busy === r.id ? 'جارٍ الحفظ...' : '💾 احفظ الأرقام'}</button>
                        <div style={{ color:'#9DB3AB', fontSize:11.5, marginTop:8, lineHeight:1.7 }}>اترك أي حقل فارغاً إن لم ينطبق. بعد الحفظ، اضغط «جهّز الخدمة» لتوليد القوائم من هذي الأرقام.</div>
                      </div>
                    )
                  })()}
                </div>
              )}

              {integrity[r.id] && (() => {
                const ig = integrity[r.id]
                const fe = fixEdits[r.id] || {}
                const setFe = (k: string, v: string) => setFixEdits(p => ({ ...p, [r.id]: { ...fe, [k]: v } }))
                const inp: React.CSSProperties = { width:'100%', border:'1.5px solid #E8D9A8', borderRadius:10, padding:'9px 12px', fontFamily:'Cairo', fontSize:13, background:'#fff' }
                return (
                  <div style={{ background:'#FBF5E8', border:'2px solid #E8D9A8', borderRadius:12, padding:'16px 18px', marginBottom:14 }}>
                    <div style={{ color:'#9A7B2E', fontWeight:900, fontSize:14, marginBottom:10 }}>⚠️ تعذّر التوليد — تناقض في البيانات</div>
                    {(ig.issues || []).map((iss: any, i: number) => (
                      <div key={i} style={{ background:'#fff', borderRadius:10, padding:'10px 14px', marginBottom:8 }}>
                        <div style={{ color:'#C0564B', fontWeight:900, fontSize:13, marginBottom:4 }}>{iss.title}</div>
                        <div style={{ color:'#5C4A1F', fontSize:12.5, lineHeight:1.9 }}>{iss.detail}</div>
                      </div>
                    ))}
                    <div style={{ color:'#8A6D1A', fontSize:12.5, fontWeight:900, margin:'14px 0 8px' }}>صحّح بناءً على مستند رسمي:</div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:10 }}>
                      <div>
                        <div style={{ color:'#8A6D1A', fontSize:11.5, marginBottom:4 }}>أصل التمويل</div>
                        <input type="number" value={fe.original_loan_amount ?? ''} onChange={ev => setFe('original_loan_amount', ev.target.value)} style={inp} />
                      </div>
                      <div>
                        <div style={{ color:'#8A6D1A', fontSize:11.5, marginBottom:4 }}>المتبقي من الدين</div>
                        <input type="number" value={fe.debt_remaining ?? ''} onChange={ev => setFe('debt_remaining', ev.target.value)} style={inp} />
                      </div>
                      <div>
                        <div style={{ color:'#8A6D1A', fontSize:11.5, marginBottom:4 }}>الإيراد السنوي</div>
                        <input type="number" value={fe.annual_revenue ?? ''} onChange={ev => setFe('annual_revenue', ev.target.value)} style={inp} />
                      </div>
                    </div>
                    <div style={{ color:'#8A6D1A', fontSize:11.5, marginBottom:4 }}>مصدر التصحيح (إلزامي)</div>
                    <input value={fe.source_note ?? ''} onChange={ev => setFe('source_note', ev.target.value)} placeholder="مثال: كشف رسمي من الجهة الممولة بتاريخ 2026/07/14" style={{ ...inp, marginBottom:12 }} />
                    <button onClick={() => saveCorrection(r.id, ig.companyId)} disabled={busy === r.id} style={{ background:'#9A7B2E', color:'#fff', border:'none', padding:'9px 22px', borderRadius:30, fontFamily:'Cairo', fontWeight:900, fontSize:13, cursor:'pointer' }}>{busy === r.id ? 'جارٍ...' : '💾 اعتمد التصحيح وولّد'}</button>
                  </div>
                )
              })()}

              <textarea value={e.deliverable} onChange={(ev) => setEdits(p => ({ ...p, [r.id]: { ...e, deliverable: ev.target.value } }))} placeholder="محتوى الخدمة (يُجهّز بالذكاء أو اكتبه يدوياً)..." style={{ width:'100%', minHeight:140, border:'1.5px solid #EAF2EE', borderRadius:12, padding:12, fontFamily:'Cairo', fontSize:13, lineHeight:1.8, color:'#1A3D34', marginBottom:10 }} />

              <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
                <input value={e.price} onChange={(ev) => setEdits(p => ({ ...p, [r.id]: { ...e, price: ev.target.value } }))} placeholder="السعر (ر.س)" type="number" style={{ width:140, border:'1.5px solid #EAF2EE', borderRadius:30, padding:'9px 16px', fontFamily:'Cairo', fontSize:13 }} />
                <button onClick={() => save(r.id, e.deliverable, e.price)} disabled={busy === r.id} style={{ background:'transparent', color:'#6B8A80', border:'1.5px solid #E8F5EF', padding:'9px 20px', borderRadius:30, fontFamily:'Cairo', fontWeight:700, fontSize:13, cursor:'pointer' }}>حفظ مسودّة</button>
                <button onClick={() => save(r.id, e.deliverable, e.price, 'priced')} disabled={busy === r.id || !e.price} title={!e.price ? 'حدّد السعر أولاً' : ''} style={{ background:'#C9A84C', color:'#1A3D34', border:'none', padding:'9px 22px', borderRadius:30, fontFamily:'Cairo', fontWeight:900, fontSize:13, cursor:'pointer' }}>💰 أصدر للدفع</button>
                <button onClick={() => save(r.id, e.deliverable, e.price, 'delivered')} disabled={busy === r.id || !e.deliverable} style={{ background:'#2E9E7B', color:'#fff', border:'none', padding:'9px 22px', borderRadius:30, fontFamily:'Cairo', fontWeight:900, fontSize:13, cursor:'pointer' }}>📤 إصدار مباشر</button>
                {r.status === 'paid' && <button onClick={() => save(r.id, e.deliverable, e.price, 'delivered')} disabled={busy === r.id || !e.deliverable} style={{ background:'#1E7A5A', color:'#fff', border:'none', padding:'9px 22px', borderRadius:30, fontFamily:'Cairo', fontWeight:900, fontSize:13, cursor:'pointer' }}>🔓 سلّم المحتوى</button>}
                {r.status === 'delivered' && <button onClick={() => save(r.id, e.deliverable, e.price, 'completed')} disabled={busy === r.id} style={{ background:'#1A3D34', color:'#fff', border:'none', padding:'9px 22px', borderRadius:30, fontFamily:'Cairo', fontWeight:900, fontSize:13, cursor:'pointer' }}>🏆 إتمام</button>}
                {r.status !== 'completed' && r.status !== 'rejected' && r.status !== 'delivered' && <button onClick={() => { if (confirm('هل أنت متأكد من رفض هذه الخدمة؟')) save(r.id, e.deliverable, e.price, 'rejected') }} disabled={busy === r.id} style={{ background:'transparent', color:'#C0564B', border:'1.5px solid #F0D5D1', padding:'9px 20px', borderRadius:30, fontFamily:'Cairo', fontWeight:700, fontSize:13, cursor:'pointer' }}>✕ رفض الخدمة</button>}
              </div>
              </>)}
              {COMMISSION_SERVICES[r.service_title] && (r.service_title !== 'تجهيز ملف عرض المستثمر والتفاوض' || r.status === 'delivered' || r.status === 'completed') && (() => {
                const c = contracts[r.id]
                return (<>
                <div style={{ marginTop:16 }}>
                  <button onClick={() => generateFile(r)} disabled={busy === r.id} style={{ background:'#1A3D34', color:'#fff', border:'none', padding:'9px 20px', borderRadius:30, fontFamily:'Cairo', fontWeight:900, fontSize:13, cursor:'pointer' }}>{busy === r.id ? 'جارٍ التوليد...' : '📄 جهّز الملف الاحترافي'}</button>
                </div>
                {(() => {
                if (!c) {
                  return (
                    <div style={{ marginTop:16, paddingTop:16, borderTop:'1px dashed #EAD9A8' }}>
                      <div style={{ color:'#9A7B2E', fontWeight:900, fontSize:13, marginBottom:8 }}>📄 هذه خدمة بعمولة نجاح — تحتاج عقداً</div>
                      <button onClick={() => createContract(r)} disabled={busy === r.id} style={{ background:'#C9A84C', color:'#1A3D34', border:'none', padding:'9px 20px', borderRadius:30, fontFamily:'Cairo', fontWeight:900, fontSize:13, cursor:'pointer' }}>إنشاء مسودّة العقد</button>
                    </div>
                  )
                }
                const ce = cEdits[c.id] || {}
                const val = (k: string) => ce[k] !== undefined ? ce[k] : (c[k] ?? '')
                const setC = (k: string, v: string) => setCEdits(p => ({ ...p, [c.id]: { ...ce, [k]: v } }))
                const cStat: Record<string, string> = { draft: '📝 مسودّة', issued: '📤 صادر للعميل', signed: '✍️ وقّعه العميل', completed: '🏆 مكتمل (عمولة)' }
                return (
                  <div style={{ marginTop:16, paddingTop:16, borderTop:'1px dashed #EAD9A8' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                      <div style={{ color:'#9A7B2E', fontWeight:900, fontSize:14 }}>📄 عقد {c.contract_type === 'investment' ? 'تجهيز ملف استثماري' : 'تجهيز ملف تمويلي'}</div>
                      <span style={{ fontSize:12, fontWeight:700, color:'#6B8A80' }}>{cStat[c.status] || c.status}</span>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10 }}>
                      <input value={val('client_name')} onChange={e=>setC('client_name', e.target.value)} placeholder="اسم العميل (الطرف الثاني)" style={{ border:'1.5px solid #EAF2EE', borderRadius:10, padding:'8px 12px', fontFamily:'Cairo', fontSize:12.5 }} />
                      <input value={val('client_id_number')} onChange={e=>setC('client_id_number', e.target.value)} placeholder="رقم الهوية" style={{ border:'1.5px solid #EAF2EE', borderRadius:10, padding:'8px 12px', fontFamily:'Cairo', fontSize:12.5 }} />
                      <input value={val('establishment_name')} onChange={e=>setC('establishment_name', e.target.value)} placeholder="اسم المنشأة" style={{ border:'1.5px solid #EAF2EE', borderRadius:10, padding:'8px 12px', fontFamily:'Cairo', fontSize:12.5 }} />
                      <input value={val('establishment_cr')} onChange={e=>setC('establishment_cr', e.target.value)} placeholder="السجل التجاري" style={{ border:'1.5px solid #EAF2EE', borderRadius:10, padding:'8px 12px', fontFamily:'Cairo', fontSize:12.5 }} />
                      <input value={val('fee_percent')} onChange={e=>setC('fee_percent', e.target.value)} type="number" placeholder="نسبة الأتعاب ٪" style={{ border:'1.5px solid #EAF2EE', borderRadius:10, padding:'8px 12px', fontFamily:'Cairo', fontSize:12.5 }} />
                    </div>
                    <textarea value={val('contract_body')} onChange={e=>setC('contract_body', e.target.value)} style={{ width:'100%', minHeight:160, border:'1.5px solid #EAF2EE', borderRadius:12, padding:12, fontFamily:'Cairo', fontSize:12, lineHeight:1.9, color:'#1A3D34', marginBottom:10, whiteSpace:'pre-wrap' }} />
                    <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                      <button onClick={() => saveContract(c)} disabled={busy === r.id} style={{ background:'transparent', color:'#6B8A80', border:'1.5px solid #E8F5EF', padding:'8px 18px', borderRadius:30, fontFamily:'Cairo', fontWeight:700, fontSize:12.5, cursor:'pointer' }}>حفظ المسودّة</button>
                      <button onClick={() => saveContract(c, 'issued')} disabled={busy === r.id} style={{ background:'#2E9E7B', color:'#fff', border:'none', padding:'8px 20px', borderRadius:30, fontFamily:'Cairo', fontWeight:900, fontSize:12.5, cursor:'pointer' }}>📤 إصدار العقد للعميل</button>
                      {(c.status === 'signed' || c.status === 'issued') && <button onClick={() => saveContract(c, 'completed')} disabled={busy === r.id} style={{ background:'#1A3D34', color:'#fff', border:'none', padding:'8px 20px', borderRadius:30, fontFamily:'Cairo', fontWeight:900, fontSize:12.5, cursor:'pointer' }}>🏆 إتمام (استحقاق العمولة)</button>}
                    </div>
                    {c.signed_file_url && <a href={c.signed_file_url} target="_blank" rel="noopener noreferrer" style={{ display:'inline-block', marginTop:8, color:'#2E9E7B', fontWeight:700, fontSize:12.5 }}>📎 عرض النسخة الموقّعة من العميل</a>}
                  </div>
                )
                })()}
                </>)
              })()}
            </div>
          )
        })}
      </div>
    </div>
  )
}
