import { NextResponse } from 'next/server';
import { runAutoMatch } from '@/lib/matchEngine';
import { logError } from '@/lib/logError';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';


export async function GET() {
  const cookieStore = await cookies();
  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ count: 0 });
  const ad = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string);
  const { data: co } = await ad.from('companies').select('id').eq('user_id', user.id).maybeSingle();
  if (!co) return NextResponse.json({ count: 0 });
  const { count } = await ad.from('match_results').select('id', { count: 'exact', head: true })
    .eq('company_id', co.id).eq('status', 'new').gt('fit_score', 0);
  const { data: rr0 } = await ad.from('readiness_results').select('result_type').eq('company_id', co.id);
  const tracks0 = Array.from(new Set((rr0 || []).map((x: { result_type: string }) => x.result_type)
    .filter((t: string) => t === 'funding' || t === 'investment')));
  const pending: string[] = [];
  for (const t0 of tracks0) {
    const { count: c0 } = await ad.from('match_results').select('id', { count: 'exact', head: true })
      .eq('company_id', co.id).eq('track', t0).eq('status', 'new');
    if (!c0) pending.push(String(t0));
  }
  const { data: nz } = await ad.from('companies').select('match_notice').eq('id', co.id).maybeSingle();
  return NextResponse.json({ count: count || 0, tracks: tracks0, pending, notice: nz?.match_notice || '' });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({})) as { track?: string; batch?: number };
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  );
  const { data: co } = await admin.from('companies')
    .select('id, subscription_active, subscription_end').eq('user_id', user.id).maybeSingle();
  if (!co) return NextResponse.json({ error: 'لا يوجد ملف منشأة' }, { status: 404 });

  const active = co.subscription_active === true && (!co.subscription_end || new Date(co.subscription_end) > new Date());
  if (!active) return NextResponse.json({ error: 'يلزم تفعيل الملف أولاً' }, { status: 402 });

  const { data: rr } = await admin.from('readiness_results').select('result_type').eq('company_id', co.id);
  const tracks = Array.from(new Set((rr || []).map((x: { result_type: string }) => x.result_type)
    .filter((t: string) => t === 'funding' || t === 'investment')));
  if (!tracks.length) return NextResponse.json({ error: 'أكمل تقييم مسار واحد على الأقل' }, { status: 400 });

  const t = (body.track === 'investment' || body.track === 'funding') ? body.track : String(tracks[0]);
  const b0 = Number(body.batch) || 0;
  let res = { done: true, total: 0, next: 0 };
  try { res = await runAutoMatch(co.id, t as 'funding' | 'investment', b0); }
  catch (e) { await logError('match.clientRun', e, { company_id: co.id, entity: t }); }

  const { count } = await admin.from('match_results')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', co.id).eq('status', 'new').gt('fit_score', 0);

  return NextResponse.json({ ok: true, count: count || 0, done: res.done, next: res.next, total: res.total, track: t });
}
