import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/requireAdmin';
import { loadConfig, fill, gapMessage, type Award } from '@/lib/awards';
import type { GapInputs } from '@/lib/gapSchedule';
import { generateConsultation, groupOf } from '@/lib/awardConsult';
import { sendMail } from '@/lib/sendMail';
import { OWNER_EMAIL } from '@/lib/notifyLead';

// «استشارة الفجوة» — للمالك. جدول الفجوة صار «استشارة مختصرة» بهيكل استشارات
// المنصة ومولّدها نفسه (`@/lib/consultationGen`)، والجدول داخلها لا بدلاً منها.
//
// ★ الاعتماد كاستشارات المنصة: `generate` يولّدها ويحفظها في `consultations`
//   (مربوطةً بالترسية) بحالة `ready`، ويطبعها PDF ويحفظه على الترسية، ويُشعر
//   المالك — ولا يخرج شيء. و`release` هو زرّ «اعتمد وأرسل»: بريدٌ مرفق
//   (`gap_email_subject` + `gap_email_body` + التوقيع، ولا يُفتح إلا بـ
//   `gap_email_approved = 'true'`) أو تنزيلٌ للواتساب؛ ويُسجَّل في `award_touches`،
//   وتصير الاستشارة `released` والترسية `gap_sent`.

export const runtime = 'nodejs';
export const maxDuration = 300;

const admin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string);
const FROM = 'د. عبدالحكيم المرضي <partners@murdi.sa>';
const BUCKET = 'contracts';
const KIND = 'award_gap';
const esc = (s: string) => s.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string));
// ما قبل «جدول الفجوة أُرسل» — ما بعده (اجتماع · تسعير · دفع · إسقاط) لا يُرجَع
const BEFORE_GAP = ['new', 'qualified', 'messaged', 'reminder_call', 'replied'];

async function latest(sb: ReturnType<typeof admin>, awardIds: string[]) {
  return sb.from('consultations').select('id, award_id, status, content, generated_at, released_at')
    .in('award_id', awardIds).eq('assessment_type', KIND)
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
}

// GET ?id= — حالة آخر استشارة ورابطٌ موقَّع لملفها
export async function GET(req: Request) {
  const denied = await requireAdmin();
  if (denied) return NextResponse.json({ error: denied }, { status: 401 });
  const id = new URL(req.url).searchParams.get('id') || '';
  const sb = admin();
  const { data: a, error } = await sb.from('contract_awards').select('gap_pdf_path').eq('id', id).maybeSingle();
  if (error) return NextResponse.json({ error: 'تعذّرت القراءة — ' + error.message }, { status: 500 });
  if (!a?.gap_pdf_path) return NextResponse.json({ error: 'لا استشارة محفوظة لهذه الترسية' }, { status: 404 });
  const { data: me } = await sb.from('contract_awards').select('*').eq('id', id).maybeSingle();
  const group = me ? await groupOf(sb, me as Award).catch(() => [me as Award]) : [];
  const { data: c } = await latest(sb, group.length ? group.map((g) => g.id) : [id]);
  const { data: sg, error: sErr } = await sb.storage.from(BUCKET).createSignedUrl(String(a.gap_pdf_path), 600);
  if (sErr || !sg?.signedUrl) return NextResponse.json({ error: 'تعذّر فتح الملف — ' + (sErr?.message || '') }, { status: 500 });
  return NextResponse.json({ ok: true, url: sg.signedUrl, status: c?.status || null });
}

