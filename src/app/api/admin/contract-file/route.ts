import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/requireAdmin';
import {
  normalizeContract, computeContract, contractScenarios, fundingStructure,
  type ContractInputs, type AwarderKind,
} from '@/lib/contractCompute';
import { buildContractFile, CONTRACT_CSS, type ContractDoor } from '@/lib/contractGenerate';

// توليد «ملف العقد الائتماني» — مخرَج خدمة تمويل العقد.
//
// ولا نداء لنموذج لغوي فيه: كل حرفٍ في الوثيقة محسوبٌ من مدخلات العقد
// المحفوظة. فهو يخرج في ثوانٍ وبلا كلفة، ويُعاد توليده كلما صحّح المكتب رقماً.
//
// ويُكتب في `admin_deliverable` بحالة in_progress كما يفعل الحكم الائتماني:
// لا يخرج إلى حساب العميل قبل أن تُقرأ وتُسلَّم بيدك. فوثيقةٌ عليها توقيعك
// لا تُنشر بضغطة توليد.

const admin = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  );

// أدوات العقد وحدها — ضمانات واعتمادات وتسييل ذمم ورأس مال عامل.
// وقرضُ توسعةٍ لا محلّ له هنا مهما كان حكمه عالياً: المطابق لعقدٍ ليس
// المطابق لمنشأة، وسردُ ما لا يخدم اللحظة يُغري بطَرقه فيُفسد الملف.
const RELEVANT = /ضمان|ضمانات|كفال|اعتماد|مستند|ذمم|فاتور|فواتير|مستخلص|رأس مال عامل|تشغيل|تورّ?يد|سلسلة|LC|LG|guarantee|invoice|factoring|working capital/i;

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return NextResponse.json({ error: denied }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const requestId = String(b?.requestId || '');
  if (!requestId) return NextResponse.json({ error: 'requestId مطلوب' }, { status: 400 });

  const sb = admin();

  const { data: sr } = await sb
    .from('service_requests')
    .select('id, company_id, service_title, status')
    .eq('id', requestId)
    .maybeSingle();
  if (!sr) return NextResponse.json({ error: 'الطلب غير موجود' }, { status: 404 });

  const { data: co } = await sb
    .from('companies')
    .select('company_name, cr_number, city, sector, owner_name')
    .eq('id', sr.company_id)
    .maybeSingle();
  if (!co) return NextResponse.json({ error: 'المنشأة غير موجودة' }, { status: 404 });

  // المدخلات تُقرأ من المحفوظ لا من نداء المتصفح: الوثيقة يجب أن تطابق ما
  // اعتمده المكتب، لا ما كان على الشاشة لحظة الضغط.
  const { data: si } = await sb
    .from('service_inputs')
    .select('inputs, activity_kind')
    .eq('service_request_id', requestId)
    .maybeSingle();

  const saved = (si?.inputs || {}) as Record<string, unknown>;
  if (!Number.isFinite(Number(saved.value)) || Number(saved.value) <= 0) {
    return NextResponse.json(
      { error: 'لم تُحفظ مدخلات العقد بعد — احفظها أولاً ثم ولّد' },
      { status: 422 }
    );
  }

  // الحقول تُقرأ واحداً واحداً لا بحرفٍ يُلقى على النوع: ما في jsonb أتى من
  // شاشة، وقد يأتي غداً من نموذج العميل نفسه. فالقراءة الصريحة تحرس النوع
  // وتحرس الحساب معاً، وnormalizeContract يتكفّل بعد ذلك بالمدى.
  const KINDS: AwarderKind[] = ['gov', 'semi', 'large', 'private'];
  const kind = KINDS.find((k: AwarderKind) => k === String(saved.awarderKind || ''));
  // والمجهول لا يُقرأ سماحاً: الافتراض الصامت بالسماح هو ما يرشّح باباً مقفلاً
  const ASSIGNS = ['yes', 'no', 'unknown'] as const;
  const assign = ASSIGNS.find((k: (typeof ASSIGNS)[number]) => k === String(saved.assignAllowed || ''));
  const i: ContractInputs = normalizeContract({
    value: Number(saved.value),
    months: Number(saved.months),
    advancePct: Number(saved.advancePct),
    retentionPct: Number(saved.retentionPct),
    costPct: Number(saved.costPct),
    collectDelay: Number(saved.collectDelay),
    advanceRecoverPct: Number(saved.advanceRecoverPct),
    perfBondPct: Number(saved.perfBondPct),
    bidBondPct: Number(saved.bidBondPct),
    cashCoverPct: Number(saved.cashCoverPct),
    penaltyPct: Number(saved.penaltyPct),
    awarderName: String(saved.awarderName || '').slice(0, 160),
    awarderKind: kind,
    awarded: saved.awarded !== false,
    assignAllowed: assign,
    elapsed: Number(saved.elapsed),
  });
  const pack = computeContract(i);
  const scen = contractScenarios(i);
  const legs = fundingStructure(i, pack);

  // الجهات من مطابقة مسار التمويل إن كانت قد شُغِّلت — ولا تُشغَّل من هنا.
  // ومحرّك المطابقة لا يُمَسّ من هذا المسار بأي حال.
  const { data: rows } = await sb
    .from('match_results')
    .select('provider, product, instrument, amount_range, timeline, apply_channel, verdict, gaps, fit_score')
    .eq('company_id', sr.company_id)
    .eq('status', 'new')
    // مسار التمويل وحده: صفوف الجدوى لعميلٍ آخر لا تدخل ملف عقده
    .eq('track', 'funding')
    .gte('fit_score', 30)
    .order('fit_score', { ascending: false });

  const kept: ContractDoor[] = (rows || []).filter((r: ContractDoor) => {
    if (/غير مناسب|مستبعد/.test(String(r.verdict || ''))) return false;
    return RELEVANT.test(String(r.product || '') + ' ' + String(r.instrument || ''));
  });

  // الجهة تُذكر مرة واحدة بأعلى صفوفها حكماً — والصفوف مرتَّبة نازلةً،
  // فأولُ ما يَرد من الجهة هو أقواها. والعميل يعدّ الجهات لا الصفوف.
  const byProvider = new Map<string, ContractDoor>();
  for (const r of kept) {
    const key = String(r.provider || '').trim();
    if (key === '') continue;
    if (!byProvider.has(key)) byProvider.set(key, r);
  }
  const doors = [...byProvider.values()].slice(0, 15);

  const inner = buildContractFile(co, i, pack, scen, legs, doors);
  const html = '<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<title>ملف العقد الائتماني — ' + String(co.company_name || '') + '</title>'
    + '<style>' + CONTRACT_CSS + '</style></head><body>' + inner + '</body></html>';

  const { error } = await sb
    .from('service_requests')
    .update({ admin_deliverable: html, status: 'in_progress', updated_at: new Date().toISOString() })
    .eq('id', requestId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await sb.from('deal_events').insert({
    company_id: sr.company_id,
    kind: 'service',
    title: 'جُهِّز ملف العقد الائتماني',
    detail: 'فجوة ' + Math.round(pack.gap).toLocaleString('en-US') + ' ريال · '
      + doors.length + ' جهة · بانتظار مراجعتك قبل التسليم',
    actor: 'owner',
    needs_owner: true,
  });

  return NextResponse.json({ ok: true, html, doors: doors.length, gap: Math.round(pack.gap) });
}
