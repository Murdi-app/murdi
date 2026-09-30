import { createHash } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { loadConfig, compose, kindFor, stageFor, num, waDigits, type Award } from '@/lib/awards';
import { waConfig, sendWaTemplate } from '@/lib/whatsappApi';
import { sendMail } from '@/lib/sendMail';
import { generateConsultation } from '@/lib/awardConsult';
import { sendPush } from '@/lib/push';
import { OWNER_EMAIL } from '@/lib/notifyLead';

// القناة تعمل في غياب الجميع — ما يوقظه `pg_cron` كل ربع ساعة (`/api/cron/awards-pipeline`).
//
// ١) الصادر: كل فرصة «جاهزة للتواصل» (قالبٌ معتمد · مصدرٌ موثّق · توصيةٌ مقبولة — الشروط في
//    العرض `award_pipeline`) تُصفّ رسالتُها مرةً واحدة ببصمة (الفرصة + القالب + القناة).
// ٢) الإرسال: في أيام العمل وساعات الدوام، بسقفٍ يومي، وزرّ إيقافٍ كلي — كلها في `award_settings`.
//    يُحجز الصفّ ذرّياً (`outbox_claim`)، ويحمل الإرسال مفتاح عدم التكرار = البصمة: فإعادة
//    التشغيل أو عودة الاتصال لا تُخرج الرسالة مرتين، وتعطّل المزوّد يُعاد بمهلةٍ متصاعدة.
// ٣) من لا يرد: مكالمة التذكير الوحيدة ثم تُغلق بعد `close_after_reminder_days`.
// ٤) التحضير: ردٌّ مؤهَّل ← تُولَّد الاستشارة «جاهزة» وتنتظر اعتماد المالك (لا تخرج آلياً أبداً).

const FROM = 'د. عبدالحكيم المرضي <partners@murdi.sa>';
const ACTOR = 'المنصة (الصادر)';
const esc = (s: string) => s.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string));
const MAX_ATTEMPTS = 6;

/** الرياض: يوم الأسبوع (٠ الأحد) والساعة وبداية اليوم بـ UTC */
function riyadh(now = new Date()) {
  const r = new Date(now.getTime() + 3 * 3600_000);
  const dayStartUtc = new Date(Date.UTC(r.getUTCFullYear(), r.getUTCMonth(), r.getUTCDate()) - 3 * 3600_000);
  return { dow: r.getUTCDay(), hour: r.getUTCHours(), dayStartUtc };
}

/** بداية اليوم بتوقيت الرياض (للسقف اليومي) */
export const riyadhDayStart = () => riyadh().dayStartUtc.toISOString();

export function inWindow(settings: Record<string, string>, now = new Date()): { ok: boolean; why: string } {
  const { dow, hour } = riyadh(now);
  if (dow > 4) return { ok: false, why: 'خارج أيام العمل (أحد–خميس)' };
  const m = /^(\d{1,2})-(\d{1,2})$/.exec(String(settings.outbox_hours || '8-16'));
  const [h0, h1] = m ? [Number(m[1]), Number(m[2])] : [8, 16];
  if (hour < h0 || hour >= h1) return { ok: false, why: 'خارج ساعات الدوام (' + h0 + '–' + h1 + ')' };
  return { ok: true, why: '' };
}

export const outboxFingerprint = (awardId: string, templateKey: string, channel: string) =>
  createHash('sha256').update(awardId + '|' + templateKey + '|' + channel).digest('hex');

