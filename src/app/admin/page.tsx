'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const C = { navy:'#0B1C3D', navyLight:'#112244', border:'#1E3A6E', gold:'#F5C842', white:'#fff', gray:'#8899BB' }
const fmt = (n: number) => n?.toLocaleString('ar-SA') || '0'
const fmtDate = (d: string) => d ? new Date(d).toLocaleString('ar-SA', { year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }) : '—'
const ADMIN_EMAIL = 'hololalmurdi.fs@gmail.com'
const MONTH_NAMES = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']

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
      const avgScore = results?.length ? Math.round(results.reduce((a,m) => a + (m.readiness_score||0), 0) / results.length) : 0
      const now = new Date()
      const activeThisMonth = results?.filter(m => { const d = new Date(m.created_at); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() }).length || 0
      setStats({ totalUsers, totalReports, avgScore, activeThisMonth })
      setUsers(companies || [])
      setReports(results || [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div style={{background:C.navy,minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center'}}><div style={{color:C.gold,fontSize:20}}>...</div></div>

  return (
    <div style={{minHeight:'100vh',background:C.navy,fontFamily:'system-ui',direction:'rtl'}}>
      <div style={{background:C.navyLight,padding:'16px 32px',display:'flex',justifyContent:'space-between',alignItems:'center',borderBottom:`1px solid ${C.border}`}}>
        <div style={{fontSize:20,fontWeight:900,color:C.gold}}>MURDI ADMIN</div>
        <button onClick={()=>router.push('/goal')} style={{padding:'8px 16px',borderRadius:8,border:`1px solid ${C.border}`,background:'transparent',color:C.gray,cursor:'pointer',fontSize:13}}>المركز الرئيسي</button>
      </div>
      <div style={{background:C.navyLight,padding:'0 32px',display:'flex',gap:8,borderBottom:`1px solid ${C.border}`}}>
        <div style={{padding:'14px 22px',color:C.gold,fontWeight:700,fontSize:14,borderBottom:`2px solid ${C.gold}`,cursor:'default'}}>لوحة التحكم</div>
        <div onClick={()=>router.push('/admin/approvals')} style={{padding:'14px 22px',color:C.gray,fontWeight:700,fontSize:14,cursor:'pointer'}}>الاعتمادات</div>
        <div onClick={()=>router.push('/admin/entities')} style={{padding:'14px 22px',color:C.gray,fontWeight:700,fontSize:14,cursor:'pointer'}}>الجهات</div>
      </div>
      <div style={{maxWidth:1000,margin:'0 auto',padding:'32px 24px'}}>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:16,marginBottom:32}}>
          {[
            {label:'إجمالي الشركات', value:stats.totalUsers, color:C.gold},
            {label:'إجمالي التقارير', value:stats.totalReports, color:'#3b82f6'},
            {label:'نشطون هذا الشهر', value:stats.activeThisMonth, color:'#22c55e'},
            {label:'متوسط Murdi Score', value:stats.avgScore, color:'#a855f7'},
          ].map((s,i) => (
            <div key={i} style={{background:C.navyLight,borderRadius:16,padding:'24px',border:`1px solid ${C.border}`,textAlign:'center'}}>
              <div style={{fontSize:40,fontWeight:900,color:s.color,marginBottom:4}}>{s.value}</div>
              <div style={{color:C.gray,fontSize:12}}>{s.label}</div>
            </div>
          ))}
        </div>
        <div style={{background:C.navyLight,borderRadius:16,padding:'24px',border:`1px solid ${C.border}`,marginBottom:24}}>
          <div style={{color:C.gold,fontSize:16,fontWeight:700,marginBottom:16}}>الشركات المسجلة ({users.length})</div>
          {users.map((u,i) => {
            const userReports = reports.filter(r => r.company_id === u.id)
            const last = userReports[0]
            return (
              <div key={i} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 0',borderBottom:i<users.length-1?`1px solid ${C.border}`:'none',flexWrap:'wrap',gap:8}}>
                <div>
                  <div style={{color:C.white,fontSize:14,fontWeight:700}}>{u.company_name||'بدون اسم'}</div>
                  <div style={{color:C.gray,fontSize:12}}>{u.email}</div>
                  <div style={{color:C.gray,fontSize:11,marginTop:2}}>📅 سجّل: {fmtDate(u.created_at)}</div>
                </div>
                <div style={{display:'flex',gap:16,alignItems:'center'}}>
                  <div style={{textAlign:'center'}}><div style={{color:C.gray,fontSize:10}}>التقارير</div><div style={{color:C.white,fontSize:14,fontWeight:700}}>{userReports.length}</div></div>
                  {last && <div style={{textAlign:'center'}}><div style={{color:C.gray,fontSize:10}}>آخر Score</div><div style={{color:last.readiness_score>=70?'#22c55e':last.readiness_score>=40?C.gold:'#ef4444',fontSize:14,fontWeight:700}}>{last.readiness_score}/100</div></div>}
                  {last && <div style={{textAlign:'center'}}><div style={{color:C.gray,fontSize:10}}>آخر تقييم</div><div style={{color:C.white,fontSize:12}}>{fmtDate(last.created_at)}</div></div>}
                </div>
              </div>
            )
          })}
        </div>
        <div style={{background:C.navyLight,borderRadius:16,padding:'24px',border:`1px solid ${C.border}`}}>
          <div style={{color:C.gold,fontSize:16,fontWeight:700,marginBottom:16}}>آخر التقارير</div>
          {reports.slice(0,10).map((r,i) => {
            const u = users.find(x => x.id === r.company_id)
            return (
              <div key={i} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 0',borderBottom:i<9?`1px solid ${C.border}`:'none',flexWrap:'wrap',gap:8}}>
                <div>
                  <div style={{color:C.white,fontSize:13,fontWeight:600}}>{u?.company_name||'غير معروف'}</div>
                  <div style={{color:C.gray,fontSize:11}}>{fmtDate(r.created_at)}</div>
                </div>
                <div style={{display:'flex',gap:12,alignItems:'center'}}>
                  <div style={{textAlign:'center'}}><div style={{color:C.gray,fontSize:10}}>Score</div><div style={{color:r.readiness_score>=70?'#22c55e':r.readiness_score>=40?C.gold:'#ef4444',fontSize:14,fontWeight:700}}>{r.readiness_score}/100</div></div>
                  <div style={{textAlign:'center'}}><div style={{color:C.gray,fontSize:10}}>المسار</div><div style={{color:C.white,fontSize:12}}>{r.result_type||'—'}</div></div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
