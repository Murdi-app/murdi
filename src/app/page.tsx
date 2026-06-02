"use client";
import { useState } from "react";

const C = {
  navy:"#0B1D3A", navyMid:"#132850", gold:"#C8A84B", goldLight:"#E8CC7A",
  goldPale:"#FBF5E6", white:"#FFFFFF", ink:"#0B1D3A", slate:"#4A5568",
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
  fh+=dr<0.5?15:dr<1?8:0;
  const score=Math.round(fh*0.4+65*0.25+65*0.2+60*0.15);
  const risks:Risk[]=[], strengths:Strength[]=[], opportunities:Opportunity[]=[];

  if(cm<1) risks.push({level:"حرج",color:C.red,bg:C.redPale,
    title:"السيولة في خطر حرج",
    detail:`رصيدك الحالي يغطي ${Math.round(cd)} يوماً فقط من مصروفاتك`,
    action:`حصّل جزءاً من الذمم المتأخرة — ${num(rec*0.3)} ريال على الأقل هذا الأسبوع`,
    impact:`التغطية ترتفع من ${Math.round(cd)} إلى ${Math.round(((b+rec*0.3)/e)*30)} يوماً`,
    scoreLift:"+15 نقطة"});
  else if(cm<3) risks.push({level:"تنبيه",color:C.orange,bg:C.orangePale,
    title:"السيولة تحتاج تعزيزاً",
    detail:`رصيدك يغطي ${Math.round(cd)} يوماً — أقل من 3 أشهر آمنة`,
    action:`حصّل الذمم وتجنّب مشاريع جديدة — ${num(rec*0.4)} ريال تعيدك للمنطقة الآمنة`,
    impact:`تغطيتك ترتفع فوق 90 يوماً`,
    scoreLift:"+10 نقاط"});

  if(col>=90) risks.push({level:"مرتفع",color:C.red,bg:C.redPale,
    title:"دورة التحصيل خطيرة",
    detail:`ذممك تحتاج ${Math.round(col)} يوماً للتحصيل — أعلى من الحد الآمن`,
    action:"راجع شروط الدفع وضع حداً أقصى 60 يوماً في عقودك الجديدة",
    impact:"تقليل الدورة يحرّر سيولة فورية من الذمم المتراكمة",
    scoreLift:"+12 نقطة"});
  else if(col>=60) risks.push({level:"متوسط",color:C.yellow,bg:C.yellowPale,
    title:"دورة التحصيل تحتاج متابعة",
    detail:`ذممك تحتاج ${Math.round(col)} يوماً للتحصيل`,
    action:"تابع الذمم أسبوعياً وذكّر العملاء قبل الاستحقاق",
    impact:"تحسين التحصيل يعزز سيولتك مباشرة",
    scoreLift:"+8 نقاط"});

  if(dr>1) risks.push({level:"مرتفع",color:C.orange,bg:C.orangePale,
    title:"مستوى المديونية مرتفع",
    detail:`ديونك تمثل ${(dr*100).toFixed(0)}٪ من إيراداتك السنوية`,
    action:"لا تضف ديوناً جديدة وضع خطة سداد واضحة",
    impact:"خفض المديونية يرفع جاهزيتك للتمويل ويحسّن درجتك",
    scoreLift:"+10 نقاط"});

  if(cf>0) strengths.push({title:"التدفق النقدي إيجابي",detail:`تربح ${num(cf)} ريال شهرياً بعد المصروفات`});
  if(dr<0.5) strengths.push({title:"مستوى الديون ممتاز",detail:`نسبة مديونيتك ${(dr*100).toFixed(0)}٪ فقط من إيراداتك السنوية`});
  if(cm>=3) strengths.push({title:"سيولة قوية",detail:`رصيدك يغطي ${cm.toFixed(1)} أشهر من المصروفات`});
  if(col<60&&col>0) strengths.push({title:"تحصيل سريع",detail:`دورة تحصيلك ${Math.round(col)} يوماً — ضمن الحد الآمن`});

  if(cf>0&&dr<0.8) opportunities.push({title:"فرصة تمويل",detail:`تدفقك الإيجابي ونسبة ديونك المنخفضة يجعلانك مرشحاً جيداً للتمويل الآن`});
  if(cm>=3&&cf>0) opportunities.push({title:"فرصة توسع",detail:`سيولتك وتدفقك يسمحان بدخول مشروع جديد بأمان`});
  if(col<45&&col>0) opportunities.push({title:"ميزة تنافسية في التحصيل",detail:`دورتك أفضل من متوسط السوق — استثمرها في التفاوض مع الموردين`});
  if(score>=75) opportunities.push({title:"جاهزية استراتيجية",detail:`درجتك تؤهلك للشراكات الاستراتيجية والمشاريع الكبرى`});

  return{score,coverageDays:cd,cashFlow:cf,collectionDays:col,debtRatio:dr,balance:b,revenue:r,expenses:e,debts:d,receivables:rec,risks,strengths,opportunities};
}

