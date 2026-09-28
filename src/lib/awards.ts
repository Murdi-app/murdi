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

export type Template = { id: string; category: string; stage: string; subject: string; context_paragraph: string; active: boolean };
export type Settings = Record<string, string>;

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
  new: ['qualified', 'dropped'],
  qualified: ['messaged', 'dropped'],
  messaged: ['replied', 'dropped'],
  reminder_call: ['replied', 'dropped'],
  replied: ['gap_sent', 'dropped'],
  gap_sent: ['meeting', 'dropped'],
  meeting: ['priced', 'dropped'],
  priced: ['paid', 'dropped'],
  paid: [],
  dropped: [],
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
  t = t.replace(/\{tender\}/g, String(a.tender_title || '').trim() || 'العقد');
  return t.replace(/[ \t]{2,}/g, ' ').replace(/ +([،.])/g, '$1');
}

export type Composed = { subject: string; body: string; stage: 'early' | 'in_execution'; template: Template | null; link: string };

/** يركّب الرسالة: الافتتاح + فقرة السياق (بالفئة والمرحلة) + العرض + الدعوة + التوقيع ومعه رابط الترسية */
export function compose(a: Award, templates: Template[], s: Settings): Composed {
  const stage = stageFor(a.awarded_at, s);
  const link = awardLink(a.id);
  const template = templates.find((t) => t.active && t.category === a.category && t.stage === stage) || null;
  if (!template) return { subject: '', body: '', stage, template: null, link };
  // الرابط داخل التوقيع: مكان `{link}` إن كُتب فيه، وإلا سطرٌ في آخره
  const sig = String(s.signature || '');
  const signature = sig.includes('{link}') ? sig.replace(/\{link\}/g, link) : (sig.trimEnd() + '\n' + link);
  const parts = [s.opening_line, template.context_paragraph, s.offer_paragraph, s.cta_paragraph]
    .map((p) => fill(String(p || ''), a).trim()).filter(Boolean);
  return { subject: fill(template.subject, a), body: parts.join('\n\n') + '\n\n' + signature, stage, template, link };
}

export async function loadConfig(sb: SupabaseClient): Promise<{ templates: Template[]; settings: Settings }> {
  const [t, s] = await Promise.all([
    sb.from('award_message_templates').select('id, category, stage, subject, context_paragraph, active').order('category').order('stage'),
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
  const [created, messaged, replied, gap, paid] = await Promise.all([
    count((q) => q.select('id', head).gte('created_at', since)),
    count((q) => q.select('id', head).gte('messaged_at', since)),
    count((q) => q.select('id', head).gte('replied_at', since)),
    count((q) => q.select('id', head).gte('gap_sent_at', since)),
    count((q) => q.select('id', head).eq('status', 'paid').gte('updated_at', since)),
  ]);
  if (!created && !messaged && !replied && !gap && !paid) return '';
  const n = (x: number) => x.toLocaleString('ar-SA');
  return 'الترسيات (٢٤ ساعة): جديدة ' + n(created) + ' · أُرسل ' + n(messaged) + ' · ردّ ' + n(replied)
    + ' · جدول فجوة أُرسل ' + n(gap) + ' · مدفوع ' + n(paid);
}
