import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/requireAdmin';
import { loadConfig, compose, TRANSITIONS, STAMP, isAddressed, awardSrc, type Award, type Touch } from '@/lib/awards';

// الترسيات — للمالك وحده. الجداول بلا منحٍ للمتصفح، فكل قراءةٍ وكتابةٍ من
// هنا بمفتاح الخدمة بعد `requireAdmin`. والرسالة تُركَّب هنا من القوالب
// والإعدادات في القاعدة — لا نصّ في الكود (المستودع عام).

export const dynamic = 'force-dynamic';

const admin = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);
const cut = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n);
const CATEGORIES = ['construction', 'om_services', 'supply_it', 'consulting', 'transport', 'other'];
const CHANNELS = ['email', 'whatsapp', 'linkedin', 'call'];
const isUrl = (v: unknown) => /^https?:\/\/\S+$/i.test(String(v ?? '').trim());
// قيد القاعدة (رقمٌ بلا مصدرٍ منشور ورابطه يُرفض) يُقال بالعربية لا برسالة Postgres
const dbError = (m: string) => /phone_sourced_chk/.test(m)
  ? 'الرقم يحتاج مصدره المنشور ورابطه: ما نشرته المنشأة نفسها أو سجلٌّ رسمي (كسجل الهيئة السعودية للمقاولين)'
  : m;

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return NextResponse.json({ error: denied }, { status: 401 });
  const sb = admin();
  try {
    const [{ data, error }, cfg, tq, cq] = await Promise.all([
      sb.from('contract_awards').select('*').order('created_at', { ascending: false }).limit(1000),
      loadConfig(sb),
      sb.from('award_touches').select('*').order('created_at', { ascending: true }).limit(10000),
      sb.from('consultations').select('award_id, status, generated_at, released_at').not('award_id', 'is', null)
        .order('created_at', { ascending: false }).limit(2000),
    ]);
    if (error) return NextResponse.json({ error: 'تعذّرت قراءة الترسيات — ' + error.message }, { status: 500 });
    if (tq.error) return NextResponse.json({ error: 'تعذّرت قراءة المراسلات — ' + tq.error.message }, { status: 500 });
    if (cq.error) return NextResponse.json({ error: 'تعذّرت قراءة الاستشارات — ' + cq.error.message }, { status: 500 });
    // آخر استشارة فجوة لكل منشأة (الأحدث أولاً في القراءة) — تُظهَر على كل عقدٍ من عقودها
    const orgOf = new Map<string, string>();
    for (const a of (data || []) as Award[]) orgOf.set(String(a.id), String(a.org_key || a.id));
    const consultBy = new Map<string, { status: string; generated_at: string | null; released_at: string | null }>();
    for (const c of cq.data || []) {
      const k = orgOf.get(String(c.award_id)) || String(c.award_id);
      if (!consultBy.has(k)) consultBy.set(k, { status: String(c.status), generated_at: c.generated_at, released_at: c.released_at });
    }
    const orgCount = new Map<string, number>();
    for (const a of (data || []) as Award[]) if (a.status !== 'dropped') { const k = String(a.org_key || a.id); orgCount.set(k, (orgCount.get(k) || 0) + 1); }
    // كل مراسلة بحرفها وتاريخها وقناتها ومرسِلها ونتيجتها، والردود الواردة معها
    const touchesBy = new Map<string, Touch[]>();
    for (const t of (tq.data || []) as Touch[]) {
      const k = String(t.award_id);
      if (!touchesBy.has(k)) touchesBy.set(k, []);
      (touchesBy.get(k) as Touch[]).push(t);
    }
    const awards = ((data || []) as Award[]).map((a) => {
      const addressed = isAddressed(a.category);
      const c = addressed ? compose(a, cfg.templates, cfg.settings) : null;
      return {
        ...a,
        addressed,
        src: awardSrc(a.id),
        next: TRANSITIONS[a.status] || [],
        message: c && c.ready ? { subject: c.subject, body: c.body, stage: c.stage, kind: c.kind, link: c.link } : null,
        kind: c?.kind || null,
        stage: c?.stage || null,
        touches: touchesBy.get(String(a.id)) || [],
        consult: consultBy.get(String(a.org_key || a.id)) || null,
        org_awards: orgCount.get(String(a.org_key || a.id)) || 1,
      };
    });
    return NextResponse.json({ ok: true, awards, templates: cfg.templates, settings: cfg.settings });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'تعذّرت القراءة' }, { status: 500 });
  }
}

