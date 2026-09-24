import { createClient } from '@supabase/supabase-js';
import { sendMail } from './sendMail';
import { sendPush } from './push';
import { prettyPhone } from './phone';

// مَن يعلم بالعميل حين يدخل — ولماذا كاد هذا يُفلس الإعلان.
//
// في ١٦ سبتمبر دخل **ثمانية** من الإعلان إلى التقييم المجاني، سبعةٌ منهم
// أكملوا الأسئلة وكتبوا أرقامهم، وأعلاهم درجةً ٧٨. ولم يتصل بهم أحد ذلك
// اليوم ولا الذي بعده. والسبب لم يكن إهمالاً: مسار `mini-save` كان يُشعر
// بإشعار المتصفح **وحده وبلا تحديد مستقبِل**، وجدولُ الاشتراكات فيه ثلاثة
// أجهزة كلُّها للمالك. فالمالك يرى، والموظفة التي تتصل لا ترى شيئاً.
//
// والدرس الذي يُعمَّم: **إشعار المتصفح لا يصلح وحده قناةً لمن يجب أن يعمل**،
// لأنه معلَّقٌ على إذنٍ يمنحه المستخدم من جهازه — وما لم تأذن الموظفة بنفسها
// فالقناة مقطوعة وهي لا تعلم أنها مقطوعة. فالبريد هو الأصل لأنه يصل سواء
// أذنت أم لم تأذن، وإشعار الجوال زيادةٌ تسبقه حين يكون الإذن قائماً.
//
// ومسار `hooks/new-client` كان يفعل هذا صحيحاً منذ البداية (بريدٌ للمكتب
// كلّه وإشعارٌ معه)، فالعطب كان في مسارٍ واحد لا في التصميم. ولذلك جُمع
// المنطق هنا: قناةٌ واحدة يستعملها المساران، فلا يسهو أحدهما عن الآخر مرة
// أخرى.

const admin = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  );

export const OWNER_EMAIL = 'hololalmurdi.fs@gmail.com';
const FROM = 'مُرضي <partners@murdi.sa>';

