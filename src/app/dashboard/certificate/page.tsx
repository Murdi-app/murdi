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
}

const MONTH_NAMES = [
  'يناير','فبراير','مارس','أبريل','مايو','يونيو',
  'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'
]

function getScoreLabel(score: number) {
  if (score >= 75) return 'ممتاز'
  if (score >= 60) return 'جيد جداً'
  if (score >= 45) return 'جيد'
  return 'يحتاج تحسين'
}

function ScoreArc({ score }: { score: number }) {
  const r = 54
  const circ = 2 * Math.PI * r
  const offset = circ - (score / 85) * circ
  return (
    <svg width="140" height="140" viewBox="0 0 140 140" style={{display:'block',margin:'0 auto'}}>
      <defs>
        <linearGradient id="ag" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#B8963E"/>
          <stop offset="100%" stopColor="#F0D080"/>
        </linearGradient>
      </defs>
      <circle cx="70" cy="70" r={r} fill="none" stroke="#1a2a4a" strokeWidth="10"/>
      <circle cx="70" cy="70" r={r} fill="none" stroke="url(#ag)" strokeWidth="10"
        strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
        transform="rotate(-90 70 70)"/>
      <text x="70" y="65" textAnchor="middle" fill="#F0D080" fontSize="26" fontWeight="bold">{score}</text>
      <text x="70" y="85" textAnchor="middle" fill="#8aaccc" fontSize="11">نقطة</text>
    </svg>
  )
}

