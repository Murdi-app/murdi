import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { CATALOG, canonicalTitle, needsDiagnosis, displayName } from '@/lib/serviceCatalog';
import { waNumber } from '@/lib/phone';
import { sendPush } from '@/lib/push';

// طلب خدمة من الواجهة العامة — بلا حساب.
//
// البوابات كانت أربعاً قبل أن يعرف الزائر ما نبيع: تسجيل، ثم منشأة، ثم
// تقييم، ثم يرى البطاقة. وهذا يستقبل من يعرف حاجته بنفسه في شاشة واحدة،
// فينزل طلبه فرصةً ساخنة تتصل بها رغد اليوم.
//
// ولا يفتح حساباً ولا يُنشئ صفّ خدمة ولا يمسّ مسار الدفع: الحساب يُفتح حين
// تصير الصفقة حقيقية. فما يدخل من باب مفتوح للعموم لا يُكتب في جداول المال.

const admin = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  );

const KNOWN = new Set(CATALOG.flatMap((c) => c.items));
const cut = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n);

export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));

  // مصيدة: حقلٌ مخفيّ لا يملؤه إنسان. تُبتلع بصمت — والآلة لا تُعلَّم أنها كُشفت.
  if (cut(b?.website, 200) !== '') return NextResponse.json({ ok: true });

  const title = canonicalTitle(cut(b?.service_title, 200));
  const name = cut(b?.full_name, 120);
  const phoneRaw = cut(b?.phone, 40);
  const email = cut(b?.email, 160).toLowerCase();
  const company = cut(b?.company_name, 200);
  const note = cut(b?.note, 1500);

  if (!title || !KNOWN.has(title)) {
    return NextResponse.json({ error: 'خدمة غير معروفة' }, { status: 400 });
  }
  // الباب العام لا يستقبل إلا ما يُطلب مباشرة. وما يحتاج تشخيصاً يُطلب من
  // داخل الحساب بعد التقييم — وإلا بعنا بلا معرفة، وهذا ما رفضناه أصلاً.
  if (needsDiagnosis(title)) {
    return NextResponse.json({ error: 'هذه الخدمة تُبنى على تشخيص ملفك — ابدأ بالتقييم المجاني' }, { status: 400 });
  }
  if (!name) return NextResponse.json({ error: 'الاسم مطلوب' }, { status: 400 });

  const phone = waNumber(phoneRaw);
  if (!phone) return NextResponse.json({ error: 'رقم الجوال غير صحيح — اكتبه بصيغة 05xxxxxxxx' }, { status: 400 });
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'البريد غير صحيح' }, { status: 400 });
  }

  const sb = admin();

  // نفس الرقم لنفس الخدمة خلال ربع ساعة = نقرة مكررة أو إلحاح، لا طلب ثانٍ.
  // يُردّ بنجاح حتى لا يظنّ صاحبه أن طلبه ضاع فيعيده مرة ثالثة.
  const { data: dup } = await sb
    .from('service_inquiries')
    .select('id')
    .eq('phone', phone)
    .eq('service_title', title)
    .gte('created_at', new Date(Date.now() - 15 * 60 * 1000).toISOString())
    .limit(1);
  if (dup && dup.length > 0) return NextResponse.json({ ok: true, already: true });

  const { error } = await sb.from('service_inquiries').insert({
    service_title: title,
    full_name: name,
    phone,
    email: email || null,
    company_name: company || null,
    note: note || null,
    src: cut(b?.src, 40) || 'services',
  });
  if (error) return NextResponse.json({ error: 'تعذّر حفظ طلبك — حاول مرة أخرى' }, { status: 500 });

  // الإشعار لا يُسقط الطلب إن فشل — العميل سجّل، وهذا هو المهم
  await sendPush({
    title: 'طلب خدمة جديد',
    body: displayName(title) + ' — ' + name + (company ? ' · ' + company : ''),
    url: '/admin/hot',
    important: true,
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}
