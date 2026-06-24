'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const translateError = (msg: string) => {
    const m = msg.toLowerCase()
    if (m.includes('invalid login') || m.includes('invalid credentials')) return 'البريد أو كلمة المرور غير صحيحة'
    if (m.includes('email not confirmed')) return 'لم يتم تأكيد بريدك بعد — تحقّق من رسالة التفعيل في إيميلك'
    if (m.includes('network') || m.includes('fetch')) return 'تعذّر الاتصال — تحقّق من الإنترنت وحاول مجدداً'
    return 'تعذّر تسجيل الدخول — تحقّق من بياناتك وحاول مجدداً'
  }

  const handleLogin = async () => {
    setMessage('')
    if (!email.trim() || !email.includes('@')) { setMessage('اكتب بريدك الإلكتروني'); return }
    if (!password) { setMessage('اكتب كلمة المرور'); return }

    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setMessage(translateError(error.message)); setLoading(false); return }
    const { data: { user: u } } = await supabase.auth.getUser()
    const { data: co } = await supabase.from('companies').select('account_status').eq('user_id', u?.id).maybeSingle()
    if (!co) { router.push('/register'); return }
    if (co.account_status === 'active') { router.push('/goal'); return }
    router.push('/pending')
    setLoading(false)
  }

  const onKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !loading) handleLogin() }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Cairo:wght@300;400;600;700;900&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; }
        .lg-wrap { min-height:100vh; background:#FBFCFB; display:flex; align-items:center; justify-content:center; font-family:'Cairo',sans-serif; direction:rtl; padding:20px; }
        .lg-card { background:#fff; border:1.5px solid #EAF1EE; border-radius:24px; padding:48px 40px; width:100%; max-width:430px; box-shadow:0 10px 36px rgba(26,61,52,0.08); }
        .lg-logo-box { width:58px; height:58px; border-radius:16px; background:linear-gradient(135deg,#2E9E7B,#7DD3B0); display:flex; align-items:center; justify-content:center; margin:0 auto 14px; box-shadow:0 6px 18px rgba(46,158,123,0.3); }
        .lg-brand { font-family:'Amiri',serif; font-size:27px; font-weight:700; color:#2E9E7B; text-align:center; }
        .lg-tag { font-size:12.5px; color:#6B8A80; text-align:center; margin-top:4px; }
        .lg-card { text-align:center; }
        .lg-title { margin-top:22px; font-size:18px; font-weight:900; color:#1A3D34; text-align:center; margin-bottom:26px; }
        .lg-input { width:100%; padding:14px 16px; margin-bottom:13px; border-radius:12px; border:1.5px solid #EAF1EE; background:#FBFCFB; color:#1A3D34; font-size:15px; font-family:'Cairo',sans-serif; outline:none; direction:rtl; text-align:right; }
        .lg-input:focus { border-color:#2E9E7B; background:#fff; }
        .lg-btn { width:100%; padding:15px; border-radius:40px; border:none; background:linear-gradient(135deg,#2E9E7B,#7DD3B0); color:#fff; font-size:16px; font-weight:900; font-family:'Cairo',sans-serif; cursor:pointer; box-shadow:0 8px 22px rgba(46,158,123,0.28); margin-top:6px; }
        .lg-btn:disabled { opacity:0.6; cursor:default; }
        .lg-err { color:#C0564B; text-align:center; margin-top:13px; font-size:14px; line-height:1.6; font-weight:600; }
        .lg-links { text-align:center; margin-top:18px; color:#6B8A80; font-size:14px; line-height:2.2; }
        .lg-link { color:#6B8A80; cursor:pointer; font-size:13px; }
        .lg-signup { color:#2E9E7B; cursor:pointer; font-weight:900; }
        .lg-trust { display:inline-block; margin:8px auto 0; background:#E8F5EF; color:#2E9E7B; padding:5px 16px; border-radius:20px; font-size:11.5px; font-weight:800; text-align:center; }
        .lg-home { text-align:center; margin-top:16px; color:#9DB3AB; font-size:13px; cursor:pointer; }
        .lg-home:hover { color:#2E9E7B; }
      `}</style>
      <div className="lg-wrap">
        <div className="lg-card">
          <div className="lg-logo-box">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <path d="M3 16.5 L8 11 L12 14 L20 5.5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M15 5.5 L20 5.5 L20 10.5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="3" cy="16.5" r="1.6" fill="#fff"/>
            </svg>
          </div>
          <div className="lg-brand">مُرضي Murdi</div>
          <div className="lg-tag">منصة جاهزية رأس المال</div>
          <div className="lg-trust">🛡️ شركة سعودية</div>
          <div className="lg-title">تسجيل الدخول</div>

          <input className="lg-input" placeholder="البريد الإلكتروني" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={onKeyDown} type="email" />
          <input className="lg-input" placeholder="كلمة المرور" type="password" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={onKeyDown} />

          <button className="lg-btn" onClick={handleLogin} disabled={loading}>
            {loading ? 'جارٍ الدخول...' : 'دخول'}
          </button>

          {message && <p className="lg-err">{message}</p>}

          <p className="lg-links">
            <span className="lg-link" onClick={()=>router.push('/auth/reset')}>نسيت كلمة المرور؟</span>
            <br/>
            ما عندك حساب؟ <span className="lg-signup" onClick={()=>router.push('/auth/signup')}>سجّل الآن</span>
          </p>
          <p className="lg-home" onClick={()=>router.push('/')}>← الرجوع للصفحة الرئيسية</p>
        </div>
      </div>
    </>
  )
}
