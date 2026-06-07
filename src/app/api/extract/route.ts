import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { documents, docType } = await req.json()
    // documents: [{ media_type, data(base64) }]
    if (!documents || documents.length === 0) {
      return NextResponse.json({ error: 'لم يتم رفع أي مستند' }, { status: 400 })
    }

    const typeLabel = docType === 'bank' ? 'كشف حساب بنكي' : 'ميزان مراجعة'

    const systemPrompt = `أنت محلل مالي خبير في شركات المقاولات السعودية، متخصص في قراءة ${typeLabel} واستخراج الأرقام بدقة.

مهمتك: اقرأ المستند/المستندات المرفقة (${typeLabel}) واستخرج الأرقام المالية لكل شهر على حدة.

تعليمات صارمة:
- أرجع JSON خاماً فقط بدون أي markdown أو نص. ابدأ بـ { وانتهِ بـ }.
- إذا كان فيه عدة أشهر، استخرج كل شهر منفصلاً في مصفوفة months.
- استخرج بدقة: الإيرادات، المصروفات، الرصيد النقدي/البنكي، الذمم المدينة الإجمالية، الديون/القروض.
- إن لم تجد قيمة، ضعها 0 ولا تخترع.
- إن لم يكن المستند ميزان مراجعة أو كشف حساب فعلاً، أرجع {"error":"المستند غير واضح أو ليس مستنداً مالياً"}.
- حوّل أي تاريخ هجري أو ميلادي لرقم الشهر (1-12) والسنة الميلادية.`

    const content: any[] = []
    documents.forEach((doc: any) => {
      if (doc.media_type === 'application/pdf') {
        content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: doc.data } })
      } else {
        content.push({ type: 'image', source: { type: 'base64', media_type: doc.media_type, data: doc.data } })
      }
    })
    content.push({ type: 'text', text: `استخرج الأرقام المالية من هذا الـ${typeLabel} بالشكل التالي بالضبط:
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
  "detectedType": "${docType}",
  "confidence": "high أو medium أو low حسب وضوح المستند",
  "note": "ملاحظة قصيرة إن وجد شيء غير واضح أو ناقص"
}` })

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
