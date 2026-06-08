'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

const C = { navy:'#0B1C3D', navyLight:'#112244', gold:'#F5C842', white:'#fff', gray:'#8899BB' }

export default function ReportPage() {
  const router = useRouter()
  const [report, setReport] = useState<any>(null)
  const [company, setCompany] = useState('')

  useEffect(() => {
    const r = sessionStorage.getItem('murdi_report')
    const c = sessionStorage.getItem('murdi_company')
    if (!r) { router.push('/dashboard'); return }
    setReport(JSON.parse(r))
    setCompany(c||'')
  }, [])

  const handlePrint = () => window.print()

  if (!report) return <div style={{background:C.navy,minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center'}}><div style={{color:C.gold}}>...</div></div>

  const scoreColor = (s: number) => s >= 70 ? '#22c55e' : s >= 40 ? C.gold : '#ef4444'

  return (
    <div style={{minHeight:'100vh',background:C.navy,fontFamily:'system-ui',direction:'rtl',padding:'40px 24px'}}>
      <style>{`@media print { .no-print { display: none !important; } body { background: #0B1C3D; } }`}</style>

      <div className="no-print" style={{marginBottom:24,display:'flex',gap:12}}>
        <button onClick={()=>router.push('/dashboard')} style={{padding:'10px 20px',borderRadius:8,border:`1px solid ${C.gray}`,background:'transparent',color:C.gray,cursor:'pointer'}}>← رجوع</button>
        <button onClick={handlePrint} style={{padding:'10px 24px',borderRadius:8,border:'none',background:C.gold,color:C.navy,fontWeight:700,cursor:'pointer',fontSize:15}}>📄 طباعة / تحميل PDF</button>
      </div>

      <div style={{maxWidth:800,margin:'0 auto'}}>
        {/* Header */}
        <div style={{textAlign:'center',marginBottom:32,borderBottom:`1px solid #1E3A6E`,paddingBottom:24}}>
          <div style={{fontSize:32,fontWeight:900,color:C.gold,letterSpacing:3}}>MURDI</div>
          <div style={{fontSize:12,color:C.gray,letterSpacing:2,marginBottom:16}}>مستشارك المالي الذكي</div>
          <div style={{fontSize:20,color:C.white,fontWeight:700}}>{company}</div>
          <div style={{fontSize:14,color:C.gray,marginTop:4}}>التقرير المالي الذكي — {new Date().toLocaleDateString('ar-SA', {year:'numeric',month:'long'})}</div>
        </div>

        {/* Score */}
        <div style={{textAlign:'center',marginBottom:32,background:C.navyLight,borderRadius:16,padding:'32px',border:`2px solid ${scoreColor(report.score)}40`}}>
          <div style={{color:C.gray,fontSize:14,marginBottom:8}}>Murdi Score</div>
          <div style={{fontSize:96,fontWeight:900,color:scoreColor(report.score),lineHeight:1}}>{report.score}</div>
          <div style={{color:C.gray,fontSize:13,marginBottom:12}}>من 85 نقطة</div>
          <div style={{color:C.white,fontSize:16,fontWeight:700}}>{report.scoreLabel}</div>
          <div style={{marginTop:12,color:C.gray,fontSize:13}}>{report.vsMarket}</div>
        </div>

        {/* Forecast */}
        <div style={{background:C.navyLight,borderRadius:12,padding:'20px',marginBottom:16,border:`1px solid ${C.gold}40`}}>
          <div style={{color:C.gold,fontWeight:700,marginBottom:8}}>🔮 التوقع بعد 3 أشهر</div>
          <div style={{color:C.white,fontSize:14,lineHeight:1.7}}>{report.forecast3m}</div>
        </div>

        {/* Sections */}
        {report.risks.length > 0 && (
          <div style={{background:C.navyLight,borderRadius:12,padding:'20px',marginBottom:16,border:'1px solid #ef444440'}}>
            <div style={{color:'#ef4444',fontWeight:700,marginBottom:12}}>⚠️ Top Risks</div>
            {report.risks.map((r:string,i:number) => <div key={i} style={{color:C.white,fontSize:13,lineHeight:1.7,marginBottom:8,paddingBottom:8,borderBottom:i<report.risks.length-1?'1px solid #1E3A6E':'none'}}>{r}</div>)}
          </div>
        )}

        <div style={{background:C.navyLight,borderRadius:12,padding:'20px',marginBottom:16,border:'1px solid #3b82f640'}}>
          <div style={{color:'#3b82f6',fontWeight:700,marginBottom:12}}>⚡ Action Engine</div>
          {report.actions.map((a:string,i:number) => <div key={i} style={{color:C.white,fontSize:13,lineHeight:1.7,marginBottom:8,paddingBottom:8,borderBottom:i<report.actions.length-1?'1px solid #1E3A6E':'none'}}>{a}</div>)}
        </div>

        {report.impacts.length > 0 && (
          <div style={{background:C.navyLight,borderRadius:12,padding:'20px',marginBottom:16,border:'1px solid #a855f740'}}>
            <div style={{color:'#a855f7',fontWeight:700,marginBottom:12}}>🎯 Impact Engine</div>
            {report.impacts.map((imp:string,i:number) => <div key={i} style={{color:C.white,fontSize:13,lineHeight:1.7,marginBottom:8,paddingBottom:8,borderBottom:i<report.impacts.length-1?'1px solid #1E3A6E':'none'}}>{imp}</div>)}
          </div>
        )}

        {report.strengths.length > 0 && (
          <div style={{background:C.navyLight,borderRadius:12,padding:'20px',marginBottom:16,border:'1px solid #22c55e40'}}>
            <div style={{color:'#22c55e',fontWeight:700,marginBottom:12}}>💪 نقاط القوة</div>
            {report.strengths.map((s:string,i:number) => <div key={i} style={{color:C.white,fontSize:13,lineHeight:1.7,marginBottom:8,paddingBottom:8,borderBottom:i<report.strengths.length-1?'1px solid #1E3A6E':'none'}}>{s}</div>)}
          </div>
        )}

        <div style={{background:C.navyLight,borderRadius:12,padding:'20px',marginBottom:32,border:`1px solid ${C.gold}40`}}>
          <div style={{color:C.gold,fontWeight:700,marginBottom:12}}>🚀 Opportunity Engine</div>
          {report.opportunities.map((o:string,i:number) => <div key={i} style={{color:C.white,fontSize:13,lineHeight:1.7,marginBottom:8,paddingBottom:8,borderBottom:i<report.opportunities.length-1?'1px solid #1E3A6E':'none'}}>{o}</div>)}
        </div>

        {/* WhatsApp Share */}
        <div style={{textAlign:'center', marginBottom:24}}>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(
              'السلام عليكم،\n' +
              'أشارككم تقرير Murdi الذكي لشركة ' + company + '\n\n' +
              'Murdi Score: ' + report.score + '/85 — ' + (report.score >= 75 ? 'ممتاز' : report.score >= 60 ? 'جيد جداً' : report.score >= 45 ? 'جيد' : 'يحتاج تحسين') + '\n' +
              'التوقع بعد 3 أشهر: ' + (report.score >= 60 ? 'مستقر' : 'يحتاج تدخل') + '\n\n' +
              'منصة Murdi للذكاء المالي: murdi.vercel.app'
            )}`}
            target="_blank"
            rel="noreferrer"
            style={{
              display:'inline-block',
              background:'#25D366',
              color:'white',
              padding:'14px 36px',
              borderRadius:40,
              fontFamily:'Cairo,sans-serif',
              fontSize:15,
              fontWeight:700,
              textDecoration:'none',
              boxShadow:'0 4px 20px rgba(37,211,102,0.3)'
            }}
          >
            📤 شارك التقرير على واتساب
          </a>
        </div>

        {/* Footer */}
        <div style={{textAlign:'center',color:C.gray,fontSize:12,borderTop:'1px solid #1E3A6E',paddingTop:16}}>
          <div style={{color:C.gold,fontWeight:700,marginBottom:4}}>MURDI — مستشارك المالي الذكي</div>
          <div>murdi.vercel.app | تقرير سري ومخصص لـ {company}</div>
        </div>
      </div>
    </div>
  )
}
