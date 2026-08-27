import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { runScopedMatch, saveMatchResults } from '@/lib/matchEngine';
import { buildFeasibilityScopes, describeGate, type FzMatchProfile, type PropertyMode, type CapexKind } from '@/lib/feasibilityScopes';
import { logError } from '@/lib/logError';
import { requireAdmin } from '@/lib/requireAdmin';

export const maxDuration = 300;
export const runtime = 'nodejs';

// مطابقة جهات مستقلة لدراسة الجدوى: تبني ملفاً مالياً من مدخلات الدراسة نفسها
// فلا تحتاج تقييم تمويل ولا assessment، وتحفظ في مسار 'feasibility' وحده
export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return NextResponse.json({ error: denied }, { status: 401 });

  let companyId = '';
  let batch: number | undefined;
  try {
    const b = await req.json();
    companyId = String(b.company_id || '');
    if (b.batch !== undefined && b.batch !== null) batch = Number(b.batch) || 0;
  } catch { return NextResponse.json({ error: 'طلب غير صالح' }, { status: 400 }); }
  if (!companyId) return NextResponse.json({ error: 'company_id مطلوب' }, { status: 400 });

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  );

  try {
    const { data: company } = await admin.from('companies').select('*').eq('id', companyId).single();
    if (!company) return NextResponse.json({ error: 'المنشأة غير موجودة' }, { status: 404 });

    const { data: fz } = await admin.from('service_inputs')
      .select('inputs').eq('company_id', companyId).eq('activity_kind', 'feasibility')
      .order('updated_at', { ascending: false }).limit(1).maybeSingle();
    const raw = (fz?.inputs as Record<string, unknown> | null) || null;
    if (!raw) return NextResponse.json({ error: 'لا توجد مدخلات دراسة جدوى محفوظة لهذه المنشأة' }, { status: 400 });

    const num = (k: string) => Number(String(raw[k] ?? '').replace(/,/g, '')) || 0;
    const str = (k: string) => String(raw[k] ?? '').trim();

    const projected = num('unitPrice') * num('unitsYear1');
    const existing = num('existingRevenue');
    const isNew = str('projectKind') !== 'expansion';
    // إيراد اليوم: صفر للمشروع الجديد مهما بلغ المتوقع — وإلا اختار المحرك نطاقات الشركات القائمة
    // (وكالات ائتمان التصدير وصناديق الدين الخاص) لمنشأة لم تبع بعد
    const rev = existing > 0 ? existing : 0;
    // حجم المشروع يُقاس بالمتوقع أو بالمطلوب — وهو ما تُقاس عليه تذكرة كل جهة
    const scaleRev = existing > 0 ? existing : Math.max(projected, num('financingAmount'));

    // الملف المالي المُركَّب: كل حقل إما من المدخلات أو «غير محدد» — لا نخترع صفة للعميل
    const fd: Record<string, unknown> = {
      annual_revenue: rev,
      years_operating: isNew ? 0 : (num('existingYears') || undefined),
      funding_type: 'project',
      funding_type_other: isNew ? 'تمويل تأسيس مشروع جديد' : 'تمويل توسعة نشاط قائم',
      activity_type: 'other',
      activity_other: str('sectorText') || String(company.sector || ''),
      // الديون تُقرأ من مدخلات التوسعة لا تُفترض — وجود أقساط قائمة إقرارٌ بوجود دين
      has_debt: num('existingDebtService') > 0,
      net_profit: num('existingEbitda') > 0 ? num('existingEbitda') : undefined,
      // أصول قابلة للرهن: يُطبع نصّه كما هو، فيبقى «غير محدد» إن لم يُدخل
      has_collateral: str('collateralNote') || undefined,
      // القالب ثنائي بلا «غير معروف»: نُقرّ بالالتزام فقط حين يُصرّح به، وننبّه في وصف الطلب إن لم يُفصح
      tax_compliant: str('compliance') === 'ok',
      zakat_compliant: str('compliance') === 'ok',
      // القالب ثنائي بلا خيار «غير معروف»، فترك الحقل فارغاً يُطبع «غير ساري» — نفياً مفبركاً
      cr_valid: Boolean(company.cr_number),
      has_financial_statements: !isNew,
      // ملكية المنشأة تُقرأ من ملف الشركة إن وُجدت — تفتح ممر المستثمر الأجنبي تلقائياً
      ownership_type: company.ownership_type,
      owner_nationality: company.owner_nationality,
    };

    // ═══ البوابة: النطاقات تُبنى من خصائص المشروع لا من رقم الإيراد ═══
    const prof: FzMatchProfile = {
      ask: num('financingAmount'),
      totalInvestment: num('capex') + num('workingCapital'),
      isNew,
      // «لا يستورد» صريحةً تتقدّم على وجود نص قديم في خانة الدول
      imports: str('imports') === 'no' ? false : (str('imports') === 'yes' || Boolean(str('importCountries'))),
      importCountries: str('importCountries'),
      property: (['rent', 'buy', 'own'].includes(str('propertyMode')) ? str('propertyMode') : 'rent') as PropertyMode,
      capexKind: (['equipment', 'property', 'vehicles', 'fitout', 'tech', 'inventory', 'mixed'].includes(str('capexKind')) ? str('capexKind') : 'mixed') as CapexKind,
      foreignOwner: ['foreign', 'mixed'].includes(String(company.ownership_type || '')),
      ownerNationality: String(company.owner_nationality || ''),
      largeBuyers: Boolean(str('largeBuyers')),
      sectorText: str('sectorText') || String(company.sector || ''),
    };
    // شراء العقار خاصية مستقلة عن بند الإنفاق الأكبر — فإن كان العقار هو البند فهو شراء
    if (prof.capexKind === 'property' && prof.property === 'rent') prof.property = 'buy';
    const scopes = buildFeasibilityScopes(prof);

    // نفس تقسيم runAutoMatch: خمسة نطاقات لكل دفعة، والعميل يكرر حتى done
    const SIZE = 5;
    const from = (batch === undefined ? 0 : batch) * SIZE;
    const r = await runScopedMatch({
      company, fd,
      // الإيراد صفر للمشروع الجديد، فحجمه يُبلَّغ هنا حتى لا يقيسه النموذج على منشأة بلا حجم
      typeLabel: (isNew ? 'تمويل تأسيس مشروع جديد' : 'تمويل توسعة نشاط قائم')
        + ' — إجمالي استثمار ' + Math.round(num('capex') + num('workingCapital')).toLocaleString('en-US')
        + ' ريال، المطلوب تمويله ' + Math.round(num('financingAmount')).toLocaleString('en-US')
        + ' ريال، ومساهمة المؤسس ' + Math.round(num('ownFunds')).toLocaleString('en-US') + ' ريال'
        + (str('compliance') === 'ok' ? '' : ' — ملاحظة: لم يُفصح بعد عن الالتزام الزكوي والضريبي ولا عن سجل السداد، فلا يُبنى عليهما استبعاد ويُذكران فجوةً يلزم استكمالها')
        + (isNew ? '' : (num('existingYears') > 0 ? ' — عمر النشاط القائم ' + num('existingYears') + ' سنوات' : '')),
      rev, years: isNew ? 0 : num('existingYears'),
      debtDesc: num('existingDebtService') > 0
        ? 'يوجد تمويل قائم بأقساط سنوية ' + Math.round(num('existingDebtService')).toLocaleString('en-US') + ' ريال'
        : (isNew ? 'مشروع جديد — لا توجد ديون قائمة' : 'لم يُفصح عن ديون قائمة'),
      isInvest: false, budget: 'full',
      scopes,
      scopeFrom: batch === undefined ? undefined : from,
      scopeTo: batch === undefined ? undefined : from + SIZE,
    });

    // ═══ مرشّحان قبل الحفظ — خاصان بالجدوى ولا يمسّان أي مسار آخر ═══
    const kept = r.offers.filter((o) => {
      const t = [o.provider, o.product, o.requirements, Array.isArray(o.gaps) ? o.gaps.join(' ') : ''].join(' ');
      // (١) المشروع الجديد بلا سجل تشغيلي: اشتراط سنوات تشغيل أو قوائم تاريخية ليس فجوة تُسدّ بل جدار
      if (isNew && /(لا تقل|لا يقل|على الأقل).{0,20}(سنت|سنوات|أعوام)|(ثلاث|سنتان|سنتين|٣|3|٢|2)\s*(سنوات|سنين|أعوام)\s*(تشغيل|نشاط|خبرة|عمل)|سجل تشغيلي|قوائم مالية مدققة لآخر|آخر (ثلاث|٣|3) سنوات|تاريخ ائتماني سابق/.test(t)) return false;
      // (٢) قاعدته المعتمدة: لا ضمان حكومي ولا برنامج مدعوم يُعرض لمملوك أجنبي بلا تحقق مكتوب من شروط الملكية
      if (prof.foreignOwner && /كفالة|منشآت|بنك التنمية الاجتماعية|صندوق التنمية|الصندوق الصناعي|برنامج حكومي|مدعوم حكومي/.test(t)) return false;
      return true;
    });
    const dropped = r.offers.length - kept.length;

    const nextB = (batch === undefined ? 0 : batch) + 1;
    const done = batch === undefined || (nextB * SIZE) >= r.totalScopes;
    if (kept.length) {
      // keepPrev على الدفعات التالية حتى لا تلغي الدفعة الثانية نتائج الأولى
      await saveMatchResults(companyId, 'feasibility', kept, scaleRev, batch !== undefined && batch > 0, '');
    }

    const { count } = await admin.from('match_results')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId).eq('track', 'feasibility').eq('status', 'new').gt('fit_score', 0);

    return NextResponse.json({
      ok: true, done, next: nextB, total: r.totalScopes,
      found: kept.length, dropped, count: count || 0,
      gate: describeGate(prof, scopes.length),
      warn: r.ok ? undefined : (r.error || undefined),
    });
  } catch (e) {
    await logError('feasibility.match', e, { company_id: companyId });
    return NextResponse.json({ error: 'تعذر تشغيل المطابقة: ' + String(e).slice(0, 140) }, { status: 500 });
  }
}
