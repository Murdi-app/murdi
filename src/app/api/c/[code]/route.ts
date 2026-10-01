import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { resolveShort } from '@/lib/shortLinks';
import { contractHtml } from '@/lib/contractStamp';
import { signedMessage, party } from '@/lib/contractFirst';
import { sendClientMail } from '@/lib/clientMail';
import { sendPush } from '@/lib/push';
import { OWNER_EMAIL } from '@/lib/notifyLead';
import { contractGate } from '@/lib/contractGate';
import { notifyTeam } from '@/lib/notifyLead';

// صفحة العقد أو السند من رابطه القصير (murdi.sa/c/…) — بلا تسجيل دخول.
// GET: الوثيقة مختومةً، وإن فُتح الدفع: رابطاه القصيران (السداد · المنصة).
// POST: التوقيع الإلكتروني — يكتب الموقّع اسمه ورقم هويته بنفسه، فلا يُطبع في
//       العقد اسمُ من سجّل (قد يكون موظفاً لا المالك).

export const dynamic = 'force-dynamic';
const admin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string);

async function load(code: string) {
  const sb = admin();
  const link = await resolveShort(sb, 'c', code);
  if (!link?.contract_id) return null;
  const { data: c } = await sb.from('contracts')
    .select('id, status, contract_type, contract_body, service_request_id, signer_name, signer_id_number, signed_at')
    .eq('id', link.contract_id).maybeSingle();
  if (!c || c.status === 'draft') return null;
  const { data: sr } = await sb.from('service_requests').select('id, company_id, service_title, price, status').eq('id', String(c.service_request_id)).maybeSingle();
  return { sb, c, sr };
}

export async function GET(_req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const x = await load(code);
  if (!x) return NextResponse.json({ error: 'الرابط غير صالح أو انتهت صلاحيته — اطلب رابطاً جديداً على واتساب 0570749196' }, { status: 404 });
  const { sb, c, sr } = x;
  const voucher = c.contract_type === 'voucher';
  const signer = c.signed_at && c.signer_name ? { name: String(c.signer_name), idNumber: String(c.signer_id_number || ''), at: String(c.signed_at) } : null;
  const html = contractHtml(String(c.contract_body || ''), voucher ? 'سند خدمة' : 'عقد الخدمة', signer);
  let links: { pay: string; site: string } | null = null;
  if (sr && sr.status === 'priced' && !(await contractGate(sb, { id: String(sr.id), service_title: sr.service_title }))) {
    const m = await signedMessage(sb, String(sr.id), 'رابط العقد');
    links = { pay: m.payLink, site: m.siteLink };
  }
  return NextResponse.json({
    ok: true, kind: voucher ? 'voucher' : 'contract', status: c.status, title: sr?.service_title || '',
    amount: sr?.price ? Number(sr.price) : null, paid: sr ? !['priced', 'submitted'].includes(String(sr.status)) : false,
    html, links,
  });
}

const AR_NAME = /^[ء-ي\s]{6,80}$/;
const SA_ID = /^[12]\d{9}$/;

export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const x = await load(code);
  if (!x) return NextResponse.json({ error: 'الرابط غير صالح أو انتهت صلاحيته' }, { status: 404 });
  const { sb, c, sr } = x;
  if (c.contract_type === 'voucher') return NextResponse.json({ error: 'السند لا يُوقَّع — ادفع من الرابط في الصفحة' }, { status: 400 });
  if (c.status !== 'issued') return NextResponse.json({ error: c.status === 'signed' ? 'العقد موقَّع من قبل' : 'العقد لا ينتظر توقيعاً' }, { status: 409 });
  const b = await req.json().catch(() => ({} as Record<string, unknown>));
  const name = String(b.name || '').replace(/\s+/g, ' ').trim();
  const id = String(b.id_number || '').replace(/[^\d]/g, '');
  if (!AR_NAME.test(name)) return NextResponse.json({ error: 'اكتب اسمك الثلاثي بالعربي كما في الهوية' }, { status: 400 });
  if (!SA_ID.test(id)) return NextResponse.json({ error: 'رقم الهوية أو الإقامة عشرة أرقام يبدأ بـ1 أو 2' }, { status: 400 });
  if (b.agree !== true) return NextResponse.json({ error: 'اقرأ العقد ووافق عليه أولاً' }, { status: 400 });
  const now = new Date().toISOString();
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || null;
  // يُحجز التوقيع مشروطاً بـ«صادر» — ضغطتان لا تُسجّلان توقيعين
  const { data: done, error } = await sb.from('contracts')
    .update({ status: 'signed', signed_at: now, signer_name: name, signer_id_number: id, signed_via: 'murdi.sa/c', signed_ip: ip })
    .eq('id', c.id).eq('status', 'issued').select('id');
  if (error) return NextResponse.json({ error: 'تعذّر حفظ التوقيع — ' + error.message }, { status: 500 });
  if (!done?.length) return NextResponse.json({ error: 'العقد موقَّع من قبل' }, { status: 409 });
  let m: { text: string; payLink: string; siteLink: string } | null = null;
  if (sr) m = await signedMessage(sb, String(sr.id), 'توقيع العميل').catch(() => null);
  // ★ رسالة الدفع تخرج للعميل تلقائياً لحظة التوقيع — على بريده المسجّل — ويُبلَّغ المالك
  let mailed: { ok: boolean; reason?: string } = { ok: false, reason: 'لا رسالة' };
  if (sr && m) {
    const p = await party(sb, String(sr.company_id)).catch(() => ({ name: '', email: null as string | null }));
    mailed = p.email
      ? await sendClientMail(sb, { companyId: String(sr.company_id), toEmail: p.email, toName: p.name, subject: 'رابط السداد — ' + String(sr.service_title || ''), body: m.text, event: 'رسالة الدفع بعد التوقيع' })
      : { ok: false, reason: 'لا بريد مسجّل للعميل' };
  }
  await sendPush({
    title: '✍️ وقّع العميل عقده', body: String(sr?.service_title || '') + ' — ' + name + (mailed.ok ? ' · خرجت له رسالة الدفع' : ' · لم تخرج رسالة الدفع: ' + (mailed.reason || '')),
    url: '/admin/services', important: true, tag: 'signed-owner-' + c.id,
  }, OWNER_EMAIL).catch(() => null);
  await notifyTeam({
    subject: '✍️ وقّع العميل عقد «' + String(sr?.service_title || '') + '»',
    head: mailed.ok ? 'وصل العقد موقّعاً — وخرجت للعميل رسالة الدفع على بريده' : 'وصل العقد موقّعاً — لم تخرج رسالة الدفع آلياً، أرسلوها له',
    facts: [['الخدمة', String(sr?.service_title || '')], ['الموقّع', name], ['رسالة الدفع', m?.text || '']],
    url: '/admin/services', pushTitle: '✍️ عقدٌ موقَّع', pushBody: String(sr?.service_title || '') + ' — ' + name, tag: 'signed-' + c.id,
  }).catch(() => {});
  return NextResponse.json({ ok: true, links: m ? { pay: m.payLink, site: m.siteLink } : null });
}
