import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { companyName, balance, revenue, expenses, debts, receivables, murdiScore, question } = await req.json()

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 250,
        system: `أنت Murdi — المستشار المالي الرقمي لشركة ${companyName}.
بيانات الشركة:
- الرصيد: ${balance?.toLocaleString('ar-SA')} ريال
- الإيرادات: ${revenue?.toLocaleString('ar-SA')} ريال/شهر
- المصروفات: ${expenses?.toLocaleString('ar-SA')} ريال/شهر
- الديون: ${debts?.toLocaleString('ar-SA')} ريال
- الذمم: ${receivables?.toLocaleString('ar-SA')} ريال
- Murdi Score: ${murdiScore}/85

أجب بناءً على هذه الأرقام فقط.
3 أسطر كحد أقصى.
لغة عربية سعودية بسيطة ومباشرة.
لا تكرر السؤال.`,
        messages: [{ role: 'user', content: question }]
      })
    })

    const data = await response.json()
    const text = data.content?.find((b: any) => b.type === 'text')?.text || ''
    return NextResponse.json({ answer: text })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