function scoreLabel(s:number){
  if(s>=90) return{label:"ممتازة",color:C.green};
  if(s>=75) return{label:"جيدة جداً",color:"#1A56DB"};
  if(s>=60) return{label:"متوسطة",color:C.orange};
  if(s>=45) return{label:"في خطر",color:C.red};
  return{label:"خطر حرج",color:"#7F1D1D"};
}

function Gauge({score}:{score:number}){
  const{label,color}=scoreLabel(score);
  const dash=(score/100)*251.2;
  return(
    <div style={{textAlign:"center"}}>
      <svg width="200" height="130" viewBox="0 0 200 130">
        <defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={color}/><stop offset="100%" stopColor={C.goldLight}/>
        </linearGradient></defs>
        <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke={C.border} strokeWidth="14" strokeLinecap="round"/>
        <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="url(#g)" strokeWidth="14" strokeDasharray={`${dash} 251.2`} strokeLinecap="round"/>
        <text x="100" y="90" textAnchor="middle" fill={C.white} fontSize="46" fontWeight="900" fontFamily="system-ui">{score}</text>
        <text x="100" y="110" textAnchor="middle" fill="#7A90AB" fontSize="13" fontFamily="system-ui">/ 100</text>
      </svg>
      <div style={{color,fontWeight:800,fontSize:20,marginTop:4}}>{label}</div>
    </div>
  );
}

const F="system-ui,-apple-system,'Segoe UI',Tahoma,sans-serif";

const SERVICES=[
  {icon:"📊",title:"Murdi Score الشهري",desc:"درجة مالية من 100 تقيس صحة شركتك بدقة رياضية كل شهر"},
  {icon:"⚠️",title:"Top Risks",desc:"أهم المخاطر التي تهدد شركتك مرتبة حسب الأولوية والخطورة"},
  {icon:"⚡",title:"Action Engine",desc:"إجراءات واضحة وقابلة للتنفيذ لكل خطر — لا تشخيص بدون علاج"},
  {icon:"📈",title:"Impact Engine",desc:"اعرف بالأرقام ماذا سيحدث لدرجتك إذا نفّذت كل إجراء"},
  {icon:"🎯",title:"Opportunity Engine",desc:"الفرص المالية المتاحة لشركتك بناءً على وضعها الفعلي"},
  {icon:"📉",title:"Trend Engine",desc:"بعد 3 أشهر — اقرأ اتجاه شركتك: هل تتحسن أم تتراجع؟"},
  {icon:"🧠",title:"Company Memory™️",desc:"تاريخ شركتك الكامل محفوظ — كل تقرير وقرار موثق"},
  {icon:"🏆",title:"شهادة Murdi Score",desc:"وثيقة رسمية موقعة تثبت جاهزيتك للبنوك والشركاء"},
];