// إضافة ترسية يدوياً
export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return NextResponse.json({ error: denied }, { status: 401 });
  const b = await req.json().catch(() => ({} as Record<string, unknown>));
  const company = cut(b.company_name, 200);
  if (!company) return NextResponse.json({ error: 'اسم الشركة مطلوب' }, { status: 400 });
  const category = CATEGORIES.includes(String(b.category)) ? String(b.category) : 'other';
  const value = b.contract_value === '' || b.contract_value == null ? null : Number(String(b.contract_value).replace(/[,٬\s]/g, ''));
  if (value !== null && !Number.isFinite(value)) return NextResponse.json({ error: 'قيمة العقد غير صحيحة' }, { status: 400 });
  const awardedAt = cut(b.awarded_at, 10);
  if (awardedAt && !/^\d{4}-\d{2}-\d{2}$/.test(awardedAt)) return NextResponse.json({ error: 'تاريخ الترسية بصيغة YYYY-MM-DD' }, { status: 400 });
  const channel = CHANNELS.includes(String(b.contact_channel)) ? String(b.contact_channel) : null;
  const { data, error } = await admin().from('contract_awards').insert({
    source: 'manual',
    company_name: company,
    cr_number: cut(b.cr_number, 20) || null,
    tender_title: cut(b.tender_title, 400) || null,
    buyer_entity: cut(b.buyer_entity, 200) || null,
    category,
    contract_value: value,
    is_subcontract: b.is_subcontract === true || b.is_subcontract === 'true',
    awarded_at: awardedAt || null,
    decision_maker_name: cut(b.decision_maker_name, 120) || null,
    decision_maker_role: cut(b.decision_maker_role, 120) || null,
    contact_email: cut(b.contact_email, 160) || null,
    contact_phone: cut(b.contact_phone, 40) || null,
    contact_channel: channel,
    notes: cut(b.notes, 2000) || null,
  }).select('id').single();
  if (error) {
    if (/do_not_contact/.test(error.message)) return NextResponse.json({ error: 'هذه المنشأة «لا تتواصل» — لا تُضاف' }, { status: 409 });
    const dup = /duplicate|unique/i.test(error.message);
    return NextResponse.json({ error: dup ? 'هذه الترسية مسجّلة من قبل (الشركة والمنافسة نفسهما)' : 'تعذّر الحفظ — ' + error.message }, { status: dup ? 409 : 500 });
  }
  return NextResponse.json({ ok: true, id: data.id });
}

