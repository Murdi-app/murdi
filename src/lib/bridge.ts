import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { verifyGithubOidc } from '@/lib/githubOidc';

// جسر GitHub الخاص لقناة الفائزين — ما يُنشر في المستودع وما يُقرأ منه.
// ★ البطاقة المنشورة بلا أسرار ولا بيانات عملاء حساسة: لا أرقام هواتف ولا عناوين بريد (بل وجودها
//   ومصدرها وتحقّقها)، ولا نصوص الرسائل ولا الملاحظات الداخلية ولا أسباب «لا تتواصل».
// ★ ولا يُرسل من الجسر شيءٌ لأحد: بابان فقط — قراءة البطاقات، وتوصياتٌ تُحفظ في الصندوق للمراجعة.

export const BRIDGE_CURSOR = 'github-bridge';
export const admin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string);

/** يتحقق من هوية تشغيل الجسر (OIDC) وأن الجسر مفعَّل — وإلا يرمي برسالةٍ تُسجَّل */
export async function bridgeAuth(req: Request, sb: SupabaseClient) {
  const { data } = await sb.from('award_settings').select('key, value').in('key', ['bridge_repo', 'bridge_enabled']);
  const s = Object.fromEntries((data || []).map((r) => [String(r.key), String(r.value)]));
  if (s.bridge_enabled !== 'true') throw new Error('الجسر موقوف (bridge_enabled)');
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  return verifyGithubOidc(token, s.bridge_repo || '');
}

type Item = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/** بطاقة الفرصة للمستودع — من قراءة Codex نفسها (readFeed) بعد نزع الحساس */
export function toBridgeCard(i: Item) {
  const a = i.award || {}, c = i.contacts || {};
  return {
    id: i.id, updated_at: i.updated_at,
    award: {
      company_name: a.company_name, tender_title: a.tender_title, buyer_entity: a.buyer_entity, category: a.category,
      contract_value: a.contract_value, awarded_at: a.awarded_at, bids_opened_at: a.bids_opened_at, source: a.source,
      source_link: /^https?:\/\//.test(String(a.source_ref || '')) ? a.source_ref : null,
      is_subcontract: a.is_subcontract, main_contractor: a.main_contractor, parent_award_id: a.parent_award_id,
      listed_market: a.listed_market, drop_suggested: a.drop_suggested,
    },
    status: i.status,
    pipeline: i.pipeline,
    decision_maker: i.decision_maker,
    contacts: {
      has_phone: !!(c.phone || c.whatsapp), phone_source: c.phone_source, phone_source_url: c.phone_source_url, phone_check: c.phone_check,
      has_email: !!c.email, email_source: c.email_source, email_source_url: c.email_source_url,
    },
    qualification: i.qualification, funnel: i.funnel,
    consultation: i.offer?.consultation ? { status: i.offer.consultation.status, generated_at: i.offer.consultation.generated_at, released_at: i.offer.consultation.released_at } : null,
    codex: i.codex,
    touches: (i.touches || []).map((t: Item) => ({
      at: t.created_at, channel: t.channel, direction: t.direction, actor: t.actor, outcome: t.outcome, subject: t.subject,
      said: t.said, objection: t.objection, objection_important: t.objection_important, appointment_at: t.appointment_at, next_step: t.next_step,
    })),
    recommendations: (i.recommendations || []).map((r: Item) => ({
      id: r.id, kind: r.kind, value: r.value, confidence: r.confidence, status: r.status, reason: r.reason,
      decided_by: r.decided_by, decided_at: r.decided_at, applied: r.applied, created_at: r.created_at,
    })),
    tasks: i.tasks,
  };
}
