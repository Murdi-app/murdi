import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cronAuthorized } from '@/lib/cronAuth';
import { importAwardsFromNews } from '@/lib/awardsImport';
import { logError } from '@/lib/logError';
import { withJobRun } from '@/lib/jobRun';

// مستورد الترسيات اليومي — يوقظه `pg_cron` (المهمة `awards-import`) ٦:٠٠ الرياض،
// قبل جرد الصباح فيُحسب ما دخل في سطر الترسيات.
export const maxDuration = 60;

async function handle(req: Request) {
  if (!(await cronAuthorized(req))) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string);
  try {
    const r = await importAwardsFromNews(sb, 3);
    if (r.errors.length) await logError('cron.awardsImport', new Error(r.errors.join(' · ')), {});
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    await logError('cron.awardsImport', e, {});
    return NextResponse.json({ error: e instanceof Error ? e.message : 'تعذّر الاستيراد' }, { status: 500 });
  }
}

// ★ سجلّ تشغيل + إشعار المالك عند فشلين متتاليين (`job_runs`)
export const POST = withJobRun('awards-import', handle);
