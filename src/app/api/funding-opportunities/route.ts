import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const ADMIN_EMAIL = 'hololalmurdi.fs@gmail.com'

export async function POST(req: NextRequest) {
  try {
    const { companyName, revenue, expenses, bank_balance, debts, monthly_payment, receivables, employees, murdiScore, fundingScore, debt_status, margin } = await req.json()

    const prompt = `أنت Murdi — محلل التمويل الرقمي المتخصص في شركات المقاولات السعودية، مبني على منهجية د. عبدالحكيم المرضي.

بيانات الشركة:
- الاسم: ${companyName}
- الإيرادات الشهرية: ${revenue?.toLocaleString('ar-SA')} ريال (${(revenue*12)?.toLocaleString('ar-SA')} سنوياً)
- المصروفات الشهرية: ${expenses?.toLocaleString('ar-SA')} ريال
- هامش الربح: ${margin?.toFixed ? margin.toFixed(1) : margin}%
- الرصيد البنكي: ${bank_balance?.toLocaleString('ar-SA')} ريال
- الديون الإجمالية: ${debts?.toLocaleString('ar-SA')} ريال
- القسط الشهري: ${(monthly_payment||0)?.toLocaleString('ar-SA')} ريال
- الذمم المدينة: ${receivables?.toLocaleString('ar-SA')} ريال
- عدد الموظفين: ${employees}
- Murdi Score: ${murdiScore}/85
- جاهزية التمويل: ${fundingScore}/100
- حالة الديون: ${debt_status === 'committed' ? 'ملتزم' : debt_status === 'late' ? 'متأخر' : 'متعثر'}

مهمتك:
ابحث في الإنترنت عن منتجات التمويل المتاحة للمقاولات في السعودية من: بنك الرياض، البنك الأهلي، بنك البلاد، بنك الإنماء، البنك السعودي الفرنسي، مصرف الراجحي، بنك ساب، شركة تمويل سهل، شركة أمان للتمويل، صندوق المئوية، برنامج ضمان، صندوق التنمية الصناعية.

ابحث عن شروط كل منتج: الحد الأدنى للإيرادات، نسبة الديون المقبولة، عدد الموظفين، السنوات في السوق، الضمانات المطلوبة.

قارن شروط كل منتج بأرقام الشركة أعلاه.

أرجع JSON بهذا التنسيق:
{
  "qualifiedCount": 2,
  "nearQualifiedCount": 1,
  "mainBarrier": "نقطة الضعف الرئيسية بالأرقام",
  "opportunities": [
    {
      "type": "نوع التمويل (مثال: تمويل رأس المال العامل)",
      "amount": "المبلغ المتوقع التأهل له",
      "requirement": "الشرط الرئيسي",
      "status": "qualified أو near_qualified",
      "note": "ملاحظة مهمة"
    }
  ],
  "secretDetails": "للمشرف فقط: اذكر اسم البنك أو الجهة المحددة مع التفاصيل الكاملة لكل منتج وسبب التأهل أو عدمه",
  "advisorNote": "رسالة للمقاول: أخبره أن هناك فرص تمويلية حقيقية ولكن للوصول إليها يحتاج تواصل مع فريق د. عبدالحكيم — جملتان بلغة سعودية دافئة"
}`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 3000,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: prompt }]
      })
    })

    const data = await response.json()
    const text = data.content?.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('') || '{}'
    const clean = text.replace(/```json|```/g, '').trim()
    
    let parsed: any = {}
    try { parsed = JSON.parse(clean) } catch { parsed = { error: 'parse error' } }

    // إرسال إيميل سري للمشرف
    if (parsed.secretDetails && !parsed.error) {
      try {
        await resend.emails.send({
          from: 'Murdi <onboarding@resend.dev>',
          to: ADMIN_EMAIL,
          subject: `🏦 فرصة تمويلية — ${companyName}`,
          html: `
            <div dir="rtl" style="font-family: Arial; padding: 20px; background: #0B1C3D; color: white;">
              <h2 style="color: #F5C842;">🏦 تحليل تمويلي جديد</h2>
              <p><strong>الشركة:</strong> ${companyName}</p>
              <p><strong>Murdi Score:</strong> ${murdiScore}/85</p>
              <p><strong>جاهزية التمويل:</strong> ${fundingScore}/100</p>
              <p><strong>الإيرادات السنوية:</strong> ${(revenue*12)?.toLocaleString('ar-SA')} ريال</p>
              <p><strong>حالة الديون:</strong> ${debt_status}</p>
              <hr style="border-color: #F5C842;">
              <h3 style="color: #F5C842;">📋 التفاصيل السرية:</h3>
              <p style="background: #112244; padding: 15px; border-radius: 8px;">${parsed.secretDetails}</p>
              <hr style="border-color: #F5C842;">
              <p><strong>عدد المنتجات المؤهلة:</strong> ${parsed.qualifiedCount}</p>
              <p><strong>عائق رئيسي:</strong> ${parsed.mainBarrier}</p>
            </div>
          `
        })
      } catch (emailErr) {
        console.error('Email error:', emailErr)
      }
    }

    // إرجاع النتيجة بدون secretDetails للمقاول
    const { secretDetails, ...publicData } = parsed
    return NextResponse.json(publicData)

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
