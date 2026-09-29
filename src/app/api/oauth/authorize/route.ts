import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/requireAdmin';
import { admin, rand, sha, redirectAllowed, SCOPE } from '@/lib/oauth';

// موافقة المالك — من صفحة /oauth/authorize وجلسته في murdi.sa (requireAdmin). تُصدر رمز تفويضٍ
// لمرةٍ واحدة (عشر دقائق) مربوطاً بالعميل وعنوان الرجوع وتحدّي PKCE، وتعيد عنوان الرجوع.
export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return NextResponse.json({ error: denied }, { status: 401 });
  const b = await req.json().catch(() => ({} as Record<string, unknown>));
  const clientId = String(b.client_id || ''), redirectUri = String(b.redirect_uri || ''), challenge = String(b.code_challenge || '');
  const method = String(b.code_challenge_method || 'S256'), state = b.state ? String(b.state) : '';
  if (method !== 'S256' || !/^[A-Za-z0-9_-]{43,128}$/.test(challenge)) return NextResponse.json({ error: 'PKCE (S256) مطلوب' }, { status: 400 });
  const sb = admin();
  const { data: c } = await sb.from('oauth_clients').select('client_id, redirect_uris').eq('client_id', clientId).maybeSingle();
  if (!c) return NextResponse.json({ error: 'عميلٌ غير مسجَّل' }, { status: 400 });
  if (!redirectAllowed(redirectUri) || !(c.redirect_uris as string[]).includes(redirectUri)) return NextResponse.json({ error: 'عنوان رجوع غير مسجَّل لهذا العميل' }, { status: 400 });
  if (b.deny === true) {
    const u = new URL(redirectUri); u.searchParams.set('error', 'access_denied'); if (state) u.searchParams.set('state', state);
    return NextResponse.json({ redirect: u.toString() });
  }
  const code = rand(32);
  const { error } = await sb.from('oauth_codes').insert({
    code_hash: sha(code), client_id: clientId, redirect_uri: redirectUri, code_challenge: challenge, scope: SCOPE,
    expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const u = new URL(redirectUri); u.searchParams.set('code', code); if (state) u.searchParams.set('state', state);
  return NextResponse.json({ redirect: u.toString() });
}
