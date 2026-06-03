'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const C = { navy:'#0B1C3D', navyLight:'#112244', border:'#1E3A6E', gold:'#F5C842', goldLight:'#E6A800', white:'#fff', gray:'#8899BB' }

const fmt = (n: number) => n.toLocaleString('ar-SA') + ' ر.س'
const days = (n: number) => Math.round(n) + ' يوم'

function generateReport(f: any) {
  const r = parseFloat(f.revenue)||0, e = parseFloat(f.expenses)||0
  const b = parseFloat(f.bank_balance)||0, d = parseFloat(f.debts)||0
  const rec = parseFloat(f.receivables)||0
  const margin = r>0 ? ((r-e)/r*100) : 0
  const liq = e>0 ? b/e : 0
  const dso = r>0 ? rec/r*30 : 0
  const dr = r>0 ? d/(r*12)*100 : 0
  const dailyBurn = e/30
  const daysLeft = dailyBurn>0 ? b/dailyBurn : 0
  const monthlyProfit = r - e

  const risks: string[] = []
  const actions: string[] = []
  const impacts: string[] = []
  const strengths: string[] = []
  const opportunities: string[] = []

  // السيولة
  if (liq < 1) {
    risks.push(`🔴 رصيدك ${fmt(b)} يغطي فقط ${days(daysLeft)} من مصروفاتك اليومية البالغة ${fmt(dailyBurn)} — خطر نقدي حقيقي`)
    actions.push(`⚡ حصل فوراً من الذمم المدينة ${fmt(rec)} — هذا المبلغ سينقذ سيولتك`)
    impacts.push(`💡 تحصيل 50% من الذمم سيرفع رصيدك إلى ${fmt(b + rec*0.5)} ويرفع Score +15 نقطة`)
  } else if (liq < 3) {
    risks.push(`🟡 رصيدك ${fmt(b)} يغطي ${days(daysLeft)} فقط — أقل من المعيار الموصى به (90 يوم)`)
    actions.push(`📊 ابنِ احتياطياً نقدياً يصل إلى ${fmt(e*3)} يعادل 3 أشهر من المصروفات`)
    impacts.push(`💡 الاحتياطي سيجعلك مؤهلاً لتمويل بنكي بفائدة أقل بـ2-3%`)
  } else {
    strengths.push(`✅ سيولتك قوية — رصيدك ${fmt(b)} يغطي ${days(daysLeft)} من المصروفات`)
  }

  // الربحية
  if (monthlyProfit < 0) {
    risks.push(`🔴 شركتك تخسر ${fmt(Math.abs(monthlyProfit))} شهرياً — أي ${fmt(Math.abs(monthlyProfit)*12)} سنوياً`)
    actions.push(`🔍 راجع أكبر 3 بنود مصروفات وخفّضها — خفض 10% سيوفر ${fmt(e*0.1)} شهرياً`)
    impacts.push(`💡 الوصول للتعادل يحتاج خفض المصروفات ${fmt(Math.abs(monthlyProfit))} أو رفع الإيرادات بنفس المقدار`)
  } else if (margin < 15) {
    risks.push(`🟡 هامش ربحك ${margin.toFixed(1)}% — أقل من معيار قطاع المقاولات (15-25%)`)
    actions.push(`💰 رفع هامشك 5% يضيف ${fmt(r*0.05)} شهرياً أي ${fmt(r*0.05*12)} سنوياً`)
    impacts.push(`💡 مع هامش 20% ستتأهل لمشاريع حكومية تشترط ربحية لا تقل عن 15%`)
  } else {
    strengths.push(`✅ هامش ربحك ${margin.toFixed(1)}% — أعلى من معيار القطاع (15%) بفارق ${(margin-15).toFixed(1)}%`)
  }

  // الذمم
  if (dso > 90) {
    risks.push(`🔴 عملاؤك يدفعون بعد ${days(dso)} في المتوسط — ذممك ${fmt(rec)} محتجزة طويلاً`)
    actions.push(`📞 اتصل هذا الأسبوع بأكبر 3 عملاء مدينين وفاوض على جدول سداد`)
    impacts.push(`💡 تحصيل الذمم في 60 يوم بدل 90 سيضيف ${fmt(rec/3)} لسيولتك كل شهر`)
  } else if (dso > 60) {
    risks.push(`🟡 متوسط التحصيل ${days(dso)} — يمكن تحسينه`)
    actions.push(`📋 طبّق فواتير إلكترونية مع تذكير تلقائي كل 30 يوم`)
  } else if (r > 0) {
    strengths.push(`✅ تحصيلك سريع — عملاؤك يدفعون خلال ${days(dso)} في المتوسط`)
  }

  // الديون
  if (dr > 100) {
    risks.push(`🔴 ديونك ${fmt(d)} تعادل ${dr.toFixed(0)}% من إيراداتك السنوية — عبء ثقيل`)
    actions.push(`🏦 تفاوض على إعادة جدولة الديون لـ5 سنوات بدل 3 — سيخفف القسط الشهري ${fmt(d/36-d/60)}`)
    impacts.push(`💡 الجدولة ستحرر ${fmt(d/36-d/60)} شهرياً لمشاريع جديدة`)
  } else if (dr > 50) {
    risks.push(`🟡 ديونك ${fmt(d)} تمثل ${dr.toFixed(0)}% من إيراداتك السنوية — راقبها`)
    actions.push(`📉 لا تأخذ ديوناً جديدة حتى تنخفض النسبة تحت 50%`)
  } else if (r > 0) {
    strengths.push(`✅ نسبة ديونك صحية — ${dr.toFixed(0)}% من الإيرادات السنوية فقط`)
  }

  // الفرص
  if (margin > 20 && liq > 2) {
    opportunities.push(`🚀 وضعك المالي يؤهلك للتوسع — ربحيتك ${margin.toFixed(0)}% وسيولتك ${days(daysLeft)} تسمح بمشروع جديد`)
    opportunities.push(`💳 يمكنك التقدم لتمويل بنكي بضمان إيراداتك ${fmt(r)} شهرياً`)
  }
  if (rec > r*0.5) {
    opportunities.push(`💰 لديك ${fmt(rec)} في الذمم — تحصيلها يمول مشاريع جديدة دون ديون إضافية`)
  }
  if (margin > 15 && dr < 50) {
    opportunities.push(`📈 بناءً على أرقامك، يمكنك استيعاب مشروع إضافي بقيمة تصل ${fmt(r*0.3)} شهرياً`)
  }
  if (opportunities.length === 0) {
    opportunities.push(`📈 بعد تحسين النقاط أعلاه ستظهر فرص توسع — ابدأ بالسيولة والتحصيل`)
  }

  // التوقع المستقبلي
  const forecast3m = monthlyProfit > 0 ? `إذا استمريت بنفس الأداء، رصيدك بعد 3 أشهر سيكون ${fmt(b + monthlyProfit*3)}` :
    `إذا لم تتحرك، رصيدك بعد 3 أشهر سيكون ${fmt(Math.max(0, b + monthlyProfit*3))} — ${b + monthlyProfit*3 < 0 ? '⚠️ خطر التوقف عن العمل' : 'تحتاج تحسين عاجل'}`

  // مقارنة بالسوق
  const vsMarket = margin > 20 ? `هامش ربحك أعلى من 70% من شركات المقاولات السعودية` :
    margin > 15 ? `هامش ربحك أعلى من 50% من شركات المقاولات السعودية` :
    margin > 10 ? `هامش ربحك أعلى من 35% من شركات المقاولات السعودية` :
    `هامش ربحك أقل من 70% من شركات المقاولات السعودية — مجال للتحسين`

  let score = 0
  if (liq >= 3) score+=25; else if (liq >= 1) score+=15; else if (liq > 0) score+=5
  if (margin >= 15) score+=25; else if (margin > 0) score+=15
  if (dso <= 60) score+=20; else if (dso <= 90) score+=10
  if (dr <= 50) score+=15; else if (dr <= 100) score+=8
  score = Math.min(score, 85)

  const scoreLabel = score >= 70 ? 'شركة قوية — جاهزة للتوسع' : score >= 55 ? 'شركة متوسطة — تحتاج تحسين' : score >= 40 ? 'شركة تحت الضغط — تدخل عاجل' : 'وضع حرج — يحتاج إجراء فوري'

  return { risks, actions, impacts, strengths, opportunities, score, scoreLabel, forecast3m, vsMarket, margin, daysLeft, monthlyProfit }
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

  const handleAnalyze = () => {
    const r = generateReport(form)
    setReport(r)
    setTimeout(() => window.scrollTo({top: 500, behavior: 'smooth'}), 100)
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
            <div style={{color:C.gray,fontSize:14}}>أدخل بيانات شركتك واحصل على تحليل مالي ذكي في 15 ثانية</div>
          </div>
        )}

        <div style={{background:C.navyLight,borderRadius:16,padding:'32px',border:`1px solid ${C.border}`,marginBottom:24}}>
          <div style={{color:C.white,fontSize:18,fontWeight:700,marginBottom:24}}>بيانات الشهر الحالي</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
            {fields.map(f => (
              <div key={f.key}>
                <div style={{color:C.gray,fontSize:13,marginBottom:6}}>{f.label}</div>
                <input value={form[f.key as keyof typeof form]} onChange={e=>setForm({...form,[f.key]:e.target.value})}
                  placeholder={f.placeholder}
                  style={{width:'100%',padding:'12px 14px',borderRadius:8,border:`1px solid ${C.border}`,background:C.navy,color:C.white,fontSize:15,boxSizing:'border-box'}} />
              </div>
            ))}
          </div>
          <button onClick={handleAnalyze} style={{marginTop:24,width:'100%',padding:'16px',borderRadius:8,border:'none',background:`linear-gradient(135deg,${C.gold},${C.goldLight})`,color:C.navy,fontSize:17,fontWeight:800,cursor:'pointer'}}>
            🔍 احلل وأظهر التقرير الذكي
          </button>
        </div>

        {report && (
          <div style={{display:'flex',flexDirection:'column',gap:16}}>

            {/* Score */}
            <div style={{background:C.navyLight,borderRadius:16,padding:'32px',border:`2px solid ${scoreColor(report.score)}40`,textAlign:'center'}}>
              <div style={{color:C.gray,fontSize:14,marginBottom:8}}>Murdi Score لشركة {profile?.company_name}</div>
              <div style={{fontSize:80,fontWeight:900,color:scoreColor(report.score),lineHeight:1}}>{report.score}</div>
              <div style={{color:C.gray,fontSize:13,marginBottom:12}}>من 85 نقطة</div>
              <div style={{color:C.white,fontSize:16,fontWeight:700,background:scoreColor(report.score)+'20',padding:'10px 20px',borderRadius:8,display:'inline-block'}}>{report.scoreLabel}</div>
              <div style={{marginTop:16,color:C.gray,fontSize:13,background:C.navy,padding:'12px',borderRadius:8}}>📊 {report.vsMarket}</div>
            </div>

            {/* Forecast */}
            <div style={{background:C.navyLight,borderRadius:16,padding:'20px',border:`1px solid ${C.border}`}}>
              <div style={{color:C.gold,fontSize:15,fontWeight:700,marginBottom:8}}>🔮 التوقع بعد 3 أشهر</div>
              <div style={{color:C.white,fontSize:14}}>{report.forecast3m}</div>
            </div>

            {/* Top Risks */}
            {report.risks.length > 0 && (
              <div style={{background:C.navyLight,borderRadius:16,padding:'24px',border:'1px solid #ef444440'}}>
                <div style={{color:'#ef4444',fontSize:16,fontWeight:700,marginBottom:16}}>⚠️ Top Risks — المخاطر الحقيقية</div>
                {report.risks.map((r:string,i:number) => <div key={i} style={{color:C.white,fontSize:14,padding:'12px 0',borderBottom:i<report.risks.length-1?`1px solid ${C.border}`:'none',lineHeight:1.6}}>{r}</div>)}
              </div>
            )}

            {/* Action Engine */}
            <div style={{background:C.navyLight,borderRadius:16,padding:'24px',border:'1px solid #3b82f640'}}>
              <div style={{color:'#3b82f6',fontSize:16,fontWeight:700,marginBottom:16}}>⚡ Action Engine — افعل هذا الأسبوع</div>
              {report.actions.map((a:string,i:number) => <div key={i} style={{color:C.white,fontSize:14,padding:'12px 0',borderBottom:i<report.actions.length-1?`1px solid ${C.border}`:'none',lineHeight:1.6}}>{a}</div>)}
            </div>

            {/* Impact Engine */}
            {report.impacts.length > 0 && (
              <div style={{background:C.navyLight,borderRadius:16,padding:'24px',border:'1px solid #a855f740'}}>
                <div style={{color:'#a855f7',fontSize:16,fontWeight:700,marginBottom:16}}>🎯 Impact Engine — ماذا سيحدث إذا تحركت</div>
                {report.impacts.map((imp:string,i:number) => <div key={i} style={{color:C.white,fontSize:14,padding:'12px 0',borderBottom:i<report.impacts.length-1?`1px solid ${C.border}`:'none',lineHeight:1.6}}>{imp}</div>)}
              </div>
            )}

            {/* Strengths */}
            {report.strengths.length > 0 && (
              <div style={{background:C.navyLight,borderRadius:16,padding:'24px',border:'1px solid #22c55e40'}}>
                <div style={{color:'#22c55e',fontSize:16,fontWeight:700,marginBottom:16}}>💪 نقاط القوة</div>
                {report.strengths.map((s:string,i:number) => <div key={i} style={{color:C.white,fontSize:14,padding:'12px 0',borderBottom:i<report.strengths.length-1?`1px solid ${C.border}`:'none',lineHeight:1.6}}>{s}</div>)}
              </div>
            )}

            {/* Opportunity Engine */}
            <div style={{background:C.navyLight,borderRadius:16,padding:'24px',border:`1px solid ${C.gold}40`}}>
              <div style={{color:C.gold,fontSize:16,fontWeight:700,marginBottom:16}}>🚀 Opportunity Engine — فرصك الآن</div>
              {report.opportunities.map((o:string,i:number) => <div key={i} style={{color:C.white,fontSize:14,padding:'12px 0',borderBottom:i<report.opportunities.length-1?`1px solid ${C.border}`:'none',lineHeight:1.6}}>{o}</div>)}
            </div>

            {/* Save */}
            <button onClick={handleSave} style={{width:'100%',padding:'16px',borderRadius:12,border:'none',background:`linear-gradient(135deg,${C.gold},${C.goldLight})`,color:C.navy,fontSize:16,fontWeight:800,cursor:'pointer'}}>
              {saved ? '✓ تم الحفظ في Company Memory!' : '💾 احفظ التقرير في Company Memory'}</button><button onClick={()=>{sessionStorage.setItem('murdi_report',JSON.stringify(report));sessionStorage.setItem('murdi_company',profile?.company_name||'');router.push('/dashboard/report')}} style={{width:'100%',padding:'14px',borderRadius:12,border:'1px solid #F5C842',background:'transparent',color:'#F5C842',fontSize:15,fontWeight:700,cursor:'pointer',marginTop:8}}>📄 عرض وتحميل PDF
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
