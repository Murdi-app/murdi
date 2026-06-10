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

  let score = 0;
  const obstacles: string[] = [];
  const plan: string[] = [];
  const docs: string[] = ['السجل التجاري', 'القوائم المالية', 'ملف تعريفي للشركة'];

  const rev = Number(body.annual_revenue) || 0;
  const profit = Number(body.net_profit) || 0;
  const years = Number(body.years_operating) || 0;
  const margin = rev > 0 ? profit / rev : 0;

  if (margin >= 0.15) score += 25;
  else if (margin >= 0.08) score += 18;
  else if (margin > 0) { score += 10; obstacles.push('هامش الربح منخفض'); plan.push('رفع هامش الربح فوق 8% — المستثمر يشتري ربحية قبل أي شيء'); }
  else { obstacles.push('الشركة غير ربحية حالياً'); plan.push('الوصول لنقطة التعادل أولاً — دخول مستثمر على شركة خاسرة يكون بشروط قاسية'); }

  if (body.revenue_growth === 'high') score += 20;
  else if (body.revenue_growth === 'medium') score += 15;
  else if (body.revenue_growth === 'low') { score += 8; obstacles.push('نمو الإيرادات بطيء'); plan.push('بناء خطة نمو واضحة قابلة للعرض على المستثمر'); }
  else { score += 2; obstacles.push('الإيرادات متراجعة'); plan.push('إيقاف التراجع وإثبات استقرار 6 أشهر على الأقل قبل طرح الشركة للاستثمار'); }

  if (body.has_governance) score += 10; else { obstacles.push('لا يوجد نظام حوكمة'); plan.push('توثيق اللوائح والصلاحيات وفصل الملكية عن الإدارة'); }
  if (body.has_board) score += 5; else plan.push('تشكيل مجلس استشاري ولو مصغّر — يرفع ثقة المستثمر');
  if (body.has_financial_statements) {
    score += 10;
    if (body.audited_statements) { score += 10; docs.push('تقرير المراجع الخارجي'); }
    else { obstacles.push('القوائم غير مراجعة خارجياً'); plan.push('تعيين مراجع خارجي معتمد — شرط شبه إلزامي لأي مستثمر مؤسسي'); }
  } else {
    obstacles.push('لا توجد قوائم مالية');
    plan.push('إعداد قوائم مالية لآخر سنتين عبر محاسب قانوني — لا استثمار بدونها');
  }

  if (years >= 5) score += 12;
  else if (years >= 3) score += 9;
  else if (years >= 1) { score += 5; obstacles.push('عمر الشركة أقل من 3 سنوات'); }
  else { score += 1; obstacles.push('الشركة في سنتها الأولى'); }

  if (rev >= 10000000) score += 8;
  else if (rev >= 3000000) score += 6;
  else if (rev >= 1000000) score += 4;
  else { score += 1; obstacles.push('حجم الإيرادات أقل من اهتمام أغلب الصناديق'); plan.push('أغلب الصناديق السعودية تبدأ من إيرادات مليون فأكثر'); }

  let verdict = '';
  if (score >= 80) verdict = 'جاهز لدخول مستثمر';
  else if (score >= 70) verdict = 'جاهز بدرجة جيدة — تحسينات ترفع التقييم';
  else if (score >= 50) verdict = 'يحتاج تجهيزاً قبل العرض على المستثمرين';
  else verdict = 'غير جاهز حالياً — ابدأ بخطة التحسين';

  const { error: fdError } = await supabase.from('financial_data').insert({
    company_id: company.id,
    assessment_type: 'investment',
    annual_revenue: rev,
    years_operating: years,
    net_profit: profit,
    revenue_growth: body.revenue_growth,
    company_stage: body.company_stage,
    has_governance: body.has_governance,
    has_board: body.has_board,
    has_financial_statements: body.has_financial_statements,
    audited_statements: body.audited_statements,
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

  return NextResponse.json({ ok: true, readiness_score: score, verdict });
}
