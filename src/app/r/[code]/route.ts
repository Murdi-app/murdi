import { createClient } from '@supabase/supabase-js';

// رابط الاستشارة المختصرة (murdi.sa/r/…) — يفتحه العميل من واتساب بلا تسجيل دخول.
// الرمز عشوائي (٤٨ بت) ولا يُفهرس. ولا يُعرض إلا ما اكتمل توليده.
export const dynamic = 'force-dynamic';

const notFound = () => new Response('<!doctype html><meta charset="utf-8"><body dir="rtl" style="font-family:sans-serif;padding:40px;text-align:center">الرابط غير صالح — تواصل معنا على واتساب 0570749196</body>', { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } });

export async function GET(_req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  if (!/^[A-Za-z0-9_-]{6,20}$/.test(String(code || ''))) return notFound();
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string);
  const { data } = await sb.from('service_inquiries').select('id, consult_html, consult_status, consult_opened_at').eq('consult_code', code).maybeSingle();
  if (!data?.consult_html || !['ready', 'held'].includes(String(data.consult_status))) return notFound();
  // المحجوزة للمراجعة تُفتح للمالك من إشعاره، ولا يُحسب فتحه فتحاً للعميل
  if (data.consult_status === 'held') return new Response(data.consult_html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'private, no-store' } });
  if (!data.consult_opened_at) await sb.from('service_inquiries').update({ consult_opened_at: new Date().toISOString() }).eq('id', data.id);
  return new Response(data.consult_html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'private, no-store' } });
}
