import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { projects, current } = await req.json()

    const systemPrompt = `أنت "محرك المشاريع" في Murdi — تحلّل محفظة مشاريع المقاول السعودي عبر الزمن، وفق منهجية د. عبدالحكيم المرضي. أنت تفهم أن المقاول لا يعيش بدخل شهري ثابت، بل بدورات مشاريع: يصرف الآن ويحصّل لاحقاً، وقد يكون بين مشروعين بلا دخل.

تعرف من الداخل:
- المشروع له قيمة، ومدة تنفيذ، ودفعات (مستخلصات) تأتي متقطعة لا شهرية.
- بين المشاريع فترات جفاف — المقاول يصرف على التزاماته الثابتة بلا دخل. السؤال الأهم: كم يصمد؟
- الدفعات الحكومية تتأخر (اعتماد)، وضمان حسن التنفيذ 5% يُحتجز.
- المشروع المربح قد يسبب أزمة سيولة إذا تأخرت دفعاته والمصروفات مستمرة.

قواعد صارمة:
- أرجع JSON خاماً فقط. ابدأ بـ { وانتهِ بـ }.
- استخدم فقط الأرقام المعطاة. لا تخترع.
- فكّر بالتدفق عبر الزمن لا باللحظة.`

    const projList = projects.map((p: any, i: number) =>
      `${i+1}. ${p.name || 'مشروع'} | القيمة ${Number(p.value).toLocaleString('ar-SA')} ريال | الهامش ${p.margin||'?'}% | المدة ${p.duration||'?'} شهر | الحالة: ${p.status} | بدأ قبل ${p.monthsElapsed||0} شهر | الدفعة القادمة بعد ${p.nextPaymentDays||'?'} يوم بقيمة ${Number(p.nextPaymentValue||0).toLocaleString('ar-SA')}`
    ).join('\n')

    const fixedMonthly = Number(current.fixedExpenses||current.expenses||0)
    const runwayMonths = fixedMonthly > 0 ? (Number(current.bank_balance||0) / fixedMonthly).toFixed(1) : '∞'

    const prompt = `محفظة مشاريع المقاول:
${projList}

الوضع الثابت للشركة (مستقل عن المشاريع):
- الرصيد البنكي الحالي: ${Number(current.bank_balance||0).toLocaleString('ar-SA')} ريال
- المصروفات الثابتة الشهرية (رواتب/إيجار/التزامات): ${fixedMonthly.toLocaleString('ar-SA')} ريال
- الذمم القابلة للتحصيل: ${Number(current.recReal||0).toLocaleString('ar-SA')} ريال
- الديون: ${Number(current.debts||0).toLocaleString('ar-SA')} ريال
- صمود الشركة بلا مشروع: ${runwayMonths} شهر (الرصيد ÷ المصروفات الثابتة)

حلّل المحفظة عبر الزمن وأرجع هذا الـ JSON بالضبط:
{
  "portfolioHealth": "صحة محفظة المشاريع إجمالاً — جملة بالأرقام",
  "survivalBetweenProjects": "كم يصمد المقاول بمصروفاته الثابتة لو انتهت مشاريعه الحالية ولم يأتِ جديد — بالأرقام والأشهر",
  "cashGap": "هل هناك فجوة نقدية قادمة؟ متى؟ (شهر تكون فيه المصروفات أكبر من الدفعات الداخلة) — بالأرقام",
  "nextProjectUrgency": "متى يجب أن يبدأ المقاول البحث/التعاقد على مشروعه القادم ليتجنب فجوة الجفاف — بالأرقام",
  "realProfit": "الربح الحقيقي المتوقع من المحفظة بعد ضمان حسن التنفيذ وتأخر الدفعات",
  "topAdvice": ["نصيحة 1 محددة قابلة للتنفيذ", "نصيحة 2", "نصيحة 3"],
  "advisorNote": "نصيحة د. عبدالحكيم المباشرة عن إدارة محفظة المشاريع — جملتان"
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
        max_tokens: 1600,
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
      else return NextResponse.json({ error: 'تعذّر تحليل المشاريع' }, { status: 200 })
    }
    return NextResponse.json(parsed)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
