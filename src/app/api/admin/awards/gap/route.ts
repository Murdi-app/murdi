import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import { requireAdmin } from '@/lib/requireAdmin';
import { loadConfig, fill, type Award } from '@/lib/awards';
import { computeGap, gapConsultPrompt, consultHtml, type GapInputs, type GapResult } from '@/lib/gapSchedule';
import { generateWithFallback } from '@/lib/consultationGen';
import { sendMail } from '@/lib/sendMail';
import { sendPush } from '@/lib/push';
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
const LOCAL_CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const FROM = 'د. عبدالحكيم المرضي <partners@murdi.sa>';
const BUCKET = 'contracts';
const KIND = 'award_gap';
const esc = (s: string) => s.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string));
// ما قبل «جدول الفجوة أُرسل» — ما بعده (اجتماع · تسعير · دفع · إسقاط) لا يُرجَع
const BEFORE_GAP = ['new', 'qualified', 'messaged', 'reminder_call', 'replied'];

async function toPdf(html: string): Promise<Buffer> {
  const isLocal = process.env.NODE_ENV === 'development';
  const browser = await puppeteer.launch({
    args: isLocal ? [] : chromium.args,
    executablePath: isLocal ? LOCAL_CHROME : await chromium.executablePath(),
    headless: true,
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    try { await page.evaluateHandle('document.fonts.ready'); } catch {}
    const pdf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '12mm', bottom: '12mm', left: '12mm', right: '12mm' } });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

async function latest(sb: ReturnType<typeof admin>, awardId: string) {
  return sb.from('consultations').select('id, status, content, generated_at, released_at')
    .eq('award_id', awardId).eq('assessment_type', KIND)
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
  const { data: c } = await latest(sb, id);
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
  let cfg;
  try { cfg = await loadConfig(sb); } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : 'الإعدادات' }, { status: 500 }); }

  // ═══ التوليد: جاهزة للاعتماد — لا يخرج شيء ═══
  if (action === 'generate') {
    let g: GapResult;
    try { g = computeGap(a as Award, (b.inputs || {}) as GapInputs, cfg.settings); }
    catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : 'تعذّر الحساب' }, { status: 400 }); }

    const { data: row, error: cErr } = await sb.from('consultations')
      .insert({ award_id: id, assessment_type: KIND, status: 'analyzing' }).select('id').single();
    if (cErr || !row) return NextResponse.json({ error: 'تعذّر إنشاء الاستشارة — ' + (cErr?.message || '') }, { status: 500 });

    const out = await generateWithFallback(gapConsultPrompt(a as Award, g, cfg.settings));
    if (!out) {
      await sb.from('consultations').update({ status: 'failed' }).eq('id', row.id);
      return NextResponse.json({ error: 'تعذّر توليد الاستشارة — أعد المحاولة' }, { status: 502 });
    }

    let pdf: Buffer;
    try { pdf = await toPdf(consultHtml(a as Award, g, cfg.settings, out.text)); }
    catch (e) {
      await sb.from('consultations').update({ status: 'failed', content: out.text }).eq('id', row.id);
      return NextResponse.json({ error: 'كُتبت الاستشارة وتعذّر إخراج الملف — ' + (e instanceof Error ? e.message : '') }, { status: 500 });
    }
    const path = 'awards/' + id + '/consult-' + Date.now() + '.pdf';
    const up = await sb.storage.from(BUCKET).upload(path, pdf, { contentType: 'application/pdf', upsert: false });
    if (up.error) return NextResponse.json({ error: 'تعذّر حفظ الملف — ' + up.error.message }, { status: 500 });

    const now = new Date().toISOString();
    const { error: rErr } = await sb.from('consultations').update({ status: 'ready', content: out.text, generated_at: now }).eq('id', row.id);
    const { error: uErr } = await sb.from('contract_awards')
      .update({ gap_inputs: b.inputs || {}, gap_schedule: g, gap_pdf_path: path, gap_generated_at: now, updated_at: now }).eq('id', id);
    await sendPush({
      title: 'استشارة ترسية جاهزة للاعتماد',
      body: String(a.company_name) + ' — أعمق نقطة ' + Math.abs(g.deepest.amount).toLocaleString('en-US') + ' ريال · راجِعها ثم «اعتمد وأرسل»',
      url: '/admin/awards', important: true, tag: 'award-consult-' + id,
    }, OWNER_EMAIL).catch(() => null);

    const { data: sg } = await sb.storage.from(BUCKET).createSignedUrl(path, 600);
    return NextResponse.json({
      ok: true, status: 'ready', url: sg?.signedUrl || null, deepest: g.deepest, estimated: g.estimated,
      warn: rErr || uErr ? 'وُلّدت، ولم تُحفظ كاملاً: ' + (rErr?.message || uErr?.message) : null,
    });
  }

  // ═══ «اعتمد وأرسل» ═══
  const channel = b.channel === 'email' ? 'email' : b.channel === 'whatsapp' ? 'whatsapp' : '';
  if (!channel) return NextResponse.json({ error: 'القناة مطلوبة' }, { status: 400 });
  const { data: c, error: lErr } = await latest(sb, id);
  if (lErr) return NextResponse.json({ error: 'تعذّرت قراءة الاستشارة — ' + lErr.message }, { status: 500 });
  if (!c || c.status !== 'ready' || !a.gap_pdf_path) return NextResponse.json({ error: 'لا استشارة جاهزة للاعتماد — ولّدها أولاً' }, { status: 409 });

  const to = String(a.contact_email || '').trim();
  const subject = fill(String(cfg.settings.gap_email_subject || ''), a as Award).trim() || 'جدول فجوة السيولة';
  const text = fill(String(cfg.settings.gap_email_body || ''), a as Award).trim();
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
  const { error: tErr } = await sb.from('award_touches').insert({
    award_id: id, channel, direction: 'out', actor: 'د. عبدالحكيم المرضي',
    to_address: channel === 'email' ? to : (a.contact_whatsapp || a.contact_phone || null),
    subject, body: (channel === 'email' ? text + '\n\n' : '') + '[الاستشارة المختصرة وجدول الفجوة مرفقان]', external_ref: ref,
  });
  let uErr = null;
  if (BEFORE_GAP.includes(String(a.status))) {
    ({ error: uErr } = await sb.from('contract_awards').update({ status: 'gap_sent', gap_sent_at: now, updated_at: now }).eq('id', id).eq('status', a.status));
  }
  const { data: sg } = await sb.storage.from(BUCKET).createSignedUrl(String(a.gap_pdf_path), 600);
  const bad = relErr?.message || (!rel?.length ? 'كانت قد اعتُمدت قبلها' : '') || tErr?.message || uErr?.message;
  return NextResponse.json({ ok: true, status: 'released', url: sg?.signedUrl || null, warn: bad ? (channel === 'email' ? 'خرج البريد' : 'اعتُمدت') + '، ولم يُسجَّل كاملاً: ' + bad : null });
}
