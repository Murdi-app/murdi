import { createClient } from '@supabase/supabase-js';
import { sendPush } from '@/lib/push';
import { OWNER_EMAIL } from '@/lib/notifyLead';

// ★ ١ أكتوبر (بأمر المالك): كل مهمة مجدولة لها سجلّ تشغيل (`job_runs`)، وإن فشلت مرتين
//   متتاليتين وصل المالكَ إشعار — مرةً واحدة لكل سلسلة فشل لا مع كل تشغيل.
//   والفشل: استثناءٌ أو ردٌّ ≥ ٤٠٠ (و٤٠١ «غير مصرّح» فشلٌ كذلك: يعني أن السرّ اختلّ).

const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string);

export const JOB_LABEL: Record<string, string> = {
  digest: 'ملخص المالك (صباح/مساء)', followups: 'نبض الأبواب', briefs: 'كتابة توجيه الموظفتين',
  'briefs-send': 'إرسال توجيه الموظفتين', 'awards-import': 'استيراد الترسيات', 'awards-pipeline': 'خط الترسيات',
  'staff-noon': 'فحص الموظفتين', 'notify-owner': 'إشعار المالك', 'check-links': 'فحص روابط الجهات',
  'ops-sweep': 'تمشيط التشغيل', 'mail-watch': 'مراقبة البريد', 'decision-timeouts': 'مهلات القرار',
  watchdog: 'حارس المهام', 'etimad-alerts': 'تنبيهات اعتماد',
};

/** يسجّل تشغيلاً ويُنبّه عند فشلين متتاليين */
export async function recordRun(job: string, startedAt: Date, ok: boolean, status: number, detail: string): Promise<void> {
  const sb = db();
  try {
    await sb.from('job_runs').insert({ job, started_at: startedAt.toISOString(), finished_at: new Date().toISOString(), ok, status, detail: detail.slice(0, 1000) });
    if (ok) return;
    const { data: last } = await sb.from('job_runs').select('id, ok, alerted').eq('job', job).order('started_at', { ascending: false }).limit(2);
    if (last && last.length === 2 && last.every((r) => r.ok === false) && !last[1].alerted) {
      await sendPush({
        title: '⚠️ مهمة فشلت مرتين متتاليتين',
        body: (JOB_LABEL[job] || job) + ' — ' + detail.slice(0, 140),
        url: '/admin', important: true, tag: 'job-fail-' + job,
      }, OWNER_EMAIL).catch(() => null);
      await sb.from('job_runs').update({ alerted: true }).eq('id', last[0].id);
    } else if (last && last[1]?.alerted && last[0].ok === false) {
      await sb.from('job_runs').update({ alerted: true }).eq('id', last[0].id); // السلسلة نفسها — لا إشعار ثانٍ
    }
  } catch { /* السجلّ لا يُسقط المهمة */ }
}

type Handler = (req: Request) => Promise<Response>;

/** يلفّ مسار مهمة: يسجّل نتيجته ويحوّل الاستثناء إلى ٥٠٠ مسجَّل */
export function withJobRun(job: string, handler: Handler): Handler {
  return async (req: Request) => {
    const t0 = new Date();
    try {
      const res = await handler(req);
      let detail = '';
      try { detail = (await res.clone().text()).slice(0, 600); } catch { /* */ }
      await recordRun(job, t0, res.status < 400, res.status, detail);
      return res;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await recordRun(job, t0, false, 500, msg);
      return Response.json({ error: msg }, { status: 500 });
    }
  };
}
