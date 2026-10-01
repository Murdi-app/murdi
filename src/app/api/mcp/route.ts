import { createClient } from '@supabase/supabase-js';
import { hashKey, KEY_NAME, codexEnabled } from '@/lib/codexAuth';
import { readFeed } from '@/lib/awardsFeed';
import { submitRecommendation, setCodexFields, REC_KINDS, CODEX_FLAGS } from '@/lib/codexActions';
import { originOf } from '@/lib/oauth';

// خادم MCP بعيد (Streamable HTTP، JSON-RPC 2.0) — إضافة مُرضي في ChatGPT لـ Codex.
// ثلاث أدوات بالمنطق نفسه لأبواب REST: قراءة القناة · توصية تُحفظ فقط · أولوية وتعليم.
// المصادقة: رمز OAuth (يصدره murdi.sa بموافقة المالك) أو مفتاح Codex — وكل استدعاءٍ مسجَّل.

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const admin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string);
const PROTOCOL = '2025-06-18';

const TOOLS = [
  {
    name: 'get_awards_feed',
    title: 'قراءة فرص قناة الفائزين',
    description: 'يعيد فرص قناة الفائزين بالعقود التي تغيّرت منذ المؤشر: بطاقة كاملة لكل فرصة (الترسية ومصادرها، الحالة والمسؤول والخطوة التالية وموعدها والدرجة، وسائل التواصل بمصادرها، المراسلات وما سجّلته ضي، التوصيات بنتيجتها وسببها، المهام المفتوحة). بلا since يبدأ من آخر مؤشرٍ أكّدته. مرّر next_since في الاستدعاء التالي؛ has_more يعني اقرأ ثانية.',
    inputSchema: { type: 'object', properties: { since: { type: 'string', description: 'المؤشر next_since من القراءة السابقة' } }, additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: 'submit_recommendation',
    title: 'إرسال توصية إلى الصندوق',
    description: 'توصيةٌ على فرصة تُحفظ في الصندوق فقط — لا تعدّل شيئاً حتى يقبلها Claude التشغيل أو الدكتور. لها بصمة فلا تُحفظ مرتين. وسيلة التواصل تحتاج value.source وvalue.source_url (ما نشرته المنشأة أو سجلٌّ رسمي). template: value.target = hypothesis | template.',
    inputSchema: {
      type: 'object',
      properties: {
        award_id: { type: 'string' },
        kind: { type: 'string', enum: REC_KINDS },
        value: { type: 'object' },
        evidence: { type: 'array', items: { type: 'string' }, description: 'روابط الأدلة' },
        confidence: { type: 'number', minimum: 0, maximum: 1 },
      },
      required: ['award_id', 'kind', 'value'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'set_award_priority',
    title: 'أولوية الفرصة وتعليمها',
    description: 'كتابةٌ مباشرة في حقلين فقط: codex_priority (رقم بين -50 و50 يعدّل ترتيب قائمة ضي) وcodex_flag (dhai_task مهمة لضي · needs_dr تحتاج قرار الدكتور · none) مع سبب. لا يمسّ الحالة ولا وسائل التواصل.',
    inputSchema: {
      type: 'object',
      properties: {
        award_id: { type: 'string' },
        codex_priority: { type: 'number', minimum: -50, maximum: 50 },
        codex_flag: { type: 'string', enum: CODEX_FLAGS },
        reason: { type: 'string' },
      },
      required: ['award_id', 'reason'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
];

const rpc = (id: unknown, result: unknown) => ({ jsonrpc: '2.0', id, result });
const rpcErr = (id: unknown, code: number, message: string) => ({ jsonrpc: '2.0', id, error: { code, message } });
const toolResult = (status: number, json: unknown) => ({
  content: [{ type: 'text', text: JSON.stringify(json) }], structuredContent: json, isError: status >= 400,
});

function unauthorized(req: Request) {
  return new Response(JSON.stringify({ error: 'invalid_token', error_description: 'رمزٌ مطلوب — اربط الإضافة بموافقة المالك' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json', 'WWW-Authenticate': 'Bearer resource_metadata="' + originOf(req) + '/.well-known/oauth-protected-resource"' },
  });
}

export async function GET() {
  return new Response('يدعم هذا الخادم POST وحده (Streamable HTTP بلا SSE).', { status: 405, headers: { Allow: 'POST' } });
}

export async function POST(req: Request) {
  const sb = admin();
  // Codex موقوف بأمر المالك — الإضافة نائمة بلا حذف (codex_enabled)
  if (!(await codexEnabled(sb))) return Response.json({ error: 'Codex موقوف بأمر المالك' }, { status: 503 });
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  let keyId: string | null = null;
  if (token) {
    const { data } = await sb.from('api_keys').select('id, revoked_at, expires_at').eq('key_hash', hashKey(token)).maybeSingle();
    if (data && !data.revoked_at && (!data.expires_at || Date.parse(String(data.expires_at)) > Date.now())) keyId = String(data.id);
  }
  if (!keyId) {
    await sb.from('api_calls').insert({ key_id: null, method: 'POST', path: '/api/mcp', status: 401, note: token ? 'رمزٌ غير صالح' : 'بلا رمز' });
    return unauthorized(req);
  }
  const body = await req.json().catch(() => null);
  if (!body) return Response.json(rpcErr(null, -32700, 'JSON غير صالح'), { status: 400 });
  const msgs = Array.isArray(body) ? body : [body];
  const out: unknown[] = [];

  for (const m of msgs as Record<string, unknown>[]) {
    const id = m.id, method = String(m.method || '');
    const p = (m.params || {}) as Record<string, unknown>;
    if (id === undefined || id === null) continue; // إشعار (notifications/initialized …) — لا رد
    if (method === 'initialize') {
      out.push(rpc(id, {
        protocolVersion: String(p.protocolVersion || PROTOCOL),
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'murdi-awards', title: 'مُرضي — قناة الفائزين', version: '1.0.0' },
        instructions: 'اقرأ get_awards_feed أولاً ومرّر next_since في القراءة التالية. التوصيات تُحفظ حتى تُقبل أو تُرفض، ونتيجتها تظهر في القراءة التالية. لا تُرسل شيئاً للمنشآت.',
      }));
    } else if (method === 'ping') {
      out.push(rpc(id, {}));
    } else if (method === 'tools/list') {
      out.push(rpc(id, { tools: TOOLS }));
    } else if (method === 'tools/call') {
      const name = String(p.name || '');
      const args = (p.arguments || {}) as Record<string, unknown>;
      let status = 200, json: unknown;
      try {
        if (name === 'get_awards_feed') {
          const { data: cur } = await sb.from('feed_cursors').select('acked').eq('key_name', KEY_NAME).maybeSingle();
          const since = (args.since ? String(args.since) : '') || cur?.acked || null;
          const page = await readFeed(sb, since);
          await sb.from('feed_cursors').upsert({ key_name: KEY_NAME, acked: since, served: page.next_since, updated_at: new Date().toISOString() });
          json = { ok: true, ...page };
        } else if (name === 'submit_recommendation') {
          const r = await submitRecommendation(sb, args); status = r.status; json = r.json;
        } else if (name === 'set_award_priority') {
          const r = await setCodexFields(sb, String(args.award_id || ''), args); status = r.status; json = r.json;
        } else { out.push(rpcErr(id, -32602, 'أداة غير معروفة: ' + name)); continue; }
      } catch (e) { status = 500; json = { error: e instanceof Error ? e.message : 'خطأ' }; }
      await sb.from('api_calls').insert({ key_id: keyId, method: 'MCP', path: 'tool:' + name, status, note: status >= 400 ? String((json as { error?: string })?.error || '').slice(0, 300) : null });
      out.push(rpc(id, toolResult(status, json)));
    } else {
      out.push(rpcErr(id, -32601, 'طريقة غير مدعومة: ' + method));
    }
  }
  await sb.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', keyId);
  if (!out.length) return new Response(null, { status: 202 });
  return Response.json(Array.isArray(body) ? out : out[0]);
}
