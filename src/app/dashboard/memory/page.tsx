'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

interface MonthlyData {
 id: string
 month: number
 year: number
 murdi_score: number
 revenue: number
 expenses: number
 bank_balance: number
 debts: number
 receivables: number
 employees: number
}

const MONTH_NAMES = [
 'يناير','فبراير','مارس','أبريل','مايو','يونيو',
 'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'
]

const fmt = (n: number) => n?.toLocaleString('ar-SA') || '0'

export default function MemoryPage() {
 const supabase = createClient()
 const router = useRouter()
 const [loading, setLoading] = useState(true)
 const [analyzing, setAnalyzing] = useState(false)
 const [companyName, setCompanyName] = useState('')
 const [months, setMonths] = useState<MonthlyData[]>([])
 const [aiMemory, setAiMemory] = useState('')

 useEffect(() => { load() }, [])

 async function load() {
   setLoading(true)
   const { data: { user } } = await supabase.auth.getUser()
   if (!user) { router.push('/auth/login'); return }

   const { data: p } = await supabase.from('profiles').select('company_name').eq('id', user.id).single()
   if (p) setCompanyName(p.company_name || '')

   const { data: m } = await supabase
     .from('monthly_data')
     .select('*')
     .eq('user_id', user.id)
     .order('year', { ascending: true })
     .order('month', { ascending: true })

   if (m) setMonths(m)
   setLoading(false)
 }

 async function getMemoryAnalysis() {
   if (aiMemory) return
   setAnalyzing(true)

   const summary = months.map(m => 
     `${MONTH_NAMES[m.month-1]} ${m.year}: إيرادات ${fmt(m.revenue)} | مصروفات ${fmt(m.expenses)} | رصيد ${fmt(m.bank_balance)} | ديون ${fmt(m.debts)} | Score ${m.murdi_score}`
   ).join('\n')

   const first = months[0]
   const last = months[months.length - 1]
   const scoreChange = last?.murdi_score - first?.murdi_score

   try {
     const res = await fetch('/api/memory', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ companyName, summary, monthsCount: months.length, scoreChange, firstScore: first?.murdi_score, lastScore: last?.murdi_score })
     })
     const data = await res.json()
     setAiMemory(data.analysis || '')
   } catch {
     setAiMemory('تعذر التحليل. يرجى المحاولة مرة أخرى.')
   }
   setAnalyzing(false)
 }

 if (loading) return (
   <div style={{ minHeight:'100vh', background:'#0B1C3D', display:'flex', alignItems:'center', justifyContent:'center' }}>
     <div style={{ color:'#F5C842', fontFamily:'Cairo,sans-serif', fontSize:18 }}>جاري تحميل الذاكرة...</div>
   </div>
 )

 return (
   <>
     <style>{`
       @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&family=Amiri:wght@400;700&display=swap');
       * { box-sizing:border-box; margin:0; padding:0; }
       body { background:#0B1C3D; }
       .pw { min-height:100vh; background:#0B1C3D; padding:32px 24px; font-family:'Cairo',sans-serif; direction:rtl; max-width:900px; margin:0 auto; }
       .hd { display:flex; align-items:center; justify-content:space-between; margin-bottom:32px; flex-wrap:wrap; gap:12px; }
       .bb { background:transparent; color:#8899BB; border:1px solid rgba(136,153,187,0.3); padding:10px 24px; border-radius:40px; font-family:'Cairo',sans-serif; font-size:14px; cursor:pointer; }
       .ttl { font-family:'Amiri',serif; font-size:28px; color:#F5C842; text-align:center; }
       .stats { display:grid; grid-template-columns:repeat(3,1fr); gap:16px; margin-bottom:28px; }
       .stat { background:rgba(255,255,255,0.04); border:1px solid rgba(245,200,66,0.2); border-radius:8px; padding:20px; text-align:center; }
       .stat-val { font-family:'Amiri',serif; font-size:36px; color:#F5C842; }
       .stat-label { font-size:12px; color:#7A90AB; margin-top:4px; }
       .timeline { margin-bottom:28px; }
       .tl-title { font-family:'Amiri',serif; font-size:18px; color:#F5C842; margin-bottom:16px; padding-bottom:8px; border-bottom:1px solid rgba(245,200,66,0.2); }
       .month-card { background:rgba(255,255,255,0.03); border:1px solid rgba(245,200,66,0.1); border-radius:8px; padding:16px; margin-bottom:10px; display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; }
       .month-header { grid-column:1/-1; display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; }
       .month-name { font-size:15px; font-weight:700; color:#F5C842; }
       .score-badge { padding:4px 14px; border-radius:20px; font-size:13px; font-weight:700; }
       .metric { }
       .metric-label { font-size:11px; color:#5a7a99; margin-bottom:2px; }
       .metric-val { font-size:13px; color:#c0d8f0; font-weight:600; }
       .score-bar { grid-column:1/-1; height:4px; background:rgba(255,255,255,0.06); border-radius:2px; overflow:hidden; margin-top:4px; }
       .score-fill { height:100%; border-radius:2px; background:linear-gradient(90deg,#F5C842,#4ade80); }
       .ai-section { background:rgba(10,20,40,0.8); border:1px solid rgba(245,200,66,0.3); border-radius:12px; padding:28px; margin-bottom:24px; }
       .ai-title { font-family:'Amiri',serif; font-size:20px; color:#F5C842; margin-bottom:16px; }
       .ai-btn { background:linear-gradient(135deg,#B8963E,#F5C842); color:#0B1C3D; border:none; padding:14px 32px; border-radius:40px; font-family:'Cairo',sans-serif; font-size:15px; font-weight:700; cursor:pointer; width:100%; margin-bottom:16px; }
       .ai-btn:disabled { opacity:0.6; cursor:not-allowed; }
       .ai-text { color:#c0d8f0; font-size:15px; line-height:2; background:rgba(245,200,66,0.05); border-right:3px solid #F5C842; padding:16px 20px; border-radius:4px; }
       .empty { text-align:center; padding:60px; color:#5a7a99; font-size:16px; }
       @media(max-width:600px){ .stats{grid-template-columns:1fr 1fr} .month-card{grid-template-columns:1fr 1fr} }
     `}</style>

     <div className="pw">
       <div className="hd">
         <button className="bb" onClick={() => router.push('/dashboard')}>← الداشبورد</button>
         <div className="ttl">🧠 ذاكرة {companyName}</div>
         <div style={{ width:100 }} />
       </div>

       {months.length === 0 ? (
         <div className="empty">لا توجد بيانات محفوظة بعد — أضف بيانات شهرية من الداشبورد</div>
       ) : (
         <>
           <div className="stats">
             <div className="stat">
               <div className="stat-val">{months.length}</div>
               <div className="stat-label">شهر محفوظ</div>
             </div>
             <div className="stat">
               <div className="stat-val">{months[months.length-1]?.murdi_score || 0}</div>
               <div className="stat-label">آخر Murdi Score</div>
             </div>
             <div className="stat">
               <div className="stat-val" style={{ color: (months[months.length-1]?.murdi_score - months[0]?.murdi_score) >= 0 ? '#4ade80' : '#f87171' }}>
                 {(months[months.length-1]?.murdi_score - months[0]?.murdi_score) >= 0 ? '+' : ''}
                 {months[months.length-1]?.murdi_score - months[0]?.murdi_score}
               </div>
               <div className="stat-label">التغير الكلي</div>
             </div>
           </div>

           <div className="ai-section">
             <div className="ai-title">🤖 تحليل Murdi للتاريخ الكامل</div>
             <button className="ai-btn" onClick={getMemoryAnalysis} disabled={analyzing}>
               {analyzing ? 'جاري التحليل...' : '⚡ حلّل تاريخ شركتي كاملاً'}
             </button>
             {aiMemory && <div className="ai-text">{aiMemory}</div>}
           </div>

           <div className="timeline">
             <div className="tl-title">السجل الشهري الكامل</div>
             {[...months].reverse().map(m => {
               const profit = m.revenue - m.expenses
               const scoreColor = m.murdi_score >= 60 ? '#4ade80' : m.murdi_score >= 40 ? '#F5C842' : '#f87171'
               return (
                 <div className="month-card" key={`${m.year}-${m.month}`}>
                   <div className="month-header">
                     <div className="month-name">{MONTH_NAMES[m.month-1]} {m.year}</div>
                     <div className="score-badge" style={{ background: `${scoreColor}22`, color: scoreColor, border: `1px solid ${scoreColor}44` }}>
                       {m.murdi_score} نقطة
                     </div>
                   </div>
                   <div className="metric">
                     <div className="metric-label">الإيرادات</div>
                     <div className="metric-val">{fmt(m.revenue)} ر.س</div>
                   </div>
                   <div className="metric">
                     <div className="metric-label">المصروفات</div>
                     <div className="metric-val">{fmt(m.expenses)} ر.س</div>
                   </div>
                   <div className="metric">
                     <div className="metric-label">صافي الربح</div>
                     <div className="metric-val" style={{ color: profit >= 0 ? '#4ade80' : '#f87171' }}>{fmt(Math.abs(profit))} {profit >= 0 ? '▲' : '▼'}</div>
                   </div>
                   <div className="metric">
                     <div className="metric-label">الرصيد البنكي</div>
                     <div className="metric-val">{fmt(m.bank_balance)} ر.س</div>
                   </div>
                   <div className="metric">
                     <div className="metric-label">الديون</div>
                     <div className="metric-val">{fmt(m.debts)} ر.س</div>
                   </div>
                   <div className="metric">
                     <div className="metric-label">الذمم المدينة</div>
                     <div className="metric-val">{fmt(m.receivables)} ر.س</div>
                   </div>
                   <div className="score-bar">
                     <div className="score-fill" style={{ width: `${(m.murdi_score/85)*100}%` }} />
                   </div>
                 </div>
               )
             })}
           </div>
         </>
       )}
     </div>
   </>
 )
}
