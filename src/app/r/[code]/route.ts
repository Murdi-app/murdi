import { createClient } from '@supabase/supabase-js';
import { ownerOf, staffContacts, asOwner } from '@/lib/leadOwners';

// رابط الاستشارة المختصرة (murdi.sa/r/…) — يفتحه العميل من واتساب بلا تسجيل دخول.
// الرمز عشوائي (٤٨ بت) ولا يُفهرس. ولا يُعرض إلا ما اكتمل توليده.
export const dynamic = 'force-dynamic';

const notFound = () => new Response('<!doctype html><meta charset="utf-8"><body dir="rtl" style="font-family:sans-serif;padding:40px;text-align:center">الرابط غير صالح — تواصل معنا على واتساب 0570749196</body>', { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
const page = (html: string) => new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'private, no-store' } });

export async function GET(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  if (!/^[A-Za-z0-9_-]{6,20}$/.test(String(code || ''))) return notFound();
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string);
  const { data } = await sb.from('service_inquiries').select('id, consult_html, consult_draft_html, consult_status, consult_opened_at, consult_sent_at').eq('consult_code', code).maybeSingle();
  if (!data) return notFound();
  // ★ ١٥ أكتوبر: «تواصلوا مع زميلتنا …» باسم صاحبة العميل ورقمها، لا ضي للجميع
  const o = await ownerOf(sb, 'inquiry', String(data.id));
  const c = o ? (await staffContacts(sb)).get(o) : null;
  const show = (h: string) => page(asOwner(h, c));
  // مسودةٌ مصحّحة تنتظر اعتماد المالك (?draft=1) — يراها هو، والعميل يبقى على ما وصله
  if (new URL(req.url).searchParams.get('draft') === '1' && data.consult_draft_html) return show(data.consult_draft_html);
  // ما وصل العميل يبقى رابطه يعمل مهما كانت حال إعادة كتابته
  if (!data.consult_html || (!['ready', 'held'].includes(String(data.consult_status)) && !data.consult_sent_at)) return notFound();
  // المحجوزة للمراجعة تُفتح للمالك من إشعاره، ولا يُحسب فتحه فتحاً للعميل
  if (data.consult_status === 'held') return show(data.consult_html);
  if (!data.consult_opened_at) await sb.from('service_inquiries').update({ consult_opened_at: new Date().toISOString() }).eq('id', data.id);
  return show(data.consult_html);
}
