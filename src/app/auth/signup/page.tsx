'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function SignUp() {
  const [company, setCompany] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const translateError = (msg: string) => {
    const m = msg.toLowerCase()
    if (m.includes('already registered') || m.includes('already been registered')) return 'هذا البريد مسجّل مسبقاً — جرّب تسجيل الدخول'
    if (m.includes('valid email') || m.includes('invalid')) return 'صيغة البريد الإلكتروني غير صحيحة'
    if (m.includes('password') && m.includes('6')) return 'كلمة المرور قصيرة — يجب ألا تقل عن 6 أحرف'
    if (m.includes('password')) return 'كلمة المرور غير مقبولة — اختر كلمة أقوى'
    if (m.includes('network') || m.includes('fetch')) return 'تعذر الاتصال — تحقّق من الإنترنت وحاول مجدداً'
    return 'تعذّر إنشاء الحساب — حاول مرة أخرى أو تواصل معنا'
  }

  const handleSignUp = async () => {
    setMessage('')
    if (!company.trim()) { setMessage('اكتب اسم شركتك'); return }
    if (!email.trim() || !email.includes('@')) { setMessage('اكتب بريدا إلكترونياً صحيحاً'); return }
    if (password.length < 6) { setMessage('كلمة المرور يجب ألا تقل عن 6 أحرف'); return }

    setLoading(true)
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) { setMessage(translateError(error.message)); setLoading(false); return }
    const user = data.user
    if (user) {
      await supabase.from('profiles').insert({ id: user.id, email, company_name: company })
      router.push('/register')
    }
    setLoading(false)
  }

  const onKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !loading) handleSignUp() }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Cairo:wght@300;400;600;700;900&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; }
        .sg-wrap { min-height:100vh; background:#FBFCFB; display:flex; align-items:center; justify-content:center; font-family:'Cairo',sans-serif; direction:rtl; padding:20px; }
        .sg-card { background:#fff; border:1.5px solid #EAF1EE; border-radius:24px; padding:48px 40px; width:100%; max-width:430px; box-shadow:0 10px 36px rgba(26,61,52,0.08); }
        .sg-logo-box { width:58px; height:58px; border-radius:16px; background:linear-gradient(135deg,#2E9E7B,#7DD3B0); display:flex; align-items:center; justify-content:center; margin:0 auto 14px; box-shadow:0 6px 18px rgba(46,158,123,0.3); }
        .sg-brand { font-family:'Amiri',serif; font-size:27px; font-weight:700; color:#1A3D34; text-align:center; }
        .sg-tag { font-size:12.5px; color:#6B8A80; text-align:center; margin-top:4px; }
        .sg-title { margin-top:22px; font-size:18px; font-weight:900; color:#1A3D34; text-align:center; margin-bottom:26px; }
        .sg-input { width:100%; padding:14px 16px; margin-bottom:13px; border-radius:12px; border:1.5px solid #EAF1EE; background:#FBFCFB; color:#1A3D34; font-size:15px; font-family:'Cairo',sans-serif; outline:none; direction:rtl; text-align:right; }
        .sg-input:focus { border-color:#2E9E7B; background:#fff; }
        .sg-btn { width:100%; padding:15px; border-radius:40px; border:none; background:linear-gradient(135deg,#2E9E7B,#7DD3B0); color:#fff; font-size:16px; font-weight:900; font-family:'Cairo',sans-serif; cursor:pointer; box-shadow:0 8px 22px rgba(46,158,123,0.28); margin-top:6px; }
        .sg-btn:disabled { opacity:0.6; cursor:default; }
        .sg-err { color:#C0564B; text-align:center; margin-top:13px; font-size:14px; line-height:1.6; font-weight:600; }
        .sg-links { text-align:center; margin-top:18px; color:#6B8A80; font-size:14px; }
        .sg-login { color:#2E9E7B; cursor:pointer; font-weight:900; }
      `}</style>
      <div className="sg-wrap">
        <div className="sg-card">
          <div className="sg-logo-box">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <path d="M3 16.5 L8 11 L12 14 L20 5.5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M15 5.5 L20 5.5 L20 10.5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="3" cy="16.5" r="1.6" fill="#fff"/>
            </svg>
          </div>
          <div className="sg-brand">مُرضي Murdi</div>
          <div className="sg-tag">منصة جاهزية رأس المال</div>
          <div className="sg-title">إنشاء حساب جديد</div>

          <input className="sg-input" placeholder="اسم الشركة" value={company} onChange={e=>setCompany(e.target.value)} onKeyDown={onKeyDown} />
          <input className="sg-input" placeholder="البريد الإلكتروني" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={onKeyDown} type="email" />
          <input className="sg-input" placeholder="كلمة المرور (6 أحرف على الأقل)" type="password" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={onKeyDown} />

          <button className="sg-btn" onClick={handleSignUp} disabled={loading}>
            {loading ? 'جارٍ إنشاء حسابك...' : 'تسجيل'}
          </button>

          {message && <p className="sg-err">{message}</p>}

          <p className="sg-links">
            عندك حساب؟ <span className="sg-login" onClick={()=>router.push('/auth/login')}>تسجيل دخول</span>
          </p>
        </div>
      </div>
    </>
  )
}
