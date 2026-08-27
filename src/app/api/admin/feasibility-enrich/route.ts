import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { gradeEvidence, blockerFound } from '@/lib/matchEngine';
import { logError } from '@/lib/logError';
import { requireAdmin } from '@/lib/requireAdmin';

export const maxDuration = 300;
export const runtime = 'nodejs';

const CHUNK = 8;   // جهات لكل دفعة
const TOP = 24;    // لا معنى لكتابة خطوات التقديم لجهة لن يطرقها أحد

// إثراء جهات دراسة الجدوى: يملأ قناة التقديم والمستندات المطلوبة لأعلى الصفوف.
// مسار 'feasibility' وحده — لا يقرأ ولا يكتب صفاً من مساري التمويل أو الاستثمار.
export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return NextResponse.json({ error: denied }, { status: 401 });

  let companyId = '';
  let offset = 0;
  try {
    const b = await req.json();
    companyId = String(b.company_id || '');
    offset = Number(b.offset) || 0;
  } catch { return NextResponse.json({ error: 'طلب غير صالح' }, { status: 400 }); }
  if (!companyId) return NextResponse.json({ error: 'company_id مطلوب' }, { status: 400 });
  if (offset >= TOP) return NextResponse.json({ ok: true, done: true, next: offset, top: TOP });

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  );

  const { data: rows } = await admin.from('match_results')
    .select('id, provider, product')
    .eq('company_id', companyId).eq('track', 'feasibility').eq('status', 'new').gt('fit_score', 0)
    .order('fit_score', { ascending: false }).range(offset, offset + CHUNK - 1);

  if (!rows || !rows.length) return NextResponse.json({ ok: true, done: true, next: offset, top: TOP });

  const list = rows.map((r, i) => (i + 1) + ') ' + r.provider + ' — ' + (r.product || '')).join('\n');
  const prompt = 'أنت مستشار تمويل سعودي. لكل جهة ومنتج أدناه ابحث في الويب عن طريقة التقديم الفعلية اليوم.\n\n'
    + list + '\n\n'
    + 'لكل رقم أرجع كائناً فيه: applyChannel (بوابة إلكترونية أو إدارة منشآت أو مدير علاقات أو فرع أو وكيل أو بريد)، '
    + 'applyUrl (رابط التقديم المباشر أو null — لا تخترع رابطاً)، '
    + 'applySteps (خطوات مرقّمة ينفّذها موظف لا يعرف الجهة)، '
    + 'requiredDocs (المستندات المطلوبة لهذا المنتج تحديداً، مفصولة بفواصل).\n'
    + 'ملاحظة عن العميل: طالب التمويل هنا مشروع جديد أو توسعة، فاذكر في requiredDocs المستندات التي تطلبها الجهة '
    + 'من مشروع تحت التأسيس تحديداً — دراسة جدوى، عرض أسعار معدات، عقد إيجار، سجل تجاري، هوية المؤسس — '
    + 'ولا تكتب مستندات لا يملكها مشروع لم يبدأ إلا إذا كانت الجهة تشترطها فعلاً، فتُذكر بوصفها شرطاً لا خياراً.\n'
    + 'قواعد صدق إلزامية — الحقل الفارغ أشرف من معلومة مؤلّفة:\n'
    + '1. ممنوع تأليف اسم وكيل أو شريك محلي. إن لم تتحقق منه من مصدر رسمي فاكتب «الوكيل المعتمد (يلزم التحقق)».\n'
    + '2. ممنوع تأليف بريد أو رابط. لا تكتب إلا ما رأيته على الموقع الرسمي، وإلا فاترك applyUrl فارغاً.\n'
    + '3. ممنوع التناقض: إن لم تكن هناك بوابة فلا تصف القناة بأنها بوابة.\n'
    + '4. إن كان الدخول عبر وكيل أو بنك شريك أو منصة فاذكر ذلك صراحة وسمِّ نقطة الدخول الأقرب في السعودية.\n'
    + 'وevidenceUrl: الرابط الذي يثبت ما كتبته، ويفضّل أن يكون على الموقع الرسمي للجهة؛ وإن لم تجده فاتركه فارغاً.\n'
    + 'أرجع JSON نقي فقط: {"items":[{"n":1,"applyChannel":"...","applyUrl":"...","applySteps":"...","requiredDocs":"...","evidenceUrl":"..."}]}';

  let filled = 0;
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY as string, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6', max_tokens: 8000,
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 10 }],
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const d = await res.json();
    const text = (d.content || []).map((c: { type: string; text?: string }) => c.type === 'text' ? (c.text || '') : '').join('\n');
    const m = text.match(/\{[\s\S]*\}/);
    const parsed = m ? JSON.parse(m[0]) as { items?: Record<string, unknown>[] } : { items: [] };

    for (const it of (parsed.items || [])) {
      const row = rows[Number(it.n) - 1];
      if (!row) continue;
      const ch = String(it.applyChannel || '') || null;
      const url = it.applyUrl && String(it.applyUrl) !== 'null' ? String(it.applyUrl) : null;
      const ev = it.evidenceUrl && String(it.evidenceUrl) !== 'null' ? String(it.evidenceUrl) : undefined;
      const blk = blockerFound(String(it.applyChannel || '') + ' ' + String(it.applySteps || '') + ' ' + String(it.requiredDocs || ''));
      await admin.from('match_results').update({
        apply_channel: ch,
        apply_url: url,
        apply_steps: it.applySteps ? String(it.applySteps) : null,
        required_docs: it.requiredDocs ? String(it.requiredDocs) : null,
        evidence_url: ev || null,
        evidence_grade: gradeEvidence(ev, row.provider),
        ...(blk ? { fit_score: 1, gaps: [blk] } : {}),
      }).eq('id', row.id);
      filled++;
    }
  } catch (e) {
    await logError('feasibility.enrich', e, { company_id: companyId });
    return NextResponse.json({ error: 'تعذر إثراء طرق التقديم: ' + String(e).slice(0, 140) }, { status: 500 });
  }

  const next = offset + CHUNK;
  return NextResponse.json({ ok: true, done: next >= TOP || rows.length < CHUNK, next, filled, top: TOP });
}
