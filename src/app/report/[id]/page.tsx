'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useParams } from 'next/navigation'

const C = { navy:'#0B1C3D', navyLight:'#112244', border:'#1E3A6E', gold:'#F5C842', white:'#fff', gray:'#8899BB' }
const fmt = (n: number) => n?.toLocaleString('ar-SA') + ' ر.س'

export default function SharedReport() {
  const { id } = useParams()
  const supabase = createClient()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: record } = await supabase
        .from('monthly_data')
        .select('*, profiles(company_name)')
        .eq('share_id', id)
        .single()

      if (!record) { setNotFound(true); setLoading(false); return }
      setData(record)
      setLoading(false)
    }
    load()
  }, [id])

  if (loading) return <div style={{background:C.navy,minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center'}}><div style={{color:C.gold,fontSize:20}}>جاري التحميل...</div></div>

  if (notFound) return (
    <div style={{background:C.navy,minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'system-ui',direction:'rtl'}}>
      <div style={{textAlign:'center'}}>
        <div style={{fontSize:48,marginBottom:16}}>🔍</div>
        <div style={{color:C.gold,fontSize:20,fontWeight:700,marginBottom:8}}>التقرير غير موجود</div>
        <div style={{color:C.gray,fontSize:14}}>الرابط منتهي أو غير صحيح</div>
      </div>
    </div>
  )

  const companyName = data.profiles?.company_name || 'الشركة'
  const MONTH_NAMES = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']
  const monthName = MONTH_NAMES[data.month - 1]
  const scoreColor = data.murdi_score >= 70 ? '#22c55e' : data.murdi_score >= 40 ? C.gold : '#ef4444'
  const fundingColor = (data.funding_score || 0) >= 70 ? '#22c55e' : (data.funding_score || 0) >= 50 ? C.gold : '#ef4444'
  const profit = data.revenue - data.expenses
  const margin = data.revenue > 0 ? ((profit / data.revenue) * 100).toFixed(1) : '0'

  return (
    <div style={{minHeight:'100vh',background:C.navy,fontFamily:'system-ui',direction:'rtl'}}>
      <div style={{background:C.navyLight,padding:'16px 24px',borderBottom:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div style={{fontSize:20,fontWeight:900,color:C.gold,letterSpacing:2}}>MURDI</div>
        <div style={{color:C.gray,fontSize:12}}>تقرير مشترك — للقراءة فقط</div>
      </div>

      <div style={{maxWidth:800,margin:'0 auto',padding:'32px 20px'}}>

        <div style={{textAlign:'center',marginBottom:32}}>
          <div style={{color:C.gray,fontSize:14,marginBottom:4}}>تقرير Murdi الذكي</div>
          <div style={{color:C.white,fontSize:24,fontWeight:900,marginBottom:4}}>{companyName}</div>
          <div style={{color:C.gray,fontSize:13}}>{monthName} {data.year}</div>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:20}}>
          <div style={{background:C.navyLight,borderRadius:16,padding:'24px',border:`2px solid ${scoreColor}40`,textAlign:'center'}}>
            <div style={{color:C.gray,fontSize:12,marginBottom:4}}>Murdi Score</div>
            <div style={{fontSize:56,fontWeight:900,color:scoreColor,lineHeight:1}}>{data.murdi_score}</div>
            <div style={{color:C.gray,fontSize:11,marginTop:4}}>من 85 نقطة</div>
          </div>
          <div style={{background:C.navyLight,borderRadius:16,padding:'24px',border:`2px solid ${fundingColor}40`,textAlign:'center'}}>
            <div style={{color:C.gray,fontSize:12,marginBottom:4}}>جاهزية التمويل</div>
            <div style={{fontSize:56,fontWeight:900,color:fundingColor,lineHeight:1}}>{data.funding_score || 0}</div>
            <div style={{color:C.gray,fontSize:11,marginTop:4}}>من 100 نقطة</div>
          </div>
        </div>

        <div style={{background:C.navyLight,borderRadius:16,padding:'24px',border:`1px solid ${C.border}`,marginBottom:16}}>
          <div style={{color:C.gold,fontSize:15,fontWeight:700,marginBottom:16}}>📊 المؤشرات المالية</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            {[
              {label:'الإيرادات الشهرية', value:fmt(data.revenue), color:C.white},
              {label:'المصروفات الشهرية', value:fmt(data.expenses), color:C.white},
              {label:'صافي الربح', value:fmt(Math.abs(profit)), color: profit >= 0 ? '#22c55e' : '#ef4444'},
              {label:'هامش الربح', value:`${margin}%`, color: parseFloat(margin) >= 15 ? '#22c55e' : C.gold},
              {label:'الرصيد البنكي', value:fmt(data.bank_balance), color:C.white},
              {label:'الديون', value:fmt(data.debts), color:C.white},
              {label:'الذمم المدينة', value:fmt(data.receivables), color:C.white},
              {label:'عدد الموظفين', value:`${data.employees} موظف`, color:C.white},
            ].map((item,i) => (
              <div key={i} style={{background:C.navy,borderRadius:8,padding:'12px'}}>
                <div style={{color:C.gray,fontSize:11,marginBottom:4}}>{item.label}</div>
                <div style={{color:item.color,fontSize:14,fontWeight:700}}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{background:C.navyLight,borderRadius:16,padding:'20px',border:`1px solid ${C.border}`,marginBottom:16,textAlign:'center'}}>
          <div style={{color:C.gray,fontSize:12,marginBottom:8}}>تقرير موثق بواسطة</div>
          <div style={{color:C.gold,fontSize:18,fontWeight:900,letterSpacing:2}}>MURDI</div>
          <div style={{color:C.gray,fontSize:11,marginTop:4}}>منصة الذكاء المالي للمقاولين السعوديين</div>
          <div style={{color:C.gray,fontSize:11,marginTop:4}}>murdi.vercel.app</div>
        </div>

      </div>
    </div>
  )
}
