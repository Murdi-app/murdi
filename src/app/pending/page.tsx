'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'

type Status = 'pending_payment' | 'pending_approval' | 'active' | 'rejected' | 'suspended' | 'expired' | 'none'

export default function PendingPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<Status>('none')
  const [companyName, setCompanyName] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }

    const { data: company } = await supabase
      .from('companies')
      .select('account_status, company_name')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!company) {
      setStatus('none')
    } else {
      setStatus(company.account_status as Status)
      if (company.company_name) setCompanyName(company.company_name)
      if (company.account_status === 'active') { router.push('/goal'); return }
    }
    setLoading(false)
  }

  const content: Record<Status, { icon: string; title: string; msg: string }> = {
    none: { icon: '📋', title: 'لم تسجّل شركتك بعد', msg: 'ابدأ بتسجيل شركتك ودفع رسوم فتح الملف لتفعيل حسابك.' },
    pending_payment: { icon: '💳', title: 'بانتظار الدفع', msg: 'أكمل دفع رسوم فتح الملف ليتم مراجعة طلبك.' },
    pending_approval: { icon: '⏳', title: 'طلبك قيد المراجعة', msg: 'استلمنا طلبك ودفعتك. فريق Murdi يراجع بياناتك، وسنفعّل حسابك قريباً.' },
    active: { icon: '✓', title: 'حسابك مفعّل', msg: 'جارٍ تحويلك...' },
    rejected: { icon: '✕', title: 'لم يُقبل الطلب', msg: 'لم نتمكن من قبول طلبك حالياً. تواصل معنا للمزيد.' },
    suspended: { icon: '⏸', title: 'الحساب موقوف', msg: 'حسابك موقوف مؤقتاً. تواصل مع فريق Murdi.' },
    expired: { icon: '⌛', title: 'انتهى الاشتراك', msg: 'انتهت صلاحية اشتراكك. جدّد للمتابعة.' },
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', background:'#FBFCFB', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ color:'#2E9E7B', fontFamily:'Cairo,sans-serif', fontSize:18 }}>جاري التحميل...</div>
    </div>
  )

  const c = content[status]

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Cairo:wght@300;400;600;700&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; }
        .pd-wrapper { min-height:100vh; background:#FBFCFB; display:flex; align-items:center; justify-content:center; padding:24px; font-family:'Cairo',sans-serif; direction:rtl; }
        .pd-card { background:#fff; border:1.5px solid #EAF1EE; border-radius:24px; padding:48px 40px; max-width:480px; width:100%; text-align:center; box-shadow:0 8px 40px rgba(26,61,52,0.07); }
        .pd-icon { width:80px; height:80px; background:linear-gradient(135deg,#2E9E7B,#7DD3B0); border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:36px; margin:0 auto 24px; box-shadow:0 10px 28px rgba(46,158,123,0.28); }
        .pd-logo { font-family:'Amiri',serif; font-size:26px; color:#1A3D34; margin-bottom:6px; }
        .pd-company { color:#2E9E7B; font-size:13px; background:#E8F5EF; display:inline-block; padding:5px 18px; border-radius:30px; font-weight:600; margin-bottom:28px; }
        .pd-title { font-family:'Amiri',serif; font-size:23px; color:#1A3D34; font-weight:700; margin-bottom:12px; }
        .pd-msg { color:#6B8A80; font-size:15px; line-height:1.8; margin-bottom:28px; }
        .pd-btn { background:linear-gradient(135deg,#2E9E7B,#7DD3B0); color:#fff; border:none; padding:14px 40px; border-radius:40px; font-family:'Cairo',sans-serif; font-size:15px; font-weight:700; cursor:pointer; box-shadow:0 8px 22px rgba(46,158,123,0.28); }
        .pd-logout { background:transparent; color:#A3BAB2; border:none; font-family:'Cairo',sans-serif; font-size:13px; cursor:pointer; margin-top:16px; display:block; width:100%; }
      `}</style>
      <div className="pd-wrapper">
        <div className="pd-card">
          <div className="pd-logo">Murdi</div>
          {companyName && <span className="pd-company">{companyName}</span>}
          <div className="pd-icon">{c.icon}</div>
          <div className="pd-title">{c.title}</div>
          <div className="pd-msg">{c.msg}</div>
          <button className="pd-logout" onClick={async () => { await supabase.auth.signOut(); router.push('/auth/login') }}>تسجيل الخروج</button>
        </div>
      </div>
    </>
  )
}
