import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireStaff } from '@/lib/requireStaff';
import { riyadhDate } from '@/lib/staffBrief';

// توجيه اليوم في شاشة الموظفة نفسها — لا في بريدها وحده. يظهر لها ما خرج إليها (sent)،
// وضغطة «قرأته» تُسجَّل (read_at) فيرى المالك أنها قرأت.

export const dynamic = 'force-dynamic';
const admin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string);

export async function GET() {
  const { who, error } = await requireStaff();
  if (!who) return NextResponse.json({ error }, { status: 401 });
  if (who.role === 'admin') return NextResponse.json({ ok: true, brief: null });
  const { data, error: e } = await admin().from('daily_briefs')
    .select('id, subject, body, sent_at, read_at')
    .eq('brief_date', riyadhDate()).eq('to_email', who.email).eq('status', 'sent').maybeSingle();
  if (e) return NextResponse.json({ error: e.message }, { status: 500 });
  return NextResponse.json({ ok: true, brief: data });
}

export async function POST(req: Request) {
  const { who, error } = await requireStaff();
  if (!who) return NextResponse.json({ error }, { status: 401 });
  const b = await req.json().catch(() => ({} as Record<string, unknown>));
  const { error: e } = await admin().from('daily_briefs').update({ read_at: new Date().toISOString() })
    .eq('id', String(b.id || '')).eq('to_email', who.email).is('read_at', null);
  if (e) return NextResponse.json({ error: e.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
