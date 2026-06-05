import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const ADMIN_EMAIL = 'hololalmurdi.fs@gmail.com'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' } })
  }

  try {
    const { companyName, revenue, expenses, bank_balance, debts, monthly_payment, receivables, employees, murdiScore, fundingScore, debt_status, margin, years_in_business, has_gov_contracts, credit_status } = await req.json()
    
    const annualRevenue = (revenue||0) * 12
    const debtRatio = annualRevenue > 0 ? (debts/annualRevenue*100) : 0

    const prompt = `أنت Murdi — محلل التمويل المتخصص في المقاولات السعودية، مبني على منهجية د. عبدالحكيم المرضي.

بيانات الشركة الكاملة:
- الإيرادات السنوية: ${annualRevenue.toLocaleString('ar-SA')} ريال
- هامش الربح: ${typeof margin === 'number' ? margin.toFixed(1) : margin}%
- الرصيد البنكي: ${(bank_balance||0).toLocaleString('ar-SA')} ريال
- الديون الإجمالية: ${(debts||0).toLocaleString('ar-SA')} ريال (${debtRatio.toFixed(0)}% من الإيرادات السنوية)
- القسط الشهري: ${(monthly_payment||0).toLocaleString('ar-SA')} ريال
- الذمم المدينة: ${(receivables||0).toLocaleString('ar-SA')} ريال
- عدد الموظفين: ${employees}
- سنوات الشركة في السوق: ${years_in_business} سنة
- عقود حكومية نشطة: ${has_gov_contracts==='yes'?'نعم':has_gov_contracts==='pending'?'قيد الإرساء':'لا'}
- السجل الائتماني: ${credit_status==='clean'?'نظيف':credit_status==='minor'?'ملاحظات بسيطة':'ملاحظات جوهرية'}
- حالة الديون: ${debt_status==='committed'?'ملتزم بالسداد':debt_status==='late'?'متأخر عن السداد':'متعثر عن السداد'}
- Murdi Score: ${murdiScore}/85

ابحث في منتجات التمويل السعودية المتاحة للمقاولات وقارنها بهذه البيانات.
ركز على: بنوك (الرياض، الأهلي، البلاد، الإنماء، الراجحي، ساب، الفرنسي)، برامج حكومية (ضمان كفالة، صندوق المئوية، SRC، صندوق التنمية الصناعية).

شروط مهمة تراعيها:
- سنوات العمل: معظم البنوك تشترط سنتين+
- العقود الحكومية: تفتح باب تمويل المستخلصات والمشاريع
- السجل الائتماني: ملاحظات جوهرية تمنع التمويل البنكي
- نسبة الديون: أغلب البنوك تشترط أقل من 60-80%
- التعثر: يمنع التمويل حتى تسوية الوضع

أرجع JSON فقط بدون أي نص خارجه:
{
  "qualifiedCount": 3,
  "nearQualifiedCount": 2,
  "mainBarrier": "العائق الرئيسي بالأرقام الفعلية",
  "opportunities": [
    {
      "type": "نوع التمويل بدون اسم البنك",
      "amount": "المبلغ المتوقع التأهل له",
      "requirement": "الشرط الرئيسي الذي تحققه",
      "status": "qualified",
      "note": "ملاحظة مهمة للمقاول"
    }
  ],
  "secretDetails": "للمشرف فقط: اذكر اسم كل بنك أو جهة بالتفصيل مع سبب التأهل أو عدمه والشروط الدقيقة",
  "advisorNote": "رسالة للمقاول: جملتان بلغة سعودية دافئة تخبره أن عنده فرص حقيقية وأن فريق د. عبدالحكيم يقدر يفتح له الأبواب"
}`

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
    
    // استخراج JSON بذكاء
    let clean = text
    const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/)
    if (jsonMatch) {
      clean = jsonMatch[1].trim()
    } else {
      const start = text.indexOf('{')
      const end = text.lastIndexOf('}')
      if (start !== -1 && end !== -1) clean = text.slice(start, end + 1)
    }

    let parsed: any = {}
    try { parsed = JSON.parse(clean) } catch { parsed = { error: 'parse error', raw: text.slice(0, 300) } }

    if (parsed.secretDetails && !parsed.error && RESEND_API_KEY) {
      try {
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
              <p><strong>سنوات العمل:</strong> ${years_in_business}</p>
              <p><strong>عقود حكومية:</strong> ${has_gov_contracts}</p>
              <p><strong>السجل الائتماني:</strong> ${credit_status}</p>
              <p><strong>حالة الديون:</strong> ${debt_status}</p>
              <hr style="border-color:#F5C842;">
              <h3 style="color:#F5C842;">📋 التفاصيل السرية:</h3>
              <p style="background:#112244;padding:15px;border-radius:8px;white-space:pre-wrap;">${parsed.secretDetails}</p>
              <p><strong>عدد المنتجات المؤهلة:</strong> ${parsed.qualifiedCount}</p>
              <p><strong>العائق الرئيسي:</strong> ${parsed.mainBarrier}</p>
            </div>`
          })
        })
      } catch(e) { console.error('email error', e) }
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
