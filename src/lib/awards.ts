import type { SupabaseClient } from '@supabase/supabase-js';

// الترسيات — شركاتٌ رُسّي عليها عقدٌ حكومي، ونخاطبها بسيولة التنفيذ.
//
// ★ المستودع عام: نصوص الرسائل والحدود المالية لا تُكتب هنا أبداً. تُقرأ من
//   `award_message_templates` و`award_settings` في كل مرة، ويعدّلها المالك
//   من شاشته. وما في هذا الملف إنما هو **آلية التركيب** لا المحتوى.
// ★ والجداول محروسة بـRLS بلا منح لـanon ولا authenticated — فالقراءة
//   والكتابة من مسارات الخادم بمفتاح الخدمة، بعد فحص أن الطالب هو المالك.

export type Award = {
  id: string;
  source: string;
  source_ref: string | null;
  company_name: string;
  cr_number: string | null;
  tender_title: string | null;
  buyer_entity: string | null;
  category: string;
  contract_value: number | null;
  is_subcontract?: boolean | null;
  /** تاريخ فتح العروض — يُقدَّر منه بدء التنفيذ */
  bids_opened_at?: string | null;
  /** مفتاح المنشأة (يضعه مشغّل القاعدة) — يجمع ترسيات المنشأة الواحدة */
  org_key?: string | null;
  awarded_at: string | null;
  track: string | null;
  decision_maker_name: string | null;
  decision_maker_role: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  contact_channel: string | null;
  status: string;
  messaged_at: string | null;
  reminder_at: string | null;
  replied_at: string | null;
  gap_sent_at: string | null;
  service_request_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type Template = { id: string; category: string; stage: string; subject: string; context_paragraph: string; active: boolean; approved?: boolean };
export type Settings = Record<string, string>;

/**
 * الخدمة المناسبة — تختارها ضي بعد المكالمة (التأهيل)، فلا يُفترض أن كل فائزٍ يحتاج تمويل عقد.
 * أسماءٌ لا أسعار: الأسعار في القاعدة ولا تصل لضي.
 */
export const FIT_SERVICES: Record<string, string> = {
  contract_finance: 'تمويل عقد',
  working_capital: 'رأس مال عامل',
  feasibility_credit: 'جدوى ائتمانية',
  broader_funding: 'مسار تمويل أوسع',
  not_fit: 'لا يناسب',
};
export const isFitService = (v: unknown) => Object.prototype.hasOwnProperty.call(FIT_SERVICES, String(v ?? ''));

/** الفئات التي لها قوالب ويُخاطَب أصحابها — وما سواها «لا تُخاطَب» */
export const ADDRESSED = new Set(['construction', 'om_services', 'supply_it']);
export const isAddressed = (category: string) => ADDRESSED.has(category);

/** المصدر الذي يحمله رابط الترسية — أول ثماني خانات من معرّفها */
export const awardSrc = (id: string) => 'award-' + String(id).replace(/-/g, '').slice(0, 8);
export const awardLink = (id: string) => 'https://murdi.sa/uqud?src=' + awardSrc(id);

/**
 * الانتقالات المسموحة. المسار: جديد ← مؤهَّل ← أُرسل ← ردّ ← جدول الفجوة ←
 * اجتماع ← مسعَّر ← مدفوع، أو «مُسقط» من أي مرحلة. و«مكالمة التذكير» لا
 * يضعها المالك — تضعها مكالمة ضي وحدها، ومنها يمضي الصفّ إلى الرد أو الإسقاط.
 */
export const TRANSITIONS: Record<string, string[]> = {
  new: ['qualified', 'dropped', 'do_not_contact'],
  qualified: ['messaged', 'dropped', 'do_not_contact'],
  messaged: ['replied', 'dropped', 'do_not_contact'],
  reminder_call: ['replied', 'dropped', 'do_not_contact'],
  replied: ['gap_sent', 'dropped', 'do_not_contact'],
  gap_sent: ['meeting', 'dropped', 'do_not_contact'],
  meeting: ['priced', 'dropped', 'do_not_contact'],
  priced: ['paid', 'dropped', 'do_not_contact'],
  paid: [],
  dropped: [],
  // «لا تتواصل» نهائية: توقف البريد والاتصال والواتساب للمنشأة كلها (مشغّل القاعدة يسريها
  // على ترسياتها)، ويمنع مشغّلٌ آخر إعادة استيرادها بالسجل التجاري أو بالاسم.
  do_not_contact: [],
};

/** عمود التاريخ الذي يُكتب عند الوصول إلى الحالة — إن كان لها عمود */
export const STAMP: Record<string, keyof Award> = {
  messaged: 'messaged_at',
  reminder_call: 'reminder_at',
  replied: 'replied_at',
  gap_sent: 'gap_sent_at',
};

export const num = (s: Settings, key: string): number | null => {
  const v = Number(String(s[key] ?? '').trim());
  return Number.isFinite(v) && String(s[key] ?? '').trim() !== '' ? v : null;
};

/** المرحلة: «بداية» إن كانت الترسية خلال `early_stage_days` يوماً، وإلا «في التنفيذ». وبلا تاريخ: في التنفيذ. */
export function stageFor(awardedAt: string | null, s: Settings, now = new Date()): 'early' | 'in_execution' {
  const days = num(s, 'early_stage_days');
  if (!awardedAt || days === null) return 'in_execution';
  const t = Date.parse(awardedAt + (awardedAt.length === 10 ? 'T00:00:00Z' : ''));
  if (!Number.isFinite(t)) return 'in_execution';
  return (now.getTime() - t) / 86400_000 <= days ? 'early' : 'in_execution';
}

/** يستبدل {tender} و{entity} — وإن غابت الجهة حُذفت «مع {entity}» بسلاسة */
export function fill(text: string, a: Pick<Award, 'tender_title' | 'buyer_entity'>): string {
  let t = String(text || '');
  const entity = String(a.buyer_entity || '').trim();
  if (!entity) {
    t = t.replace(/\s*مع\s*\{entity\}/g, '').replace(/\s*\{entity\}/g, '');
  } else {
    t = t.replace(/\{entity\}/g, entity);
  }
  const tender = String(a.tender_title || '').trim();
  if (!tender) {
    // بلا اسم مشروع: «في «{tender}»» ← «في العقد»، وما سواها يُحذف بلا أثر
    t = t.replace(/في\s*«\{tender\}»/g, 'في العقد').replace(/\s*«\{tender\}»/g, '');
  }
  t = t.replace(/\{tender\}/g, tender || 'العقد');
  return t.replace(/[ \t]{2,}/g, ' ').replace(/ +([،.])/g, '$1');
}

/**
 * قاعدة اختيار القالب (`award_settings.template_selection_rule`): **العام** إن
 * كانت القيمة فارغة، أو الفائز مقاول باطن، أو المصدر غير «اعتماد» — فلا نبني
 * رسالةً على تفاصيل لم تثبت. وإلا **المفصّل** بالفئة والمرحلة.
 */
export type Kind = 'general' | 'detailed';
export const kindFor = (a: Pick<Award, 'contract_value' | 'is_subcontract' | 'source'>): Kind =>
  a.contract_value == null || a.is_subcontract === true || a.source !== 'etimad' ? 'general' : 'detailed';

export type Composed = { subject: string; body: string; stage: 'early' | 'in_execution'; kind: Kind; template: Template | null; ready: boolean; link: string };

/**
 * يركّب البريد. العام: `general_email_subject` + `general_email_body` + التوقيع.
 * المفصّل: الافتتاح + فقرة السياق (بالفئة والمرحلة) + العرض + الدعوة + التوقيع.
 * والتوقيع يحمل رابط الترسية.
 */
export function compose(a: Award, templates: Template[], s: Settings): Composed {
  const stage = stageFor(a.awarded_at, s);
  const kind = kindFor(a);
  const link = awardLink(a.id);
  // الرابط داخل التوقيع: مكان `{link}` إن كُتب فيه، وإلا سطرٌ في آخره
  const sig = String(s.signature || '');
  const signature = sig.includes('{link}') ? sig.replace(/\{link\}/g, link) : (sig.trimEnd() + '\n' + link);
  if (kind === 'general') {
    const subject = fill(String(s.general_email_subject || ''), a).trim();
    const body = fill(String(s.general_email_body || ''), a).trim();
    if (!subject || !body) return { subject: '', body: '', stage, kind, template: null, ready: false, link };
    return { subject, body: body + '\n\n' + signature, stage, kind, template: null, ready: true, link };
  }
  // قالبٌ مفعَّل ومعتمد — المعدَّل جوهرياً ينتظر اعتماد المالك قبل أن يخرج
  const template = templates.find((t) => t.active && t.approved !== false && t.category === a.category && t.stage === stage) || null;
  if (!template) return { subject: '', body: '', stage, kind, template: null, ready: false, link };
  const parts = [s.opening_line, template.context_paragraph, s.offer_paragraph, s.cta_paragraph]
    .map((p) => fill(String(p || ''), a).trim()).filter(Boolean);
  return { subject: fill(template.subject, a), body: parts.join('\n\n') + '\n\n' + signature, stage, kind, template, ready: true, link };
}

export async function loadConfig(sb: SupabaseClient): Promise<{ templates: Template[]; settings: Settings }> {
  const [t, s] = await Promise.all([
    sb.from('award_message_templates').select('id, category, stage, subject, context_paragraph, active, approved').order('category').order('stage'),
    sb.from('award_settings').select('key, value'),
  ]);
  if (t.error) throw new Error('القوالب: ' + t.error.message);
  if (s.error) throw new Error('الإعدادات: ' + s.error.message);
  const settings: Settings = {};
  for (const r of s.data || []) settings[String(r.key)] = String(r.value ?? '');
  return { templates: (t.data || []) as Template[], settings };
}

/**
 * طلبٌ وصل من رابط ترسية (`src=award-xxxxxxxx`): يُربط بترسيته، وتصير «ردّ».
 * يُستدعى من مسار الاستفسار العام — ولا يرمي: فشلُ الربط لا يُسقط طلب العميل.
 */
export async function linkInquiryToAward(sb: SupabaseClient, src: string, inquiryId: string): Promise<string | null> {
  const m = /^award-([0-9a-f]{8})$/i.exec(String(src || '').trim());
  if (!m) return null;
  const prefix = m[1].toLowerCase();
  const { data } = await sb.from('contract_awards').select('id, status, notes')
    .in('status', ['new', 'qualified', 'messaged', 'reminder_call', 'replied']);
  const hit = (data || []).find((r) => String(r.id).replace(/-/g, '').toLowerCase().startsWith(prefix));
  if (!hit) return null;
  const now = new Date().toISOString();
  const note = (hit.notes ? String(hit.notes) + '\n' : '') + '[' + now.slice(0, 10) + '] ردّ عبر رابط الترسية — طلب الموقع ' + inquiryId;
  const patch: Record<string, unknown> = { notes: note, updated_at: now };
  if (hit.status !== 'replied') { patch.status = 'replied'; patch.replied_at = now; }
  await sb.from('contract_awards').update(patch).eq('id', hit.id);
  return String(hit.id);
}

/**
 * سطر الترسيات اليومي في جرد المالك: جديدة · أُرسل · ردّ · جدول فجوة أُرسل · مدفوع
 * — لآخر أربع وعشرين ساعة. يُعيد '' إن لم يتحرّك شيء، فلا يُكتب سطرٌ من أصفار.
 */
export async function awardsDailyLine(sb: SupabaseClient): Promise<string> {
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const count = async (build: (q: ReturnType<SupabaseClient['from']>) => unknown): Promise<number> => {
    const q = sb.from('contract_awards');
    const r = await (build(q) as PromiseLike<{ count: number | null; error: { message: string } | null }>);
    if (r.error) throw new Error(r.error.message);
    return r.count || 0;
  };
  const head = { count: 'exact' as const, head: true };
  const [created, replied, gap, paid, tq] = await Promise.all([
    count((q) => q.select('id', head).gte('created_at', since)),
    count((q) => q.select('id', head).gte('replied_at', since)),
    count((q) => q.select('id', head).gte('gap_sent_at', since)),
    count((q) => q.select('id', head).eq('status', 'paid').gte('updated_at', since)),
    sb.from('award_touches').select('channel').eq('direction', 'out').gte('created_at', since).limit(5000),
  ]);
  if (tq.error) throw new Error(tq.error.message);
  // التواصل بقنواته من سجلّ المراسلات — لا من الحالة (الترسية الواحدة قد تُخاطَب بقناتين)
  const by = { email: 0, whatsapp: 0, call: 0 } as Record<string, number>;
  for (const t of (tq.data || []) as Array<{ channel: string }>) by[t.channel] = (by[t.channel] || 0) + 1;
  const touched = by.email + by.whatsapp + by.call;
  if (!created && !touched && !replied && !gap && !paid) return '';
  const n = (x: number) => x.toLocaleString('ar-SA');
  return 'الترسيات (٢٤ ساعة): جديدة ' + n(created)
    + ' · تواصل ' + n(touched) + ' (بريد ' + n(by.email) + ' / واتساب ' + n(by.whatsapp) + ' / اتصال ' + n(by.call) + ')'
    + ' · ردّ ' + n(replied) + ' · جدول فجوة أُرسل ' + n(gap) + ' · مدفوع ' + n(paid);
}

/**
 * مراحل المسار — كل مرحلةٍ عمود تاريخٍ في صف الترسية تختمه القاعدة من الأحداث نفسها
 * (`supabase/migrations/20260929_awards_funnel.sql`).
 */
export const FUNNEL: [string, string][] = [
  ['documented_at', 'موثّقة'], ['reached_at', 'وصول'], ['contacted_at', 'تواصل'], ['replied_at', 'رد'],
  ['qualified_at', 'تأهيل'], ['offered_at', 'عرض'], ['paid_at', 'دفع'], ['executing_at', 'تنفيذ'], ['first_referral_at', 'إحالات'],
];

/** سطر المسار في الجرد الصباحي: عدد الترسيات في كل مرحلة، وما دخلها في ٢٤ ساعة */
export async function awardsFunnelLine(sb: SupabaseClient): Promise<string> {
  const since = Date.now() - 24 * 3600_000;
  const { data, error } = await sb.from('contract_awards').select(FUNNEL.map(([c]) => c).join(', ') + ', referrals_count, status');
  if (error) throw new Error(error.message);
  const rows = (data || []) as unknown as Record<string, unknown>[];
  if (!rows.length) return '';
  const n = (x: number) => x.toLocaleString('ar-SA');
  return 'مسار الترسيات: ' + FUNNEL.map(([c, l]) => {
    const has = rows.filter((r) => r[c]);
    const total = c === 'first_referral_at' ? rows.reduce((x, r) => x + Number(r.referrals_count || 0), 0) : has.length;
    const fresh = has.filter((r) => Date.parse(String(r[c])) >= since).length;
    return l + ' ' + n(total) + (fresh ? ' (+' + n(fresh) + ')' : '');
  }).join(' ← ') + ' · «لا تتواصل» ' + n(rows.filter((r) => r.status === 'do_not_contact').length);
}

// ═══ المراسلات (`award_touches`) ومهام ضي ═══

export type Touch = {
  id: string; award_id: string; channel: 'email' | 'whatsapp' | 'call'; direction: 'out' | 'in';
  actor: string; to_address: string | null; subject: string | null; body: string | null;
  outcome: string | null; external_ref: string | null; created_at: string;
};

/** رقم واتساب دولي (٩٦٦…) أو '' */
export function waDigits(raw: unknown): string {
  const d = String(raw ?? '').replace(/[^\d٠-٩]/g, '').replace(/[٠-٩]/g, (c) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(c)));
  if (/^9665\d{8}$/.test(d)) return d;
  if (/^05\d{8}$/.test(d)) return '966' + d.slice(1);
  if (/^5\d{8}$/.test(d)) return '966' + d;
  return d.length >= 10 ? d : '';
}

