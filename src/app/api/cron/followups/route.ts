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
// ولا يرسل هذا النبض حرفاً إلى جهة تمويل. يكتب إلى المالك وحده، والقرار له.
//
// ★★ تصحيحٌ جوهريّ — ١٦ سبتمبر ٢٠٢٦، بقاعدة المالك:
//   (١) **الردّ الهاتفيّ ردّ.** كان الشرط يقارن بـ`replied` وحدها، وصفوفُ
//       المكالمات تُسجَّل `call` — فكان «Funding Souq»، وقد اتصل بالمالك
//       شخصياً وطلب مستندات عميل، سيُدرَج في نشرة الغد تحت «حان تذكيرها».
//       ملاحقةُ من أجاب أسوأُ من إهمال من سكت.
//   (٢) **رسالةٌ واحدة لكل باب ولا إلحاح.** فسقط سلّم المعاودة (٤ ثم ٧ ثم
//       ١٠) كلّه: الباب الذي طُرق وسكت خمسة أيام يُذكر للمالك **مرةً
//       واحدة** ثم يُغلق من الدورة إغلاقاً لا رجعة فيه، ويُكتب ذلك في
//       ملاحظته. والطريق البديل هاتفٌ أو بابٌ آخر — لا رسالةٌ ثانية.
//   وكان السلّم يعني تكرار النشرة نفسها كل ثلاثة أيام إلى الأبد، لأن
//   `followup_stage` لا يزيده هذا المسار أصلاً.

export const maxDuration = 60;

const OWNER = 'hololalmurdi.fs@gmail.com';
const FROM = 'مُرضي <partners@murdi.sa>';

/** كم يوماً يُنتظر الباب قبل أن يُعدّ ساكتاً */
const SILENT_AFTER = 5;
/** الصفّ الذي يُذكر مرةً يُغلق من الدورة — عشر سنين أي: لا يعود */
const CLOSE_FOR = 3650;

/** ردٌّ هو ردّ — بالبريد أو بالهاتف. ومن أجاب لا يُطرق بابه ثانيةً أبداً. */
const ANSWERED = new Set(['replied', 'call']);

