import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

// جرد المنصة — يُحسب في القاعدة ويصل بريدك، بلا جلسة ولا شاشة إذن ولا حاسب مفتوح.
// مهام Claude المجدولة كانت تقف عند طلب الإذن فتموت معلّقة، ولا «سماح دائم» في التطبيق.
// وهذا الطريق لا يمرّ بذلك الباب: pg_cron يوقظ، وpg_net ينادي هذا المسار، والمنصة تُرسل.

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

type Digest = Record<string, unknown>;
const arr = (d: Digest, k: string) => Array.isArray(d[k]) ? d[k] as Record<string, unknown>[] : [];
const num = (d: Digest, k: string) => Number(d[k] ?? 0) || 0;
const esc = (s: unknown) => String(s ?? '').replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string));

/** يبني بنود القرار — وترتيبها بالمال لا بالتسلسل */
function decisions(d: Digest): string[] {
  const out: string[] = [];

  for (const p of arr(d, 'pending_payments')) {
    out.push(`تحويل بانتظار تأكيدك — <b>${esc(p.company)}</b> · ${esc(p.amount)} ريال · منذ ${esc(p.days)} يوماً`);
  }
  for (const c of arr(d, 'double_paying')) {
    out.push(`<b>${esc(c)}</b> دفع أكثر من مرة — غالباً لم يصله تأكيد. يُقيَّد الفائض رصيداً لا يُبتلع`);
  }
  for (const c of arr(d, 'no_contract')) {
    out.push(`<b>${esc(c)}</b> عميل نشط <b>بلا عقد</b> — لا أتعاب مستحقة لك مهما أُنجز له`);
  }
  for (const c of arr(d, 'contract_unsigned')) {
    out.push(`عقد <b>${esc(c)}</b> صدر ولم يُوقَّع — تذكير واحد يكفي`);
  }
  const stale = arr(d, 'stale_services');
  const unpriced = stale.filter(s => s.priced === false);
  if (unpriced.length) {
    out.push(`<b>${unpriced.length}</b> طلب خدمة بلا سعر منذ أكثر من ٣ أيام — العميل ينتظر رقماً`);
  }
  for (const c of arr(d, 'credits_unused')) {
    out.push(`<b>${esc(c)}</b> دفع رسم التشغيل ولم تُشغَّل مطابقته`);
  }
  for (const c of arr(d, 'match_stuck')) {
    out.push(`مطابقة <b>${esc(c)}</b> علقت أكثر من نصف ساعة`);
  }
  if (num(d, 'outreach_ready')) out.push(`<b>${num(d, 'outreach_ready')}</b> خطاب معتمد جاهز ولم يُرسل — ينتظر كلمتك`);
  if (num(d, 'outreach_due')) out.push(`<b>${num(d, 'outreach_due')}</b> مخاطبة تجاوزت موعد المعاودة بلا رد`);
  if (num(d, 'leads_due')) out.push(`<b>${num(d, 'leads_due')}</b> متابعة حان موعد معاودتها اليوم`);
  if (num(d, 'errors_today')) out.push(`<b>${num(d, 'errors_today')}</b> خطأ تشغيلي جديد خلال ٢٤ ساعة`);

  return out;
}