/** ١) يصفّ رسائل الفرص الجاهزة — مرةً واحدة لكل بصمة */
export async function enqueueReady(sb: SupabaseClient): Promise<{ queued: number; skipped: string[] }> {
  const { data: ready, error } = await sb.from('award_pipeline').select('id').eq('state', 'جاهزة للتواصل');
  if (error) throw new Error('العرض: ' + error.message);
  const ids = (ready || []).map((r) => String(r.id));
  if (!ids.length) return { queued: 0, skipped: [] };
  const cfg = await loadConfig(sb);
  const { data: rows, error: aErr } = await sb.from('contract_awards').select('*').in('id', ids);
  if (aErr) throw new Error(aErr.message);
  let queued = 0; const skipped: string[] = [];
  for (const a of (rows || []) as Award[]) {
    const to = String(a.contact_email || '').trim();
    if (!to || !(a as Award & { email_source_url?: string }).email_source_url) { skipped.push(a.company_name + ': لا بريد بمصدره'); continue; }
    // من أُرسل له البريد قبلُ (من أي أحد) لا يُصفّ له ثانية
    const { data: prior } = await sb.from('award_touches').select('id').eq('award_id', a.id).eq('channel', 'email').eq('direction', 'out').limit(1);
    if (prior?.length) { skipped.push(a.company_name + ': أُرسل له البريد قبلُ'); continue; }
    const c = compose(a, cfg.templates, cfg.settings);
    if (!c.ready) { skipped.push(a.company_name + ': القالب ناقص'); continue; }
    const templateKey = kindFor(a) === 'general' ? 'general' : a.category + '/' + stageFor(a.awarded_at, cfg.settings);
    const fingerprint = outboxFingerprint(a.id, templateKey, 'email');
    const { data: ins, error: iErr } = await sb.from('award_outbox').upsert({
      award_id: a.id, template_key: templateKey, channel: 'email', fingerprint, to_address: to, subject: c.subject, body: c.body,
    }, { onConflict: 'fingerprint', ignoreDuplicates: true }).select('id');
    if (iErr) { skipped.push(a.company_name + ': ' + iErr.message); continue; }
    if (ins?.length) queued++;
  }
  return { queued, skipped };
}

