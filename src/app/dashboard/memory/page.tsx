'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const C = { navy:'#0B1C3D', navyLight:'#112244', border:'#1E3A6E', gold:'#F5C842', goldLight:'#E6A800', white:'#fff', gray:'#8899BB' }

const MONTHS = ['','يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']

export default function Memory() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [records, setRecords] = useState<any[]>([])
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      setUser(user)
      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(p)
      const { data: r } = await supabase.from('monthly_data').select('*').eq('user_id', user.id).order('year',{ascending:false}).order('month',{ascending:false})
      setRecords(r || [])
    }
    load()
  }, [])

  const scoreColor = (s: number) => s >= 70 ? '#22c55e' : s >= 40 ? '#F5C842' : '#ef4444'

  const fmt = (n: number) => n?.toLocaleString('ar-SA') || '0'

  return (
    <div style={{minHeight:'100vh',background:C.navy,fontFamily:'system-ui',direction:'rtl'}}>
      {/* Header */}
      <div style={{background:C.navyLight,padding:'16px 32px',display:'flex',justifyContent:'space-between',alignItems:'center',borderBottom:`1px solid ${C.border}`}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <div style={{fontSize:22,fontWeight:900,color:C.gold,letterSpacing:2}}>MURDI</div>
          <div style={{fontSize:11,color:C.gray,letterSpacing:1}}>CONSTRUCTION INTELLIGENCE</div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <button onClick={()=>router.push('/dashboard')} style={{padding:'8px 16px',borderRadius:8,border:`1px solid ${C.gold}`,background:'transparent',color:C.gold,cursor:'pointer',fontSize:13}}>
            ← Dashboard
          </button>
          <button onClick={async()=>{await supabase.auth.signOut();router.push('/auth/login')}} style={{padding:'8px 16px',borderRadius:8,border:`1px solid ${C.border}`,background:'transparent',color:C.gray,cursor:'pointer',fontSize:13}}>
            خروج
          </button>
        </div>
      </div>

      <div style={{maxWidth:1000,margin:'0 auto',padding:'32px 24px'}}>
        <div style={{marginBottom:24}}>
          <div style={{color:C.white,fontSize:22,fontWeight:800}}>Company Memory</div>
          <div style={{color:C.gray,fontSize:14,marginTop:4}}>{profile?.company_name} — سجل الأداء الشهري</div>
        </div>

        {records.length === 0 ? (
          <div style={{background:C.navyLight,borderRadius:16,padding:'48px',textAlign:'center',border:`1px solid ${C.border}`}}>
            <div style={{color:C.gray,fontSize:16}}>لا توجد بيانات محفوظة بعد</div>
            <button onClick={()=>router.push('/dashboard')} style={{marginTop:16,padding:'12px 24px',borderRadius:8,border:'none',background:C.gold,color:C.navy,fontWeight:700,cursor:'pointer'}}>
              أدخل بيانات الشهر
            </button>
          </div>
        ) : (
          <div style={{display:'flex',flexDirection:'column',gap:16}}>
            {records.map((r,i) => (
              <div key={i} style={{background:C.navyLight,borderRadius:16,padding:'24px',border:`1px solid ${C.border}`}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
                  <div style={{color:C.white,fontSize:17,fontWeight:700}}>{MONTHS[r.month]} {r.year}</div>
                  <div style={{textAlign:'center'}}>
                    <div style={{fontSize:36,fontWeight:900,color:scoreColor(r.murdi_score)}}>{r.murdi_score}</div>
                    <div style={{color:C.gray,fontSize:11}}>Murdi Score</div>
                  </div>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12}}>
                  {[
                    {label:'الإيرادات',value:fmt(r.revenue)+' ر.س'},
                    {label:'المصروفات',value:fmt(r.expenses)+' ر.س'},
                    {label:'الرصيد البنكي',value:fmt(r.bank_balance)+' ر.س'},
                    {label:'الديون',value:fmt(r.debts)+' ر.س'},
                    {label:'الذمم المدينة',value:fmt(r.receivables)+' ر.س'},
                    {label:'الموظفين',value:r.employees+' موظف'},
                  ].map((item,j)=>(
                    <div key={j} style={{background:C.navy,borderRadius:8,padding:'12px 16px'}}>
                      <div style={{color:C.gray,fontSize:12,marginBottom:4}}>{item.label}</div>
                      <div style={{color:C.white,fontSize:15,fontWeight:600}}>{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
