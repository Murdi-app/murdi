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

interface VelocityResult {
  label: string
  icon: string
  values: number[]
  status: 'accelerating' | 'recovering' | 'stable'
  message: string
  urgent: boolean
}

const MONTH_NAMES = [
  'يناير','فبراير','مارس','أبريل','مايو','يونيو',
  'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'
]

const fmt = (n: number) => (n||0).toLocaleString('ar-SA')

function safe(m: MonthlyData) {
  return {
    ...m,
    revenue: m.revenue || 0,
    expenses: m.expenses || 0,
    bank_balance: m.bank_balance || 0,
    debts: m.debts || 0,
    receivables: m.receivables || 0,
    murdi_score: m.murdi_score || 0,
    employees: m.employees || 0,
  }
}

function calcVelocity(months: MonthlyData[]): VelocityResult[] {
  if (!months || months.length < 2) return []
  const safeMonths = months.map(safe)
  const last3 = safeMonths.slice(-3)

  const metrics = [
    {
      label: 'السيولة', icon: '💧',
      getValue: (m: MonthlyData) => m.expenses > 0 ? Math.round(m.bank_balance / m.expenses * 30) : 0,
      higherIsBetter: true,
    },
    {
      label: 'الربحية', icon: '📈',
      getValue: (m: MonthlyData) => m.revenue > 0 ? Math.round((m.revenue - m.expenses) / m.revenue * 100) : 0,
      higherIsBetter: true,
    },
    {
      label: 'التحصيل', icon: '🔄',
      getValue: (m: MonthlyData) => m.revenue > 0 ? Math.round(m.receivables / m.revenue * 30) : 0,
      higherIsBetter: false,
    },
    {
      label: 'Murdi Score', icon: '⭐',
      getValue: (m: MonthlyData) => m.murdi_score,
      higherIsBetter: true,
    },
  ]

  return metrics.map(metric => {
    const values = last3.map(m => metric.getValue(m))
    const n = values.length
    let status: VelocityResult['status'] = 'stable'
    let message = ''
    let urgent = false

    if (n >= 2) {
      const allDecline = metric.higherIsBetter
        ? values.every((v, i) => i === 0 || v <= values[i - 1])
        : values.every((v, i) => i === 0 || v >= values[i - 1])
      const allImprove = metric.higherIsBetter
        ? values.every((v, i) => i === 0 || v >= values[i - 1])
        : values.every((v, i) => i === 0 || v <= values[i - 1])
      const first = values[0]
      const last = values[n - 1]
      const changePct = first !== 0 ? Math.abs((last - first) / first * 100) : 0

      if (allDecline && changePct > 20) {
        status = 'accelerating'
        urgent = changePct > 30
        message = urgent
          ? `⚡ تحذير فوري: تدهور سريع ${changePct.toFixed(0)}% — تدخل هذا الأسبوع`
          : `⚠️ تدهور مستمر ${changePct.toFixed(0)}% — راقب هذا المؤشر`
      } else if (allImprove && changePct > 10) {
        status = 'recovering'
        message = `✅ مسار التعافي — تحسن ${changePct.toFixed(0)}% مستمر`
      } else {
        status = 'stable'
        message = `🟡 مستقر — لا تغيير جوهري`
      }
    }

    return { label: metric.label, icon: metric.icon, values, status, message, urgent }
  })
}

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
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const { data: p } = await supabase.from('profiles').select('company_name').eq('id', user.id).single()
      if (p) setCompanyName(p.company_name || '')

      const { data: m, error } = await supabase
        .from('monthly_data')
        .select('*')
        .eq('user_id', user.id)
        .order('year', { ascending: true })
        .order('month', { ascending: true })

      if (error) console.error('monthly_data error:', error)
      if (m) setMonths(m)
    } catch(e) {
      console.error('load error:', e)
    } finally {
      setLoading(false)
    }
  }

  async function getMemoryAnalysis() {
    if (aiMemory) return
    setAnalyzing(true)
    const safeMonths = months.map(safe)
    const summary = safeMonths.map(m =>
      `${MONTH_NAMES[m.month-1]} ${m.year}: إيرادات ${fmt(m.revenue)} | مصروفات ${fmt(m.expenses)} | رصيد ${fmt(m.bank_balance)} | ديون ${fmt(m.debts)} | Score ${m.murdi_score}`
    ).join('\n')

    const first = safeMonths[0]
    const last = safeMonths[safeMonths.length - 1]
    const scoreChange = (last?.murdi_score || 0) - (first?.murdi_score || 0)

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

  const velocity = calcVelocity(months)
  const urgentCount = velocity.filter(v => v.urgent).length

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
                <div className="stat-val">{safe(months[months.length-1]).murdi_score}</div>
                <div className="stat-label">آخر Murdi Score</div>
              </div>
              <div className="stat">
                <div className="stat-val" style={{ color: (safe(months[months.length-1]).murdi_score - safe(months[0]).murdi_score) >= 0 ? '#4ade80' : '#f87171' }}>
                  {(safe(months[months.length-1]).murdi_score - safe(months[0]).murdi_score) >= 0 ? '+' : ''}
                  {safe(months[months.length-1]).murdi_score - safe(months[0]).murdi_score}
                </div>
                <div className="stat-label">التغير الكلي</div>
              </div>
            </div>

            {velocity.length > 0 && (
              <div style={{background:'#0a1628',border:`2px solid ${urgentCount > 0 ? '#ef444460' : '#F5C84240'}`,borderRadius:16,padding:'24px',marginBottom:24}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
                  <div style={{color:'#F5C842',fontSize:18,fontWeight:800,fontFamily:'Amiri,serif'}}>⚡ Murdi Risk Velocity™️</div>
                  {urgentCount > 0 && (
                    <div style={{background:'#ef444420',border:'1px solid #ef4444',borderRadius:20,padding:'4px 14px',color:'#ef4444',fontSize:13,fontWeight:700}}>
                      {urgentCount} تحذير فوري
                    </div>
                  )}
                </div>
                <div style={{color:'#8899BB',fontSize:12,marginBottom:16}}>تحليل سرعة تغير المؤشرات — الفرق بين "عندك خطر" و"خطرك يتسارع"</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                  {velocity.map((v, i) => (
                    <div key={i} style={{
                      background: v.urgent ? '#ef444410' : v.status === 'recovering' ? '#22c55e10' : '#ffffff08',
                      border: `1px solid ${v.urgent ? '#ef444440' : v.status === 'recovering' ? '#22c55e40' : '#1E3A6E'}`,
                      borderRadius:12, padding:'16px'
                    }}>
                      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                        <div style={{color:'#fff',fontSize:14,fontWeight:700}}>{v.icon} {v.label}</div>
                        <div style={{fontSize:11,fontWeight:700,padding:'2px 10px',borderRadius:12,
                          background: v.urgent ? '#ef444420' : v.status === 'recovering' ? '#22c55e20' : '#F5C84220',
                          color: v.urgent ? '#ef4444' : v.status === 'recovering' ? '#22c55e' : '#F5C842'}}>
                          {v.status === 'accelerating' ? 'يتدهور' : v.status === 'recovering' ? 'يتحسن' : 'مستقر'}
                        </div>
                      </div>
                      <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:10}}>
                        {v.values.map((val, j) => (
                          <div key={j} style={{flex:1,textAlign:'center'}}>
                            <div style={{fontSize:15,fontWeight:900,
                              color: j === v.values.length-1 ? (v.urgent ? '#ef4444' : v.status === 'recovering' ? '#22c55e' : '#F5C842') : '#8899BB'}}>{val}</div>
                            <div style={{fontSize:9,color:'#5a7a99',marginTop:2}}>
                              {months.slice(-v.values.length)[j] ? MONTH_NAMES[(months.slice(-v.values.length)[j].month||1)-1]?.slice(0,3) : ''}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div style={{color: v.urgent ? '#ef4444' : v.status === 'recovering' ? '#22c55e' : '#8899BB', fontSize:12,lineHeight:1.5}}>{v.message}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

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
                const sm = safe(m)
                const profit = sm.revenue - sm.expenses
                const scoreColor = sm.murdi_score >= 60 ? '#4ade80' : sm.murdi_score >= 40 ? '#F5C842' : '#f87171'
                return (
                  <div className="month-card" key={`${sm.year}-${sm.month}`}>
                    <div className="month-header">
                      <div className="month-name">{MONTH_NAMES[(sm.month||1)-1]} {sm.year}</div>
                      <div className="score-badge" style={{ background: `${scoreColor}22`, color: scoreColor, border: `1px solid ${scoreColor}44` }}>
                        {sm.murdi_score} نقطة
                      </div>
                    </div>
                    <div><div className="metric-label">الإيرادات</div><div className="metric-val">{fmt(sm.revenue)} ر.س</div></div>
                    <div><div className="metric-label">المصروفات</div><div className="metric-val">{fmt(sm.expenses)} ر.س</div></div>
                    <div><div className="metric-label">صافي الربح</div><div className="metric-val" style={{ color: profit >= 0 ? '#4ade80' : '#f87171' }}>{fmt(Math.abs(profit))} {profit >= 0 ? '▲' : '▼'}</div></div>
                    <div><div className="metric-label">الرصيد البنكي</div><div className="metric-val">{fmt(sm.bank_balance)} ر.س</div></div>
                    <div><div className="metric-label">الديون</div><div className="metric-val">{fmt(sm.debts)} ر.س</div></div>
                    <div><div className="metric-label">الذمم المدينة</div><div className="metric-val">{fmt(sm.receivables)} ر.س</div></div>
                    <div className="score-bar"><div className="score-fill" style={{ width: `${(sm.murdi_score/85)*100}%` }} /></div>
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
