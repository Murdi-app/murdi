import { Resend } from 'resend';

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
  attachments?: { filename: string; content: string }[];
};

const client = () => new Resend(process.env.RESEND_API_KEY);

export async function sendMail(input: MailInput): Promise<MailResult> {
  // مفتاح غائب يُقال صراحةً، لا يُترجم إلى «فشل مجهول»
  if (!process.env.RESEND_API_KEY) {
    return { ok: false, reason: 'مفتاح مزوّد البريد (RESEND_API_KEY) غير مضبوط في بيئة التشغيل' };
  }

  try {
    const res = await client().emails.send({
      from: input.from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      ...(input.replyTo ? { replyTo: input.replyTo } : {}),
      ...(input.attachments && input.attachments.length ? { attachments: input.attachments } : {}),
    });

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
