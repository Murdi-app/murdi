import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { current, project } = await req.json()

    const systemPrompt = `أنت "التوأم المالي" في Murdi — التجسيد الرقمي لمنهجية د. عبدالحكيم المرضي في تحليل قرارات شركات المقاولات السعودية قبل اتخاذها.

مهمتك: يعطيك المقاول مشروعاً أو قراراً كبيراً يفكّر فيه، فتحاكي أثره الكامل على شركته قبل أن يقرّر — كأنك تشغّل نسخة افتراضية من شركته.

قواعد صارمة:
- أرجع JSON خاماً فقط. ابدأ بـ { وانتهِ بـ }.
- استخدم فقط الأرقام المعطاة. لا تخترع أي رقم.
- حلل بصدق: المشروع المربح ظاهرياً قد يدمّر السيولة إن كانت الدفعات متأخرة.
- راعِ خصائص المقاولات السعودية: المستخلصات تتأخر، ضمان حسن التنفيذ 5% محتجز، التمويل يزيد الديون.
- إن كان القرار خطيراً على الشركة، قُلها بوضوح ولا تجامل.`

    const prompt = `الوضع الحالي للشركة:
- إيرادات شهرية: ${current.revenue}
- مصروفات شهرية: ${current.expenses}
- رصيد بنكي: ${current.bank_balance}
- ذمم قابلة للتحصيل: ${current.recReal}
- ديون حالية: ${current.debts}
- قسط شهري: ${current.monthly_payment}
- أيام البقاء الحالية: ${current.survivalDays}
- Murdi Score الحالي: ${current.score}

القرار/المشروع الذي يفكّر فيه المقاول:
"${project.description}"
- قيمة المشروع: ${project.value || 'غير محدد'}
- هامش الربح المتوقع: ${project.margin || 'غير محدد'}%
- مدة التنفيذ بالأشهر: ${project.duration || 'غير محدد'}
- هل يحتاج تمويلاً؟ ${project.needsFunding ? 'نعم بمبلغ ' + project.fundingAmount : 'لا'}
- متى يبدأ تحصيل الدفعات؟ بعد ${project.paymentDelay || 'غير محدد'} يوم

حاكِ الأثر وأرجع هذا الـ JSON بالضبط:
{
  "verdict": "go أو caution أو stop",
  "verdictText": "حكم من جملة واحدة واضحة — هل يدخل المشروع أم لا ولماذا",
  "cashImpact": "أثر المشروع على السيولة خلال التنفيذ — هل ستكفي؟ بالأرقام",
  "worstMonth": "أصعب شهر مالياً خلال المشروع ولماذا — بالأرقام",
  "profitReality": "الربح الحقيقي بعد خصم ضمان حسن التنفيذ وتأخر الدفعات — هل يستحق؟",
  "conditions": ["شرط 1 يجب توفّره قبل الدخول", "شرط 2", "شرط 3"],
  "advisorNote": "نصيحة د. عبدالحكيم المباشرة بنبرة صادقة — جملتان"
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
        max_tokens: 1500,
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
      else return NextResponse.json({ error: 'تعذّر تحليل المحاكاة' }, { status: 200 })
    }
    return NextResponse.json(parsed)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
