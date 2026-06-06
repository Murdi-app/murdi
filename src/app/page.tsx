"use client";
import { useState, useEffect } from "react";

const C = {
  navy:"#0B1D3A", navyMid:"#132850", navyLight:"#1A3A6B",
  gold:"#C8A84B", goldLight:"#E8CC7A", goldPale:"#FBF5E6",
  white:"#FFFFFF", ink:"#0B1D3A", slate:"#4A5568",
  muted:"#8A95A3", border:"#E8EDF4", bg:"#F4F7FB", cream:"#FAFBFE",
  red:"#C0392B", redPale:"#FEF2F2", orange:"#D35400", orangePale:"#FFF4EE",
  yellow:"#B7860B", yellowPale:"#FFFBEC", green:"#1A7A4A", greenPale:"#EDFAF4",
};

const num = (n:number) => new Intl.NumberFormat("ar-SA").format(Math.round(n));
const parse = (s:string) => parseFloat((s||"").replace(/,/g,""))||0;
const WA = "https://wa.me/966570749196?text=السلام عليكم، أريد الانضمام لبرنامج مؤسسي Murdi™️";

interface Risk { level:string; color:string; bg:string; title:string; detail:string; action:string; impact:string; scoreLift:string; }
interface Strength { title:string; detail:string; }
interface Opportunity { title:string; detail:string; }
interface Result {
  score:number; coverageDays:number; cashFlow:number; collectionDays:number; debtRatio:number;
  balance:number; revenue:number; expenses:number; debts:number; receivables:number;
  risks:Risk[]; strengths:Strength[]; opportunities:Opportunity[];
}

function calc(b:number,r:number,e:number,d:number,rec:number):Result {
  const cm=e>0?b/e:0, cd=cm*30, cf=r-e;
  const col=r>0?(rec/r)*30:0, dr=(r*12)>0?d/(r*12):0;
  let fh=0;
  fh+=cm>=3?25:cm>=1?15:0;
  fh+=cf>0?(cf/r>0.15?25:15):0;
  fh+=col<60?20:col<90?10:0;
  fh+=dr<0.5?15:dr<1?8:0;
  const score=Math.round(fh*0.4+65*0.25+65*0.2+60*0.15);
  const risks:Risk[]=[], strengths:Strength[]=[], opportunities:Opportunity[]=[];
  if(cm<1) risks.push({level:"حرج",color:C.red,bg:C.redPale,title:"السيولة في خطر حرج",detail:`رصيدك الحالي يغطي ${Math.round(cd)} يوماً فقط من مصروفاتك`,action:`حصّل جزءاً من الذمم المتأخرة — ${num(rec*0.3)} ريال على الأقل هذا الأسبوع`,impact:`التغطية ترتفع من ${Math.round(cd)} إلى ${Math.round(((b+rec*0.3)/e)*30)} يوماً`,scoreLift:"+15 نقطة"});
  else if(cm<3) risks.push({level:"تنبيه",color:C.orange,bg:C.orangePale,title:"السيولة تحتاج تعزيزاً",detail:`رصيدك يغطي ${Math.round(cd)} يوماً — أقل من 3 أشهر آمنة`,action:`حصّل الذمم وتجنّب مشاريع جديدة — ${num(rec*0.4)} ريال تعيدك للمنطقة الآمنة`,impact:`تغطيتك ترتفع فوق 90 يوماً`,scoreLift:"+10 نقاط"});
  if(col>=90) risks.push({level:"مرتفع",color:C.red,bg:C.redPale,title:"دورة التحصيل خطيرة",detail:`ذممك تحتاج ${Math.round(col)} يوماً للتحصيل`,action:"راجع شروط الدفع وضع حدا أقصى 60 يوماً في عقودك الجديدة",impact:"تقليل الدورة يحرر سيولة فورية",scoreLift:"+12 نقطة"});
  else if(col>=60) risks.push({level:"متوسط",color:C.yellow,bg:C.yellowPale,title:"دورة التحصيل تحتاج متابعة",detail:`ذممك تحتاج ${Math.round(col)} يوماً للتحصيل`,action:"تابع الذمم أسبوعياً وذكّر العملاء قبل الاستحقاق",impact:"تحسين التحصيل يعزز سيولتك مباشرة",scoreLift:"+8 نقاط"});
  if(dr>1) risks.push({level:"مرتفع",color:C.orange,bg:C.orangePale,title:"مستوى المديونية مرتفع",detail:`ديونك تمثل ${(dr*100).toFixed(0)}٪ من إيراداتك السنوية`,action:"لا تضف ديوناً جديدة وضع خطة سداد واضحة",impact:"خفض المديونية يرفع جاهزيتك للتمويل",scoreLift:"+10 نقاط"});
  if(cf>0) strengths.push({title:"التدفق النقدي إيجابي",detail:`تربح ${num(cf)} ريال شهرياً بعد المصروفات`});
  if(dr<0.5) strengths.push({title:"مستوى الديون ممتاز",detail:`نسبة مديونيتك ${(dr*100).toFixed(0)}٪ فقط`});
  if(cm>=3) strengths.push({title:"سيولة قوية",detail:`رصيدك يغطي ${cm.toFixed(1)} أشهر من المصروفات`});
  if(col<60&&col>0) strengths.push({title:"تحصيل سريع",detail:`دورة تحصيلك ${Math.round(col)} يوماً`});
  if(cf>0&&dr<0.8) opportunities.push({title:"فرصة تمويل",detail:"تدفقك الإيجابي ونسبة ديونك المنخفضة يجعلانك مرشحاً جيداً"});
  if(cm>=3&&cf>0) opportunities.push({title:"فرصة توسع",detail:"سيولتك وتدفقك يسمحان بدخول مشروع جديد بأمان"});
  if(score>=75) opportunities.push({title:"جاهزية استراتيجية",detail:"درجتك تؤهلك للشراكات الاستراتيجية والمشاريع الكبرى"});
  return{score,coverageDays:cd,cashFlow:cf,collectionDays:col,debtRatio:dr,balance:b,revenue:r,expenses:e,debts:d,receivables:rec,risks,strengths,opportunities};
}

