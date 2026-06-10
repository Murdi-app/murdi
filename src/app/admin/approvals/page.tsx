'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'

const ADMIN_EMAIL = 'hololalmurdi.fs@gmail.com'

interface Company {
  id: string
  company_name: string | null
  cr_number: string | null
  owner_name: string | null
  phone: string | null
  city: string | null
  sector: string | null
  goal: string | null
  account_status: string
  payment_status: string | null
  is_locked: boolean
  created_at: string
}

const STATUS_LABEL: Record<string, string> = {
  pending_payment: 'بانتظار الدفع',
  pending_approval: 'بانتظار المراجعة',
  active: 'مفعّل',
  rejected: 'مرفوض',
  suspended: 'موقوف',
  expired: 'منتهي',
}

export default function ApprovalsPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)
  const [companies, setCompanies] = useState<Company[]>([])
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }
    if (user.email !== ADMIN_EMAIL) { setAuthorized(false); setLoading(false); return }
    setAuthorized(true)
    await loadCompanies()
    setLoading(false)
  }

  async function loadCompanies() {
    const { data } = await supabase
      .from('companies')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) setCompanies(data as Company[])
  }

  async function approve(c: Company) {
    setBusy(c.id)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('companies').update({
      account_status: 'active',
      is_locked: true,
      locked_at: new Date().toISOString(),
      approved_by: user?.id,
      approved_at: new Date().toISOString(),
    }).eq('id', c.id)
    await loadCompanies()
    setBusy(null)
  }

  async function setStatus(c: Company, status: string) {
    setBusy(c.id)
    await supabase.from('companies').update({ account_status: status }).eq('id', c.id)
    await loadCompanies()
    setBusy(null)
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', background:'#FBFCFB', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ color:'#2E9E7B', fontFamily:'Cairo,sans-serif', fontSize:18 }}>جاري التحميل...</div>
    </div>
  )

  if (!authorized) return (
    <div style={{ minHeight:'100vh', background:'#FBFCFB', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:12, fontFamily:'Cairo,sans-serif' }}>
      <div style={{ fontSize:40 }}>🔒</div>
      <div style={{ color:'#1A3D34', fontSize:18, fontWeight:700 }}>غير مصرّح</div>
      <div style={{ color:'#6B8A80', fontSize:14 }}>هذه الصفحة مخصصة لإدارة Murdi فقط</div>
    </div>
  )

  const pending = companies.filter(c => c.account_status === 'pending_approval')
  const others = companies.filter(c => c.account_status !== 'pending_approval')

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Cairo:wght@300;400;600;700&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; }
        .ap-wrapper { min-height:100vh; background:#FBFCFB; padding:40px 16px; font-family:'Cairo',sans-serif; direction:rtl; }
        .ap-inner { max-width:920px; margin:0 auto; }
        .ap-head { font-family:'Amiri',serif; font-size:28px; color:#1A3D34; font-weight:700; margin-bottom:4px; }
        .ap-sub { color:#6B8A80; font-size:14px; margin-bottom:32px; }
        .ap-section-title { font-size:15px; color:#1A3D34; font-weight:700; margin:28px 0 14px; display:flex; align-items:center; gap:8px; }
        .ap-count { background:#2E9E7B; color:#fff; font-size:12px; padding:2px 10px; border-radius:20px; }
        .ap-card { background:#fff; border:1.5px solid #EAF1EE; border-radius:16px; padding:22px 24px; margin-bottom:14px; box-shadow:0 2px 12px rgba(26,61,52,0.04); }
        .ap-card-top { display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:10px; margin-bottom:14px; }
        .ap-name { font-family:'Amiri',serif; font-size:19px; color:#1A3D34; font-weight:700; }
        .ap-badge { font-size:12px; padding:4px 14px; border-radius:20px; font-weight:600; }
        .ap-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:12px; margin-bottom:16px; }
        .ap-field { font-size:13px; }
        .ap-field-label { color:#A3BAB2; margin-bottom:2px; }
        .ap-field-val { color:#1A3D34; font-weight:600; }
        .ap-actions { display:flex; gap:10px; flex-wrap:wrap; padding-top:14px; border-top:1px solid #F0F5F3; }
        .ap-btn { border:none; padding:10px 22px; border-radius:30px; font-family:'Cairo',sans-serif; font-size:13.5px; font-weight:700; cursor:pointer; }
        .ap-btn-approve { background:linear-gradient(135deg,#2E9E7B,#7DD3B0); color:#fff; }
        .ap-btn-reject { background:#FBEDED; color:#D96A6A; }
        .ap-btn:disabled { opacity:0.5; cursor:not-allowed; }
        .ap-lock { font-size:12px; color:#2E9E7B; }
        .ap-empty { color:#A3BAB2; font-size:14px; text-align:center; padding:30px; }
      `}</style>
      <div className="ap-wrapper">
        <div className="ap-inner">
          <div className="ap-head">لوحة الموافقات</div>
          <div className="ap-sub">مراجعة طلبات التسجيل وتفعيل الحسابات</div>

          <div className="ap-section-title">
            طلبات بانتظار المراجعة <span className="ap-count">{pending.length}</span>
          </div>

          {pending.length === 0 && <div className="ap-empty">لا توجد طلبات جديدة</div>}

          {pending.map(c => (
            <div className="ap-card" key={c.id}>
              <div className="ap-card-top">
                <span className="ap-name">{c.company_name || 'بدون اسم'}</span>
                <span className="ap-badge" style={{ background:'#FBF5E8', color:'#D9A441' }}>بانتظار المراجعة</span>
              </div>
              <div className="ap-grid">
                <div className="ap-field"><div className="ap-field-label">السجل التجاري</div><div className="ap-field-val">{c.cr_number || '—'}</div></div>
                <div className="ap-field"><div className="ap-field-label">المالك</div><div className="ap-field-val">{c.owner_name || '—'}</div></div>
                <div className="ap-field"><div className="ap-field-label">الجوال</div><div className="ap-field-val">{c.phone || '—'}</div></div>
                <div className="ap-field"><div className="ap-field-label">المدينة</div><div className="ap-field-val">{c.city || '—'}</div></div>
                <div className="ap-field"><div className="ap-field-label">القطاع</div><div className="ap-field-val">{c.sector || '—'}</div></div>
                <div className="ap-field"><div className="ap-field-label">الدفع</div><div className="ap-field-val">{c.payment_status === 'paid' ? 'مدفوع ✓' : 'غير مدفوع'}</div></div>
              </div>
              <div className="ap-actions">
                <button className="ap-btn ap-btn-approve" disabled={busy === c.id} onClick={() => approve(c)}>
                  {busy === c.id ? 'جارٍ...' : '✓ موافقة وتفعيل'}
                </button>
                <button className="ap-btn ap-btn-reject" disabled={busy === c.id} onClick={() => setStatus(c, 'rejected')}>
                  رفض
                </button>
              </div>
            </div>
          ))}

          <div className="ap-section-title">جميع الشركات <span className="ap-count" style={{ background:'#A3BAB2' }}>{others.length}</span></div>

          {others.map(c => (
            <div className="ap-card" key={c.id}>
              <div className="ap-card-top">
                <span className="ap-name">{c.company_name || 'بدون اسم'} {c.is_locked && <span className="ap-lock">🔒</span>}</span>
                <span className="ap-badge" style={{ background:'#E8F5EF', color:'#2E9E7B' }}>{STATUS_LABEL[c.account_status] || c.account_status}</span>
              </div>
              <div className="ap-actions">
                {c.account_status === 'active' && (
                  <button className="ap-btn ap-btn-reject" disabled={busy === c.id} onClick={() => setStatus(c, 'suspended')}>إيقاف</button>
                )}
                {c.account_status === 'suspended' && (
                  <button className="ap-btn ap-btn-approve" disabled={busy === c.id} onClick={() => setStatus(c, 'active')}>إعادة تفعيل</button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
