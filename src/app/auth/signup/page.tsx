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
    if (m.includes('already registered') || m.includes('already been registered')) return 'هذا البريد مسجل مسبقاً — جرّب تسجيل الدخول'
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
        .au-back{display:block;margin-top:8px;color:#9DB3AB;font-size:12.5px;text-decoration:none}
        .au-ft{text-align:center;color:#9DB3AB;font-size:11.5px;padding:18px;line-height:1.9}
        @media (prefers-reduced-motion:reduce){*{transition:none!important}}
      `}</style>
      <div className="au">
        <div className="au-top"><b>حلول المرضي للاستشارات المالية</b> · رخصة استشارة FL-457927015</div>
        <div className="au-mid">
          <div className="au-card">
            <div className="au-brand">مُرضي<i>MURDI</i></div>
            <div className="au-rule" />
            <div className="au-title">افتح ملف شركتك</div>
            <div className="au-lead">التقييم مجاني — تعرف درجتك وعوائقك قبل أن تدفع ريالاً.</div>

            <div className="au-label">اسم الشركة</div>
            <input className="au-input" placeholder="كما في السجل التجاري" value={company} onChange={e=>setCompany(e.target.value)} onKeyDown={onKeyDown} />
            <div className="au-label">البريد الإلكتروني</div>
            <input className="au-input" placeholder="name@company.com" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={onKeyDown} type="email" />
            <div className="au-label">كلمة المرور</div>
            <input className="au-input" placeholder="6 أحرف على الأقل" type="password" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={onKeyDown} />

            <button className="au-btn" onClick={handleSignUp} disabled={loading}>
              {loading ? 'جارٍ إنشاء حسابك…' : 'أنشئ الحساب'}
            </button>

            {message && <p className="au-err">{message}</p>}

            <p className="au-links">
              عندك حساب؟ <b onClick={()=>router.push('/auth/login')}>تسجيل الدخول</b>
              <a className="au-back" href="/">الرجوع للصفحة الرئيسية</a>
            </p>
          </div>
        </div>
        <div className="au-ft">منصة استشارية لقياس وتجهيز الجاهزية — لا نمنح تمويلاً ولا نضمن نتيجة</div>
      </div>
    </>
  )
}
