import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

// فتح مخرَج الخدمة كصفحةٍ حقيقية — نفس علاج وثائق العميل، ولنفس السبب.
//
// ★ كان الزرّ يفتح نافذةً فارغة ثم ينتظر الطلب ثم يكتب فيها ثم يطبع. وهذا
//   يُحجب في متصفّحات الجوال وفي المتصفّح المدمج داخل واتساب، وعند الحجب
//   يقول الكود `if (!w) return` فيصمت — فيظن العميل أن ملفه لم يصل.
//   وقع في وثائق العميل مع هرم الإنشاء 2026-09-08، وهذا الزرّ عليه العلّة
//   نفسها — وهو الذي يفتح به العميل ملفه التمويلي بعد أن يدفع.
//
// ★ وشرط الإخراج كما هو: الطلب لهذا العميل، وحالته «سُلّم» أو «اكتمل».
//   والعمود ممنوع على مفتاح المتصفّح، فهذه بوابته.

const RELEASED = ['delivered', 'completed'];

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

const esc = (s: unknown): string =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get('id') || '';
  if (!id) return page('لم يُحدَّد الطلب.', 400);

  const store = await cookies();
  const ss = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    { cookies: { getAll: () => store.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await ss.auth.getUser();
  if (!user) return page('يلزم تسجيل الدخول لعرض هذه الخدمة.', 401);

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  );
  const { data: sr } = await admin.from('service_requests')
    .select('id, company_id, status, admin_deliverable, service_title')
    .eq('id', id).maybeSingle();
  if (!sr) return page('هذا الطلب غير موجود.', 404);

  // ملكية الطلب تُتحقق من منشآت صاحب الجلسة، لا من رقمٍ يُرسله المتصفح
  const { data: cos } = await admin.from('companies').select('id').eq('user_id', user.id);
  const mine: string[] = (cos || []).map((c: { id: string }) => c.id);
  if (!mine.includes(String(sr.company_id))) return page('هذه الخدمة غير متاحة لحسابك.', 403);

  if (!RELEASED.includes(String(sr.status))) {
    return page('لم تُسلَّم هذه الخدمة بعد — سنبلغك حال جاهزيتها.', 402);
  }

  const body = String(sr.admin_deliverable || '');
  if (body.trim() === '') return page('المحتوى قيد الإعداد — راجع فريق مُرضي.', 200);

  // المخرَج قد يكون وثيقة HTML كاملة (ملف العقد مثلاً) وقد يكون نصّاً.
  // فما بدأ بـ<!DOCTYPE أو <html يُعاد كما هو، وما سواه يُغلَّف ويُهرَّب حرفه
  // لئلا يُفسَّر نصُّ العميل وسماً في صفحته.
  const looksHtml = /^\s*<(?:!doctype|html)\b/i.test(body);
  const html = looksHtml
    ? body
    : '<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8">'
      + '<meta name="viewport" content="width=device-width,initial-scale=1">'
      + '<title>' + esc(sr.service_title) + ' — مُرضي</title></head>'
      + '<body style="font-family:Cairo,system-ui,sans-serif;padding:32px;line-height:2;'
      + 'white-space:pre-wrap;color:#12302A;max-width:860px;margin:0 auto">'
      + esc(body) + '</body></html>';

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
      'Referrer-Policy': 'no-referrer',
    },
  });
}