export default function CertificatePage() {
  const supabase = createClient()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [companyName, setCompanyName] = useState('')
  const [year, setYear] = useState(new Date().getFullYear())
  const [data, setData] = useState<MonthlyData[]>([])
  const [years, setYears] = useState<number[]>([])

  useEffect(() => { load() }, [year])

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }

    const { data: p } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (p) {
      setCompanyName(p.company_name || p.name || p.full_name || p.email || '')
    }

    const { data: m } = await supabase
      .from('monthly_data')
      .select('*')
      .eq('user_id', user.id)
      .eq('year', year)
      .order('month')
    if (m) setData(m)

    const { data: all } = await supabase
      .from('monthly_data')
      .select('year')
      .eq('user_id', user.id)
    if (all) {
      const uniqueYears = [...new Set(all.map((d: any) => d.year as number))].sort((a,b) => b-a)
      setYears(uniqueYears)
    }

    setLoading(false)
  }

  const scores = data.map(m => m.murdi_score).filter(s => s > 0)
  const avg = scores.length ? Math.round(scores.reduce((a,b) => a+b,0) / scores.length) : 0
  const top = data.length > 0 ? data.reduce((b,m) => m.murdi_score > (b?.murdi_score??0) ? m : b, data[0]) : null
  const imp = scores.length >= 2 ? scores[scores.length-1] - scores[0] : 0
  const maxS = Math.max(...scores, 1)

  const notes: string[] = []
  if (scores.length >= 2 && imp > 0) notes.push(`تحسّن Murdi Score من ${scores[0]} إلى ${scores[scores.length-1]} نقطة`)
  const pos = data.filter(m => (m.revenue - m.expenses) > 0).length
  if (pos >= 3) notes.push(`تدفق نقدي موجب لـ ${pos} أشهر`)
  if (notes.length === 0) notes.push(`إتمام ${scores.length} شهراً من المتابعة المالية المنتظمة`)

  const whatsappMsg = encodeURIComponent(
    `السلام عليكم،\nأشارككم شهادة الأداء المالي لـ ${companyName} لعام ${year}\nMurdi Score: ${avg}/85 — ${getScoreLabel(avg)}\nمنصة Murdi: murdi.vercel.app`
  )

  if (loading) return (
    <div style={{minHeight:'100vh',background:'#0d1929',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{color:'#F0D080',fontFamily:'Cairo,sans-serif',fontSize:18}}>جاري التحميل...</div>
    </div>
  )

  if (scores.length === 0) return (
    <div style={{minHeight:'100vh',background:'#0d1929',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:16}}>
      <div style={{color:'#F0D080',fontFamily:'Cairo,sans-serif',fontSize:18}}>لا توجد بيانات لسنة {year}</div>
      <button onClick={() => router.push('/dashboard')} style={{background:'#B8963E',color:'#0d1929',border:'none',padding:'10px 28px',borderRadius:40,fontFamily:'Cairo,sans-serif',fontWeight:700,cursor:'pointer'}}>العودة للداشبورد</button>
    </div>
  )

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Cairo:wght@400;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        body{background:#0d1929}
        .cw{min-height:100vh;background:#0d1929;display:flex;flex-direction:column;align-items:center;padding:32px 16px;font-family:'Cairo',sans-serif;direction:rtl}
        .tb{display:flex;align-items:center;gap:12px;margin-bottom:24px;flex-wrap:wrap;justify-content:center}
        .ys{background:#1a2a4a;color:#F0D080;border:1px solid rgba(184,150,62,0.4);padding:8px 20px;border-radius:40px;font-family:'Cairo',sans-serif;font-size:14px;cursor:pointer;outline:none}
        .pb{background:linear-gradient(135deg,#B8963E,#F0D080);color:#0d1929;border:none;padding:12px 28px;border-radius:40px;font-family:'Cairo',sans-serif;font-size:14px;font-weight:700;cursor:pointer}
        .wb{background:#25D366;color:white;border:none;padding:12px 28px;border-radius:40px;font-family:'Cairo',sans-serif;font-size:14px;font-weight:700;cursor:pointer;text-decoration:none;display:inline-block}
        .bb{background:transparent;color:#8aaccc;border:1px solid rgba(138,172,204,0.3);padding:10px 24px;border-radius:40px;font-family:'Cairo',sans-serif;font-size:14px;cursor:pointer}
        .cp{width:794px;min-height:1123px;background:#0b1f3a;border:2px solid #B8963E;border-radius:4px;position:relative;padding:60px 64px 48px;overflow:hidden;box-shadow:0 24px 80px rgba(0,0,0,0.6)}
        .cp::before,.cp::after{content:'';position:absolute;width:80px;height:80px;border:2px solid rgba(184,150,62,0.5)}
        .cp::before{top:12px;right:12px;border-bottom:none;border-left:none}
        .cp::after{bottom:12px;left:12px;border-top:none;border-right:none}
        .c1{position:absolute;bottom:12px;right:12px;width:80px;height:80px;border:2px solid rgba(184,150,62,0.5);border-top:none;border-left:none}
        .c2{position:absolute;top:12px;left:12px;width:80px;height:80px;border:2px solid rgba(184,150,62,0.5);border-bottom:none;border-right:none}
        .wm{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-family:'Amiri',serif;font-size:200px;color:rgba(184,150,62,0.04);white-space:nowrap;pointer-events:none;user-select:none}
        .ch{text-align:center;margin-bottom:32px}
        .lr{display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:20px}
        .li{width:48px;height:48px;background:linear-gradient(135deg,#B8963E,#F0D080);border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 0 20px rgba(184,150,62,0.4)}
        .lt{font-family:'Amiri',serif;font-size:32px;color:#F0D080;letter-spacing:2px}
        .dg{width:200px;height:1px;background:linear-gradient(90deg,transparent,#B8963E,transparent);margin:12px auto}
        .ct{font-family:'Amiri',serif;font-size:22px;color:#8aaccc;letter-spacing:4px;margin-bottom:6px}
        .cs{font-size:13px;color:#5a7a99;letter-spacing:2px}
        .co{text-align:center;margin:28px 0;padding:24px;background:rgba(184,150,62,0.06);border:1px solid rgba(184,150,62,0.2);border-radius:2px}
        .cd{font-size:13px;color:#7a9ab8;margin-bottom:10px}
        .cn{font-family:'Amiri',serif;font-size:34px;color:#F0D080;margin-bottom:8px}
        .yb{display:inline-block;background:rgba(184,150,62,0.15);border:1px solid rgba(184,150,62,0.4);color:#B8963E;padding:4px 20px;border-radius:20px;font-size:13px;letter-spacing:2px}
        .ss{display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px;margin:28px 0}
        .sc{background:rgba(10,20,40,0.6);border:1px solid rgba(184,150,62,0.2);border-radius:2px;padding:20px 16px;text-align:center}
        .sl{font-size:11px;color:#5a7a99;letter-spacing:2px;margin-bottom:12px}
        .sb{font-family:'Amiri',serif;font-size:48px;color:#F0D080;line-height:1}
        .su{font-size:14px;color:#8aaccc;margin-top:4px}
        .sk{display:inline-block;margin-top:8px;background:rgba(184,150,62,0.2);color:#F0D080;padding:3px 12px;border-radius:10px;font-size:12px}
        .st{font-family:'Amiri',serif;font-size:17px;color:#B8963E;margin-bottom:14px;display:flex;align-items:center;gap:10px}
        .st::after{content:'';flex:1;height:1px;background:linear-gradient(90deg,rgba(184,150,62,0.4),transparent)}
        .mg{display:grid;gap:4px;align-items:flex-end;height:80px;margin-top:12px}
        .mw{display:flex;flex-direction:column;align-items:center;gap:4px}
        .mb{width:100%;background:linear-gradient(180deg,#F0D080,#B8963E);border-radius:2px 2px 0 0;min-height:4px}
        .ml{font-size:8px;color:#5a7a99;text-align:center}
        .ii{display:flex;align-items:flex-start;gap:10px;padding:10px 14px;margin-bottom:8px;background:rgba(184,150,62,0.04);border-right:2px solid rgba(184,150,62,0.4)}
        .ic{color:#B8963E;font-size:14px;margin-top:1px}
        .it{color:#8aaccc;font-size:14px;line-height:1.6}
        .sg{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:36px;padding-top:24px;border-top:1px solid rgba(184,150,62,0.2)}
        .sb2{text-align:center}
        .sl2{height:1px;background:rgba(184,150,62,0.4);margin-bottom:8px}
        .sn{font-family:'Amiri',serif;font-size:15px;color:#F0D080}
        .st2{font-size:11px;color:#5a7a99;margin-top:2px;letter-spacing:1px}
        .cf{text-align:center;margin-top:28px;font-size:10px;color:#3a5a79;letter-spacing:2px}
        @media print{body{background:white!important}.tb{display:none!important}.cw{padding:0;background:white}.cp{box-shadow:none;width:100%}}
        @media(max-width:820px){.cp{width:100%;padding:32px 20px}.ss{grid-template-columns:1fr}}
      `}</style>
      <div className="cw">
        <div className="tb">
          <button className="bb" onClick={() => router.push('/dashboard')}>← الداشبورد</button>
          {years.length > 1 && (
            <select className="ys" value={year} onChange={e => setYear(Number(e.target.value))}>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          )}
          <button className="pb" onClick={() => window.print()}>⬇ تحميل PDF</button>
          <a className="wb" href={`https://wa.me/?text=${whatsappMsg}`} target="_blank" rel="noreferrer">
            📤 شارك واتساب
          </a>
        </div>
        <div className="cp">
          <div className="c1"/><div className="c2"/>
          <div className="wm">Murdi</div>
          <div className="ch">
            <div className="lr">
              <div className="li">
                <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
                  <polyline points="3,18 8,11 13,14 18,7 23,10" stroke="#0b1f3a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="23" cy="10" r="2.5" fill="#0b1f3a"/>
                  <line x1="3" y1="21" x2="23" y2="21" stroke="#0b1f3a" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              </div>
              <span className="lt">Murdi</span>
            </div>
            <div className="dg"/>
            <div className="ct">شهادة الأداء المالي السنوية</div>
            <div className="cs">ANNUAL FINANCIAL PERFORMANCE CERTIFICATE</div>
          </div>
          <div className="co">
            <div className="cd">يُشهد بموجب هذه الشهادة أن</div>
            <div className="cn">{companyName || '—'}</div>
            <div className="yb">السنة المالية {year}</div>
          </div>
          <div className="ss">
            <div className="sc">
              <div className="sl">متوسط الدرجة السنوية</div>
              <ScoreArc score={avg}/>
              <div className="sk">{getScoreLabel(avg)}</div>
            </div>
            <div className="sc">
              <div className="sl">أعلى درجة شهرية</div>
              <div style={{paddingTop:24}}>
                <div className="sb">{top?.murdi_score ?? 0}</div>
                <div className="su">{top ? MONTH_NAMES[(top.month-1)] : ''}</div>
              </div>
            </div>
            <div className="sc">
              <div className="sl">مؤشر التحسن</div>
              <div style={{paddingTop:24}}>
                <div className="sb" style={{color:imp>=0?'#4ade80':'#f87171'}}>{imp>=0?'+':''}{imp}</div>
                <div className="su">نقطة خلال العام</div>
              </div>
            </div>
          </div>
          {data.length > 1 && (
            <div style={{margin:'28px 0'}}>
              <div className="st">الأداء الشهري</div>
              <div className="mg" style={{gridTemplateColumns:`repeat(${data.length},1fr)`}}>
                {data.map(m => (
                  <div className="mw" key={m.month}>
                    <div className="mb" style={{height:`${(m.murdi_score/maxS)*60}px`}}/>
                    <div className="ml">{MONTH_NAMES[m.month-1]?.slice(0,3)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div style={{margin:'28px 0'}}>
            <div className="st">أبرز الإنجازات</div>
            {notes.map((n,i) => (
              <div className="ii" key={i}>
                <span className="ic">◆</span>
                <span className="it">{n}</span>
              </div>
            ))}
          </div>
          <div className="sg">
            <div className="sb2">
              <div className="sl2"/>
              <div className="sn">د. عبدالحكيم المرضي</div>
              <div className="st2">المؤسس — منصة Murdi</div>
            </div>
            <div className="sb2">
              <div className="sl2"/>
              <div className="sn">ختم المنصة</div>
              <div className="st2">murdi.vercel.app</div>
            </div>
          </div>
          <div className="cf">MURDI PLATFORM · منصة Murdi للذكاء المالي · {year}</div>
        </div>
      </div>
    </>
  )
}
