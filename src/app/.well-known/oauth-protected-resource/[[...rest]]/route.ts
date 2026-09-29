import { originOf, SCOPE } from '@/lib/oauth';

// بيانات المورد المحمي (RFC 9728) — خادم MCP في /api/mcp وخادم تفويضه murdi.sa.
// ويُجاب على الصيغتين: /.well-known/oauth-protected-resource و…/api/mcp
export function GET(req: Request) {
  const o = originOf(req);
  return Response.json({ resource: o + '/api/mcp', authorization_servers: [o], scopes_supported: [SCOPE], bearer_methods_supported: ['header'] });
}
