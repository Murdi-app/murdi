import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const ADMIN_EMAIL = 'hololalmurdi.fs@gmail.com'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' } })
  }

  try {
    const { companyName, revenue, expenses, bank_balance, debts, monthly_payment, receivables, employees, murdiScore, fundingScore, debt_status, margin } = await req.json()
    const annualRevenue = (revenue||0) * 12
    const debtRatio = annualRevenue > 0 ? (debts/annualRevenue*100) : 0

    const prompt = `أنت Murdi — محلل التمويل المتخصص في المقاولات السعودية، مبني على منهجية د. عبدالحكيم المرضي.

بيانات الشركة:
- الإيرادات السنوية: ${annualRevenue.toLocaleString('ar-SA')} ريال
- هامش الربح: ${typeof margin === 'number' ? margin.toFixed(1) : margin}%
- الرصيد البنكي: ${(bank_balance||0).toLocaleString('ar-SA')} ريال
- الديون: ${(debts||0).toLocaleString('ar-SA')} ريال (${debtRatio.toFixed(0)}% من الإيرادات السنوية)
- القسط الشهري: ${(monthly_payment||0).toLocaleString('ar-SA')} ريال
- الموظفون: ${employees}
- Murdi Score: ${murdiScore}/85
- حالة الديون: ${debt_status==='committed'?'ملتزم':debt_status==='late'?'متأخر':'متعثر'}

ابحث الآن في الإنترنت عن أحدث منتجات التمويل المتاحة للمقاولات في السعودية من البنوك وشركات التمويل المرخصة من ساما.
ابحث في مواقع: بنك الرياض، البنك الأهلي، بنك البلاد، بنك الإنماء، مصرف الراجحي، بنك ساب، البنك السعودي الفرنسي، برنامج ضمان كفالة، صندوق المئوية، SRC.

قارن بيانات الشركة مع أحدث الشروط وأرجع JSON فقط:
{
  "qualifiedCount": 2,
  "nearQualifiedCount": 1,
  "mainBarrier": "العائق الرئيسي بالأرقام الفعلية",
  "opportunities": [
    {"type": "نوع التمويل بدون اسم البنك", "amount": "المبلغ المتوقع", "requirement": "الشرط المحقق", "status": "qualified", "note": "ملاحظة"}
  ],
  "secretDetails": "للمشرف: اذكر اسم البنك المحدد وسبب التأهل بالتفصيل مع الشروط الحالية",
  "advisorNote": "رسالة للمقاول: جملتان سعوديتان دافئتان عن الفرص المتاحة وأهمية التواصل مع فريق د. عبدالحكيم"
}`

    // استدعاء Claude مع web search
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 2000,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: prompt }]
      })
    })

    const data = await response.json()
    const text = data.content?.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('') || '{}'
    const clean = text.replace(/```json|```/g, '').trim()

    let parsed: any = {}
    try { parsed = JSON.parse(clean) } catch { parsed = { error: 'parse error', raw: text.slice(0, 200) } }

    // إرسال إيميل سري
    if (parsed.secretDetails && !parsed.error && RESEND_API_KEY) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'Murdi <onboarding@resend.dev>',
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
      })
    }

    const { secretDetails, ...publicData } = parsed
    return new Response(JSON.stringify(publicData), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })
  }
})
