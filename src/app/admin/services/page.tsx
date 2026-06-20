'use client'
import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'

const ADMIN_EMAIL = 'hololalmurdi.fs@gmail.com'
const fmtDate = (d: string) => d ? new Date(d).toLocaleString('ar-SA', { year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }) : '—'
const isNew = (d: string) => d ? (Date.now() - new Date(d).getTime()) < 48*60*60*1000 : false

const STAT: Record<string, { t: string; bg: string; fg: string }> = {
  submitted: { t: 'بانتظار التجهيز', bg: '#FBF5E8', fg: '#9A7B2E' },
  in_progress: { t: 'تم التجهيز — بانتظار الإصدار', bg: '#EAF0FB', fg: '#3B5BA5' },
  delivered: { t: 'صادرة للعميل', bg: '#EAF7F0', fg: '#1E7A5A' },
  completed: { t: 'مكتملة', bg: '#EAF7F0', fg: '#1E7A5A' },
}

export default function AdminServicesPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [reqs, setReqs] = useState<any[]>([])
  const [busy, setBusy] = useState('')
  const [edits, setEdits] = useState<Record<string, { deliverable: string; price: string }>>({})

  const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string)

  async function load() {
    const res = await fetch('/api/admin/service-requests')
    if (res.ok) { const d = await res.json(); setReqs(d.requests || []) }
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

  async function save(id: string, deliverable: string, price: string, status?: string) {
    setBusy(id)
    await fetch('/api/admin/service-requests', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, admin_deliverable: deliverable, price: price ? Number(price) : null, status }) })
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
      <div style={{ background:'#fff', padding:'0 32px', display:'flex', gap:8, borderBottom:'2px solid #EAF2EE' }}>
        <div onClick={()=>router.push('/admin')} style={{ padding:'14px 22px', color:'#6B8A80', fontWeight:700, fontSize:14, cursor:'pointer' }}>لوحة التحكم</div>
        <div onClick={()=>router.push('/admin/approvals')} style={{ padding:'14px 22px', color:'#6B8A80', fontWeight:700, fontSize:14, cursor:'pointer' }}>الاعتمادات</div>
        <div onClick={()=>router.push('/admin/entities')} style={{ padding:'14px 22px', color:'#6B8A80', fontWeight:700, fontSize:14, cursor:'pointer' }}>الجهات</div>
        <div style={{ padding:'14px 22px', color:'#2E9E7B', fontWeight:900, fontSize:14, borderBottom:'2px solid #2E9E7B' }}>الخدمات</div>
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

              <button onClick={() => prepare(r.id)} disabled={busy === r.id} style={{ background:'#C9A84C', color:'#1A3D34', border:'none', padding:'9px 20px', borderRadius:30, fontFamily:'Cairo', fontWeight:900, fontSize:13, cursor:'pointer', marginBottom:12 }}>{busy === r.id ? 'جارٍ التجهيز...' : '✨ جهّز الخدمة بالذكاء'}</button>

              <textarea value={e.deliverable} onChange={(ev) => setEdits(p => ({ ...p, [r.id]: { ...e, deliverable: ev.target.value } }))} placeholder="محتوى الخدمة (يُجهّز بالذكاء أو اكتبه يدوياً)..." style={{ width:'100%', minHeight:140, border:'1.5px solid #EAF2EE', borderRadius:12, padding:12, fontFamily:'Cairo', fontSize:13, lineHeight:1.8, color:'#1A3D34', marginBottom:10 }} />

              <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
                <input value={e.price} onChange={(ev) => setEdits(p => ({ ...p, [r.id]: { ...e, price: ev.target.value } }))} placeholder="السعر (ر.س)" type="number" style={{ width:140, border:'1.5px solid #EAF2EE', borderRadius:30, padding:'9px 16px', fontFamily:'Cairo', fontSize:13 }} />
                <button onClick={() => save(r.id, e.deliverable, e.price)} disabled={busy === r.id} style={{ background:'transparent', color:'#6B8A80', border:'1.5px solid #E8F5EF', padding:'9px 20px', borderRadius:30, fontFamily:'Cairo', fontWeight:700, fontSize:13, cursor:'pointer' }}>حفظ مسودّة</button>
                <button onClick={() => save(r.id, e.deliverable, e.price, 'delivered')} disabled={busy === r.id || !e.deliverable} style={{ background:'#2E9E7B', color:'#fff', border:'none', padding:'9px 22px', borderRadius:30, fontFamily:'Cairo', fontWeight:900, fontSize:13, cursor:'pointer' }}>📤 إصدار للعميل</button>
                {r.status === 'delivered' && <button onClick={() => save(r.id, e.deliverable, e.price, 'completed')} disabled={busy === r.id} style={{ background:'#1A3D34', color:'#fff', border:'none', padding:'9px 22px', borderRadius:30, fontFamily:'Cairo', fontWeight:900, fontSize:13, cursor:'pointer' }}>🏆 إتمام</button>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
