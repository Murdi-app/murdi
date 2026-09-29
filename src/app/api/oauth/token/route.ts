import { admin, sha, s256, issueTokens, oauthError, SCOPE } from '@/lib/oauth';

// تبادل الرمز (RFC 6749 + PKCE) وتجديده — عميلٌ عامّ بلا سرّ، والحماية بـ PKCE وربط الرمز بعميله.
async function params(req: Request): Promise<URLSearchParams> {
  const ct = req.headers.get('content-type') || '';
  if (ct.includes('application/json')) { const j = await req.json().catch(() => ({})); return new URLSearchParams(Object.entries(j).map(([k, v]) => [k, String(v)])); }
  return new URLSearchParams(await req.text());
}

export async function POST(req: Request) {
  const p = await params(req);
  const grant = p.get('grant_type'), clientId = p.get('client_id') || '';
  const sb = admin();
  const headers = { 'Cache-Control': 'no-store' };

  if (grant === 'authorization_code') {
    const code = p.get('code') || '', verifier = p.get('code_verifier') || '', redirectUri = p.get('redirect_uri') || '';
    // يُستهلك الرمز ذرّياً — لا يُستعمل مرتين
    const { data: row } = await sb.from('oauth_codes').update({ used_at: new Date().toISOString() })
      .eq('code_hash', sha(code)).is('used_at', null).gt('expires_at', new Date().toISOString()).select('*').maybeSingle();
    if (!row) return oauthError('invalid_grant', 'الرمز غير صالح أو منتهٍ أو مستعمل');
    if (row.client_id !== clientId || row.redirect_uri !== redirectUri) return oauthError('invalid_grant', 'الرمز لا يخصّ هذا العميل أو عنوان الرجوع');
    if (!verifier || s256(verifier) !== row.code_challenge) return oauthError('invalid_grant', 'PKCE لا يطابق');
    return Response.json(await issueTokens(clientId, row.scope || SCOPE), { headers });
  }

  if (grant === 'refresh_token') {
    const rt = p.get('refresh_token') || '';
    const { data: row } = await sb.from('oauth_refresh').update({ revoked_at: new Date().toISOString() })
      .eq('token_hash', sha(rt)).is('revoked_at', null).gt('expires_at', new Date().toISOString()).select('*').maybeSingle();
    if (!row) return oauthError('invalid_grant', 'رمز التجديد غير صالح أو ملغى');
    if (clientId && row.client_id !== clientId) return oauthError('invalid_grant', 'رمز التجديد لا يخصّ هذا العميل');
    return Response.json(await issueTokens(row.client_id, row.scope || SCOPE), { headers });
  }
  return oauthError('unsupported_grant_type', 'authorization_code أو refresh_token');
}
