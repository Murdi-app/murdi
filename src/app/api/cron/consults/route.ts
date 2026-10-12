import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cronAuthorized } from '@/lib/cronAuth';
import { runInquiryConsults, runInquiryAsks } from '@/lib/inquiryConsult';
import { logError } from '@/lib/logError';
import { withJobRun } from '@/lib/jobRun';

// نبض الاستشارات المختصرة — يوقظه `pg_cron` (المهمة `inquiry-consults`) كل عشر دقائق،
// فيعمل وجهاز المالك مغلق: كل من لصقت ضي ردّه قبل نصف ساعة تُكتب استشارته (`@/lib/inquiryConsult`).
export const maxDuration = 300;

async function handle(req: Request) {
  if (!(await cronAuthorized(req))) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string);
  try {
    // الأسئلة للوافد الجديد أولاً (سريعة)، ثم الاستشارات المستحقة
    const asks = await runInquiryAsks(sb).catch(async (e) => { await logError('cron.consults.asks', e, {}); return ['خطأ الأسئلة']; });
    const done = await runInquiryConsults(sb);
    return NextResponse.json({ ok: true, asks, done });
  } catch (e) {
    await logError('cron.consults', e, {});
    return NextResponse.json({ error: e instanceof Error ? e.message : 'فشل' }, { status: 500 });
  }
}

export const POST = withJobRun('inquiry-consults', handle);
