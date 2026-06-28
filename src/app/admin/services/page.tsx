'use client'
import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import AdminNav from '@/components/AdminNav'
import { COMMISSION_SERVICES } from '@/lib/contracts'

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

  async function prepare(id: string) {
    setBusy(id)
    const res = await fetch('/api/admin/prepare-service', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId: id }) })
    if (res.ok) { const d = await res.json(); setEdits(p => ({ ...p, [id]: { deliverable: d.deliverable || '', price: edits[id]?.price || '' } })) }
    await load()
    setBusy('')
  }

  async function generateFile(r: any) {
    setBusy(r.id)
    const track = r.service_title === 'تجهيز ملف عرض المستثمر والتفاوض' ? 'investment' : 'funding'
    try {
      const res = await fetch('/api/admin/generate-file', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ company_id: r.company_id, track }) })
      const d = await res.json()
      if (d.ok && d.html) {
        const w = window.open('', '_blank')
        if (w) { w.document.write(d.html); w.document.close() }
      } else {
        alert(d.error || 'تعذّر توليد الملف')
      }
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
        <p style={{ color:'#6B8A80', fontSize:14, fontWeight:600, marginBottom:24 }}>جهّز الخدمة، حدّد السعر بعد التفاوض، ثم أصدرها للعميل</p>

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
