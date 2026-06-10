'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const C = { navy:'#0B1C3D', gold:'#C8A84B', goldLight:'#F5C842' }

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
    // تحقق من المدخلات
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
    <div style={{minHeight:'100vh',background:C.navy,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'system-ui',direction:'rtl',padding:20}}>
      <div style={{background:'#112244',borderRadius:16,padding:'48px 40px',width:'100%',maxWidth:420,boxShadow:'0 8px 40px rgba(0,0,0,0.4)'}}>
        <div style={{textAlign:'center',marginBottom:32}}>
          <div style={{width:56,height:56,borderRadius:14,background:`linear-gradient(135deg,${C.gold},${C.goldLight})`,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 14px',boxShadow:`0 4px 16px rgba(200,168,75,0.4)`}}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <path d="M3 16.5 L8 11 L12 14 L20 5.5" stroke={C.navy} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M15 5.5 L20 5.5 L20 10.5" stroke={C.navy} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="3" cy="16.5" r="1.6" fill={C.navy}/>
            </svg>
          </div>
          <div style={{fontSize:26,fontWeight:900,color:C.goldLight,letterSpacing:2}}>MURDI</div>
          <div style={{fontSize:12,color:'#8899BB',letterSpacing:1,marginTop:4}}>مستشارك المالي الذكي</div>
          <div style={{marginTop:20,fontSize:18,fontWeight:700,color:'#fff'}}>إنشاء حساب جديد</div>
        </div>
        <input placeholder="اسم الشركة" value={company} onChange={e=>setCompany(e.target.value)} onKeyDown={onKeyDown}
          style={{width:'100%',padding:'14px 16px',marginBottom:12,borderRadius:8,border:'1px solid #1E3A6E',background:C.navy,color:'#fff',fontSize:15,boxSizing:'border-box'}} />
        <input placeholder="البريد الإلكتروني" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={onKeyDown} type="email"
          style={{width:'100%',padding:'14px 16px',marginBottom:12,borderRadius:8,border:'1px solid #1E3A6E',background:C.navy,color:'#fff',fontSize:15,boxSizing:'border-box'}} />
        <input placeholder="كلمة المرور (6 أحرف على الأقل)" type="password" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={onKeyDown}
          style={{width:'100%',padding:'14px 16px',marginBottom:20,borderRadius:8,border:'1px solid #1E3A6E',background:C.navy,color:'#fff',fontSize:15,boxSizing:'border-box'}} />
        <button onClick={handleSignUp} disabled={loading}
          style={{width:'100%',padding:'14px',borderRadius:8,border:'none',background:`linear-gradient(135deg,${C.goldLight},#E6A800)`,color:C.navy,fontSize:16,fontWeight:800,cursor:loading?'default':'pointer',opacity:loading?0.7:1}}>
          {loading ? 'جارٍ إنشاء حسابك...' : 'تسجيل'}
        </button>
        {message && <p style={{color:'#ff6b6b',textAlign:'center',marginTop:12,fontSize:14,lineHeight:1.6}}>{message}</p>}
        <p style={{textAlign:'center',marginTop:16,color:'#8899BB',fontSize:14}}>
          عندك حساب؟ <span onClick={()=>router.push('/auth/login')} style={{color:C.goldLight,cursor:'pointer',fontWeight:700}}>تسجيل دخول</span>
        </p>
      </div>
    </div>
  )
}
