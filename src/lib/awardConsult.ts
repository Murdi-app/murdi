import type { SupabaseClient } from '@supabase/supabase-js';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import type { Award, Settings } from '@/lib/awards';
import { computeGap, combineGaps, contractsWord, gapConsultPrompt, consultHtml, consultViolations, todayRiyadh, type GapInputs, type GroupGap } from '@/lib/gapSchedule';
import { generateWithFallback } from '@/lib/consultationGen';
import { sendPush } from '@/lib/push';
import { OWNER_EMAIL } from '@/lib/notifyLead';

// توليد «استشارة الفجوة» — دالةٌ واحدة يستدعيها زرّ المالك (`/api/admin/awards/gap`)
// ومسار القناة الآلي (`/api/cron/awards-pipeline`). تولّد «جاهزة» وتُشعر المالك
// ولا تُرسل شيئاً — الإرسال بزرّ «اعتمد وأرسل» وحده.

// ويُعطى مسارٌ آخر بـ`LOCAL_CHROME` حيث لا يوجد Chrome المثبَّت (تشغيلٌ محلي بسكربت)
const LOCAL_CHROME = process.env.LOCAL_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
export const CONSULT_BUCKET = 'contracts';
export const CONSULT_KIND = 'award_gap';

export async function toPdf(html: string): Promise<Buffer> {
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
export async function groupOf(sb: SupabaseClient, a: Award): Promise<Award[]> {
  if (!a.org_key) return [a];
  const { data, error } = await sb.from('contract_awards').select('*').eq('org_key', a.org_key).not('status', 'in', '(dropped,do_not_contact)').order('created_at');
  if (error) throw new Error('تعذّرت قراءة ترسيات المنشأة — ' + error.message);
  const rows = (data || []) as Award[];
  return rows.some((r) => r.id === a.id) ? rows : [a, ...rows];
}


export type ConsultResult =
  | { ok: true; status: 'ready'; url: string | null; deepest: GroupGap['deepest']; contracts: number; warn: string | null }
  | { ok: false; error: string; code: number };

export async function generateConsultation(sb: SupabaseClient, a: Award, inputs: GapInputs | undefined, settings: Settings, by = 'المالك'): Promise<ConsultResult> {
  const id = a.id;
  const b = { inputs };
  const cfg = { settings };
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
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : 'تعذّر الحساب', code: 400 }; }

  const { data: row, error: cErr } = await sb.from('consultations')
    .insert({ award_id: id, assessment_type: CONSULT_KIND, status: 'analyzing' }).select('id').single();
  if (cErr || !row) return { ok: false, error: 'تعذّر إنشاء الاستشارة — ' + (cErr?.message || ''), code: 500 };

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
    return { ok: false, error: 'تعذّر توليد الاستشارة — أعد المحاولة', code: 502 };
  }

  let pdf: Buffer;
  try { pdf = await toPdf(consultHtml(gg, cfg.settings, out.text)); }
  catch (e) {
    await sb.from('consultations').update({ status: 'failed', content: out.text }).eq('id', row.id);
    return { ok: false, error: 'كُتبت الاستشارة وتعذّر إخراج الملف — ' + (e instanceof Error ? e.message : ''), code: 500 };
  }
  const path = 'awards/' + id + '/consult-' + Date.now() + '.pdf';
  const up = await sb.storage.from(CONSULT_BUCKET).upload(path, pdf, { contentType: 'application/pdf', upsert: false });
  if (up.error) return { ok: false, error: 'تعذّر حفظ الملف — ' + up.error.message, code: 500 };

  const now = new Date().toISOString();
  // ما سبقها «جاهزةً» للمنشأة نفسها يُطوى — فلا تُعتمد نسخةٌ قديمة خطأً
  await sb.from('consultations').update({ status: 'superseded' })
    .in('award_id', group.map((x) => x.id)).eq('assessment_type', CONSULT_KIND).eq('status', 'ready');
  const { error: rErr } = await sb.from('consultations').update({ status: 'ready', content: out.text, generated_at: now }).eq('id', row.id);
  let uErr: { message: string } | null = null;
  for (const { award: x, g } of gg.contracts) {
    const patch: Record<string, unknown> = { gap_schedule: g, gap_pdf_path: path, gap_generated_at: now, updated_at: now };
    if (x.id === id) patch.gap_inputs = b.inputs || {};
    const { error: e } = await sb.from('contract_awards').update(patch).eq('id', x.id);
    if (e) uErr = e;
  }
  await sendPush({
    title: 'استشارة ترسية جاهزة للاعتماد' + (by === 'المنصة' ? ' (وُلّدت آلياً)' : ''),
    body: String(a.company_name) + (gg.contracts.length > 1 ? ' (' + contractsWord(gg.contracts.length) + ')' : '') + ' — أعمق نقطة ' + Math.abs(gg.deepest.amount).toLocaleString('en-US') + ' ريال · راجِعها ثم «اعتمد وأرسل»',
    url: '/admin/channel', important: true, tag: 'award-consult-' + id,
  }, OWNER_EMAIL).catch(() => null);

  const { data: sg } = await sb.storage.from(CONSULT_BUCKET).createSignedUrl(path, 600);
  return {
    ok: true, status: 'ready', url: sg?.signedUrl || null, deepest: gg.deepest, contracts: gg.contracts.length,
    warn: [rErr || uErr ? 'وُلّدت، ولم تُحفظ كاملاً: ' + (rErr?.message || uErr?.message) : '', bad.length ? 'راجِعها: بقي فيها ' + bad.join('، ') : ''].filter(Boolean).join(' · ') || null,
  };

}
