import { originOf, SCOPE } from '@/lib/oauth';

// اكتشاف خادم التفويض (RFC 8414) — تقرؤه إضافة ChatGPT لتعرف أين تسجّل وتطلب الرمز.
export function GET(req: Request) {
  const o = originOf(req);
  return Response.json({
    issuer: o,
    authorization_endpoint: o + '/oauth/authorize',
    token_endpoint: o + '/api/oauth/token',
    registration_endpoint: o + '/api/oauth/register',
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    scopes_supported: [SCOPE],
  });
}
