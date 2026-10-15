import type { SupabaseClient } from '@supabase/supabase-js';

// ═══ قسمة العملاء بين الموظفتين (١٤ أكتوبر، المالك) ═══
// «وزّع العملاء بالمناصفة بينهم، وخلّهم يشوفون عملاء بعض كاسم فقط».
// ★ كل عميل له صاحبة واحدة تمسكه من أول اتصال إلى فتح الملف — برقمها — فلا يراسله رقمان.
// ★ والعميل الواحد يبقى عند صاحبته وإن ظهر له صفٌّ ثانٍ (طلب ثم ملف مسعَّر، أو تقييم ثم طلب):
//   يُطابَق بآخر ٩ أرقام من الجوال.
// ★ والقسمة متوازنة على المجموع: كل عميلٍ جديد يذهب لمن عندها أقل.

export type Owner = { id: string; name: string };
export const phone9 = (p: string | null | undefined) => String(p || '').replace(/\D/g, '').slice(-9) || null;
const key = (s: string, r: string) => s + '|' + r;

export async function staffPool(sb: SupabaseClient): Promise<Owner[]> {
  const { data } = await sb.from('staff').select('user_id, name, job, active').eq('active', true).in('job', ['followup', 'assistant']);
  // ضي (followup) أولاً عند التعادل
  return (data || []).sort((a, b) => (a.job === 'followup' ? -1 : 1) - (b.job === 'followup' ? -1 : 1))
    .map((s) => ({ id: String(s.user_id), name: String(s.name || '') }));
}

export async function assignOwners(
  sb: SupabaseClient,
  rows: { source: string; ref_id: string; phone: string | null; at: string | null }[],
): Promise<{ owners: Map<string, string>; pool: Owner[] }> {
  const pool = await staffPool(sb);
  const owners = new Map<string, string>();
  if (!pool.length || !rows.length) return { owners, pool };
  const poolIds = new Set(pool.map((p) => p.id));

  const refs = Array.from(new Set(rows.map((r) => r.ref_id)));
  const phones = Array.from(new Set(rows.map((r) => phone9(r.phone)).filter(Boolean))) as string[];
  const byPhone = new Map<string, string>();
  for (let i = 0; i < refs.length; i += 200) {
    const { data } = await sb.from('lead_owners').select('source, ref_id, owner, phone9').in('ref_id', refs.slice(i, i + 200));
    for (const o of data || []) if (poolIds.has(String(o.owner))) {
      owners.set(key(o.source, o.ref_id), String(o.owner));
      if (o.phone9) byPhone.set(String(o.phone9), String(o.owner));
    }
  }
  for (let i = 0; i < phones.length; i += 200) {
    const { data } = await sb.from('lead_owners').select('owner, phone9').in('phone9', phones.slice(i, i + 200));
    for (const o of data || []) if (poolIds.has(String(o.owner)) && !byPhone.has(String(o.phone9))) byPhone.set(String(o.phone9), String(o.owner));
  }

  const count = new Map<string, number>();
  await Promise.all(pool.map(async (p) => {
    const { count: n } = await sb.from('lead_owners').select('*', { count: 'exact', head: true }).eq('owner', p.id);
    count.set(p.id, n || 0);
  }));

  const fresh = rows.filter((r) => !owners.has(key(r.source, r.ref_id)))
    .sort((a, b) => String(a.at || '').localeCompare(String(b.at || '')));
  const ins: { source: string; ref_id: string; owner: string; phone9: string | null }[] = [];
  for (const r of fresh) {
    const ph = phone9(r.phone);
    let o = ph ? byPhone.get(ph) : undefined;
    if (!o) o = [...pool].sort((a, b) => (count.get(a.id) || 0) - (count.get(b.id) || 0))[0].id;
    owners.set(key(r.source, r.ref_id), o);
    if (ph) byPhone.set(ph, o);
    count.set(o, (count.get(o) || 0) + 1);
    ins.push({ source: r.source, ref_id: r.ref_id, owner: o, phone9: ph });
  }
  for (let i = 0; i < ins.length; i += 200) {
    await sb.from('lead_owners').upsert(ins.slice(i, i + 200), { onConflict: 'source,ref_id', ignoreDuplicates: true });
  }
  return { owners, pool };
}

/** صاحبة العميل — أو null إن لم يُقسم بعد. */
export async function ownerOf(sb: SupabaseClient, source: string, refId: string): Promise<string | null> {
  const { data } = await sb.from('lead_owners').select('owner').eq('source', source).eq('ref_id', refId).maybeSingle();
  return data?.owner ? String(data.owner) : null;
}

// ═══ العميل يسمع اسم صاحبته هي (١٥ أكتوبر) ═══
// كانت رسالة الأسئلة كلها «معك ضي» والاستشارة «تواصلوا مع زميلتنا ضي» — فعملاء رغد
// يُكلَّمون من رغد ويُقال لهم ضي. فيُبدَّل الاسم (والرقم إن عُرف) عند العرض لا عند التوليد،
// فيصحّ ما كُتب قبل القسمة وما يُكتب بعدها.
// رقم واتساب كل موظفة في app_config.staff_wa = { "<user_id>": "9665…" } — ومن لا رقم لها يبقى رقم الشركة.
export const COMPANY_WA = '966570749196';
export type Contact = { name: string; wa: string | null };

export async function staffContacts(sb: SupabaseClient): Promise<Map<string, Contact>> {
  const [{ data: st }, { data: cfg }] = await Promise.all([
    sb.from('staff').select('user_id, name').eq('active', true),
    sb.from('app_config').select('value').eq('key', 'staff_wa').maybeSingle(),
  ]);
  let wa: Record<string, string> = {};
  try { const v = typeof cfg?.value === 'string' ? JSON.parse(cfg.value) : cfg?.value; if (v && typeof v === 'object') wa = v; } catch { wa = {}; }
  return new Map((st || []).map((s) => [String(s.user_id), {
    name: String(s.name || '').trim().split(/\s+/)[0] || 'ضي',
    wa: /^9665\d{8}$/.test(String(wa[String(s.user_id)] || '')) ? String(wa[String(s.user_id)]) : null,
  }]));
}

/** يجعل نصّاً موجّهاً للعميل باسم صاحبته ورقمها */
export function asOwner(text: string, c: Contact | null | undefined): string {
  if (!text || !c) return text;
  let t = text.split('معك ضي من').join('معك ' + c.name + ' من')
    .split('زميلتنا <strong>ضي</strong>').join('زميلتنا <strong>' + c.name + '</strong>');
  if (c.wa) t = t.split('wa.me/' + COMPANY_WA).join('wa.me/' + c.wa);
  return t;
}

/** يُسنَد العميل لمن عملت عليه إن لم يكن له صاحبة. */
export async function claim(sb: SupabaseClient, source: string, refId: string, owner: string, phone?: string | null) {
  await sb.from('lead_owners').upsert({ source, ref_id: refId, owner, phone9: phone9(phone) }, { onConflict: 'source,ref_id', ignoreDuplicates: true });
}
