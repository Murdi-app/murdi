// ★ ١ أكتوبر (بأمر المالك): قراءة بريد partners@murdi.sa من الخادم بربطٍ رسمي —
//   Gmail API بصلاحية القراءة وحدها (gmail.readonly)، بلا متصفح ولا جهاز المالك.
//   الأسرار في بيئة Vercel: GMAIL_CLIENT_ID · GMAIL_CLIENT_SECRET · GMAIL_REFRESH_TOKEN.
//   وإن غابت فالمهمة «غير موصولة» — لا فشل، وتقولها في تقرير الصباح.

export type Mail = { id: string; threadId: string; from: string; fromEmail: string; to: string; subject: string; date: string; text: string };

export const gmailConfigured = () =>
  !!(process.env.GMAIL_CLIENT_ID && process.env.GMAIL_CLIENT_SECRET && process.env.GMAIL_REFRESH_TOKEN);

async function token(): Promise<string> {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: String(process.env.GMAIL_CLIENT_ID), client_secret: String(process.env.GMAIL_CLIENT_SECRET),
      refresh_token: String(process.env.GMAIL_REFRESH_TOKEN), grant_type: 'refresh_token',
    }),
  });
  const j = await r.json() as { access_token?: string; error?: string; error_description?: string };
  if (!j.access_token) throw new Error('Gmail token: ' + (j.error_description || j.error || r.status));
  return j.access_token;
}

const b64 = (s: string) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
const stripHtml = (h: string) => h.replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n')
  .replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\n{3,}/g, '\n\n');

type Part = { mimeType?: string; body?: { data?: string }; parts?: Part[] };
function textOf(p: Part): string {
  if (p.mimeType === 'text/plain' && p.body?.data) return b64(p.body.data);
  for (const c of p.parts || []) { const t = textOf(c); if (t) return t; }
  if (p.mimeType === 'text/html' && p.body?.data) return stripHtml(b64(p.body.data));
  for (const c of p.parts || []) if (c.mimeType === 'text/html' && c.body?.data) return stripHtml(b64(c.body.data));
  return '';
}

/** الرسائل الواردة (لا المرسلة منّا) في آخر `days` يوماً، أحدثها أولاً */
export async function listInbox(days = 3, max = 60): Promise<Mail[]> {
  const t = await token();
  const H = { Authorization: 'Bearer ' + t };
  const q = encodeURIComponent('in:inbox newer_than:' + days + 'd -from:me');
  const l = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=' + max + '&q=' + q, { headers: H });
  if (!l.ok) throw new Error('Gmail list ' + l.status + ' ' + (await l.text()).slice(0, 160));
  const ids = ((await l.json()) as { messages?: { id: string }[] }).messages || [];
  const out: Mail[] = [];
  for (const { id } of ids) {
    const r = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/' + id + '?format=full', { headers: H });
    if (!r.ok) continue;
    const m = await r.json() as { id: string; threadId: string; payload: Part & { headers?: { name: string; value: string }[] } };
    const h = (n: string) => m.payload.headers?.find((x) => x.name.toLowerCase() === n)?.value || '';
    const from = h('from');
    out.push({
      id: m.id, threadId: m.threadId, from, fromEmail: (/<([^>]+)>/.exec(from)?.[1] || from).trim().toLowerCase(),
      to: h('to'), subject: h('subject'), date: h('date'), text: textOf(m.payload).slice(0, 12000),
    });
  }
  return out;
}

/** نصّ الردّ وحده — بلا الاقتباس السابق («On … wrote» / «في … كتب» / سطور «>») */
export function replyOnly(t: string): string {
  const cut = t.search(/\n(On .+wrote:|في .+كتب:|-----Original Message-----|From: .+\n|من: .+\n)/);
  return (cut > 0 ? t.slice(0, cut) : t).split('\n').filter((l) => !l.startsWith('>')).join('\n').trim().slice(0, 3000);
}
