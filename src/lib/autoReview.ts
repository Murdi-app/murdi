import type { SupabaseClient } from '@supabase/supabase-js';
import { num } from '@/lib/awards';
import { loadConfig } from '@/lib/awards';

// المراجعة الآلية لتوصيات Codex — تعمل في دورة القناة كل ربع ساعة، فلا تنتظر أحداً.
// ★ تحسم ما يحسمه المنطق وحده، وتترك للإنسان ما يحتاج حكماً:
//   · فرضية وسؤال · خدمة مقترحة · رد تالٍ (لا تكتب وسيلة تواصل ولا ترسل): تُقبل إن بلغت الثقة الحدّ.
//   · وسيلة تواصل · صاحب قرار: تُقبل إن كانت كل أدلتها ورابط مصدرها من نطاقاتٍ رسمية موثوقة
//     (award_settings.auto_review_trusted_domains) وبلغت الثقة حدّها الأعلى.
//   · إسقاط · مقاول باطن · تحسين قالب: لا تُحسم آلياً أبداً — تنتظر Claude التشغيل أو المالك.
// ★ والقبول بالدالة نفسها (accept_recommendation) عبر القيود القائمة؛ وما رفضته القاعدة (مثلاً
//   منشأة «لا تتواصل») يُرفض بسببه.

const ACTOR = 'المراجعة الآلية (قواعد)';
const SOFT = ['hypothesis', 'service', 'next_reply'];
const CONTACT = ['contact', 'decision_maker'];

const hostOk = (u: string, domains: string[]) => {
  try { const h = new URL(u).hostname.toLowerCase(); return domains.some((d) => h === d || h.endsWith('.' + d)); }
  catch { return false; }
};

export async function autoReview(sb: SupabaseClient): Promise<{ accepted: number; rejected: number; waiting: number }> {
  const { settings } = await loadConfig(sb);
  if (String(settings.auto_review_enabled || '') !== 'true') return { accepted: 0, rejected: 0, waiting: 0 };
  const minSoft = num(settings, 'auto_review_min_confidence') ?? 0.6;
  const minContact = num(settings, 'auto_review_contact_min_confidence') ?? 0.8;
  const domains = String(settings.auto_review_trusted_domains || '').split(',').map((d) => d.trim().toLowerCase()).filter(Boolean);
  const { data, error } = await sb.from('award_recommendations').select('id, kind, value, evidence, confidence').eq('status', 'pending').order('created_at').limit(100);
  if (error) throw new Error(error.message);
  let accepted = 0, rejected = 0, waiting = 0;
  for (const r of data || []) {
    const conf = r.confidence === null || r.confidence === undefined ? 0 : Number(r.confidence);
    let why: string | null = null;
    if (SOFT.includes(r.kind) && conf >= minSoft) {
      why = 'قبولٌ آلي: ' + r.kind + ' لا يكتب وسيلة تواصل ولا يرسل، والثقة ' + conf + ' ≥ ' + minSoft;
    } else if (CONTACT.includes(r.kind) && conf >= minContact) {
      const urls = [...(r.evidence || []), ...(r.kind === 'contact' ? [String((r.value || {}).source_url || '')] : [])].filter(Boolean);
      if (urls.length && urls.every((u: string) => hostOk(u, domains))) why = 'قبولٌ آلي: كل الأدلة من مصادر رسمية موثوقة (' + [...new Set(urls.map((u: string) => new URL(u).hostname))].join('، ') + ') والثقة ' + conf;
    }
    if (!why) { waiting++; continue; }
    const { error: aErr } = await sb.rpc('accept_recommendation', { rec: r.id, by_name: ACTOR, why });
    if (!aErr) { accepted++; continue; }
    // ما رفضته القاعدة نفسها (لا تتواصل · مصدرٌ ناقص · حُسمت من قبل) يُرفض بسببه — لا يبقى معلّقاً
    const { error: rErr } = await sb.rpc('reject_recommendation', { rec: r.id, by_name: ACTOR, why: 'رفضته القاعدة: ' + aErr.message });
    if (!rErr) rejected++;
  }
  return { accepted, rejected, waiting };
}