/** أثرٌ يُكتب في ملاحظة الصفّ حتى لا يُذكر مرتين ولو أُعيد حسابه */
const CLOSED_MARK = 'أُغلق من دورة التذكير';

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

  const silentDoors: Row[] = [];  // طُرقت مرةً وسكتت — تُذكر مرةً ثم تُغلق
  const bounced: Row[] = [];      // عنوانها لا يصل — الباب مقفلٌ تقنياً

  for (const r of rows) {
    const status = String(r.reply_status || 'awaiting');

    // ★ من أجاب لا يُلاحَق — ولو كان جوابه مكالمةً سُجّلت في المتابعة.
    //   وكان الشرط يقارن بـ'replied' وحدها، فكان «Funding Souq» — وقد اتصل
    //   بالمالك شخصياً وطلب مستندات — سيُدرج غداً في قائمة «حان تذكيرها».
    if (ANSWERED.has(status)) continue;

    // صفٌّ ذُكر من قبلُ لا يُذكر ثانيةً
    if (String(r.staff_note || '').includes(CLOSED_MARK)) continue;
    if (r.next_followup_at && new Date(r.next_followup_at).getTime() > now) continue;

    if (status === 'bounced') { bounced.push(r); continue; }

    if (daysSince(r.last_sent_at || r.sent_at) >= SILENT_AFTER) silentDoors.push(r);
  }

  if (silentDoors.length === 0 && bounced.length === 0) {
    return NextResponse.json({ ok: true, sent: false, reason: 'لا بابَ يحتاج ذكراً', scanned: rows.length });
  }

  const line = (r: Row, tail: string, color: string) => `<tr>
      <td style="padding:9px 0;border-bottom:1px solid #EAF2EE;font-size:13.5px;color:#1A3D34;line-height:1.85">
        <b>${esc(r.entity_name)}</b>
        ${r.companies?.company_name ? ` · <span style="color:#6B8A80">${esc(r.companies.company_name)}</span>` : ''}
        <div style="font-size:12px;color:${color};margin-top:2px">${tail}</div>
      </td></tr>`;

  const silentRows = silentDoors.map((r) => {
    const silent = daysSince(r.last_sent_at || r.sent_at);
    return line(
      r,
      `صامتة منذ ${silent} يوماً — لا رسالة ثانية${r.entity_email ? ` · ${esc(r.entity_email)}` : ''}`,
      silent >= 10 ? '#B4622A' : '#6B8A80'
    );
  }).join('');

  const bouncedRows = bounced.map((r) =>
    line(r, `عنوانها يرتدّ — لا تصلها رسالة أصلاً${r.entity_email ? ` · ${esc(r.entity_email)}` : ''}`, '#B4622A')
  ).join('');

  const section = (title: string, note: string, body: string) => body ? `
      <h2 style="font-size:15px;color:#1A3D34;margin:22px 0 2px">${title}</h2>
      <p style="font-size:12.5px;color:#6B8A80;margin:0 0 8px;line-height:1.8">${note}</p>
      <table style="width:100%;border-collapse:collapse">${body}</table>` : '';

  const html = `<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;background:#FBFCFB;padding:22px">
    <div style="max-width:600px;margin:0 auto;background:#fff;border:1px solid #EAF2EE;border-radius:14px;padding:24px">
      <div style="font-size:11px;letter-spacing:.1em;color:#9DB3AB;font-weight:700">مُرضي · نبض الأبواب</div>
      <h1 style="font-size:20px;color:#1A3D34;margin:6px 0 4px">${silentDoors.length + bounced.length} باب طُرق ولم يُجب</h1>
      ${section(
        `${silentDoors.length} سكتت`,
        'رسالةٌ واحدة لكل باب، ولا إلحاح. هذه طُرقت وسكتت، وتُذكر لك مرةً واحدة ثم تُغلق من الدورة — فإما هاتفٌ، وإما بابٌ آخر، وإما تُترك. والقرار لك وحدك.',
        silentRows
      )}
      ${section(
        `${bounced.length} عنوانها لا يصل`,
        'هذه لم تصلها رسالتنا أصلاً، فليست صمتاً ولا رفضاً بل بابٌ مقفلٌ تقنياً — يحتاج عنواناً آخر أو هاتفاً.',
        bouncedRows
      )}
      <a href="https://murdi.sa/admin/outreach" style="display:inline-block;margin-top:20px;background:#1A3D34;color:#fff;border-radius:10px;padding:12px 20px;text-decoration:none;font-size:13.5px;font-weight:900">افتح صفحة المخاطبة</a>
      <div style="margin-top:20px;padding-top:14px;border-top:1px solid #EAF2EE;font-size:11.5px;color:#9DB3AB;line-height:1.8">
        يُحسب هذا من داخل قاعدة بياناتك ويُرسل من منصتك — لا يحتاج جهازك مفتوحاً ولا إذناً.
        ولا تخرج من هنا رسالةٌ إلى جهة تمويل: القرار لك وحدك.
      </div>
    </div></div>`;

  const out = await sendMail({
    from: FROM, to: OWNER,
    subject: `نبض الأبواب — ${silentDoors.length + bounced.length} باب طُرق ولم يُجب`,
    html,
  });
  if (!out.ok) {
    return NextResponse.json({ error: 'تعذّر الإرسال: ' + out.reason }, { status: 500 });
  }

  // الجوال لا يُزعج إلا لما يحتاج كلمته: العنوانُ المرتدّ خللٌ يُعالَج،
  // أمّا الصمت فنشرةٌ تُقرأ متى تيسّر.
  if (bounced.length > 0) {
    await sendPush({
      title: '🟠 ' + bounced.length + ' عنوان لا يصل',
      body: bounced.map((r) => String(r.entity_name || '')).slice(0, 3).join(' · ').slice(0, 140),
      url: '/admin/outreach',
      important: true,
      tag: 'outreach-bounced',
    }, OWNER).catch(() => null);
  }

  // ★ ما ذُكر يُغلق — لا يُسكَت ثلاثة أيام ثم يعود. الباب الذي سكت بعد
  //   طرقةٍ واحدة لا يُطرق ثانيةً، فلا معنى لأن يُذكّر به كل صباح.
  const close = async (list: Row[]) => {
    for (const r of list) {
      const note = String(r.staff_note || '').trim();
      await sb.from('outreach_messages').update({
        next_followup_at: iso(CLOSE_FOR),
        staff_note: (note ? note + ' | ' : '') + `[${new Date().toISOString().slice(0, 10)}] ${CLOSED_MARK} — طُرق ولم يُجب، ولا رسالة ثانية.`,
        updated_at: new Date().toISOString(),
      }).eq('id', r.id);
    }
  };
  await close(silentDoors);
  await close(bounced);

  return NextResponse.json({ ok: true, sent: true, silent: silentDoors.length, bounced: bounced.length });
}
