import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';

// مُرسِل واحد صادق.
//
// سبب وجود هذا الملف عيب حقيقي وُجد في المنصة يوم ١ سبتمبر: كل نداءات
// `resend.emails.send` في الكود كانت مكتوبة هكذا:
//
//     await resend.emails.send({ ... });   // ثم تُسجَّل «مُرسلة»
//
// ومكتبة Resend **لا ترمي استثناءً** حين يرفض الخادم الرسالة — بل تُرجع
// كائناً فيه `{ data: null, error: {...} }`. فالـ try/catch لا يلتقط شيئاً،
// والكود يمضي فيكتب «✓ أُرسلت» على رسالة رُفضت. أي أن المنصة كانت تقول
// نجاحاً لا تعرفه.
//
// ولذلك: كل إرسال يمرّ من هنا، وهنا وحده يُقرأ الخطأ ويُعاد نصّاً مفهوماً.
// لا يُكتب «أُرسلت» إلا ومعها معرّف من المزوّد.

export type MailResult =
  | { ok: true; id: string | null }
  | { ok: false; reason: string };

export type MailInput = {
  from: string;
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
  /** نسخة مخفية — مثلاً نسخة المكتب من توجيه الموظفتين */
  bcc?: string | string[];
  attachments?: { filename: string; content: string }[];
  /** مفتاح عدم التكرار لدى مزوّد البريد — الإرسال نفسه بالمفتاح نفسه لا يخرج مرتين (صندوق الصادر) */
  idempotencyKey?: string;
};

const client = () => new Resend(process.env.RESEND_API_KEY);

/**
 * ★ ١ أكتوبر (بأمر المالك): العناوين التي ارتدّت تُعلَّم «عنوان غير صالح» في
 * `email_blocklist`، ولا يخرج إليها بريدٌ بعدها من أي مسار — فالحارس هنا عند
 * المُرسِل الواحد لا في كل شاشة. يُرجع ما كان محظوراً من العناوين.
 */
export async function blockedEmails(to: string | string[]): Promise<string[]> {
  const list = (Array.isArray(to) ? to : [to]).map((e) => String(e || '').trim().toLowerCase()).filter(Boolean);
  if (!list.length || !process.env.SUPABASE_SERVICE_ROLE_KEY) return [];
  try {
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string);
    const { data } = await sb.from('email_blocklist').select('email').in('email', list);
    return (data || []).map((r: { email: string }) => r.email);
  } catch { return []; }
}

const digestOf = (subject: string, html: string) => createHash('sha256').update(subject + '\u0000' + html).digest('hex');
const recipients = (to: string | string[]) => (Array.isArray(to) ? to : [to]).map((e) => String(e || '').trim().toLowerCase()).filter(Boolean);
const logDb = () => process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string) : null;

async function recentlySent(to: string | string[], subject: string, html: string): Promise<boolean> {
  const sb = logDb(); if (!sb) return false;
  try {
    const { data } = await sb.from('mail_sent_log').select('id').in('to_email', recipients(to)).eq('digest', digestOf(subject, html))
      .gt('created_at', new Date(Date.now() - 24 * 3600_000).toISOString()).limit(1);
    return !!data?.length;
  } catch { return false; }
}
async function logSent(to: string | string[], subject: string, html: string): Promise<void> {
  const sb = logDb(); if (!sb) return;
  try { await sb.from('mail_sent_log').insert(recipients(to).map((e) => ({ to_email: e, digest: digestOf(subject, html), subject: subject.slice(0, 200) }))); } catch { /* */ }
}

export async function sendMail(input: MailInput): Promise<MailResult> {
  // مفتاح غائب يُقال صراحةً، لا يُترجم إلى «فشل مجهول»
  if (!process.env.RESEND_API_KEY) {
    return { ok: false, reason: 'مفتاح مزوّد البريد (RESEND_API_KEY) غير مضبوط في بيئة التشغيل' };
  }

  const blocked = await blockedEmails(input.to);
  if (blocked.length) return { ok: false, reason: 'عنوان غير صالح (ارتدّ سابقاً): ' + blocked.join('، ') };

  // ★ ٧ أكتوبر (بأمر المالك): لا يخرج النصّ نفسه للمستلم نفسه خلال ٢٤ ساعة — ضغطتان رسالةٌ واحدة
  const dup = await recentlySent(input.to, input.subject, input.html);
  if (dup) return { ok: false, reason: 'أُرسلت الرسالة نفسها لهذا المستلم خلال ٢٤ ساعة — لم تُكرَّر' };

  try {
    const res = await client().emails.send({
      from: input.from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      ...(input.replyTo ? { replyTo: input.replyTo } : {}),
      ...(input.bcc ? { bcc: input.bcc } : {}),
      ...(input.attachments && input.attachments.length ? { attachments: input.attachments } : {}),
    }, input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : undefined);

    // هنا بيت الداء الذي كان مهملاً
    const err = (res as { error?: { message?: string; name?: string } | null })?.error;
    if (err) {
      const name = err.name ? ' [' + err.name + ']' : '';
      return { ok: false, reason: (err.message || 'رفض المزوّد الرسالة') + name };
    }

    const id = (res as { data?: { id?: string } | null })?.data?.id || null;
    if (!id) {
      // لا خطأ ولا معرّف: حالة لا تُفهم، ولا تُكتب نجاحاً
      return { ok: false, reason: 'المزوّد لم يُعِد معرّفاً للرسالة — لا يمكن تأكيد قبولها' };
    }
    await logSent(input.to, input.subject, input.html);
    return { ok: true, id };
  } catch (e) {
    return { ok: false, reason: 'تعذّر الاتصال بمزوّد البريد: ' + String(e).slice(0, 160) };
  }
}

// السؤال عن مصير رسالة أُرسلت: وصلت؟ ارتدّت؟
export async function mailStatus(providerId: string): Promise<string | null> {
  if (!process.env.RESEND_API_KEY || !providerId) return null;
  try {
    const res = await client().emails.get(providerId);
    return (res as { data?: { last_event?: string } | null })?.data?.last_event || null;
  } catch {
    return null;
  }
}
