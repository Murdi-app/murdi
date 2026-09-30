import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cronAuthorized } from '@/lib/cronAuth';
import { riyadhDate } from '@/lib/staffBrief';
import { sendMail } from '@/lib/sendMail';
import { sendPush } from '@/lib/push';
import { logError } from '@/lib/logError';

// توجيه الصباح يخرج وحده — بأمر المالك (٣٠/٩): لا ينتظر إذنه. يُكتب ٤:٤٥ ويُعرض عليه (يعدّله أو
// يعتمده مبكراً إن شاء)، وما بقي مسوّدةً يُرسل هنا ٧:٣٠ بتوقيت الرياض (pg_cron: staff-briefs-send).
export const maxDuration = 60;
const OWNER = 'hololalmurdi.fs@gmail.com';
const esc = (s: string) => s.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string));

export async function POST(req: Request) {
  if (!(await cronAuthorized(req))) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string);
  const today = riyadhDate();
  const { data, error } = await sb.from('daily_briefs').select('id, to_email, subject, body').eq('brief_date', today).eq('status', 'draft');
  if (error) { await logError('cron.briefsSend', new Error(error.message), {}); return NextResponse.json({ error: error.message }, { status: 500 }); }
  const out: string[] = [];
  for (const b of data || []) {
    // يُحجز الصفّ قبل الإرسال — لا يخرج مرتين مع زرّ الاعتماد
    const { data: took } = await sb.from('daily_briefs').update({ status: 'sending' }).eq('id', b.id).eq('status', 'draft').select('id');
    if (!took?.length) continue;
    const html = '<div dir="rtl" style="font-family:Arial,Tahoma;line-height:1.95;color:#1A3D34;font-size:15px;white-space:pre-wrap">' + esc(String(b.body)) + '</div>';
    const r = await sendMail({ from: 'مُرضي <partners@murdi.sa>', to: String(b.to_email), subject: String(b.subject), html, replyTo: 'partners@murdi.sa' });
    await sb.from('daily_briefs').update(r.ok ? { status: 'sent', sent_at: new Date().toISOString(), note: 'أُرسل آلياً ٧:٣٠' } : { status: 'draft', note: 'فشل الإرسال: ' + r.reason }).eq('id', b.id);
    out.push((r.ok ? '✓ ' : '✗ ') + b.to_email);
  }
  if (out.length) await sendPush({ title: '🗂️ خرج توجيه الموظفتين', body: out.join(' · '), url: '/admin', tag: 'briefs-sent-' + today }, OWNER).catch(() => null);
  return NextResponse.json({ ok: true, sent: out });
}
