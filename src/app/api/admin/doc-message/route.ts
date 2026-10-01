import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/requireAdmin';
import { issuedMessage, signedMessage } from '@/lib/contractFirst';
import { contractGate } from '@/lib/contractGate';

// رسالتا الطلب للمالك: الأولى (رابط العقد أو السند) متى صدرت الوثيقة، والثانية
// (رابط السداد ورابط المنصة) متى فُتح الدفع. تُنسخ وتُرسل واتساباً.
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const denied = await requireAdmin();
  if (denied) return NextResponse.json({ error: denied }, { status: 401 });
  const id = new URL(req.url).searchParams.get('sr') || '';
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string);
  const { data: sr } = await sb.from('service_requests').select('id, service_title, status').eq('id', id).maybeSingle();
  if (!sr) return NextResponse.json({ error: 'الطلب غير موجود' }, { status: 404 });
  const out: { issued: string | null; signed: string | null; blocked: string | null } = { issued: null, signed: null, blocked: null };
  try { out.issued = (await issuedMessage(sb, String(sr.id), 'المالك')).text; } catch (e) { out.blocked = e instanceof Error ? e.message : 'لا وثيقة'; }
  if (sr.status === 'priced') {
    const g = await contractGate(sb, { id: String(sr.id), service_title: sr.service_title });
    if (g) out.blocked = out.blocked || g;
    else out.signed = (await signedMessage(sb, String(sr.id), 'المالك')).text;
  }
  return NextResponse.json({ ok: true, ...out });
}
