'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const C = { navy:'#0B1C3D', gold:'#C8A84B', goldLight:'#F5C842' }

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
          <div style={{marginTop:20,fontSize:18,fontWeight:700,color:'#fff'}}>تسجيل الدخول</div>
        </div>
        <input placeholder="البريد الإلكتروني" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={onKeyDown} type="email"
          style={{width:'100%',padding:'14px 16px',marginBottom:12,borderRadius:8,border:'1px solid #1E3A6E',background:C.navy,color:'#fff',fontSize:15,boxSizing:'border-box'}} />
        <input placeholder="كلمة المرور" type="password" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={onKeyDown}
          style={{width:'100%',padding:'14px 16px',marginBottom:20,borderRadius:8,border:'1px solid #1E3A6E',background:C.navy,color:'#fff',fontSize:15,boxSizing:'border-box'}} />
        <button onClick={handleLogin} disabled={loading}
          style={{width:'100%',padding:'14px',borderRadius:8,border:'none',background:`linear-gradient(135deg,${C.goldLight},#E6A800)`,color:C.navy,fontSize:16,fontWeight:800,cursor:loading?'default':'pointer',opacity:loading?0.7:1}}>
          {loading ? 'جارٍ الدخول...' : 'دخول'}
        </button>
        {message && <p style={{color:'#ff6b6b',textAlign:'center',marginTop:12,fontSize:14,lineHeight:1.6}}>{message}</p>}
        <p style={{textAlign:'center',marginTop:16,color:'#8899BB',fontSize:14}}>
          <span onClick={()=>router.push('/auth/reset')} style={{color:'#8899BB',cursor:'pointer',fontSize:13}}>نسيت كلمة المرور؟</span>
          <br/><br/>
          ما عندك حساب؟ <span onClick={()=>router.push('/auth/signup')} style={{color:C.goldLight,cursor:'pointer',fontWeight:700}}>سجّل الآن</span>
        </p>
      </div>
    </div>
  )
}
