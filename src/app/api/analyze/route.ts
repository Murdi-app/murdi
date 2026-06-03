import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { companyName, myScore, myLiquidity, myDebtRatio, myCashMonths, marketScore, liquidityMarket, debtMarket, cashMarket, betterThan, revenue, expenses, bankBalance, debts, monthsCount } = body

    const prompt = `أنت مستشار مالي متخصص في شركات المقاولات السعودية.

بيانات شركة "${companyName}":
- Murdi Score: ${myScore}/85 (متوسط السوق: ${marketScore})
- السيولة: ${myLiquidity} شهر (السوق: ${liquidityMarket} شهر)
- نسبة الديون: ${myDebtRatio}% (السوق: ${debtMarket}%)
- أشهر التدفق الموجب: ${myCashMonths} من ${monthsCount} شهر
- الإيرادات الشهرية: ${Number(revenue).toLocaleString()} ريال
- المصروفات الشهرية: ${Number(expenses).toLocaleString()} ريال
- الرصيد البنكي: ${Number(bankBalance).toLocaleString()} ريال
- الديون: ${Number(debts).toLocaleString()} ريال
- الشركة أفضل من ${betterThan}% من شركات المقاولات السعودية

اكتب تحليلاً مالياً احترافياً بالعربي في 3 فقرات بدون عناوين أو نقاط:
اكتب 3 جمل فقط — جملة واحدة لكل نقطة — مكتملة وغير مقتطعة:
جملة 1: وضع الشركة مقارنة بالسوق.
جملة 2: أبرز نقطة قوة + أبرز خطر بالأرقام في جملة واحدة.
جملة 3: القرار الأهم الآن بالأرقام في جملة واحدة مكتملة.`

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
