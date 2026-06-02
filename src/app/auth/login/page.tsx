'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setMessage(error.message); return }
    router.push('/dashboard')
  }

  return (
    <div style={{maxWidth:'400px',margin:'100px auto',padding:'20px'}}>
      <h1>تسجيل الدخول</h1>
      <input placeholder="البريد الإلكتروني" value={email} onChange={e=>setEmail(e.target.value)} style={{width:'100%',padding:'10px',marginBottom:'10px'}} />
      <input placeholder="كلمة المرور" type="password" value={password} onChange={e=>setPassword(e.target.value)} style={{width:'100%',padding:'10px',marginBottom:'10px'}} />
      <button onClick={handleLogin} style={{width:'100%',padding:'10px',background:'#000',color:'#fff'}}>دخول</button>
      <p>{message}</p>
    </div>
  )
}
