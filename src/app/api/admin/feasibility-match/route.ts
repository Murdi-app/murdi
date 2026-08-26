import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { runScopedMatch, saveMatchResults } from '@/lib/matchEngine';
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
      years_operating: isNew ? 0 : undefined,
      funding_type: 'project',
      funding_type_other: isNew ? 'تمويل تأسيس مشروع جديد' : 'تمويل توسعة نشاط قائم',
      activity_type: 'other',
      activity_other: str('sectorText') || String(company.sector || ''),
      has_debt: false,
      net_profit: undefined,
      // القالب ثنائي بلا خيار «غير معروف»، فترك الحقل فارغاً يُطبع «غير ساري» — نفياً مفبركاً
      cr_valid: Boolean(company.cr_number),
      has_financial_statements: !isNew,
      // ملكية المنشأة تُقرأ من ملف الشركة إن وُجدت — تفتح ممر المستثمر الأجنبي تلقائياً
      ownership_type: company.ownership_type,
      owner_nationality: company.owner_nationality,
    };

    // نفس تقسيم runAutoMatch: خمسة نطاقات لكل دفعة، والعميل يكرر حتى done
    const SIZE = 5;
    const from = (batch === undefined ? 0 : batch) * SIZE;
    const r = await runScopedMatch({
      company, fd,
      // الإيراد صفر للمشروع الجديد، فحجمه يُبلَّغ هنا حتى لا يقيسه النموذج على منشأة بلا حجم
      typeLabel: (isNew ? 'تمويل تأسيس مشروع جديد' : 'تمويل توسعة نشاط قائم')
        + ' — إجمالي استثمار ' + Math.round(num('capex') + num('workingCapital')).toLocaleString('en-US')
        + ' ريال، المطلوب تمويله ' + Math.round(num('financingAmount')).toLocaleString('en-US')
        + ' ريال، ومساهمة المؤسس ' + Math.round(num('ownFunds')).toLocaleString('en-US') + ' ريال',
      rev, years: isNew ? 0 : 1,
      debtDesc: 'لا توجد ديون قائمة',
      isInvest: false, budget: 'full',
      scopeFrom: batch === undefined ? undefined : from,
      scopeTo: batch === undefined ? undefined : from + SIZE,
    });

    const nextB = (batch === undefined ? 0 : batch) + 1;
    const done = batch === undefined || (nextB * SIZE) >= r.totalScopes;
    if (r.offers.length) {
      // keepPrev على الدفعات التالية حتى لا تلغي الدفعة الثانية نتائج الأولى
      await saveMatchResults(companyId, 'feasibility', r.offers, scaleRev, batch !== undefined && batch > 0, '');
    }

    const { count } = await admin.from('match_results')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId).eq('track', 'feasibility').eq('status', 'new').gt('fit_score', 0);

    return NextResponse.json({
      ok: true, done, next: nextB, total: r.totalScopes,
      found: r.offers.length, count: count || 0,
      warn: r.ok ? undefined : (r.error || undefined),
    });
  } catch (e) {
    await logError('feasibility.match', e, { company_id: companyId });
    return NextResponse.json({ error: 'تعذر تشغيل المطابقة: ' + String(e).slice(0, 140) }, { status: 500 });
  }
}
