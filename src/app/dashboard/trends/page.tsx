'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const C = { navy:'#0B1C3D', navyLight:'#112244', border:'#1E3A6E', gold:'#F5C842', goldLight:'#E6A800', white:'#fff', gray:'#8899BB' }
const MONTHS = ['','يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']

export default function Trends() {
  const [records, setRecords] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      const { data } = await supabase.from('monthly_data').select('*').eq('user_id', user.id).order('year').order('month')
      setRecords(data || [])
      setLoading(false)
    }
    load()
  }, [])

  const trend = (key: string) => {
    if (records.length < 2) return null
    const vals = records.map(r => r[key])
    const first = vals[0], last = vals[vals.length-1]
    const pct = ((last - first) / first * 100).toFixed(1)
    return { pct: parseFloat(pct), up: last >= first }
  }

  const avgScore = records.length ? Math.round(records.reduce((a,r)=>a+r.murdi_score,0)/records.length) : 0
  const bestMonth = records.length ? records.reduce((a,r)=>r.murdi_score>a.murdi_score?r:a) : null
  const revenueGrowth = trend('revenue')
  const expensesTrend = trend('expenses')
  const scoreTrend = trend('murdi_score')

  if (loading) return <div style={{background:C.navy,minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center'}}><div style={{color:C.gold,fontSize:20}}>...</div></div>

  return (
    <div style={{minHeight:'100vh',background:C.navy,fontFamily:'system-ui',direction:'rtl'}}>
      <div style={{background:C.navyLight,padding:'16px 32px',display:'flex',justifyContent:'space-between',alignItems:'center',borderBottom:`1px solid ${C.border}`}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <div style={{fontSize:22,fontWeight:900,color:C.gold,letterSpacing:2}}>MURDI</div>
          <div style={{fontSize:11,color:C.gray,letterSpacing:1}}>TREND ENGINE</div>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button onClick={()=>router.push('/dashboard/memory')} style={{padding:'8px 16px',borderRadius:8,border:`1px solid ${C.border}`,background:'transparent',color:C.gray,cursor:'pointer',fontSize:13}}>← Memory</button>
          <button onClick={()=>router.push('/dashboard')} style={{padding:'8px 16px',borderRadius:8,border:`1px solid ${C.gold}`,background:'transparent',color:C.gold,cursor:'pointer',fontSize:13}}>Dashboard</button>
        </div>
      </div>

      <div style={{maxWidth:900,margin:'0 auto',padding:'32px 24px'}}>
        <div style={{marginBottom:24}}>
          <div style={{color:C.white,fontSize:22,fontWeight:800}}>Trend Engine 🔥</div>
          <div style={{color:C.gray,fontSize:14,marginTop:4}}>تحليل الاتجاهات بناءً على {records.length} شهر</div>
        </div>

        {records.length === 0 ? (
          <div style={{background:C.navyLight,borderRadius:16,padding:'48px',textAlign:'center',border:`1px solid ${C.border}`}}>
            <div style={{color:C.gray,fontSize:16}}>لا توجد بيانات كافية بعد</div>
            <button onClick={()=>router.push('/dashboard')} style={{marginTop:16,padding:'12px 24px',borderRadius:8,border:'none',background:C.gold,color:C.navy,fontWeight:700,cursor:'pointer'}}>أدخل بيانات الشهر</button>
          </div>
        ) : (
          <>
            {/* KPIs */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16,marginBottom:24}}>
              {[
                { label:'متوسط Murdi Score', value:avgScore, sub:'من 85 نقطة', color: avgScore>=70?'#22c55e':avgScore>=40?C.gold:'#ef4444' },
                { label:'أفضل شهر', value: bestMonth ? `${MONTHS[bestMonth.month]} ${bestMonth.year}` : '-', sub:`Score: ${bestMonth?.murdi_score}`, color: C.gold },
                { label:'عدد الأشهر المحللة', value: records.length, sub:'شهر', color: C.white },
              ].map((k,i) => (
                <div key={i} style={{background:C.navyLight,borderRadius:12,padding:'20px',border:`1px solid ${C.border}`,textAlign:'center'}}>
                  <div style={{color:C.gray,fontSize:12,marginBottom:8}}>{k.label}</div>
                  <div style={{fontSize:28,fontWeight:900,color:k.color}}>{k.value}</div>
                  <div style={{color:C.gray,fontSize:12,marginTop:4}}>{k.sub}</div>
                </div>
              ))}
            </div>

            {/* Trends */}
            <div style={{background:C.navyLight,borderRadius:16,padding:'24px',border:`1px solid ${C.border}`,marginBottom:24}}>
              <div style={{color:C.white,fontSize:16,fontWeight:700,marginBottom:16}}>اتجاهات الأداء</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
                {[
                  { label:'الإيرادات', t: revenueGrowth },
                  { label:'المصروفات', t: expensesTrend },
                  { label:'Murdi Score', t: scoreTrend },
                ].map((item,i) => (
                  <div key={i} style={{background:C.navy,borderRadius:8,padding:'16px',textAlign:'center'}}>
                    <div style={{color:C.gray,fontSize:12,marginBottom:8}}>{item.label}</div>
                    {item.t ? (
                      <>
                        <div style={{fontSize:24,fontWeight:900,color:item.t.up?'#22c55e':'#ef4444'}}>
                          {item.t.up?'↑':'↓'} {Math.abs(item.t.pct)}%
                        </div>
                        <div style={{color:C.gray,fontSize:11,marginTop:4}}>{item.t.up?'نمو':'انخفاض'}</div>
                      </>
                    ) : (
                      <div style={{color:C.gray,fontSize:13}}>يحتاج شهرين+</div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Timeline */}
            <div style={{background:C.navyLight,borderRadius:16,padding:'24px',border:`1px solid ${C.border}`}}>
              <div style={{color:C.white,fontSize:16,fontWeight:700,marginBottom:16}}>مسار Score عبر الزمن</div>
              <div style={{display:'flex',alignItems:'flex-end',gap:8,height:120}}>
                {records.map((r,i) => {
                  const h = Math.max((r.murdi_score/85)*100, 5)
                  const col = r.murdi_score>=70?'#22c55e':r.murdi_score>=40?C.gold:'#ef4444'
                  return (
                    <div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
                      <div style={{fontSize:11,color:col,fontWeight:700}}>{r.murdi_score}</div>
                      <div style={{width:'100%',height:`${h}%`,background:col,borderRadius:'4px 4px 0 0',minHeight:8}}></div>
                      <div style={{fontSize:10,color:C.gray,textAlign:'center'}}>{MONTHS[r.month]?.slice(0,3)}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
