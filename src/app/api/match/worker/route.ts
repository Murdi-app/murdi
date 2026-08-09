import { NextResponse } from 'next/server';
import { runAutoMatch } from '@/lib/matchEngine';
import { logError } from '@/lib/logError';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  const { secret, companyId, track } = await req.json().catch(() => ({}));
  if (!secret || secret !== process.env.WORKER_SECRET) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  }
  const t = track === 'investment' ? 'investment' : 'funding';
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string);
  try {
    let batch = 0;
    for (let i = 0; i < 40; i++) {
      const r = await runAutoMatch(companyId, t as 'funding' | 'investment', batch);
      if (r.done) break;
      batch = r.next;
    }
    const { count } = await admin.from('match_results').select('id', { count: 'exact', head: true })
      .eq('company_id', companyId).eq('track', t).eq('status', 'new').gt('fit_score', 0);
    await admin.from('companies').update({ match_notice: 'ready' }).eq('id', companyId);
    return NextResponse.json({ ok: true, count: count || 0 });
  } catch (e) {
    await logError('match.worker', e, { company_id: companyId, entity: t });
    return NextResponse.json({ error: 'فشل' }, { status: 500 });
  }
}