/**
 * نصّ الواتساب — `whatsapp_template_general` للعام و`whatsapp_template` للمفصّل
 * (القاعدة نفسها في `kindFor`). ولا يُعطى إلا إن كان `whatsapp_template_approved
 * = 'true'`: القالب لا يخرج قبل أن يعتمده المالك.
 */
type WaFields = Pick<Award, 'tender_title' | 'buyer_entity' | 'contract_value' | 'is_subcontract' | 'source'>;
export function whatsappText(a: WaFields, s: Settings): string | null {
  if (String(s.whatsapp_template_approved || '').trim() !== 'true') return null;
  const t = String((kindFor(a) === 'general' ? s.whatsapp_template_general : s.whatsapp_template) || '').trim();
  return t ? fill(t, a) : null;
}

/**
 * ما تفعله نتيجة مكالمة ضي بحالة الترسية. المفردة من `@/lib/outcomes`.
 * «مهتم» و«تحوّل عميلاً» ردٌّ؛ و«غير مهتم» و«رقم خاطئ» إسقاط؛ وما سواها
 * (لم يرد · أرسلتُ رسالة · طلب معاودة · غير مؤهل الآن) تواصلٌ وقع.
 */
export function statusAfterOutcome(current: string, outcome: string): string {
  if (outcome === 'مهتم' || outcome === 'تحوّل عميلاً') return 'replied';
  if (outcome === 'غير مهتم') return 'dropped';
  if (outcome === 'طلب عدم التواصل') return 'do_not_contact';
  // «رقم خاطئ» لا يُسقط الترسية: الرقم يُعلَّم «لا يصل» وتعود الترسية إلى «ينقصها رقم»
  if (outcome === 'رقم خاطئ') return current;
  if (current === 'messaged') return 'reminder_call'; // مكالمة التذكير الوحيدة — ثم يُغلق الصف لها
  return 'messaged';
}

