import { createPublicKey, verify, type JsonWebKey } from 'crypto';

// هوية GitHub Actions بلا أسرار — رمز OIDC يوقّعه GitHub لكل تشغيل، ويتحقق منه مُرضي بمفاتيح
// GitHub العامة: المُصدِر والجمهور والمستودع (خاصٌّ ومسمّى في award_settings.bridge_repo) والفرع.
// فلا مفتاح يُنشأ ولا يُخزَّن في أي مكان، ولا يصلح الرمز إلا لتشغيلٍ من ذلك المستودع وخلال دقائق.

const ISS = 'https://token.actions.githubusercontent.com';
export const BRIDGE_AUDIENCE = 'https://murdi.sa/bridge';
let jwks: { at: number; keys: (JsonWebKey & { kid?: string })[] } | null = null;

async function keys() {
  if (jwks && Date.now() - jwks.at < 3600_000) return jwks.keys;
  const r = await fetch(ISS + '/.well-known/jwks', { cache: 'no-store' });
  if (!r.ok) throw new Error('تعذّرت قراءة مفاتيح GitHub');
  jwks = { at: Date.now(), keys: (await r.json()).keys };
  return jwks.keys;
}

const b64 = (s: string) => Buffer.from(s, 'base64url');

export type GithubClaims = { repository: string; ref: string; repository_visibility?: string; workflow_ref?: string; run_id?: string; sha?: string };

export async function verifyGithubOidc(token: string, repo: string): Promise<GithubClaims> {
  const [h, p, s] = String(token || '').split('.');
  if (!h || !p || !s) throw new Error('رمزٌ غير صالح');
  const header = JSON.parse(b64(h).toString());
  if (header.alg !== 'RS256') throw new Error('خوارزمية غير مقبولة');
  let jwk = (await keys()).find((k) => k.kid === header.kid);
  if (!jwk) { jwks = null; jwk = (await keys()).find((k) => k.kid === header.kid); }
  if (!jwk) throw new Error('مفتاح توقيعٍ مجهول');
  const ok = verify('RSA-SHA256', Buffer.from(h + '.' + p), createPublicKey({ key: jwk, format: 'jwk' }), b64(s));
  if (!ok) throw new Error('التوقيع لا يطابق');
  const c = JSON.parse(b64(p).toString());
  const now = Math.floor(Date.now() / 1000);
  if (c.iss !== ISS) throw new Error('مُصدِرٌ غير GitHub');
  if (!(c.aud === BRIDGE_AUDIENCE || (Array.isArray(c.aud) && c.aud.includes(BRIDGE_AUDIENCE)))) throw new Error('جمهورٌ غير مُرضي');
  if (!(c.exp > now) || (c.nbf && c.nbf > now + 60)) throw new Error('رمزٌ منتهٍ');
  if (String(c.repository).toLowerCase() !== repo.toLowerCase()) throw new Error('مستودعٌ غير الجسر');
  if (c.repository_visibility && c.repository_visibility !== 'private') throw new Error('المستودع ليس خاصاً');
  if (c.ref !== 'refs/heads/main') throw new Error('فرعٌ غير main');
  return c as GithubClaims;
}
