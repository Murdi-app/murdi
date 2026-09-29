import type { SupabaseClient } from '@supabase/supabase-js';

// قراءة Codex — ما تغيّر في فرص القناة منذ مؤشرٍ ما.
//
// ★ المؤشر «updated_at|id» — ترتيبٌ ثابت لا يُسقط صفّين بالوقت نفسه. وكل ما يتغيّر حول
//   الفرصة (مراسلة · توصية وقرارها · مهمة) يرفع updated_at بمشغّل القاعدة، فتعود الفرصة
//   كاملةً في القراءة التالية: بطاقةٌ واحدة بكل ما يلزم، لا أحداثٌ متفرقة.
// ★ والاستئناف: مؤشر القراءة يُحفظ في `feed_cursors` — `served` آخر ما سُلِّم، و`acked`
//   آخر مؤشرٍ طلب القارئ ما بعده (فقد استلم ما قبله). من انقطع يعيد الطلب بلا مؤشر فيأخذ
//   من `acked`: لا فقد. ومن مرّر `since` = آخر `next_since` استلمه: لا تكرار.
// ★ فرص القناة وحدها: لا بيانات عملاء المنصة الآخرين، ولا حسابات بنكية أو هويات.

const PAGE = 100;

export type FeedPage = { items: unknown[]; next_since: string | null; has_more: boolean; since: string | null };

function parseCursor(c: string | null): { ts: string; id: string } | null {
  if (!c) return null;
  const [ts, id] = c.split('|');
  if (!ts || Number.isNaN(Date.parse(ts))) return null;
  return { ts, id: /^[0-9a-f-]{36}$/i.test(id || '') ? id : '00000000-0000-0000-0000-000000000000' };
}

export async function readFeed(sb: SupabaseClient, since: string | null): Promise<FeedPage> {
  const cur = parseCursor(since);
  let q = sb.from('contract_awards').select('*').order('updated_at', { ascending: true }).order('id', { ascending: true }).limit(PAGE + 1);
  // القيمة بين علامتي تنصيص: الوقت فيه نقاطٌ و«+» لا تُقرأ فواصل
  if (cur) q = q.or('updated_at.gt."' + cur.ts + '",and(updated_at.eq."' + cur.ts + '",id.gt.' + cur.id + ')');
  const { data, error } = await q;
  if (error) throw new Error('قراءة الفرص: ' + error.message);
  const rows = (data || []) as Record<string, unknown>[];
  const page = rows.slice(0, PAGE);
  const ids = page.map((r) => String(r.id));
  if (!ids.length) return { items: [], next_since: since, has_more: false, since };

  const [pl, tq, rq, kq, cq] = await Promise.all([
    sb.from('award_pipeline').select('id, state, responsible, next_step, next_at, overdue, score, score_why').in('id', ids),
    sb.from('award_touches').select('*').in('award_id', ids).order('created_at'),
    sb.from('award_recommendations').select('id, award_id, kind, value, evidence, confidence, status, reason, decided_by, decided_at, applied, created_at').in('award_id', ids).order('created_at'),
    sb.from('codex_tasks').select('id, award_id, kind, payload, status, created_at').in('award_id', ids).eq('status', 'open'),
    sb.from('consultations').select('award_id, status, generated_at, released_at').in('award_id', ids).eq('assessment_type', 'award_gap').order('created_at', { ascending: false }),
  ]);
  for (const r of [pl, tq, rq, kq, cq]) if (r.error) throw new Error(r.error.message);
  const by = <T extends { award_id?: unknown; id?: unknown }>(arr: T[], k: 'award_id' | 'id') => {
    const m = new Map<string, T[]>();
    for (const x of arr) { const key = String(x[k]); if (!m.has(key)) m.set(key, []); (m.get(key) as T[]).push(x); }
    return m;
  };
  const pipe = by((pl.data || []) as { id: unknown }[], 'id');
  const touches = by((tq.data || []) as { award_id: unknown }[], 'award_id');
  const recs = by((rq.data || []) as { award_id: unknown }[], 'award_id');
  const tasks = by((kq.data || []) as { award_id: unknown }[], 'award_id');
  const consults = by((cq.data || []) as { award_id: unknown }[], 'award_id');

  const items = page.map((a) => {
    const id = String(a.id);
    return {
      id, updated_at: a.updated_at,
      award: {
        company_name: a.company_name, cr_number: a.cr_number, org_key: a.org_key, source: a.source, source_ref: a.source_ref,
        tender_title: a.tender_title, buyer_entity: a.buyer_entity, category: a.category, contract_value: a.contract_value,
        awarded_at: a.awarded_at, bids_opened_at: a.bids_opened_at, is_subcontract: a.is_subcontract,
        main_contractor: a.main_contractor, parent_award_id: a.parent_award_id, listed_market: a.listed_market,
        drop_suggested: a.drop_suggested, notes: a.notes,
      },
      status: a.status, dnc_reason: a.dnc_reason,
      pipeline: (pipe.get(id) || [])[0] || null,
      decision_maker: { name: a.decision_maker_name, role: a.decision_maker_role },
      contacts: {
        phone: a.contact_phone, whatsapp: a.contact_whatsapp, phone_source: a.phone_source, phone_source_url: a.phone_source_url,
        phone_check: a.phone_check, phone_checked_at: a.phone_checked_at, phone_checked_by: a.phone_checked_by,
        email: a.contact_email, email_source: a.email_source, email_source_url: a.email_source_url,
      },
      qualification: {
        fit_service: a.fit_service, qualified_by: a.qualified_by, suggested_service: a.suggested_service,
        hypothesis: a.hypothesis, qualify_question: a.qualify_question, next_reply: a.next_reply,
      },
      funnel: {
        documented_at: a.documented_at, reached_at: a.reached_at, contacted_at: a.contacted_at, replied_at: a.replied_at,
        qualified_at: a.qualified_at, offered_at: a.offered_at, paid_at: a.paid_at, executing_at: a.executing_at,
        first_referral_at: a.first_referral_at, referrals_count: a.referrals_count, referred_by: a.referred_by,
      },
      offer: { consultation: (consults.get(id) || [])[0] || null, gap_sent_at: a.gap_sent_at, service_request_id: a.service_request_id },
      codex: { priority: a.codex_priority, flag: a.codex_flag, reason: a.codex_reason, flag_at: a.codex_flag_at },
      touches: touches.get(id) || [],
      recommendations: recs.get(id) || [],
      tasks: tasks.get(id) || [],
    };
  });
  const last = page[page.length - 1];
  return { items, next_since: String(last.updated_at) + '|' + String(last.id), has_more: rows.length > PAGE, since };
}
