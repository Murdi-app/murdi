import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';


async function generateDeepAnalysis(fd: Record<string, unknown>, score: number): Promise<{ obstacles: string[]; plan: string[] } | null> {
  const MODELS = ['claude-fable-5', 'claude-sonnet-4-5-20250929'];
  const prompt = 'أنت محلل مالي يكتب وفق منهجية د. عبدالحكيم المرضي — مستشار سعودي معتمد. أسلوبه: أرقام محسوبة من بيانات الشركة نفسها، سياق السوق السعودي (ساما، منشآت، كفالة)، صراحة بلا مجاملات، وممنوع نهائياً ذكر أي ذكاء اصطناعي أو تقنية.\n\n'
    + 'بيانات الشركة: ' + JSON.stringify(fd) + '\n'
    + 'سكور الجاهزية: ' + score + '/100\n\n'
    + 'المطلوب JSON فقط بلا أي نص خارجه:\n'
    + '{"obstacles": ["..."], "plan": ["..."]}\n\n'
    + 'obstacles: أبرز 2-4 عوائق حقيقية أمام التمويل، كل عائق جملة-جملتان فيها رقم أو نسبة محسوبة من بياناتهم الفعلية وأثرها على نظرة الممول. إن لم توجد عوائق جوهرية اذكر نقاط الانتباه الأهم.\n'
    + 'plan: 3-5 خطوات تحسين مرتبة بالأولوية، كل خطوة عملية ومحددة وما أثرها المتوقع على فرص القبول. اربطها بوضعهم لا بنصائح عامة.\n\nقاعدة السرية التجارية (صارمة): ممنوع نهائياً ذكر أسماء أي جهات أو منصات أو برامج تمويل أو تقديم (لا بنوك، لا منصات تمويل جماعي، لا برامج حكومية بالاسم مثل منشآت أو كفالة كقنوات تقديم) — مطابقة العميل بجهات التمويل تتم حصرياً عبر شبكة مُرضي وفريق د. عبدالحكيم. مسموح فقط ذكر المتطلبات النظامية العامة (سمة/SIMAH للتقرير الائتماني، الهيئة السعودية للمراجعين لاعتماد المحاسب، هيئة الزكاة) لأنها إجراءات وليست قنوات تمويل. خطوات تجهيز الملف الداخلية (قوائم، سجل سداد، ملف غرض التمويل بالأرقام) هي جوهر الخطة. عند الحاجة لخطوة التقديم قل: التقديم عبر القنوات التي ترشحها لك شبكة مُرضي بعد اكتمال ملفك.';

  for (const model of MODELS) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY as string,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({ model, max_tokens: 2500, messages: [{ role: 'user', content: prompt }] }),
      });
      if (!res.ok) continue;
      const data = await res.json();
      const text = (data.content || [])
        .filter((b: { type: string }) => b.type === 'text')
        .map((b: { text: string }) => b.text)
        .join('').trim()
        .replace(/^```json\s*/i, '').replace(/```\s*$/, '');
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed.obstacles) && Array.isArray(parsed.plan)) return parsed;
    } catch { continue; }
  }
  return null;
}

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


  // ===== حد التقييم: واحد شهرياً، إلا بطلب تعديل معتمد =====
  const { createClient } = await import('@supabase/supabase-js');
  const adminGuard = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  );

  const { count: monthCount } = await adminGuard
    .from('financial_data')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', company.id)
    .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString());

  let usingEditRequest = false;
  if ((monthCount || 0) >= 999) {
    const { data: er } = await adminGuard
      .from('edit_requests')
      .select('id')
      .eq('company_id', company.id)
      .eq('status', 'approved')
      .limit(1);
    if (!er || er.length === 0) {
      return NextResponse.json({ error: 'استنفدت تقييم هذا الشهر. إذا أخطأت في البيانات، أرسل طلب تعديل من صفحة الاستشارة وسيراجعه فريق د. عبدالحكيم.' }, { status: 429 });
    }
    usingEditRequest = true;
    // وسم الطلب كمستخدم + حذف الاستشارة القديمة نهائياً (ستتولد جديدة تلقائياً)
    await adminGuard.from('edit_requests').update({ status: 'used', used_at: new Date().toISOString() }).eq('id', er[0].id);
    await adminGuard.from('consultations').delete().eq('company_id', company.id);
  }

  // ===== محرك جاهزية التمويل =====
  let score = 0;
  let obstacles: string[] = [];
  let plan: string[] = [];
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
    original_loan_amount: body.original_loan_amount,
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

  
  // ===== التحليل العميق: Claude يكتب العوائق والخطة من الأرقام الفعلية =====
  try {
    const deep = await generateDeepAnalysis({ ...body, annual_revenue: rev, years_operating: years } as Record<string, unknown>, score);
    if (deep !== null) {
      if (deep.obstacles.length > 0) obstacles = deep.obstacles;
      if (deep.plan.length > 0) plan = deep.plan;
    }
  } catch {}
  // القوالب الأصلية تبقى احتياطاً إن فشل التوليد

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
