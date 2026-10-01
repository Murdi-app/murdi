import type { SupabaseClient } from '@supabase/supabase-js';
import { recordRun } from '@/lib/jobRun';

// ★ ١ أكتوبر: حارس المهام — (١) مهام SQL المحضة (لا مسار لها يسجّل نفسه) تُقرأ من
//   cron.job_run_details؛ (٢) مهمةٌ لم تعمل في نافذتها تُسجَّل فشلاً «لم يعمل». فيصل المالك
//   إشعار الفشلين المتتاليين من `recordRun` نفسه.
const MAX_GAP_H: Record<string, number> = {
  'awards-pipeline': 1, 'check-links': 1, 'mail-watch': 1.5, 'awards-import': 26, digest: 14, followups: 26,
  briefs: 74, 'briefs-send': 74, 'staff-noon': 74, 'ops-sweep': 14, 'decision-timeouts': 2,
};

export async function watchdog(sb: SupabaseClient): Promise<{ sql_failed: string[]; missed: string[] }> {
  const out = { sql_failed: [] as string[], missed: [] as string[] };
  const { data: h } = await sb.rpc('ops_sql_job_health');
  for (const j of (h || []) as { jobname: string; last_status: string; last_at: string; last_msg: string }[]) {
    if (j.last_status !== 'failed') continue;
    const { data: seen } = await sb.from('job_runs').select('id').eq('job', 'sql:' + j.jobname).eq('started_at', j.last_at).limit(1);
    if (seen?.length) continue;
    await recordRun('sql:' + j.jobname, new Date(j.last_at), false, 500, j.last_msg || 'failed');
    out.sql_failed.push(j.jobname);
  }
  for (const [job, gap] of Object.entries(MAX_GAP_H)) {
    const { data: last } = await sb.from('job_runs').select('started_at, status').eq('job', job).order('started_at', { ascending: false }).limit(1);
    const at = last?.[0]?.started_at ? Date.parse(last[0].started_at) : 0;
    if (!at) continue; // لم تعمل قط بعد بدء السجلّ — لا يُحكم عليها
    if (Date.now() - at > gap * 3600_000 && last?.[0]?.status !== 599) {
      await recordRun(job, new Date(), false, 599, 'لم تعمل منذ ' + Math.round((Date.now() - at) / 3600_000) + ' ساعة');
      out.missed.push(job);
    }
  }
  return out;
}
