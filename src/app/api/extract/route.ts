import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { documents, docType } = await req.json()
    // documents: [{ media_type, data(base64) }]
    if (!documents || documents.length === 0) {
      return NextResponse.json({ error: 'لم يتم رفع أي مستند' }, { status: 400 })
    }

    const typeLabel = docType === 'bank' ? 'كشف حساب بنكي' : 'ميزان مراجعة'

    const systemPrompt = docType === 'bank'
      ? `أنت محلل مالي خبير في شركات المقاولات السعودية، متخصص في قراءة كشوف الحسابات البنكية.

مهمتك: اقرأ كشف الحساب البنكي المرفق واستخرج الإجماليات الصحيحة للفترة كاملة — لا تأخذ آخر يوم فقط.

تعليمات صارمة جداً:
- أرجع JSON خاماً فقط. ابدأ بـ { وانتهِ بـ }.
- كشف الحساب البنكي يُظهر فقط: الرصيد ختامي + إجمالي الإيداعات (الداخل) + إجمالي السحوبات (الخارج) خلال الفترة. هذه الأرقام عادة مكتوبة صراحة في رأس الكشف (Closing Balance, Total Deposits, Total Withdrawals).
- اقرأها من الملخص في أعلى الكشف إن وُجد، لا تجمعها يدوياً من الحركات.
- الرصيد الختامي = closing balance. إجمالي الداخل = total deposits. إجمالي الخارج = total withdrawals.
- حدد الفترة: من تاريخ أول حركة إلى آخر حركة (الشهر والسنة).
- مهم جداً: كشف الحساب البنكي لا يفرّق بين الدخل التجاري والشخصي، ولا يُظهر الذمم ولا الديون ولا القسط. لذلك اترك هذه الحقول صفراً دائماً (receivables_total=0, debts=0) — سنسأل المقاول عنها لاحقاً. لا تخمّنها أبداً.
- لا تعتبر التحويلات الداخلية بين حسابات نفس الشخص إيرادات أو مصروفات حقيقية إن أمكنك تمييزها.
- إن لم يكن المستند كشف حساب بنكي فعلاً، أرجع {"error":"المستند ليس كشف حساب بنكي واضح"}.`
      : `أنت محلل مالي خبير في شركات المقاولات السعودية، متخصص في قراءة موازين المراجعة.

مهمتك: اقرأ ميزان المراجعة المرفق واستخرج الأرقام المالية لكل شهر على حدة.

تعليمات صارمة:
- أرجع JSON خاماً فقط. ابدأ بـ { وانته بـ }.
- إذا كان فيه عدة أشهر، استخرج كل شهر منفصلاً في مصفوفة months.
- استخرج بدقة: الإيرادات، المصروفات، الرصيد النقدي/البنكي، الذمم المدينة الإجمالية، الديون/القروض.
- إن لم تجد قيمة، ضعها 0 ولا تخترع.
- إن لم يكن المستند ميزان مراجعة فعلاً، أرجع {"error":"المستند ليس ميزان مراجعة واضح"}.
- حوّل أي تاريخ هجري لرقم الشهر (1-12) والسنة الميلادية.`

    const content: any[] = []
    documents.forEach((doc: any) => {
      if (doc.media_type === 'application/pdf') {
        content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: doc.data } })
      } else {
        content.push({ type: 'image', source: { type: 'base64', media_type: doc.media_type, data: doc.data } })
      }
    })
    const jsonShape = docType === 'bank'
      ? `استخرج الإجماليات من كشف الحساب البنكي بهذا الشكل بالضبط:
{
  "months": [
    {
      "month": رقم الشهر للفترة 1-12,
      "year": السنة الميلادية,
      "revenue": إجمالي الإيداعات الداخلة خلال الفترة (Total Deposits),
      "expenses": إجمالي السحوبات الخارجة خلال الفترة (Total Withdrawals),
      "bank_balance": الرصيد الختامي (Closing Balance),
      "receivables_total": 0,
      "debts": 0
    }
  ],
  "detectedType": "bank",
  "confidence": "high أو medium أو low",
  "needsInput": ["receivables", "debts", "monthly_payment"],
  "note": "كشف الحساب يُظهر الحركة النقدية فقط — لإكمال الصورة سنسألك عن ذممك وديونك"
}`
      : `استخرج الأرقام من ميزان المراجعة بهذا الشكل بالضبط:
{
  "months": [
    {
      "month": رقم الشهر 1-12,
      "year": السنة الميلادية,
      "revenue": الإيرادات,
      "expenses": المصروفات,
      "bank_balance": الرصيد النقدي والبنكي,
      "receivables_total": إجمالي الذمم المدينة,
      "debts": إجمالي القروض والديون
    }
  ],
  "detectedType": "trial",
  "confidence": "high أو medium أو low",
  "needsInput": [],
  "note": "ملاحظة قصيرة إن وجد نقص"
}`
    content.push({ type: 'text', text: jsonShape })

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY!, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: 'user', content }]
      })
    })

    const data = await response.json()
    const text = data.content?.find((b: any) => b.type === 'text')?.text || '{}'
    let parsed: any = {}
    try {
      parsed = JSON.parse(text)
    } catch {
      const m = text.match(/\{[\s\S]*\}/)
      if (m) { try { parsed = JSON.parse(m[0]) } catch { parsed = { error: 'تعذّر قراءة المستند' } } }
      else parsed = { error: 'تعذّر قراءة المستند' }
    }

    return NextResponse.json(parsed)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
