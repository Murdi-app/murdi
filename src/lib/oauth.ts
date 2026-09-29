import { createHash, randomBytes } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { hashKey, KEY_NAME } from '@/lib/codexAuth';

// OAuth 2.1 لإضافة مُرضي في ChatGPT (Codex) — المالك يوافق من جلسته في murdi.sa، فيستلم
// ChatGPT رمزه مباشرةً عبر تبادل الرمز (PKCE S256). لا مفتاح يُنسخ ولا يمرّ في رسالة.
// ★ رمز الوصول صفٌّ في api_keys (بصمته وحدها، بأجل)، فيعمل مع withCodex ويُلغى من شاشة المالك.
// ★ رمز التجديد يُدوَّر عند كل استعمال، والقديم يُلغى.

export const admin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string);
export const SCOPE = 'awards';
export const ACCESS_TTL_S = 24 * 3600;           // يوم
export const REFRESH_TTL_MS = 180 * 86400_000;   // ستة أشهر
export const originOf = (req: Request) => new URL(req.url).origin;
export const rand = (n = 32) => randomBytes(n).toString('base64url');
export const sha = (s: string) => createHash('sha256').update(s).digest('hex');
/** PKCE: code_challenge = BASE64URL(SHA256(code_verifier)) */
export const s256 = (verifier: string) => createHash('sha256').update(verifier).digest('base64url');

/** عناوين الرجوع المقبولة: ChatGPT وOpenAI وحدهما (https) — ولا يُصدر رمزٌ لغيرهما */
export const redirectAllowed = (u: string) => {
  try {
    const x = new URL(u);
    return x.protocol === 'https:' && /(^|\.)(chatgpt\.com|openai\.com)$/i.test(x.hostname);
  } catch { return false; }
};

/** يصدر رمز وصولٍ (في api_keys) ورمز تجديد (في oauth_refresh) للعميل */
export async function issueTokens(clientId: string, scope: string) {
  const sb = admin();
  const access = 'mrd_mcp_' + rand(32);
  const refresh = 'mrd_rt_' + rand(32);
  const expires = new Date(Date.now() + ACCESS_TTL_S * 1000).toISOString();
  const { error: aErr } = await sb.from('api_keys').insert({
    name: KEY_NAME, key_hash: hashKey(access), key_prefix: access.slice(0, 12), created_by: 'ربط ChatGPT (OAuth)', expires_at: expires, client_id: clientId,
  });
  if (aErr) throw new Error(aErr.message);
  const { error: rErr } = await sb.from('oauth_refresh').insert({
    token_hash: sha(refresh), client_id: clientId, scope, expires_at: new Date(Date.now() + REFRESH_TTL_MS).toISOString(),
  });
  if (rErr) throw new Error(rErr.message);
  return { access_token: access, token_type: 'Bearer', expires_in: ACCESS_TTL_S, refresh_token: refresh, scope };
}

export const oauthError = (error: string, description: string, status = 400) =>
  Response.json({ error, error_description: description }, { status, headers: { 'Cache-Control': 'no-store' } });
