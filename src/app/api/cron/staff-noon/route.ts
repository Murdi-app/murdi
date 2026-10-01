import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cronAuthorized } from '@/lib/cronAuth';
import { riyadhDate } from '@/lib/staffBrief';
import { sendPush } from '@/lib/push';
import { OWNER_EMAIL } from '@/lib/notifyLead';
import { logError } from '@/lib/logError';

// ★ ١ أكتوبر (بأمر المالك): من لم يُسجَّل لها شيءٌ في المنصة حتى ١٢ ظهراً يصل المالك
//   إشعار. يوقظها pg_cron (staff-noon-check) الأحد–الخميس ٩:٠٠ UTC.
export const maxDuration = 30;

export async function POST(req: Request) {
  if (!(await cronAuthorized(req))) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string);
  const today = riyadhDate();

  // ★ ١ أكتوبر (بأمر المالك): التوجيه الصباحي لم تضغط صاحبتُه «قرأته» حتى ٩ صباحاً ←
  //   إشعارٌ للمالك باسمها. يوقظه pg_cron (staff-brief-unread) الأحد–الخميس ٦:٠٠ UTC.
  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  if (String(body?.mode || '') === 'brief') {
    const { data: briefs, error: bErr } = await sb.from('daily_briefs')
      .select('to_email, status, read_at').eq('brief_date', today).is('read_at', null).neq('status', 'draft');
    if (bErr) { await logError('cron.briefUnread', new Error(bErr.message), {}); return NextResponse.json({ error: bErr.message }, { status: 500 }); }
    const mails = Array.from(new Set((briefs || []).map((b) => String(b.to_email || '').toLowerCase()).filter(Boolean)));
    if (!mails.length) return NextResponse.json({ ok: true, unread: [] });
    const { data: st } = await sb.from('staff').select('name, email').in('email', mails);
    const names = mails.map((m) => (st || []).find((x) => String(x.email).toLowerCase() === m)?.name || m);
    const p = await sendPush({
      title: '📭 توجيه الصباح لم يُقرأ',
      body: names.join(' و') + ' — لم تضغط «قرأته» على توجيه اليوم حتى الساعة ٩',
      url: '/admin', important: true, tag: 'brief-unread-' + today,
    }, OWNER_EMAIL).catch((e) => ({ sent: 0, reason: String(e) }));
    return NextResponse.json({ ok: true, unread: names, push: p });
  }

  const { data, error } = await sb.rpc('staff_activity', { p_from: today, p_to: today });
  if (error) { await logError('cron.staffNoon', new Error(error.message), {}); return NextResponse.json({ error: error.message }, { status: 500 }); }
  const idle = (data || []).filter((r: { touches: number }) => !(Number(r.touches) > 0)).map((r: { name: string }) => String(r.name));
  if (idle.length) {
    const p = await sendPush({
      title: '⏰ لا نشاط مسجَّل حتى الظهر',
      body: idle.join(' و') + ' — لم يُسجَّل في المنصة اتصالٌ ولا نتيجة اليوم حتى الساعة ١٢',
      url: '/admin', important: true, tag: 'staff-noon-' + today,
    }, OWNER_EMAIL).catch((e) => ({ sent: 0, reason: String(e) }));
    return NextResponse.json({ ok: true, idle, push: p });
  }
  return NextResponse.json({ ok: true, idle: [] });
}
