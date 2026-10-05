import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import { sendMail } from '@/lib/sendMail';

// استعادة كلمة المرور برسالةٍ عربية من المنصة نفسها (شكوى عميل، ٥ أكتوبر).
// كانت تخرج بقالب Supabase الافتراضي بالإنجليزية. فصار الرابط يُولَّد هنا (generateLink)
// ويُرسل من partners@ بالعربية، ويُتحقَّق منه في /auth/confirm — ولا يُقال أبداً هل البريد مسجّل.
export const dynamic = 'force-dynamic';
const admin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string);

export async function POST(req: Request) {
  const b = await req.json().catch(() => ({} as Record<string, unknown>));
  const email = String(b.email || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ error: 'صيغة البريد الإلكتروني غير صحيحة' }, { status: 400 });
  const sb = admin();
  const key = createHash('sha256').update(email).digest('hex').slice(0, 24);
  // رسالةٌ واحدة كل دقيقتين لكل بريد — لا يُغرق صندوق أحدٍ بالضغط المتكرر
  const { count } = await sb.from('api_calls').select('id', { count: 'exact', head: true })
    .eq('path', '/api/auth/reset').eq('note', key).gte('at', new Date(Date.now() - 120_000).toISOString());
  if ((count || 0) > 0) return NextResponse.json({ ok: true });
  await sb.from('api_calls').insert({ method: 'POST', path: '/api/auth/reset', status: 200, note: key });

  const { data, error } = await sb.auth.admin.generateLink({ type: 'recovery', email });
  const hashed = data?.properties?.hashed_token;
  if (error || !hashed) return NextResponse.json({ ok: true }); // بريدٌ غير مسجّل: الجواب نفسه
  const link = new URL(req.url).origin + '/auth/confirm?token_hash=' + encodeURIComponent(hashed) + '&type=recovery&next=/auth/update-password';
  const html = '<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;line-height:2;color:#1A3D34;max-width:520px">'
    + '<h2 style="margin:0 0 8px">استعادة كلمة المرور — مُرضي</h2>'
    + '<p>وصلنا طلبٌ لتعيين كلمة مرور جديدة لحسابك في منصة مُرضي. اضغط الزر أدناه واختر كلمة مرورك الجديدة:</p>'
    + '<p style="margin:22px 0"><a href="' + link + '" style="background:#1A3D34;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold">تعيين كلمة مرور جديدة</a></p>'
    + '<p style="color:#6B8A80;font-size:13px">الرابط صالحٌ لساعة واحدة ولمرة واحدة. وإن لم تطلب ذلك فتجاهل هذه الرسالة — حسابك بأمان.</p>'
    + '<p style="color:#6B8A80;font-size:13px">للمساعدة: واتساب 0570749196</p></div>';
  await sendMail({ from: 'مُرضي <partners@murdi.sa>', to: email, subject: 'استعادة كلمة المرور — مُرضي', html }).catch(() => null);
  return NextResponse.json({ ok: true });
}
