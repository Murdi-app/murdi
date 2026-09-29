import { NextResponse } from 'next/server';
import { withCodex, KEY_NAME } from '@/lib/codexAuth';
import { readFeed } from '@/lib/awardsFeed';

// GET /api/awards/feed?since=<المؤشر> — قراءة Codex (انظر `src/lib/awardsFeed.ts`).
// بلا `since`: من آخر مؤشرٍ أكّده القارئ (`feed_cursors.acked`) — فالانقطاع لا يُفقد شيئاً.
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  return withCodex(req, '/api/awards/feed', async ({ sb }) => {
    const given = new URL(req.url).searchParams.get('since');
    const { data: cur } = await sb.from('feed_cursors').select('acked').eq('key_name', KEY_NAME).maybeSingle();
    const since = given || cur?.acked || null;
    const page = await readFeed(sb, since);
    // طلبُ ما بعد «since» تأكيدٌ باستلام ما قبله؛ و«served» آخر ما سُلِّم
    await sb.from('feed_cursors').upsert({ key_name: KEY_NAME, acked: since, served: page.next_since, updated_at: new Date().toISOString() });
    return NextResponse.json({ ok: true, ...page });
  });
}
