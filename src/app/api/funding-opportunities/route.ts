import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const ADMIN_EMAIL = 'hololalmurdi.fs@gmail.com'

export async function POST(req: NextRequest) {
  try {
    const { companyName, revenue, expenses, bank_balance, debts, monthly_payment, receivables, employees, murdiScore, fundingScore, debt_status, margin } = await req.json()
    const annualRevenue = (revenue||0) * 12
    const debtRatio = annualRevenue > 0 ? (debts/annualRevenue*100) : 0

    const prompt = `أنت Murdi — محلل التمويل المتخصص في المقاولات السعودية، مبني على منهجية د. عبدالحكيم المرضي.

بيانات الشركة:
- الإيرادات السنوية: ${annualRevenue.toLocaleString('ar-SA')} ريال
- هامش الربح: ${margin?.toFixed?.(1)||margin}%
- الرصيد البنكي: ${(bank_balance||0).toLocaleString('ar-SA')} ريال
- الديون: ${(debts||0).toLocaleString('ar-SA')} ريال (${debtRatio.toFixed(0)}% من الإيرادات السنوية)
- القسط الشهري: ${(monthly_payment||0).toLocaleString('ar-SA')} ريال
- الموظفون: ${employees}
- Murdi Score: ${murdiScore}/85
- حالة الديون: ${debt_status==='committed'?'ملتزم':debt_status==='late'?'متأخر':'متعثر'}

استخدم معرفتك الكاملة بمنتجات التمويل السعودية للمقاولات من البنوك وشركات التمويل المرخصة من ساما.
قارن بيانات الشركة مع شروط كل منتج وأرجع JSON فقط بدون أي نص خارجه:
{
  "qualifiedCount": 2,
  "nearQualifiedCount": 1,
  "mainBarrier": "العائق الرئيسي بالأرقام الفعلية",
  "opportunities": [
    {"type": "نوع التمويل بدون اسم البنك", "amount": "المبلغ المتوقع", "requirement": "الشرط المحقق", "status": "qualified", "note": "ملاحظة مفيدة"}
  ],
  "secretDetails": "للمشرف: اذكر اسم البنك المحدد وسبب التأهل بالتفصيل لكل منتج",
  "advisorNote": "رسالة للمقاول: جملتان سعوديتان دافئتان تقول أن هناك فرص حقيقية وأن التواصل مع فريق د. عبدالحكيم سيفتح له الأبواب"
}`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-opus-4-8',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }]
      })
    })

    const data = await response.json()
    const text = data.content?.find((b:any)=>b.type==='text')?.text||'{}'
    const clean = text.replace(/```json|```/g,'').trim()

    let parsed:any = {}
    try { parsed = JSON.parse(clean) } catch { parsed = {error:'parse error'} }

    if (parsed.secretDetails && !parsed.error) {
      try {
        await resend.emails.send({
          from: 'د. عبدالحكيم المرضي <noreply@murdi.sa>',
          to: ADMIN_EMAIL,
          subject: `🏦 فرصة تمويلية — ${companyName}`,
          html: `<div dir="rtl" style="font-family:Arial;padding:20px;background:#0B1C3D;color:white;">
            <h2 style="color:#F5C842;">🏦 تحليل تمويلي جديد</h2>
            <p><strong>الشركة:</strong> ${companyName}</p>
            <p><strong>Murdi Score:</strong> ${murdiScore}/85</p>
            <p><strong>الإيرادات السنوية:</strong> ${annualRevenue.toLocaleString('ar-SA')} ريال</p>
            <p><strong>حالة الديون:</strong> ${debt_status}</p>
            <hr style="border-color:#F5C842;">
            <h3 style="color:#F5C842;">📋 التفاصيل السرية:</h3>
            <p style="background:#112244;padding:15px;border-radius:8px;">${parsed.secretDetails}</p>
            <p><strong>عدد المنتجات المؤهلة:</strong> ${parsed.qualifiedCount}</p>
            <p><strong>العائق الرئيسي:</strong> ${parsed.mainBarrier}</p>
          </div>`
        })
      } catch(e) { console.error('email error',e) }
    }

    const { secretDetails, ...publicData } = parsed
    return NextResponse.json(publicData)
  } catch(err:any) {
    return NextResponse.json({error:err.message},{status:500})
  }
}
