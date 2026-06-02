'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'

export default function Memory() {
  const [month, setMonth] = useState('')
  const [year, setYear] = useState('2025')
  const [revenue, setRevenue] = useState('')
  const [expenses, setExpenses] = useState('')
  const [bankBalance, setBankBalance] = useState('')
  const [debts, setDebts] = useState('')
  const [receivables, setReceivables] = useState('')
  const [message, setMessage] = useState('')
  const [score, setScore] = useState<number|null>(null)
  const supabase = createClient()

  const calcScore = () => {
    const r = parseFloat(revenue)||0
    const e = parseFloat(expenses)||0
    const b = parseFloat(bankBalance)||0
    const d = parseFloat(debts)||0
    const rec = parseFloat(receivables)||0
    const liquidity = e > 0 ? b/e : 0
    const liqScore = liquidity > 3 ? 25 : liquidity > 1 ? 15 : 0
    const cashflow = r - e
    const cfScore = cashflow/r > 0.15 ? 25 : cashflow > 0 ? 15 : 0
    const collection = r > 0 ? (rec/r)*30 : 0
    const colScore = collection < 60 ? 20 : collection < 90 ? 10 : 0
    const debtRatio = r > 0 ? d/(r*12) : 0
    const debtScore = debtRatio < 0.5 ? 15 : debtRatio < 1 ? 8 : 0
    return Math.round(liqScore + cfScore + colScore + debtScore)
  }

  const handleSave = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const murdiScore = calcScore()
    setScore(murdiScore)
    const { error } = await supabase.from('monthly_data').insert({
      user_id: user.id, month, year: parseInt(year),
      revenue: parseFloat(revenue), expenses: parseFloat(expenses),
      bank_balance: parseFloat(bankBalance), debts: parseFloat(debts),
      receivables: parseFloat(receivables), murdi_score: murdiScore
    })
    if (error) { setMessage('خطأ: ' + error.message); return }
    setMessage('تم الحفظ!')
  }

  return (
    <div style={{minHeight:'100vh',background:'#0a1628',padding:'40px 20px'}}>
      <div style={{maxWidth:'500px',margin:'0 auto'}}>
        <h1 style={{color:'#c9a84c',textAlign:'center',fontSize:'28px',marginBottom:'8px'}}>Company Memory</h1>
        <p style={{color:'#8899aa',textAlign:'center',marginBottom:'30px'}}>سجّل بياناتك الشهرية</p>
        <select value={month} onChange={e=>setMonth(e.target.value)} style={{width:'100%',padding:'12px',marginBottom:'12px',background:'#1a2a40',color:'#fff',border:'1px solid #c9a84c',borderRadius:'8px'}}>
          <option value=''>اختر الشهر</option>
          {['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'].map(m=><option key={m} value={m}>{m}</option>)}
        </select>
        {[{p:'السنة',v:year,s:setYear},{p:'الإيرادات (ريال)',v:revenue,s:setRevenue},{p:'المصروفات (ريال)',v:expenses,s:setExpenses},{p:'الرصيد البنكي (ريال)',v:bankBalance,s:setBankBalance},{p:'الديون (ريال)',v:debts,s:setDebts},{p:'الذمم المدينة (ريال)',v:receivables,s:setReceivables}].map(f=>(
          <input key={f.p} placeholder={f.p} value={f.v} onChange={e=>f.s(e.target.value)} style={{width:'100%',padding:'12px',marginBottom:'12px',background:'#1a2a40',color:'#fff',border:'1px solid #2a3a50',borderRadius:'8px',boxSizing:'border-box' as any}} />
        ))}
        <button onClick={handleSave} style={{width:'100%',padding:'14px',background:'#c9a84c',color:'#0a1628',fontWeight:'bold',fontSize:'16px',border:'none',borderRadius:'8px',cursor:'pointer'}}>احسب وحفظ Murdi Score</button>
        {score !== null && (
          <div style={{marginTop:'20px',padding:'20px',background:'#1a2a40',borderRadius:'12px',textAlign:'center',border:'2px solid #c9a84c'}}>
            <p style={{color:'#8899aa',marginBottom:'8px'}}>Murdi Score</p>
            <p style={{color:'#c9a84c',fontSize:'48px',fontWeight:'bold',margin:'0'}}>{score}</p>
            <p style={{color:'#fff',fontSize:'14px'}}>/85 نقطة</p>
          </div>
        )}
        {message && <p style={{color:'#c9a84c',textAlign:'center',marginTop:'15px'}}>{message}</p>}
      </div>
    </div>
  )
}