export type StaffTask = {
  id: string; kind: 'first' | 'reminder' | 'qualify' | 'followup' | 'codex'; company: string; person: string | null; role: string | null;
  phone: string | null; whatsapp: string | null; wa_url: string | null; since: string | null;
  /** لم يُتحقق بعد أن الرقم يصل لصاحب القرار — السؤال أولاً */
  check: boolean; source: string | null; source_url: string | null;
  /** سؤال التأهيل — من الفرصة أو من مكتبة الفرضيات المعتمدة. والفرضية لا تُقال للعميل حقيقةً */
  question: string | null;
  /** سبب «مهمة لضي» من Codex */
  codex_reason: string | null;
  /** آخر موعدٍ حدّدته هي (موعد العميل) */
  appointment: string | null;
};

export async function staffTasks(sb: SupabaseClient): Promise<StaffTask[]> {
  const { settings } = await loadConfig(sb);
  const days = num(settings, 'reminder_after_days');
  const { data, error } = await sb.from('contract_awards')
    .select('id, status, source, contract_value, is_subcontract, company_name, tender_title, buyer_entity, category, awarded_at, decision_maker_name, decision_maker_role, contact_phone, contact_whatsapp, messaged_at, updated_at, phone_source, phone_source_url, phone_check, fit_service, qualify_question, codex_flag, codex_reason, next_at_override')
    .in('status', ['qualified', 'messaged', 'replied', 'gap_sent', 'meeting', 'priced'])
    // رقمٌ بمصدرٍ منشور ورابطه وحده، وما قيل عنه «لا يصل» لا يعود إليها
    .not('phone_source_url', 'is', null)
    .or('phone_check.is.null,phone_check.eq.yes');
  if (error) throw new Error(error.message);
  const ids = (data || []).map((a) => String(a.id));
  // الترتيب بالدرجة المفسَّرة (والدرجة نفسها وسببها لا تصل إليها — فيها القيمة)
  const [pl, hy] = await Promise.all([
    ids.length ? sb.from('award_pipeline').select('id, score').in('id', ids) : Promise.resolve({ data: [], error: null }),
    sb.from('award_hypotheses').select('category, stage, question').eq('approved', true),
  ]);
  const score = new Map(((pl.data || []) as { id: string; score: number }[]).map((r) => [String(r.id), Number(r.score)]));
  const lib = new Map(((hy.data || []) as { category: string; stage: string; question: string }[]).map((h) => [h.category + '/' + h.stage, h.question]));
  const cutoff = days === null ? null : Date.now() - days * 86400_000;
  const out: (StaffTask & { score: number })[] = [];
  for (const a of data || []) {
    const phone = a.contact_phone ? String(a.contact_phone) : null;
    const wa = waDigits(a.contact_whatsapp || a.contact_phone);
    if (!phone && !wa) continue;
    let kind: StaffTask['kind'] | null = null;
    if (a.codex_flag === 'dhai_task') kind = 'codex';
    else if (a.status === 'qualified') kind = 'first';
    else if (a.status === 'messaged' && cutoff !== null && a.messaged_at && Date.parse(String(a.messaged_at)) <= cutoff) kind = 'reminder';
    else if (a.status === 'replied' && !a.fit_service) kind = 'qualify';
    else if (['gap_sent', 'meeting', 'priced'].includes(String(a.status)) && (!a.next_at_override || Date.parse(String(a.next_at_override)) <= Date.now() + 86400_000)) kind = 'followup';
    if (!kind) continue;
    const text = whatsappText(a as WaFields, settings);
    out.push({
      id: String(a.id), kind, company: String(a.company_name),
      person: a.decision_maker_name ? String(a.decision_maker_name) : null,
      role: a.decision_maker_role ? String(a.decision_maker_role) : null,
      phone, whatsapp: wa || null,
      wa_url: wa && text && ['first', 'reminder', 'codex'].includes(kind) ? 'https://wa.me/' + wa + '?text=' + encodeURIComponent(text) : null,
      since: String(kind === 'reminder' ? a.messaged_at : a.updated_at || ''),
      check: a.phone_check !== 'yes',
      source: a.phone_source ? String(a.phone_source) : null,
      source_url: a.phone_source_url ? String(a.phone_source_url) : null,
      question: (a.qualify_question ? String(a.qualify_question) : null) || lib.get(String(a.category) + '/' + stageFor(a.awarded_at ? String(a.awarded_at) : null, settings)) || null,
      codex_reason: kind === 'codex' && a.codex_reason ? String(a.codex_reason) : null,
      appointment: a.next_at_override ? String(a.next_at_override) : null,
      score: score.get(String(a.id)) ?? 0,
    });
  }
  // «مهمة لضي» من Codex أولاً، ثم الأعلى درجةً
  return out.sort((x, y) => (x.kind === 'codex' ? 0 : 1) - (y.kind === 'codex' ? 0 : 1) || y.score - x.score)
    .map(({ score: _s, ...t }) => { void _s; return t; });
}
