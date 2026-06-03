'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

interface MonthlyData {
  month: number
  year: number
  murdi_score: number
  revenue: number
  expenses: number
  debts: number
  bank_balance: number
  receivables: number
}

interface Benchmark {
  metric: string
  value: number
  source: string
}

export default function MarketPage() {
  const supabase = createClient()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [companyName, setCompanyName] = useState('')
  const [myScore, setMyScore] = useState(0)
  const [myLiquidity, setMyLiquidity] = useState(0)
  const [myDebtRatio, setMyDebtRatio] = useState(0)
  const [myCashMonths, setMyCashMonths] = useState(0)
  const [benchmarks, setBenchmarks] = useState<Record<string, number>>({})
  const [allMonths, setAllMonths] = useState<MonthlyData[]>([])
  const [aiAnalysis, setAiAnalysis] = useState('')
  const [userCount, setUserCount] = useState(0)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }

    const { data: p } = await supabase.from('profiles').select('company_name').eq('id', user.id).single()
    if (p) setCompanyName(p.company_name || '')

    const { data: monthly } = await supabase
      .from('monthly_data')
      .select('*')
      .eq('user_id', user.id)
      .order('year', { ascending: false })
      .order('month', { ascending: false })

    if (monthly && monthly.length > 0) {
      setAllMonths(monthly)
      const scores = monthly.map((m: MonthlyData) => m.murdi_score).filter(s => s > 0)
      setMyScore(scores.length ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length) : 0)
      const last = monthly[0] as MonthlyData
      setMyLiquidity(last.expenses > 0 ? Math.round((last.bank_balance / last.expenses) * 10) / 10 : 0)
      const annualRev = last.revenue * 12
      setMyDebtRatio(annualRev > 0 ? Math.round((last.debts / annualRev) * 100) : 0)
      setMyCashMonths(monthly.filter((m: MonthlyData) => (m.revenue - m.expenses) > 0).length)
    }

    const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true })
    setUserCount(count || 0)

    const res = await fetch('/api/market-benchmarks')
    const json = await res.json()
    if (json.data) {
      const bMap: Record<string, number> = {}
      json.data.forEach((b: Benchmark) => { bMap[b.metric] = b.value })
      setBenchmarks(bMap)
    }

    setLoading(false)
  }

  async function getClaudeAnalysis() {
    if (aiAnalysis) return
    setAnalyzing(true)

    const last = allMonths[0]
    const marketScore = benchmarks['avg_murdi_score'] || 48
    const betterThan = Math.min(Math.round((myScore / marketScore) * 50 + 25), 99)

    const prompt = `أنت مستشار مالي متخصص في شركات المقاولات السعودية.

بيانات شركة "${companyName}":
- Murdi Score: ${myScore}/85 (متوسط السوق: ${marketScore})
- السيولة: ${myLiquidity} شهر (السوق: ${benchmarks['avg_liquidity_months'] || 2.1} شهر)
- نسبة الديون: ${myDebtRatio}% (السوق: ${Math.round((benchmarks['avg_debt_ratio'] || 0.65) * 100)}%)
- أشهر التدفق الموجب: ${myCashMonths} من ${allMonths.length} شهر
- الإيرادات الشهرية: ${last?.revenue?.toLocaleString()} ريال
- المصروفات الشهرية: ${last?.expenses?.toLocaleString()} ريال
- الرصيد البنكي: ${last?.bank_balance?.toLocaleString()} ريال
- الديون: ${last?.debts?.toLocaleString()} ريال
- الشركة أفضل من ${betterThan}% من شركات المقاولات السعودية

اكتب تحليلاً مالياً احترافياً بالعربي في 3 فقرات:
1. تقييم الوضع الحالي مقارنة بالسوق (جملتان)
2. أبرز نقطة قوة ونقطة خطر (جملتان)
3. القرار الأهم الذي يجب اتخاذه الآن بالأرقام (جملتان)

اكتب بأسلوب مستشار خبير يتكلم مع صاحب شركة، لا تستخدم نقاط أو عناوين.`

    try {
      const last = allMonths[0]
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName,
          myScore,
          myLiquidity,
          myDebtRatio,
          myCashMonths,
          marketScore,
          liquidityMarket: benchmarks['avg_liquidity_months'] || 2.1,
          debtMarket: Math.round((benchmarks['avg_debt_ratio'] || 0.65) * 100),
          cashMarket: benchmarks['avg_cash_flow_positive_months'] || 6,
          betterThan,
          revenue: last?.revenue || 0,
          expenses: last?.expenses || 0,
          bankBalance: last?.bank_balance || 0,
          debts: last?.debts || 0,
          monthsCount: allMonths.length
        })
      })
      const data = await response.json()
      setAiAnalysis(data.analysis || 'تعذر التحليل')
    } catch {
      setAiAnalysis('تعذر الاتصال بالمحلل الذكي. يرجى المحاولة مرة أخرى.')
    }

    setAnalyzing(false)
  }

  const marketScore = benchmarks['avg_murdi_score'] || 48
  const betterThan = marketScore > 0 ? Math.min(Math.round((myScore / marketScore) * 50 + 25), 99) : 0

  const metrics = [
    { label: 'Murdi Score', mine: myScore, market: marketScore, unit: 'نقطة', higherIsBetter: true, max: 85 },
    { label: 'السيولة', mine: myLiquidity, market: benchmarks['avg_liquidity_months'] || 2.1, unit: 'شهر', higherIsBetter: true, max: 6 },
    { label: 'نسبة الديون', mine: myDebtRatio, market: Math.round((benchmarks['avg_debt_ratio'] || 0.65) * 100), unit: '%', higherIsBetter: false, max: 100 },
    { label: 'أشهر التدفق الموجب', mine: myCashMonths, market: benchmarks['avg_cash_flow_positive_months'] || 6, unit: 'شهر', higherIsBetter: true, max: 12 }
  ]

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0d1929', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#F0D080', fontFamily: 'Cairo,sans-serif', fontSize: 18 }}>جاري التحليل...</div>
    </div>
  )

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&family=Amiri:wght@400;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0d1929; }
        .pw { min-height: 100vh; background: #0d1929; padding: 32px 24px; font-family: 'Cairo', sans-serif; direction: rtl; max-width: 900px; margin: 0 auto; }
        .hd { display: flex; align-items: center; justify-content: space-between; margin-bottom: 32px; flex-wrap: wrap; gap: 12px; }
        .bb { background: transparent; color: #8aaccc; border: 1px solid rgba(138,172,204,0.3); padding: 10px 24px; border-radius: 40px; font-family: 'Cairo',sans-serif; font-size: 14px; cursor: pointer; }
        .ttl { font-family: 'Amiri',serif; font-size: 28px; color: #F0D080; text-align: center; }
        .hero { background: linear-gradient(135deg, rgba(184,150,62,0.15), rgba(10,20,40,0.8)); border: 1px solid rgba(184,150,62,0.3); border-radius: 12px; padding: 32px; text-align: center; margin-bottom: 24px; }
        .pct { font-family: 'Amiri',serif; font-size: 80px; color: #F0D080; line-height: 1; }
        .pct-sub { font-size: 18px; color: #8aaccc; margin-top: 8px; }
        .pct-label { font-size: 14px; color: #5a7a99; margin-top: 6px; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
        .card { background: rgba(10,20,40,0.6); border: 1px solid rgba(184,150,62,0.2); border-radius: 8px; padding: 20px; }
        .card-title { font-size: 13px; color: #5a7a99; margin-bottom: 16px; letter-spacing: 1px; text-align: center; }
        .bar-row { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
        .bar-label { font-size: 12px; color: #8aaccc; width: 55px; text-align: right; flex-shrink: 0; }
        .bar-track { flex: 1; height: 8px; background: rgba(255,255,255,0.06); border-radius: 4px; overflow: hidden; }
        .bar-fill { height: 100%; border-radius: 4px; }
        .bar-val { font-size: 12px; color: #F0D080; width: 50px; text-align: left; flex-shrink: 0; }
        .badge { display: inline-block; padding: 6px 16px; border-radius: 20px; font-size: 12px; font-weight: 700; margin-top: 8px; width: 100%; text-align: center; }
        .badge-win { background: rgba(74,222,128,0.15); color: #4ade80; border: 1px solid rgba(74,222,128,0.3); }
        .badge-lose { background: rgba(248,113,113,0.15); color: #f87171; border: 1px solid rgba(248,113,113,0.3); }
        .ai-section { background: rgba(10,20,40,0.8); border: 1px solid rgba(184,150,62,0.3); border-radius: 12px; padding: 28px; margin-bottom: 24px; }
        .ai-title { font-family: 'Amiri',serif; font-size: 20px; color: #F0D080; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
        .ai-btn { background: linear-gradient(135deg, #B8963E, #F0D080); color: #0d1929; border: none; padding: 14px 32px; border-radius: 40px; font-family: 'Cairo',sans-serif; font-size: 15px; font-weight: 700; cursor: pointer; width: 100%; margin-bottom: 16px; transition: opacity 0.2s; }
        .ai-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .ai-text { color: #c0d8f0; font-size: 15px; line-height: 2; background: rgba(184,150,62,0.05); border-right: 3px solid #B8963E; padding: 16px 20px; border-radius: 4px; }
        .note { text-align: center; padding: 12px; background: rgba(184,150,62,0.06); border: 1px solid rgba(184,150,62,0.2); border-radius: 8px; margin-bottom: 20px; font-size: 12px; color: #5a7a99; }
        .loading-dots { display: inline-block; animation: pulse 1.5s infinite; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @media(max-width:600px){ .grid { grid-template-columns: 1fr; } }
      `}</style>

      <div className="pw">
        <div className="hd">
          <button className="bb" onClick={() => router.push('/dashboard')}>← الداشبورد</button>
          <div className="ttl">المقارنة مع السوق</div>
          <div style={{ width: 100 }} />
        </div>

        {userCount < 10 && (
          <div className="note">
            📊 البيانات مبنية على تقارير SAMA — ستتحسن تلقائياً مع نمو مستخدمي Murdi
          </div>
        )}

        <div className="hero">
          <div className="pct">{betterThan}%</div>
          <div className="pct-sub">من شركات المقاولات السعودية</div>
          <div className="pct-label">شركة {companyName} أفضل مالياً من هذه النسبة</div>
        </div>

        <div className="grid">
          {metrics.map(m => {
            const isWin = m.higherIsBetter ? m.mine >= m.market : m.mine <= m.market
            const myWidth = Math.min((m.mine / m.max) * 100, 100)
            const mktWidth = Math.min((m.market / m.max) * 100, 100)
            return (
              <div className="card" key={m.label}>
                <div className="card-title">{m.label}</div>
                <div className="bar-row">
                  <div className="bar-label">شركتك</div>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: `${myWidth}%`, background: isWin ? '#4ade80' : '#f87171' }} />
                  </div>
                  <div className="bar-val">{m.mine} {m.unit}</div>
                </div>
                <div className="bar-row">
                  <div className="bar-label">السوق</div>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: `${mktWidth}%`, background: '#B8963E' }} />
                  </div>
                  <div className="bar-val">{m.market} {m.unit}</div>
                </div>
                <div className={`badge ${isWin ? 'badge-win' : 'badge-lose'}`}>
                  {isWin ? '✓ أفضل من السوق' : '↑ فرصة تحسين'}
                </div>
              </div>
            )
          })}
        </div>

        <div className="ai-section">
          <div className="ai-title">🧠 تحليل Murdi الذكي</div>
          <button className="ai-btn" onClick={getClaudeAnalysis} disabled={analyzing}>
            {analyzing ? <span className="loading-dots">جاري التحليل...</span> : '⚡ احصل على تحليلك الذكي'}
          </button>
          {aiAnalysis && (
            <div className="ai-text">{aiAnalysis}</div>
          )}
        </div>
      </div>
    </>
  )
}
