import { NextResponse } from 'next/server'
import { notifyLead } from '@/lib/notifyLead'
import { waNumber } from '@/lib/phone'

// ★ التقييم المجاني هو فم القمع: الإعلان يدفع إليه، ومنه يأتي أسخن اسم في
//   اليوم. وكان هذا المسار **المسار الوحيد** الذي لا يُشعِر أحداً — طلب
//   الخدمة يُشعر، والعقد يُشعر، والدفع يُشعر، وهذا لا. فدخل عميلان من
//   الإعلان في ١٦ سبتمبر (٤:٠٦ و٩:٥٩ صباحاً) وأحدهما بدرجة ٧٨ ولم يعلم
//   بهما أحد حتى فُتحت القاعدة بعد الظهر.
//
// وإشعاران لا أكثر لكل عميل: واحدٌ حين يترك اسمه وجواله — وهذه لحظة
// العميل المحتمل — وواحدٌ حين يُكمل الأسئلة الثمانية فتُعرف درجته. أمّا
// التحديثات بين السؤال والسؤال فصامتة، وإلا صار الإشعار ضجيجاً يُغلق.
//
// ★ تصحيحان في ١٧ سبتمبر بعد أن وقف ثمانيةُ عملاءَ يوماً كاملاً بلا اتصال:
//
// (١) كان الإخطار هنا **إشعار متصفحٍ وحده وبلا تحديد مستقبِل**، وأجهزةُ
//     الاشتراك كلُّها للمالك — فيرى المالك ولا ترى الموظفةُ التي تتصل.
//     صار عبر `notifyLead`: بريدٌ للمكتب كلّه (والبريد يصل بلا إذن متصفح)
//     ومعه إشعار الجوال لمن أذن به.
//
// (٢) وكان الجوال يُخزَّن كما كُتب، فوصلنا رقمان بتسع خاناتٍ بلا صفرٍ في
//     أولهما — ورابطُ الواتساب المبنيّ عليهما ميت. صار يُطبَّع عند الحفظ
//     إلى `05xxxxxxxx`، ويُقارَن مطبَّعاً عند التحديث حتى لا يُحرَم من بدأ
//     قبل هذا الإصلاح من إكمال تقييمه.

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { createClient } = await import('@supabase/supabase-js')
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      process.env.SUPABASE_SERVICE_ROLE_KEY as string
    )
    const name = String(body.name || '').trim()
    const rawPhone = String(body.phone || '').trim()
    // التطبيع يقبل ٥xxxxxxxx و٠٥xxxxxxxx و٩٦٦٥xxxxxxxx والأرقام العربية،
    // ويُخزَّن شكلٌ واحد. وما تعذّر تطبيعه يُحفظ كما كُتب ولا يُرَدّ العميل.
    // ★ ١٩ سبتمبر — صار الرفض قاطعاً. كان ما تعذّر تطبيعه يُحفظ كما كُتب
    //   «ولا يُرَدّ العميل»، وهذا رِفقٌ في غير محلّه: صفحةُ هبوطِ إعلانٍ
    //   مدفوع تقبل «١٢٣٤٥٦٧٨٩» فيُحتسب تحويلاً ناجحاً ويُدفع ثمن النقرة،
    //   ثم تتصل المساعِدة برقمٍ لا وجود له. ورقمٌ خاطئ ليس عميلاً ناقصاً —
    //   هو لا شيء. فمن أخطأ في رقمه يُردّ ليصحّحه، وهي ثانيةٌ واحدة عليه.
    const wa = waNumber(rawPhone)
    if (!wa) {
      return NextResponse.json({ error: 'رقم الجوال غير صحيح — اكتبه بصيغة 05xxxxxxxx' }, { status: 400 })
    }
    const phone = '0' + wa.slice(3)
    if (name.length < 2) {
      return NextResponse.json({ error: 'بيانات ناقصة' }, { status: 400 })
    }
    const answers = Array.isArray(body.answers) ? body.answers : []
    const score = Number(body.score) || 0
    const track = String(body.track || '')
    const src = body.src ? String(body.src) : null
    const completed = Boolean(body.completed)
    // اسم المنشأة منفصلٌ عن اسم الشخص: كانت صفحة `/test` تسأل «ما اسم شركتك؟»
    // وتحفظ الجواب في خانة الاسم، فتفتح الموظفة المكالمة باسم شركةٍ تظنّه
    // اسم صاحبها، ولا يبقى في الصف اسمُ إنسانٍ يُنادى به.
    const companyName = body.company_name ? String(body.company_name).trim() : null
    if (body.id) {
      // المسار مفتوح بلا جلسة (التقييم المصغّر يُملأ قبل التسجيل)، فالمعرّف وحده لا يكفي:
      // كان أي أحد يستبدل إجابات ودرجة أي عميل محتمل بمجرد معرفة رقم الصف.
      // نشترط تطابق الجوال المحفوظ، ونمنع الكتابة على تقييم اكتمل.
      const { data: row } = await admin.from('mini_assessments')
        .select('id, phone, completed').eq('id', String(body.id)).maybeSingle()
      // المقارنة مطبَّعةً من الطرفين: الصفوف المحفوظة قبل هذا الإصلاح فيها
      // أرقامٌ بلا صفر، ومقارنتُها نصّاً كانت سترُدّ صاحبها بـ403 عند الإكمال.
      const same = row
        ? (waNumber(row.phone) && waNumber(phone)
            ? waNumber(row.phone) === waNumber(phone)
            : String(row.phone || '').trim() === rawPhone)
        : false
      if (!row || !same || row.completed === true) {
        return NextResponse.json({ error: 'تعذّر التحديث' }, { status: 403 })
      }
      await admin.from('mini_assessments').update({
        answers, score, track, completed, phone,
        ...(companyName ? { company_name: companyName } : {}),
      }).eq('id', String(body.id))
      if (completed) {
        await notifyLead({
          id: String(body.id), name, company: companyName, phone, score, track, src, completed: true,
        }).catch(() => {})
      }
      return NextResponse.json({ id: String(body.id) })
    }
    const { data, error } = await admin.from('mini_assessments').insert({
      full_name: name, phone, answers, score, track, src, completed,
      ...(companyName ? { company_name: companyName } : {}),
    }).select('id').single()
    if (error) throw error
    await notifyLead({
      id: String(data.id), name, company: companyName, phone, score: null, track, src, completed: false,
    }).catch(() => {})
    return NextResponse.json({ id: data.id })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'خطأ' }, { status: 500 })
  }
}
