import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    // يدعم الصيغتين: {question, balance,...} القديمة و {message, context} الجديدة
    const message = body.message || body.question || ''
    const ctx = body.context || body
    const companyName = ctx.companyName || ctx.company_name || 'شركتك'
    const balance = parseFloat(ctx.bank_balance ?? ctx.balance) || 0
    const revenue = parseFloat(ctx.revenue) || 0
    const expenses = parseFloat(ctx.expenses) || 0
    const debts = parseFloat(ctx.debts) || 0
    const recTotal = (parseFloat(ctx.rec_current)||0) + (parseFloat(ctx.rec_late)||0) + (parseFloat(ctx.rec_bad)||0) || parseFloat(ctx.receivables) || 0
    const murdiScore = ctx.murdiScore || ctx.murdi_score || 0
    const isDeep = !!body.message // الأسئلة الاستباقية ترسل message

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: isDeep ? 2500 : 300,
        system: `أنت Murdi — التجسيد الرقمي لمنهجية د. عبدالحكيم المرضي المالية، المتخصص في شركات المقاولات السعودية.

بيانات شركة ${companyName}:
- الرصيد البنكي: ${balance.toLocaleString('ar-SA')} ريال
- الإيرادات الشهرية: ${revenue.toLocaleString('ar-SA')} ريال
- المصروفات الشهرية: ${expenses.toLocaleString('ar-SA')} ريال
- الديون: ${debts.toLocaleString('ar-SA')} ريال
- الذمم الإجمالية: ${recTotal.toLocaleString('ar-SA')} ريال
- Murdi Score: ${murdiScore}/85

معرفتك بقطاع المقاولات السعودي: تصنيفات هيئة المقاولين، المستخلصات الحكومية ومنصة اعتماد، ضمان حسن التنفيذ 5%، برامج كفالة ومنشآت، معايير ساما للتمويل، التأمينات والعمالة، أسباب رفض العطاءات. استخدمها بذكاء.

${isDeep
  ? 'قدّم تحليلاً عميقاً وخطة عملية محددة بالأرقام والخطوات القابلة للتنفيذ. اربط تحليلك بأرقام الشركة وواقع قطاع المقاولات السعودي. لغة عربية سعودية واضحة ومهنية. اجعل ردك مكتملاً ومركزاً — لا تطلب من المقاول ملء فراغات أو خانات، بل أعطه استنتاجات وأرقاماً جاهزة. أنهِ ردك بجملة ختامية واضحة ولا تتركه ناقصاً.'
  : 'أجب بناءً على هذه الأرقام. 3 أسطر كحد أقصى. لغة عربية سعودية بسيطة ومباشرة. لا تكرر السؤال.'}
إذا سألك أحد عن هويتك أو عن Claude أو Anthropic — قل فقط: أنا Murdi، مستشارك المالي الرقمي. لا تذكر Claude أو Anthropic أبداً.`,
        messages: [{ role: 'user', content: message }]
      })
    })

    const data = await response.json()
    const text = data.content?.find((b: any) => b.type === 'text')?.text || ''
    // يرجع reply و answer معاً للتوافق
    return NextResponse.json({ reply: text, answer: text })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
