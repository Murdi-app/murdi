import { createHash } from 'crypto';
import { NextResponse } from 'next/server';
import { withCodex } from '@/lib/codexAuth';

// POST /api/awards/recommendations — توصيةٌ من Codex تُحفظ في الصندوق فقط:
// لا تعدّل شيئاً ولا ترسل. يقبلها أو يرفضها بسببٍ Claude التشغيل أو المالك، والقبول
// وحده يكتب (الدالة `accept_recommendation` في القاعدة، عبر القيود القائمة).
// ولكل توصيةٍ بصمة (الفرصة + النوع + القيمة) فلا تُحفظ مرتين.

const KINDS = ['decision_maker', 'contact', 'hypothesis', 'service', 'next_reply', 'drop', 'subcontractor', 'template'];
const NEEDS_EVIDENCE = ['decision_maker', 'contact', 'subcontractor', 'drop'];
const isUrl = (u: unknown) => /^https?:\/\/\S+$/i.test(String(u ?? ''));
// JSON ثابت الترتيب — فالقيمة نفسها بترتيب مفاتيح مختلف بصمةٌ واحدة
const stable = (v: unknown): string => Array.isArray(v) ? '[' + v.map(stable).join(',') + ']'
  : v && typeof v === 'object' ? '{' + Object.keys(v as object).sort().map((k) => JSON.stringify(k) + ':' + stable((v as Record<string, unknown>)[k])).join(',') + '}'
  : JSON.stringify(v ?? null);

export async function POST(req: Request) {
  return withCodex(req, '/api/awards/recommendations', async ({ sb }) => {
    const b = await req.json().catch(() => null) as Record<string, unknown> | null;
    if (!b) return NextResponse.json({ error: 'JSON غير صالح' }, { status: 400 });
    const awardId = String(b.award_id || '');
    const kind = String(b.kind || '');
    const value = b.value;
    const evidence = Array.isArray(b.evidence) ? b.evidence.map(String).filter(isUrl).slice(0, 20) : [];
    const confidence = b.confidence === undefined || b.confidence === null ? null : Number(b.confidence);
    if (!/^[0-9a-f-]{36}$/i.test(awardId)) return NextResponse.json({ error: 'award_id مطلوب' }, { status: 400 });
    if (!KINDS.includes(kind)) return NextResponse.json({ error: 'kind من: ' + KINDS.join(' · ') }, { status: 400 });
    if (!value || typeof value !== 'object' || Array.isArray(value)) return NextResponse.json({ error: 'value كائن JSON' }, { status: 400 });
    if (confidence !== null && !(confidence >= 0 && confidence <= 1)) return NextResponse.json({ error: 'confidence بين 0 و1' }, { status: 400 });
    if (NEEDS_EVIDENCE.includes(kind) && !evidence.length) return NextResponse.json({ error: 'هذا النوع يحتاج رابط دليلٍ واحداً على الأقل' }, { status: 400 });
    if (kind === 'contact' && !isUrl((value as Record<string, unknown>).source_url)) return NextResponse.json({ error: 'وسيلة التواصل تحتاج source وsource_url (ما نشرته المنشأة أو سجلٌّ رسمي)' }, { status: 400 });

    const { data: a, error: aErr } = await sb.from('contract_awards').select('id').eq('id', awardId).maybeSingle();
    if (aErr) return NextResponse.json({ error: aErr.message }, { status: 500 });
    if (!a) return NextResponse.json({ error: 'الفرصة غير موجودة' }, { status: 404 });

    const fingerprint = createHash('sha256').update(awardId + '|' + kind + '|' + stable(value)).digest('hex');
    const { data: prior } = await sb.from('award_recommendations').select('id, status').eq('fingerprint', fingerprint).maybeSingle();
    if (prior) return NextResponse.json({ ok: true, duplicate: true, id: prior.id, status: prior.status });
    const { data, error } = await sb.from('award_recommendations')
      .insert({ award_id: awardId, kind, value, evidence, confidence, fingerprint }).select('id, status').single();
    if (error) {
      if (/duplicate|unique/i.test(error.message)) return NextResponse.json({ ok: true, duplicate: true }, { status: 200 });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, id: data.id, status: data.status }, { status: 201 });
  });
}
