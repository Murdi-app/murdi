import { NextResponse } from 'next/server'
import { sendPush } from '@/lib/push'

// ★ التقييم المجاني هو فم القمع: الإعلان يدفع إليه، ومنه يأتي أسخن اسم في
//   اليوم. وكان هذا المسار **المسار الوحيد** الذي لا يُشعِر أحداً — طلب
//   الخدمة يُشعر، والعقد يُشعر، والدفع يُشعر، وهذا لا. فدخل عميلان من
//   الإعلان في ١٦ سبتمبر (٤:٠٦ و٩:٥٩ صباحاً) وأحدهما بدرجة ٧٨ ولم يعلم
//   بهما أحد حتى فُتحت القاعدة بعد الظهر.
//
// وإشعاران لا أكثر لكل عميل: واحدٌ حين يترك اسمه وجواله — وهذه لحظة
// العميل المحتمل — وواحدٌ حين يُكمل الأسئلة الثمانية فتُعرف درجته. أمّا
// التحديثات بين السؤال والسؤال فصامتة، وإلا صار الإشعار ضجيجاً يُغلق.

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { createClient } = await import('@supabase/supabase-js')
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      process.env.SUPABASE_SERVICE_ROLE_KEY as string
    )
    const name = String(body.name || '').trim()
    const phone = String(body.phone || '').trim()
    if (name.length < 2 || phone.length < 9) {
      return NextResponse.json({ error: 'بيانات ناقصة' }, { status: 400 })
    }
    const answers = Array.isArray(body.answers) ? body.answers : []
    const score = Number(body.score) || 0
    const track = String(body.track || '')
    const src = body.src ? String(body.src) : null
    const completed = Boolean(body.completed)
    if (body.id) {
      // المسار مفتوح بلا جلسة (التقييم المصغّر يُملأ قبل التسجيل)، فالمعرّف وحده لا يكفي:
      // كان أي أحد يستبدل إجابات ودرجة أي عميل محتمل بمجرد معرفة رقم الصف.
      // نشترط تطابق الجوال المحفوظ، ونمنع الكتابة على تقييم اكتمل.
      const { data: row } = await admin.from('mini_assessments')
        .select('id, phone, completed').eq('id', String(body.id)).maybeSingle()
      if (!row || String(row.phone || '') !== phone || row.completed === true) {
        return NextResponse.json({ error: 'تعذّر التحديث' }, { status: 403 })
      }
      await admin.from('mini_assessments').update({ answers, score, track, completed }).eq('id', String(body.id))
      if (completed) {
        const verdict = score >= 75 ? 'مؤهَّل' : score >= 50 ? 'فجوة محددة' : 'يحتاج رفعاً'
        await sendPush({
          title: 'أكمل التقييم المجاني · ' + verdict,
          body: name + ' — ' + phone + ' · الدرجة ' + score + '/100'
            + (track ? ' · ' + track : '') + (src ? ' · من ' + src : ''),
          url: '/admin/followup',
          important: true,
          tag: 'mini-' + String(body.id),
        }).catch(() => {})
      }
      return NextResponse.json({ id: String(body.id) })
    }
    const { data, error } = await admin.from('mini_assessments').insert({
      full_name: name, phone, answers, score, track, src, completed,
    }).select('id').single()
    if (error) throw error
    await sendPush({
      title: src ? 'عميل محتمل من الإعلان' : 'عميل محتمل جديد',
      body: name + ' — ' + phone + ' · بدأ التقييم المجاني' + (src ? ' · ' + src : ''),
      url: '/admin/followup',
      important: true,
      tag: 'mini-' + data.id,
    }).catch(() => {})
    return NextResponse.json({ id: data.id })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'خطأ' }, { status: 500 })
  }
}
