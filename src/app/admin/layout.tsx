'use client'
import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

const ADMIN_EMAIL = 'hololalmurdi.fs@gmail.com'
const MAX_SESSION_MS = 12 * 60 * 60 * 1000

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<'loading' | 'ok' | 'no'>('loading')
  useEffect(() => {
    const sb = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
    )
    sb.auth.getUser()
      .then(({ data }) => {
        const u = data?.user
        const t = Date.parse(String(u?.last_sign_in_at || ''))
        const fresh = !!t && Date.now() - t < MAX_SESSION_MS
        if (u?.email === ADMIN_EMAIL && fresh) { setState('ok'); return }
        if (u && !fresh) { sb.auth.signOut().catch(() => {}) }
        setState('no')
      })
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
