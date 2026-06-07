import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { companyName, summary, monthsCount, scoreChange, firstScore, lastScore } = await req.json()

    const prompt = `أنت مستشار مالي استراتيجي متخصص في شركات المقاولات السعودية. مهمتك اكتشاف الأنماط الخفية التي لا يراها صاحب الشركة.

شركة: ${companyName}
عدد الأشهر المحللة: ${monthsCount} شهر
Murdi Score: من ${firstScore} إلى ${lastScore} (${scoreChange >= 0 ? '+' : ''}${scoreChange} نقطة)

البيانات الشهرية:
${summary}

تعليمات التحليل:
- ابحث عن الأنماط الخفية: هل الإيرادات ترتفع لكن السيولة تنخفض؟ هل الذمم تتراكم مع الربحية؟
- احسب معدلات النمو الفعلية بالأرقام
- حدد إذا كان النمو حقيقياً أم وهمياً (مدفوع بالديون أو الذمم)
- قارن سرعة نمو الإيرادات مع سرعة نمو المصروفات
- استخدم معرفتك بقطاع المقاولات السعودي (المستخلصات الحكومية، التصنيف، ضمان حسن التنفيذ، التمويل) حين تكون ذات صلة
- قاعدة صارمة: لا تخترع أي رقم أو معلومة غير موجودة في البيانات أعلاه — استخدم فقط الأرقام المعطاة

اكتب تحليلاً من 4 فقرات قصيرة:

فقرة 1 — المسار الحقيقي: ما الذي يحدث فعلاً في هذه الشركة خلال ${monthsCount} شهر؟ استخدم أرقاماً محددة.

فقرة 2 — النمط الخفي: شيء واحد مهم لا يراه صاحب الشركة في أرقامه اليومية. مثال: "إيراداتك ارتفعت 23% لكن ذممك ارتفعت 67% — نموك يُموَّل من جيوب عملائك لا من ربحك الحقيقي"

فقرة 3 — الخطر القادم: إذا استمر هذا النمط 3 أشهر إضافية، ماذا سيحدث بالأرقام؟

فقرة 4 — القرار الاستراتيجي: قرار واحد محدد يجب اتخاذه هذا الشهر مع الأثر المتوقع بالأرقام.

اكتب بلغة تنفيذية مباشرة. لا عناوين. لا نقاط. فقرات متدفقة.`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 1200,
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