function scoreLabel(s:number){
  if(s>=75) return{label:"ممتازة",color:C.green};
  if(s>=60) return{label:"جيدة",color:"#1A56DB"};
  if(s>=45) return{label:"متوسطة",color:C.orange};
  return{label:"في خطر",color:C.red};
}

function Gauge({score}:{score:number}){
  const{label,color}=scoreLabel(score);
  const dash=(score/85)*251.2;
  return(
    <div style={{textAlign:"center"}}>
      <svg width="200" height="130" viewBox="0 0 200 130">
        <defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={color}/><stop offset="100%" stopColor={C.goldLight}/>
        </linearGradient></defs>
        <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="14" strokeLinecap="round"/>
        <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="url(#g)" strokeWidth="14" strokeDasharray={`${dash} 251.2`} strokeLinecap="round"/>
        <text x="100" y="90" textAnchor="middle" fill={C.white} fontSize="46" fontWeight="900" fontFamily="system-ui">{score}</text>
        <text x="100" y="110" textAnchor="middle" fill="#7A90AB" fontSize="13" fontFamily="system-ui">/ 85</text>
      </svg>
      <div style={{color,fontWeight:800,fontSize:20,marginTop:4}}>{label}</div>
    </div>
  );
}

const F="'Tajawal','Cairo',system-ui,sans-serif";

const SERVICES=[
  {icon:"📊",title:"Murdi Score الشهري",desc:"درجة مالية من 85 تقيس صحة شركتك بدقة رياضية كل شهر"},
  {icon:"⚠️",title:"Top Risks",desc:"أهم المخاطر التي تهدد شركتك مرتبة حسب الأولوية والخطورة"},
  {icon:"⚡",title:"Action Engine",desc:"إجراءات واضحة وقابلة للتنفيذ لكل خطر — لا تشخيص بدون علاج"},
  {icon:"📈",title:"Impact Engine",desc:"اعرف بالأرقام ماذا سيحدث لدرجتك إذا نفّذت كل إجراء"},
  {icon:"🎯",title:"Opportunity Engine",desc:"الفرص المالية المتاحة لشركتك بناءً على وضعها الفعلي"},
  {icon:"📉",title:"Trend Engine",desc:"بعد 3 أشهر — اقرأ اتجاه شركتك: هل تتحسن أم تتراجع؟"},
  {icon:"🧠",title:"Company Memory™️",desc:"تاريخ شركتك الكامل محفوظ — كل تقرير وقرار موثق"},
  {icon:"🏆",title:"شهادة Murdi Score",desc:"وثيقة رسمية موقعة تثبت جاهزيتك للبنوك والشركاء"},
];

const STATS=[
  {n:"8",l:"محركات ذكية",sub:"تعمل لصالحك"},
  {n:"85",l:"درجة التقييم",sub:"من 85 نقطة"},
  {n:"15",l:"دقيقة شهرياً",sub:"فقط لا غير"},
  {n:"14",l:"فئة مخاطر",sub:"تُرصد تلقائياً"},
];

