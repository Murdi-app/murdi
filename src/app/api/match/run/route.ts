import { NextResponse } from 'next/server';
import { runAutoMatch } from '@/lib/matchEngine';
import { logError } from '@/lib/logError';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

export const maxDuration = 800;

export async function POST() {
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

  for (const t of tracks) {
    try { await runAutoMatch(co.id, t as 'funding' | 'investment'); }
    catch (e) { await logError('match.clientRun', e, { company_id: co.id, entity: t }); }
  }

  const { count } = await admin.from('match_results')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', co.id).eq('status', 'new').gt('fit_score', 0);

  return NextResponse.json({ ok: true, count: count || 0 });
}
