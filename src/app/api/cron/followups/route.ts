import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendMail } from '@/lib/sendMail';
import { sendPush } from '@/lib/push';

// نبض المعاودة — يعمل من داخل القاعدة، بلا جلسة ولا إذن ولا حاسب مفتوح.
// الفرق بينه وبين المهمة المجدولة: هذا لا يقرأ بريداً ولا يفكّر، بل يحسب من
// الجداول من سكت وكم سكت. وما يُحسب من القاعدة لا ينكسر أبداً.
//
// ★ وكان لا يحسب شيئاً. كان يرشّح على `next_followup_at` — عمودٍ لا يكتبه
//   أحدٌ في التطبيق كلّه. فبقي فارغاً في العشرين صفاً جميعها، وبقي النبض
//   يردّ «لا معاودة مستحقة» كل يومٍ منذ أُنشئ، والجهاتُ الصامتة تصمت بلا
//   أن يعلم أحد. وهذا هو الوجه الآخر لملاحقة أجيل: ساعةٌ عمياء لا ترى من
//   ردّ فتلاحقه، ولا ترى من سكت فتتركه.
//
// فصار الحساب من عمودين يكتبهما التطبيق فعلاً: `reply_status` و`last_sent_at`.
//   ★ من ردّ لا يُلاحَق أبداً — ولو كان ردّه هاتفياً سُجّل في المتابعة.
//   ★ ومن سكت يُذكَّر بسلّمٍ يتباعد: ٤ أيام ثم ٧ ثم ١٠.
//   ★ ومن سكت بعد ثلاث لا يُلاحَق بعدها — بل يُرفع إلى المالك قراراً.
//     فثلاثُ طرقاتٍ بلا جواب جوابٌ في نفسها، والرابعة تُفسد ما بُني.
// ولا يرسل هذا النبض حرفاً إلى جهة تمويل. يكتب إلى المالك وحده، والقرار له.
//
// و`next_followup_at` صار يُكتب هنا: كل صفٍّ يُذكر في نشرةٍ يُسكَت ثلاثة
// أيام (أو سبعة إن كان معلّقاً بانتظار قرار) — فلا تتكرّر النشرة نفسها كل
// صباح حتى يملّها القارئ فلا يفتحها يوم تحمل جديداً.

export const maxDuration = 60;

const OWNER = 'hololalmurdi.fs@gmail.com';
const FROM = 'مُرضي <partners@murdi.sa>';

/** سلّم التذكير بالأيام حسب عدد المرات التي خوطبت فيها الجهة */
const LADDER = [4, 4, 7, 10];
/** بعد هذه المرتبة لا معاودة — بل قرار */
const STOP_AFTER = 3;
/** كم يُسكَت الصفّ بعد ذكره في نشرة (بالأيام) */
const SNOOZE_DUE = 3;
const SNOOZE_STALLED = 7;

const admin = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

