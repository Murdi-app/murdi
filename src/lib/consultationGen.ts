// مولّد الاستشارات الخاصة — واحدٌ للمنصة كلها: استشارة التقييم (`/api/consultation`)
// واستشارة الترسية المختصرة (`/api/admin/awards/gap`). النموذج الأقوى أولاً، ثم البديل.

export const MODELS = ['claude-opus-4-8', 'claude-sonnet-4-6'];

export async function generateWithFallback(prompt: string): Promise<{ text: string; model: string } | null> {
  for (const model of MODELS) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY as string,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: 8000,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      if (!res.ok) continue;
      const data = await res.json();
      const text = (data.content || [])
        .filter((b: { type: string }) => b.type === 'text')
        .map((b: { text: string }) => b.text)
        .join('');
      if (text && text.length > 100) return { text, model };
    } catch { continue; }
  }
  return null;
}

