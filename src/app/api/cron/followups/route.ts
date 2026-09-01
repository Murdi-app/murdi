import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendMail } from '@/lib/sendMail';

// نبض المعاودة — يعمل من داخل القاعدة، بلا جلسة ولا إذن ولا حاسب مفتوح.
// الفرق بينه وبين المهمة المجدولة: هذا لا يقرأ بريداً ولا يفكّر، بل يحسب من
// الجداول من سكت وكم سكت. وما يُحسب من القاعدة لا ينكسر أبداً — وهذا هو
// علاج «الهشّ»: كل ما يمكن حسابه هنا يُحسب هنا، ولا يُترك لجلسة قد تموت.

export const maxDuration = 60;

const OWNER = 'hololalmurdi.fs@gmail.com';
const FROM = 'مُرضي <partners@murdi.sa>';

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
  entity_name: string | null; entity_email: string | null;
  sent_at: string | null; next_followup_at: string | null; followup_stage: number | null;
  companies: { company_name: string } | null;
};

export async function POST(req: Request) {
  if (!(await cronAuthorized(req))) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  }

  const sb = admin();
  const nowIso = new Date().toISOString();

  const { data, error } = await sb
    .from('outreach_messages')
    .select('entity_name, entity_email, sent_at, next_followup_at, followup_stage, companies(company_name)')
    .eq('status', 'مُرسلة')
    .is('reply_at', null)
    .not('next_followup_at', 'is', null)
    .lte('next_followup_at', nowIso)
    .order('next_followup_at', { ascending: true })
    .limit(60);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data || []) as unknown as Row[];
  if (rows.length === 0) {
    return NextResponse.json({ ok: true, sent: false, reason: 'لا معاودة مستحقة' });
  }

  const days = (d: string | null) =>
    d ? Math.floor((Date.now() - new Date(d).getTime()) / 86400000) : 0;

  const items = rows.map((r) => {
    const silent = days(r.sent_at);
    const late = silent >= 7;
    return `<tr>
      <td style="padding:9px 0;border-bottom:1px solid #EAF2EE;font-size:13.5px;color:#1A3D34;line-height:1.85">
        <b>${esc(r.entity_name)}</b>
        ${r.companies?.company_name ? ` · <span style="color:#6B8A80">${esc(r.companies.company_name)}</span>` : ''}
        <div style="font-size:12px;color:${late ? '#B4622A' : '#6B8A80'};margin-top:2px">
          صامتة منذ ${silent} يوماً${r.followup_stage && r.followup_stage > 1 ? ` · المعاودة رقم ${r.followup_stage}` : ''}
          ${r.entity_email ? ` · ${esc(r.entity_email)}` : ''}
        </div>
      </td></tr>`;
  }).join('');

  const html = `<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;background:#FBFCFB;padding:22px">
    <div style="max-width:600px;margin:0 auto;background:#fff;border:1px solid #EAF2EE;border-radius:14px;padding:24px">
      <div style="font-size:11px;letter-spacing:.1em;color:#9DB3AB;font-weight:700">مُرضي · نبض المعاودة</div>
      <h1 style="font-size:20px;color:#1A3D34;margin:6px 0 4px">${rows.length} جهة تجاوزت موعد معاودتها</h1>
      <p style="font-size:13px;color:#6B8A80;margin:0 0 16px;line-height:1.9">
        هذه جهات خوطبت ولم تردّ، ومرّ موعد معاودتها. الصمت ليس رفضاً — لكنه يصير رفضاً إن تُرك.
      </p>
      <table style="width:100%;border-collapse:collapse">${items}</table>
      <a href="https://murdi.sa/admin/outreach" style="display:inline-block;margin-top:18px;background:#1A3D34;color:#fff;border-radius:10px;padding:12px 20px;text-decoration:none;font-size:13.5px;font-weight:900">افتح صفحة المخاطبة</a>
      <div style="margin-top:20px;padding-top:14px;border-top:1px solid #EAF2EE;font-size:11.5px;color:#9DB3AB;line-height:1.8">
        يُحسب هذا من داخل قاعدة بياناتك ويُرسل من منصتك — لا يحتاج جهازك مفتوحاً ولا إذناً.
      </div>
    </div></div>`;

  const out = await sendMail({
    from: FROM, to: OWNER,
    subject: `نبض المعاودة — ${rows.length} جهة صامتة`,
    html,
  });
  if (!out.ok) {
    return NextResponse.json({ error: 'تعذّر الإرسال: ' + out.reason }, { status: 500 });
  }

  return NextResponse.json({ ok: true, sent: true, count: rows.length });
}