/** ٢) يرسل المستحق — ما لم يُوقَف، وفي النافذة، وتحت السقف */
export async function sendDue(sb: SupabaseClient, opts: { force?: boolean } = {}): Promise<{ sent: number; failed: number; cancelled: number; held: string | null }> {
  const cfg = await loadConfig(sb);
  const s = cfg.settings;
  if (String(s.outbox_enabled || '').trim() !== 'true') return { sent: 0, failed: 0, cancelled: 0, held: 'الإرسال موقوف (outbox_enabled)' };
  const w = inWindow(s);
  if (!w.ok && !opts.force) return { sent: 0, failed: 0, cancelled: 0, held: w.why };
  const cap = num(s, 'outbox_daily_cap') ?? 0;
  const { count, error: cErr } = await sb.from('award_outbox').select('id', { count: 'exact', head: true })
    .eq('status', 'sent').gte('sent_at', riyadh().dayStartUtc.toISOString());
  if (cErr) throw new Error(cErr.message);
  const room = Math.max(0, cap - (count || 0));
  if (!room) return { sent: 0, failed: 0, cancelled: 0, held: 'بلغ السقف اليومي (' + cap + ')' };

  const { data: claimed, error } = await sb.rpc('outbox_claim', { n: room });
  if (error) throw new Error('الحجز: ' + error.message);
  let sent = 0, failed = 0, cancelled = 0;
  for (const o of (claimed || []) as Record<string, unknown>[]) {
    const id = String(o.id), awardId = String(o.award_id);
    // تحقّقٌ أخير قبل الخروج: «لا تتواصل» أو بريدٌ سابق أو تغيّر الحالة ← تُلغى ولا تخرج
    const { data: a } = await sb.from('contract_awards').select('status').eq('id', awardId).maybeSingle();
    const { data: prior } = await sb.from('award_touches').select('id').eq('award_id', awardId).eq('channel', String(o.channel)).eq('direction', 'out').limit(1);
    if (!a || a.status !== 'qualified' || prior?.length) {
      await sb.from('award_outbox').update({ status: 'cancelled', last_error: !a ? 'الفرصة حُذفت' : prior?.length ? 'أُرسل البريد من غير الصادر' : 'الحالة صارت «' + a.status + '»' }).eq('id', id);
      cancelled++; continue;
    }
    let r: { ok: true; id: string | null } | { ok: false; reason: string };
    if (o.channel === 'whatsapp') {
      // بدل ضي: قالب Meta المعتمد، ومتغيّراته اسم العقد والجهة (مخزّنةً في الصفّ)
      const wc = await waConfig(sb);
      if (!wc.enabled) { await sb.from('award_outbox').update({ status: 'pending', last_error: 'واتساب المنصة غير مفعَّل' }).eq('id', id); continue; }
      let params: string[] = []; try { params = JSON.parse(String(o.subject)).params || []; } catch { /* قديم */ }
      r = await sendWaTemplate(wc, String(o.to_address), params);
    } else {
      const html = '<div dir="rtl" style="font-family:Arial,Tahoma;line-height:1.95;color:#1A3D34;font-size:15px;white-space:pre-wrap">' + esc(String(o.body)) + '</div>';
      r = await sendMail({ from: FROM, to: String(o.to_address), subject: String(o.subject), html, replyTo: 'partners@murdi.sa', idempotencyKey: 'outbox-' + String(o.fingerprint) });
    }
    if (r.ok) {
      const now = new Date().toISOString();
      await sb.from('award_outbox').update({ status: 'sent', sent_at: now, external_ref: r.id, last_error: null }).eq('id', id);
      await sb.from('award_touches').insert(o.channel === 'whatsapp'
        ? { award_id: awardId, channel: 'whatsapp', direction: 'out', actor: 'المكتب (بدل ضي)', to_address: o.to_address, subject: 'أُرسلت من المكتب بدل ضي', body: o.body, external_ref: r.id }
        : { award_id: awardId, channel: 'email', direction: 'out', actor: ACTOR, to_address: o.to_address, subject: o.subject, body: o.body, external_ref: r.id });
      await sb.from('contract_awards').update({ status: 'messaged', messaged_at: now, updated_at: now }).eq('id', awardId).eq('status', 'qualified');
      sent++;
    } else {
      const attempts = Number(o.attempts || 1);
      const giveUp = attempts >= MAX_ATTEMPTS;
      await sb.from('award_outbox').update({
        status: giveUp ? 'cancelled' : 'failed', last_error: r.reason,
        next_attempt_at: new Date(Date.now() + Math.min(6 * 3600_000, 15 * 60_000 * 2 ** (attempts - 1))).toISOString(),
      }).eq('id', id);
      if (giveUp) cancelled++; else failed++;
    }
  }
  return { sent, failed, cancelled, held: null };
}

/**
 * بدل ضي: فرصةٌ «موثّقة» برقمٍ منشور بمصدره لم تتواصل معها ضي خلال `dhai_backup_after_hours`
 * ← تُصفّ رسالة واتساب من المنصة بقالب Meta المعتمد، وتُسجَّل «أُرسلت من المكتب بدل ضي».
 * لا يعمل إلا إن فُعِّل واتساب المنصة (الرمز والرقم والقالب). والإرسال في نافذة الدوام والسقف نفسهما.
 */
