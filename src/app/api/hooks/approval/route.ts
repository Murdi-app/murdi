import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendMail } from '@/lib/sendMail';
import { sendPush } from '@/lib/push';

// إشعار بند التعميد.
//
// سبب وجوده: صندوق التعميد كان صامتاً. يُكتب فيه بندٌ يؤخّر ملفاً أو مالاً،
// ولا يعلم المالك حتى يفتح اللوحة بنفسه — وقد يمضي يومان. والقاعدة عنده:
// لا تخرج رسالة إلى جهة تمويل حتى يعتمدها. فإن لم يصله البند لحظة كتابته
// وقف العمل كلّه على فتحه للوحة.
//
// والنداء من القاعدة عبر pg_net (المُشغِّل approvals_notify) لا من المتصفح:
// يصل ولو كان الجهاز مغلقاً، ولا يحتاج أحداً ساهراً.

export const dynamic = 'force-dynamic';

const admin = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  );

const OWNER = 'hololalmurdi.fs@gmail.com';
const FROM = 'مُرضي <partners@murdi.sa>';

async function authorized(req: Request): Promise<boolean> {
  const given = req.headers.get('x-cron-secret') || '';
  if (!given) return false;
  const { data } = await admin().from('app_config').select('value').eq('key', 'cron_secret').maybeSingle();
  const want = String(data?.value || '');
  if (!want || given.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < want.length; i++) diff |= given.charCodeAt(i) ^ want.charCodeAt(i);
  return diff === 0;
}

const esc = (s: unknown) =>
  String(s ?? '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string));

// نبرة الإشعار من إلحاح البند نفسه — فبندٌ يؤخّر مالاً لا يُقرأ كبندٍ متى تيسّر
const TONE: Record<string, { push: string; mail: string }> = {
  money:  { push: '🟠 تعميد يؤخّر مالاً', mail: 'يؤخّر مالاً' },
  normal: { push: '✅ بند ينتظر كلمتك',   mail: 'يحتاج كلمتك' },
  low:    { push: '🗒️ بند متى تيسّر',     mail: 'متى تيسّر' },
};

export async function POST(req: Request) {
  if (!(await authorized(req))) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  }

  const b = await req.json().catch(() => ({}));
  const id = String(b?.id || '');
  if (!id) return NextResponse.json({ error: 'id مطلوب' }, { status: 400 });

  const sb = admin();
  const { data: a } = await sb
    .from('approvals')
    .select('id, kind, title, detail, options, urgency, status, company_id, companies(company_name)')
    .eq('id', id)
    .maybeSingle();
  if (!a) return NextResponse.json({ error: 'بند غير موجود' }, { status: 404 });

  // بندٌ أُجيب أو أُلغي بين كتابته ووصول النداء لا يُشعَر به
  if (a.status !== 'pending') return NextResponse.json({ ok: true, skipped: a.status });

  const co = (a.companies as unknown as { company_name?: string } | null)?.company_name || '';
  const tone = TONE[String(a.urgency)] || TONE.normal;
  const opts = Array.isArray(a.options) ? (a.options as { key: string; label: string }[]) : [];

  const { count: pending } = await sb
    .from('approvals').select('id', { count: 'exact', head: true }).eq('status', 'pending');

  const html =
    '<div dir="rtl" style="font-family:Arial;line-height:1.9;color:#1A3D34;max-width:560px">' +
    '<p style="margin:0 0 4px;color:#6B8A80;font-size:12.5px">' + esc(tone.mail) +
      (co ? ' · ' + esc(co) : '') + '</p>' +
    '<h2 style="color:#1A3D34;margin:0 0 12px;font-size:18px">' + esc(a.title) + '</h2>' +
    (a.detail
      ? '<div style="background:#F7FBF9;border-radius:8px;padding:12px 14px;font-size:13.5px;white-space:pre-wrap">'
        + esc(a.detail) + '</div>'
      : '') +
    (opts.length
      ? '<p style="margin:14px 0 0;color:#6B8A80;font-size:13px">خياراتك: '
        + opts.map((o) => '<b>' + esc(o.label) + '</b>').join(' · ') + '</p>'
      : '') +
    '<p style="margin:18px 0 8px">' +
    '<a href="https://murdi.sa/admin/inbox" style="background:#1A3D34;color:#fff;padding:12px 26px;border-radius:8px;text-decoration:none;font-weight:bold">افتح صندوق التعميد</a>' +
    '</p>' +
    '<p style="margin:0;color:#6B8A80;font-size:12.5px">' +
      (pending && pending > 1 ? 'وينتظرك ' + pending + ' بنداً في الصندوق.' : 'وهو البند الوحيد المنتظر.') +
    '</p></div>';

  const mail = await sendMail({
    from: FROM,
    to: OWNER,
    subject: tone.mail + ': ' + String(a.title).slice(0, 90),
    html,
  });

  const push = await sendPush(
    {
      title: tone.push,
      body: (co ? co + ' — ' : '') + String(a.title).slice(0, 120),
      url: '/admin/inbox',
      important: String(a.urgency) === 'money',
      tag: 'approval-' + a.id,
    },
    OWNER
  ).catch(() => ({ sent: 0, removed: 0, failed: 0, reason: 'تعذّر الإرسال' }));

  return NextResponse.json({ ok: true, mail: mail.ok, push, pending: pending || 0 });
}
