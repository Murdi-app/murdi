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

    const systemPrompt = `أنت Murdi — محلل التمويل المتخصص في المقاولات السعودية، مبني على منهجية د. عبدالحكيم المرضي.
استخدم web search للبحث عن أحدث منتجات التمويل السعودية للمقاولات من البنوك وشركات التمويل والبرامج الحكومية.
أرجع JSON فقط بدون أي نص قبله أو بعده.`

    const userPrompt = `بيانات الشركة:
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

ابحث في الإنترنت عن أحدث منتجات تمويل المقاولين في السعودية (بنوك + شركات تمويل + برامج حكومية) ثم قارنها ببيانات الشركة.

أرجع JSON فقط، ابدأ مباشرة بـ { :
{
  "qualifiedCount": 3,
  "nearQualifiedCount": 2,
  "mainBarrier": "العائق الرئيسي بالأرقام",
  "opportunities": [
    {
      "type": "نوع التمويل بدون اسم الجهة",
      "amount": "المبلغ المتوقع",
      "requirement": "الشرط الرئيسي الذي تحققه",
      "status": "qualified",
      "note": "ملاحظة للمقاول"
    }
  ],
  "secretDetails": "للمشرف: اذكر كل بنك وجهة بالتفصيل مع سبب التأهل أو عدمه والشروط الدقيقة",
  "advisorNote": "رسالة دافئة للمقاول جملتان"
}`

    // Multi-turn loop للتعامل مع web search
    const MODELS = ['claude-fable-5', 'claude-sonnet-4-5-20250929'];
    let finalText = '';
    for (const model of MODELS) {
      try {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model,
            max_tokens: 4000,
            messages: [{ role: 'user', content: userPrompt }],
            tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }],
          }),
        });
        if (!res.ok) continue;
        const data = await res.json();
        finalText = (data.content || [])
          .filter((b: any) => b.type === 'text')
          .map((b: any) => b.text)
          .join('\n').trim();
        if (finalText.length > 50) break;
      } catch { continue; }
    }

    let parsed: any = null;
    const sIdx = finalText.indexOf('{');
    const eIdx = finalText.lastIndexOf('}');
    if (sIdx !== -1 && eIdx > sIdx) {
      try { parsed = JSON.parse(finalText.slice(sIdx, eIdx + 1)); } catch {}
    }
      }
    } catch (parseErr) {
      console.log('PARSE ERROR:', parseErr)
    }

    if (!parsed.qualifiedCount && !parsed.opportunities) {
      parsed = {
        qualifiedCount: 0,
        nearQualifiedCount: 0,
        mainBarrier: 'تعذر التحليل — حاول مرة أخرى',
        opportunities: [],
        advisorNote: 'حاول مرة أخرى خلال دقيقة'
      }
    }

    // إرسال إيميل للمشرف
    if (parsed.secretDetails && RESEND_API_KEY) {
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'د. عبدالحكيم المرضي <noreply@murdi.sa>',
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
      } catch (e) { console.error('email error', e) }
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
