import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { tender, current } = await req.json()

    const systemPrompt = `أنت "مؤشر جاهزية العطاء" في Murdi — تساعد المقاول السعودي على تقييم جاهزيته للتقديم على عطاء/مناقصة قبل أن يقدّم، وفق منهجية د. عبدالحكيم المرضي.

تعرف من الداخل:
- العطاءات الحكومية تتطلب تصنيف كافٍ من الهيئة السعودية للمقاولين حسب حجم المشروع.
- الملاءة المالية والسيولة شرط أساسي — الجهة تتحقق من قدرة المقاول على التنفيذ.
- التسعير المنخفض جداً يفوز بالعطاء ويخسر مالياً. المرتفع يخسر المنافسة.
- يجب احتساب: ضمان حسن التنفيذ 5%، تكاليف مباشرة، مصاريف عامة، هامش ربح معقول، تأخر المستخلصات.
- المشروع الكبير يحتاج رأس مال عامل لتمويل التنفيذ قبل وصول الدفعات.

قواعد صارمة:
- أرجع JSON خاماً فقط. ابدأ بـ { وانتهِ بـ }.
- استخدم فقط الأرقام المعطاة. لا تخترع.
- كن صادقاً — إن كان المقاول غير جاهز، قلها بوضوح.`

    const prompt = `المقاول يفكّر في التقديم على هذا العطاء:
- وصف المشروع: ${tender.description || 'غير محدد'}
- قيمة المشروع التقديرية: ${tender.value || 'غير محدد'} ريال
- مدة التنفيذ: ${tender.duration || 'غير محدد'} شهر
- نوع الجهة: ${tender.entity || 'غير محدد'}

وضع المقاول الحالي:
- إيرادات شهرية: ${current.revenue}
- مصروفات شهرية: ${current.expenses}
- رصيد بنكي: ${current.bank_balance}
- ذمم قابلة للتحصيل: ${current.recReal}
- ديون: ${current.debts}
- أيام البقاء: ${current.survivalDays}
- Murdi Score: ${current.score}/85
- عدد الموظفين: ${current.employees}
- سنوات الخبرة: ${current.years || 'غير محدد'}

قيّم جاهزيته وأرجع هذا الـ JSON بالضبط:
{
  "readiness": "ready أو conditional أو notReady",
  "readinessText": "حكم واضح: هل يقدّم أم لا ولماذا — جملة واحدة",
  "capacityCheck": "هل تتحمل سيولته ورأس ماله تنفيذ مشروع بهذا الحجم؟ بالأرقام — كم يحتاج رأس مال عامل قبل أول دفعة",
  "pricingFloor": "أقل سعر يمكن أن يقدّمه دون خسارة (شامل التكاليف + ضمان حسن التنفيذ 5% + هامش معقول) — بالأرقام والمنطق",
  "risks": ["خطر 1 على هذا العطاء تحديداً", "خطر 2"],
  "conditions": ["شرط 1 يجب توفّره قبل التقديم", "شرط 2"],
  "advisorNote": "نصيحة د. عبدالحكيم المباشرة — جملتان"
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
      else return NextResponse.json({ error: 'تعذّر تحليل العطاء' }, { status: 200 })
    }
    return NextResponse.json(parsed)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
