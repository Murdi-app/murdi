import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import { requireAdmin } from '@/lib/requireAdmin';
import { loadConfig, fill, type Award } from '@/lib/awards';
import { computeGap, combineGaps, gapConsultPrompt, consultHtml, consultViolations, todayRiyadh, type GapInputs, type GroupGap } from '@/lib/gapSchedule';
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

// ترسيات المنشأة نفسها (بمفتاح المنشأة) — تُجمع في استشارةٍ واحدة. والمُسقطة لا تدخل.
async function groupOf(sb: ReturnType<typeof admin>, a: Award): Promise<Award[]> {
  if (!a.org_key) return [a];
  const { data, error } = await sb.from('contract_awards').select('*').eq('org_key', a.org_key).neq('status', 'dropped').order('created_at');
  if (error) throw new Error('تعذّرت قراءة ترسيات المنشأة — ' + error.message);
  const rows = (data || []) as Award[];
  return rows.some((r) => r.id === a.id) ? rows : [a, ...rows];
}

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
  let cfg;
  try { cfg = await loadConfig(sb); } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : 'الإعدادات' }, { status: 500 }); }

  // ═══ التوليد: جاهزة للاعتماد — لا يخرج شيء ═══
  if (action === 'generate') {
    // المنشأة بعقودها: مدخلات الترسية المضغوطة من الشاشة، وما سواها بمدخلاته المحفوظة أو بمعيار القطاع
    let group: Award[], gg: GroupGap;
    const today = todayRiyadh();
    try {
      group = await groupOf(sb, a as Award);
      const parts = group.map((x) => ({
        award: x,
        g: computeGap(x, (x.id === id ? b.inputs : (x as Award & { gap_inputs?: GapInputs }).gap_inputs) as GapInputs || {}, cfg.settings, today),
      }));
      gg = combineGaps(parts, today);
    } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : 'تعذّر الحساب' }, { status: 400 }); }

    const { data: row, error: cErr } = await sb.from('consultations')
      .insert({ award_id: id, assessment_type: KIND, status: 'analyzing' }).select('id').single();
    if (cErr || !row) return NextResponse.json({ error: 'تعذّر إنشاء الاستشارة — ' + (cErr?.message || '') }, { status: 500 });

    // نبرةٌ لمنشأةٍ لا تعرفنا، ولا يقين عن الجهة: ما خالف يُعاد توليده مرةً بالمخالفة مسمّاة
    const prompt = gapConsultPrompt(gg, cfg.settings);
    let out = await generateWithFallback(prompt);
    let bad = out ? consultViolations(out.text, gg) : [];
    if (out && bad.length) {
      const again = await generateWithFallback(prompt + '\n\nتنبيه: مسودةٌ سابقة خالفت هذه القواعد فرُفضت — تجنّبها تماماً: ' + bad.join('، ') + '.');
      if (again) { out = again; bad = consultViolations(again.text, gg); }
    }
    if (!out) {
      await sb.from('consultations').update({ status: 'failed' }).eq('id', row.id);
      return NextResponse.json({ error: 'تعذّر توليد الاستشارة — أعد المحاولة' }, { status: 502 });
    }

    let pdf: Buffer;
    try { pdf = await toPdf(consultHtml(gg, cfg.settings, out.text)); }
    catch (e) {
      await sb.from('consultations').update({ status: 'failed', content: out.text }).eq('id', row.id);
      return NextResponse.json({ error: 'كُتبت الاستشارة وتعذّر إخراج الملف — ' + (e instanceof Error ? e.message : '') }, { status: 500 });
    }
    const path = 'awards/' + id + '/consult-' + Date.now() + '.pdf';
    const up = await sb.storage.from(BUCKET).upload(path, pdf, { contentType: 'application/pdf', upsert: false });
    if (up.error) return NextResponse.json({ error: 'تعذّر حفظ الملف — ' + up.error.message }, { status: 500 });

    const now = new Date().toISOString();
    // ما سبقها «جاهزةً» للمنشأة نفسها يُطوى — فلا تُعتمد نسخةٌ قديمة خطأً
    await sb.from('consultations').update({ status: 'superseded' })
      .in('award_id', group.map((x) => x.id)).eq('assessment_type', KIND).eq('status', 'ready');
    const { error: rErr } = await sb.from('consultations').update({ status: 'ready', content: out.text, generated_at: now }).eq('id', row.id);
    let uErr: { message: string } | null = null;
    for (const { award: x, g } of gg.contracts) {
      const patch: Record<string, unknown> = { gap_schedule: g, gap_pdf_path: path, gap_generated_at: now, updated_at: now };
      if (x.id === id) patch.gap_inputs = b.inputs || {};
      const { error: e } = await sb.from('contract_awards').update(patch).eq('id', x.id);
      if (e) uErr = e;
    }
    await sendPush({
      title: 'استشارة ترسية جاهزة للاعتماد',
      body: String(a.company_name) + (gg.contracts.length > 1 ? ' (' + gg.contracts.length + ' عقود)' : '') + ' — أعمق نقطة ' + Math.abs(gg.deepest.amount).toLocaleString('en-US') + ' ريال · راجِعها ثم «اعتمد وأرسل»',
      url: '/admin/awards', important: true, tag: 'award-consult-' + id,
    }, OWNER_EMAIL).catch(() => null);

    const { data: sg } = await sb.storage.from(BUCKET).createSignedUrl(path, 600);
    return NextResponse.json({
      ok: true, status: 'ready', url: sg?.signedUrl || null, deepest: gg.deepest, contracts: gg.contracts.length,
      warn: [rErr || uErr ? 'وُلّدت، ولم تُحفظ كاملاً: ' + (rErr?.message || uErr?.message) : '', bad.length ? 'راجِعها: بقي فيها ' + bad.join('، ') : ''].filter(Boolean).join(' · ') || null,
    });
  }

  // ═══ «اعتمد وأرسل» ═══
  const channel = b.channel === 'email' ? 'email' : b.channel === 'whatsapp' ? 'whatsapp' : '';
  if (!channel) return NextResponse.json({ error: 'القناة مطلوبة' }, { status: 400 });
  let group: Award[];
  try { group = await groupOf(sb, a as Award); } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : 'المنشأة' }, { status: 500 }); }
  const { data: c, error: lErr } = await latest(sb, group.map((x) => x.id));
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
