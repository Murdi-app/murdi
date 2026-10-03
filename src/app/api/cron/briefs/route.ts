import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cronAuthorized, signLink } from '@/lib/cronAuth';
import { buildBriefs, riyadhDate } from '@/lib/staffBrief';
import { sendMail } from '@/lib/sendMail';
import { logError } from '@/lib/logError';
import { sendPush } from '@/lib/push';
import { withJobRun } from '@/lib/jobRun';

// توجيه الصباح — يُكتب هنا ويُعرض على المالك، ولا يخرج إلى الموظفتين إلا بضغطته.
// يوقظه `pg_cron` (المهمة `staff-briefs`) الساعة ٤:٤٥ بتوقيت الرياض.

export const maxDuration = 60;

const OWNER = 'hololalmurdi.fs@gmail.com';
const FROM = 'مُرضي <partners@murdi.sa>';
const SITE = 'https://murdi.sa';

const admin = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);
const esc = (s: unknown) => String(s ?? '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string));

async function handle(req: Request) {
  if (!(await cronAuthorized(req))) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  const sb = admin();
  const today = riyadhDate();
  try {
    // ما كُتب لليوم لا يُكتب ثانيةً — ولا يُداس توجيهٌ كتبه المالك أو أُرسل
    const { data: have, error: hErr } = await sb.from('daily_briefs').select('id').eq('brief_date', today).limit(1);
    if (hErr) throw new Error(hErr.message);
    if (have && have.length) return NextResponse.json({ ok: true, skipped: 'exists' });

    const briefs = await buildBriefs(sb, today);
    const { error: iErr } = await sb.from('daily_briefs').insert(briefs.map((b) => ({
      brief_date: today, recipient: b.recipient, to_email: b.to, subject: b.subject, body: b.body,
      status: 'draft', note: b.by === 'claude' ? 'كتبه Claude من بيانات المنصة' : 'كُتب من بيانات المنصة (تعذّرت صياغة Claude)',
    })));
    if (iErr) throw new Error(iErr.message);

    const token = await signLink('briefs', today);
    const link = SITE + '/api/briefs/approve?d=' + today + '&t=' + token;
    const html = '<div dir="rtl" style="font-family:Arial,Tahoma;line-height:1.9;color:#1A3D34;max-width:640px">'
      + '<h2 style="margin:0 0 6px">توجيه الموظفتين — ' + esc(briefs[0].subject.replace('توجيه اليوم — ', '')) + '</h2>'
      + '<p style="color:#6B8A80;margin:0 0 16px">كُتب من بيانات المنصة. لا يخرج إلى أحدٍ حتى تعتمده.</p>'
      + '<p style="margin:0 0 22px"><a href="' + link + '" style="background:#1A3D34;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold">راجِع واعتمد وأرسل</a></p>'
      + briefs.map((b) => '<div style="border:1px solid #E1EDE8;border-radius:10px;padding:14px 16px;margin-bottom:14px">'
        + '<div style="color:#6B8A80;font-size:12.5px;margin-bottom:6px">إلى ' + esc(b.to) + '</div>'
        + '<div style="white-space:pre-wrap;font-size:14px">' + esc(b.body) + '</div></div>').join('')
      + '<p style="color:#9DB3AB;font-size:12px">إن لم تعتمده فلا يُرسل شيء. وللتعديل: ردّ على هذه الرسالة بما تريد تغييره.</p></div>';
    const mail = await sendMail({ from: FROM, to: OWNER, subject: '🗂️ توجيه الموظفتين — بانتظار اعتمادك', html });
    // إشعار الجوال يفتح صفحة الاعتماد نفسها — ضغطةٌ واحدة، لا بحث
    // إشعارٌ من المنصة لكل مسار باسمه — يفتح صفحة الاعتماد، ويخرج وحده ٧:٣٠ إن لم يُعدَّل
    for (const b of briefs) {
      const first = b.body.split('\n').map((l) => l.trim()).filter((l) => l && !/،$/.test(l)).slice(0, 2).join(' · ').slice(0, 160);
      await sendPush({ title: '🗂️ مسار ' + (b.recipient === 'dhai' ? 'ضي' : 'رغد') + ' — توجيه اليوم', body: first + ' — يخرج لها ٧:٣٠', url: link, important: true, tag: 'briefs-' + b.recipient + '-' + today }, OWNER).catch(() => null);
    }
    if (!mail.ok) await logError('cron.briefs.mail', new Error(mail.reason), {});
    return NextResponse.json({ ok: true, written: briefs.map((b) => ({ to: b.recipient, items: b.items })), mailed: mail.ok });
  } catch (e) {
    await logError('cron.briefs', e, {});
    // الفشل يصل المالك — لا يُكتشف بعد الظهر أن الموظفتين بدأتا بلا توجيه
    await sendMail({ from: FROM, to: OWNER, subject: '⚠️ لم يُكتب توجيه الموظفتين اليوم',
      html: '<div dir="rtl" style="font-family:Arial">تعذّرت كتابة التوجيه: ' + esc(e instanceof Error ? e.message : String(e)) + '</div>' }).catch(() => null);
    return NextResponse.json({ error: 'تعذّرت كتابة التوجيه' }, { status: 500 });
  }
}

// ★ سجلّ تشغيل + إشعار المالك عند فشلين متتاليين (`job_runs`)
export const POST = withJobRun('briefs', handle);