function html(d: Digest, title: string): string {
  const dec = decisions(d);
  const rows = dec.length
    ? dec.map(t => `<tr><td style="padding:9px 0;border-bottom:1px solid #EAF2EE;font-size:14px;color:#1A3D34;line-height:1.9">${t}</td></tr>`).join('')
    : `<tr><td style="padding:12px 0;font-size:14px;color:#2E9E7B;font-weight:700">لا شيء ينتظر قرارك اليوم.</td></tr>`;

  const stat = (n: number | string, t: string) =>
    `<td style="padding:10px 14px;background:#F7FAF9;border:1px solid #EAF2EE;border-radius:10px">
       <div style="font-size:20px;font-weight:900;color:#1A3D34">${n}</div>
       <div style="font-size:11px;color:#6B8A80">${t}</div></td>`;

  return `<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;background:#FBFCFB;padding:22px">
  <div style="max-width:600px;margin:0 auto;background:#fff;border:1px solid #EAF2EE;border-radius:14px;padding:24px">
    <div style="font-size:11px;letter-spacing:.1em;color:#9DB3AB;font-weight:700">مُرضي · جرد المنصة</div>
    <h1 style="font-size:21px;color:#1A3D34;margin:6px 0 2px">${esc(title)}</h1>
    <div style="font-size:12px;color:#9DB3AB;margin-bottom:18px">${new Date(String(d.at)).toLocaleString('ar-SA')}</div>

    ${num(d, 'approvals_pending') ? `<a href="https://murdi.sa/admin/inbox" style="display:block;text-decoration:none;background:#1A3D34;color:#fff;border-radius:12px;padding:14px 18px;margin-bottom:18px">
      <div style="font-size:15px;font-weight:900">${num(d, 'approvals_pending')} بنداً ينتظر تعميدك</div>
      <div style="font-size:12px;opacity:.85;margin-top:3px">افتح صندوق التعميد واعتمد بنقرة ←</div></a>` : ''}

    <div style="font-size:13px;font-weight:900;color:#1A3D34;margin-bottom:6px">ما ينتظر قرارك</div>
    <table style="width:100%;border-collapse:collapse">${rows}</table>

    <div style="font-size:13px;font-weight:900;color:#1A3D34;margin:22px 0 8px">الحالة</div>
    <table style="width:100%;border-collapse:separate;border-spacing:6px 0">
      <tr>
        ${stat(num(d, 'leads_qualified'), 'ليد مؤهَّل لم يُتصل به')}
        ${stat(num(d, 'leads_open'), 'في مكتب المتابعة')}
        ${stat(num(d, 'ent_core'), 'جهة في نواة السجل')}
      </tr>
      <tr><td style="height:6px"></td></tr>
      <tr>
        ${stat(num(d, 'ent_broken'), 'رابط تقديم مكسور')}
        ${stat(num(d, 'ent_pending'), 'جهة لم تُفحص بعد')}
        ${stat(num(d, 'leads_new'), 'ليد جديد أمس')}
      </tr>
    </table>

    <div style="margin-top:22px;padding-top:14px;border-top:1px solid #EAF2EE;font-size:11.5px;color:#9DB3AB;line-height:1.8">
      يُحسب هذا الجرد داخل قاعدة بياناتك ويُرسل من منصتك — لا يحتاج جهازك مفتوحاً ولا إذناً.
      <a href="https://murdi.sa/admin/services" style="color:#2E9E7B">لوحة الخدمات</a> ·
      <a href="https://murdi.sa/admin/leads" style="color:#2E9E7B">مكتب المتابعة</a> ·
      <a href="https://murdi.sa/admin/entities" style="color:#2E9E7B">سجلّ الجهات</a>
    </div>
  </div></div>`;
}

export async function POST(req: Request) {
  if (!(await cronAuthorized(req))) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const kind = String(body?.kind || 'morning');
  const title = kind === 'evening' ? 'جرد المساء' : 'جرد الصباح';

  const { data, error } = await admin().rpc('daily_digest');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const d = (data || {}) as Digest;

  // عدد ما ينتظر كلمته في صندوق التعميد — به تُقفل الحلقة: يقرأ، فيفتح، فينقر
  const { count: waiting } = await admin().from('approvals')
    .select('id', { count: 'exact', head: true }).eq('status', 'pending');
  d.approvals_pending = waiting || 0;

  // جولة المساء تصمت إن لم يكن ثمّة قرار — التنبيه الذي يتكرر بلا سبب يُهمَل
  const dec = decisions(d);
  if (kind === 'evening' && dec.length === 0 && !num(d, 'approvals_pending')) {
    return NextResponse.json({ ok: true, sent: false, reason: 'لا جديد يستحق الإشعار' });
  }

  const waitN = num(d, 'approvals_pending');
  const subject = waitN
    ? `${title} — ${waitN} بند ينتظر تعميدك`
    : dec.length
      ? `${title} — ${dec.length} بند ينتظر قرارك`
      : `${title} — كل شيء نظيف`;

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({ from: FROM, to: OWNER, subject, html: html(d, title) });
  } catch (e) {
    return NextResponse.json({ error: 'تعذّر الإرسال: ' + String(e).slice(0, 160) }, { status: 500 });
  }
  return NextResponse.json({ ok: true, sent: true, decisions: dec.length });
}
