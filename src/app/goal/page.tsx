'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'

type Goal = 'funding' | 'investment' | 'ipo'

interface GoalOption {
  id: Goal
  title: string
  subtitle: string
  desc: string
  icon: JSX.Element
}

const GOALS: GoalOption[] = [
  {
    id: 'funding',
    title: 'أريد تمويلاً',
    subtitle: 'FUNDING READINESS',
    desc: 'اعرف مدى جاهزية شركتك للحصول على تمويل، وما الذي يمنعها، وكيف تتأهل.',
    icon: (
      <svg width="32" height="32" viewBox="0 0 34 34" fill="none">
        <rect x="4" y="9" width="26" height="18" rx="2.5" stroke="#fff" strokeWidth="2.2"/>
        <circle cx="17" cy="18" r="4" stroke="#fff" strokeWidth="2.2"/>
        <line x1="9" y1="13.5" x2="9" y2="13.5" stroke="#fff" strokeWidth="3" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: 'investment',
    title: 'أريد مستثمراً',
    subtitle: 'INVESTMENT READINESS',
    desc: 'اعرف مدى جاذبية شركتك للمستثمرين، ونقاط القوة والضعف قبل العرض.',
    icon: (
      <svg width="32" height="32" viewBox="0 0 34 34" fill="none">
        <polyline points="5,24 13,15 19,20 29,8" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
        <polyline points="23,8 29,8 29,14" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    id: 'ipo',
    title: 'أريد تجهيز الشركة للطرح',
    subtitle: 'IPO READINESS',
    desc: 'اعرف موقع شركتك على طريق الطرح، وخارطة الطريق للوصول للجاهزية.',
    icon: (
      <svg width="32" height="32" viewBox="0 0 34 34" fill="none">
        <path d="M17 4 L17 30 M17 4 L11 11 M17 4 L23 11" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
        <line x1="8" y1="30" x2="26" y2="30" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"/>
      </svg>
    ),
  },
]

export default function GoalSelectionPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState<Goal | null>(null)
  const [companyName, setCompanyName] = useState('')

  useEffect(() => { checkAccess() }, [])

  async function checkAccess() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }

    const { data: company } = await supabase
      .from('companies')
      .select('account_status, company_name, goal')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!company || company.account_status !== 'active') {
      router.push('/pending')
      return
    }
    if (company.company_name) setCompanyName(company.company_name)
    if (company.goal) setSelected(company.goal as Goal)
    setLoading(false)
  }

  async function confirmGoal() {
    if (!selected) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase
      .from('companies')
      .update({ goal: selected })
      .eq('user_id', user.id)
    setSaving(false)
    if (error) { alert('حدث خطأ، حاول مرة أخرى'); return }
    router.push(`/assessment/${selected}`)
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', background:'#FBFCFB', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ color:'#2E9E7B', fontFamily:'Cairo,sans-serif', fontSize:18 }}>جاري التحميل...</div>
    </div>
  )

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Cairo:wght@300;400;600;700&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; }
        .gs-wrapper { min-height:100vh; background:#FBFCFB; display:flex; flex-direction:column; align-items:center; padding:56px 16px; font-family:'Cairo',sans-serif; direction:rtl; }
        .gs-logo-row { display:flex; align-items:center; gap:12px; margin-bottom:8px; }
        .gs-logo-icon { width:46px; height:46px; background:linear-gradient(135deg,#2E9E7B,#7DD3B0); border-radius:50%; display:flex; align-items:center; justify-content:center; box-shadow:0 8px 24px rgba(46,158,123,0.25); }
        .gs-logo-text { font-family:'Amiri',serif; font-size:30px; color:#1A3D34; letter-spacing:1px; }
        .gs-heading { font-family:'Amiri',serif; font-size:34px; color:#1A3D34; text-align:center; margin-top:32px; margin-bottom:10px; font-weight:700; }
        .gs-sub { color:#6B8A80; font-size:15.5px; text-align:center; margin-bottom:6px; }
        .gs-company { display:inline-block; color:#2E9E7B; font-size:13px; background:#E8F5EF; padding:5px 18px; border-radius:30px; margin-bottom:44px; font-weight:600; }
        .gs-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(290px,1fr)); gap:22px; max-width:960px; width:100%; }
        .gs-card { background:#FFFFFF; border:1.5px solid #EAF1EE; border-radius:18px; padding:34px 28px; cursor:pointer; transition:all .28s cubic-bezier(.4,0,.2,1); position:relative; text-align:center; box-shadow:0 2px 10px rgba(26,61,52,0.04); }
        .gs-card:hover { border-color:#7DD3B0; transform:translateY(-5px); box-shadow:0 18px 44px rgba(46,158,123,0.14); }
        .gs-card.selected { border-color:#2E9E7B; box-shadow:0 0 0 3px rgba(125,211,176,0.35), 0 18px 44px rgba(46,158,123,0.16); }
        .gs-icon-circle { width:68px; height:68px; background:linear-gradient(135deg,#2E9E7B,#7DD3B0); border-radius:20px; display:flex; align-items:center; justify-content:center; margin:0 auto 20px; box-shadow:0 10px 24px rgba(46,158,123,0.28); }
        .gs-card-title { font-family:'Amiri',serif; font-size:22px; color:#1A3D34; margin-bottom:5px; font-weight:700; }
        .gs-card-sub { font-size:10.5px; color:#A3BAB2; letter-spacing:2px; margin-bottom:16px; font-weight:600; }
        .gs-card-desc { font-size:14px; color:#6B8A80; line-height:1.8; }
        .gs-check { position:absolute; top:16px; left:16px; width:26px; height:26px; border-radius:50%; background:#2E9E7B; color:#fff; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:15px; box-shadow:0 4px 12px rgba(46,158,123,0.4); }
        .gs-confirm { margin-top:46px; background:linear-gradient(135deg,#2E9E7B,#7DD3B0); color:#fff; border:none; padding:16px 64px; border-radius:40px; font-family:'Cairo',sans-serif; font-size:16px; font-weight:700; cursor:pointer; transition:all .2s; box-shadow:0 10px 28px rgba(46,158,123,0.3); }
        .gs-confirm:hover:not(:disabled) { transform:translateY(-2px); box-shadow:0 14px 34px rgba(46,158,123,0.4); }
        .gs-confirm:disabled { opacity:0.35; cursor:not-allowed; box-shadow:none; }
        .gs-note { color:#A3BAB2; font-size:12px; margin-top:22px; text-align:center; max-width:540px; line-height:1.8; }
      `}</style>
      <div className="gs-wrapper">
        <div className="gs-logo-row">
          <div className="gs-logo-icon">
            <svg width="25" height="25" viewBox="0 0 26 26" fill="none">
              <polyline points="3,18 8,11 13,14 18,7 23,10" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="23" cy="10" r="2.5" fill="#fff"/>
              <line x1="3" y1="21" x2="23" y2="21" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </div>
          <span className="gs-logo-text">Murdi</span>
        </div>

        <h1 className="gs-heading">ما هدف شركتك القادم؟</h1>
        <p className="gs-sub">اختر هدفك، وسنوجّه التحليل والتقييم بناءً عليه</p>
        {companyName && <span className="gs-company">{companyName}</span>}

        <div className="gs-grid">
          {GOALS.map(g => (
            <div
              key={g.id}
              className={`gs-card${selected === g.id ? ' selected' : ''}`}
              onClick={() => setSelected(g.id)}
            >
              {selected === g.id && <div className="gs-check">✓</div>}
              <div className="gs-icon-circle">{g.icon}</div>
              <div className="gs-card-title">{g.title}</div>
              <div className="gs-card-sub">{g.subtitle}</div>
              <div className="gs-card-desc">{g.desc}</div>
            </div>
          ))}
        </div>

        <button className="gs-confirm" disabled={!selected || saving} onClick={confirmGoal}>
          {saving ? 'جاري الحفظ...' : 'ابدأ التقييم'}
        </button>

        <p className="gs-note">
          نتائج Murdi تمثل مؤشرات جاهزية مبدئية فقط، ولا تعني الموافقة النهائية من أي جهة تمويل أو استثمار.
        </p>
      </div>
    </>
  )
}