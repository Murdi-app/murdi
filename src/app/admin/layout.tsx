'use client'
import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { usePathname } from 'next/navigation'

const ADMIN_EMAIL = 'hololalmurdi.fs@gmail.com'
const MAX_SESSION_MS = 12 * 60 * 60 * 1000
// نطاق الموظفة: المتابعة وصيد العملاء ولوحة الصفقة ومراسلة العملاء.
// خرجت المخاطبة ولوحة التقديم — مراسلة جهات التمويل تُدار من مكان واحد
// حتى لا تصل الجهةَ رسالتان بخطّين مختلفين. أما العميل فيحتاج ردّاً في
// وقته، فمراسلته مفتوحة لها بقالبٍ لا يعد بشيء. والقائمة بيضاء عمداً:
// أي صفحة إدارة جديدة مغلقة على الموظفة حتى تُفتح صراحةً.
// و«المتابعة» أُضيفت لمن تلاحق مخاطبات الجهات: تسجّل ما وقع بالهاتف وتصنّف
// ما وصل من ردود — ولا تُرسل شيئاً. فالمخاطبة نفسها ما زالت في يدٍ واحدة.
const STAFF_PAGES = ['/admin/hot', '/admin/deal', '/admin/message', '/admin/followup', '/admin/hunt']

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<'loading' | 'ok' | 'staff' | 'no'>('loading')
  // دور الموظفة يقرّر شاشتها الأولى حين تُردّ عن صفحة ليست لها — لا بريدها
  const [job, setJob] = useState<'assistant' | 'followup'>('assistant')
  const pathname = usePathname()
  useEffect(() => {
    const sb = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
    )
    sb.auth.getUser()
      .then(async ({ data }) => {
        const u = data?.user
        const t = Date.parse(String(u?.last_sign_in_at || ''))
        const fresh = !!t && Date.now() - t < MAX_SESSION_MS
        if (!u || !fresh) { if (u) sb.auth.signOut().catch(() => {}); setState('no'); return }
        if (u.email === ADMIN_EMAIL) { setState('ok'); return }
        const { data: st } = await sb.from('staff').select('user_id, active, job').eq('user_id', u.id).maybeSingle()
        if (st && st.active === true) { setJob(st.job === 'followup' ? 'followup' : 'assistant'); setState('staff'); return }
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
  if (state === 'staff' || state === 'ok') {
    const bar = (
      <div dir="rtl" style={{ position:'sticky', top:0, zIndex:50, background:'#122C26', color:'#9FB6AE', fontFamily:'Tajawal, sans-serif', fontSize:12, padding:'6px 16px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <span>{state === 'staff' ? 'حساب موظف' : 'الإدارة'}</span>
        <button onClick={async () => { const sb = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string); await sb.auth.signOut().catch(() => {}); window.location.href = '/auth/login' }}
          style={{ background:'transparent', color:'#C9A84C', border:'1px solid #2E4A42', borderRadius:20, padding:'4px 14px', fontFamily:'Tajawal, sans-serif', fontWeight:700, fontSize:11.5, cursor:'pointer' }}>
          تسجيل الخروج
        </button>
      </div>
    )

    if (state === 'staff' && !STAFF_PAGES.some(p => (pathname || '').startsWith(p))) {
      // ويُردّ إلى شاشته هو لا إلى شاشةٍ واحدة للجميع
      const home = job === 'followup' ? '/admin/followup' : '/admin/hot'
      return (
        <>{bar}
          <div dir="rtl" style={{ minHeight:'70vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:14, fontFamily:'Tajawal, sans-serif', color:'#1A3D34' }}>
            <div style={{ fontSize:20, fontWeight:900 }}>هذه الصفحة للإدارة فقط</div>
            <a href={home} style={{ background:'#1A3D34', color:'#fff', padding:'12px 28px', borderRadius:2, textDecoration:'none', fontWeight:700 }}>
              {job === 'followup' ? 'اذهب إلى المتابعة' : 'اذهب إلى الفرص الساخنة'}
            </a>
          </div>
        </>
      )
    }
    return <>{bar}{children}</>
  }
  return <>{children}</>
}
