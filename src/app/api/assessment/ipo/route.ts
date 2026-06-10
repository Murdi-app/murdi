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

  // ===== محرك جاهزية الطرح =====
  let score = 0;
  const obstacles: string[] = [];
  const plan: string[] = [];
  const docs: string[] = ['السجل التجاري', 'القوائم المالية المراجعة', 'الهيكل التنظيمي'];
  let monthsToReady = 0; // مؤشر المدة المتوقعة

  const rev = Number(body.annual_revenue) || 0;
  const profit = Number(body.net_profit) || 0;
  const years = Number(body.years_operating) || 0;
  const stYears = Number(body.num_statements_years) || 0;
  const topClient = Number(body.top_client_pct) || 0;
  const margin = rev > 0 ? profit / rev : 0;

  // تحديد السوق الفعلي المقترح
  let suggestedMarket = body.target_market;
  if (body.target_market === 'unsure' || body.target_market === 'main') {
    suggestedMarket = (rev >= 40000000 && profit > 0 && stYears >= 3) ? 'main' : 'nomu';
  }
  const isMain = suggestedMarket === 'main';

  // 1) الأداء المالي (30 نقطة)
  if (profit > 0 && margin >= 0.1) score += 15;
  else if (profit > 0) { score += 10; obstacles.push('هامش الربح أقل من 10%'); plan.push('تحسين الربحية — السوق يقيّم الشركات على مضاعفات الأرباح'); monthsToReady = Math.max(monthsToReady, 12); }
  else { obstacles.push('الشركة غير ربحية'); plan.push('تحقيق ربحية مستدامة لسنة مالية كاملة على الأقل'); monthsToReady = Math.max(monthsToReady, 24); }

  if (body.revenue_growth === 'high') score += 10;
  else if (body.revenue_growth === 'medium') score += 8;
  else if (body.revenue_growth === 'low') { score += 4; plan.push('بناء قصة نمو واضحة — المستثمر في الطرح يشتري المستقبل'); }
  else { obstacles.push('الإيرادات متراجعة'); plan.push('عكس مسار التراجع قبل التفكير في الطرح'); monthsToReady = Math.max(monthsToReady, 18); }

  const minRev = isMain ? 40000000 : 10000000;
  if (rev >= minRev) score += 5;
  else { obstacles.push('حجم الإيرادات أقل من المعتاد للسوق المستهدف'); monthsToReady = Math.max(monthsToReady, 18); }

  // 2) القوائم والمراجعة (30 نقطة)
  const reqYears = isMain ? 3 : 2;
  if (stYears >= reqYears) score += 15;
  else if (stYears >= 1) {
    score += 7;
    obstacles.push('عدد سنوات القوائم المعتمدة غير كافٍ (' + stYears + ' من ' + reqYears + ' مطلوبة)');
    plan.push('استكمال ' + (reqYears - stYears) + ' سنة إضافية من القوائم المعتمدة');
    monthsToReady = Math.max(monthsToReady, (reqYears - stYears) * 12);
  } else {
    obstacles.push('لا توجد قوائم مالية معتمدة');
    plan.push('البدء فوراً بإعداد قوائم معتمدة — أساس أي ملف طرح');
    monthsToReady = Math.max(monthsToReady, reqYears * 12);
  }

  if (body.external_auditor) { score += 15; docs.push('تقارير المراجع الخارجي'); }
  else {
    obstacles.push('لا يوجد مراجع خارجي معتمد');
    plan.push('تعيين مراجع خارجي من المكاتب المعتمدة لدى الهيئة');
    monthsToReady = Math.max(monthsToReady, 6);
  }

  // 3) الحوكمة (25 نقطة)
  if (body.has_governance) score += 9; else { obstacles.push('لا يوجد نظام حوكمة موثق'); plan.push('بناء لائحة حوكمة متوافقة مع متطلبات هيئة السوق المالية'); monthsToReady = Math.max(monthsToReady, 9); }
  if (body.has_board) { score += 8; docs.push('قرارات مجلس الإدارة'); } else { obstacles.push('لا يوجد مجلس إدارة فعّال'); plan.push('تشكيل مجلس إدارة بأعضاء مستقلين'); monthsToReady = Math.max(monthsToReady, 9); }
  if (body.has_committees) score += 8; else { plan.push('تشكيل لجنة مراجعة على الأقل — إلزامية للإدراج'); monthsToReady = Math.max(monthsToReady, 6); }

  // 4) الالتزام والاستدامة (15 نقطة)
  if (body.tax_compliant) score += 4; else { obstacles.push('الوضع الضريبي غير منتظم'); plan.push('تسوية الوضع الضريبي بالكامل'); monthsToReady = Math.max(monthsToReady, 6); }
  if (body.zakat_compliant) { score += 4; docs.push('شهادة الزكاة'); } else { obstacles.push('شهادة الزكاة غير سارية'); plan.push('تجديد شهادة الزكاة'); monthsToReady = Math.max(monthsToReady, 3); }
  if (topClient <= 25) score += 7;
  else if (topClient <= 50) { score += 4; obstacles.push('تركّز إيرادات على عميل واحد (' + topClient + '%)'); plan.push('تنويع قاعدة العملاء — التركّز فوق 25% يقلق المستثمرين'); monthsToReady = Math.max(monthsToReady, 12); }
  else { obstacles.push('اعتماد مفرط على عميل واحد (' + topClient + '%)'); plan.push('خفض الاعتماد على العميل الأكبر تحت 50% كحد أدنى'); monthsToReady = Math.max(monthsToReady, 18); }

  let verdict = '';
  if (score >= 80) { verdict = 'جاهز لبدء إجراءات الطرح — ' + (isMain ? 'السوق الرئيسية' : 'السوق الموازي (نمو)'); monthsToReady = Math.max(monthsToReady, 6); }
  else if (score >= 60) verdict = 'قريب من الجاهزية — ' + (isMain ? 'السوق الرئيسية' : 'نمو') + ' خلال ' + monthsToReady + ' شهراً تقريباً';
  else if (score >= 40) verdict = 'يحتاج تجهيزاً جوهرياً — المدة المتوقعة ' + monthsToReady + ' شهراً';
  else verdict = 'غير جاهز — ابدأ بخارطة الطريق، المدة المتوقعة ' + monthsToReady + ' شهراً على الأقل';

  plan.push('السوق المقترح بناءً على وضعك: ' + (isMain ? 'السوق الرئيسية' : 'السوق الموازي (نمو)'));

  const { error: fdError } = await supabase.from('financial_data').insert({
    company_id: company.id,
    assessment_type: 'ipo',
    annual_revenue: rev,
    net_profit: profit,
    revenue_growth: body.revenue_growth,
    years_operating: years,
    target_market: suggestedMarket,
    num_statements_years: stYears,
    external_auditor: body.external_auditor,
    has_governance: body.has_governance,
    has_board: body.has_board,
    has_committees: body.has_committees,
    tax_compliant: body.tax_compliant,
    zakat_compliant: body.zakat_compliant,
    top_client_pct: topClient,
  });
  if (fdError) return NextResponse.json({ error: 'فشل حفظ البيانات: ' + fdError.message }, { status: 500 });

  const { error: rrError } = await supabase.from('readiness_results').insert({
    company_id: company.id,
    readiness_score: score,
    verdict,
    top_obstacles: obstacles,
    required_documents: docs,
    improvement_plan: plan,
  });
  if (rrError) return NextResponse.json({ error: 'فشل حفظ النتيجة: ' + rrError.message }, { status: 500 });

  return NextResponse.json({ ok: true, readiness_score: score, verdict, months_to_ready: monthsToReady });
}
