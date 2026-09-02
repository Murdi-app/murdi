import { createClient } from '@supabase/supabase-js';

// إشعار المتصفح — يصل إلى جوالك وأنت خارج المكتب، بلا تطبيقٍ ثالث ولا رسوم.
//
// وسببُ وجوده أن أروى سجّلت الساعة ١:٤٨ وأنهت تقييماً بدرجة ٨١ في ٢:٠٦،
// ولم يعلم المالك حتى سأل ليلاً. والبريد يصل، لكنه يُقرأ حين تفتح بريدك —
// وحرارة العميل تبرد بالساعات.
//
// الإرسال هنا لا يرمي أبداً: فشلُ إشعارٍ لا يجوز أن يُسقط تسجيل عميل.
// وما يردّ عليه المتصفح بـ404 أو 410 يعني أن الاشتراك مات (أُلغي الإذن أو
// مُسح الموقع) فيُحذف من القاعدة، ولا يبقى يُحاوَل إلى الأبد.

const admin = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  );

export type PushPayload = {
  title: string;
  body: string;
  /** إلى أين يذهب النقر */
  url?: string;
  /** يُبقي الإشعار حتى يُقرأ — للعميل الجديد لا لكل شيء */
  important?: boolean;
  tag?: string;
};

export type PushResult = { sent: number; removed: number; failed: number; reason?: string };

export async function sendPush(payload: PushPayload, toEmail?: string): Promise<PushResult> {
  const pub = process.env.VAPID_PUBLIC_KEY || '';
  const priv = process.env.VAPID_PRIVATE_KEY || '';
  const subject = process.env.VAPID_SUBJECT || 'mailto:hololalmurdi.fs@gmail.com';
  if (!pub || !priv) return { sent: 0, removed: 0, failed: 0, reason: 'مفاتيح VAPID غير مهيأة' };

  let webpush: typeof import('web-push');
  try {
    webpush = (await import('web-push')).default as unknown as typeof import('web-push');
  } catch {
    return { sent: 0, removed: 0, failed: 0, reason: 'حزمة web-push غير مثبّتة' };
  }
  webpush.setVapidDetails(subject, pub, priv);

  const sb = admin();
  let q = sb.from('push_subscriptions').select('id, endpoint, p256dh, auth');
  if (toEmail) q = q.eq('email', toEmail);
  const { data: subs } = await q.limit(50);
  if (!subs || subs.length === 0) return { sent: 0, removed: 0, failed: 0, reason: 'لا توجد أجهزة مشتركة' };

  const body = JSON.stringify(payload);
  let sent = 0, removed = 0, failed = 0;

  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification(
        { endpoint: String(s.endpoint), keys: { p256dh: String(s.p256dh), auth: String(s.auth) } },
        body,
        { TTL: 60 * 60 * 12 }
      );
      sent++;
      await sb.from('push_subscriptions')
        .update({ last_sent_at: new Date().toISOString(), last_error: null, failures: 0 })
        .eq('id', s.id);
    } catch (e) {
      const code = Number((e as { statusCode?: number })?.statusCode || 0);
      if (code === 404 || code === 410) {
        await sb.from('push_subscriptions').delete().eq('id', s.id);
        removed++;
      } else {
        failed++;
        await sb.rpc('bump_push_failure', { p_id: s.id, p_err: String((e as Error)?.message || code) })
          .then(() => {}, () => {});
      }
    }
  }));

  return { sent, removed, failed };
}
