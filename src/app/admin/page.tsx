'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const fmtDate = (d: string) => d ? new Date(d).toLocaleString('ar-SA', { year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }) : '—'
const ADMIN_EMAIL = 'hololalmurdi.fs@gmail.com'
const scoreColor = (s: number) => s >= 70 ? '#2E9E7B' : s >= 40 ? '#C9A84C' : '#D96A6A'

export default function AdminPage() {
  const supabase = createClient()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<any>(null)
  const [users, setUsers] = useState<any[]>([])
  const [reports, setReports] = useState<any[]>([])

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || user.email !== ADMIN_EMAIL) { router.push('/'); return }
      const { data: companies } = await supabase.from('companies').select('*').order('created_at', { ascending: false })
      const { data: results } = await supabase.from('readiness_results').select('*').order('created_at', { ascending: false })
      const totalUsers = companies?.length || 0
      const totalReports = results?.length || 0
      const avgScore = results?.length ? Math.round(results.reduce((a:number,m:any) => a + (m.readiness_score||0), 0) / results.length) : 0
      const now = new Date()
      const activeThisMonth = results?.filter((m:any) => { const d = new Date(m.created_at); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() }).length || 0
      setStats({ totalUsers, totalReports, avgScore, activeThisMonth })
      setUsers(companies || [])
      setReports(results || [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return (
    <div style={{ minHeight:'100vh', background:'#FBFCFB', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Cairo,sans-serif' }}>
      <div style={{ color:'#2E9E7B', fontSize:18, fontWeight:700 }}>جارٍ التحميل...</div>
    </div>
  )

  const stat = [
    { label:'إجمالي الشركات', value:stats.totalUsers, color:'#1A3D34' },
    { label:'إجمالي التقييمات', value:stats.totalReports, color:'#2E9E7B' },
    { label:'نشطون هذا الشهر', value:stats.activeThisMonth, color:'#C9A84C' },
    { label:'متوسط درجة الجاهزية', value:stats.avgScore, color:'#1A3D34' },
  ]

  return (
    <div dir="rtl" style={{ minHeight:'100vh', background:'#FBFCFB', fontFamily:'Cairo,sans-serif' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Amiri:wght@700&family=Cairo:wght@400;600;700;900&display=swap');`}</style>

      <div style={{ background:'#fff', padding:'16px 32px', display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'1px solid #EAF2EE' }}>
        <div style={{ fontSize:22, fontWeight:700, color:'#1A3D34', fontFamily:'Amiri,serif' }}>مُرضي <span style={{ fontSize:13, color:'#C9A84C', fontWeight:900, fontFamily:'Cairo' }}>ADMIN</span></div>
        <button onClick={()=>router.push('/goal')} style={{ padding:'8px 18px', borderRadius:30, border:'1px solid #E8F5EF', background:'transparent', color:'#6B8A80', cursor:'pointer', fontSize:13, fontFamily:'Cairo', fontWeight:700 }}>المركز الرئيسي</button>
      </div>

      <div style={{ background:'#fff', padding:'0 32px', display:'flex', gap:8, borderBottom:'2px solid #EAF2EE' }}>
        <div style={{ padding:'14px 22px', color:'#2E9E7B', fontWeight:900, fontSize:14, borderBottom:'2px solid #2E9E7B' }}>لوحة التحكم</div>
        <div onClick={()=>router.push('/admin/approvals')} style={{ padding:'14px 22px', color:'#6B8A80', fontWeight:700, fontSize:14, cursor:'pointer' }}>الاعتمادات</div>
        <div onClick={()=>router.push('/admin/entities')} style={{ padding:'14px 22px', color:'#6B8A80', fontWeight:700, fontSize:14, cursor:'pointer' }}>الجهات</div>
      </div>

      <div style={{ maxWidth:1000, margin:'0 auto', padding:'32px 24px' }}>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:16, marginBottom:32 }}>
          {stat.map((s,i) => (
            <div key={i} style={{ background:'#fff', borderRadius:18, padding:'24px', border:'2px solid #EAF2EE', textAlign:'center' }}>
              <div style={{ fontSize:40, fontWeight:900, color:s.color, marginBottom:4 }}>{s.value}</div>
              <div style={{ color:'#6B8A80', fontSize:12.5, fontWeight:700 }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div style={{ background:'#fff', borderRadius:18, padding:'24px', border:'2px solid #EAF2EE', marginBottom:24 }}>
          <div style={{ color:'#1A3D34', fontSize:16, fontWeight:900, marginBottom:16 }}>الشركات المسجلة <span style={{ color:'#2E9E7B' }}>({users.length})</span></div>
          {users.map((u,i) => {
            const userReports = reports.filter(r => r.company_id === u.id)
            const last = userReports[0]
            return (
              <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 0', borderBottom: i<users.length-1 ? '1px solid #F0F5F3' : 'none', flexWrap:'wrap', gap:8 }}>
                <div>
                  <div style={{ color:'#1A3D34', fontSize:15, fontWeight:900 }}>{u.company_name || 'بدون اسم'}</div>
                  <div style={{ color:'#6B8A80', fontSize:12.5, fontWeight:600 }}>{u.email}</div>
                  <div style={{ color:'#9DB3AB', fontSize:11.5, fontWeight:600, marginTop:3 }}>📅 سجّل: {fmtDate(u.created_at)}</div>
                </div>
                <div style={{ display:'flex', gap:18, alignItems:'center' }}>
                  <div style={{ textAlign:'center' }}><div style={{ color:'#9DB3AB', fontSize:10, fontWeight:700 }}>التقييمات</div><div style={{ color:'#1A3D34', fontSize:14, fontWeight:900 }}>{userReports.length}</div></div>
                  {last && <div style={{ textAlign:'center' }}><div style={{ color:'#9DB3AB', fontSize:10, fontWeight:700 }}>آخر درجة</div><div style={{ color:scoreColor(last.readiness_score), fontSize:14, fontWeight:900 }}>{last.readiness_score}/100</div></div>}
                  {last && <div style={{ textAlign:'center' }}><div style={{ color:'#9DB3AB', fontSize:10, fontWeight:700 }}>آخر تقييم</div><div style={{ color:'#6B8A80', fontSize:11.5, fontWeight:600 }}>{fmtDate(last.created_at)}</div></div>}
                </div>
              </div>
            )
          })}
          {users.length === 0 && <div style={{ color:'#9DB3AB', fontSize:14, textAlign:'center', padding:20 }}>لا توجد شركات بعد</div>}
        </div>

        <div style={{ background:'#fff', borderRadius:18, padding:'24px', border:'2px solid #EAF2EE' }}>
          <div style={{ color:'#1A3D34', fontSize:16, fontWeight:900, marginBottom:16 }}>آخر التقييمات</div>
          {reports.slice(0,10).map((r,i) => {
            const u = users.find(x => x.id === r.company_id)
            return (
              <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 0', borderBottom: i<Math.min(reports.length,10)-1 ? '1px solid #F0F5F3' : 'none', flexWrap:'wrap', gap:8 }}>
                <div>
                  <div style={{ color:'#1A3D34', fontSize:13.5, fontWeight:700 }}>{u?.company_name || 'غير معروف'}</div>
                  <div style={{ color:'#9DB3AB', fontSize:11.5, fontWeight:600 }}>{fmtDate(r.created_at)}</div>
                </div>
                <div style={{ display:'flex', gap:14, alignItems:'center' }}>
                  <div style={{ textAlign:'center' }}><div style={{ color:'#9DB3AB', fontSize:10, fontWeight:700 }}>الدرجة</div><div style={{ color:scoreColor(r.readiness_score), fontSize:14, fontWeight:900 }}>{r.readiness_score}/100</div></div>
                  <div style={{ textAlign:'center' }}><div style={{ color:'#9DB3AB', fontSize:10, fontWeight:700 }}>المسار</div><div style={{ color:'#1A3D34', fontSize:12, fontWeight:700 }}>{r.result_type || '—'}</div></div>
                </div>
              </div>
            )
          })}
          {reports.length === 0 && <div style={{ color:'#9DB3AB', fontSize:14, textAlign:'center', padding:20 }}>لا توجد تقييمات بعد</div>}
        </div>

      </div>
    </div>
  )
}
