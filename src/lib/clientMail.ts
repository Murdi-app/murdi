import type { SupabaseClient } from '@supabase/supabase-js';
import { sendMail } from '@/lib/sendMail';

// ★ ١ أكتوبر (بأمر المالك): رسائل العقد تخرج للعميل من المنصة نفسها باسم المالك —
//   رسالة العقد عند الإصدار، ورسالة الدفع **تلقائياً** لحظة توقيعه. وكل رسالة تُسجَّل
//   في `client_messages` (بحالتها ومعرّف المزوّد) وفي خطّ الصفقة، فلا يُرسل شيءٌ لا أثر له.
export const OWNER_FROM = 'مُرضي للاستشارات المالية <partners@murdi.sa>';
export const OWNER_SENDER = 'د. عبدالحكيم المرضي';

export const mailHtml = (body: string) =>
  '<div style="font-family:Arial,Tahoma,sans-serif;line-height:1.9;direction:rtl;text-align:right;color:#1A3D34;font-size:14.5px;">'
  + body.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#1A6B55;">$1</a>').replace(/\n/g, '<br>')
  + '</div>';

export async function sendClientMail(sb: SupabaseClient, m: {
  companyId: string; toEmail: string; toName?: string | null; subject: string; body: string; event: string;
}): Promise<{ ok: boolean; id?: string | null; reason?: string; at: string }> {
  const at = new Date().toISOString();
  const { data: saved } = await sb.from('client_messages').insert({
    company_id: m.companyId, to_name: m.toName || null, to_email: m.toEmail, template_key: null,
    subject: m.subject.slice(0, 300), body: m.body, status: 'مسودة', created_by_name: OWNER_SENDER,
  }).select('id').single();
  const res = await sendMail({ from: OWNER_FROM, to: m.toEmail, replyTo: 'partners@murdi.sa', subject: m.subject, html: mailHtml(m.body) });
  if (saved?.id) {
    await sb.from('client_messages').update(res.ok
      ? { status: 'مُرسلة', sent_at: at, error_note: null, provider_id: res.id }
      : { status: 'فشل', error_note: res.reason.slice(0, 400) }).eq('id', saved.id);
  }
  await sb.from('deal_events').insert({
    company_id: m.companyId, kind: 'client_email',
    title: (res.ok ? '📧 ' : '⚠️ لم تخرج: ') + m.event,
    detail: m.toEmail + (res.ok ? '' : ' — ' + res.reason), actor: 'owner', needs_owner: !res.ok,
  });
  return res.ok ? { ok: true, id: res.id, at } : { ok: false, reason: res.reason, at };
}
