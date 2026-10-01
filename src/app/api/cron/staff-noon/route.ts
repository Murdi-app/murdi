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
