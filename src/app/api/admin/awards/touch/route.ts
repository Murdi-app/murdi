import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/requireAdmin';

// تسجيل ردٍّ وارد على ترسية — بريداً أو واتساب أو مكالمة. المنصة لا تستقبل
// البريد الوارد آلياً بعد، فيُلصق الرد هنا بحرفه، وتصير الترسية «ردّ».
const admin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string);

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return NextResponse.json({ error: denied }, { status: 401 });
  const b = await req.json().catch(() => ({} as Record<string, unknown>));
  const id = String(b.id || '');
  const channel = String(b.channel || '');
  const body = String(b.body || '').trim().slice(0, 8000);
  if (!id || !['email', 'whatsapp', 'call'].includes(channel) || !body) return NextResponse.json({ error: 'القناة ونصّ الرد مطلوبان' }, { status: 400 });
  const sb = admin();
  const { data: a, error } = await sb.from('contract_awards').select('id, status').eq('id', id).maybeSingle();
  if (error) return NextResponse.json({ error: 'تعذّرت القراءة — ' + error.message }, { status: 500 });
  if (!a) return NextResponse.json({ error: 'غير موجودة' }, { status: 404 });
  const { error: tErr } = await sb.from('award_touches').insert({
    award_id: id, channel, direction: 'in', actor: String(b.from || 'صاحب الترسية').slice(0, 120), body,
  });
  if (tErr) return NextResponse.json({ error: 'لم يُسجَّل الرد — ' + tErr.message }, { status: 500 });
  if (['new', 'qualified', 'messaged', 'reminder_call'].includes(String(a.status))) {
    const now = new Date().toISOString();
    const { error: uErr } = await sb.from('contract_awards').update({ status: 'replied', replied_at: now, updated_at: now }).eq('id', id).eq('status', a.status);
    if (uErr) return NextResponse.json({ ok: true, warn: 'سُجّل الرد ولم تتغيّر الحالة — ' + uErr.message });
  }
  return NextResponse.json({ ok: true });
}
