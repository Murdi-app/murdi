import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cronAuthorized } from '@/lib/cronAuth';
import { runAutoMatch } from '@/lib/matchEngine';
import { logError } from '@/lib/logError';

// مطابقةٌ داخلية بأمر المالك (٨ أكتوبر) — لبناء بيانات حقيقية وراء أعداد الطُعم (المستثمرون مثلاً).
// بسرّ المهام، ودفعاتٌ متتالية حتى ٢٤٠ ثانية ثم يعيد «next» ليُستأنف. ولا بريد للعميل ولا للمالك.
export const maxDuration = 300;

export async function POST(req: Request) {
  if (!(await cronAuthorized(req))) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  const b = await req.json().catch(() => ({} as Record<string, unknown>));
  const companyId = String(b.companyId || '');
  const track: 'funding' | 'investment' = b.track === 'investment' ? 'investment' : 'funding';
  let batch = Number(b.batch || 0);
  if (!companyId) return NextResponse.json({ error: 'companyId' }, { status: 400 });
  const t0 = Date.now();
  try {
    let r = { done: false, next: batch, total: 0 } as { done: boolean; next: number; total: number };
    while (Date.now() - t0 < 240_000) {
      r = await runAutoMatch(companyId, track, batch);
      if (r.done) break;
      batch = r.next;
    }
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string);
    const { count } = await sb.from('match_results').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('track', track).eq('status', 'new').gt('fit_score', 0);
    return NextResponse.json({ ok: true, done: r.done, next: r.done ? null : batch, total: r.total, count: count || 0 });
  } catch (e) {
    await logError('cron.match-sample', e, { company_id: companyId, entity: track });
    return NextResponse.json({ error: e instanceof Error ? e.message : 'فشل' }, { status: 500 });
  }
}
