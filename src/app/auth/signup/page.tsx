'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function SignUp() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [company, setCompany] = useState('')
  const [message, setMessage] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const handleSignUp = async () => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { company_name: company } }
    })
    if (error) { setMessage(error.message); return }
    setMessage('تم التسجيل! تحقق من بريدك الإلكتروني')
  }

  return (
    <div style={{maxWidth:'400px',margin:'100px auto',padding:'20px'}}>
      <h1>إنشاء حساب في Murdi</h1>
      <input placeholder="اسم الشركة" value={company} onChange={e=>setCompany(e.target.value)} style={{width:'100%',padding:'10px',marginBottom:'10px'}} />
      <input placeholder="البريد الإلكتروني" value={email} onChange={e=>setEmail(e.target.value)} style={{width:'100%',padding:'10px',marginBottom:'10px'}} />
      <input placeholder="كلمة المرور" type="password" value={password} onChange={e=>setPassword(e.target.value)} style={{width:'100%',padding:'10px',marginBottom:'10px'}} />
      <button onClick={handleSignUp} style={{width:'100%',padding:'10px',background:'#000',color:'#fff'}}>تسجيل</button>
      <p>{message}</p>
    </div>
  )
}
