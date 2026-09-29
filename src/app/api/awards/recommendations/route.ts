import { NextResponse } from 'next/server';
import { withCodex } from '@/lib/codexAuth';
import { submitRecommendation } from '@/lib/codexActions';

// POST /api/awards/recommendations — توصيةٌ من Codex تُحفظ في الصندوق فقط:
// لا تعدّل شيئاً ولا ترسل. يقبلها أو يرفضها بسببٍ Claude التشغيل أو المالك، والقبول
// وحده يكتب (الدالة `accept_recommendation` في القاعدة، عبر القيود القائمة).
// المنطق في `@/lib/codexActions` — يستعمله باب الإضافة (`/api/mcp`) أيضاً.
export async function POST(req: Request) {
  return withCodex(req, '/api/awards/recommendations', async ({ sb }) => {
    const r = await submitRecommendation(sb, await req.json().catch(() => null));
    return NextResponse.json(r.json, { status: r.status });
  });
}
