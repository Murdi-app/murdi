import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { companyName, revenue, expenses, bank_balance, debts, monthly_payment, receivables, employees, murdiScore, fundingScore, cashRunwayDays, debt_status, late_months, bank_contacted, payment_included } = await req.json()

    const profit = revenue - expenses
    const margin = revenue > 0 ? ((profit / revenue) * 100).toFixed(1) : '0'
    const dso = revenue > 0 ? (receivables / revenue * 30).toFixed(0) : '0'
    const dr = revenue > 0 ? (debts / (revenue * 12) * 100).toFixed(0) : '0'
    const dailyBurn = expenses / 30

    const prompt = `أنت Murdi — المستشار المالي الرقمي المتخصص في شركات المقاولات السعودية.

شركة: ${companyName}
البيانات المالية هذا الشهر:
- الإيرادات: ${revenue?.toLocaleString('ar-SA')} ريال
- المصروفات: ${expenses?.toLocaleString('ar-SA')} ريال
- صافي الربح: ${profit?.toLocaleString('ar-SA')} ريال (هامش ${margin}%)
- الرصيد البنكي: ${bank_balance?.toLocaleString('ar-SA')} ريال
- الديون الإجمالية: ${debts?.toLocaleString('ar-SA')} ريال
- القسط الشهري للديون: ${(monthly_payment||0)?.toLocaleString('ar-SA')} ريال${payment_included==='no' ? ' (غير مشمول في المصروفات — يجب إضافته للعبء الفعلي)' : ' (مشمول في المصروفات)'}
- حالة سداد الديون: ${debt_status==='committed' ? 'ملتزم بالسداد' : debt_status==='late' ? `متأخر عن السداد ${late_months ? late_months+' أشهر' : ''} — خطر على السجل الائتماني` : `متعثر عن السداد منذ ${late_months || 'مدة غير محددة'} — ${bank_contacted==='yes' ? 'جاري التفاوض مع البنك' : 'لم يتواصل مع البنك بعد — خطر قانوني'}`}
- الذمم المدينة: ${receivables?.toLocaleString('ar-SA')} ريال
- عدد الموظفين: ${employees}
- متوسط دورة التحصيل: ${dso} يوم
- نسبة الديون للإيرادات السنوية: ${dr}%
- Murdi Score: ${murdiScore}/85
- جاهزية التمويل: ${fundingScore}/100
- السيولة المتبقية: ${Math.round(cashRunwayDays)} يوم
- المعدل اليومي للصرف: ${Math.round(dailyBurn).toLocaleString("ar-SA")} ريال/يوم

مهمتك: حلل هذه الأرقام بعمق وأرجع تقريراً مالياً ذكياً ومرناً بالتنسيق التالي بالضبط (JSON فقط بدون أي نص خارجه):

{
  "executiveSummary": "ملخص تنفيذي بشري في 3 جمل — الوضع الفعلي + أهم تحدي + أهم فرصة. استخدم الأرقام الحقيقية.",
  "topPriority": "الأولوية الأولى هذا الشهر في جملة واحدة محددة بالأرقام",
  "priorityImpact": "الأثر المتوقع من تنفيذ الأولوية بالأرقام",
  "risks": [
    {"text": "وصف الخطر بالأرقام الحقيقية", "impact": 9, "action": "الإجراء المحدد بالأرقام", "result": "النتيجة المتوقعة بالأرقام"}
  ],
  "strengths": ["نقطة قوة بالأرقام", "نقطة قوة أخرى"],
  "opportunities": ["فرصة مشروطة بوضع الشركة الفعلي", "فرصة أخرى"],
  "advisorNote": "رسالة شخصية من Murdi Advisor بلغة سعودية دافئة — 3 أسطر — تبدأ بصباح الخير يا ${companyName} وتختم بـ وش تبي تعرف أكثر؟"
}

قواعد مهمة:
- إذا الذمم صفر — لا تذكر التحصيل أبداً، ركّز على السيولة والمصروفات والربحية
- إذا الرصيد صفر — هذا الخطر الأول والأهم
- إذا الديون صفر — لا تتحدث عن الديون
- إذا الربح ممتاز — ركّز على فرص التوسع والتمويل
- كل توصية يجب أن تكون مبنية على الأرقام الفعلية للشركة
- الأرقام في risks يجب أن تكون من 1 إلى 10
- أرجع JSON فقط بدون أي نص إضافي`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }]
      })
    })

    const data = await response.json()
    const text = data.content?.find((b: any) => b.type === 'text')?.text || '{}'
    const clean = text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)
    return NextResponse.json(parsed)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