// انتقال حالة { id, to } — أو تعديل حقول { id, fields }
export async function PATCH(req: Request) {
  const denied = await requireAdmin();
  if (denied) return NextResponse.json({ error: denied }, { status: 401 });
  const b = await req.json().catch(() => ({} as Record<string, unknown>));
  const id = cut(b.id, 40);
  if (!id) return NextResponse.json({ error: 'id مطلوب' }, { status: 400 });
  const sb = admin();
  const { data: cur, error: rErr } = await sb.from('contract_awards').select('id, status, category').eq('id', id).maybeSingle();
  if (rErr) return NextResponse.json({ error: 'تعذّرت القراءة — ' + rErr.message }, { status: 500 });
  if (!cur) return NextResponse.json({ error: 'غير موجودة' }, { status: 404 });
  const now = new Date().toISOString();

  if (b.to !== undefined) {
    const to = String(b.to);
    const allowed = TRANSITIONS[String(cur.status)] || [];
    if (!allowed.includes(to)) {
      return NextResponse.json({ error: 'لا يُنتقل من «' + cur.status + '» إلى «' + to + '»' }, { status: 409 });
    }
    // لا تُرسل رسالة لفئةٍ لا تُخاطَب
    if (to === 'messaged' && !isAddressed(String(cur.category))) {
      return NextResponse.json({ error: 'هذه الفئة لا تُخاطَب' }, { status: 409 });
    }
    const patch: Record<string, unknown> = { status: to, updated_at: now };
    const col = STAMP[to];
    if (col) patch[col] = now;
    if (to === 'do_not_contact') {
      const reason = cut(b.reason, 500);
      if (!reason) return NextResponse.json({ error: 'سبب «لا تتواصل» مطلوب' }, { status: 400 });
      patch.dnc_reason = reason; patch.dnc_by = 'د. عبدالحكيم المرضي'; patch.dnc_at = now;
    }
    // مشروطٌ بالحالة المقروءة: ضغطتان لا تنقلان مرتين، ولا يُداس انتقالٌ سبق
    const { data: done, error } = await sb.from('contract_awards').update(patch)
      .eq('id', id).eq('status', cur.status).select('id, status');
    if (error) return NextResponse.json({ error: 'لم يُحفظ الانتقال — ' + error.message }, { status: 500 });
    if (!done?.length) return NextResponse.json({ error: 'تغيّرت حالتها للتوّ — أعد التحميل' }, { status: 409 });
    return NextResponse.json({ ok: true, status: to });
  }

  // تعديل حقول
  const f = (b.fields && typeof b.fields === 'object') ? b.fields as Record<string, unknown> : {};
  const patch: Record<string, unknown> = { updated_at: now };
  const text: Array<[string, number]> = [['company_name', 200], ['cr_number', 20], ['tender_title', 400], ['buyer_entity', 200],
    ['decision_maker_name', 120], ['decision_maker_role', 120], ['contact_email', 160], ['contact_phone', 40], ['contact_whatsapp', 40], ['notes', 4000],
    ['phone_source', 160], ['phone_source_url', 600], ['email_source', 160], ['email_source_url', 600]];
  for (const [k, n] of text) if (f[k] !== undefined) patch[k] = cut(f[k], n) || null;
  if (f.category !== undefined) {
    if (!CATEGORIES.includes(String(f.category))) return NextResponse.json({ error: 'فئة غير معروفة' }, { status: 400 });
    patch.category = String(f.category);
  }
  if (f.is_subcontract !== undefined) patch.is_subcontract = f.is_subcontract === true || f.is_subcontract === 'true';
  if (f.contact_channel !== undefined) patch.contact_channel = CHANNELS.includes(String(f.contact_channel)) ? String(f.contact_channel) : null;
  if (f.contract_value !== undefined) {
    const v = f.contract_value === '' || f.contract_value == null ? null : Number(String(f.contract_value).replace(/[,٬\s]/g, ''));
    if (v !== null && !Number.isFinite(v)) return NextResponse.json({ error: 'قيمة العقد غير صحيحة' }, { status: 400 });
    patch.contract_value = v;
  }
  if (f.awarded_at !== undefined) {
    const d = cut(f.awarded_at, 10);
    if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) return NextResponse.json({ error: 'تاريخ الترسية بصيغة YYYY-MM-DD' }, { status: 400 });
    patch.awarded_at = d || null;
  }
  if (patch.company_name === null) return NextResponse.json({ error: 'اسم الشركة لا يُفرَّغ' }, { status: 400 });
  // المصدر المقبول: ما نشرته المنشأة نفسها أو سجلٌّ رسمي — ورابطه
  for (const k of ['phone_source_url', 'email_source_url']) {
    if (patch[k] && !isUrl(patch[k])) return NextResponse.json({ error: 'رابط المصدر يبدأ بـ https://' }, { status: 400 });
  }
  if (patch.contact_email && !patch.email_source_url && f.email_source_url === undefined) {
    const { data: e } = await sb.from('contract_awards').select('email_source_url').eq('id', id).maybeSingle();
    if (!e?.email_source_url) return NextResponse.json({ error: 'البريد يحتاج مصدره المنشور ورابطه' }, { status: 400 });
  }
  const { data: done, error } = await sb.from('contract_awards').update(patch).eq('id', id).select('id');
  if (error) return NextResponse.json({ error: 'لم يُحفظ — ' + dbError(error.message) }, { status: /chk/.test(error.message) ? 400 : 500 });
  if (!done?.length) return NextResponse.json({ error: 'لم يُحدَّث شيء' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
