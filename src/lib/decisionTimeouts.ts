import type { SupabaseClient } from '@supabase/supabase-js';
import { issueAndSend } from '@/lib/contractIssue';
import { unsignedAfterReminder } from '@/lib/signReminders';

// ★ ١ أكتوبر (بأمر المالك): لا مهمة تنتظر ردّ المالك. لكل ما ينتظر قراره مهلةٌ وخيارٌ
//   افتراضيٌّ آمن، ويصله إشعارٌ بما حدث مرةً واحدة (`decision_marks`):
//   · مسودّة عقدٍ لم تُصدر خلال auto_issue_hours (٢٤) ← تُصدر بالقالب المعتمد ونسبتها،
//     وتخرج رسالة العقد للعميل على بريده (بإذنه الصريح).
//   · رسالةُ موظفةٍ حرّة «بانتظار الاعتماد» ٢٤ ساعة ← «مؤجّلة» (لا تخرج).
//   · طلب تشغيل مطابقة ٤٨ ساعة ← لا يُشغَّل.
//   · بندٌ في «ينتظر كلمتك» (approvals) ٤٨ ساعة ← مؤجَّل بلا تنفيذ.
//   · توصيات إسقاط/مقاول باطن/تحسين قالب ٧٢ ساعة ← تُرفض (لا تغيير في الملف).
//   ويُستثنى بأمره: الاستشارة المجانية (الفجوة) والقوالب الجديدة — تبقى تنتظر اعتماده.

const H = 3600_000;
export type TimeoutResult = { issued: string[]; postponed: string[]; unsigned: string[] };

async function mark(sb: SupabaseClient, t: string, id: string, action: string, note = ''): Promise<boolean> {
  const { error } = await sb.from('decision_marks').insert({ ref_table: t, ref_id: id, action, note });
  return !error; // مسجَّلٌ سلفاً ← لا يُكرَّر الإشعار
}

export async function runTimeouts(sb: SupabaseClient): Promise<TimeoutResult> {
  const r: TimeoutResult = { issued: [], postponed: [], unsigned: [] };
  const { data: setting } = await sb.from('fee_settings').select('value').eq('key', 'auto_issue_hours').maybeSingle();
  const autoH = Number(setting?.value ?? 24) || 24;

  // ★ ٧/١٠: أصدرت المهلةُ سنداً تركه المالك مسودّةً عمداً للمراجعة (كينجدوم ٦/١٠) — فلا تمسّ إلا
  //   مسودّات العقود الآلية (طلب العميل)، لا السندات ولا ما أُمسك للمراجعة (`auto_issue=false`).
  const { data: drafts } = await sb.from('contracts').select('id, company_id').eq('status', 'draft').eq('auto_issue', true)
    .neq('contract_type', 'voucher').lt('updated_at', new Date(Date.now() - autoH * H).toISOString());
  for (const d of drafts || []) {
    const { data: co } = await sb.from('companies').select('company_name').eq('id', d.company_id).maybeSingle();
    const name = String(co?.company_name || d.id);
    try {
      const x = await issueAndSend(sb, String(d.id), 'مهلة الإصدار ' + autoH + ' ساعة');
      r.issued.push(name + (x.sent ? ' — صدر وخرجت رسالته إلى ' + x.to : ' — صدر، ولم تخرج الرسالة: ' + (x.reason || '')));
    } catch (e) { r.issued.push(name + ' — تعذّر: ' + (e instanceof Error ? e.message : e)); }
  }

  // ★ ٣/١٠: ذُكّر بالواتساب ولم يوقّع خلال يومَي عمل ← إشعار المالك باسمه، ولا يعود لضي
  r.unsigned = await unsignedAfterReminder(sb, new Date(Date.now() + 3 * H).toISOString().slice(0, 10)).catch(() => []);

  const { data: msgs } = await sb.from('client_messages').select('id, subject, created_by_name').eq('status', 'بانتظار الاعتماد').lt('created_at', new Date(Date.now() - 24 * H).toISOString());
  for (const m of msgs || []) {
    await sb.from('client_messages').update({ status: 'مؤجّلة', error_note: 'انقضت مهلة الاعتماد (٢٤ ساعة) — لم تخرج' }).eq('id', m.id);
    if (await mark(sb, 'client_messages', String(m.id), 'postpone')) r.postponed.push('رسالة ' + (m.created_by_name || '') + ': ' + String(m.subject).slice(0, 50));
  }

  const { data: mr } = await sb.from('match_requests').select('id, requested_at').eq('status', 'requested').lt('requested_at', new Date(Date.now() - 48 * H).toISOString());
  for (const m of mr || []) if (await mark(sb, 'match_requests', String(m.id), 'postpone')) r.postponed.push('طلب مطابقة منذ ' + String(m.requested_at).slice(0, 10) + ' — لم يُشغَّل');

  const { data: ap } = await sb.from('approvals').select('id, title').eq('status', 'pending').lt('created_at', new Date(Date.now() - 48 * H).toISOString());
  for (const a of ap || []) {
    await sb.from('approvals').update({ status: 'cancelled', answer_note: 'انقضت المهلة (٤٨ ساعة) — أُجّل بلا تنفيذ', answered_at: new Date().toISOString() }).eq('id', a.id).eq('status', 'pending');
    if (await mark(sb, 'approvals', String(a.id), 'postpone')) r.postponed.push('بند: ' + String(a.title).slice(0, 60));
  }

  const { data: recs } = await sb.from('award_recommendations').select('id, kind').eq('status', 'pending').in('kind', ['drop', 'subcontractor', 'template']).lt('created_at', new Date(Date.now() - 72 * H).toISOString());
  for (const x of recs || []) {
    const { error } = await sb.rpc('reject_recommendation', { rec: x.id, by_name: 'مهلة القرار', why: 'انقضت المهلة (٧٢ ساعة) — لا تغيير' });
    if (!error) r.postponed.push('توصية ' + x.kind + ' رُفضت بالمهلة');
  }
  return r;
}
