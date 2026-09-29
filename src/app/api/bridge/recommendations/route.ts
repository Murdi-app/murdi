import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { submitRecommendation } from '@/lib/codexActions';
import { admin, bridgeAuth } from '@/lib/bridge';

// POST /api/bridge/recommendations {files: [{path, content}]} — ملفات Codex من inbox/ في المستودع الخاص.
// كل ملفٍ يُتحقق منه ويُضاف إلى صندوق التوصيات الحالي (pending) للمراجعة — لا يعدّل ولا يرسل.
// منع التكرار مرتين: الملف نفسه (المسار + بصمة المحتوى) يعيد نتيجته المحفوظة، والتوصية نفسها ببصمتها.
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const sb = admin();
  let run = '';
  try { const c = await bridgeAuth(req, sb); run = String(c.run_id || ''); }
  catch (e) {
    await sb.from('api_calls').insert({ method: 'BRIDGE', path: '/api/bridge/recommendations', status: 401, note: e instanceof Error ? e.message : 'هوية' });
    return NextResponse.json({ error: e instanceof Error ? e.message : 'غير مصرح' }, { status: 401 });
  }
  const b = await req.json().catch(() => null) as { files?: { path?: string; content?: string }[] } | null;
  const files = Array.isArray(b?.files) ? b!.files!.slice(0, 50) : [];
  const results: { path: string; results: unknown[]; reused?: boolean }[] = [];
  for (const f of files) {
    const path = String(f.path || '').slice(0, 300), content = String(f.content || '');
    const key = path + '@' + createHash('sha256').update(content).digest('hex');
    const { data: prior } = await sb.from('bridge_files').select('result').eq('file_key', key).maybeSingle();
    if (prior) { results.push({ path, results: prior.result as unknown[], reused: true }); continue; }
    let recs: unknown[];
    try { const j = JSON.parse(content); recs = Array.isArray(j) ? j : [j]; }
    catch { recs = []; }
    const out: unknown[] = [];
    if (!recs.length) out.push({ code: 400, error: 'الملف ليس JSON صالحاً' });
    for (const r of recs.slice(0, 50)) {
      const x = await submitRecommendation(sb, (r && typeof r === 'object' ? r : null) as Record<string, unknown> | null);
      out.push({ code: x.status, ...x.json });   // code: نتيجة الطلب · status: حال التوصية في الصندوق
    }
    await sb.from('bridge_files').insert({ file_key: key, path, result: out });
    results.push({ path, results: out });
  }
  await sb.from('api_calls').insert({ method: 'BRIDGE', path: '/api/bridge/recommendations', status: 200, note: 'run ' + run + ' · ' + files.length + ' ملف' });
  return NextResponse.json({ ok: true, results });
}
