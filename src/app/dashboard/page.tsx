'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const C = { navy:'#0B1C3D', navyLight:'#112244', border:'#1E3A6E', gold:'#F5C842', goldLight:'#E6A800', white:'#fff', gray:'#8899BB' }

function generateReport(f: any) {
  const r = parseFloat(f.revenue)||0, e = parseFloat(f.expenses)||0
  const b = parseFloat(f.bank_balance)||0, d = parseFloat(f.debts)||0
  const rec = parseFloat(f.receivables)||0
  const margin = r>0 ? ((r-e)/r*100) : 0
  const liq = e>0 ? b/e : 0
  const dso = r>0 ? rec/r*30 : 0
  const dr = r>0 ? d/(r*12)*100 : 0

  const risks = []
  const actions = []
  const impacts = []
  const strengths = []
  const opportunities = []

  if (liq < 1) { risks.push('🔴 السيولة خطيرة — الرصيد لا يغطي شهراً واحداً من المصروفات'); actions.push('⚡ أوقف أي مصروف غير ضروري فوراً وحصّل الذمم المتأخرة'); impacts.push('💡 تحسين السيولة سيرفع Score +15 نقطة') }
  else if (liq < 2) { risks.push('🟡 السيولة متوسطة — تحتاج تحسين'); actions.push('📊 ابنِ احتياطي نقدي يعادل 3 أشهر من المصروفات'); impacts.push('💡 الاحتياطي سيجعلك مؤهلاً لتمويل بنكي أفضل') }
  else { strengths.push('✅ السيولة قوية — رصيدك يغطي أكثر من شهرين') }

  if (margin < 0) { risks.push('🔴 الشركة تخسر — المصروفات أعلى من الإيرادات'); actions.push('🔍 راجع أكبر 3 بنود مصروفات وخفّضها 20%'); impacts.push('💡 خفض المصروفات 10% سيحول الخسارة لربح') }
  else if (margin < 15) { risks.push('🟡 هامش الربح ضعيف — أقل من 15%'); actions.push('💰 ارفع أسعارك أو خفض تكاليف المشاريع القادمة'); impacts.push('💡 رفع الهامش 5% يضيف +' + Math.round(r*0.05).toLocaleString('ar') + ' ر.س سنوياً') }
  else { strengths.push('✅ هامش الربح جيد — ' + margin.toFixed(1) + '%') }

  if (dso > 90) { risks.push('🔴 الذمم المدينة متأخرة جداً — أكثر من 90 يوم'); actions.push('📞 تواصل مع العملاء المتأخرين هذا الأسبوع وضع خطة تحصيل'); impacts.push('💡 تحصيل ' + (rec*0.5).toLocaleString('ar') + ' ر.س سيحسن سيولتك فوراً') }
  else if (dso > 60) { risks.push('🟡 الذمم تحتاج متابعة — بين 60-90 يوم'); actions.push('📋 طبّق نظام فواتير واضح مع شروط دفع صارمة') }
  else if (r > 0) { strengths.push('✅ التحصيل سريع — الذمم تُحصّل في أقل من 60 يوم') }

  if (dr > 100) { risks.push('🔴 نسبة الديون عالية جداً — تجاوزت الإيرادات السنوية'); actions.push('🏦 تفاوض على إعادة جدولة الديون مع تمديد الفترة'); impacts.push('💡 الجدولة ستخفف الضغط الشهري وترفع Score') }
  else if (dr > 50) { risks.push('🟡 الديون متوسطة — تحتاج مراقبة'); actions.push('📉 لا تأخذ ديوناً جديدة حتى تنخفض النسبة تحت 50%') }
  else if (r > 0) { strengths.push('✅ نسبة الديون مقبولة') }

  if (margin > 20 && liq > 2) { opportunities.push('🚀 وضعك المالي يؤهلك للتوسع — فكر في مشروع جديد أو فرع'); opportunities.push('💳 يمكنك التقدم لتمويل بنكي بشروط جيدة') }
  if (rec > r*0.3) { opportunities.push('💰 لديك ذمم كبيرة — تحصيلها يمكن أن يمول مشاريع جديدة') }
  if (opportunities.length === 0) { opportunities.push('📈 بعد تحسين النقاط أعلاه ستظهر فرص توسع واضحة') }

  let score = 0
  if (liq >= 3) score+=25; else if (liq >= 1) score+=15; else if (liq > 0) score+=5
  if (margin >= 15) score+=25; else if (margin > 0) score+=15
  if (dso <= 60) score+=20; else if (dso <= 90) score+=10
  if (dr <= 50) score+=15; else if (dr <= 100) score+=8

  return { risks, actions, impacts, strengths, opportunities, score: Math.min(score, 85) }
}

