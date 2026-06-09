'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'

interface MonthlyData {
  month: number
  year: number
  murdi_score: number
  revenue: number
  expenses: number
  debts: number
}

const MONTH_NAMES = [
  'يناير','فبراير','مارس','أبريل','مايو','يونيو',
  'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'
]

function getScoreLabel(score: number) {
  if (score >= 75) return 'ممتاز'
  if (score >= 60) return 'جيد جداً'
  if (score >= 45) return 'جيد'
  if (score >= 30) return 'مقبول'
  return 'يحتاج تحسين'
}

function ScoreArc({ score }: { score: number }) {
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 85) * circumference
  return (
    <svg width="140" height="140" viewBox="0 0 140 140" style={{ display: 'block', margin: '0 auto' }}>
      <defs>
        <linearGradient id="arcGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#B8963E" />
          <stop offset="100%" stopColor="#F0D080" />
        </linearGradient>
      </defs>
      <circle cx="70" cy="70" r={radius} fill="none" stroke="#1a2a4a" strokeWidth="10" />
      <circle cx="70" cy="70" r={radius} fill="none" stroke="url(#arcGrad)" strokeWidth="10"
        strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
        transform="rotate(-90 70 70)" style={{ transition: 'stroke-dashoffset 1.5s ease' }} />
      <text x="70" y="65" textAnchor="middle" fill="#F0D080" fontSize="26" fontWeight="bold" fontFamily="serif">{score}</text>
      <text x="70" y="85" textAnchor="middle" fill="#8aaccc" fontSize="11" fontFamily="serif">نقطة</text>
    </svg>
  )
}

