import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import { requireAdmin } from '@/lib/requireAdmin';
import { loadConfig, fill, type Award } from '@/lib/awards';
import { computeGap, gapHtml, type GapInputs } from '@/lib/gapSchedule';
import { sendMail } from '@/lib/sendMail';

// «جدول الفجوة» — للمالك. يحسب الجدول ويطبعه PDF صفحةً واحدة، ويحفظه على
// الترسية (المدخلات والجدول ومسار الملف في الدلو الخاص)، ويسجّله في
// `award_touches`، وتصير الترسية `gap_sent`.
// والقناة: «email» يُرسَل من المنصة إلى بريد الترسية مرفقاً؛ و«whatsapp»
// يرسله المالك بنفسه — فيُسجَّل ويُعاد إليه رابط الملف لينزّله.

export const runtime = 'nodejs';
export const maxDuration = 60;

const admin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string);
const LOCAL_CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const FROM = 'د. عبدالحكيم المرضي <partners@murdi.sa>';
const BUCKET = 'contracts';
const esc = (s: string) => s.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string));

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
    const pdf = await page.pdf({ format: 'A4', printBackground: true, pageRanges: '1', margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' } });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

// GET ?id= — رابط موقَّع لآخر جدولٍ محفوظ
export async function GET(req: Request) {
  const denied = await requireAdmin();
  if (denied) return NextResponse.json({ error: denied }, { status: 401 });
  const id = new URL(req.url).searchParams.get('id') || '';
  const sb = admin();
  const { data: a, error } = await sb.from('contract_awards').select('gap_pdf_path').eq('id', id).maybeSingle();
  if (error) return NextResponse.json({ error: 'تعذّرت القراءة — ' + error.message }, { status: 500 });
  if (!a?.gap_pdf_path) return NextResponse.json({ error: 'لا جدول محفوظ لهذه الترسية' }, { status: 404 });
  const { data: sg, error: sErr } = await sb.storage.from(BUCKET).createSignedUrl(String(a.gap_pdf_path), 600);
  if (sErr || !sg?.signedUrl) return NextResponse.json({ error: 'تعذّر فتح الملف — ' + (sErr?.message || '') }, { status: 500 });
  return NextResponse.json({ ok: true, url: sg.signedUrl });
}

// POST { id, inputs: GapInputs, channel: 'email' | 'whatsapp' }
export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return NextResponse.json({ error: denied }, { status: 401 });
  const b = await req.json().catch(() => ({} as Record<string, unknown>));
  const id = String(b.id || '');
  const channel = b.channel === 'email' ? 'email' : b.channel === 'whatsapp' ? 'whatsapp' : '';
  if (!id || !channel) return NextResponse.json({ error: 'الترسية والقناة مطلوبتان' }, { status: 400 });
  const sb = admin();
  const { data: a, error } = await sb.from('contract_awards').select('*').eq('id', id).maybeSingle();
  if (error) return NextResponse.json({ error: 'تعذّرت القراءة — ' + error.message }, { status: 500 });
  if (!a) return NextResponse.json({ error: 'غير موجودة' }, { status: 404 });
  const to = String(a.contact_email || '').trim();
  if (channel === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return NextResponse.json({ error: 'لا بريد صالحاً لهذه الترسية — أضفه، أو اختر «أرسله أنا بالواتساب»' }, { status: 400 });

  let cfg, g;
  try {
    cfg = await loadConfig(sb);
    g = computeGap(a as Award, (b.inputs || {}) as GapInputs, cfg.settings);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'تعذّر الحساب' }, { status: 400 });
  }

  let pdf: Buffer;
  try { pdf = await toPdf(gapHtml(a as Award, g, cfg.settings)); }
  catch (e) { return NextResponse.json({ error: 'تعذّر توليد الملف — ' + (e instanceof Error ? e.message : '') }, { status: 500 }); }

  const path = 'awards/' + id + '/gap-' + Date.now() + '.pdf';
  const up = await sb.storage.from(BUCKET).upload(path, pdf, { contentType: 'application/pdf', upsert: false });
  if (up.error) return NextResponse.json({ error: 'تعذّر حفظ الملف — ' + up.error.message }, { status: 500 });

  const subject = fill(String(cfg.settings.gap_email_subject || ''), a as Award).trim() || 'جدول فجوة السيولة';
  const text = fill(String(cfg.settings.gap_email_body || ''), a as Award).trim();
  const summary = 'أعمق نقطة: ' + Math.abs(g.deepest.amount).toLocaleString('en-US') + ' ريال في ' + g.deepest.month
    + (g.estimated.length ? ' · تقديري: ' + g.estimated.join('، ') : '');

  let ref: string | null = path;
  if (channel === 'email') {
    const sig = String(cfg.settings.signature || '').trim();
    const html = '<div dir="rtl" style="font-family:Arial,Tahoma;line-height:1.95;color:#1A3D34;font-size:15px;white-space:pre-wrap">' + esc(text + (sig ? '\n\n' + sig : '')) + '</div>';
    const r = await sendMail({ from: FROM, to, subject, html, replyTo: 'partners@murdi.sa', attachments: [{ filename: 'murdi-gap-schedule.pdf', content: pdf.toString('base64') }] });
    if (!r.ok) return NextResponse.json({ error: 'حُفظ الجدول ولم يخرج البريد — ' + r.reason }, { status: 502 });
    ref = r.id || path;
  }

  const now = new Date().toISOString();
  const { error: tErr } = await sb.from('award_touches').insert({
    award_id: id, channel, direction: 'out', actor: 'د. عبدالحكيم المرضي',
    to_address: channel === 'email' ? to : (a.contact_whatsapp || a.contact_phone || null),
    subject, body: (channel === 'email' ? text + '\n\n' : '') + '[جدول الفجوة مرفق] ' + summary, external_ref: ref,
  });
  const patch: Record<string, unknown> = { gap_inputs: b.inputs || {}, gap_schedule: g, gap_pdf_path: path, gap_generated_at: now, updated_at: now };
  if (a.status === 'replied') { patch.status = 'gap_sent'; patch.gap_sent_at = now; }
  const { error: uErr } = await sb.from('contract_awards').update(patch).eq('id', id).eq('status', a.status);

  const { data: sg } = await sb.storage.from(BUCKET).createSignedUrl(path, 600);
  const warn = tErr || uErr ? 'الجدول ' + (channel === 'email' ? 'خرج' : 'حُفظ') + '، ولم يُسجَّل كاملاً: ' + (tErr?.message || uErr?.message) : null;
  return NextResponse.json({ ok: true, url: sg?.signedUrl || null, deepest: g.deepest, estimated: g.estimated, status: patch.status || a.status, warn });
}
