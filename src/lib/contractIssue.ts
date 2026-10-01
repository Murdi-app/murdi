import type { SupabaseClient } from '@supabase/supabase-js';
import { issuedMessage, party } from '@/lib/contractFirst';
import { sendClientMail } from '@/lib/clientMail';

// ★ ١ أكتوبر (بأمر المالك وإذنه الصريح): ما صنعناه مع تول بوكس صار للمنصة كلها —
//   إصدار العقد/السند **يُرسل** رسالته للعميل على بريده المسجّل برابطه القصير، من الزرّ
//   أو بانقضاء المهلة، ولا تخرج مرتين للوثيقة نفسها (`decision_marks`).
export type IssueResult = { issued: boolean; sent: boolean; to?: string | null; reason?: string; message?: string; link?: string; at?: string };

export async function issueAndSend(sb: SupabaseClient, contractId: string, by = 'المالك'): Promise<IssueResult> {
  const { data: c } = await sb.from('contracts').select('id, status, company_id, service_request_id, contract_type').eq('id', contractId).maybeSingle();
  if (!c) return { issued: false, sent: false, reason: 'العقد غير موجود' };
  if (c.status === 'draft') {
    const { error } = await sb.from('contracts').update({ status: 'issued', issued_at: new Date().toISOString() }).eq('id', c.id).eq('status', 'draft');
    if (error) return { issued: false, sent: false, reason: error.message };
  } else if (c.status !== 'issued') return { issued: false, sent: false, reason: 'حالته ' + c.status };
  if (!c.service_request_id) return { issued: true, sent: false, reason: 'لا طلب مرتبط' };
  const m = await issuedMessage(sb, String(c.service_request_id), by);
  const { error: dup } = await sb.from('decision_marks').insert({ ref_table: 'contracts', ref_id: String(c.id), action: 'sent_issue', note: by });
  if (dup) return { issued: true, sent: false, reason: 'أُرسلت رسالته من قبل', message: m.text, link: m.link };
  const unmark = () => sb.from('decision_marks').delete().eq('ref_table', 'contracts').eq('ref_id', String(c.id)).eq('action', 'sent_issue');
  const p = await party(sb, String(c.company_id));
  if (!p.email) { await unmark(); return { issued: true, sent: false, reason: 'لا بريد مسجّل للعميل', message: m.text, link: m.link }; }
  const { data: co } = await sb.from('companies').select('company_name').eq('id', c.company_id).maybeSingle();
  const voucher = c.contract_type === 'voucher';
  const r = await sendClientMail(sb, {
    companyId: String(c.company_id), toEmail: p.email, toName: p.name,
    subject: (voucher ? 'سند الخدمة' : 'عقد الخدمة') + ' — ' + String(co?.company_name || ''),
    body: m.text, event: (voucher ? 'رسالة السند' : 'رسالة العقد') + ' برابطه القصير (' + by + ')',
  });
  if (!r.ok) await unmark();
  return { issued: true, sent: r.ok, to: p.email, reason: r.reason, message: m.text, link: m.link, at: r.at };
}
