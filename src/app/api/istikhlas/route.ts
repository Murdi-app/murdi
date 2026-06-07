import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { invoices, current } = await req.json()
    // invoices: [{value, submittedDaysAgo, status, entity}] | current: {bank_balance, expenses}

    const systemPrompt = `أنت "محرك المستخلصات" في Murdi — متخصص في إدارة المستخلصات الحكومية للمقاولين السعوديين عبر منصة اعتماد، وفق منهجية د. عبدالحكيم المرضي.

تعرف من الداخل:
- المستخلص الحكومي يمر بمراحل: تقديم ← مراجعة فنية ← اعتماد ← صرف. كل مرحلة قد تتأخر.
- المعتاد: 30-60 يوم من التقديم للصرف. أكثر من 90 يوم = تأخر غير طبيعي يستوجب متابعة عاجلة.
- ملاحظات فنية تجمّد المستخلص لأشهر.
- ضمان حسن التنفيذ 5% يُحتجز ولا يُصرف مع المستخلص.
- المقاول الذكي يتابع أسبوعياً ويجهّز المستندات قبل طلبها.

قواعد صارمة:
- أرجع JSON خاماً فقط. ابدأ بـ { وانتهِ بـ }.
- استخدم فقط الأرقام المعطاة. لا تخترع.
- كن عملياً ومباشراً — كل توصية قابلة للتنفيذ هذا الأسبوع.`

    const invList = invoices.map((inv: any, i: number) =>
      `${i+1}. قيمة ${Number(inv.value).toLocaleString('ar-SA')} ريال | قُدّم قبل ${inv.submittedDaysAgo} يوم | الحالة: ${inv.status}${inv.entity ? ' | الجهة: ' + inv.entity : ''}`
    ).join('\n')

    const totalPending = invoices.reduce((s: number, i: any) => s + (Number(i.value)||0), 0)

    const prompt = `مستخلصات المقاول المعلّقة:
${invList}

إجمالي السيولة المجمّدة في المستخلصات: ${totalPending.toLocaleString('ar-SA')} ريال
رصيد المقاول البنكي الحالي: ${Number(current.bank_balance||0).toLocaleString('ar-SA')} ريال
مصروفاته الشهرية: ${Number(current.expenses||0).toLocaleString('ar-SA')} ريال

حلّل وأرجع هذا الـ JSON بالضبط:
{
  "frozenLiquidity": "إجمالي السيولة المجمّدة ونسبتها مقارنة برصيده — بالأرقام",
  "criticalInvoice": "أكثر مستخلص يستوجب متابعة عاجلة ولماذا (الأطول تأخراً) — بالأرقام",
  "expectedTiming": "متى يتوقع صرف المستخلصات بناءً على المعتاد (30-60 يوم) — وأيها تجاوز الطبيعي",
  "guaranteeHeld": "تقدير ضمان حسن التنفيذ المحتجز (5% من إجمالي المستخلصات) الذي لن يُصرف الآن",
  "actions": ["إجراء متابعة 1 لهذا الأسبوع", "إجراء 2", "إجراء 3"],
  "cashUnlock": "لو صُرف أقرب مستخلص، كم سيمتد بقاء الشركة بالأيام — بالأرقام",
  "advisorNote": "نصيحة د. عبدالحكيم المباشرة عن إدارة المستخلصات — جملتان"
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
        max_tokens: 1400,
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }]
      })
    })

    const data = await response.json()
    if (data.error) return NextResponse.json({ error: data.error.message }, { status: 200 })
    const text = data.content?.find((b: any) => b.type === 'text')?.text || ''
    let parsed: any = {}
    try { parsed = JSON.parse(text) }
    catch {
      const m = text.match(/\{[\s\S]*\}/)
      if (m) parsed = JSON.parse(m[0])
      else return NextResponse.json({ error: 'تعذّر تحليل المستخلصات' }, { status: 200 })
    }
    return NextResponse.json(parsed)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
