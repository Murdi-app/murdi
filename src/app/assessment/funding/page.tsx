'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'

interface FormState {
  annual_revenue: string
  net_profit: string
  available_cash: string
  monthly_expenses: string
  total_debt: string
  monthly_installments: string
  receivables: string
  overdue_receivables: string
  avg_collection_days: string
  years_operating: string
  employee_count: string
  revenue_growth: string
  client_concentration: string
  has_financials: boolean
  has_external_auditor: boolean
  has_finance_manager: boolean
  has_accountant: boolean
  has_monthly_budget: boolean
  separate_accounts: boolean
}

const initial: FormState = {
  annual_revenue: '', net_profit: '', available_cash: '', monthly_expenses: '',
  total_debt: '', monthly_installments: '', receivables: '', overdue_receivables: '',
  avg_collection_days: '', years_operating: '', employee_count: '', revenue_growth: '',
  client_concentration: '', has_financials: false, has_external_auditor: false,
  has_finance_manager: false, has_accountant: false, has_monthly_budget: false,
  separate_accounts: false,
}

const STEPS = ['الوضع المالي', 'السيولة والتحصيل', 'التشغيل', 'الحوكمة']

export default function FundingAssessmentPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<FormState>(initial)

  useEffect(() => { checkAccess() }, [])

  async function checkAccess() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }
    const { data: company } = await supabase
      .from('companies').select('account_status').eq('user_id', user.id).maybeSingle()
    if (!company || company.account_status !== 'active') { router.push('/pending'); return }
    setLoading(false)
  }

  function setNum(key: keyof FormState, val: string) {
    if (val === '' || /^\d*\.?\d*$/.test(val)) setForm({ ...form, [key]: val })
  }
  function setBool(key: keyof FormState, val: boolean) { setForm({ ...form, [key]: val }) }

  async function submit() {
    setSubmitting(true)
    const payload: Record<string, number | boolean> = {}
    Object.entries(form).forEach(([k, v]) => {
      payload[k] = typeof v === 'boolean' ? v : (parseFloat(v) || 0)
    })
    const res = await fetch('/api/assessment/funding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setSubmitting(false)
    if (!res.ok) { alert('حدث خطأ أثناء التقييم، حاول مرة أخرى'); return }
    router.push('/assessment/funding/result')
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', background:'#FBFCFB', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ color:'#2E9E7B', fontFamily:'Cairo,sans-serif', fontSize:18 }}>جاري التحميل...</div>
    </div>
  )

  const numFields: { key: keyof FormState; label: string; hint?: string }[][] = [
    [
      { key:'annual_revenue', label:'الإيرادات السنوية (ر.س)' },
      { key:'net_profit', label:'صافي الربح السنوي (ر.س)' },
      { key:'total_debt', label:'إجمالي الديون (ر.س)' },
      { key:'monthly_installments', label:'الأقساط الشهرية (ر.س)' },
    ],
    [
      { key:'available_cash', label:'النقد المتاح (ر.س)' },
      { key:'monthly_expenses', label:'المصروف الشهري (ر.س)' },
      { key:'receivables', label:'الذمم المdينة (ر.س)' },
      { key:'overdue_receivables', label:'الذمم المتأخرة (ر.س)' },
      { key:'avg_collection_days', label:'متوسط أيام التحصيل' },
    ],
    [
      { key:'years_operating', label:'عمر الشركة (سنوات)' },
      { key:'employee_count', label:'عدد الموظفين' },
      { key:'revenue_growth', label:'نمو الإيرادات السنوي (%)' },
      { key:'client_concentration', label:'نسبة أكبر عميل من الإيرادات (%)' },
    ],
  ]

  const boolFields: { key: keyof FormState; label: string }[] = [
    { key:'has_financials', label:'لديك قوائم مالية' },
    { key:'has_external_auditor', label:'لديك مراجع خارجي' },
    { key:'has_finance_manager', label:'لديك مدير مالي' },
    { key:'has_accountant', label:'لديك محاسب' },
    { key:'has_monthly_budget', label:'لديك ميزانية شهرية' },
    { key:'separate_accounts', label:'حسابات الشركة منفصلة عن الشخصية' },
  ]

  const isLastStep = step === STEPS.length - 1

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Cairo:wght@300;400;600;700&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; }
        .fa-wrapper { min-height:100vh; background:#FBFCFB; display:flex; flex-direction:column; align-items:center; padding:48px 16px; font-family:'Cairo',sans-serif; direction:rtl; }
        .fa-title { font-family:'Amiri',serif; font-size:28px; color:#1A3D34; font-weight:700; margin-bottom:6px; }
        .fa-subtitle { color:#6B8A80; font-size:14px; margin-bottom:32px; }
        .fa-steps { display:flex; gap:8px; margin-bottom:34px; flex-wrap:wrap; justify-content:center; }
        .fa-step-pill { display:flex; align-items:center; gap:8px; padding:8px 16px; border-radius:30px; font-size:13px; font-weight:600; transition:all .25s; }
        .fa-step-pill.active { background:#2E9E7B; color:#fff; box-shadow:0 6px 16px rgba(46,158,123,0.3); }
        .fa-step-pill.done { background:#E8F5EF; color:#2E9E7B; }
        .fa-step-pill.todo { background:#fff; color:#A3BAB2; border:1px solid #EAF1EE; }
        .fa-step-num { width:20px; height:20px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:11px; background:rgba(255,255,255,0.25); }
        .fa-card { background:#fff; border:1.5px solid #EAF1EE; border-radius:20px; padding:36px 34px; max-width:640px; width:100%; box-shadow:0 4px 20px rgba(26,61,52,0.05); }
        .fa-card-head { font-family:'Amiri',serif; font-size:21px; color:#1A3D34; font-weight:700; margin-bottom:24px; padding-bottom:14px; border-bottom:1px solid #EAF1EE; }
        .fa-field { margin-bottom:20px; }
        .fa-label { display:block; color:#1A3D34; font-size:14px; font-weight:600; margin-bottom:8px; }
        .fa-input { width:100%; background:#FBFCFB; border:1.5px solid #EAF1EE; border-radius:12px; padding:13px 16px; font-family:'Cairo',sans-serif; font-size:15px; color:#1A3D34; outline:none; transition:border-color .2s; direction:rtl; text-align:right; }
        .fa-input:focus { border-color:#2E9E7B; background:#fff; }
        .fa-toggle-row { display:flex; align-items:center; justify-content:space-between; padding:14px 18px; background:#FBFCFB; border:1.5px solid #EAF1EE; border-radius:12px; margin-bottom:12px; cursor:pointer; transition:all .2s; }
        .fa-toggle-row:hover { border-color:#7DD3B0; }
        .fa-toggle-row.on { background:#E8F5EF; border-color:#2E9E7B; }
        .fa-toggle-label { color:#1A3D34; font-size:14.5px; font-weight:500; }
        .fa-switch { width:46px; height:26px; border-radius:20px; background:#D5E3DD; position:relative; transition:background .2s; flex-shrink:0; }
        .fa-switch.on { background:#2E9E7B; }
        .fa-switch-dot { position:absolute; top:3px; right:3px; width:20px; height:20px; border-radius:50%; background:#fff; transition:transform .2s; box-shadow:0 2px 5px rgba(0,0,0,0.15); }
        .fa-switch.on .fa-switch-dot { transform:translateX(-20px); }
        .fa-actions { display:flex; gap:12px; margin-top:30px; }
        .fa-btn-next { flex:1; background:linear-gradient(135deg,#2E9E7B,#7DD3B0); color:#fff; border:none; padding:15px; border-radius:40px; font-family:'Cairo',sans-serif; font-size:15.5px; font-weight:700; cursor:pointer; box-shadow:0 8px 22px rgba(46,158,123,0.28); transition:all .2s; }
        .fa-btn-next:disabled { opacity:0.5; cursor:not-allowed; }
        .fa-btn-back { background:#fff; color:#6B8A80; border:1.5px solid #EAF1EE; padding:15px 32px; border-radius:40px; font-family:'Cairo',sans-serif; font-size:15px; font-weight:600; cursor:pointer; }
      `}</style>
      <div className="fa-wrapper">
        <h1 className="fa-title">تقييم الجاهزية التمويلية</h1>
        <p className="fa-subtitle">أدخل بيانات شركتك بدقة للحصول على تقييم صحيح</p>

        <div className="fa-steps">
          {STEPS.map((s, i) => (
            <div key={i} className={`fa-step-pill ${i === step ? 'active' : i < step ? 'done' : 'todo'}`}>
              <span className="fa-step-num">{i < step ? '✓' : i + 1}</span>
              {s}
            </div>
          ))}
        </div>

        <div className="fa-card">
          <div className="fa-card-head">{STEPS[step]}</div>

          {step < 3 && numFields[step].map(f => (
            <div className="fa-field" key={f.key}>
              <label className="fa-label">{f.label}</label>
              <input
                className="fa-input"
                inputMode="decimal"
                value={form[f.key] as string}
                onChange={e => setNum(f.key, e.target.value)}
                placeholder="0"
              />
            </div>
          ))}

          {step === 3 && boolFields.map(f => (
            <div
              key={f.key}
              className={`fa-toggle-row ${form[f.key] ? 'on' : ''}`}
              onClick={() => setBool(f.key, !form[f.key])}
            >
              <span className="fa-toggle-label">{f.label}</span>
              <div className={`fa-switch ${form[f.key] ? 'on' : ''}`}>
                <div className="fa-switch-dot" />
              </div>
            </div>
          ))}

          <div className="fa-actions">
            {step > 0 && (
              <button className="fa-btn-back" onClick={() => setStep(step - 1)}>السابق</button>
            )}
            {!isLastStep ? (
              <button className="fa-btn-next" onClick={() => setStep(step + 1)}>التالي</button>
            ) : (
              <button className="fa-btn-next" disabled={submitting} onClick={submit}>
                {submitting ? 'جاري التحليل...' : 'احسب جاهزيتي'}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
