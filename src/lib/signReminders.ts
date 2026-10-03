import type { SupabaseClient } from '@supabase/supabase-js';
import { issuedMessage, party } from '@/lib/contractFirst';
import { loadFeeSettings, fillMessage } from '@/lib/feeSettings';

// ★ ٣ أكتوبر (قاعدةٌ دائمة بأمر المالك، ونصّها اعتمده):
//   · عقدٌ أو سندٌ صدر ولم يُوقَّع (أو السند لم يُسدَّد) خلال يومَي عمل ← يظهر في توجيه ضي الصباحي
//     مهمةَ واتسابٍ واحدة بنصّ التذكير المعتمد (fee_settings.msg_sign_reminder) — مرةً واحدة فقط.
//   · فإن لم يوقّع خلال يومَي عمل بعدها ← يصل المالكَ إشعارٌ باسم العميل، ولا يظهر لضي مرةً أخرى.
//   والأثر في `decision_marks`: remind_wa (ظهر لضي) · remind_owner (أُشعر المالك).

const isWorkday = (d: Date) => ![5, 6].includes(d.getUTCDay()); // الجمعة والسبت عطلة
const riyadhDay = (iso: string) => new Date(new Date(iso).getTime() + 3 * 3600_000).toISOString().slice(0, 10);

/** أيام العمل الكاملة بين يومين (لا يُعدّ يوم البدء ولا اليوم) */
export function workdaysBetween(fromDay: string, today: string): number {
  let n = 0;
  for (let t = Date.parse(fromDay + 'T12:00:00Z') + 86400_000; t < Date.parse(today + 'T12:00:00Z'); t += 86400_000) if (isWorkday(new Date(t))) n++;
  return n;
}

type Open = { id: string; company_id: string; service_request_id: string; contract_type: string; issued_at: string; company: string; service: string };

/** الوثائق الصادرة التي تنتظر العميل (عقدٌ بلا توقيع، أو سندٌ بلا سداد) */
async function openDocs(sb: SupabaseClient): Promise<Open[]> {
  const { data: cs } = await sb.from('contracts').select('id, company_id, service_request_id, contract_type, issued_at')
    .eq('status', 'issued').not('service_request_id', 'is', null).not('issued_at', 'is', null);
  if (!cs?.length) return [];
  const { data: srs } = await sb.from('service_requests').select('id, status, service_title').in('id', cs.map((c) => c.service_request_id));
  const { data: cos } = await sb.from('companies').select('id, company_name').in('id', cs.map((c) => c.company_id));
  const sr = new Map((srs || []).map((s) => [String(s.id), s]));
  const co = new Map((cos || []).map((c) => [String(c.id), String(c.company_name || '')]));
  return cs.filter((c) => {
    const s = sr.get(String(c.service_request_id));
    // السند لا يُوقَّع: ينتظر ما دام الطلب لم يُسدَّد
    return s && (c.contract_type !== 'voucher' || ['priced', 'submitted'].includes(String(s.status)));
  }).map((c) => ({ ...c, id: String(c.id), company: co.get(String(c.company_id)) || '', service: String(sr.get(String(c.service_request_id))?.service_title || '') })) as Open[];
}

export type Reminder = { contractId: string; note: string; message: string };

/** ما يدخل توجيه ضي اليوم — لا يُعلَّم هنا (التوجيه يُجرَّب أحياناً)؛ يعلّمه مسار الكتابة بعد الحفظ */
export async function dueReminders(sb: SupabaseClient, today: string): Promise<Reminder[]> {
  // اليومان يُعدّان من وصول الرسالة للعميل (إن أُرسلت بعد الإصدار) لا من الإصدار وحده
  const all = await openDocs(sb);
  const { data: sent } = all.length
    ? await sb.from('decision_marks').select('ref_id, created_at').eq('ref_table', 'contracts').eq('action', 'sent_issue').in('ref_id', all.map((d) => d.id))
    : { data: [] as { ref_id: string; created_at: string }[] };
  const since = (d: Open) => { const s = (sent || []).find((m) => m.ref_id === d.id)?.created_at; return s && s > d.issued_at ? s : d.issued_at; };
  const docs = all.filter((d) => workdaysBetween(riyadhDay(since(d)), today) >= 2);
  if (!docs.length) return [];
  const { data: marks } = await sb.from('decision_marks').select('ref_id').eq('ref_table', 'contracts').eq('action', 'remind_wa').in('ref_id', docs.map((d) => d.id));
  const done = new Set((marks || []).map((m) => String(m.ref_id)));
  const s = await loadFeeSettings(sb);
  const out: Reminder[] = [];
  for (const d of docs.filter((x) => !done.has(x.id))) {
    const p = await party(sb, d.company_id);
    const { link } = await issuedMessage(sb, d.service_request_id, 'تذكير التوقيع');
    const voucher = d.contract_type === 'voucher';
    let msg = fillMessage(s.msgSignReminder, { 'الاسم': p.name || '', 'الوثيقة': voucher ? 'سند' : 'عقد', 'الخدمة': d.service, 'رابط العقد': link });
    if (voucher) msg = msg.replace('تراجعه وتوقّعه من هنا مباشرة', 'تراجعه وتسدّد من هنا مباشرة').replace('وبعد التوقيع يوصلك رابط السداد تلقائياً، ونبدأ', 'وبعد السداد نبدأ');
    out.push({ contractId: d.id, note: 'أرسلي لـ' + (p.name || 'العميل') + ' (' + d.company + ') تذكير ' + (voucher ? 'السند' : 'توقيع العقد') + ' هذا بالواتساب مرةً واحدة، ثم سجّليه في المنصة', message: msg });
  }
  return out;
}

export async function markReminded(sb: SupabaseClient, ids: string[], today: string): Promise<void> {
  for (const id of ids) await sb.from('decision_marks').insert({ ref_table: 'contracts', ref_id: id, action: 'remind_wa', note: 'توجيه ' + today });
}

/** من ذُكّر ولم يوقّع خلال يومَي عمل بعد التذكير — يُشعَر المالك مرةً، ولا يعود لضي */
export async function unsignedAfterReminder(sb: SupabaseClient, today: string): Promise<string[]> {
  const docs = await openDocs(sb);
  if (!docs.length) return [];
  const { data: marks } = await sb.from('decision_marks').select('ref_id, action, created_at').eq('ref_table', 'contracts').in('action', ['remind_wa', 'remind_owner']).in('ref_id', docs.map((d) => d.id));
  const out: string[] = [];
  for (const d of docs) {
    const wa = (marks || []).find((m) => m.ref_id === d.id && m.action === 'remind_wa');
    if (!wa || (marks || []).some((m) => m.ref_id === d.id && m.action === 'remind_owner')) continue;
    if (workdaysBetween(riyadhDay(wa.created_at), today) < 2) continue;
    const { error } = await sb.from('decision_marks').insert({ ref_table: 'contracts', ref_id: d.id, action: 'remind_owner', note: 'لم يوقّع بعد التذكير' });
    if (!error) out.push(d.company + ' — ' + d.service + (d.contract_type === 'voucher' ? ' (سند لم يُسدَّد)' : ' (عقد لم يُوقَّع)'));
  }
  return out;
}