export default function Home(){
  const[step,setStep]=useState<"landing"|"input"|"report">("landing");
  const[company,setCompany]=useState("");
  const[form,setForm]=useState({balance:"",revenue:"",expenses:"",debts:"",receivables:""});
  const[result,setResult]=useState<Result|null>(null);

  const fields=[
    {key:"balance",label:"الرصيد البنكي الحالي",ph:"مثال: 450,000"},
    {key:"revenue",label:"متوسط الإيرادات الشهرية المحصّلة",ph:"مثال: 1,000,000"},
    {key:"expenses",label:"متوسط المصروفات الشهرية",ph:"مثال: 600,000"},
    {key:"debts",label:"إجمالي الديون والقروض",ph:"مثال: 1,200,000"},
    {key:"receivables",label:"إجمالي الذمم المدينة",ph:"مثال: 2,000,000"},
  ];

  const filled=company.trim()!==""&&fields.every(f=>(form as Record<string,string>)[f.key].trim()!=="");
  const run=()=>{
    const f=form as Record<string,string>;
    setResult(calc(parse(f.balance),parse(f.revenue),parse(f.expenses),parse(f.debts),parse(f.receivables)));
    setStep("report"); window.scrollTo(0,0);
  };
  const reset=()=>{
    window.location.href="/auth/signup"; setCompany("");
    setForm({balance:"",revenue:"",expenses:"",debts:"",receivables:""}); setResult(null); window.scrollTo(0,0);
  };

  return(
    <div dir="rtl" style={{minHeight:"100vh",background:C.bg,fontFamily:F,color:C.ink}}>

      {/* HEADER */}
      <header style={{background:C.navy,padding:"16px 32px",display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,zIndex:100,boxShadow:"0 2px 20px rgba(11,29,58,0.5)"}}>
        <div onClick={()=>window.location.href="/auth/signup"} style={{cursor:"pointer",display:"flex",alignItems:"center",gap:14}}>
          <div style={{width:42,height:42,borderRadius:10,background:`linear-gradient(135deg,${C.gold},${C.goldLight})`,display:"flex",alignItems:"center",justifyContent:"center",color:C.navy,fontWeight:900,fontSize:20}}>M</div>
          <div>
            <div style={{fontWeight:900,fontSize:24,color:C.white,letterSpacing:1}}>Murdi™️</div>
            <div style={{fontSize:11,color:C.gold,letterSpacing:1}}>CONSTRUCTION INTELLIGENCE</div>
          </div>
        </div>
        <div style={{display:"flex",gap:12,alignItems:"center"}}>
          {step!=="landing"&&<button onClick={()=>window.location.href="/auth/signup"} style={{background:"transparent",border:`1px solid ${C.gold}60`,borderRadius:8,color:C.gold,fontSize:13,cursor:"pointer",fontFamily:F,padding:"6px 16px"}}>الرئيسية</button>}
          <a href={WA} target="_blank" style={{background:`linear-gradient(135deg,${C.gold},${C.goldLight})`,color:C.navy,borderRadius:8,padding:"8px 16px",fontSize:13,fontWeight:800,textDecoration:"none"}}>تواصل معنا</a>
        </div>
      </header>

      {/* LANDING */}
      {step==="landing"&&(
        <div>
          {/* HERO */}
          <section style={{background:`linear-gradient(160deg,${C.navy} 0%,${C.navyMid} 60%,#1A3A6B 100%)`,padding:"100px 24px 80px",textAlign:"center",position:"relative",overflow:"hidden"}}>
            <div style={{position:"absolute",top:-100,left:"50%",transform:"translateX(-50%)",width:700,height:700,borderRadius:"50%",background:`radial-gradient(circle,${C.gold}15 0%,transparent 70%)`,pointerEvents:"none"}}/>
            <div style={{display:"inline-block",background:`${C.gold}22`,color:C.gold,padding:"8px 22px",borderRadius:20,fontSize:13,fontWeight:700,marginBottom:32,border:`1px solid ${C.gold}40`,letterSpacing:1}}>
              نظام تشغيل ذكاء المقاولات — المملكة العربية السعودية
            </div>
            <h1 style={{fontSize:52,fontWeight:900,lineHeight:1.25,margin:"0 0 24px",color:C.white}}>
              اعرف صحة شركتك المالية<br/>
              <span style={{color:C.gold}}>قبل أن تتحول لأزمة</span>
            </h1>
            <p style={{fontSize:19,color:"#A8BAD4",lineHeight:1.8,maxWidth:620,margin:"0 auto 44px"}}>
              Murdi يراقب وضع شركتك، ينذرك مبكراً بالمخاطر، ويخبرك بالضبط ماذا تفعل غداً — في 15 دقيقة شهرياً فقط.
            </p>
            <button onClick={()=>window.location.href="/auth/signup"} style={{background:`linear-gradient(135deg,${C.gold},${C.goldLight})`,color:C.navy,border:"none",borderRadius:12,padding:"18px 48px",fontSize:19,fontWeight:800,cursor:"pointer",fontFamily:F,boxShadow:`0 12px 35px ${C.gold}60`}}>
              احصل على تقريرك المجاني الآن
            </button>
            <div style={{marginTop:18,fontSize:14,color:"#7A90AB"}}>بدون التزام — 5 أرقام فقط — نتيجة فورية</div>
            <div style={{display:"flex",justifyContent:"center",gap:48,marginTop:60,flexWrap:"wrap"}}>
              {[{n:"14",l:"فئة مخاطر"},{n:"15",l:"دقيقة شهرياً"},{n:"100",l:"درجة تقييم"},{n:"8",l:"محركات ذكية"}].map((x,i)=>(
                <div key={i} style={{textAlign:"center"}}>
                  <div style={{fontSize:40,fontWeight:900,color:C.gold}}>{x.n}</div>
                  <div style={{fontSize:13,color:"#7A90AB",marginTop:4}}>{x.l}</div>
                </div>
              ))}
            </div>
          </section>

          {/* خدمات Murdi */}
          <section style={{padding:"72px 24px",background:C.white}}>
            <div style={{maxWidth:960,margin:"0 auto"}}>
              <div style={{textAlign:"center",marginBottom:52}}>
                <h2 style={{fontSize:36,fontWeight:900,margin:"0 0 14px"}}>ماذا تحصل بعد الاشتراك؟</h2>
                <p style={{fontSize:18,color:C.slate,maxWidth:560,margin:"0 auto"}}>8 محركات ذكية تعمل لصالح شركتك كل شهر</p>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:20}}>
                {SERVICES.map((s,i)=>(
                  <div key={i} style={{background:C.cream,borderRadius:14,padding:24,border:`1px solid ${C.border}`,borderTop:`3px solid ${C.gold}`}}>
                    <div style={{fontSize:32,marginBottom:12}}>{s.icon}</div>
                    <div style={{fontWeight:800,fontSize:16,marginBottom:8,color:C.navy}}>{s.title}</div>
                    <div style={{fontSize:14,color:C.slate,lineHeight:1.7}}>{s.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* لماذا Murdi */}
          <section style={{padding:"72px 24px",background:C.bg}}>
            <div style={{maxWidth:960,margin:"0 auto"}}>
              <h2 style={{fontSize:36,fontWeight:900,textAlign:"center",margin:"0 0 52px"}}>لماذا تتعثر شركات المقاولات؟</h2>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:20}}>
                {[
                  {t:"غياب الإنذار المبكر",d:"تكتشف المشكلة بعد أن تصبح أزمة — لا قبلها بأشهر"},
                  {t:"لا أحد يراقب التدفق",d:"90٪ من شركات المقاولات بلا مدير مالي متخصص"},
                  {t:"أرقام بلا قرارات",d:"حتى لو وُجد محاسب، لا يحوّل الأرقام لخطوات واضحة"},
                ].map((x,i)=>(
                  <div key={i} style={{background:C.white,borderRadius:14,padding:28,border:`1px solid ${C.border}`}}>
                    <div style={{fontWeight:800,fontSize:18,marginBottom:10,color:C.navy}}>{x.t}</div>
                    <div style={{fontSize:15,color:C.slate,lineHeight:1.7}}>{x.d}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* الباقات */}
          <section style={{padding:"72px 24px",background:C.white}}>
            <div style={{maxWidth:860,margin:"0 auto"}}>
              <h2 style={{fontSize:36,fontWeight:900,textAlign:"center",margin:"0 0 14px"}}>برنامج Murdi Founding Members™️</h2>
              <p style={{fontSize:17,color:C.slate,textAlign:"center",margin:"0 0 48px"}}>أول 20 شركة فقط — امتياز لا خصم</p>
              <div style={{background:`linear-gradient(135deg,${C.navy},${C.navyMid})`,borderRadius:20,padding:"48px 40px",textAlign:"center",border:`2px solid ${C.gold}40`}}>
                <div style={{display:"inline-block",background:`${C.gold}20`,color:C.gold,padding:"6px 20px",borderRadius:16,fontSize:13,fontWeight:700,marginBottom:24,border:`1px solid ${C.gold}40`}}>مقاعد محدودة — 20 شركة فقط</div>
                <div style={{fontSize:16,color:"#A8BAD4",marginBottom:8}}>السعر الحصري للمؤسسين</div>
                <div style={{fontSize:56,fontWeight:900,color:C.gold,marginBottom:4}}>1,990</div>
                <div style={{fontSize:18,color:"#A8BAD4",marginBottom:32}}>ريال / شهر — مجمّد مدى الحياة</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,maxWidth:480,margin:"0 auto 36px",textAlign:"right"}}>
                  {["جميع المحركات الذكية الثمانية","سعر مجمّد مدى الحياة","اسمك في صفحة مؤسسي Murdi","وصول مباشر لد. عبدالحكيم","تأثير على تطوير المنهجية","أول تقرير مجاناً بدون التزام"].map((x,i)=>(
                    <div key={i} style={{display:"flex",alignItems:"center",gap:8,color:C.white,fontSize:14}}>
                      <span style={{color:C.gold,fontSize:16}}>✦</span>{x}
                    </div>
                  ))}
                </div>
                <a href={WA} target="_blank" style={{display:"inline-block",background:`linear-gradient(135deg,${C.gold},${C.goldLight})`,color:C.navy,borderRadius:12,padding:"16px 48px",fontSize:18,fontWeight:900,textDecoration:"none",boxShadow:`0 8px 28px ${C.gold}50`}}>
                  انضم الآن عبر WhatsApp
                </a>
                <div style={{marginTop:16,fontSize:13,color:"#7A90AB"}}>الاشتراك السنوي يمنح شهرين مجاناً</div>
              </div>
            </div>
          </section>

          {/* CTA نهائي */}
          <section style={{background:`linear-gradient(135deg,${C.navy},${C.navyMid})`,padding:"72px 24px",textAlign:"center"}}>
            <h2 style={{fontSize:38,fontWeight:900,color:C.white,margin:"0 0 16px"}}>جرّب Murdi الآن — مجاناً</h2>
            <p style={{fontSize:18,color:"#A8BAD4",margin:"0 0 36px"}}>تقريرك الأول جاهز خلال ثوانٍ — بدون أي التزام</p>
            <button onClick={()=>window.location.href="/auth/signup"} style={{background:`linear-gradient(135deg,${C.gold},${C.goldLight})`,color:C.navy,border:"none",borderRadius:12,padding:"18px 48px",fontSize:19,fontWeight:800,cursor:"pointer",fontFamily:F,boxShadow:`0 8px 28px ${C.gold}50`}}>
              ابدأ التقييم المجاني
            </button>
          </section>

          <footer style={{padding:"28px 24px",textAlign:"center",color:C.muted,fontSize:13,background:C.navy}}>
            <span style={{color:C.gold,fontWeight:700}}>Murdi™️</span> — Construction Intelligence Operating System | د. عبدالحكيم المرضي ©️ 2026
            <br/><span style={{marginTop:6,display:"inline-block"}}>📞 <a href={WA} style={{color:C.gold,textDecoration:"none"}}>0570749196</a></span>
          </footer>
        </div>
      )}

      {/* INPUT */}
      {step==="input"&&(
        <div style={{maxWidth:580,margin:"0 auto",padding:"44px 20px"}}>
          <div style={{textAlign:"center",marginBottom:36}}>
            <div style={{display:"inline-block",background:`${C.gold}18`,color:C.gold,padding:"6px 18px",borderRadius:16,fontSize:13,fontWeight:700,marginBottom:16}}>تقرير Murdi المجاني</div>
            <h1 style={{fontSize:30,fontWeight:900,margin:"0 0 10px"}}>احصل على تقريرك الآن</h1>
            <p style={{fontSize:16,color:C.slate}}>5 أرقام فقط — تحليل مالي كامل فوراً</p>
          </div>
          <div style={{background:C.white,borderRadius:16,padding:28,border:`1px solid ${C.border}`,marginBottom:16}}>
            <label style={{fontSize:14,fontWeight:700,color:C.slate,display:"block",marginBottom:10}}>اسم الشركة</label>
            <input value={company} onChange={e=>setCompany(e.target.value)} placeholder="مثال: شركة النور للمقاولات"
              style={{width:"100%",boxSizing:"border-box",padding:"14px 16px",borderRadius:10,border:`1.5px solid ${C.border}`,fontSize:16,fontFamily:F,outline:"none",background:C.bg}}/>
          </div>
          <div style={{background:C.white,borderRadius:16,padding:28,border:`1px solid ${C.border}`,marginBottom:20}}>
            <div style={{fontSize:15,fontWeight:800,color:C.navy,marginBottom:22,paddingBottom:14,borderBottom:`1px solid ${C.border}`}}>البيانات المالية — بالريال السعودي</div>
            {fields.map((f,i)=>(
              <div key={f.key} style={{marginBottom:i<fields.length-1?20:0}}>
                <label style={{fontSize:14,fontWeight:600,color:C.slate,display:"block",marginBottom:8}}>{f.label}</label>
                <input value={(form as Record<string,string>)[f.key]} onChange={e=>setForm({...form,[f.key]:e.target.value})} placeholder={f.ph}
                  style={{width:"100%",boxSizing:"border-box",padding:"14px 16px",borderRadius:10,border:`1.5px solid ${C.border}`,fontSize:16,fontFamily:F,outline:"none",background:C.bg}}/>
              </div>
            ))}
          </div>
          <div style={{textAlign:"center",fontSize:13,color:C.muted,marginBottom:20}}>🔒 بياناتك سرية — لا تُشارك مع أي طرف</div>
          <button onClick={()=>window.location.href="/auth/signup"} disabled={!filled} style={{width:"100%",background:filled?`linear-gradient(135deg,${C.gold},${C.goldLight})`:C.border,color:filled?C.navy:C.muted,border:"none",borderRadius:12,padding:18,fontSize:18,fontWeight:800,cursor:filled?"pointer":"not-allowed",fontFamily:F,boxShadow:filled?`0 8px 24px ${C.gold}40`:"none"}}>
            احسب Murdi Score الآن
          </button>
        </div>
      )}

      {/* REPORT */}
      {step==="report"&&result&&(
        <div style={{maxWidth:640,margin:"0 auto",padding:"32px 20px"}}>

          <div style={{background:C.navy,borderRadius:20,padding:32,textAlign:"center",marginBottom:16,boxShadow:"0 8px 32px rgba(11,29,58,0.3)"}}>
            <div style={{fontSize:13,color:"#7A90AB",marginBottom:4}}>Murdi Financial Report</div>
            <div style={{fontSize:24,fontWeight:900,color:C.white,marginBottom:24}}>{company}</div>
            <Gauge score={result.score}/>
            <div style={{marginTop:20,display:"inline-block",background:`${C.gold}22`,color:C.gold,borderRadius:8,padding:"8px 20px",fontSize:13,fontWeight:700,border:`1px solid ${C.gold}40`}}>
              Analysis Depth: 55٪ — أضف بيانات المشاريع لرفعه إلى 75٪
            </div>
          </div>

          {/* المؤشرات — أرقام فقط بدون شرح */}
          <div style={{background:C.white,borderRadius:16,padding:24,border:`1px solid ${C.border}`,marginBottom:16}}>
            <div style={{fontSize:15,fontWeight:800,color:C.navy,marginBottom:18,paddingBottom:12,borderBottom:`1px solid ${C.border}`}}>المؤشرات الرئيسية</div>
            {[
              {l:"تغطية السيولة",v:`${Math.round(result.coverageDays)} يوماً`,ok:result.coverageDays>=90,warn:result.coverageDays>=30},
              {l:"التدفق النقدي الشهري",v:`${result.cashFlow>=0?"+":""}${num(result.cashFlow)} ريال`,ok:result.cashFlow>=0,warn:result.cashFlow>=0},
              {l:"دورة التحصيل",v:`${Math.round(result.collectionDays)} يوماً`,ok:result.collectionDays<60,warn:result.collectionDays<90},
              {l:"نسبة المديونية",v:`${(result.debtRatio*100).toFixed(1)}٪`,ok:result.debtRatio<0.5,warn:result.debtRatio<1},
            ].map((m,i)=>{
              const col=m.ok?C.green:m.warn?C.yellow:C.red;
              const txt=m.ok?"جيد":m.warn?"تنبيه":"خطر";
              return(
                <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"13px 0",borderBottom:i<3?`1px solid ${C.border}`:"none"}}>
                  <span style={{fontSize:15,color:C.slate}}>{m.l}</span>
                  <span style={{display:"flex",alignItems:"center",gap:10}}>
                    <span style={{fontWeight:700,fontSize:15,color:C.navy}}>{m.v}</span>
                    <span style={{background:`${col}18`,color:col,borderRadius:6,padding:"3px 12px",fontSize:12,fontWeight:700,border:`1px solid ${col}30`}}>{txt}</span>
                  </span>
                </div>
              );
            })}
          </div>

          {/* المخاطر */}
          {result.risks.length>0&&(
            <div style={{background:C.white,borderRadius:16,padding:24,border:`1px solid ${C.border}`,marginBottom:16}}>
              <div style={{fontSize:15,fontWeight:800,color:C.red,marginBottom:18,paddingBottom:12,borderBottom:`1px solid ${C.border}`}}>Top Risks — المخاطر والإجراءات</div>
              {result.risks.map((r,i)=>(
                <div key={i} style={{background:r.bg,border:`1.5px solid ${r.color}30`,borderRadius:14,padding:20,marginBottom:14}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                    <span style={{fontWeight:800,fontSize:16,color:C.navy,flex:1}}>{r.title}</span>
                    <span style={{background:`${r.color}20`,color:r.color,borderRadius:6,padding:"3px 12px",fontSize:12,fontWeight:800,border:`1px solid ${r.color}40`}}>{r.level}</span>
                  </div>
                  <div style={{fontSize:14,color:C.slate,marginBottom:14,lineHeight:1.7}}>{r.detail}</div>
                  <div style={{background:C.white,borderRadius:10,padding:"12px 16px",marginBottom:12,border:`1px solid ${C.border}`}}>
                    <div style={{fontSize:11,color:C.gold,fontWeight:800,marginBottom:5}}>ACTION ENGINE — الإجراء المطلوب</div>
                    <div style={{fontSize:14,lineHeight:1.6,color:C.navy}}>{r.action}</div>
                  </div>
                  <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                    <div style={{flex:1,minWidth:170,background:`${C.navy}08`,borderRadius:10,padding:"10px 14px",border:`1px solid ${C.border}`}}>
                      <div style={{fontSize:11,color:C.navy,fontWeight:800,marginBottom:4}}>IMPACT ENGINE</div>
                      <div style={{fontSize:13,lineHeight:1.5,color:C.slate}}>{r.impact}</div>
                    </div>
                    <div style={{background:`linear-gradient(135deg,${C.gold}18,${C.goldPale})`,borderRadius:10,padding:"10px 16px",textAlign:"center",display:"flex",flexDirection:"column",justifyContent:"center",border:`1px solid ${C.gold}40`,minWidth:90}}>
                      <div style={{fontSize:11,color:C.yellow,fontWeight:800,marginBottom:4}}>على الدرجة</div>
                      <div style={{fontSize:18,fontWeight:900,color:C.gold}}>{r.scoreLift}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* نقاط القوة */}
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

          {/* الفرص */}
          {result.opportunities.length>0&&(
            <div style={{background:C.white,borderRadius:16,padding:24,border:`1px solid ${C.border}`,marginBottom:16}}>
              <div style={{fontSize:15,fontWeight:800,color:C.navy,marginBottom:18,paddingBottom:12,borderBottom:`1px solid ${C.border}`}}>Opportunity Engine — الفرص المتاحة</div>
              {result.opportunities.map((o,i)=>(
                <div key={i} style={{borderRight:`3px solid ${C.gold}`,background:C.goldPale,borderRadius:"0 10px 10px 0",padding:"12px 16px",marginBottom:10}}>
                  <div style={{fontWeight:700,fontSize:15,marginBottom:4,color:C.navy}}>{o.title}</div>
                  <div style={{fontSize:13,color:C.slate,lineHeight:1.6}}>{o.detail}</div>
                </div>
              ))}
            </div>
          )}

          {/* CTA */}
          <div style={{background:`linear-gradient(135deg,${C.navy},${C.navyMid})`,borderRadius:16,padding:32,textAlign:"center",marginBottom:16}}>
            <div style={{fontSize:21,fontWeight:900,color:C.white,marginBottom:8}}>هل هذا التقرير مفيد لك؟</div>
            <div style={{fontSize:14,color:"#A8BAD4",marginBottom:24}}>انضم لبرنامج Murdi Founding Members™️ — 20 مقعداً فقط</div>
            <a href={WA} target="_blank" style={{display:"inline-block",background:`linear-gradient(135deg,${C.gold},${C.goldLight})`,color:C.navy,borderRadius:10,padding:"14px 32px",fontSize:16,fontWeight:800,textDecoration:"none"}}>
              انضم الآن — 1,990 ريال/شهر
            </a>
          </div>

          <button onClick={()=>window.location.href="/auth/signup"} style={{width:"100%",background:"transparent",color:C.slate,border:`1px solid ${C.border}`,borderRadius:12,padding:14,fontSize:15,fontWeight:600,cursor:"pointer",fontFamily:F,marginBottom:8}}>
            تقرير جديد
          </button>

          <div style={{textAlign:"center",fontSize:12,color:C.muted,padding:"16px 0"}}>
            <span style={{color:C.gold,fontWeight:700}}>Murdi™️</span> — Construction Intelligence Operating System | د. عبدالحكيم المرضي ©️ 2026
          </div>
        </div>
      )}
    </div>
  );
}