export async function enqueueDhaiBackup(sb: SupabaseClient): Promise<{ queued: number; held: string | null }> {
  const wc = await waConfig(sb);
  if (!wc.enabled) return { queued: 0, held: 'واتساب المنصة غير مفعَّل' };
  const cfg = await loadConfig(sb);
  const hours = num(cfg.settings, 'dhai_backup_after_hours') ?? 24;
  const before = new Date(Date.now() - hours * 3600_000).toISOString();
  const { data, error } = await sb.from('contract_awards').select('id, company_name, tender_title, buyer_entity, contact_phone, contact_whatsapp, phone_check, phone_source_url, documented_at, created_at')
    .eq('status', 'qualified').not('phone_source_url', 'is', null).or('phone_check.is.null,phone_check.eq.yes').lt('documented_at', before);
  if (error) throw new Error(error.message);
  let queued = 0;
  for (const a of data || []) {
    const to = waDigits(a.contact_whatsapp || a.contact_phone);
    if (!to) continue;
    const { data: touched } = await sb.from('award_touches').select('id').eq('award_id', a.id).in('channel', ['whatsapp', 'call']).eq('direction', 'out').limit(1);
    if (touched?.length) continue; // ضي تواصلت — لا بديل
    const params = [String(a.tender_title || 'العقد'), String(a.buyer_entity || 'الجهة')];
    const { data: ins } = await sb.from('award_outbox').upsert({
      award_id: a.id, template_key: 'wa:' + wc.template, channel: 'whatsapp', fingerprint: outboxFingerprint(String(a.id), 'wa:' + wc.template, 'whatsapp'),
      to_address: to, subject: JSON.stringify({ template: wc.template, params }), body: 'قالب واتساب «' + wc.template + '» — ' + params.join(' · '),
    }, { onConflict: 'fingerprint', ignoreDuplicates: true }).select('id');
    if (ins?.length) queued++;
  }
  return { queued, held: null };
}

/** ٣) من لا يرد بعد مكالمة التذكير الوحيدة: يُغلق */
export async function closeNoReply(sb: SupabaseClient): Promise<number> {
  const cfg = await loadConfig(sb);
  const days = num(cfg.settings, 'close_after_reminder_days') ?? 7;
  const before = new Date(Date.now() - days * 86400_000).toISOString();
  const { data, error } = await sb.from('contract_awards').update({ status: 'dropped', updated_at: new Date().toISOString() })
    .eq('status', 'reminder_call').lt('reminder_at', before).select('id');
  if (error) throw new Error(error.message);
  for (const r of data || []) {
    await sb.from('award_touches').insert({ award_id: r.id, channel: 'call', direction: 'out', actor: 'المنصة', body: 'أُغلقت: لا رد بعد المتابعة الواحدة (' + days + ' أيام)', outcome: 'أُغلقت بلا رد' });
  }
  return (data || []).length;
}

/** كل ردٍّ جديد (من زرّ ضي، أو ما سجّله Claude التشغيل من البريد) يصل المالك فوراً — مرةً لكل فرصة */
export async function notifyReplies(sb: SupabaseClient): Promise<number> {
  const { data, error } = await sb.from('contract_awards').select('id, company_name').not('replied_at', 'is', null).is('reply_notified_at', null).limit(20);
  if (error) throw new Error(error.message);
  let n = 0;
  for (const a of data || []) {
    // يُحجز أولاً (مشروطاً) فلا يُشعَر مرتين إن تزامنت دورتان
    const { data: mine } = await sb.from('contract_awards').update({ reply_notified_at: new Date().toISOString() }).eq('id', a.id).is('reply_notified_at', null).select('id');
    if (!mine?.length) continue;
    await sendPush({ title: '🟢 ردٌّ على ترسية', body: String(a.company_name) + ' — اضغط لتفتح «قناة الفائزين»', url: '/admin/channel', important: true, tag: 'award-reply-' + a.id }, OWNER_EMAIL).catch(() => null);
    n++;
  }
  return n;
}

/**
 * كل ما يحتاج قرار المالك يسبقه إشعارٌ على جواله يفتح «قناة الفائزين» مباشرة — مرةً لكل بند:
 * ما علّمه Codex «تحتاج قرار الدكتور»، والاعتراض المهم، والنص الجديد أو المعدَّل (قالب · فرضية · إعداد).
 * (والاستشارة الجاهزة و«نعم» لهما إشعارهما عند حدوثهما.)
 */
