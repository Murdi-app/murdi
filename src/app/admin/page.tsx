'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const C = { navy:'#0B1C3D', navyLight:'#112244', border:'#1E3A6E', gold:'#F5C842', white:'#fff', gray:'#8899BB' }
const fmt = (n: number) => n?.toLocaleString('ar-SA') || '0'
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
      const { data: profiles } = await supabase.from('profiles').select('*')
      const { data: monthly } = await supabase.from('monthly_data').select('*').order('created_at', { ascending: false })
      const totalUsers = profiles?.length || 0
      const totalReports = monthly?.length || 0
      const avgScore = monthly?.length ? Math.round(monthly.reduce((a,m) => a + (m.murdi_score||0), 0) / monthly.length) : 0
      const now = new Date()
      const activeThisMonth = monthly?.filter(m => m.month === now.getMonth()+1 && m.year === now.getFullYear()).length || 0
      setStats({ totalUsers, totalReports, avgScore, activeThisMonth })
      setUsers(profiles || [])
      setReports(monthly || [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div style={{background:C.navy,minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center'}}><div style={{color:C.gold,fontSize:20}}>...</div></div>

  return (
    <div style={{minHeight:'100vh',background:C.navy,fontFamily:'system-ui',direction:'rtl'}}>
      <div style={{background:C.navyLight,padding:'16px 32px',display:'flex',justifyContent:'space-between',alignItems:'center',borderBottom:`1px solid ${C.border}`}}>
        <div style={{fontSize:20,fontWeight:900,color:C.gold}}>MURDI ADMIN</div>
        <button onClick={()=>router.push('/dashboard')} style={{padding:'8px 16px',borderRadius:8,border:`1px solid ${C.border}`,background:'transparent',color:C.gray,cursor:'pointer',fontSize:13}}>الداشبورد</button>
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
            const userReports = reports.filter(r => r.user_id === u.id)
            const last = userReports[0]
            return (
              <div key={i} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 0',borderBottom:i<users.length-1?`1px solid ${C.border}`:'none',flexWrap:'wrap',gap:8}}>
                <div>
                  <div style={{color:C.white,fontSize:14,fontWeight:700}}>{u.company_name||'بدون اسم'}</div>
                  <div style={{color:C.gray,fontSize:12}}>{u.email}</div>
                </div>
                <div style={{display:'flex',gap:16,alignItems:'center'}}>
                  <div style={{textAlign:'center'}}><div style={{color:C.gray,fontSize:10}}>التقارير</div><div style={{color:C.white,fontSize:14,fontWeight:700}}>{userReports.length}</div></div>
                  {last && <div style={{textAlign:'center'}}><div style={{color:C.gray,fontSize:10}}>آخر Score</div><div style={{color:last.murdi_score>=70?'#22c55e':last.murdi_score>=40?C.gold:'#ef4444',fontSize:14,fontWeight:700}}>{last.murdi_score}/85</div></div>}
                  {last && <div style={{textAlign:'center'}}><div style={{color:C.gray,fontSize:10}}>آخر تقرير</div><div style={{color:C.white,fontSize:12}}>{MONTH_NAMES[last.month-1]} {last.year}</div></div>}
                </div>
              </div>
            )
          })}
        </div>
        <div style={{background:C.navyLight,borderRadius:16,padding:'24px',border:`1px solid ${C.border}`}}>
          <div style={{color:C.gold,fontSize:16,fontWeight:700,marginBottom:16}}>آخر التقارير</div>
          {reports.slice(0,10).map((r,i) => {
            const u = users.find(x => x.id === r.user_id)
            return (
              <div key={i} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 0',borderBottom:i<9?`1px solid ${C.border}`:'none',flexWrap:'wrap',gap:8}}>
                <div>
                  <div style={{color:C.white,fontSize:13,fontWeight:600}}>{u?.company_name||'غير معروف'}</div>
                  <div style={{color:C.gray,fontSize:11}}>{MONTH_NAMES[r.month-1]} {r.year}</div>
                </div>
                <div style={{display:'flex',gap:12,alignItems:'center'}}>
                  <div style={{textAlign:'center'}}><div style={{color:C.gray,fontSize:10}}>Score</div><div style={{color:r.murdi_score>=70?'#22c55e':r.murdi_score>=40?C.gold:'#ef4444',fontSize:14,fontWeight:700}}>{r.murdi_score}</div></div>
                  <div style={{textAlign:'center'}}><div style={{color:C.gray,fontSize:10}}>الإيرادات</div><div style={{color:C.white,fontSize:12}}>{fmt(r.revenue)} ر.س</div></div>
                  <div style={{textAlign:'center'}}><div style={{color:C.gray,fontSize:10}}>التمويل</div><div style={{color:C.white,fontSize:12}}>{r.funding_score||0}/100</div></div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
