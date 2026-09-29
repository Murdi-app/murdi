import { NextResponse } from 'next/server';
import { withCodex } from '@/lib/codexAuth';
import { setCodexFields } from '@/lib/codexActions';

// PATCH /api/awards/{id}/codex — كتابة Codex المباشرة بلا قبول، في حقليه وحدهما:
// codex_priority (رقم يعدّل ترتيب قائمة ضي) و codex_flag (مهمة لضي · تحتاج قرار الدكتور · لا شيء)
// مع سطر سبب. لا يمسّ الحالة ولا وسائل التواصل ولا غيرها. المنطق في `@/lib/codexActions`.
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return withCodex(req, '/api/awards/' + id + '/codex', async ({ sb }) => {
    const r = await setCodexFields(sb, id, await req.json().catch(() => null));
    return NextResponse.json(r.json, { status: r.status });
  });
}
