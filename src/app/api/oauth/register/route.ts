import { admin, rand, redirectAllowed, oauthError } from '@/lib/oauth';

// تسجيل العميل ديناميكياً (RFC 7591) — تسجّل إضافة ChatGPT نفسها هنا. عناوين الرجوع لـ ChatGPT/OpenAI
// وحدها، والتسجيل لا يمنح شيئاً: الرمز لا يصدر إلا بموافقة المالك من جلسته.
export async function POST(req: Request) {
  const b = await req.json().catch(() => null) as Record<string, unknown> | null;
  const uris = Array.isArray(b?.redirect_uris) ? (b!.redirect_uris as unknown[]).map(String) : [];
  if (!uris.length || !uris.every(redirectAllowed)) return oauthError('invalid_redirect_uri', 'عناوين الرجوع المقبولة: chatgpt.com / openai.com (https)');
  const clientId = 'mcp_' + rand(18);
  const { error } = await admin().from('oauth_clients').insert({ client_id: clientId, client_name: String(b?.client_name || 'ChatGPT').slice(0, 120), redirect_uris: uris });
  if (error) return oauthError('server_error', error.message, 500);
  return Response.json({
    client_id: clientId, client_name: b?.client_name || 'ChatGPT', redirect_uris: uris,
    grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'], token_endpoint_auth_method: 'none',
  }, { status: 201 });
}
