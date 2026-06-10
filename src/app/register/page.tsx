'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'

const IBAN = 'SA3710000026300000961004'
const BENEFICIARY = 'شركة حلول المرضي للاستشارات المالية'
const FEE = '1,900 ر.س'

export default function RegisterPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  const [form, setForm] = useState({
    company_name: '', cr_number: '', tax_number: '',
    owner_name: '', phone: '', city: '', sector: '',
  })

  useEffect(() => { check() }, [])

  async function check() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }
    const { data: company } = await supabase
      .from('companies').select('account_status').eq('user_id', user.id).maybeSingle()
    if (company && company.account_status === 'active') { router.push('/goal'); return }
    if (company && company.account_status === 'pending_approval') { router.push('/pending'); return }
    setLoading(false)
  }

  function set(key: string, val: string) { setForm({ ...form, [key]: val }) }

  const canProceed = form.company_name && form.cr_number && form.owner_name && form.phone && form.city && form.sector

  async function saveCompany() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: existing } = await supabase
      .from('companies').select('id').eq('user_id', user.id).maybeSingle()
    if (existing) {
      await supabase.from('companies').update({ ...form, account_status: 'pending_payment' }).eq('id', existing.id)
    } else {
      await supabase.from('companies').insert({ user_id: user.id, ...form, account_status: 'pending_payment' })
    }
    setSaving(false)
    setStep(2)
  }

  async function confirmTransfer() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('companies').update({ account_status: 'pending_approval' }).eq('user_id', user.id)
    setSaving(false)
    router.push('/pending')
  }

  function copyIban() {
    navigator.clipboard.writeText(IBAN)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', background:'#FBFCFB', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ color:'#2E9E7B', fontFamily:'Cairo,sans-serif', fontSize:18 }}>جاري التحميل...</div>
    </div>
  )

  const fields = [
    { key:'company_name', label:'اسم الشركة', ph:'الاسم كما في السجل التجاري' },
    { key:'cr_number', label:'رقم السجل التجاري', ph:'10xxxxxxxx' },
    { key:'tax_number', label:'الرقم الضريبي (اختياري)', ph:'3xxxxxxxxxxxxxx' },
    { key:'owner_name', label:'اسم المالك / المفوض', ph:'الاسم الكامل' },
    { key:'phone', label:'رقم الجوال', ph:'05xxxxxxxx' },
    { key:'city', label:'المدينة', ph:'الرياض' },
    { key:'sector', label:'القطاع', ph:'مقاولات، تجارة، خدمات...' },
  ]

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Cairo:wght@300;400;600;700&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; }
        .rg-wrapper { min-height:100vh; background:#FBFCFB; display:flex; flex-direction:column; align-items:center; padding:48px 16px; font-family:'Cairo',sans-serif; direction:rtl; }
        .rg-logo { font-family:'Amiri',serif; font-size:28px; color:#1A3D34; margin-bottom:8px; }
        .rg-title { font-family:'Amiri',serif; font-size:24px; color:#1A3D34; font-weight:700; margin-bottom:6px; }
        .rg-sub { color:#6B8A80; font-size:14px; margin-bottom:30px; text-align:center; }
        .rg-card { background:#fff; border:1.5px solid #EAF1EE; border-radius:20px; padding:34px 30px; max-width:560px; width:100%; box-shadow:0 4px 20px rgba(26,61,52,0.05); }
        .rg-field { margin-bottom:18px; }
        .rg-label { display:block; color:#1A3D34; font-size:14px; font-weight:600; margin-bottom:7px; }
        .rg-input { width:100%; background:#FBFCFB; border:1.5px solid #EAF1EE; border-radius:12px; padding:13px 16px; font-family:'Cairo',sans-serif; font-size:15px; color:#1A3D34; outline:none; direction:rtl; text-align:right; }
        .rg-input:focus { border-color:#2E9E7B; background:#fff; }
        .rg-btn { width:100%; background:linear-gradient(135deg,#2E9E7B,#7DD3B0); color:#fff; border:none; padding:15px; border-radius:40px; font-family:'Cairo',sans-serif; font-size:16px; font-weight:700; cursor:pointer; box-shadow:0 8px 22px rgba(46,158,123,0.28); margin-top:8px; }
        .rg-btn:disabled { opacity:0.45; cursor:not-allowed; }
        .rg-fee-box { background:#E8F5EF; border-radius:16px; padding:22px; text-align:center; margin-bottom:22px; }
        .rg-fee-label { color:#6B8A80; font-size:13px; margin-bottom:4px; }
        .rg-fee-amount { font-family:'Amiri',serif; font-size:34px; color:#2E9E7B; font-weight:700; }
        .rg-bank-row { display:flex; justify-content:space-between; align-items:center; padding:14px 0; border-bottom:1px solid #F0F5F3; }
        .rg-bank-row:last-child { border-bottom:none; }
        .rg-bank-label { color:#A3BAB2; font-size:13px; }
        .rg-bank-val { color:#1A3D34; font-size:14px; font-weight:600; direction:ltr; }
        .rg-copy { background:#2E9E7B; color:#fff; border:none; padding:6px 16px; border-radius:20px; font-family:'Cairo',sans-serif; font-size:12px; font-weight:600; cursor:pointer; margin-right:8px; }
        .rg-note { background:#FBF5E8; border-radius:12px; padding:14px 16px; color:#9A7B2E; font-size:13px; line-height:1.7; margin:18px 0; }
        .rg-back { background:transparent; color:#A3BAB2; border:none; font-family:'Cairo',sans-serif; font-size:13px; cursor:pointer; margin-top:14px; width:100%; }
      `}</style>
      <div className="rg-wrapper">
        <div className="rg-logo">Murdi</div>

        {step === 1 && (
          <>
            <div className="rg-title">تسجيل شركتك</div>
            <div className="rg-sub">أدخل بيانات شركتك لفتح ملف جديد</div>
            <div className="rg-card">
              {fields.map(f => (
                <div className="rg-field" key={f.key}>
                  <label className="rg-label">{f.label}</label>
                  <input className="rg-input" value={(form as any)[f.key]} onChange={e => set(f.key, e.target.value)} placeholder={f.ph} />
                </div>
              ))}
              <button className="rg-btn" disabled={!canProceed || saving} onClick={saveCompany}>
                {saving ? 'جارٍ الحفظ...' : 'التالي: الدفع'}
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="rg-title">رسوم فتح الملف</div>
            <div className="rg-sub">حوّل المبلغ على الحساب التالي، ثم أكّد التحويل</div>
            <div className="rg-card">
              <div className="rg-fee-box">
                <div className="rg-fee-label">رسوم فتح الملف (مرة واحدة)</div>
                <div className="rg-fee-amount">{FEE}</div>
              </div>
              <div className="rg-bank-row">
                <span className="rg-bank-label">المستفيد</span>
                <span className="rg-bank-val" style={{ direction:'rtl' }}>{BENEFICIARY}</span>
              </div>
              <div className="rg-bank-row">
                <span className="rg-bank-label">البنك</span>
                <span className="rg-bank-val" style={{ direction:'rtl' }}>البنك الأهلي السعودي</span>
              </div>
              <div className="rg-bank-row">
                <span className="rg-bank-label">الآيبان</span>
                <span className="rg-bank-val">
                  {IBAN}
                  <button className="rg-copy" onClick={copyIban}>{copied ? 'تم ✓' : 'نسخ'}</button>
                </span>
              </div>
              <div className="rg-note">
                بعد التحويل، احتفظ بإيصال التحويل. سيطلبه فريق Murdi عند مراجعة طلبك. اضغط "أكّدت التحويل" لإرسال طلبك للمراجعة.
              </div>
              <button className="rg-btn" disabled={saving} onClick={confirmTransfer}>
                {saving ? 'جارٍ الإرسال...' : 'أكّدت التحويل'}
              </button>
              <button className="rg-back" onClick={() => setStep(1)}>رجوع لتعديل البيانات</button>
            </div>
          </>
        )}
      </div>
    </>
  )
}
