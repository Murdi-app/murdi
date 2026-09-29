import { createHash } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

// أفعال Codex الثلاثة — تعريفٌ واحد يستعمله بابا REST (`/api/awards/…`) وأدوات الإضافة (`/api/mcp`).
// التوصية تُحفظ فقط (ببصمةٍ فلا تتكرر)، والكتابة المباشرة في حقلي الأولوية والتعليم وحدهما.

export type ActionResult = { status: number; json: Record<string, unknown> };

export const REC_KINDS = ['decision_maker', 'contact', 'hypothesis', 'service', 'next_reply', 'drop', 'subcontractor', 'template'];
export const CODEX_FLAGS = ['dhai_task', 'needs_dr', 'none'];
const NEEDS_EVIDENCE = ['decision_maker', 'contact', 'subcontractor', 'drop'];
const isUrl = (u: unknown) => /^https?:\/\/\S+$/i.test(String(u ?? ''));
// JSON ثابت الترتيب — فالقيمة نفسها بترتيب مفاتيح مختلف بصمةٌ واحدة
const stable = (v: unknown): string => Array.isArray(v) ? '[' + v.map(stable).join(',') + ']'
  : v && typeof v === 'object' ? '{' + Object.keys(v as object).sort().map((k) => JSON.stringify(k) + ':' + stable((v as Record<string, unknown>)[k])).join(',') + '}'
  : JSON.stringify(v ?? null);
const out = (status: number, json: Record<string, unknown>): ActionResult => ({ status, json });

export async function submitRecommendation(sb: SupabaseClient, b: Record<string, unknown> | null): Promise<ActionResult> {
  if (!b) return out(400, { error: 'JSON غير صالح' });
  const awardId = String(b.award_id || '');
  const kind = String(b.kind || '');
  const value = b.value;
  const evidence = Array.isArray(b.evidence) ? b.evidence.map(String).filter(isUrl).slice(0, 20) : [];
  const confidence = b.confidence === undefined || b.confidence === null ? null : Number(b.confidence);
  if (!/^[0-9a-f-]{36}$/i.test(awardId)) return out(400, { error: 'award_id مطلوب' });
  if (!REC_KINDS.includes(kind)) return out(400, { error: 'kind من: ' + REC_KINDS.join(' · ') });
  if (!value || typeof value !== 'object' || Array.isArray(value)) return out(400, { error: 'value كائن JSON' });
  if (confidence !== null && !(confidence >= 0 && confidence <= 1)) return out(400, { error: 'confidence بين 0 و1' });
  if (NEEDS_EVIDENCE.includes(kind) && !evidence.length) return out(400, { error: 'هذا النوع يحتاج رابط دليلٍ واحداً على الأقل' });
  if (kind === 'contact' && !isUrl((value as Record<string, unknown>).source_url)) return out(400, { error: 'وسيلة التواصل تحتاج source وsource_url (ما نشرته المنشأة أو سجلٌّ رسمي)' });

  const { data: a, error: aErr } = await sb.from('contract_awards').select('id').eq('id', awardId).maybeSingle();
  if (aErr) return out(500, { error: aErr.message });
  if (!a) return out(404, { error: 'الفرصة غير موجودة' });

  const fingerprint = createHash('sha256').update(awardId + '|' + kind + '|' + stable(value)).digest('hex');
  const { data: prior } = await sb.from('award_recommendations').select('id, status').eq('fingerprint', fingerprint).maybeSingle();
  if (prior) return out(200, { ok: true, duplicate: true, id: prior.id, status: prior.status });
  const { data, error } = await sb.from('award_recommendations')
    .insert({ award_id: awardId, kind, value, evidence, confidence, fingerprint }).select('id, status').single();
  if (error) {
    if (/duplicate|unique/i.test(error.message)) return out(200, { ok: true, duplicate: true });
    return out(500, { error: error.message });
  }
  return out(201, { ok: true, id: data.id, status: data.status });
}

export async function setCodexFields(sb: SupabaseClient, id: string, b: Record<string, unknown> | null): Promise<ActionResult> {
  if (!b) return out(400, { error: 'JSON غير صالح' });
  if (!/^[0-9a-f-]{36}$/i.test(id)) return out(400, { error: 'award_id مطلوب' });
  const reason = String(b.reason || '').trim().slice(0, 500);
  if (!reason) return out(400, { error: 'reason مطلوب' });
  const patch: Record<string, unknown> = { codex_reason: reason };
  if (b.codex_priority !== undefined && b.codex_priority !== null) {
    const p = Number(b.codex_priority);
    if (!Number.isFinite(p) || p < -50 || p > 50) return out(400, { error: 'codex_priority رقمٌ بين -50 و50' });
    patch.codex_priority = p;
  }
  if (b.codex_flag !== undefined && b.codex_flag !== null) {
    if (!CODEX_FLAGS.includes(String(b.codex_flag))) return out(400, { error: 'codex_flag من: ' + CODEX_FLAGS.join(' · ') });
    patch.codex_flag = String(b.codex_flag); patch.codex_flag_at = new Date().toISOString();
  }
  if (patch.codex_priority === undefined && patch.codex_flag === undefined) return out(400, { error: 'codex_priority أو codex_flag' });
  const { data, error } = await sb.from('contract_awards').update(patch).eq('id', id).select('id, codex_priority, codex_flag').maybeSingle();
  if (error) return out(500, { error: error.message });
  if (!data) return out(404, { error: 'الفرصة غير موجودة' });
  return out(200, { ok: true, ...data });
}
