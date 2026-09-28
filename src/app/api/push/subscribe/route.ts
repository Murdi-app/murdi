import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireStaff } from '@/lib/requireStaff';
import { sendPush } from '@/lib/push';

// تسجيل جهاز لاستقبال الإشعارات، وإرسال إشعار تجربة.
//
// الاشتراك للمكتب لا للعملاء: `endpoint` عنوانُ إشعارٍ صالح للاستعمال، ومن
// يملكه يستطيع أن يدفع إشعاراً إلى جهاز صاحبه. فلا يُقبل إلا من موظّف
// مُوثَّق، ويُخزَّن بمفتاح الخدمة في جدول مغلق أمام anon و authenticated.

const admin = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  );

// GET — المفتاح العام ليشترك به المتصفح، وعدد أجهزتك المسجَّلة
export async function GET() {
  const { who, error: denied } = await requireStaff();
  if (denied || !who) return NextResponse.json({ error: denied || 'غير مصرح' }, { status: 401 });

  const { data } = await admin()
    .from('push_subscriptions')
    .select('id, label, created_at, last_sent_at, last_error, failures')
    .eq('email', who.email)
    .order('created_at', { ascending: false });

  return NextResponse.json({
    publicKey: process.env.VAPID_PUBLIC_KEY || '',
    keysReady: Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY),
    devices: data || [],
  });
}

// PUT — إشعار تجربة الآن، ومعه الحقيقة كاملةً عمّا فعله الخادم.
//
// ★ قال المالك إن الإشعارات «توقفت»، وكان الخادم يرسلها بنجاح في اللحظة
//   نفسها: آخر إرسالٍ مسجَّل بلا خطأ، والاشتراكان حيّان. فالعطب — إن وُجد —
//   بين خادم الإشعارات وجهازه، لا عندنا. ولم يكن في المنصة ما يفرّق بين
//   الحالين، فيبقى الشكّ.
//   فصار هنا زرٌّ يقول أيّهما: كم جهازاً قَبِل الخادمُ الإرسالَ إليه، وكم
//   اشتراكاً ميتاً حُذف، وما نصّ الخطأ إن وقع. فإن قال «أُرسل إلى جهازين»
//   ولم يصل شيء، فالخلل في إذن الجهاز أو في وضع التركيز — لا في المنصة.
export async function PUT() {
  const { who, error: denied } = await requireStaff();
  if (denied || !who) return NextResponse.json({ error: denied || 'غير مصرح' }, { status: 401 });

  const r = await sendPush({
    title: '🔔 إشعار تجربة',
    body: 'إن قرأتَ هذا فالإشعارات تعمل على هذا الجهاز — ' + new Date().toLocaleTimeString('ar-SA', { timeZone: 'Asia/Riyadh', hour: '2-digit', minute: '2-digit' }),
    url: '/admin/hot',
    tag: 'push-test',
  }, who.email);

  const { data } = await admin()
    .from('push_subscriptions')
    .select('id, label, created_at, last_sent_at, last_error, failures')
    .eq('email', who.email)
    .order('created_at', { ascending: false });

  return NextResponse.json({ ok: true, result: r, devices: data || [] });
}

// POST — حفظ اشتراك هذا الجهاز
export async function POST(req: Request) {
  const { who, error: denied } = await requireStaff();
  if (denied || !who) return NextResponse.json({ error: denied || 'غير مصرح' }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const endpoint = String(b?.endpoint || '');
  const p256dh = String(b?.keys?.p256dh || '');
  const auth = String(b?.keys?.auth || '');
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: 'اشتراك ناقص' }, { status: 400 });
  }

  // نفس الجهاز يُجدِّد اشتراكه أحياناً بنفس العنوان — يُحدَّث ولا يتكرر
  const { error } = await admin()
    .from('push_subscriptions')
    .upsert({
      user_id: who.userId,
      email: who.email,
      endpoint,
      p256dh,
      auth,
      label: String(b?.label || '').slice(0, 80) || null,
      failures: 0,
      last_error: null,
    }, { onConflict: 'endpoint' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // مزامنةٌ صامتة عند فتح التطبيق — تُحدِّث عنوان الجهاز ولا ترسل تجربة
  if (b?.silent === true) return NextResponse.json({ ok: true, synced: true });

  // التجديد: العنوان القديم لهذا الجهاز يُحذف فلا يُرسل إليه بعد اليوم
  const replaced = String(b?.replaces || '');
  if (replaced && replaced !== endpoint) {
    await admin().from('push_subscriptions').delete().eq('endpoint', replaced).eq('email', who.email);
  }

  const r = await sendPush({
    title: 'تم تفعيل الإشعارات',
    body: 'سيصلك هنا كل تسجيل جديد وكل تقييم يكتمل — في لحظته.',
    url: '/admin/hot',
  }, who.email);

  return NextResponse.json({ ok: true, test: r });
}

// DELETE — إيقاف الإشعارات على هذا الجهاز
export async function DELETE(req: Request) {
  const { who, error: denied } = await requireStaff();
  if (denied || !who) return NextResponse.json({ error: denied || 'غير مصرح' }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const endpoint = String(b?.endpoint || '');
  if (!endpoint) return NextResponse.json({ error: 'endpoint مطلوب' }, { status: 400 });

  await admin().from('push_subscriptions').delete().eq('endpoint', endpoint).eq('email', who.email);
  return NextResponse.json({ ok: true });
}