async function cronAuthorized(req: Request): Promise<boolean> {
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

type Row = {
  id: string;
  entity_name: string | null; entity_email: string | null;
  sent_at: string | null; last_sent_at: string | null; next_followup_at: string | null;
  followup_stage: number | null; reply_status: string | null; staff_note: string | null;
  companies: { company_name: string } | null;
};

const daysSince = (d: string | null) =>
  d ? Math.floor((Date.now() - new Date(d).getTime()) / 86400000) : 0;

const iso = (days: number) => new Date(Date.now() + days * 86400000).toISOString();

export async function POST(req: Request) {
  if (!(await cronAuthorized(req))) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  }

  const sb = admin();
  const now = Date.now();

  // نقرأ المُرسَلة كلّها ثم نُصنّف هنا: الشرط مركّب (سلّمٌ يعتمد على المرتبة)
  // ولا يُكتب شرطاً واحداً في الاستعلام. والعدد عشرات لا آلاف.
  const { data, error } = await sb
    .from('outreach_messages')
    .select('id, entity_name, entity_email, sent_at, last_sent_at, next_followup_at, followup_stage, reply_status, staff_note, companies(company_name)')
    .eq('status', 'مُرسلة')
    .limit(400);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data || []) as unknown as Row[];

  const due: Row[] = [];      // سكتت وحان تذكيرها
  const stalled: Row[] = [];  // استُنفد السلّم، أو ارتدّ عنوانها — تحتاج قرارك

  for (const r of rows) {
    const status = String(r.reply_status || 'awaiting');

    // من ردّ لا يُلاحَق. وهذه هي النقطة التي أُخطئت في أجيل.
    if (status === 'replied') continue;

    // صفٌّ ذُكر في نشرةٍ قريبة يُسكَت حتى يحلّ موعده
    if (r.next_followup_at && new Date(r.next_followup_at).getTime() > now) continue;

    if (status === 'bounced') {
      // عنوانٌ لا يصل: لا معاودة تنفع. ويُذكر مرةً ثم يسكت حتى يُعالَج.
      if (!String(r.staff_note || '').trim()) stalled.push(r);
      continue;
    }

    const stage = Number(r.followup_stage) || 0;
    if (stage >= STOP_AFTER) { stalled.push(r); continue; }

    const wait = LADDER[Math.min(stage, LADDER.length - 1)];
    const silent = daysSince(r.last_sent_at || r.sent_at);
    if (silent >= wait) due.push(r);
  }

  if (due.length === 0 && stalled.length === 0) {
    return NextResponse.json({ ok: true, sent: false, reason: 'لا معاودة مستحقة', scanned: rows.length });
  }

  const line = (r: Row, tail: string, color: string) => `<tr>
      <td style="padding:9px 0;border-bottom:1px solid #EAF2EE;font-size:13.5px;color:#1A3D34;line-height:1.85">
        <b>${esc(r.entity_name)}</b>
        ${r.companies?.company_name ? ` · <span style="color:#6B8A80">${esc(r.companies.company_name)}</span>` : ''}
        <div style="font-size:12px;color:${color};margin-top:2px">${tail}</div>
      </td></tr>`;

  const dueRows = due.map((r) => {
    const silent = daysSince(r.last_sent_at || r.sent_at);
    const stage = Number(r.followup_stage) || 0;
    return line(
      r,
      `صامتة منذ ${silent} يوماً${stage > 1 ? ` · خوطبت ${stage} مرات` : ''}${r.entity_email ? ` · ${esc(r.entity_email)}` : ''}`,
      silent >= 10 ? '#B4622A' : '#6B8A80'
    );
  }).join('');

  const stalledRows = stalled.map((r) => {
    const why = String(r.reply_status) === 'bounced'
      ? 'عنوانها يرتدّ — لا تصلها رسالة، والباب يحتاج عنواناً آخر أو هاتفاً'
      : `خوطبت ${Number(r.followup_stage) || 0} مرات بلا جواب — أوقفتُ المعاودة، والقرار لك`;
    return line(r, `${why}${r.entity_email ? ` · ${esc(r.entity_email)}` : ''}`, '#B4622A');
  }).join('');

  const section = (title: string, note: string, body: string) => body ? `
      <h2 style="font-size:15px;color:#1A3D34;margin:22px 0 2px">${title}</h2>
      <p style="font-size:12.5px;color:#6B8A80;margin:0 0 8px;line-height:1.8">${note}</p>
      <table style="width:100%;border-collapse:collapse">${body}</table>` : '';

  const html = `<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;background:#FBFCFB;padding:22px">
    <div style="max-width:600px;margin:0 auto;background:#fff;border:1px solid #EAF2EE;border-radius:14px;padding:24px">
      <div style="font-size:11px;letter-spacing:.1em;color:#9DB3AB;font-weight:700">مُرضي · نبض المعاودة</div>
      <h1 style="font-size:20px;color:#1A3D34;margin:6px 0 4px">${due.length + stalled.length} جهة تنتظر حركة</h1>
      ${section(
        `${due.length} حان تذكيرها`,
        'خوطبت ولم تردّ، ومضى عليها ما يكفي. الصمت ليس رفضاً — لكنه يصير رفضاً إن تُرك.',
        dueRows
      )}
      ${section(
        `${stalled.length} أوقفتُ المعاودة عنها`,
        'هذه لا تُلاحَق بعد اليوم. ثلاث طرقات بلا جواب جوابٌ في نفسها، والرابعة تُفسد ما بُني — فإما باب آخر، وإما هاتف، وإما تُترك.',
        stalledRows
      )}
      <a href="https://murdi.sa/admin/outreach" style="display:inline-block;margin-top:20px;background:#1A3D34;color:#fff;border-radius:10px;padding:12px 20px;text-decoration:none;font-size:13.5px;font-weight:900">افتح صفحة المخاطبة</a>
      <div style="margin-top:20px;padding-top:14px;border-top:1px solid #EAF2EE;font-size:11.5px;color:#9DB3AB;line-height:1.8">
        يُحسب هذا من داخل قاعدة بياناتك ويُرسل من منصتك — لا يحتاج جهازك مفتوحاً ولا إذناً.
        ولا تخرج من هنا رسالةٌ إلى جهة تمويل: القرار لك وحدك.
      </div>
    </div></div>`;

  const out = await sendMail({
    from: FROM, to: OWNER,
    subject: stalled.length
      ? `نبض المعاودة — ${stalled.length} جهة تنتظر قرارك`
      : `نبض المعاودة — ${due.length} جهة صامتة`,
    html,
  });
  if (!out.ok) {
    return NextResponse.json({ error: 'تعذّر الإرسال: ' + out.reason }, { status: 500 });
  }

  // الجوال لا يُزعج إلا لما يحتاج كلمته. أما الصامتة فنشرةٌ تُقرأ متى تيسّر.
  if (stalled.length > 0) {
    await sendPush({
      title: '🟠 ' + stalled.length + ' جهة تنتظر قرارك',
      body: stalled.map((r) => String(r.entity_name || '')).slice(0, 3).join(' · ').slice(0, 140),
      url: '/admin/outreach',
      important: true,
      tag: 'followup-stalled',
    }, OWNER).catch(() => null);
  }

  // ما ذُكر يُسكَت، فلا تتكرّر النشرة نفسها كل صباح
  const quiet = async (list: Row[], days: number) => {
    if (!list.length) return;
    await sb.from('outreach_messages')
      .update({ next_followup_at: iso(days) })
      .in('id', list.map((r) => r.id));
  };
  await quiet(due, SNOOZE_DUE);
  await quiet(stalled, SNOOZE_STALLED);

  return NextResponse.json({ ok: true, sent: true, due: due.length, stalled: stalled.length });
}
