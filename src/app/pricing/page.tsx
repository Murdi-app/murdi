'use client'
import { useRouter } from 'next/navigation'

const C = { navy:'#0B1C3D', navyLight:'#112244', border:'#1E3A6E', gold:'#F5C842', goldLight:'#E6A800', white:'#fff', gray:'#8899BB' }

export default function PricingPage() {
  const router = useRouter()
  const features = ['محرك المشاريع — تحليل تدفقك عبر دورات المشاريع','محرك المستخلصات — سيولتك المجمّدة في اعتماد','كاشف الربح الوهمي — ربح الورق مقابل النقد','مؤشر جاهزية العطاء — قبل أن تقدّم','التوأم المالي — حاكِ قرارك الكبير قبل اتخاذه','ساعة البقاء — كم تصمد بين المشاريع','Murdi Score + المخاطر مرتبة بالتأثير','نبض الالتزامات الحكومية (GOSI والتأمينات)','ذاكرة Murdi الزمنية — تاريخ شركتك','شهادة Murdi Score السنوية للبنوك','مقارنة مع السوق السعودي','أكثر من 12 محركا ذكياً يعمل لصالحك']
  return (
    <div style={{minHeight:'100vh',background:C.navy,fontFamily:'system-ui',direction:'rtl'}}>
      <div style={{background:C.navyLight,padding:'16px 32px',display:'flex',justifyContent:'space-between',alignItems:'center',borderBottom:`1px solid ${C.border}`}}>
        <div style={{fontSize:20,fontWeight:900,color:C.gold,letterSpacing:2,cursor:'pointer'}} onClick={()=>router.push('/')}>MURDI</div>
        <div style={{display:'flex',gap:12}}>
          <button onClick={()=>router.push('/auth/login')} style={{padding:'8px 20px',borderRadius:8,border:`1px solid ${C.border}`,background:'transparent',color:C.gray,cursor:'pointer',fontSize:13}}>دخول</button>
          <button onClick={()=>router.push('/auth/signup')} style={{padding:'8px 20px',borderRadius:8,border:'none',background:`linear-gradient(135deg,${C.gold},${C.goldLight})`,color:C.navy,cursor:'pointer',fontSize:13,fontWeight:700}}>ابدأ مجاناً</button>
        </div>
      </div>
      <div style={{maxWidth:800,margin:'0 auto',padding:'60px 24px'}}>
        <div style={{textAlign:'center',marginBottom:48}}>
          <div style={{display:'inline-block',background:'#F5C84220',border:`1px solid ${C.gold}40`,borderRadius:20,padding:'6px 20px',color:C.gold,fontSize:13,marginBottom:20}}>سعر تأسيسي — 20 شركة فقط</div>
          <div style={{fontSize:38,fontWeight:900,color:C.white,marginBottom:12,lineHeight:1.2}}>استثمار واحد.<br/><span style={{color:C.gold}}>ذكاء مالي دائم.</span></div>
          <div style={{color:C.gray,fontSize:15}}>بدل ما تدفع لمحاسب شهرياً — Murdi يعطيك تحليلاً أعمق في 15 دقيقة</div>
        </div>
        <div style={{background:'linear-gradient(135deg,#112244,#0d1a35)',borderRadius:24,padding:'40px',border:`2px solid ${C.gold}40`,marginBottom:40,position:'relative',overflow:'hidden'}}>
          <div style={{position:'absolute',top:0,left:0,right:0,height:3,background:`linear-gradient(90deg,${C.gold},${C.goldLight})`}}/>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:28}}>
            <div>
              <div style={{color:C.gray,fontSize:13,marginBottom:8}}>السعر التأسيسي للمؤسسين</div>
              <div style={{display:'flex',alignItems:'baseline',gap:8}}>
                <div style={{fontSize:60,fontWeight:900,color:C.gold,lineHeight:1}}>1,990</div>
                <div style={{color:C.gray,fontSize:14}}>ريال / شهر<br/>مجمّد مدى الحياة</div>
              </div>
            </div>
            <div style={{background:'#ef444420',border:'1px solid #ef444440',borderRadius:12,padding:'8px 14px',textAlign:'center'}}>
              <div style={{color:'#ef4444',fontSize:12,fontWeight:700}}>ينتهي قريباً</div>
              <div style={{color:C.gray,fontSize:11}}>20 مقعد فقط</div>
            </div>
          </div>
          <div style={{marginBottom:28}}>
            {features.map((f,i) => (
              <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 0',borderBottom:i<features.length-1?`1px solid ${C.border}40`:'none'}}>
                <div style={{color:C.gold}}>✦</div>
                <div style={{color:C.white,fontSize:14}}>{f}</div>
              </div>
            ))}
          </div>
          <button onClick={()=>window.open('https://wa.me/966570749196?text=السلام عليكم، أريد الاشتراك في Murdi','_blank')} style={{width:'100%',padding:'18px',borderRadius:12,border:'none',background:`linear-gradient(135deg,${C.gold},${C.goldLight})`,color:C.navy,fontSize:17,fontWeight:900,cursor:'pointer',marginBottom:12}}>انضم الآن عبر WhatsApp</button>
          <button onClick={()=>router.push('/auth/signup')} style={{width:'100%',padding:'14px',borderRadius:12,border:`1px solid ${C.border}`,background:'transparent',color:C.gray,fontSize:14,cursor:'pointer'}}>جرّب مجاناً أولاً — بدون التزام</button>
          <div style={{textAlign:'center',marginTop:12,color:C.gray,fontSize:12}}>الاشتراك السنوي يمنح شهرين مجاناً</div>
        </div>
        <div style={{background:'linear-gradient(135deg,#112244,#0d1a35)',borderRadius:20,padding:'32px',textAlign:'center',border:`1px solid ${C.gold}30`}}>
          <div style={{color:C.gold,fontSize:20,fontWeight:900,marginBottom:8}}>جاهز تعرف صحة شركتك؟</div>
          <div style={{color:C.gray,fontSize:14,marginBottom:20}}>أول تقرير مجاني — بدون بطاقة ائتمان</div>
          <button onClick={()=>router.push('/auth/signup')} style={{padding:'14px 40px',borderRadius:12,border:'none',background:`linear-gradient(135deg,${C.gold},${C.goldLight})`,color:C.navy,fontSize:16,fontWeight:800,cursor:'pointer'}}>ابدأ مجاناً الآن</button>
        </div>
      </div>
      <div style={{borderTop:`1px solid ${C.border}`,padding:'20px',textAlign:'center',color:C.gray,fontSize:12}}>Murdi™️ — منصة الذكاء المالي للشركات السعودية • د. عبدالحكيم المرضي ©️ 2026</div>
    </div>
  )
}
