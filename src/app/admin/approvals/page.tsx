'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'

const ADMIN_EMAIL = 'hololalmurdi.fs@gmail.com'
const fmtDate = (d: string) => d ? new Date(d).toLocaleString('ar-SA', { year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }) : '—'

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
  receipt_path: string | null
  payment_confirmed_at: string | null
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
  const [consultations, setConsultations] = useState<any[]>([])
  const [questions, setQuestions] = useState<any[]>([])
  const [edits, setEdits] = useState<any[]>([])
  const [profiles, setProfiles] = useState<any[]>([])
  const [openProfile, setOpenProfile] = useState<string | null>(null)

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }
    if (user.email !== ADMIN_EMAIL) { setAuthorized(false); setLoading(false); return }
    setAuthorized(true)
    await loadCompanies()
    await loadConsultations()
    await loadQA()
    setLoading(false)
  }

  async function loadQA() {
    try {
      const res = await fetch('/api/questions')
      const data = await res.json()
      setQuestions(data.questions || [])
      setEdits(data.edits || [])
    } catch {}
  }

  async function generateAnswer(id: string) {
    setBusy(id)
    await fetch('/api/questions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    await loadQA()
    setBusy(null)
  }

  async function qaAction(id: string, type: string) {
    setBusy(id)
    await fetch('/api/questions', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, type }) })
    await loadQA()
    setBusy(null)
  }

  async function loadConsultations() {
    try {
      try {
        const pRes = await fetch('/api/admin/profiles')
        if (pRes.ok) { const pData = await pRes.json(); setProfiles(pData.profiles || []) }
      } catch {}
      const res = await fetch('/api/consultation')
      const data = await res.json()
      setConsultations(data.consultations || [])
    } catch {}
  }

  async function releaseConsultation(id: string) {
    setBusy(id)
    await fetch('/api/consultation', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    await loadConsultations()
    setBusy(null)
  }

  async function loadCompanies() {
    const { data } = await supabase
      .from('companies')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) setCompanies(data as Company[])
  }

  async function viewReceipt(c: Company) {
    if (!c.receipt_path) return
    const { data, error } = await supabase.storage
      .from('receipts')
      .createSignedUrl(c.receipt_path, 300)
    if (error || !data?.signedUrl) { alert('تعذر فتح الإيصال'); return }
    window.open(data.signedUrl, '_blank')
  }

  async function confirmPayment(c: Company) {
    setBusy(c.id)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('companies').update({
      payment_status: 'paid',
      payment_confirmed_at: new Date().toISOString(),
      payment_confirmed_by: user?.email || 'admin',
    }).eq('id', c.id)
    await loadCompanies()
    setBusy(null)
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
        .ap-btn-receipt { background:#E8F5EF; color:#2E9E7B; }
        .ap-btn-pay { background:#FBF5E8; color:#9A7B2E; }
        .ap-btn:disabled { opacity:0.5; cursor:not-allowed; }
        .ap-lock { font-size:12px; color:#2E9E7B; }
        .ap-empty { color:#A3BAB2; font-size:14px; text-align:center; padding:30px; }
      `}</style>
      <div className="ap-wrapper">
        <div className="ap-inner">
          <div style={{ display:'flex', gap:8, marginBottom:22, borderBottom:'2px solid #EAF2EE', paddingBottom:0 }}>
            <div onClick={()=>router.push('/admin')} style={{ padding:'10px 18px', color:'#6B8A80', fontWeight:700, fontSize:14, cursor:'pointer', fontFamily:'Cairo,sans-serif' }}>لوحة التحكم</div>
            <div style={{ padding:'10px 18px', color:'#2E9E7B', fontWeight:900, fontSize:14, borderBottom:'2px solid #2E9E7B', fontFamily:'Cairo,sans-serif' }}>الاعتمادات</div>
            <div onClick={()=>router.push('/admin/entities')} style={{ padding:'10px 18px', color:'#6B8A80', fontWeight:700, fontSize:14, cursor:'pointer', fontFamily:'Cairo,sans-serif' }}>الجهات</div>
          </div>
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
                <div className="ap-field"><div className="ap-field-label">الدفع</div><div className="ap-field-val">{c.payment_status === 'paid' ? 'مؤكد ✓' : 'لم يُؤكد بعد'}</div></div>
                <div className="ap-field"><div className="ap-field-label">الإيصال</div><div className="ap-field-val">{c.receipt_path ? 'مرفوع 📎' : 'غير مرفوع'}</div></div>
                <div className="ap-field"><div className="ap-field-label">تاريخ الطلب</div><div className="ap-field-val">{fmtDate(c.created_at)}</div></div>
              </div>
              <div className="ap-actions">
                {c.receipt_path && (
                  <button className="ap-btn ap-btn-receipt" onClick={() => viewReceipt(c)}>
                    📎 عرض الإيصال
                  </button>
                )}
                {c.payment_status !== 'paid' && (
                  <button className="ap-btn ap-btn-pay" disabled={busy === c.id} onClick={() => confirmPayment(c)}>
                    {busy === c.id ? 'جار...' : '💰 تأكيد استلام الدفع'}
                  </button>
                )}
                <button className="ap-btn ap-btn-approve" disabled={busy === c.id || c.payment_status !== 'paid'} onClick={() => approve(c)}
                  title={c.payment_status !== 'paid' ? 'أكّد استلام الدفع أولاً' : ''}>
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
              <div style={{ color:'#9DB3AB', fontSize:12, fontWeight:600, marginBottom:12 }}>📅 سجّل: {fmtDate(c.created_at)}</div>
              <div className="ap-actions">
                {c.receipt_path && (
                  <button className="ap-btn ap-btn-receipt" onClick={() => viewReceipt(c)}>📎 عرض الإيصال</button>
                )}
                {c.account_status === 'active' && (
                  <button className="ap-btn ap-btn-reject" disabled={busy === c.id} onClick={() => setStatus(c, 'suspended')}>إيقاف</button>
                )}
                {c.account_status === 'suspended' && (
                  <button className="ap-btn ap-btn-approve" disabled={busy === c.id} onClick={() => setStatus(c, 'active')}>إعادة تفعيل</button>
                )}
              </div>
            </div>
          ))}
          <div className="ap-section-title">📂 ملفات العملاء (التقييمات) <span className="ap-count" style={{ background:'#1A3D34' }}>{profiles.length}</span></div>
          {profiles.length === 0 && <div className="ap-empty">لا توجد ملفات تقييم بعد</div>}
          {profiles.map((pr, idx) => {
            const TA: Record<string,string> = { funding: 'تمويل', investment: 'استثمار', ipo: 'طرح' };
            const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
            const isOpen = openProfile === pr.company?.id + '-' + idx;
            const defaulted = pr.repayment_status === 'default';
            return (
              <div className="ap-card" key={pr.company?.id + '-' + idx}>
                <div className="ap-card-top" style={{ cursor:'pointer' }} onClick={() => setOpenProfile(isOpen ? null : pr.company?.id + '-' + idx)}>
                  <span className="ap-name">📊 {pr.company?.company_name || 'شركة'} 
                    <span className="ap-badge" style={{ background:'#E8F5EF', color:'#2E9E7B', marginRight:8 }}>{TA[pr.assessment_type] || pr.assessment_type}</span>
                    {defaulted && <span className="ap-badge" style={{ background:'#FBECEC', color:'#C0564B', marginRight:6 }}>متعثر</span>}
                  </span>
                  <span className="ap-badge" style={{ background: pr.score >= 65 ? '#E8F5EF' : '#FBF5E8', color: pr.score >= 65 ? '#2E9E7B' : '#9A7B2E' }}>درجة {pr.score ?? '—'} {isOpen ? '▲' : '▼'}</span>
                </div>
                {isOpen && (
                  <div>
                    <div className="ap-grid">
                      <div className="ap-field"><div className="ap-field-label">السجل</div><div className="ap-field-val">{pr.company?.cr_number || '—'}</div></div>
                      <div className="ap-field"><div className="ap-field-label">الجوال</div><div className="ap-field-val">{pr.company?.phone || '—'}</div></div>
                      <div className="ap-field"><div className="ap-field-label">القطاع</div><div className="ap-field-val">{pr.company?.sector || '—'}</div></div>
                      <div className="ap-field"><div className="ap-field-label">الإيرادات</div><div className="ap-field-val">{fmt(pr.rev)} ر.س</div></div>
                      <div className="ap-field"><div className="ap-field-label">صافي الربح</div><div className="ap-field-val">{fmt(pr.profit)} ر.س</div></div>
                      <div className="ap-field"><div className="ap-field-label">الحكم</div><div className="ap-field-val">{pr.verdict || '—'}</div></div>
                      {pr.months_to_ready != null && <div className="ap-field"><div className="ap-field-label">المدة للجاهزية</div><div className="ap-field-val">{pr.months_to_ready} شهراً</div></div>}
                      <div className="ap-field"><div className="ap-field-label">القيمة التقديرية</div><div className="ap-field-val">{pr.val_basis === 'profit' ? fmt(pr.val_lo) + ' — ' + fmt(pr.val_hi) + ' ر.س' : 'تحتاج ربحية'}</div></div>
                      {pr.has_debt === 'yes' && <div className="ap-field"><div className="ap-field-label">دين متبقٍ</div><div className="ap-field-val">{fmt(pr.remaining_debt)} ر.س</div></div>}
                    </div>
                    {pr.val_note && (
                      <div style={{ marginTop:8, background:'#FBF8EE', borderRadius:'8px', padding:'10px 14px', color:'#7A6420', fontSize:12.5, fontWeight:600, lineHeight:1.8 }}>💰 أساس التقييم: {pr.val_note}</div>
                    )}
                    {pr.obstacles?.length > 0 && (
                      <div style={{ marginTop:18, background:'#FBF5E8', borderRight:'4px solid #C9A84C', borderRadius:'10px', padding:'16px 18px' }}>
                        <div style={{ color:'#9A7B2E', fontSize:14, fontWeight:800, marginBottom:12 }}>⚠️ أبرز العوائق</div>
                        <ul style={{ paddingRight:20, margin:0, color:'#5C4A1F', fontSize:13.5, lineHeight:2.1 }}>
                          {pr.obstacles.map((o: string, i: number) => <li key={i} style={{ marginBottom:10 }}>{o}</li>)}
                        </ul>
                      </div>
                    )}
                    {pr.plan?.length > 0 && (
                      <div style={{ marginTop:14, background:'#F0F7F4', borderRight:'4px solid #2E9E7B', borderRadius:'10px', padding:'16px 18px' }}>
                        <div style={{ color:'#1A6B4F', fontSize:14, fontWeight:800, marginBottom:12 }}>🗺️ خطة التحسين / خارطة الطريق</div>
                        <ol style={{ paddingRight:20, margin:0, color:'#1A3D34', fontSize:13.5, lineHeight:2.1, fontWeight:600 }}>
                          {pr.plan.map((x: string, i: number) => <li key={i} style={{ marginBottom:12 }}>{x}</li>)}
                        </ol>
                      </div>
                    )}
                    {pr.eligibility && (
                      <div style={{ marginTop:14, background:'#EEF3F1', borderRight:'4px solid #1A3D34', borderRadius:'10px', padding:'16px 18px' }}>
                        <div style={{ color:'#1A3D34', fontSize:14, fontWeight:800, marginBottom:12 }}>🏛️ تحليل الأهلية (نمو / الرئيسي)</div>
                        <div style={{ color:'#3A4D47', fontSize:13.5, lineHeight:2.1, whiteSpace:'pre-wrap' }}>{pr.eligibility.replace(/^#+ /gm, '').replace(/\*\*/g, '')}</div>
                      </div>
                    )}
                    <div style={{ height:20 }} />
                  </div>
                )}
              </div>
            );
          })}

          <div className="ap-section-title">الاستشارات الخاصة <span className="ap-count" style={{ background:'#C9A84C' }}>{consultations.filter(c => c.status === 'ready').length}</span></div>

          {consultations.length === 0 && <div className="ap-empty">لا توجد استشارات بعد</div>}

          {consultations.map(c => (
            <div className="ap-card" key={c.id}>
              <div className="ap-card-top">
                <span className="ap-name">🎓 {c.companies?.company_name || 'شركة'}
                  {(() => {
                    const T: Record<string, { ar: string; bg: string; fg: string }> = {
                      funding: { ar: 'تمويل', bg: '#E8F5EF', fg: '#2E9E7B' },
                      investment: { ar: 'استثمار', bg: '#EAF0FB', fg: '#3B5BA5' },
                      ipo: { ar: 'طرح عام', bg: '#FBF0F0', fg: '#A53B3B' },
                    };
                    const t = T[c.assessment_type as string] || T.funding;
                    return <span style={{ marginRight: 8, padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 900, background: t.bg, color: t.fg }}>{t.ar}</span>;
                  })()}
                </span>
                <span className="ap-badge" style={{ background: c.status === 'released' ? '#E8F5EF' : c.status === 'ready' ? '#FBF5E8' : '#F0F0F0', color: c.status === 'released' ? '#2E9E7B' : c.status === 'ready' ? '#9A7B2E' : '#888' }}>
                  {c.status === 'released' ? 'صادرة ✓' : c.status === 'ready' ? 'جاهزة — بانتظار إصدارك' : c.status === 'analyzing' ? 'قيد التوليد' : 'فشل التوليد'}
                </span>
              </div>
              <div style={{ color:'#9DB3AB', fontSize:11.5, fontWeight:600, marginBottom:10 }}>📅 أُنشئت: {fmtDate(c.created_at)}{c.released_at ? '  •  📤 صدرت: ' + fmtDate(c.released_at) : ''}</div>
              {c.content && (
                <div style={{ maxHeight: 180, overflowY: 'auto', background:'#FBFCFB', borderRadius: 12, padding: 14, fontSize: 13, color:'#1A3D34', whiteSpace:'pre-wrap', marginBottom: 12 }}>
                  {c.content}{c.content.length > 1500 ? '...' : ''}
                </div>
              )}
              <div className="ap-actions">
                {c.status === 'ready' && (
                  <button className="ap-btn ap-btn-approve" disabled={busy === c.id} onClick={() => releaseConsultation(c.id)}>
                    {busy === c.id ? 'جارٍ...' : '📤 إصدار للعميل'}
                  </button>
                )}
              </div>
            </div>
          ))}

          <div className="ap-section-title">أسئلة العملاء <span className="ap-count" style={{ background:'#2E9E7B' }}>{questions.filter(q => q.status !== 'released').length}</span></div>

          {questions.length === 0 && <div className="ap-empty">لا توجد أسئلة بعد</div>}

          {questions.map(q => (
            <div className="ap-card" key={q.id}>
              <div className="ap-card-top">
                <span className="ap-name">💬 {q.companies?.company_name || 'شركة'}</span>
                <span className="ap-badge" style={{ background: q.status === 'released' ? '#E8F5EF' : '#FBF5E8', color: q.status === 'released' ? '#2E9E7B' : '#9A7B2E' }}>
                  {q.status === 'released' ? 'صادر ✓' : q.status === 'answered' ? 'جواب جاهز — بانتظار إصدارك' : 'بانتظار الجواب'}
                </span>
              </div>
              <p style={{ fontSize: 14, color:'#1A3D34', fontWeight: 700, marginBottom: 10 }}>س: {q.question}</p>
              {q.answer && (
                <div style={{ maxHeight: 450, overflowY: 'auto', background:'#FBFCFB', borderRadius: 12, padding: 14, fontSize: 13, color:'#1A3D34', whiteSpace:'pre-wrap', marginBottom: 12 }}>
                  {q.answer}
                </div>
              )}
              <div className="ap-actions">
                {q.status === 'pending' && (
                  <button className="ap-btn ap-btn-approve" disabled={busy === q.id} onClick={() => generateAnswer(q.id)}>
                    {busy === q.id ? 'جارٍ التوليد...' : '🧠 توليد جواب ذكي'}
                  </button>
                )}
                {q.status === 'answered' && (
                  <>
                    <button className="ap-btn ap-btn-approve" disabled={busy === q.id} onClick={() => qaAction(q.id, 'release_answer')}>
                      {busy === q.id ? 'جارٍ...' : '📤 إصدار الجواب'}
                    </button>
                    <button className="ap-btn ap-btn-receipt" disabled={busy === q.id} onClick={() => generateAnswer(q.id)}>
                      🔄 إعادة التوليد
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}

          <div className="ap-section-title">طلبات تعديل البيانات <span className="ap-count" style={{ background:'#C9A84C' }}>{edits.filter(e => e.status === 'pending').length}</span></div>

          {edits.length === 0 && <div className="ap-empty">لا توجد طلبات تعديل</div>}

          {edits.map(e => (
            <div className="ap-card" key={e.id}>
              <div className="ap-card-top">
                <span className="ap-name">🛠️ {e.companies?.company_name || 'شركة'}</span>
                <span className="ap-badge" style={{ background:'#FBF5E8', color:'#9A7B2E' }}>
                  {e.status === 'pending' ? 'بانتظار قرارك' : e.status === 'approved' ? 'معتمد — بانتظار إدخال العميل' : e.status === 'used' ? 'استُخدم ✓' : 'مرفوض'}
                </span>
              </div>
              <p style={{ fontSize: 13, color:'#6B8A80', fontWeight: 700, marginBottom: 12 }}>السبب: {e.reason || '—'}</p>
              {e.status === 'pending' && (
                <div className="ap-actions">
                  <button className="ap-btn ap-btn-approve" disabled={busy === e.id} onClick={() => qaAction(e.id, 'approve_edit')}>
                    ✓ اعتماد وفتح الإدخال
                  </button>
                  <button className="ap-btn ap-btn-reject" disabled={busy === e.id} onClick={() => qaAction(e.id, 'reject_edit')}>
                    رفض
                  </button>
                </div>
              )}
            </div>
          ))}

        </div>
      </div>
    </>
  )
}