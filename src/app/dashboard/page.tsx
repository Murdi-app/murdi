'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const C = { navy:'#0B1C3D', navyLight:'#112244', border:'#1E3A6E', gold:'#F5C842', goldLight:'#E6A800', white:'#fff', gray:'#8899BB' }

export default function Dashboard() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [form, setForm] = useState({ revenue:'', expenses:'', bank_balance:'', debts:'', receivables:'', employees:'' })
  const [score, setScore] = useState<number|null>(null)
  const [saved, setSaved] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      setUser(user)
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(data)
    }
    getUser()
  }, [])

  const calcScore = (f: typeof form) => {
    const r = parseFloat(f.revenue)||0, e = parseFloat(f.expenses)||0
    const b = parseFloat(f.bank_balance)||0, d = parseFloat(f.debts)||0
    const rec = parseFloat(f.receivables)||0
    let s = 0
    if (r > 0) {
      const liq = b / e; if (liq >= 3) s+=25; else if (liq >= 1) s+=15; else if (liq > 0) s+=5
      const cf = (r - e) / r * 100; if (cf >= 15) s+=25; else if (cf > 0) s+=15
      const dso = rec / r * 30; if (dso <= 60) s+=20; else if (dso <= 90) s+=10
      const dr = d / (r * 12); if (dr <= 0.5) s+=15; else if (dr <= 1) s+=8
    }
    return Math.min(s, 85)
  }

  const handleChange = (k: string, v: string) => {
    const f = {...form, [k]:v}
    setForm(f)
    setScore(calcScore(f))
  }

  const handleSave = async () => {
    const now = new Date()
    await supabase.from('monthly_data').upsert({
      user_id: user.id, month: now.getMonth()+1, year: now.getFullYear(),
      revenue: parseFloat(form.revenue)||0, expenses: parseFloat(form.expenses)||0,
      bank_balance: parseFloat(form.bank_balance)||0, debts: parseFloat(form.debts)||0,
      receivables: parseFloat(form.receivables)||0, employees: parseInt(form.employees)||0,
      murdi_score: score||0
    })
    setSaved(true)
    setTimeout(()=>setSaved(false), 3000)
  }

  const scoreColor = (s: number) => s >= 70 ? '#22c55e' : s >= 40 ? '#F5C842' : '#ef4444'

  const fields = [
    { key:'revenue', label:'الإيرادات الشهرية', placeholder:'مثال: 500000' },
    { key:'expenses', label:'المصروفات الشهرية', placeholder:'مثال: 350000' },
    { key:'bank_balance', label:'الرصيد البنكي', placeholder:'مثال: 200000' },
    { key:'debts', label:'الديون', placeholder:'مثال: 100000' },
    { key:'receivables', label:'الذمم المدينة', placeholder:'مثال: 150000' },
    { key:'employees', label:'عدد الموظفين', placeholder:'مثال: 25' },
  ]

  if (!user) return <div style={{background:C.navy,minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center'}}><div style={{color:C.gold,fontSize:20}}>...</div></div>

  return (
    <div style={{minHeight:'100vh',background:C.navy,fontFamily:'system-ui',direction:'rtl'}}>
      <div style={{background:C.navyLight,padding:'16px 32px',display:'flex',justifyContent:'space-between',alignItems:'center',borderBottom:`1px solid ${C.border}`}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <div style={{fontSize:22,fontWeight:900,color:C.gold,letterSpacing:2}}>MURDI</div>
          <div style={{fontSize:11,color:C.gray,letterSpacing:1}}>CONSTRUCTION INTELLIGENCE</div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <div style={{textAlign:'right',marginLeft:8}}>
            <div style={{color:C.white,fontWeight:700,fontSize:14}}>{profile?.company_name||'شركتك'}</div>
            <div style={{color:C.gray,fontSize:12}}>{user.email}</div>
          </div>
          <button onClick={()=>router.push('/dashboard/memory')} style={{padding:'8px 16px',borderRadius:8,border:`1px solid ${C.gold}`,background:'transparent',color:C.gold,cursor:'pointer',fontSize:13}}>
            Company Memory
          </button>
          <button onClick={async()=>{await supabase.auth.signOut();router.push('/auth/login')}} style={{padding:'8px 16px',borderRadius:8,border:`1px solid ${C.border}`,background:'transparent',color:C.gray,cursor:'pointer',fontSize:13}}>
            خروج
          </button>
        </div>
      </div>

      <div style={{maxWidth:900,margin:'0 auto',padding:'32px 24px'}}>
        {score !== null && (
          <div style={{background:C.navyLight,borderRadius:16,padding:'24px 32px',marginBottom:24,border:`1px solid ${C.border}`,textAlign:'center'}}>
            <div style={{color:C.gray,fontSize:14,marginBottom:8}}>Murdi Score</div>
            <div style={{fontSize:64,fontWeight:900,color:scoreColor(score)}}>{score}</div>
            <div style={{color:C.gray,fontSize:13}}>من 85 نقطة</div>
          </div>
        )}
        <div style={{background:C.navyLight,borderRadius:16,padding:'32px',border:`1px solid ${C.border}`}}>
          <div style={{color:C.white,fontSize:18,fontWeight:700,marginBottom:24}}>بيانات الشهر الحالي</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
            {fields.map(f => (
              <div key={f.key}>
                <div style={{color:C.gray,fontSize:13,marginBottom:6}}>{f.label}</div>
                <input value={form[f.key as keyof typeof form]} onChange={e=>handleChange(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  style={{width:'100%',padding:'12px 14px',borderRadius:8,border:`1px solid ${C.border}`,background:C.navy,color:C.white,fontSize:15,boxSizing:'border-box'}} />
              </div>
            ))}
          </div>
          <button onClick={handleSave} style={{marginTop:24,width:'100%',padding:'14px',borderRadius:8,border:'none',background:`linear-gradient(135deg,${C.gold},${C.goldLight})`,color:C.navy,fontSize:16,fontWeight:800,cursor:'pointer'}}>
            {saved ? '✓ تم الحفظ!' : 'احسب وحفظ في Company Memory'}
          </button>
        </div>
      </div>
    </div>
  )
}
