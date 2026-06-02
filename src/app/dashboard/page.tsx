'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function Dashboard() {
  const [user, setUser] = useState<any>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      setUser(user)
    }
    getUser()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  if (!user) return <p>جاري التحميل...</p>

  return (
    <div style={{maxWidth:'800px',margin:'50px auto',padding:'20px'}}>
      <h1>مرحباً في Murdi 🚀</h1>
      <p>البريد: {user.email}</p>
      <p>الشركة: {user.user_metadata?.company_name}</p>
      <button onClick={handleLogout} style={{padding:'10px 20px',background:'#000',color:'#fff'}}>تسجيل الخروج</button>
    </div>
  )
}
