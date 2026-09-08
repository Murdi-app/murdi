import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

// فتح وثيقة العميل كصفحةٍ حقيقية — لا كنافذةٍ يكتبها المتصفّح بعد انتظار.
//
// ★ العطب الذي أنشأ هذا الملف: كان الزرّ يفتح `window.open('', '_blank')` ثم
//   ينتظر `fetch` ثم يكتب المتن في النافذة. وثلاثة أشياء تكسر هذا على الجوال:
//   النافذة الفارغة تُحجب أصلاً في أكثر متصفّحات الجوال والمتصفّحات المدمجة
//   في واتساب؛ وإن فُتحت فقد تفقد صلاحية الكتابة بعد فجوة الانتظار؛ وإن حُجبت
//   فالكود يقول `if (!w) return` — فيصمت صمتاً تاماً بلا رسالة.
//
//   وقع مع شركة هرم الإنشاء 2026-09-08: العميل ضغط، فنجح الطلب وسُجّل
//   `seen_at`، ولم يظهر له شيء. فقال إن الاستشارة لم تصله — وهي عنده.
//
// ★ والعلاج أن يكون الرابط رابطاً: <a href> إلى عنوانٍ يُرجع HTML بترويسته.
//   لا نافذة تُفتح فارغة، ولا كتابة بعد انتظار، ولا صمت عند الحجب — والصفحة
//   تُطبع وتُحفظ ويُعاد فتحها من سجلّ المتصفّح كأي صفحة.

const admin = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  );

const page = (msg: string, status: number) =>
  new Response(
    '<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<title>مُرضي</title></head><body style="margin:0;font-family:Cairo,system-ui,sans-serif;'
    + 'background:#F4F7F6;color:#12302A;display:flex;align-items:center;justify-content:center;'
    + 'min-height:100vh;padding:24px;text-align:center;line-height:2">'
    + '<div><div style="font-size:16px;font-weight:900">' + msg + '</div>'
    + '<div style="margin-top:14px"><a href="/goal" style="color:#1A6B52;font-weight:800">'
    + 'العودة إلى حسابك</a></div></div></body></html>',
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Content-Type-Options': 'nosniff' } }
  );

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get('id') || '';
  if (!id) return page('لم تُحدَّد الوثيقة.', 400);

  const store = await cookies();
  const ss = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    { cookies: { getAll: () => store.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await ss.auth.getUser();
  if (!user) return page('يلزم تسجيل الدخول لعرض هذه الوثيقة.', 401);

  const sb = admin();

  // كل منشآت صاحب الجلسة لا واحدة — الملكية تُقاس بصاحب الحساب، ومن سجّل
  // منشأتين تبقى وثيقته ظاهرةً أيّاً كانت المنشأة التي عُلّقت بها
  const { data: cos } = await sb.from('companies').select('id').eq('user_id', user.id);
  const mine: string[] = (cos || []).map((c: { id: string }) => c.id);

  const { data: doc } = await sb.from('client_documents')
    .select('id, title, body, company_id')
    .eq('id', id).maybeSingle();

  // الملكية تُتحقق بالمنشأة لا برقمٍ يُرسله المتصفح
  if (!doc || !mine.includes(doc.company_id)) return page('هذه الوثيقة غير متاحة لحسابك.', 404);

  const body = String(doc.body || '');
  if (body.trim() === '') return page('الوثيقة قيد الإعداد — سنبلغك حال جاهزيتها.', 200);

  // أول فتحة تُسجَّل، فيعرف المكتب أنها قُرئت ولا يعيد إرسالها
  await sb.from('client_documents').update({ seen_at: new Date().toISOString() })
    .eq('id', id).is('seen_at', null);

  // المتن وثيقة HTML كاملة بترويستها — تُعاد كما هي. ولا تُخزَّن في وسيطٍ
  // عام: وثيقة عميلٍ بأرقامه لا تُحفظ في ذاكرة شبكة توصيل.
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
      'Referrer-Policy': 'no-referrer',
    },
  });
}
