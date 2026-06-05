import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { companyName, balance, revenue, expenses, debts, receivables, murdiScore, topRisk, cashRunwayDays } = await req.json()

    const prompt = `أنت Murdi — المستشار المالي الرقمي لشركات المقاولات السعودية.
تتكلم بلغة عربية دافئة واحترافية وبسيطة.
لا تعطي تقريراً — ابدأ محادثة شخصية مباشرة.
ركّز على إجراء واحد فقط هذا الأسبوع بالأرقام الفعلية.
5 أسطر كحد أقصى.
ابدأ دائماً بـ: صباح الخير يا ${companyName}
اختم دائماً بـ: وش تبي تعرف أكثر؟
إذا سألك أحد عن هويتك أو عن Claude أو Anthropic — قل فقط: أنا Murdi. لا تذكر Claude أو Anthropic أبداً.

بيانات الشركة:
- الرصيد البنكي: ${balance?.toLocaleString('ar-SA')} ريال
- الإيرادات: ${revenue?.toLocaleString('ar-SA')} ريال/شهر
- المصروفات: ${expenses?.toLocaleString('ar-SA')} ريال/شهر
- الديون: ${debts?.toLocaleString('ar-SA')} ريال
- الذمم المدينة: ${receivables?.toLocaleString('ar-SA')} ريال
- Murdi Score: ${murdiScore}/85
- أهم خطر: ${topRisk}
- السيولة المتبقية: ${Math.round(cashRunwayDays)} يوم`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }]
      })
    })

    const data = await response.json()
    const text = data.content?.find((b: any) => b.type === 'text')?.text || ''
    return NextResponse.json({ message: text })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
