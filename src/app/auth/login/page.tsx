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

  const handleLogin = async () => {
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setMessage(error.message); setLoading(false); return }
    router.push('/dashboard')
    setLoading(false)
  }

  return (
    <div style={{minHeight:'100vh',background:'#0B1C3D',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'system-ui'}}>
      <div style={{background:'#112244',borderRadius:16,padding:'48px 40px',width:'100%',maxWidth:420,boxShadow:'0 8px 40px rgba(0,0,0,0.4)'}}>
        <div style={{textAlign:'center',marginBottom:32}}>
          <div style={{fontSize:28,fontWeight:900,color:'#F5C842',letterSpacing:2,marginBottom:8}}>MURDI</div>
          <div style={{fontSize:13,color:'#8899BB',letterSpacing:1}}>CONSTRUCTION INTELLIGENCE</div>
          <div style={{marginTop:20,fontSize:18,fontWeight:700,color:'#fff'}}>تسجيل الدخول</div>
        </div>
        <input placeholder="البريد الإلكتروني" value={email} onChange={e=>setEmail(e.target.value)}
          style={{width:'100%',padding:'14px 16px',marginBottom:12,borderRadius:8,border:'1px solid #1E3A6E',background:'#0B1C3D',color:'#fff',fontSize:15,boxSizing:'border-box'}} />
        <input placeholder="كلمة المرور" type="password" value={password} onChange={e=>setPassword(e.target.value)}
          style={{width:'100%',padding:'14px 16px',marginBottom:20,borderRadius:8,border:'1px solid #1E3A6E',background:'#0B1C3D',color:'#fff',fontSize:15,boxSizing:'border-box'}} />
        <button onClick={handleLogin} disabled={loading}
          style={{width:'100%',padding:'14px',borderRadius:8,border:'none',background:'linear-gradient(135deg,#F5C842,#E6A800)',color:'#0B1C3D',fontSize:16,fontWeight:800,cursor:'pointer'}}>
          {loading ? '...' : 'دخول'}
        </button>
        {message && <p style={{color:'#ff6b6b',textAlign:'center',marginTop:12,fontSize:14}}>{message}</p>}
        <p style={{textAlign:'center',marginTop:16,color:'#8899BB',fontSize:14}}>
          ما عندك حساب؟ <span onClick={()=>router.push('/auth/signup')} style={{color:'#F5C842',cursor:'pointer'}}>سجّل الآن</span>
        </p>
      </div>
    </div>
  )
}
