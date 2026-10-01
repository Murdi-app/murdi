import type { SupabaseClient } from '@supabase/supabase-js';
import { askClaude } from '@/lib/claudeApi';
import { riyadhDate } from '@/lib/staffBrief';
import { gmailConfigured } from '@/lib/gmail';

// ★ ١ أكتوبر (بأمر المالك): «تمشيط الصباح» و«حصاد المساء» على الخادم — كانا جلستي Claude
//   على جهاز المالك. الحقائق تُجمع هنا بالـSQL (لا تُخمَّن)، والصياغة بـClaude بالتعليمات
//   نفسها. ولا يُرسل منه شيءٌ لجهة أو عميل أو موظفة — للمالك وحده (إشعار + بريد).

const DAY = 86400_000;
const days = (t: string | null) => (t ? Math.floor((Date.now() - Date.parse(t)) / DAY) : null);

/** توصيات «وسيلة تواصل» المعلّقة: يُفتح رابط مصدرها ويُتحقق أن الرقم/البريد فيه */
async function verifyContactRecs(sb: SupabaseClient): Promise<{ accepted: number; rejected: number; left: number }> {
  const out = { accepted: 0, rejected: 0, left: 0 };
  const { data } = await sb.from('award_recommendations').select('id, value').eq('status', 'pending').eq('kind', 'contact').limit(20);
  for (const r of data || []) {
    const v = (r.value || {}) as { phone?: string; email?: string; source_url?: string };
    const url = String(v.source_url || '');
    if (!/^https?:\/\//.test(url)) { out.left++; continue; }
    let page = '';
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(12000), headers: { 'User-Agent': 'Mozilla/5.0 (murdi.sa verification)' } });
      if (res.ok) page = (await res.text()).slice(0, 600_000);
    } catch { /* يبقى معلّقاً */ }
    if (!page) { out.left++; continue; }
    const digits = page.replace(/[^\d]/g, '');
    const ph = String(v.phone || '').replace(/[^\d]/g, '').slice(-9);
    const em = String(v.email || '').toLowerCase();
    const found = (ph.length >= 8 && digits.includes(ph)) || (!!em && page.toLowerCase().includes(em));
    const fn = found ? 'accept_recommendation' : 'reject_recommendation';
    const why = found ? 'تحقّق الخادم: الوسيلة ظاهرة في صفحة المصدر ' + new URL(url).hostname : 'تحقّق الخادم: الوسيلة غير ظاهرة في صفحة المصدر';
    const { error } = await sb.rpc(fn, { rec: r.id, by_name: 'Claude (مراجعة يومية)', why });
    if (error) out.left++; else if (found) out.accepted++; else out.rejected++;
  }
  return out;
}

export async function opsSweep(sb: SupabaseClient, mode: 'morning' | 'evening'): Promise<{ text: string; facts: Record<string, unknown> }> {
  const today = riyadhDate();
  const since = new Date(Date.now() - DAY).toISOString();
  const week = new Date(Date.now() - 7 * DAY).toISOString();
  const [sr, pays, inq, mini, runs, pipe, outbox, mail, act, briefs, cos] = await Promise.all([
    sb.from('service_requests').select('company_id, service_title, status, updated_at, created_at').in('status', ['submitted', 'priced', 'paid', 'in_progress', 'in_follow_up']),
    sb.from('payments').select('company_id, created_at').eq('status', 'awaiting_confirmation'),
    sb.from('service_inquiries').select('full_name, company_name, src').eq('contacted', false).gte('created_at', week),
    sb.from('mini_assessments').select('full_name, company_name, src').eq('contacted', false).gte('created_at', week),
    sb.from('job_runs').select('job, ok').gte('started_at', since),
    sb.from('award_pipeline').select('status'),
    sb.from('award_outbox').select('status').gte('created_at', since),
    sb.from('mail_seen').select('kind').gte('created_at', since),
    sb.rpc('staff_activity', { p_from: today, p_to: today }),
    sb.from('daily_briefs').select('to_email, read_at, status').eq('brief_date', today),
    sb.from('companies').select('id, company_name'),
  ]);
  const coName = new Map((cos.data || []).map((c) => [String(c.id), String(c.company_name)]));
  const count = (rows: Record<string, unknown>[] | null, k: string) =>
    (rows || []).reduce<Record<string, number>>((a, r) => { const x = String(r[k]); a[x] = (a[x] || 0) + 1; return a; }, {});
  const failed: Record<string, number> = {};
  for (const r of runs.data || []) if (r.ok === false) failed[r.job] = (failed[r.job] || 0) + 1;
  const { data: sqlHealth } = await sb.rpc('ops_sql_job_health');
  const recs = await verifyContactRecs(sb).catch(() => ({ accepted: 0, rejected: 0, left: -1 }));

  const facts = {
    mode, date: today,
    money: {
      unpaid_dhai: (sr.data || []).filter((r) => ['submitted', 'priced'].includes(r.status)).map((r) => ({ co: coName.get(String(r.company_id)), service: r.service_title, days: days(r.created_at) })),
      stale_paid_raghad: (sr.data || []).filter((r) => ['paid', 'in_progress', 'in_follow_up'].includes(r.status) && (days(r.updated_at) ?? 0) >= 3).map((r) => ({ co: coName.get(String(r.company_id)), service: r.service_title, idle_days: days(r.updated_at) })),
      transfers_awaiting_confirmation: (pays.data || []).map((p) => ({ co: coName.get(String(p.company_id)), since_days: days(p.created_at) })),
    },
    knocked_untouched: { inquiries: inq.data || [], assessments: mini.data || [] },
    platform: { job_failures_24h: failed, sql_jobs_failed: (sqlHealth || []).filter((h: { last_status: string }) => h.last_status === 'failed').map((h: { jobname: string }) => h.jobname), pipeline: count(pipe.data, 'status'), outbox_24h: count(outbox.data, 'status') },
    mail_24h: gmailConfigured() ? count(mail.data, 'kind') : 'غير موصول بعد (أسرار Gmail لم تُضبط)',
    staff_today: (act.data || []).map((a: { name: string; touches: number; files: number; last_at: string | null }) => ({ name: a.name, actions: a.touches, files: a.files, last: a.last_at })),
    briefs_today: (briefs.data || []).map((b) => ({ to: b.to_email, read: !!b.read_at, status: b.status })),
    recommendations: recs,
  };

  const text = await askClaude(
    'أنت مكتب الدكتور عبدالحكيم المرضي (منصة مُرضي). تكتب له ' + (mode === 'morning' ? 'تمشيط الصباح' : 'حصاد المساء') + ' من الحقائق المعطاة وحدها — لا تخمّن ولا تضف. '
    + 'عربيٌّ قصيرٌ جداً بأسطر: خطّ المال (من لم يدفع — صفّ ضي · المدفوع الساكن — صفّ رغد · تحويلات تنتظر التأكيد) · من طرق بابنا ولم يُلمس · ما تمّ (البريد · التوصيات · المهام) · ما يحتاج قراره فقط. '
    + 'لا تذكر «كفالة» ولا «قرض». وإن لم يتحرّك شيء فقله في سطر. والسطر الأول عنوانٌ من ست كلمات يصلح إشعاراً.',
    JSON.stringify(facts), 900).catch((e) => 'تعذّرت الصياغة (' + (e instanceof Error ? e.message : e) + ')\n' + JSON.stringify(facts).slice(0, 1500));
  return { text, facts };
}
