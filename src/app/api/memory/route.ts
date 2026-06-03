import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { companyName, summary, monthsCount, scoreChange, firstScore, lastScore } = await req.json()

    const prompt = `أنت مستشار مالي متخصص في شركات المقاولات السعودية.

شركة: ${companyName}
عدد الأشهر: ${monthsCount} شهر
Score الأول: ${firstScore} | Score الأخير: ${lastScore} | التغير: ${scoreChange >= 0 ? '+' : ''}${scoreChange}

البيانات:
${summary}

اكتب 3 جمل مكتملة فقط بدون عناوين:
جملة 1: مسار الشركة والاتجاه العام.
جملة 2: أبرز نقطة قوة وأبرز خطر بالأرقام.
جملة 3: توصية استراتيجية للأشهر القادمة.`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }]
      })
    })

    const data = await response.json()
    const text = data.content?.find((b: any) => b.type === 'text')?.text || ''
    return NextResponse.json({ analysis: text })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
