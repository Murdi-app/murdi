import { NextResponse } from 'next/server';
import { withCodex } from '@/lib/codexAuth';

// PATCH /api/awards/{id}/codex — كتابة Codex المباشرة بلا قبول، في حقليه وحدهما:
// codex_priority (رقم يعدّل ترتيب قائمة ضي) و codex_flag (مهمة لضي · تحتاج قرار الدكتور · لا شيء)
// مع سطر سبب. لا يمسّ الحالة ولا وسائل التواصل ولا غيرها.
const FLAGS = ['dhai_task', 'needs_dr', 'none'];

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return withCodex(req, '/api/awards/' + id + '/codex', async ({ sb }) => {
    const b = await req.json().catch(() => null) as Record<string, unknown> | null;
    if (!b) return NextResponse.json({ error: 'JSON غير صالح' }, { status: 400 });
    const reason = String(b.reason || '').trim().slice(0, 500);
    if (!reason) return NextResponse.json({ error: 'reason مطلوب' }, { status: 400 });
    const patch: Record<string, unknown> = { codex_reason: reason };
    if (b.codex_priority !== undefined) {
      const p = Number(b.codex_priority);
      if (!Number.isFinite(p) || p < -50 || p > 50) return NextResponse.json({ error: 'codex_priority رقمٌ بين -50 و50' }, { status: 400 });
      patch.codex_priority = p;
    }
    if (b.codex_flag !== undefined) {
      if (!FLAGS.includes(String(b.codex_flag))) return NextResponse.json({ error: 'codex_flag من: ' + FLAGS.join(' · ') }, { status: 400 });
      patch.codex_flag = String(b.codex_flag); patch.codex_flag_at = new Date().toISOString();
    }
    if (patch.codex_priority === undefined && patch.codex_flag === undefined) return NextResponse.json({ error: 'codex_priority أو codex_flag' }, { status: 400 });
    const { data, error } = await sb.from('contract_awards').update(patch).eq('id', id).select('id, codex_priority, codex_flag').maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: 'الفرصة غير موجودة' }, { status: 404 });
    return NextResponse.json({ ok: true, ...data });
  });
}