// POST { id, action: 'generate', inputs } · { id, action: 'release', channel: 'email' | 'whatsapp' }
export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return NextResponse.json({ error: denied }, { status: 401 });
  const b = await req.json().catch(() => ({} as Record<string, unknown>));
  const id = String(b.id || '');
  const action = String(b.action || '');
  if (!id || !['generate', 'release'].includes(action)) return NextResponse.json({ error: 'طلبٌ ناقص' }, { status: 400 });
  const sb = admin();
  const { data: a, error } = await sb.from('contract_awards').select('*').eq('id', id).maybeSingle();
  if (error) return NextResponse.json({ error: 'تعذّرت القراءة — ' + error.message }, { status: 500 });
  if (!a) return NextResponse.json({ error: 'غير موجودة' }, { status: 404 });
  if (a.status === 'do_not_contact') return NextResponse.json({ error: 'هذه المنشأة «لا تتواصل» — ' + (a.dnc_reason || '') }, { status: 409 });
  let cfg;
  try { cfg = await loadConfig(sb); } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : 'الإعدادات' }, { status: 500 }); }

  // ═══ التوليد: جاهزة للاعتماد — لا يخرج شيء ═══
  if (action === 'generate') {
    const r = await generateConsultation(sb, a as Award, b.inputs as GapInputs | undefined, cfg.settings);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.code });
    return NextResponse.json(r);
  }

  // ═══ «اعتمد وأرسل» ═══
  const channel = b.channel === 'email' ? 'email' : b.channel === 'whatsapp' ? 'whatsapp' : '';
  if (!channel) return NextResponse.json({ error: 'القناة مطلوبة' }, { status: 400 });
  let group: Award[];
  try { group = await groupOf(sb, a as Award); } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : 'المنشأة' }, { status: 500 }); }
  // لا استشارةٌ ثانية: ما أُرسل للمنشأة — منّي أو من Claude التشغيل — يُرفض ويُقال من أرسل ومتى
  const { data: sent } = await sb.from('consultations').select('released_at, released_by')
    .in('award_id', group.map((x) => x.id)).eq('assessment_type', KIND).eq('status', 'released')
    .order('released_at', { ascending: false }).limit(1).maybeSingle();
  const { data: logged } = await sb.from('award_touches').select('actor, created_at')
    .in('award_id', group.map((x) => x.id)).eq('direction', 'out').ilike('body', '%[الاستشارة%')
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (sent || logged) {
    const by = sent ? (sent.released_by === OWNER_EMAIL ? 'د. عبدالحكيم المرضي' : String(sent.released_by || '')) : String(logged?.actor || '');
    const at = String(sent?.released_at || logged?.created_at || '').slice(0, 10);
    return NextResponse.json({ error: 'أُرسلت الاستشارة لهذه المنشأة من قبل: ' + by + ' في ' + at + ' — لا تُرسل ثانية' }, { status: 409 });
  }
  const { data: c, error: lErr } = await latest(sb, group.map((x) => x.id));
  if (lErr) return NextResponse.json({ error: 'تعذّرت قراءة الاستشارة — ' + lErr.message }, { status: 500 });
  if (!c || c.status !== 'ready' || !a.gap_pdf_path) return NextResponse.json({ error: 'لا استشارة جاهزة للاعتماد — ولّدها أولاً' }, { status: 409 });

  const to = String(a.contact_email || '').trim();
  const subject = fill(String(cfg.settings.gap_email_subject || ''), a as Award).trim() || 'جدول فجوة السيولة';
  const text = gapMessage(a as Award, cfg.settings) || '';
  let ref: string = String(a.gap_pdf_path);
  if (channel === 'email') {
    if (String(cfg.settings.gap_email_approved || '').trim() !== 'true') return NextResponse.json({ error: 'بريد الاستشارة غير معتمد (gap_email_approved)' }, { status: 409 });
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return NextResponse.json({ error: 'لا بريد صالحاً لهذه الترسية — أضفه، أو أرسلها أنت بالواتساب' }, { status: 400 });
    const { data: blob, error: dErr } = await sb.storage.from(BUCKET).download(String(a.gap_pdf_path));
    if (dErr || !blob) return NextResponse.json({ error: 'تعذّر تحميل الملف — ' + (dErr?.message || '') }, { status: 500 });
    const sig = String(cfg.settings.signature || '').trim();
    const html = '<div dir="rtl" style="font-family:Arial,Tahoma;line-height:1.95;color:#1A3D34;font-size:15px;white-space:pre-wrap">' + esc(text + (sig ? '\n\n' + sig : '')) + '</div>';
    const r = await sendMail({ from: FROM, to, subject, html, replyTo: 'partners@murdi.sa',
      attachments: [{ filename: 'murdi-consultation.pdf', content: Buffer.from(await blob.arrayBuffer()).toString('base64') }] });
    if (!r.ok) return NextResponse.json({ error: 'لم يخرج البريد — ' + r.reason }, { status: 502 });
    ref = r.id || ref;
  }

  const now = new Date().toISOString();
  // يُحجز الإصدار أولاً مشروطاً بـ«جاهزة»: ضغطتان لا تُسجّلان إرسالين
  const { data: rel, error: relErr } = await sb.from('consultations')
    .update({ status: 'released', released_at: now, released_by: OWNER_EMAIL }).eq('id', c.id).eq('status', 'ready').select('id');
  // رسالةٌ واحدة للمنشأة، وتُسجَّل على كل عقدٍ من عقودها، وكلها «جدول الفجوة أُرسل»
  const { error: tErr } = await sb.from('award_touches').insert(group.map((x) => ({
    award_id: x.id, channel, direction: 'out', actor: 'د. عبدالحكيم المرضي',
    to_address: channel === 'email' ? to : (a.contact_whatsapp || a.contact_phone || null),
    subject, body: (channel === 'email' ? text + '\n\n' : '') + '[الاستشارة المختصرة وجدول الفجوة مرفقان]', external_ref: ref,
  })));
  let uErr: { message: string } | null = null;
  for (const x of group) {
    if (!BEFORE_GAP.includes(String(x.status))) continue;
    const { error: e } = await sb.from('contract_awards').update({ status: 'gap_sent', gap_sent_at: now, updated_at: now }).eq('id', x.id).eq('status', x.status);
    if (e) uErr = e;
  }
  const { data: sg } = await sb.storage.from(BUCKET).createSignedUrl(String(a.gap_pdf_path), 600);
  const bad = relErr?.message || (!rel?.length ? 'كانت قد اعتُمدت قبلها' : '') || tErr?.message || uErr?.message;
  return NextResponse.json({ ok: true, status: 'released', url: sg?.signedUrl || null, warn: bad ? (channel === 'email' ? 'خرج البريد' : 'اعتُمدت') + '، ولم يُسجَّل كاملاً: ' + bad : null });
}