export async function notifyDecisions(sb: SupabaseClient): Promise<number> {
  const items: { key: string; title: string; body: string }[] = [];
  const [fl, ob, tp, hy, st] = await Promise.all([
    sb.from('contract_awards').select('id, company_name, codex_reason, codex_flag_at').eq('codex_flag', 'needs_dr'),
    sb.from('award_touches').select('id, award_id, objection').eq('objection_important', true).gte('created_at', new Date(Date.now() - 14 * 86400_000).toISOString()),
    sb.from('award_message_templates').select('id, category, stage, updated_at').eq('approved', false),
    sb.from('award_hypotheses').select('id, category, stage, updated_at').eq('approved', false),
    sb.from('award_settings').select('key, value').in('key', ['general_email_approved', 'whatsapp_template_approved', 'gap_email_approved']),
  ]);
  for (const a of fl.data || []) items.push({ key: 'flag:' + a.id + ':' + a.codex_flag_at, title: '🔷 Codex يحتاج قرارك', body: String(a.company_name) + ' — ' + String(a.codex_reason || '') });
  for (const t of ob.data || []) items.push({ key: 'obj:' + t.id, title: '⚠️ اعتراضٌ مهم من عميل', body: String(t.objection || '') });
  for (const t of tp.data || []) items.push({ key: 'tpl:' + t.id + ':' + t.updated_at, title: '✍️ قالبٌ معدَّل ينتظر اعتمادك', body: String(t.category) + ' / ' + String(t.stage) });
  for (const h of hy.data || []) items.push({ key: 'hyp:' + h.id + ':' + h.updated_at, title: '✍️ فرضيةٌ تنتظر اعتمادك', body: String(h.category) + ' / ' + String(h.stage) });
  for (const s of st.data || []) if (s.value !== 'true') items.push({ key: 'txt:' + s.key + ':' + new Date().toISOString().slice(0, 10), title: '✍️ نصٌّ معدَّل ينتظر اعتمادك', body: String(s.key) });
  if (!items.length) return 0;
  const { data: seen } = await sb.from('dr_notified').select('key').in('key', items.map((i) => i.key));
  const done = new Set((seen || []).map((r) => String(r.key)));
  let n = 0;
  for (const i of items) {
    if (done.has(i.key)) continue;
    // يُحجز المفتاح أولاً — لا يتكرر الإشعار إن تزامنت دورتان
    const { error } = await sb.from('dr_notified').insert({ key: i.key });
    if (error) continue;
    await sendPush({ title: i.title, body: i.body + ' — اضغط لتفتح «قناة الفائزين»', url: '/admin/channel', important: true, tag: i.key.slice(0, 60) }, OWNER_EMAIL).catch(() => null);
    n++;
  }
  return n;
}

/** ٤) ردٌّ مؤهَّل ← استشارةٌ «جاهزة» تنتظر المالك (واحدةٌ في كل دورة — التوليد يأخذ دقيقة) */
export async function autoConsult(sb: SupabaseClient): Promise<string | null> {
  const { data } = await sb.from('award_pipeline').select('id, company_name').eq('state', 'تنتظر بيانات الاستشارة').limit(5);
  for (const p of data || []) {
    const { data: a } = await sb.from('contract_awards').select('*').eq('id', p.id).maybeSingle();
    if (!a || a.fit_service === 'not_fit') continue;
    // محاولةٌ جارية أو فاشلة في الساعة الأخيرة لا تُكرَّر في كل دورة
    const { data: recent } = await sb.from('consultations').select('id').eq('award_id', a.id).eq('assessment_type', 'award_gap')
      .in('status', ['analyzing', 'failed']).gte('created_at', new Date(Date.now() - 3600_000).toISOString()).limit(1);
    if (recent?.length) continue;
    const cfg = await loadConfig(sb);
    const r = await generateConsultation(sb, a as Award, (a as Award & { gap_inputs?: never }).gap_inputs, cfg.settings, 'المنصة');
    return r.ok ? String(p.company_name) + ': جاهزة' : String(p.company_name) + ': ' + r.error;
  }
  return null;
}