const esc = (s: unknown) =>
  String(s ?? '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string));

const row = (k: string, v: unknown) =>
  '<tr><td style="padding:6px 10px;color:#6B8A80;font-size:13px">' + esc(k) +
  '</td><td style="padding:6px 10px;color:#1A3D34;font-weight:bold;font-size:13.5px">' + esc(v) + '</td></tr>';

/**
 * المكتب الذي يُخطَر بالعملاء: المالك ومعه الموظفات النشطات — لأن الموظفة
 * هي من تتصل، فإخطارُ المالك وحده يُبقي الاسم واقفاً حتى يفتح هو لوحته.
 * وتعذُّرُ قراءة موظفةٍ لا يُسقط البقية، ولا يُسقط الإخطار أصلاً.
 */
export async function teamEmails(): Promise<string[]> {
  const out: string[] = [OWNER_EMAIL];
  try {
    const sb = admin();
    const { data: st } = await sb.from('staff').select('user_id').eq('active', true);
    for (const s of st || []) {
      const id = String(s.user_id || '');
      if (!id) continue;
      try {
        const { data } = await sb.auth.admin.getUserById(id);
        const e = data?.user?.email;
        if (e && !out.includes(e)) out.push(e);
      } catch { /* موظفةٌ تعذّر قراءتها لا تُسقط البقية */ }
    }
  } catch { /* الإخطار يمضي للمالك على الأقل */ }
  return out;
}

/**
 * إخطار المكتب كلّه بواردٍ جديد — بريدٌ وإشعارٌ معاً، ولنفس الجمهور.
 *
 * ★ أُضيف في ٢٤ سبتمبر بعد أن تبيّن أن ثلاثة أبوابٍ تُخطر المالك وحده:
 *   طلب الخدمة من الموقع وطلب الخدمة من الحساب كانا يُرسلان `sendPush` بلا
 *   `to` — وجدولُ الاشتراكات فيه جهازان كلاهما للمالك، فالإشعار يصله هو
 *   ولا يصل أحداً سواه. وطلبُ المطابقة كان بريداً للمالك نصّاً.
 *   فمرّ من الموقع ثلاثةُ طلباتٍ في يومين ولم تعلم بها الموظفة التي تتصل.
 *
 *   والدرس نفسه المكتوب أعلاه: من يجب أن يعمل يُخطَر بالبريد أولاً، لأنه
 *   يصل بلا إذن متصفح — وإشعار الجوال زيادةٌ حين يكون الإذن قائماً.
 *
 * ولا يرمي أبداً: فشلُ إخطارٍ لا يُسقط طلبَ عميل.
 */
export async function notifyTeam(n: {
  subject: string;
  head: string;
  /** صفوف الجدول: [العنوان، القيمة] — ما فرغ منها يُحذف */
  facts: Array<[string, unknown]>;
  /** المسار الذي يُفتح من الزرّ ومن الإشعار */
  url: string;
  pushTitle: string;
  pushBody: string;
  tag?: string;
}): Promise<{ mail: boolean; push: number }> {
  const to = await teamEmails();

  const html =
    '<div dir="rtl" style="font-family:Arial;line-height:1.9;color:#1A3D34;max-width:560px">' +
    '<h2 style="color:#1A3D34;margin:0 0 4px">' + esc(n.subject) + '</h2>' +
    '<p style="margin:0 0 14px;color:#6B8A80;font-size:13.5px">' + esc(n.head) + '</p>' +
    '<table style="border-collapse:collapse;width:100%;background:#F7FBF9;border-radius:8px">' +
    n.facts.filter(([, v]) => String(v ?? '').trim() !== '').map(([k, v]) => row(k, v)).join('') +
    '</table>' +
    '<p style="margin:18px 0 8px">' +
    '<a href="https://murdi.sa' + n.url + '" style="background:#1A3D34;color:#fff;padding:12px 26px;border-radius:8px;text-decoration:none;font-weight:bold">افتح الوارد</a>' +
    '</p>' +
    '<p style="margin:0;color:#6B8A80;font-size:12.5px">حرارة العميل تبرد بالساعات — لا بالأيام.</p>' +
    '</div>';

  let mailOk = false;
  try {
    const r = await sendMail({ from: FROM, to, subject: n.subject, html });
    mailOk = r.ok;
  } catch { /* البريد سقط — يبقى إشعار الجوال */ }

  let sent = 0;
  try {
    const p = await sendPush(
      { title: n.pushTitle, body: n.pushBody, url: n.url, important: true, tag: n.tag },
      to
    );
    sent = p.sent;
  } catch { /* إشعار الجوال سقط — البريد وصل */ }

  return { mail: mailOk, push: sent };
}

export type LeadNotice = {
  id: string;
  name: string;
  /** اسم المنشأة — منفصلٌ عن اسم الشخص، فالموظفة تنادي صاحبها باسمه */
  company?: string | null;
  phone: string;
  /** null قبل اكتمال الأسئلة */
  score: number | null;
  track?: string | null;
  src?: string | null;
  completed: boolean;
};

/**
 * إخطار المكتب بعميلٍ دخل من التقييم المجاني. لا يرمي أبداً: فشلُ إخطارٍ
 * لا يجوز أن يُسقط تسجيل عميل — وهذا هو سبب `catch` عند كل حدّ.
 */
export async function notifyLead(lead: LeadNotice): Promise<{ mail: boolean; push: number }> {
  const to = await teamEmails();
  const phone = prettyPhone(lead.phone);
  const verdict =
    lead.score === null ? '' : lead.score >= 75 ? 'مؤهَّل' : lead.score >= 50 ? 'فجوة محددة' : 'يحتاج رفعاً';

  const who = lead.company || lead.name;
  const subject = lead.completed
    ? 'أكمل التقييم: ' + who + ' — ' + String(lead.score ?? '؟') + '/١٠٠' + (verdict ? ' · ' + verdict : '')
    : 'عميل محتمل جديد: ' + who;

  const head = lead.completed
    ? 'أنهى التقييم المجاني الآن — وهو ينتظر اتصالاً'
    : 'بدأ التقييم المجاني وترك اسمه وجواله';

  const html =
    '<div dir="rtl" style="font-family:Arial;line-height:1.9;color:#1A3D34;max-width:560px">' +
    '<h2 style="color:#1A3D34;margin:0 0 4px">' + esc(lead.company || lead.name) + '</h2>' +
    '<p style="margin:0 0 14px;color:#6B8A80;font-size:13.5px">' + esc(head) + '</p>' +
    '<table style="border-collapse:collapse;width:100%;background:#F7FBF9;border-radius:8px">' +
    (lead.company ? row('الشخص', lead.name) : '') +
    row('الجوال', phone) +
    (lead.score === null ? '' : row('الدرجة', String(lead.score) + '/100' + (verdict ? ' — ' + verdict : ''))) +
    (lead.track ? row('المسار', lead.track) : '') +
    row('المصدر', lead.src || 'دخول مباشر') +
    '</table>' +
    '<p style="margin:18px 0 8px">' +
    '<a href="https://murdi.sa/admin/followup" style="background:#1A3D34;color:#fff;padding:12px 26px;border-radius:8px;text-decoration:none;font-weight:bold">افتح صفحة المتابعة</a>' +
    '</p>' +
    '<p style="margin:0;color:#6B8A80;font-size:12.5px">حرارة العميل تبرد بالساعات — لا بالأيام.</p>' +
    '</div>';

  let mailOk = false;
  try {
    const r = await sendMail({ from: FROM, to, subject, html });
    mailOk = r.ok;
  } catch { /* البريد سقط — يبقى إشعار الجوال */ }

  let sent = 0;
  try {
    const p = await sendPush({
      title: lead.completed ? '🔥 أكمل التقييم · ' + verdict : 'عميل محتمل جديد',
      body: who + ' — ' + phone
        + (lead.score === null ? ' · بدأ التقييم' : ' · الدرجة ' + lead.score + '/100')
        + (lead.src ? ' · من ' + lead.src : ''),
      url: '/admin/followup',
      important: true,
      tag: 'mini-' + lead.id,
    }, to);
    sent = p.sent;
  } catch { /* إشعار الجوال سقط — البريد وصل */ }

  return { mail: mailOk, push: sent };
}
