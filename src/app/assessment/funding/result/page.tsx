'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'

interface Obstacle { title: string; severity: 'high' | 'medium' | 'low'; detail: string }
interface PlanItem { phase: string; action: string }

interface Result {
  readiness_score: number
  verdict: string
  top_obstacles: Obstacle[]
  required_documents: string[]
  improvement_plan: PlanItem[]
  created_at: string
}

function verdictColor(verdict: string) {
  if (verdict === 'جاهز') return '#2E9E7B'
  if (verdict === 'يحتاج تحسين') return '#D9A441'
  return '#D96A6A'
}

function ScoreRing({ score }: { score: number }) {
  const radius = 58
  const circ = 2 * Math.PI * radius
  const offset = circ - (score / 100) * circ
  return (
    <svg width="150" height="150" viewBox="0 0 150 150">
      <defs>
        <linearGradient id="ring" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2E9E7B" />
          <stop offset="100%" stopColor="#7DD3B0" />
        </linearGradient>
      </defs>
      <circle cx="75" cy="75" r={radius} fill="none" stroke="#EAF1EE" strokeWidth="11" />
      <circle cx="75" cy="75" r={radius} fill="none" stroke="url(#ring)" strokeWidth="11"
        strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
        transform="rotate(-90 75 75)" style={{ transition: 'stroke-dashoffset 1.4s ease' }} />
      <text x="75" y="80" textAnchor="middle" fill="#1A3D34" fontSize="38" fontWeight="700" fontFamily="Amiri,serif">{score}</text>
      <text x="75" y="100" textAnchor="middle" fill="#6B8A80" fontSize="12" fontFamily="Cairo,sans-serif">من 100</text>
    </svg>
  )
}

