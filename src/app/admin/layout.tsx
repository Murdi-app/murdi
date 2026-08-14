'use client'
import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

const ADMIN_EMAIL = 'hololalmurdi.fs@gmail.com'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<'loading' | 'ok' | 'no'>('loading')
  useEffect(() => {
    const sb = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
    )
    sb.auth.getUser()
      .then(({ data }) => setState(data?.user?.email === ADMIN_EMAIL ? 'ok' : 'no'))
      .catch(() => setState('no'))
  }, [])
  if (state === 'loading') return (
    <div dir="rtl" style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Tajawal, sans-serif', color:'#6B8A80' }}>جارٍ التحقق…</div>
  )
  if (state === 'no') return (
    <div dir="rtl" style={{ minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:14, fontFamily:'Tajawal, sans-serif', color:'#1A3D34' }}>
      <div style={{ fontSize:20, fontWeight:900 }}>هذه الصفحة للإدارة فقط</div>
      <a href="/auth/login" style={{ background:'#1A3D34', color:'#fff', padding:'12px 28px', borderRadius:2, textDecoration:'none', fontWeight:700 }}>تسجيل الدخول</a>
    </div>
  )
  return <>{children}</>
}
