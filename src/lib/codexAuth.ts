import { createHash, randomBytes } from 'crypto';
import { NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// مفتاح Codex — بابٌ مستقل لقناة الفائزين بالعقود.
//
// ★ لا مستخدم قاعدة بيانات ولا كلمة مرور: مفتاحٌ عشوائي (٣٢ بايتاً) يُنشئه المالك
//   من شاشته ويُعرض له مرةً واحدة، ولا يُحفظ إلا بصمته (sha256). ويُلغى ويُدوَّر منها.
// ★ ويُسجَّل كل استدعاءٍ به (الوقت · المسار · النتيجة) في `api_calls`.
// ★ وما يصل إليه Codex بهذا المفتاح فرصُ القناة وحدها — لا عملاء المنصة الآخرين.

export const KEY_NAME = 'Codex';
const admin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string);

export const hashKey = (k: string) => createHash('sha256').update(k).digest('hex');

/** مفتاحٌ جديد: يُعاد نصّه مرةً واحدة، ويُحفظ بصمته وبادئته فقط */
export function newKey(): { key: string; hash: string; prefix: string } {
  const key = 'mrd_codex_' + randomBytes(32).toString('base64url');
  return { key, hash: hashKey(key), prefix: key.slice(0, 14) };
}

export type CodexCtx = { sb: SupabaseClient; keyId: string };

/**
 * يغلّف مسار Codex: يتحقق من المفتاح (Authorization: Bearer …)، ويسجّل الاستدعاء بنتيجته.
 * المفتاح الملغى أو المجهول يُردّ 401 ويُسجَّل أيضاً.
 */
export async function withCodex(req: Request, path: string, handler: (ctx: CodexCtx) => Promise<NextResponse>): Promise<NextResponse> {
  const sb = admin();
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  let keyId: string | null = null;
  if (token) {
    const { data } = await sb.from('api_keys').select('id, revoked_at, expires_at').eq('key_hash', hashKey(token)).maybeSingle();
    // رمز الإضافة (OAuth) له أجل؛ والمفتاح اليدوي بلا أجل حتى يُلغى
    if (data && !data.revoked_at && (!data.expires_at || Date.parse(String(data.expires_at)) > Date.now())) keyId = String(data.id);
  }
  let res: NextResponse;
  if (!keyId) res = NextResponse.json({ error: 'مفتاح غير صالح أو ملغى' }, { status: 401 });
  else {
    try { res = await handler({ sb, keyId }); }
    catch (e) { res = NextResponse.json({ error: e instanceof Error ? e.message : 'خطأ' }, { status: 500 }); }
    await sb.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', keyId);
  }
  let note: string | null = null;
  if (res.status >= 400) { try { note = String((await res.clone().json()).error || '').slice(0, 300); } catch { /* ليس JSON */ } }
  await sb.from('api_calls').insert({ key_id: keyId, method: req.method, path, status: res.status, note });
  return res;
}
