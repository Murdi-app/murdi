// ★ ١ أكتوبر: ما يحتاج تفكيراً في مهام الخادم يُستدعى فيه Claude عبر API بالتعليمات نفسها
//   التي كانت في جلسات جهاز المالك. المفتاح في الأسرار (ANTHROPIC_API_KEY) لا في الكود.
const MODELS = ['claude-sonnet-5-5', 'claude-sonnet-4-6'];

export async function askClaude(system: string, user: string, maxTokens = 1500): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY غير مضبوط');
  let last = '';
  for (const model of MODELS) {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] }),
    });
    if (r.ok) {
      const j = await r.json() as { content?: { type: string; text?: string }[] };
      return (j.content || []).filter((c) => c.type === 'text').map((c) => c.text || '').join('').trim();
    }
    last = r.status + ' ' + (await r.text()).slice(0, 200);
    if (r.status !== 404 && r.status !== 400) break; // غير «النموذج غير متاح» لا يُعاد بنموذجٍ آخر
  }
  throw new Error('Claude API: ' + last);
}

/** يستخرج أول كائن JSON من ردٍّ نصّي */
export function jsonOf<T>(text: string): T | null {
  const m = /\{[\s\S]*\}/.exec(text);
  if (!m) return null;
  try { return JSON.parse(m[0]) as T; } catch { return null; }
}