export default function FundingResultPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [result, setResult] = useState<Result | null>(null)
  const [companyName, setCompanyName] = useState('')
  const [requesting, setRequesting] = useState(false)
  const [requested, setRequested] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }

    const { data: company } = await supabase
      .from('companies').select('id, company_name, file_status').eq('user_id', user.id).maybeSingle()
    if (!company) { router.push('/goal'); return }
    if (company.company_name) setCompanyName(company.company_name)
    if (company.file_status === 'under_review') setRequested(true)

    const { data: res } = await supabase
      .from('readiness_results')
      .select('*')
      .eq('company_id', company.id)
      .eq('goal', 'funding')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (res) setResult(res as Result)
    setLoading(false)
  }

  async function requestReview() {
    setRequesting(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('companies').update({ file_status: 'under_review' }).eq('user_id', user.id)
    setRequesting(false)
    setRequested(true)
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', background:'#FBFCFB', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ color:'#2E9E7B', fontFamily:'Cairo,sans-serif', fontSize:18 }}>جاري تحميل النتائج...</div>
    </div>
  )

  if (!result) return (
    <div style={{ minHeight:'100vh', background:'#FBFCFB', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:16, fontFamily:'Cairo,sans-serif' }}>
      <div style={{ color:'#6B8A80', fontSize:17 }}>لا توجد نتائج بعد</div>
      <button onClick={() => router.push('/assessment/funding')} style={{ background:'#2E9E7B', color:'#fff', border:'none', padding:'12px 32px', borderRadius:40, fontFamily:'Cairo,sans-serif', fontWeight:700, cursor:'pointer' }}>ابدأ التقييم</button>
    </div>
  )

  const vColor = verdictColor(result.verdict)

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Cairo:wght@300;400;600;700&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; }
        .rs-wrapper { min-height:100vh; background:#FBFCFB; padding:48px 16px; font-family:'Cairo',sans-serif; direction:rtl; display:flex; flex-direction:column; align-items:center; }
        .rs-inner { max-width:680px; width:100%; }
        .rs-company { color:#2E9E7B; font-size:13px; background:#E8F5EF; display:inline-block; padding:5px 18px; border-radius:30px; font-weight:600; margin-bottom:16px; }
        .rs-hero { background:#fff; border:1.5px solid #EAF1EE; border-radius:24px; padding:38px 30px; text-align:center; box-shadow:0 4px 24px rgba(26,61,52,0.05); margin-bottom:22px; }
        .rs-hero-title { font-family:'Amiri',serif; font-size:24px; color:#1A3D34; font-weight:700; margin-bottom:20px; }
        .rs-verdict { display:inline-block; margin-top:16px; padding:8px 28px; border-radius:30px; font-size:16px; font-weight:700; }
        .rs-section { background:#fff; border:1.5px solid #EAF1EE; border-radius:20px; padding:28px 26px; margin-bottom:18px; box-shadow:0 2px 12px rgba(26,61,52,0.04); }
        .rs-section-title { font-family:'Amiri',serif; font-size:19px; color:#1A3D34; font-weight:700; margin-bottom:18px; display:flex; align-items:center; gap:10px; }
        .rs-obstacle { padding:16px 18px; border-radius:14px; margin-bottom:12px; border-right:4px solid; }
        .rs-obstacle.high { background:#FBEDED; border-color:#D96A6A; }
        .rs-obstacle.medium { background:#FBF5E8; border-color:#D9A441; }
        .rs-obstacle.low { background:#E8F5EF; border-color:#2E9E7B; }
        .rs-obstacle-title { font-size:15px; font-weight:700; color:#1A3D34; margin-bottom:5px; }
        .rs-obstacle-detail { font-size:13.5px; color:#6B8A80; line-height:1.7; }
        .rs-doc { display:flex; align-items:center; gap:10px; padding:11px 0; border-bottom:1px solid #F0F5F3; font-size:14.5px; color:#1A3D34; }
        .rs-doc:last-child { border-bottom:none; }
        .rs-doc-icon { color:#2E9E7B; font-size:16px; }
        .rs-plan { display:flex; gap:14px; padding:14px 0; border-bottom:1px solid #F0F5F3; }
        .rs-plan:last-child { border-bottom:none; }
        .rs-plan-phase { flex-shrink:0; background:#E8F5EF; color:#2E9E7B; padding:5px 14px; border-radius:20px; font-size:12.5px; font-weight:700; height:fit-content; }
        .rs-plan-action { font-size:14px; color:#1A3D34; line-height:1.7; }
        .rs-cta { background:linear-gradient(135deg,#2E9E7B,#7DD3B0); border-radius:22px; padding:30px 28px; text-align:center; margin-top:8px; }
        .rs-cta-title { font-family:'Amiri',serif; font-size:20px; color:#fff; font-weight:700; margin-bottom:8px; }
        .rs-cta-sub { color:rgba(255,255,255,0.9); font-size:13.5px; margin-bottom:20px; line-height:1.7; }
        .rs-cta-btn { background:#fff; color:#2E9E7B; border:none; padding:14px 44px; border-radius:40px; font-family:'Cairo',sans-serif; font-size:15.5px; font-weight:700; cursor:pointer; transition:all .2s; }
        .rs-cta-btn:disabled { opacity:0.75; cursor:default; }
        .rs-done { background:rgba(255,255,255,0.18); color:#fff; padding:14px 24px; border-radius:14px; font-size:14.5px; font-weight:600; line-height:1.7; }
        .rs-note { color:#A3BAB2; font-size:11.5px; text-align:center; margin-top:22px; line-height:1.8; }
      `}</style>
      <div className="rs-wrapper">
        <div className="rs-inner">
          {companyName && <div style={{ textAlign:'center' }}><span className="rs-company">{companyName}</span></div>}

          <div className="rs-hero">
            <div className="rs-hero-title">جاهزيتك التمويلية</div>
            <ScoreRing score={result.readiness_score} />
            <div>
              <span className="rs-verdict" style={{ background:vColor+'1A', color:vColor }}>{result.verdict}</span>
            </div>
          </div>

          {result.top_obstacles && result.top_obstacles.length > 0 && (
            <div className="rs-section">
              <div className="rs-section-title">⚠️ أهم العوائق</div>
              {result.top_obstacles.map((o, i) => (
                <div key={i} className={`rs-obstacle ${o.severity}`}>
                  <div className="rs-obstacle-title">{o.title}</div>
                  <div className="rs-obstacle-detail">{o.detail}</div>
                </div>
              ))}
            </div>
          )}

          {result.improvement_plan && result.improvement_plan.length > 0 && (
            <div className="rs-section">
              <div className="rs-section-title">📈 خطة التحسين</div>
              {result.improvement_plan.map((p, i) => (
                <div key={i} className="rs-plan">
                  <span className="rs-plan-phase">{p.phase}</span>
                  <span className="rs-plan-action">{p.action}</span>
                </div>
              ))}
            </div>
          )}

          {result.required_documents && result.required_documents.length > 0 && (
            <div className="rs-section">
              <div className="rs-section-title">📄 المستندات المطلوبة</div>
              {result.required_documents.map((d, i) => (
                <div key={i} className="rs-doc">
                  <span className="rs-doc-icon">✓</span>
                  <span>{d}</span>
                </div>
              ))}
            </div>
          )}

          <div className="rs-cta">
            {requested ? (
              <div className="rs-done">
                ✓ تم استلام طلبك. فريق Murdi يراجع ملفك وسيتواصل معك قريباً.
              </div>
            ) : (
              <>
                <div className="rs-cta-title">جاهز للخطوة التالية؟</div>
                <div className="rs-cta-sub">اطلب مراجعة ملفك من فريق Murdi لتجهيزه والوصول للجهات المناسبة.</div>
                <button className="rs-cta-btn" disabled={requesting} onClick={requestReview}>
                  {requesting ? 'جاري الإرسال...' : 'اطلب مراجعة الملف'}
                </button>
              </>
            )}
          </div>

          <p className="rs-note">
            نتائج Murdi تمثل مؤشرات جاهزية مبدئية فقط، ولا تعني الموافقة النهائية من أي جهة تمويل.
          </p>
        </div>
      </div>
    </>
  )
}
