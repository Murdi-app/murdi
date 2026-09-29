import { NextResponse } from 'next/server';
import { readFeed } from '@/lib/awardsFeed';
import { admin, bridgeAuth, toBridgeCard, BRIDGE_CURSOR } from '@/lib/bridge';

// POST /api/bridge/feed {since?} — يستدعيه Action المستودع الخاص (هوية OIDC من GitHub، بلا أسرار).
// يعيد بطاقات الفرص المتغيرة منذ المؤشر (منزوعة الحساس) حتى ٥٠٠ بطاقة، والمؤشر التالي.
// بلا since: من آخر مؤشرٍ أكّده الجسر في المنصة — فالانقطاع لا يُفقد شيئاً.
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request) {
  const sb = admin();
  let run = '';
  try { const c = await bridgeAuth(req, sb); run = String(c.run_id || ''); }
  catch (e) {
    await sb.from('api_calls').insert({ method: 'BRIDGE', path: '/api/bridge/feed', status: 401, note: e instanceof Error ? e.message : 'هوية' });
    return NextResponse.json({ error: e instanceof Error ? e.message : 'غير مصرح' }, { status: 401 });
  }
  const b = await req.json().catch(() => ({} as Record<string, unknown>));
  const { data: cur } = await sb.from('feed_cursors').select('acked').eq('key_name', BRIDGE_CURSOR).maybeSingle();
  const since = (b.since ? String(b.since) : '') || cur?.acked || null;
  const cards: unknown[] = [];
  let next = since, more = true, pages = 0;
  while (more && pages < 5) {
    const page = await readFeed(sb, next);
    cards.push(...page.items.map((x) => toBridgeCard(x as Record<string, unknown>)));
    next = page.next_since; more = page.has_more; pages++;
  }
  await sb.from('feed_cursors').upsert({ key_name: BRIDGE_CURSOR, acked: since, served: next, updated_at: new Date().toISOString() });
  await sb.from('api_calls').insert({ method: 'BRIDGE', path: '/api/bridge/feed', status: 200, note: 'run ' + run + ' · ' + cards.length + ' بطاقة' });
  return NextResponse.json({ ok: true, since, next_since: next, has_more: more, cards });
}
