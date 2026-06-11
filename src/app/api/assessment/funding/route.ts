import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export async function POST(req: Request) {
  const body = await req.json();
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (user === null) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

  const { data: company } = await supabase
    .from('companies')
    .select('id, account_status')
    .eq('user_id', user.id)
    .single();

  if (company === null) return NextResponse.json({ error: 'لا توجد شركة مسجلة' }, { status: 404 });
  if (company.account_status !== 'active') return NextResponse.json({ error: 'الحساب غير مفعّل' }, { status: 403 });

  // ===== محرك جاهزية التمويل =====
  let score = 0;
  const obstacles: string[] = [];
  const plan: string[] = [];
  const docs: string[] = ['السجل التجاري', 'كشف حساب بنكي 6 أشهر'];

  // 1) المتطلبات النظامية (40 نقطة)
  if (body.cr_valid) score += 10; else { obstacles.push('السجل التجاري غير ساري'); plan.push('تجديد السجل التجاري فوراً — شرط أساسي لأي تمويل'); }
  if (body.tax_compliant) score += 10; else { obstacles.push('عدم الالتزام بالإقرارات الضريبية'); plan.push('تسوية الوضع الضريبي مع هيئة الزكاة والضريبة والجمارك'); }
  if (body.zakat_compliant) { score += 10; docs.push('شهادة الزكاة'); } else { obstacles.push('شهادة الزكاة غير سارية'); plan.push('إصدار/تجديد شهادة الزكاة'); }
  if (body.has_financial_statements) { score += 10; docs.push('القوائم المالية'); } else { obstacles.push('لا توجد قوائم مالية'); plan.push('إعداد قوائم مالية عبر محاسب قانوني — ترفع فرص القبول بشكل كبير'); }

  // 2) الديون وحالة السداد (30 نقطة)
  if (body.has_debt === false) {
    score += 30;
  } else if (body.debt_status === 'committed') {
    score += 22;
    docs.push('جدول سداد التمويل القائم');
    const ratio = body.annual_revenue > 0 ? body.debt_remaining / body.annual_revenue : 1;
    if (ratio > 0.5) { obstacles.push('حجم الدين القائم مرتفع نسبة للإيرادات'); plan.push('خفض الدين القائم أو زيادة الإيرادات قبل طلب تمويل إضافي'); }
  } else {
    const months = Number(body.months_late) || 0;
    if (months <= 3) {
      score += 10;
      obstacles.push('تأخر في سداد التمويل القائم (' + months + ' شهر)');
      plan.push('تسوية المتأخرات فوراً — التأخر يظهر في سمة ويغلق أبواب التمويل');
    } else {
      obstacles.push('تعثر في السداد لأكثر من 3 أشهر');
      plan.push('جدولة الدين المتعثر مع الجهة الممولة أولاً — لا جدوى من طلب تمويل جديد قبل التسوية');
    }
  }

  // 3) عمر النشاط (15 نقطة)
  const years = Number(body.years_operating) || 0;
  if (years >= 3) score += 15;
  else if (years >= 1) { score += 10; obstacles.push('عمر النشاط أقل من 3 سنوات'); plan.push('بعض الجهات تشترط 3 سنوات — التركيز على الجهات التي تقبل سنة واحدة'); }
  else { score += 4; obstacles.push('عمر النشاط أقل من سنة'); plan.push('أغلب جهات التمويل تشترط سنة على الأقل — بناء سجل بنكي نظيف خلال هذه الفترة'); }

  // 4) الإيرادات السنوية (15 نقطة)
  const rev = Number(body.annual_revenue) || 0;
  if (rev >= 5000000) score += 15;
  else if (rev >= 1000000) score += 12;
  else if (rev >= 375000) score += 8;
  else { score += 3; obstacles.push('الإيرادات السنوية أقل من حد القبول لدى أغلب الجهات'); plan.push('رفع الإيرادات الموثقة بنكياً فوق 375 ألف ريال سنوياً'); }

  let verdict = '';
  if (score >= 80) verdict = 'جاهز للتمويل';
  else if (score >= 60) verdict = 'شبه جاهز — عوائق بسيطة';
  else if (score >= 40) verdict = 'يحتاج تحسين قبل التقديم';
  else verdict = 'غير جاهز حالياً';

  // حفظ البيانات
  const { error: fdError } = await supabase.from('financial_data').insert({
    company_id: company.id,
    funding_type: body.funding_type,
    funding_type_other: body.funding_type_other,
    company_bank: body.company_bank,
    monthly_installment: body.monthly_installment,
    lender_type: body.lender_type,
    lender_name: body.lender_name,
    has_bank_statement: body.has_bank_statement,
    annual_revenue: rev,
    years_operating: years,
    has_debt: body.has_debt,
    debt_remaining: body.debt_remaining,
    debt_status: body.debt_status,
    months_late: body.months_late,
    debt_type: body.debt_type,
    debt_type_other: body.debt_type_other,
    cr_valid: body.cr_valid,
    tax_compliant: body.tax_compliant,
    zakat_compliant: body.zakat_compliant,
    has_financial_statements: body.has_financial_statements,
  });
  if (fdError) return NextResponse.json({ error: 'فشل حفظ البيانات: ' + fdError.message }, { status: 500 });

  const { error: rrError } = await supabase.from('readiness_results').insert({
    company_id: company.id,
    result_type: 'funding',
    readiness_score: score,
    verdict,
    top_obstacles: obstacles,
    required_documents: docs,
    improvement_plan: plan,
  });
  if (rrError) return NextResponse.json({ error: 'فشل حفظ النتيجة: ' + rrError.message }, { status: 500 });

  return NextResponse.json({ ok: true, readiness_score: score, verdict });
}