export default function Home(){
  const[step,setStep]=useState<"landing"|"input"|"report">("landing");
  const[company,setCompany]=useState("");
  const[form,setForm]=useState({balance:"",revenue:"",expenses:"",debts:"",receivables:""});
  const[result,setResult]=useState<Result|null>(null);
  const[scrolled,setScrolled]=useState(false);

  useEffect(()=>{
    const onScroll=()=>setScrolled(window.scrollY>40);
    window.addEventListener("scroll",onScroll);
    return()=>window.removeEventListener("scroll",onScroll);
  },[]);

  const fields=[
    {key:"balance",label:"الرصيد البنكي الحالي",ph:"مثال: 450,000",icon:"🏦"},
    {key:"revenue",label:"متوسط الإيرادات الشهرية المحصّلة",ph:"مثال: 1,000,000",icon:"📥"},
    {key:"expenses",label:"متوسط المصروفات الشهرية",ph:"مثال: 600,000",icon:"📤"},
    {key:"debts",label:"إجمالي الديون والقروض",ph:"مثال: 1,200,000",icon:"💳"},
    {key:"receivables",label:"إجمالي الذمم المدينة",ph:"مثال: 2,000,000",icon:"📋"},
  ];

  const filled=company.trim()!==""&&fields.every(f=>(form as Record<string,string>)[f.key].trim()!=="");

  return(
    <div dir="rtl" style={{minHeight:"100vh",background:C.bg,fontFamily:F,color:C.ink}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&family=Cairo:wght@400;600;700;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        html{scroll-behavior:smooth;}
        .nav-link{color:rgba(255,255,255,0.7);font-size:14px;cursor:pointer;padding:6px 0;transition:color 0.2s;text-decoration:none;font-family:'Tajawal',sans-serif;}
        .nav-link:hover{color:#C8A84B;}
        .service-card{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);border-top:3px solid #C8A84B;border-radius:16px;padding:22px;transition:transform 0.2s,box-shadow 0.2s;}
        .service-card:hover{transform:translateY(-4px);box-shadow:0 12px 32px rgba(0,0,0,0.2);}
        .why-card{background:white;border-radius:16px;padding:28px;border:1px solid #E8EDF4;transition:transform 0.2s,box-shadow 0.2s;}
        .why-card:hover{transform:translateY(-3px);box-shadow:0 8px 24px rgba(11,29,58,0.08);}
        .input-field{width:100%;box-sizing:border-box;padding:14px 16px;border-radius:12px;border:1.5px solid #E8EDF4;font-size:16px;font-family:'Tajawal',sans-serif;outline:none;background:#F4F7FB;transition:border-color 0.2s;}
        .input-field:focus{border-color:#C8A84B;background:white;}
        .btn-gold{background:linear-gradient(135deg,#C8A84B,#E8CC7A);color:#0B1D3A;border:none;border-radius:12px;font-family:'Tajawal',sans-serif;font-weight:800;cursor:pointer;transition:transform 0.15s,box-shadow 0.15s;}
        .btn-gold:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(200,168,75,0.5);}
        .feature-badge{display:inline-flex;align-items:center;gap:6px;background:rgba(200,168,75,0.12);color:#C8A84B;padding:6px 16px;border-radius:20px;font-size:13px;font-weight:700;border:1px solid rgba(200,168,75,0.3);}
        .pulse{animation:pulse 2s infinite;}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.6}}
        @media(max-width:768px){
          .hero-title{font-size:32px!important;}
          .stats-grid{grid-template-columns:1fr 1fr!important;}
          .services-grid{grid-template-columns:1fr 1fr!important;}
          .why-grid{grid-template-columns:1fr!important;}
          .founder-inner{flex-direction:column!important;text-align:center!important;}
          .pricing-features{grid-template-columns:1fr!important;}
          .header-nav{display:none!important;}
          .header-inner{padding:0 20px!important;}
        }
      `}</style>

      {/* HEADER */}
      <header style={{
        background:scrolled?'rgba(11,29,58,0.97)':C.navy,
        backdropFilter:scrolled?'blur(12px)':'none',
        padding:"0 40px",height:68,display:"flex",justifyContent:"space-between",
        alignItems:"center",position:"sticky",top:0,zIndex:100,
        boxShadow:scrolled?"0 2px 24px rgba(0,0,0,0.3)":"none",
        transition:"all 0.3s ease",
        borderBottom:`1px solid rgba(200,168,75,${scrolled?0.2:0})`
      }} className="header-inner">
        <div onClick={()=>{setStep("landing");window.scrollTo(0,0);}} style={{cursor:"pointer",display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:40,height:40,borderRadius:10,background:`linear-gradient(135deg,${C.gold},${C.goldLight})`,display:"flex",alignItems:"center",justifyContent:"center",color:C.navy,fontWeight:900,fontSize:20,boxShadow:`0 4px 12px rgba(200,168,75,0.4)`}}>م</div>
          <div>
            <div style={{fontWeight:900,fontSize:20,color:C.white,lineHeight:1}}>
              Murdi™️ &nbsp;<span style={{color:C.gold,fontFamily:"'Tajawal',sans-serif"}}>| مُرضي</span>
            </div>
            <div style={{fontSize:10,color:"#7A90AB",letterSpacing:1.5,marginTop:3}}>CONSTRUCTION INTELLIGENCE</div>
          </div>
        </div>

        <nav className="header-nav" style={{display:"flex",gap:28,alignItems:"center"}}>
          <a href="#services" className="nav-link">الخدمات</a>
          <a href="#why" className="nav-link">لماذا Murdi</a>
          <a href="#founder" className="nav-link">من بنانا</a>
          <a href="#pricing" className="nav-link">الأسعار</a>
        </nav>

        <div style={{display:"flex",gap:10,alignItems:"center"}}>
          <a href="/auth/login" style={{background:"transparent",border:`1px solid rgba(200,168,75,0.35)`,borderRadius:8,color:C.gold,fontSize:13,padding:"7px 16px",textDecoration:"none",fontFamily:F}}>
            دخول
          </a>
          <a href={WA} target="_blank" className="btn-gold" style={{padding:"8px 18px",fontSize:13,borderRadius:8,textDecoration:"none",display:"inline-block"}}>
            انضم الآن
          </a>
        </div>
      </header>

      {step==="landing"&&(
        <div>
          {/* HERO */}
          <section style={{background:`linear-gradient(160deg,${C.navy} 0%,${C.navyMid} 55%,${C.navyLight} 100%)`,padding:"110px 24px 90px",textAlign:"center",position:"relative",overflow:"hidden"}}>
            <div style={{position:"absolute",top:-150,left:"50%",transform:"translateX(-50%)",width:800,height:800,borderRadius:"50%",background:`radial-gradient(circle,${C.gold}12 0%,transparent 65%)`,pointerEvents:"none"}}/>
            <div style={{position:"relative",maxWidth:760,margin:"0 auto"}}>
              <div className="feature-badge" style={{marginBottom:28}}>
                🇸🇦 نظام تشغيل ذكاء المقاولات — المملكة العربية السعودية
              </div>
              <h1 className="hero-title" style={{fontSize:54,fontWeight:900,lineHeight:1.2,margin:"0 0 24px",color:C.white,fontFamily:"'Cairo',sans-serif"}}>
                اعرف صحة شركتك المالية<br/>
                <span style={{color:C.gold}}>قبل أن تتحول لأزمة</span>
              </h1>
              <p style={{fontSize:19,color:"#A8BAD4",lineHeight:1.9,maxWidth:580,margin:"0 auto 44px"}}>
                Murdi يراقب وضع شركتك، ينذرك مبكراً بالمخاطر،<br/>ويخبرك بالضبط ماذا تفعل غداً — في 15 دقيقة شهرياً فقط.
              </p>
              <div style={{display:"flex",gap:14,justifyContent:"center",flexWrap:"wrap",marginBottom:20}}>
                <button onClick={()=>window.location.href="/auth/signup"} className="btn-gold" style={{padding:"16px 44px",fontSize:18,borderRadius:14,boxShadow:`0 12px 35px rgba(200,168,75,0.5)`}}>
                  احصل على تقريرك المجاني
                </button>
                <a href={WA} target="_blank" style={{display:"inline-flex",alignItems:"center",gap:8,background:"rgba(255,255,255,0.08)",color:C.white,border:"1px solid rgba(255,255,255,0.15)",borderRadius:14,padding:"16px 28px",fontSize:15,textDecoration:"none",fontWeight:600}}>
                  💬 تواصل معنا
                </a>
              </div>
              <div style={{fontSize:13,color:"#6A80A0",marginBottom:64}}>بدون التزام — 5 أرقام فقط — نتيجة فورية</div>

              {/* Stats */}
              <div className="stats-grid" style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",borderTop:"1px solid rgba(255,255,255,0.08)",paddingTop:48}}>
                {STATS.map((x,i)=>(
                  <div key={i} style={{textAlign:"center",padding:"0 16px",borderRight:i<3?"1px solid rgba(255,255,255,0.08)":"none"}}>
                    <div style={{fontSize:44,fontWeight:900,color:C.gold,lineHeight:1,fontFamily:"'Cairo',sans-serif"}}>{x.n}</div>
                    <div style={{fontSize:14,color:C.white,fontWeight:700,marginTop:8}}>{x.l}</div>
                    <div style={{fontSize:12,color:"#6A80A0",marginTop:4}}>{x.sub}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* SERVICES */}
          <section id="services" style={{padding:"88px 24px",background:C.navy}}>
            <div style={{maxWidth:1000,margin:"0 auto"}}>
              <div style={{textAlign:"center",marginBottom:56}}>
                <div className="feature-badge" style={{marginBottom:16}}>المحركات الذكية</div>
                <h2 style={{fontSize:36,fontWeight:900,margin:"0 0 14px",color:C.white,fontFamily:"'Cairo',sans-serif"}}>ماذا تحصل بعد الاشتراك؟</h2>
                <p style={{fontSize:16,color:"#7A90AB",maxWidth:480,margin:"0 auto"}}>8 محركات ذكية تعمل لصالح شركتك كل شهر</p>
              </div>
              <div className="services-grid" style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16}}>
                {SERVICES.map((s,i)=>(
                  <div key={i} className="service-card">
                    <div style={{fontSize:28,marginBottom:12}}>{s.icon}</div>
                    <div style={{fontWeight:800,fontSize:14,marginBottom:8,color:C.white}}>{s.title}</div>
                    <div style={{fontSize:13,color:"#7A90AB",lineHeight:1.7}}>{s.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* WHY */}
          <section id="why" style={{padding:"88px 24px",background:C.bg}}>
            <div style={{maxWidth:960,margin:"0 auto"}}>
              <div style={{textAlign:"center",marginBottom:52}}>
                <div className="feature-badge" style={{marginBottom:16,background:"rgba(11,29,58,0.07)",color:C.navy,border:"1px solid rgba(11,29,58,0.12)"}}>المشكلة الحقيقية</div>
                <h2 style={{fontSize:36,fontWeight:900,margin:"0 0 12px",fontFamily:"'Cairo',sans-serif"}}>لماذا تتعثر شركات المقاولات؟</h2>
                <p style={{fontSize:16,color:C.slate,maxWidth:460,margin:"0 auto"}}>ثلاثة أسباب متكررة — Murdi يعالج الثلاثة</p>
              </div>
              <div className="why-grid" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:20}}>
                {[
                  {icon:"🔕",t:"غياب الإنذار المبكر",d:"تكتشف المشكلة بعد أن تصبح أزمة — لا قبلها بأشهر",fix:"Murdi ينذرك قبل 60-90 يوماً"},
                  {icon:"👁️",t:"لا أحد يراقب التدفق",d:"90٪ من شركات المقاولات بلا مدير مالي متخصص",fix:"Murdi يراقب تدفقك كل شهر تلقائياً"},
                  {icon:"📊",t:"أرقام بلا قرارات",d:"حتى لو وُجد محاسب، لا يحول الأرقام لخطوات واضحة",fix:"Murdi يحوّل كل رقم لإجراء محدد"},
                ].map((x,i)=>(
                  <div key={i} className="why-card">
                    <div style={{fontSize:32,marginBottom:16}}>{x.icon}</div>
                    <div style={{fontWeight:800,fontSize:18,marginBottom:10,color:C.navy}}>{x.t}</div>
                    <div style={{fontSize:14,color:C.slate,lineHeight:1.8,marginBottom:16}}>{x.d}</div>
                    <div style={{background:C.greenPale,border:`1px solid ${C.green}20`,borderRadius:8,padding:"10px 14px",fontSize:13,color:C.green,fontWeight:700}}>✓ {x.fix}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* FOUNDER */}
          <section id="founder" style={{padding:"88px 24px",background:C.white}}>
            <div style={{maxWidth:900,margin:"0 auto"}}>
              <div style={{textAlign:"center",marginBottom:52}}>
                <div className="feature-badge" style={{marginBottom:16,background:"rgba(11,29,58,0.07)",color:C.navy,border:"1px solid rgba(11,29,58,0.12)"}}>الخبرة خلف المنهجية</div>
                <h2 style={{fontSize:36,fontWeight:900,margin:"0 0 12px",fontFamily:"'Cairo',sans-serif"}}>من بنى Murdi؟</h2>
                <p style={{fontSize:16,color:C.slate,maxWidth:500,margin:"0 auto"}}>Murdi ليس مجرد برنامج — هو تجسيد رقمي لمنهجية علمية في إدارة الصحة المالية للمقاولات</p>
              </div>
              <div className="founder-inner" style={{background:`linear-gradient(135deg,${C.navy},${C.navyMid})`,borderRadius:24,padding:"48px 44px",display:"flex",gap:44,alignItems:"center",border:`1px solid rgba(200,168,75,0.2)`,boxShadow:"0 24px 64px rgba(11,29,58,0.12)"}}>
                <div style={{flexShrink:0,textAlign:"center"}}>
                  <div style={{width:150,height:150,borderRadius:"50%",background:`linear-gradient(135deg,rgba(200,168,75,0.2),rgba(200,168,75,0.05))`,border:`3px solid ${C.gold}`,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px",fontSize:60,boxShadow:`0 8px 32px rgba(200,168,75,0.2)`}}>
                    👨‍💼
                  </div>
                  <div style={{color:C.gold,fontWeight:800,fontSize:15}}>د. عبدالحكيم المرضي</div>
                  <div style={{color:"#7A90AB",fontSize:13,marginTop:4}}>مؤسس المنهجية</div>
                </div>
                <div style={{flex:1}}>
                  <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:22}}>
                    {["دكتوراه إدارة أعمال","مستشار أعمال معتمد","عضو البورد الأمريكي","15+ سنة في المقاولات"].map((badge,i)=>(
                      <div key={i} style={{background:"rgba(200,168,75,0.12)",color:C.gold,padding:"5px 14px",borderRadius:20,fontSize:12,fontWeight:700,border:"1px solid rgba(200,168,75,0.25)"}}>✦ {badge}</div>
                    ))}
                  </div>
                  <p style={{fontSize:15,color:"#A8BAD4",lineHeight:1.9,margin:"0 0 16px"}}>بعد أكثر من 15 عاماً من العمل مع شركات المقاولات في المملكة، لاحظ د. عبدالحكيم نمطاً متكرراً: شركات تنهار ليس بسبب نقص العمل، بل بسبب غياب الوضوح المالي في الوقت الصحيح.</p>
                  <p style={{fontSize:15,color:"#A8BAD4",lineHeight:1.9,margin:"0 0 28px"}}>من هذه التجربة ولدت منهجية Murdi — نظام يحوّل الأرقام لقرارات يفهمها المقاول، لا المحاسب فقط.</p>
                  <a href={WA} target="_blank" className="btn-gold" style={{display:"inline-block",padding:"12px 28px",fontSize:14,borderRadius:10,textDecoration:"none"}}>تواصل مع د. عبدالحكيم مباشرة</a>
                </div>
              </div>
            </div>
          </section>

          {/* PRICING */}
          <section id="pricing" style={{padding:"88px 24px",background:C.bg}}>
            <div style={{maxWidth:820,margin:"0 auto"}}>
              <div style={{textAlign:"center",marginBottom:52}}>
                <div className="feature-badge" style={{marginBottom:16,background:"rgba(11,29,58,0.07)",color:C.navy,border:"1px solid rgba(11,29,58,0.12)"}}>العضوية التأسيسية</div>
                <h2 style={{fontSize:36,fontWeight:900,margin:"0 0 12px",fontFamily:"'Cairo',sans-serif"}}>برنامج Murdi Founding Members™️</h2>
                <p style={{fontSize:16,color:C.slate}}>أول 20 شركة فقط — امتياز لا خصم</p>
              </div>
              <div style={{background:`linear-gradient(135deg,${C.navy},${C.navyMid})`,borderRadius:24,padding:"52px 44px",textAlign:"center",border:`1px solid rgba(200,168,75,0.25)`,boxShadow:"0 24px 64px rgba(11,29,58,0.15)",position:"relative",overflow:"hidden"}}>
                <div style={{position:"absolute",top:-60,right:-60,width:200,height:200,borderRadius:"50%",background:`radial-gradient(circle,${C.gold}15,transparent 70%)`,pointerEvents:"none"}}/>
                <div style={{display:"inline-block",background:"rgba(200,168,75,0.12)",color:C.gold,padding:"6px 20px",borderRadius:16,fontSize:13,fontWeight:700,marginBottom:28,border:"1px solid rgba(200,168,75,0.25)"}}>
                  <span className="pulse">🔴</span> مقاعد محدودة — 20 شركة فقط
                </div>
                <div style={{fontSize:15,color:"#A8BAD4",marginBottom:6}}>السعر الحصري للمؤسسين</div>
                <div style={{display:"flex",alignItems:"baseline",justifyContent:"center",gap:8,marginBottom:6}}>
                  <span style={{fontSize:62,fontWeight:900,color:C.gold,fontFamily:"'Cairo',sans-serif",lineHeight:1}}>1,990</span>
                  <span style={{fontSize:18,color:"#A8BAD4"}}>ريال</span>
                </div>
                <div style={{fontSize:14,color:"#6A80A0",marginBottom:40}}>شهرياً — مجمّد مدى الحياة</div>
                <div className="pricing-features" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,maxWidth:500,margin:"0 auto 40px",textAlign:"right"}}>
                  {["جميع المحركات الذكية الثمانية","سعر مجمّد مدى الحياة","اسمك في صفحة مؤسسي Murdi","وصول مباشر لد. عبدالحكيم","تأثير على تطوير المنهجية","أول تقرير مجاناً بدون التزام"].map((x,i)=>(
                    <div key={i} style={{display:"flex",alignItems:"center",gap:10,color:C.white,fontSize:13,background:"rgba(255,255,255,0.04)",borderRadius:10,padding:"10px 14px",border:"1px solid rgba(255,255,255,0.06)"}}>
                      <span style={{color:C.gold,flexShrink:0}}>✦</span>{x}
                    </div>
                  ))}
                </div>
                <a href={WA} target="_blank" className="btn-gold" style={{display:"inline-block",padding:"16px 48px",fontSize:17,borderRadius:14,textDecoration:"none",boxShadow:`0 8px 32px rgba(200,168,75,0.4)`}}>
                  انضم الآن عبر WhatsApp
                </a>
                <div style={{marginTop:14,fontSize:13,color:"#6A80A0"}}>الاشتراك السنوي يمنح شهرين مجاناً</div>
              </div>
            </div>
          </section>

          {/* FINAL CTA */}
          <section style={{background:`linear-gradient(135deg,${C.navy},${C.navyLight})`,padding:"80px 24px",textAlign:"center",position:"relative",overflow:"hidden"}}>
            <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:600,height:400,borderRadius:"50%",background:`radial-gradient(circle,${C.gold}10,transparent 70%)`,pointerEvents:"none"}}/>
            <div style={{position:"relative"}}>
              <h2 style={{fontSize:38,fontWeight:900,color:C.white,margin:"0 0 16px",fontFamily:"'Cairo',sans-serif"}}>جرّب Murdi الآن — مجاناً</h2>
              <p style={{fontSize:17,color:"#A8BAD4",margin:"0 0 36px"}}>تقريرك الأول جاهز خلال ثوانٍ — بدون أي التزام</p>
              <button onClick={()=>window.location.href="/auth/signup"} className="btn-gold" style={{padding:"17px 50px",fontSize:18,borderRadius:14,boxShadow:`0 8px 32px rgba(200,168,75,0.4)`}}>
                ابدأ التقييم المجاني
              </button>
            </div>
          </section>

          {/* FOOTER */}
          <footer style={{padding:"32px 40px",background:C.navy,borderTop:"1px solid rgba(255,255,255,0.06)"}}>
            <div style={{maxWidth:960,margin:"0 auto",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:16}}>
              <div>
                <div style={{fontWeight:900,fontSize:17,color:C.white,marginBottom:4}}>Murdi™️ | مُرضي</div>
                <div style={{fontSize:12,color:"#6A80A0"}}>Construction Intelligence Operating System</div>
              </div>
              <div style={{color:"#6A80A0",fontSize:13}}>د. عبدالحكيم المرضي ©️ 2026</div>
              <a href={WA} style={{color:C.gold,textDecoration:"none",fontSize:14,fontWeight:700}}>📞 0570749196</a>
            </div>
          </footer>
        </div>
      )}

      {/* INPUT */}
      {step==="input"&&(
        <div style={{maxWidth:580,margin:"0 auto",padding:"44px 20px"}}>
          <div style={{textAlign:"center",marginBottom:36}}>
            <div className="feature-badge" style={{marginBottom:16,background:"rgba(11,29,58,0.07)",color:C.navy,border:"1px solid rgba(11,29,58,0.12)"}}>تقرير Murdi المجاني</div>
            <h1 style={{fontSize:30,fontWeight:900,margin:"0 0 10px",fontFamily:"'Cairo',sans-serif"}}>احصل على تقريرك الآن</h1>
            <p style={{fontSize:16,color:C.slate}}>5 أرقام فقط — تحليل مالي كامل فوراً</p>
          </div>
          <div style={{background:C.white,borderRadius:16,padding:28,border:`1px solid ${C.border}`,marginBottom:16}}>
            <label style={{fontSize:14,fontWeight:700,color:C.slate,display:"block",marginBottom:10}}>🏢 اسم الشركة</label>
            <input value={company} onChange={e=>setCompany(e.target.value)} placeholder="مثال: شركة النور للمقاولات" className="input-field"/>
          </div>
          <div style={{background:C.white,borderRadius:16,padding:28,border:`1px solid ${C.border}`,marginBottom:20}}>
            <div style={{fontSize:15,fontWeight:800,color:C.navy,marginBottom:22,paddingBottom:14,borderBottom:`1px solid ${C.border}`}}>البيانات المالية — بالريال السعودي</div>
            {fields.map((f,i)=>(
              <div key={f.key} style={{marginBottom:i<fields.length-1?20:0}}>
                <label style={{fontSize:14,fontWeight:600,color:C.slate,display:"block",marginBottom:8}}>{f.icon} {f.label}</label>
                <input value={(form as Record<string,string>)[f.key]} onChange={e=>setForm({...form,[f.key]:e.target.value})} placeholder={f.ph} className="input-field"/>
              </div>
            ))}
          </div>
          <div style={{textAlign:"center",fontSize:13,color:C.muted,marginBottom:20}}>🔒 بياناتك سرية — لا تُشارك مع أي طرف</div>
          <button onClick={()=>window.location.href="/auth/signup"} disabled={!filled} className="btn-gold" style={{width:"100%",padding:18,fontSize:18,borderRadius:12,opacity:filled?1:0.5,cursor:filled?"pointer":"not-allowed"}}>
            احسب Murdi Score الآن
          </button>
        </div>
      )}

      {/* REPORT */}
      {step==="report"&&result&&(
        <div style={{maxWidth:640,margin:"0 auto",padding:"32px 20px"}}>
          <div style={{background:C.navy,borderRadius:20,padding:32,textAlign:"center",marginBottom:16,boxShadow:"0 8px 32px rgba(11,29,58,0.3)"}}>
            <div style={{fontSize:13,color:"#7A90AB",marginBottom:4}}>Murdi Financial Report</div>
            <div style={{fontSize:24,fontWeight:900,color:C.white,marginBottom:24,fontFamily:"'Cairo',sans-serif"}}>{company}</div>
            <Gauge score={result.score}/>
          </div>
          <div style={{background:C.white,borderRadius:16,padding:24,border:`1px solid ${C.border}`,marginBottom:16}}>
            <div style={{fontSize:15,fontWeight:800,color:C.navy,marginBottom:18,paddingBottom:12,borderBottom:`1px solid ${C.border}`}}>المؤشرات الرئيسية</div>
            {[
              {l:"تغطية السيولة",v:`${Math.round(result.coverageDays)} يوماً`,ok:result.coverageDays>=90,warn:result.coverageDays>=30},
              {l:"التدفق النقدي الشهري",v:`${result.cashFlow>=0?"+":""}${num(result.cashFlow)} ريال`,ok:result.cashFlow>=0,warn:result.cashFlow>=0},
              {l:"دورة التحصيل",v:`${Math.round(result.collectionDays)} يوما`,ok:result.collectionDays<60,warn:result.collectionDays<90},
              {l:"نسبة المديونية",v:`${(result.debtRatio*100).toFixed(1)}٪`,ok:result.debtRatio<0.5,warn:result.debtRatio<1},
            ].map((m,i)=>{
              const col=m.ok?C.green:m.warn?C.yellow:C.red;
              return(
                <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"13px 0",borderBottom:i<3?`1px solid ${C.border}`:"none"}}>
                  <span style={{fontSize:15,color:C.slate}}>{m.l}</span>
                  <span style={{display:"flex",alignItems:"center",gap:10}}>
                    <span style={{fontWeight:700,fontSize:15,color:C.navy}}>{m.v}</span>
                    <span style={{background:`${col}18`,color:col,borderRadius:6,padding:"3px 12px",fontSize:12,fontWeight:700,border:`1px solid ${col}30`}}>{m.ok?"جيد":m.warn?"تنبيه":"خطر"}</span>
                  </span>
                </div>
              );
            })}
          </div>
          {result.risks.length>0&&(
            <div style={{background:C.white,borderRadius:16,padding:24,border:`1px solid ${C.border}`,marginBottom:16}}>
              <div style={{fontSize:15,fontWeight:800,color:C.red,marginBottom:18,paddingBottom:12,borderBottom:`1px solid ${C.border}`}}>Top Risks — المخاطر والإجراءات</div>
              {result.risks.map((r,i)=>(
                <div key={i} style={{background:r.bg,border:`1.5px solid ${r.color}30`,borderRadius:14,padding:20,marginBottom:14}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                    <span style={{fontWeight:800,fontSize:16,color:C.navy,flex:1}}>{r.title}</span>
                    <span style={{background:`${r.color}20`,color:r.color,borderRadius:6,padding:"3px 12px",fontSize:12,fontWeight:800}}>{r.level}</span>
                  </div>
                  <div style={{fontSize:14,color:C.slate,marginBottom:14,lineHeight:1.7}}>{r.detail}</div>
                  <div style={{background:C.white,borderRadius:10,padding:"12px 16px",marginBottom:12,border:`1px solid ${C.border}`}}>
                    <div style={{fontSize:11,color:C.gold,fontWeight:800,marginBottom:5}}>ACTION ENGINE</div>
                    <div style={{fontSize:14,lineHeight:1.6,color:C.navy}}>{r.action}</div>
                  </div>
                  <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                    <div style={{flex:1,minWidth:170,background:`${C.navy}08`,borderRadius:10,padding:"10px 14px",border:`1px solid ${C.border}`}}>
                      <div style={{fontSize:11,color:C.navy,fontWeight:800,marginBottom:4}}>IMPACT ENGINE</div>
                      <div style={{fontSize:13,lineHeight:1.5,color:C.slate}}>{r.impact}</div>
                    </div>
                    <div style={{background:`linear-gradient(135deg,rgba(200,168,75,0.15),${C.goldPale})`,borderRadius:10,padding:"10px 16px",textAlign:"center",border:`1px solid rgba(200,168,75,0.3)`,minWidth:90}}>
                      <div style={{fontSize:11,color:C.yellow,fontWeight:800,marginBottom:4}}>على الدرجة</div>
                      <div style={{fontSize:18,fontWeight:900,color:C.gold}}>{r.scoreLift}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {result.strengths.length>0&&(
            <div style={{background:C.white,borderRadius:16,padding:24,border:`1px solid ${C.border}`,marginBottom:16}}>
              <div style={{fontSize:15,fontWeight:800,color:C.green,marginBottom:18,paddingBottom:12,borderBottom:`1px solid ${C.border}`}}>نقاط القوة</div>
              {result.strengths.map((s,i)=>(
                <div key={i} style={{background:C.greenPale,borderRadius:10,padding:"14px 16px",marginBottom:10,border:`1px solid ${C.green}20`}}>
                  <div style={{fontWeight:700,fontSize:15,marginBottom:4,color:C.navy}}>✓ {s.title}</div>
                  <div style={{fontSize:13,color:C.slate}}>{s.detail}</div>
                </div>
              ))}
            </div>
          )}
          {result.opportunities.length>0&&(
            <div style={{background:C.white,borderRadius:16,padding:24,border:`1px solid ${C.border}`,marginBottom:16}}>
              <div style={{fontSize:15,fontWeight:800,color:C.navy,marginBottom:18,paddingBottom:12,borderBottom:`1px solid ${C.border}`}}>Opportunity Engine</div>
              {result.opportunities.map((o,i)=>(
                <div key={i} style={{borderRight:`3px solid ${C.gold}`,background:C.goldPale,borderRadius:"0 10px 10px 0",padding:"12px 16px",marginBottom:10}}>
                  <div style={{fontWeight:700,fontSize:15,marginBottom:4,color:C.navy}}>{o.title}</div>
                  <div style={{fontSize:13,color:C.slate,lineHeight:1.6}}>{o.detail}</div>
                </div>
              ))}
            </div>
          )}
          <div style={{background:`linear-gradient(135deg,${C.navy},${C.navyMid})`,borderRadius:16,padding:32,textAlign:"center",marginBottom:16}}>
            <div style={{fontSize:20,fontWeight:900,color:C.white,marginBottom:8,fontFamily:"'Cairo',sans-serif"}}>هل هذا التقرير مفيد لك؟</div>
            <div style={{fontSize:14,color:"#A8BAD4",marginBottom:24}}>انضم لبرنامج Murdi Founding Members™️ — 20 مقعداً فقط</div>
            <a href={WA} target="_blank" className="btn-gold" style={{display:"inline-block",padding:"14px 32px",fontSize:16,borderRadius:10,textDecoration:"none"}}>انضم الآن — 1,990 ريال/شهر</a>
          </div>
          <button onClick={()=>{setStep("landing");window.scrollTo(0,0);}} style={{width:"100%",background:"transparent",color:C.slate,border:`1px solid ${C.border}`,borderRadius:12,padding:14,fontSize:15,cursor:"pointer",fontFamily:F,marginBottom:8}}>
            ← العودة للرئيسية
          </button>
        </div>
      )}
    </div>
  );
}
