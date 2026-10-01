import { NextResponse } from 'next/server';
import { cronAuthorized } from '@/lib/cronAuth';
import { sendPush } from '@/lib/push';
import { withJobRun } from '@/lib/jobRun';

// إشعارٌ لجوال المالك من تقارير Claude اليومية — مفاتيح الإشعار على الخادم وحده، فيُطلب من هنا
// بسرّ المهام (x-cron-secret، من القاعدة عبر net.http_post) لا من جهازٍ يحمل المفاتيح.
async function handle(req: Request) {
  if (!(await cronAuthorized(req))) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  const b = await req.json().catch(() => ({} as Record<string, unknown>));
  const title = String(b.title || 'مُرضي').slice(0, 80), body = String(b.body || '').slice(0, 240);
  const url = typeof b.url === 'string' && b.url.startsWith('/') ? b.url : '/admin';
  const r = await sendPush({ title, body, url, important: true, tag: 'claude-report-' + new Date().toISOString().slice(0, 13) }, 'hololalmurdi.fs@gmail.com');
  return NextResponse.json({ ok: true, ...r });
}

// ★ سجلّ تشغيل + إشعار المالك عند فشلين متتاليين (`job_runs`)
export const POST = withJobRun('notify-owner', handle);
