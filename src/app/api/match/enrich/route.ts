import { NextResponse } from 'next/server';
import { logError } from '@/lib/logError';
import { gradeEvidence, blockerFound } from '@/lib/matchEngine';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

const CHUNK = 8;
const TOP = 50;

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({})) as { track?: string; offset?: number };
  const cookieStore = await cookies();
  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string);
  const { data: co } = await admin.from('companies').select('id, sector, city').eq('user_id', user.id).maybeSingle();

  const track = body.track === 'investment' ? 'investment' : 'funding';
  const offset = Number(body.offset) || 0;
  if (offset >= TOP) return NextResponse.json({ ok: true, done: true, next: offset });

  const rowId = String((body as { rowId?: string }).rowId || '');
  if (!rowId && !co) return NextResponse.json({ error: 'لا يوجد ملف' }, { status: 404 });
  const base = admin.from('match_results').select('id, provider, product');
  const { data: rows } = rowId
    ? await base.eq('id', rowId)
    : await base.eq('company_id', String(co?.id || '')).eq('track', track).eq('status', 'new').gt('fit_score', 0)
        .order('fit_score', { ascending: false }).range(offset, offset + CHUNK - 1);

  if (!rows || !rows.length) return NextResponse.json({ ok: true, done: true, next: offset });

  const list = rows.map((r, i) => (i + 1) + ') ' + r.provider + ' — ' + (r.product || '')).join('\n');
  const prompt = 'أنت مستشار تمويل سعودي. لكل جهة ومنتج أدناه ابحث في الويب عن طريقة التقديم الفعلية اليوم.\n\n'
    + list + '\n\n'
    + 'لكل رقم أرجع كائناً فيه: applyChannel (بوابة إلكترونية أو إدارة منشآت أو مدير علاقات أو فرع أو بريد)، '
    + 'applyUrl (رابط التقديم المباشر أو null — لا تخترع رابطاً)، '
    + 'applySteps (خطوات مرقّمة ينفّذها موظف لا يعرف الجهة: ادخل إلى كذا، اختر كذا، ارفع كذا، تابع بعد كذا)، '
    + 'requiredDocs (المستندات المطلوبة لهذا المنتج تحديداً).\n'
    + 'وgulfPresence: صف بدقة وجود الجهة في الخليج — مكتب أو فرع أو ترخيص أو شريك محلي مسمّى — وإن لم يكن لها وجود فاذكر الطريق النظامي الذي يصل به تمويلها إلى مقترض سعودي، '
    + 'وevidenceUrl: الرابط الذي يثبت ما كتبته في gulfPresence، ويفضّل أن يكون على الموقع الرسمي للجهة نفسها؛ وإن لم تجد رابطاً يثبته فاتركه فارغاً ولا تخترعه.\n'
    + 'أغلب البنوك السعودية لا تقبل طلبات التمويل بالبريد.\n'
    + 'قواعد صدق إلزامية — الحقل الفارغ أشرف من معلومة مؤلّفة:\n'
    + '1. ممنوع تأليف اسم وكيل أو موزّع أو شريك محلي. إن لم تتحقق من اسمه من مصدر رسمي فاكتب «الوكيل المعتمد (يلزم تحقق)» بلا اسم، ولا تجمع اسمين في اسم واحد.\n'
    + '2. ممنوع تأليف بريد أو رابط. لا تكتب إلا ما رأيته فعلاً على الموقع الرسمي. إن لم تجد رابطاً فاترك applyUrl فارغاً واذكر في applyChannel طريقة التواصل الرسمية المتاحة.\n'
    + '3. ممنوع التناقض: إن لم تكن هناك بوابة فلا تصف القناة بأنها بوابة.\n'
    + '4. إن كان الدخول عبر وكيل أو بنك شريك أو منصة، فاذكر ذلك صراحة وسمِّ نقطة الدخول الأقرب في السعودية أو الخليج إن تحققت منها.\n'
    + 'أرجع JSON نقي فقط: {"items":[{"n":1,"applyChannel":"...","applyUrl":"...","applySteps":"...","requiredDocs":"...","gulfPresence":"...","evidenceUrl":"..."}]}';

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
    const parsed = m ? JSON.parse(m[0]) : { items: [] };
    for (const it of (parsed.items || [])) {
      const row = rows[Number(it.n) - 1];
      if (!row) continue;
      await admin.from('match_results').update({
        apply_channel: it.applyChannel || null,
        apply_url: it.applyUrl && String(it.applyUrl) !== 'null' ? it.applyUrl : null,
        apply_steps: it.applySteps || null,
        required_docs: it.requiredDocs || null,
        gulf_presence: it.gulfPresence || null,
        evidence_url: it.evidenceUrl && String(it.evidenceUrl) !== 'null' ? it.evidenceUrl : null,
        evidence_grade: gradeEvidence(it.evidenceUrl, row.provider),
        ...(() => {
          const blk = blockerFound(String(it.applyChannel || '') + ' ' + String(it.applySteps || '') + ' ' + String(it.requiredDocs || '') + ' ' + String(it.gulfPresence || ''));
          return blk ? { fit_score: 1, gaps: [blk] } : {};
        })(),
      }).eq('id', row.id);
    }
  } catch (e) { await logError('match.enrich', e, { company_id: String(co?.id || ''), entity: track }); }

  const next = offset + CHUNK;
  return NextResponse.json({ ok: true, done: next >= TOP || rows.length < CHUNK, next });
}