export default function CertificatePage() {
  const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [companyName, setCompanyName] = useState('')
  const [year, setYear] = useState(new Date().getFullYear())
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([])
  const [availableYears, setAvailableYears] = useState<number[]>([])

  useEffect(() => { loadData() }, [year])

  async function loadData() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }

    const { data: profile } = await supabase.from('profiles').select('company_name').eq('id', user.id).single()
    if (profile) setCompanyName(profile.company_name)

    const { data: monthly } = await supabase.from('monthly_data').select('*').eq('user_id', user.id).eq('year', year).order('month', { ascending: true })
    if (monthly) setMonthlyData(monthly)

    const { data: allData } = await supabase.from('monthly_data').select('year').eq('user_id', user.id)
    if (allData) {
      const years = [...new Set(allData.map((d: any) => d.year))].sort((a: any, b: any) => b - a)
      setAvailableYears(years as number[])
    }
    setLoading(false)
  }

  const scores = monthlyData.map(m => m.murdi_score).filter(s => s > 0)
  const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0
  const topEntry = monthlyData.reduce((best, m) => m.murdi_score > (best?.murdi_score ?? 0) ? m : best, monthlyData[0])
  const improvement = scores.length >= 2 ? scores[scores.length - 1] - scores[0] : 0
  const maxScore = Math.max(...scores, 1)

  const improvements: string[] = []
  if (improvement > 0) improvements.push(`تحسّن Murdi Score من ${scores[0]} إلى ${scores[scores.length-1]} نقطة خلال العام`)
  const positiveCashMonths = monthlyData.filter(m => (m.revenue - m.expenses) > 0).length
  if (positiveCashMonths >= 6) improvements.push(`تحقيق تدفق نقدي موجب لـ ${positiveCashMonths} أشهر`)
  if (improvements.length === 0) improvements.push(`إتمام ${scores.length} شهراً من المتابعة المالية المنتظمة`)

  if (loading) return (
    <div style={{ minHeight:'100vh', background:'#0d1929', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ color:'#F0D080', fontFamily:'Cairo,sans-serif', fontSize:18 }}>جاري تحميل الشهادة...</div>
    </div>
  )

  if (scores.length === 0) return (
    <div style={{ minHeight:'100vh', background:'#0d1929', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:16 }}>
      <div style={{ color:'#F0D080', fontFamily:'Cairo,sans-serif', fontSize:18 }}>لا توجد بيانات لسنة {year}</div>
      <button onClick={() => router.push('/dashboard')} style={{ background:'#B8963E', color:'#0d1929', border:'none', padding:'10px 28px', borderRadius:40, fontFamily:'Cairo,sans-serif', fontWeight:700, cursor:'pointer' }}>العودة للداشبورد</button>
    </div>
  )

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Cairo:wght@300;400;600;700&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; }
        body { background:#0d1929; }
        .cert-wrapper { min-height:100vh; background:#0d1929; display:flex; flex-direction:column; align-items:center; padding:32px 16px; font-family:'Cairo',sans-serif; direction:rtl; }
        .top-bar { display:flex; align-items:center; gap:16px; margin-bottom:24px; flex-wrap:wrap; justify-content:center; }
        .year-select { background:#1a2a4a; color:#F0D080; border:1px solid rgba(184,150,62,0.4); padding:8px 20px; border-radius:40px; font-family:'Cairo',sans-serif; font-size:14px; cursor:pointer; outline:none; }
        .print-btn { background:linear-gradient(135deg,#B8963E,#F0D080); color:#0d1929; border:none; padding:12px 36px; border-radius:40px; font-family:'Cairo',sans-serif; font-size:15px; font-weight:700; cursor:pointer; }
        .back-btn { background:transparent; color:#8aaccc; border:1px solid rgba(138,172,204,0.3); padding:10px 24px; border-radius:40px; font-family:'Cairo',sans-serif; font-size:14px; cursor:pointer; }
        .cert-page { width:794px; min-height:1123px; background:#0b1f3a; border:2px solid #B8963E; border-radius:4px; position:relative; padding:60px 64px 48px; overflow:hidden; box-shadow:0 24px 80px rgba(0,0,0,0.6); }
        .cert-page::before,.cert-page::after { content:''; position:absolute; width:80px; height:80px; border:2px solid rgba(184,150,62,0.5); }
        .cert-page::before { top:12px; right:12px; border-bottom:none; border-left:none; }
        .cert-page::after { bottom:12px; left:12px; border-top:none; border-right:none; }
        .corner-bl { position:absolute; bottom:12px; right:12px; width:80px; height:80px; border:2px solid rgba(184,150,62,0.5); border-top:none; border-left:none; }
        .corner-tr { position:absolute; top:12px; left:12px; width:80px; height:80px; border:2px solid rgba(184,150,62,0.5); border-bottom:none; border-right:none; }
        .watermark { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); font-family:'Amiri',serif; font-size:200px; color:rgba(184,150,62,0.04); white-space:nowrap; pointer-events:none; user-select:none; }
        .cert-header { text-align:center; margin-bottom:32px; }
        .logo-row { display:flex; align-items:center; justify-content:center; gap:12px; margin-bottom:20px; }
        .logo-icon { width:48px; height:48px; background:linear-gradient(135deg,#B8963E,#F0D080); border-radius:50%; display:flex; align-items:center; justify-content:center; box-shadow:0 0 20px rgba(184,150,62,0.4); }
        .logo-text { font-family:'Amiri',serif; font-size:32px; color:#F0D080; letter-spacing:2px; }
        .divider-gold { width:200px; height:1px; background:linear-gradient(90deg,transparent,#B8963E,transparent); margin:12px auto; }
        .cert-title { font-family:'Amiri',serif; font-size:22px; color:#8aaccc; letter-spacing:4px; margin-bottom:6px; }
        .cert-subtitle { font-size:13px; color:#5a7a99; letter-spacing:2px; }
        .company-section { text-align:center; margin:28px 0; padding:24px; background:rgba(184,150,62,0.06); border:1px solid rgba(184,150,62,0.2); border-radius:2px; }
        .cert-declare { font-size:13px; color:#7a9ab8; margin-bottom:10px; }
        .company-name { font-family:'Amiri',serif; font-size:34px; color:#F0D080; margin-bottom:8px; }
        .year-badge { display:inline-block; background:rgba(184,150,62,0.15); border:1px solid rgba(184,150,62,0.4); color:#B8963E; padding:4px 20px; border-radius:20px; font-size:13px; letter-spacing:2px; }
        .score-section { display:grid; grid-template-columns:1fr 1fr 1fr; gap:20px; margin:28px 0; }
        .score-card { background:rgba(10,20,40,0.6); border:1px solid rgba(184,150,62,0.2); border-radius:2px; padding:20px 16px; text-align:center; }
        .score-card-label { font-size:11px; color:#5a7a99; letter-spacing:2px; margin-bottom:12px; }
        .score-big { font-family:'Amiri',serif; font-size:48px; color:#F0D080; line-height:1; }
        .score-unit { font-size:14px; color:#8aaccc; margin-top:4px; }
        .score-label-badge { display:inline-block; margin-top:8px; background:rgba(184,150,62,0.2); color:#F0D080; padding:3px 12px; border-radius:10px; font-size:12px; }
        .section-title { font-family:'Amiri',serif; font-size:17px; color:#B8963E; margin-bottom:14px; display:flex; align-items:center; gap:10px; }
        .section-title::after { content:''; flex:1; height:1px; background:linear-gradient(90deg,rgba(184,150,62,0.4),transparent); }
        .months-grid { display:grid; grid-template-columns:repeat(12,1fr); gap:4px; align-items:flex-end; height:80px; margin-top:12px; }
        .month-bar-wrap { display:flex; flex-direction:column; align-items:center; gap:4px; }
        .month-bar { width:100%; background:linear-gradient(180deg,#F0D080,#B8963E); border-radius:2px 2px 0 0; min-height:4px; }
        .month-label { font-size:8px; color:#5a7a99; text-align:center; }
        .improvement-item { display:flex; align-items:flex-start; gap:10px; padding:10px 14px; margin-bottom:8px; background:rgba(184,150,62,0.04); border-right:2px solid rgba(184,150,62,0.4); }
        .improvement-icon { color:#B8963E; font-size:14px; margin-top:1px; }
        .improvement-text { color:#8aaccc; font-size:14px; line-height:1.6; }
        .signature-section { display:grid; grid-template-columns:1fr 1fr; gap:40px; margin-top:36px; padding-top:24px; border-top:1px solid rgba(184,150,62,0.2); }
        .sig-block { text-align:center; }
        .sig-line { height:1px; background:rgba(184,150,62,0.4); margin-bottom:8px; }
        .sig-name { font-family:'Amiri',serif; font-size:15px; color:#F0D080; }
        .sig-title { font-size:11px; color:#5a7a99; margin-top:2px; letter-spacing:1px; }
        .cert-footer { text-align:center; margin-top:28px; font-size:10px; color:#3a5a79; letter-spacing:2px; }
        @media print { body { background:white !important; } .top-bar { display:none !important; } .cert-wrapper { padding:0; background:white; } .cert-page { box-shadow:none; width:100%; } }
      `}</style>
      <div className="cert-wrapper">
        <div className="top-bar">
          <button className="back-btn" onClick={() => router.push('/dashboard')}>← الداشبورد</button>
          {availableYears.length > 1 && (
            <select className="year-select" value={year} onChange={e => setYear(Number(e.target.value))}>
              {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          )}
          <button className="print-btn" onClick={() => window.print()}>⬇ تحميل / طباعة PDF</button>
        </div>
        <div className="cert-page">
          <div className="corner-bl" /><div className="corner-tr" />
          <div className="watermark">Murdi</div>
          <div className="cert-header">
            <div className="logo-row">
              <div className="logo-icon">
                <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
                  <polyline points="3,18 8,11 13,14 18,7 23,10" stroke="#0b1f3a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="23" cy="10" r="2.5" fill="#0b1f3a"/>
                  <line x1="3" y1="21" x2="23" y2="21" stroke="#0b1f3a" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              </div>
              <span className="logo-text">Murdi</span>
            </div>
            <div className="divider-gold" />
            <div className="cert-title">شهادة الأداء المالي السنوية</div>
            <div className="cert-subtitle">ANNUAL FINANCIAL PERFORMANCE CERTIFICATE</div>
          </div>
          <div className="company-section">
            <div className="cert-declare">يُشهد بموجب هذه الشهادة أن</div>
            <div className="company-name">{companyName}</div>
            <div className="year-badge">السنة المالية {year}</div>
          </div>
          <div className="score-section">
            <div className="score-card">
              <div className="score-card-label">متوسط الدرجة السنوية</div>
              <ScoreArc score={avgScore} />
              <div className="score-label-badge">{getScoreLabel(avgScore)}</div>
            </div>
            <div className="score-card">
              <div className="score-card-label">أعلى درجة شهرية</div>
              <div style={{ paddingTop:24 }}>
                <div className="score-big">{topEntry?.murdi_score ?? 0}</div>
                <div className="score-unit">{topEntry ? MONTH_NAMES[topEntry.month - 1] : ''}</div>
              </div>
            </div>
            <div className="score-card">
              <div className="score-card-label">مؤشر التحسن</div>
              <div style={{ paddingTop:24 }}>
                <div className="score-big" style={{ color: improvement >= 0 ? '#4ade80' : '#f87171' }}>
                  {improvement >= 0 ? '+' : ''}{improvement}
                </div>
                <div className="score-unit">نقطة خلال العام</div>
              </div>
            </div>
          </div>
          <div style={{ margin:'28px 0' }}>
            <div className="section-title">الأداء الشهري</div>
            <div className="months-grid">
              {monthlyData.map(m => (
                <div className="month-bar-wrap" key={m.month}>
                  <div className="month-bar" style={{ height:`${(m.murdi_score / maxScore) * 60}px` }} />
                  <div className="month-label">{MONTH_NAMES[m.month - 1].slice(0,3)}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ margin:'28px 0' }}>
            <div className="section-title">أبرز الإنجازات</div>
            {improvements.map((imp, i) => (
              <div className="improvement-item" key={i}>
                <span className="improvement-icon">◆</span>
                <span className="improvement-text">{imp}</span>
              </div>
            ))}
          </div>
          <div className="signature-section">
            <div className="sig-block">
              <div className="sig-line" />
              <div className="sig-name">د. عبدالحكيم المرضي</div>
              <div className="sig-title">المؤسس — منصة Murdi</div>
            </div>
            <div className="sig-block">
              <div className="sig-line" />
              <div className="sig-name">ختم المنصة</div>
              <div className="sig-title">murdi.vercel.app</div>
            </div>
          </div>
          <div className="cert-footer">MURDI PLATFORM · منصة Murdi للذكاء المالي · {year}</div>
        </div>
      </div>
    </>
  )
}220