export default function Dashboard() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [form, setForm] = useState({ revenue:'', expenses:'', bank_balance:'', debts:'', receivables:'', employees:'' })
  const [report, setReport] = useState<any>(null)
  const [saved, setSaved] = useState(false)
  const [isNew, setIsNew] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      setUser(user)
      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(p)
      const { data: records } = await supabase.from('monthly_data').select('*').eq('user_id', user.id)
      if (!records || records.length === 0) setIsNew(true)
    }
    getUser()
  }, [])

  const handleChange = (k: string, v: string) => setForm({...form, [k]:v})

  const handleAnalyze = () => {
    const r = generateReport(form)
    setReport(r)
    window.scrollTo({top: 400, behavior: 'smooth'})
  }

  const handleSave = async () => {
    if (!report) return
    const now = new Date()
    await supabase.from('monthly_data').upsert({
      user_id: user.id, month: now.getMonth()+1, year: now.getFullYear(),
      revenue: parseFloat(form.revenue)||0, expenses: parseFloat(form.expenses)||0,
      bank_balance: parseFloat(form.bank_balance)||0, debts: parseFloat(form.debts)||0,
      receivables: parseFloat(form.receivables)||0, employees: parseInt(form.employees)||0,
      murdi_score: report.score
    })
    setSaved(true)
    setIsNew(false)
    setTimeout(()=>setSaved(false), 3000)
  }

  const scoreColor = (s: number) => s >= 70 ? '#22c55e' : s >= 40 ? C.gold : '#ef4444'
  const fields = [
    { key:'revenue', label:'الإيرادات الشهرية', placeholder:'500000' },
    { key:'expenses', label:'المصروفات الشهرية', placeholder:'350000' },
    { key:'bank_balance', label:'الرصيد البنكي', placeholder:'200000' },
    { key:'debts', label:'الديون', placeholder:'100000' },
    { key:'receivables', label:'الذمم المدينة', placeholder:'150000' },
    { key:'employees', label:'عدد الموظفين', placeholder:'25' },
  ]

  if (!user) return <div style={{background:C.navy,minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center'}}><div style={{color:C.gold,fontSize:20}}>...</div></div>

  return (
    <div style={{minHeight:'100vh',background:C.navy,fontFamily:'system-ui',direction:'rtl'}}>
      <div style={{background:C.navyLight,padding:'16px 32px',display:'flex',justifyContent:'space-between',alignItems:'center',borderBottom:`1px solid ${C.border}`}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <div style={{fontSize:22,fontWeight:900,color:C.gold,letterSpacing:2}}>MURDI</div>
          <div style={{fontSize:11,color:C.gray,letterSpacing:1}}>CONSTRUCTION INTELLIGENCE</div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <div style={{textAlign:'right',marginLeft:8}}>
            <div style={{color:C.white,fontWeight:700,fontSize:14}}>{profile?.company_name||'شركتك'}</div>
            <div style={{color:C.gray,fontSize:12}}>{user.email}</div>
          </div>
          <button onClick={()=>router.push('/dashboard/trends')} style={{padding:'8px 14px',borderRadius:8,border:`1px solid ${C.border}`,background:'transparent',color:C.gray,cursor:'pointer',fontSize:13}}>Trends</button>
          <button onClick={()=>router.push('/dashboard/memory')} style={{padding:'8px 14px',borderRadius:8,border:`1px solid ${C.gold}`,background:'transparent',color:C.gold,cursor:'pointer',fontSize:13}}>Memory</button>
          <button onClick={async()=>{await supabase.auth.signOut();router.push('/auth/login')}} style={{padding:'8px 14px',borderRadius:8,border:`1px solid ${C.border}`,background:'transparent',color:C.gray,cursor:'pointer',fontSize:13}}>خروج</button>
        </div>
      </div>

      <div style={{maxWidth:900,margin:'0 auto',padding:'32px 24px'}}>

        {isNew && (
          <div style={{background:'linear-gradient(135deg,#1a3a6e,#112244)',borderRadius:16,padding:'32px',marginBottom:24,border:`1px solid ${C.gold}`,textAlign:'center'}}>
            <div style={{fontSize:24,fontWeight:900,color:C.gold,marginBottom:8}}>أهلاً {profile?.company_name}! 🎉</div>
            <div style={{color:C.white,fontSize:16,marginBottom:8}}>هذا أول تقرير Murdi لك</div>
            <div style={{color:C.gray,fontSize:14}}>أدخل بيانات شركتك واحصل على تقريرك الذكي في ثوانٍ</div>
          </div>
        )}

        <div style={{background:C.navyLight,borderRadius:16,padding:'32px',border:`1px solid ${C.border}`,marginBottom:24}}>
          <div style={{color:C.white,fontSize:18,fontWeight:700,marginBottom:24}}>بيانات الشهر الحالي</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
            {fields.map(f => (
              <div key={f.key}>
                <div style={{color:C.gray,fontSize:13,marginBottom:6}}>{f.label}</div>
                <input value={form[f.key as keyof typeof form]} onChange={e=>handleChange(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  style={{width:'100%',padding:'12px 14px',borderRadius:8,border:`1px solid ${C.border}`,background:C.navy,color:C.white,fontSize:15,boxSizing:'border-box'}} />
              </div>
            ))}
          </div>
          <button onClick={handleAnalyze} style={{marginTop:24,width:'100%',padding:'14px',borderRadius:8,border:'none',background:`linear-gradient(135deg,${C.gold},${C.goldLight})`,color:C.navy,fontSize:16,fontWeight:800,cursor:'pointer'}}>
            🔍 احلل وأظهر التقرير الذكي
          </button>
        </div>

        {report && (
          <div style={{display:'flex',flexDirection:'column',gap:16}}>

            {/* Score */}
            <div style={{background:C.navyLight,borderRadius:16,padding:'24px',border:`1px solid ${C.border}`,textAlign:'center'}}>
              <div style={{color:C.gray,fontSize:14,marginBottom:8}}>Murdi Score</div>
              <div style={{fontSize:72,fontWeight:900,color:scoreColor(report.score)}}>{report.score}</div>
              <div style={{color:C.gray,fontSize:13}}>من 85 نقطة</div>
              <div style={{marginTop:12,color:C.white,fontSize:15}}>
                {report.score>=70?'🟢 وضعك المالي قوي — استمر!':report.score>=40?'🟡 وضعك متوسط — يحتاج تحسين':'🔴 وضعك يحتاج تدخل عاجل'}
              </div>
            </div>

            {/* Top Risks */}
            {report.risks.length > 0 && (
              <div style={{background:C.navyLight,borderRadius:16,padding:'24px',border:'1px solid #ef444440'}}>
                <div style={{color:'#ef4444',fontSize:16,fontWeight:700,marginBottom:16}}>⚠️ Top Risks — أهم المخاطر</div>
                {report.risks.map((r:string,i:number) => <div key={i} style={{color:C.white,fontSize:14,padding:'10px 0',borderBottom:i<report.risks.length-1?`1px solid ${C.border}`:'none'}}>{r}</div>)}
              </div>
            )}

            {/* Action Engine */}
            <div style={{background:C.navyLight,borderRadius:16,padding:'24px',border:'1px solid #3b82f640'}}>
              <div style={{color:'#3b82f6',fontSize:16,fontWeight:700,marginBottom:16}}>⚡ Action Engine — الإجراءات المطلوبة</div>
              {report.actions.map((a:string,i:number) => <div key={i} style={{color:C.white,fontSize:14,padding:'10px 0',borderBottom:i<report.actions.length-1?`1px solid ${C.border}`:'none'}}>{a}</div>)}
            </div>

            {/* Impact Engine */}
            {report.impacts.length > 0 && (
              <div style={{background:C.navyLight,borderRadius:16,padding:'24px',border:'1px solid #a855f740'}}>
                <div style={{color:'#a855f7',fontSize:16,fontWeight:700,marginBottom:16}}>🎯 Impact Engine — ماذا سيحدث</div>
                {report.impacts.map((imp:string,i:number) => <div key={i} style={{color:C.white,fontSize:14,padding:'10px 0',borderBottom:i<report.impacts.length-1?`1px solid ${C.border}`:'none'}}>{imp}</div>)}
              </div>
            )}

            {/* Strengths */}
            {report.strengths.length > 0 && (
              <div style={{background:C.navyLight,borderRadius:16,padding:'24px',border:'1px solid #22c55e40'}}>
                <div style={{color:'#22c55e',fontSize:16,fontWeight:700,marginBottom:16}}>💪 نقاط القوة</div>
                {report.strengths.map((s:string,i:number) => <div key={i} style={{color:C.white,fontSize:14,padding:'10px 0',borderBottom:i<report.strengths.length-1?`1px solid ${C.border}`:'none'}}>{s}</div>)}
              </div>
            )}

            {/* Opportunity Engine */}
            <div style={{background:C.navyLight,borderRadius:16,padding:'24px',border:`1px solid ${C.gold}40`}}>
              <div style={{color:C.gold,fontSize:16,fontWeight:700,marginBottom:16}}>🚀 Opportunity Engine — الفرص</div>
              {report.opportunities.map((o:string,i:number) => <div key={i} style={{color:C.white,fontSize:14,padding:'10px 0',borderBottom:i<report.opportunities.length-1?`1px solid ${C.border}`:'none'}}>{o}</div>)}
            </div>

            {/* Save */}
            <button onClick={handleSave} style={{width:'100%',padding:'16px',borderRadius:12,border:'none',background:`linear-gradient(135deg,${C.gold},${C.goldLight})`,color:C.navy,fontSize:16,fontWeight:800,cursor:'pointer'}}>
              {saved ? '✓ تم الحفظ في Company Memory!' : '💾 احفظ في Company Memory'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
