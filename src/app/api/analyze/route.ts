import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      companyName,
      revenue, expenses, bank_balance, debts, receivables,
      rec_current, rec_late, rec_bad,
      monthly_payment, employees,
      debt_status, late_months, bank_contacted,
      years_in_business, has_gov_contracts, credit_status,
      murdiScore, fundingScore, distress,
      margin, daysLeft, monthlyProfit, dso, debtRatio,
      cashRunwayDate
    } = body

    const recCurrentN = parseFloat(rec_current)||0
    const recLateN = parseFloat(rec_late)||0
    const recBadN = parseFloat(rec_bad)||0
    const recReal = recCurrentN + (recLateN * 0.4) + (recBadN * 0.05)
    const recTotal = recCurrentN + recLateN + recBadN

    const debtStatusText = debt_status === 'committed' ? 'ملتزم بالسداد' : debt_status === 'late' ? `متأخر ${late_months || ''} أشهر${bank_contacted === 'yes' ? ' (تواصل مع البنك)' : ' (لم يتواصل مع البنك)'}` : 'متعثر عن السداد'
    const govText = has_gov_contracts === 'yes' ? 'نعم' : has_gov_contracts === 'pending' ? 'قيد الإرساء' : 'لا'
    const creditText = credit_status === 'clean' ? 'نظيف' : credit_status === 'minor' ? 'ملاحظات بسيطة' : 'ملاحظات جوهرية'

    const systemPrompt = `أنت Murdi — التجسيد الرقمي لمنهجية د. عبدالحكيم المرضي المالية. د. عبدالحكيم مستشار أعمال معتمد، دكتوراه إدارة أعمال، عضو البورد الأمريكي للمستشارين، وخبرة 15+ سنة مع شركات المقاولات السعودية. كل تحليل تقدمه هو تطبيق مباشر لمنهجيته — لا رأي عام، بل منهجية علمية مثبتة في السوق السعودي.

مهمتك: تحليل شامل وعميق لكل جانب من جوانب الشركة — لا تشخيص سطحي. أنت لا تعطي إجابات عامة — أنت تعطي إجابات مخصصة لهذه الشركة بالذات بناءً على أرقامها الفعلية.

قواعد لا تُكسر:
- استخدم الأرقام الفعلية دائماً — لا نصائح عامة
- شخص السبب الجذري لا الأعراض
- كل توصية قابلة للتنفيذ غداً
- لا تذكر الذمم إلا إذا كانت قابلة للتحصيل فعلا (recReal لا recTotal)
- أرجع JSON فقط بدون أي نص قبله أو بعده`

    const userPrompt = `حلل هذه الشركة بعمق كامل:

الشركة: ${companyName}
سنوات في السوق: ${years_in_business || 'غير محدد'}
عدد الموظفين: ${employees || 0}
عقود حكومية: ${govText}
السجل الائتماني: ${creditText}

البيانات المالية:
- الإيرادات الشهرية: ${Number(revenue||0).toLocaleString('ar-SA')} ريال
- المصروفات الشهرية: ${Number(expenses||0).toLocaleString('ar-SA')} ريال
- صافي الربح الشهري: ${Number(monthlyProfit||0).toLocaleString('ar-SA')} ريال
- هامش الربح: ${Number(margin||0).toFixed(1)}%
- الرصيد البنكي: ${Number(bank_balance||0).toLocaleString('ar-SA')} ريال
- أيام السيولة المتبقية: ${Math.round(daysLeft||0)} يوم
- الديون الإجمالية: ${Number(debts||0).toLocaleString('ar-SA')} ريال
- القسط الشهري: ${Number(monthly_payment||0).toLocaleString('ar-SA')} ريال
- حالة الديون: ${debtStatusText}
- نسبة الديون للإيرادات السنوية: ${Number(debtRatio||0).toFixed(0)}%

الذمم المصنفة:
- ذمم سائلة (أقل من 60 يوم): ${recCurrentN.toLocaleString('ar-SA')} ريال — تُحتسب 100%
- ذمم متأخرة (60-180 يوم): ${recLateN.toLocaleString('ar-SA')} ريال — تُحتسب 40%
- ذمم مشكوك فيها (أكثر من 180 يوم): ${recBadN.toLocaleString('ar-SA')} ريال — تُحتسب 5%
- الذمم القابلة للتحصيل فعلاً: ${Math.round(recReal).toLocaleString('ar-SA')} ريال
- إجمالي الذمم في الدفاتر: ${recTotal.toLocaleString('ar-SA')} ريال

المؤشرات:
- Murdi Score: ${murdiScore}/85
- Distress Index: ${distress}/100
- Funding Score: ${fundingScore}/100
- دورة التحصيل: ${Math.round(dso||0)} يوم
${cashRunwayDate ? `- تاريخ نفاد السيولة: ${cashRunwayDate}` : ''}

أرجع JSON فقط بهذا الهيكل بالضبط:
{
  "rootCause": "السبب الجذري الحقيقي لأكبر مشكلة في الشركة — جملة واحدة دقيقة بالأرقام",
  "executiveSummary": "فقرة واحدة من 3 جمل: وضع الشركة الحقيقي + أبرز نقطة قوة + أبرز خطر — بالأرقام الفعلية لا الكلام العام",
  "topRisks": [
    {
      "rank": 1,
      "title": "عنوان الخطر",
      "detail": "شرح الخطر بالأرقام الفعلية",
      "action": "إجراء واحد محدد قابل للتنفيذ غداً",
      "result": "النتيجة المتوقعة بالأرقام",
      "impact": 9
    }
  ],
  "strengths": [
    {
      "title": "نقطة القوة",
      "detail": "شرح بالأرقام وكيف تستثمرها"
    }
  ],
  "opportunities": [
    {
      "title": "الفرصة",
      "detail": "كيف تستغلها بالأرقام والخطوات"
    }
  ],
  "distressNarrative": "تفسير رقم Distress Index بالسياق الحقيقي للشركة — ليس فقط الرقم",
  "scenarios": {
    "worst": "إذا لم تتحرك خلال 30 يوماً — ماذا سيحدث بالأرقام؟",
    "realistic": "إذا نفّذت الإجراء الأول فقط — ماذا سيتغير؟",
    "best": "إذا نفّذت كل التوصيات خلال 90 يوماً — أين ستكون شركتك؟"
  },
  "fundingPath": "مسار تمويل محدد مناسب لهذه الشركة بالذات — ليس كلاماً عاماً",
  "advisorNote": "رسالة شخصية دافئة من د. عبدالحكيم — جملتان بلغة سعودية تشعر صاحب الشركة أن أحداً يفهمه فعلاً",
  "weeklyPulse": "أهم شيء يجب مراقبته هذا الأسبوع — رقم واحد أو مؤشر واحد محدد",
  "topPriority": "الإجراء الواحد الأهم هذا الشهر",
  "priorityImpact": "الأثر المتوقع من هذا الإجراء بالأرقام"
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
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      })
    })

    const data = await response.json()
    const text = data.content?.find((b: any) => b.type === 'text')?.text || ''

    let parsed: any = {}
    try {
      // إزالة كل أنواع code blocks
      const clean = text
        .replace(/^```json\s*/gm, '')
        .replace(/^```\s*/gm, '')
        .replace(/\s*```$/gm, '')
        .trim()
      const s = clean.indexOf('{')
      const e = clean.lastIndexOf('}')
      if (s !== -1 && e !== -1) {
        parsed = JSON.parse(clean.slice(s, e + 1))
      } else {
        parsed = { executiveSummary: clean }
      }
    } catch(parseErr) {
      // محاولة ثانية — استخراج JSON مباشرة
      try {
        const match = text.match(/\{[\s\S]*\}/)
        if (match) parsed = JSON.parse(match[0])
        else parsed = { executiveSummary: text }
      } catch { parsed = { executiveSummary: text } }
    }

    return NextResponse.json(parsed)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
