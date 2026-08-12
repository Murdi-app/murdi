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
    const st = String(co.account_status || '')
    if (st === 'rejected' || st === 'suspended') { router.push('/pending'); return }
    router.push('/goal')
    setLoading(false)
  }

  const onKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !loading) handleLogin() }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;900&family=IBM+Plex+Sans+Arabic:wght@300;400;500;600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        .au{min-height:100vh;background:#FFFFFF;font-family:'IBM Plex Sans Arabic',sans-serif;direction:rtl;color:#1A3D34;display:flex;flex-direction:column}
        .au-top{background:#122C26;color:#9FB6AE;font-size:11.5px;text-align:center;padding:8px 16px}
        .au-top b{color:#fff;font-weight:600}
        .au-mid{flex:1;display:flex;align-items:center;justify-content:center;padding:32px 18px}
        .au-card{width:100%;max-width:420px}
        .au-brand{font-family:'Tajawal';font-size:30px;font-weight:900;color:#1A3D34;text-align:center;letter-spacing:-.01em}
        .au-brand i{font-style:normal;font-size:12px;font-weight:500;color:#6B8A80;letter-spacing:.16em;display:block;margin-top:6px}
        .au-rule{width:34px;height:2px;background:#C9A84C;margin:18px auto 0}
        .au-title{font-family:'Tajawal';margin-top:26px;font-size:21px;font-weight:900;text-align:center;margin-bottom:6px}
        .au-lead{color:#6B8A80;font-size:13.5px;text-align:center;line-height:1.9;margin-bottom:24px}
        .au-label{font-size:12.5px;font-weight:600;color:#6B8A80;margin-bottom:6px}
        .au-input{width:100%;padding:14px 15px;margin-bottom:16px;border-radius:2px;border:1px solid #E3EAE7;background:#fff;color:#1A3D34;font-size:15px;font-family:'IBM Plex Sans Arabic';outline:none;text-align:right}
        .au-input:focus{border-color:#1A3D34}
        .au-btn{width:100%;padding:15px;border-radius:2px;border:none;background:#C9A84C;color:#122C26;font-size:16px;font-weight:900;font-family:'Tajawal';cursor:pointer;margin-top:4px;transition:.18s}
        .au-btn:hover{background:#D9BA63}
        .au-btn:disabled{opacity:.55;cursor:default}
        .au-err{color:#B4453C;text-align:center;margin-top:14px;font-size:13.5px;line-height:1.7;font-weight:600}
        .au-links{text-align:center;margin-top:20px;color:#6B8A80;font-size:13.5px;line-height:2.2}
        .au-links b{color:#1A3D34;cursor:pointer;font-weight:600;border-bottom:1px solid #C9A84C;padding-bottom:1px}
        .au-quiet{color:#6B8A80;cursor:pointer;font-size:13px;border-bottom:1px solid #E3EAE7;padding-bottom:1px}
        .au-back{display:block;margin-top:8px;color:#9DB3AB;font-size:12.5px;text-decoration:none;cursor:pointer}
        .au-ft{text-align:center;color:#9DB3AB;font-size:11.5px;padding:18px;line-height:1.9}
        @media (max-width:620px){.au-mid{align-items:flex-start;padding:26px 16px 12px}.au-brand{font-size:26px}.au-title{margin-top:20px;font-size:19px}}
        @media (prefers-reduced-motion:reduce){*{transition:none!important}}
      `}</style>
      <div className="au">
        <div className="au-top"><b>حلول المرضي للاستشارات المالية</b> · رخصة استشارة FL-457927015</div>
        <div className="au-mid">
          <div className="au-card">
            <div className="au-brand">مُرضي<i>MURDI</i></div>
            <div className="au-rule" />
            <div className="au-title">تسجيل الدخول</div>
            <div className="au-lead">ادخل إلى ملف شركتك ومتابعة جاهزيتك.</div>

            <div className="au-label">البريد الإلكتروني</div>
            <input className="au-input" placeholder="name@company.com" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={onKeyDown} type="email" />
            <div className="au-label">كلمة المرور</div>
            <input className="au-input" placeholder="" type="password" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={onKeyDown} />

            <button className="au-btn" onClick={handleLogin} disabled={loading}>
              {loading ? 'جارٍ الدخول…' : 'دخول'}
            </button>

            {message && <p className="au-err">{message}</p>}

            <p className="au-links">
              <span className="au-quiet" onClick={()=>router.push('/auth/reset')}>نسيت كلمة المرور؟</span>
              <br />
              ما عندك حساب؟ <b onClick={()=>router.push('/auth/signup')}>افتح ملف شركتك</b>
              <span className="au-back" onClick={()=>router.push('/')}>الرجوع للصفحة الرئيسية</span>
            </p>
          </div>
        </div>
        <div className="au-ft">منصة استشارية لقياس وتجهيز الجاهزية — لا نمنح تمويلاً ولا نضمن نتيجة</div>
      </div>
    </>
  )
}
