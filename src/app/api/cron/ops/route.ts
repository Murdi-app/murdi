import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cronAuthorized } from '@/lib/cronAuth';
import { recordRun } from '@/lib/jobRun';
import { sendPush } from '@/lib/push';
import { sendMail } from '@/lib/sendMail';
import { OWNER_EMAIL } from '@/lib/notifyLead';
import { watchMail } from '@/lib/opsMail';
import { opsSweep } from '@/lib/opsSweep';
import { runTimeouts } from '@/lib/decisionTimeouts';
import { watchdog } from '@/lib/watchdog';

// ★ ١ أكتوبر (بأمر المالك): مهام التشغيل على الخادم — تعمل والجهاز مغلق وبلا انتظار المالك.
//   يوقظها pg_cron بـ kick_ops('<mode>'):
//   mail (كل ٣٠ دقيقة) · sweep-morning (١٠:٣٠ص) · sweep-evening (٦:٣٠م) · timeouts (كل ساعة) · watchdog (كل ٣٠ دقيقة).
//   ولكلٍّ سجلّ تشغيل في job_runs وإشعارٌ عند فشلين متتاليين.
export const maxDuration = 120;

const JOB: Record<string, string> = { mail: 'mail-watch', 'sweep-morning': 'ops-sweep', 'sweep-evening': 'ops-sweep', timeouts: 'decision-timeouts', watchdog: 'watchdog' };

export async function POST(req: Request) {
  if (!(await cronAuthorized(req))) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const mode = String(body?.mode || '');
  const job = JOB[mode];
  if (!job) return NextResponse.json({ error: 'mode غير معروف' }, { status: 400 });
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string);
  const t0 = new Date();
  try {
    let out: Record<string, unknown> = {};
    if (mode === 'mail') {
      const r = await watchMail(sb);
      out = r;
      if (r.award + r.entity + r.inquiry + r.etimad > 0) {
        await sendPush({ title: '📬 بريد partners@ — جديد', body: r.notes.slice(0, 4).join(' · '), url: '/admin/channel', important: r.award + r.entity > 0, tag: 'mail-' + t0.toISOString().slice(0, 13) }, OWNER_EMAIL).catch(() => null);
      }
    } else if (mode === 'sweep-morning' || mode === 'sweep-evening') {
      const kind = mode === 'sweep-morning' ? 'morning' : 'evening';
      const { text, facts } = await opsSweep(sb, kind);
      await sb.from('ops_reports').insert({ kind, body: text, facts });
      const [head, ...rest] = text.split('\n').filter(Boolean);
      await sendPush({ title: (kind === 'morning' ? '☀️ ' : '🌙 ') + (head || 'تقرير التشغيل').replace(/^[#*\s]+/, '').slice(0, 60), body: rest.join(' · ').slice(0, 180), url: '/admin', tag: 'sweep-' + kind + '-' + t0.toISOString().slice(0, 10) }, OWNER_EMAIL).catch(() => null);
      await sendMail({ from: 'مُرضي <partners@murdi.sa>', to: OWNER_EMAIL, subject: (kind === 'morning' ? '☀️ تمشيط الصباح' : '🌙 حصاد المساء') + ' — ' + t0.toISOString().slice(0, 10),
        html: '<div dir="rtl" style="font-family:Tahoma,Arial;line-height:1.9;white-space:pre-wrap;color:#1A3D34">' + text.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</div>' });
      out = { chars: text.length };
    } else if (mode === 'timeouts') {
      const r = await runTimeouts(sb);
      out = r;
      const lines = [...r.waiting_contracts.map((x) => 'عقدٌ مسودّة ينتظر إصدارك: ' + x), ...r.postponed];
      if (lines.length) await sendPush({ title: '⏳ انقضت مهلة قرار', body: lines.slice(0, 4).join(' · '), url: '/admin/services', important: r.waiting_contracts.length > 0, tag: 'timeouts-' + t0.toISOString().slice(0, 13) }, OWNER_EMAIL).catch(() => null);
    } else if (mode === 'watchdog') {
      out = await watchdog(sb);
    }
    await recordRun(job, t0, true, 200, JSON.stringify(out).slice(0, 900));
    return NextResponse.json({ ok: true, mode, ...out });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await recordRun(job, t0, false, 500, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
