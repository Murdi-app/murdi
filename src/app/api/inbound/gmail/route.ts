import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { processMails } from '@/lib/opsMail';
import { recordRun } from '@/lib/jobRun';
import { sendPush } from '@/lib/push';
import { OWNER_EMAIL } from '@/lib/notifyLead';
import type { Mail } from '@/lib/gmail';

// ★ ١ أكتوبر (بأمر المالك): ربط بريد partners@murdi.sa بالخادم **بلا سرٍّ يُنسخ** —
//   سكربت Google Apps Script داخل الصندوق نفسه (صلاحية gmail.readonly) يعمل كل ١٥ دقيقة
//   على خوادم Google والجهاز مغلق، فيرسل الوارد إلى هنا ومعه **رمز هوية توقّعه Google**
//   (ScriptApp.getIdentityToken). يُتحقق منه عند Google: الموقِّع Google، والبريد
//   partners@murdi.sa مُثبَت، والرمز ساري. فلا مفتاح في الكود ولا في السكربت.
//   ونصّ السكربت محفوظ في `docs/gmail-apps-script.gs`.
export const maxDuration = 120;
const MAILBOX = 'partners@murdi.sa';

async function verified(req: Request): Promise<boolean> {
  const tok = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!tok) return false;
  const r = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(tok));
  if (!r.ok) return false;
  const j = await r.json() as { iss?: string; email?: string; email_verified?: string | boolean; exp?: string };
  return /accounts\.google\.com$/.test(String(j.iss || '')) && String(j.email || '').toLowerCase() === MAILBOX
    && String(j.email_verified) === 'true' && Number(j.exp || 0) * 1000 > Date.now();
}

export async function POST(req: Request) {
  if (!(await verified(req))) return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 });
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string);
  const t0 = new Date();
  try {
    const b = await req.json().catch(() => ({} as { mails?: Mail[] }));
    const mails: Mail[] = (Array.isArray(b.mails) ? b.mails : []).slice(0, 60).map((m: Partial<Mail>) => ({
      id: String(m.id), threadId: String(m.threadId || ''), from: String(m.from || ''),
      fromEmail: String(/<([^>]+)>/.exec(String(m.from || ''))?.[1] || m.from || '').trim().toLowerCase(),
      to: String(m.to || ''), subject: String(m.subject || ''), date: String(m.date || ''), text: String(m.text || '').slice(0, 12000),
    }));
    const r = await processMails(sb, mails);
    await recordRun('mail-watch', t0, true, 200, JSON.stringify({ via: 'apps-script', ...r }).slice(0, 900));
    if (r.award + r.entity + r.inquiry + r.etimad > 0) {
      await sendPush({ title: '📬 بريد partners@ — جديد', body: r.notes.slice(0, 4).join(' · '), url: '/admin/channel', important: r.award + r.entity > 0, tag: 'mail-' + t0.toISOString().slice(0, 13) }, OWNER_EMAIL).catch(() => null);
    }
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await recordRun('mail-watch', t0, false, 500, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
