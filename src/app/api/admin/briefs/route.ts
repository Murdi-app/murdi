import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/requireAdmin';

// «التوجيهات المرسلة» — للمالك وحده: نصّ كل توجيه، ولمن، ومتى خرج، وهل قرأته الموظفة.
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const denied = await requireAdmin();
  if (denied) return NextResponse.json({ error: denied }, { status: 401 });
  const days = Math.min(90, Math.max(1, Number(new URL(req.url).searchParams.get('days') || 30)));
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string);
  const since = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10);
  const { data, error } = await sb.from('daily_briefs')
    .select('id, brief_date, recipient, to_email, subject, body, status, sent_at, read_at, note')
    .gte('brief_date', since).order('brief_date', { ascending: false }).order('recipient');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, briefs: data || [] });
}
