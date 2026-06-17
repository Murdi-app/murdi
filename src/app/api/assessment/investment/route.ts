import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';


async function estimateValuationAI(rev: number, profit: number, growth: string, sector: string): Promise<{ lo: number; hi: number; note: string } | null> {
  const MODELS = ['claude-opus-4-8', 'claude-sonnet-4-6'];
  const prompt = 'انت خبير تقييم شركات وفق منهجية د. عبدالحكيم المرضي. قدّر القيمة التقديرية لشركة سعودية خاصة (غير مدرجة) لغرض جذب مستثمر. '
    + 'بياناتها: ايرادات سنوية ' + rev + ' ريال، صافي ربح ' + profit + ' ريال، نمو ' + (growth || 'غير محدد') + '، قطاع ' + (sector || 'غير محدد') + '. '
    + 'قواعد صارمة وملزمة (لا تتجاوزها حفاظا على المصداقية): '
    + 'الشركة الخاصة غير المدرجة تُقيّم اقل من المدرجة بسبب ضعف السيولة وارتفاع المخاطر، فاستخدم مضاعفات ربح محافظة جدا حسب القطاع: تقنية/برمجيات 5-7، صحة/تعليم 4-6، تجزئة/خدمات 3-5، صناعة/مقاولات/تجارة 3-4، اغذية/زراعة 4-5. الحد الادنى اذا النمو ضعيف والاعلى اذا عالٍ. '
    + 'اذا كانت خاسرة او ربحها صفر، ارجع lo=0 و hi=0 و note يوضح ان التقييم يحتاج ربحية. '
    + 'كن محافظا: التقدير الادنى افضل من المبالغة. '
    + 'ارجع JSON فقط: {"lo": رقم, "hi": رقم, "note": "جملة قصيرة تشرح المضاعف والقطاع بلا ذكر ذكاء اصطناعي او تقنية"}. ';
  for (const model of MODELS) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY as string, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model, max_tokens: 600, messages: [{ role: 'user', content: prompt }] }),
      });
      if (!res.ok) continue;
      const j = await res.json();
      const txt = (j.content || []).filter((b: { type: string }) => b.type === 'text').map((b: { text: string }) => b.text).join('').trim();
      const clean = txt.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(clean);
      if (typeof parsed.lo === 'number' && typeof parsed.hi === 'number') return { lo: parsed.lo, hi: parsed.hi, note: parsed.note || '' };
    } catch {}
  }
  return null;
}

async function generateDeepAnalysis(data: Record<string, unknown>, score: number): Promise<{ obstacles: string[]; plan: string[] } | null> {
  const MODELS = ['claude-opus-4-8', 'claude-sonnet-4-6'];
  const prompt = 'انت محلل مالي استثماري وفق منهجية د. عبدالحكيم المرضي — مستشار سعودي معتمد. '
    + 'اسلوبك: ارقام محسوبة من بيانات الشركة نفسها، صراحة بلا مجاملات، وممنوع نهائيا ذكر اي ذكاء اصطناعي او تقنية او اي اشارة لكونك نموذجا. '
    + 'بيانات الشركة: ' + JSON.stringify(data) + '. '
    + 'سكور جاهزية الاستثمار: ' + score + ' من 100. '
    + 'قاعدة قاطعة: اذا كانت حالة السداد (repayment_status) = default اي متعثر، يمنع منعا باتا ترشيح اي جهة استثمار او الايحاء بان الشركة جاهزة لجذب مستثمر، فالمستثمر لا يدخل شركة متعثرة لان امواله ستذهب للدائنين لا للنمو. في هذه الحالة اجعل obstacles توضح بصدق محترم لماذا التعثر يمنع الاستثمار الان، واجعل plan خطة تعافي واقعية ومتدرجة يقدر عليها صاحب شركة متعثر فعلا بلا مبالغة ولا حلول خيالية ولا راس مال كبير: اعادة جدولة الديون والتفاوض مع الدائنين، وقف النزيف النقدي وضبط المصروفات، تحسين دورة التحصيل والتدفق النقدي، استعادة الانتظام في السداد. الرسالة الجوهرية: التعافي اولا ثم يأتي جذب المستثمر لاحقا. '
    + 'المطلوب JSON فقط بلا اي نص خارجه بهذا الشكل بالضبط: {"obstacles": ["..."], "plan": ["..."]}. '
    + 'obstacles: ابرز 2-4 عوائق حقيقية امام دخول مستثمر، كل عائق جملة او جملتان فيها رقم او نسبة محسوبة من بياناتهم الفعلية واثرها على نظرة المستثمر للشركة. '
    + 'plan: 3-5 خطوات تحسين مرتبة بالاولوية، كل خطوة عملية ومحددة (ماذا يفعل تحديدا، وما اثرها المتوقع على جاذبية الشركة لمستثمر). اربطها بوضعهم لا بنصائح عامة.';

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
      const d = await res.json();
      const raw = (d.content || [])
        .filter((b: { type: string }) => b.type === 'text')
        .map((b: { text: string }) => b.text)
        .join('').trim();
      const a = raw.indexOf('{');
      const z = raw.lastIndexOf('}');
      if (a !== -1 && z > a) {
        const parsed = JSON.parse(raw.slice(a, z + 1));
        if (Array.isArray(parsed.obstacles) && Array.isArray(parsed.plan)) return parsed;
      }
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

  const { createClient } = await import('@supabase/supabase-js');
  const adminGuard = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  );

  const { count: monthCount } = await adminGuard
    .from('financial_data')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', company.id)
    .eq('assessment_type', 'investment')
    .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString());

  if ((monthCount || 0) >= 1) {
    const { data: er } = await adminGuard
      .from('edit_requests')
      .select('id')
      .eq('company_id', company.id)
      .eq('status', 'approved')
      .limit(1);
    if (!er || er.length === 0) {
      return NextResponse.json({ error: 'استنفدت تقييم هذا الشهر. إذا أخطأت في البيانات، أرسل طلب تعديل من صفحة الاستشارة وسيراجعه فريق د. عبدالحكيم.' }, { status: 429 });
    }
    await adminGuard.from('edit_requests').update({ status: 'used', used_at: new Date().toISOString() }).eq('id', er[0].id);
    await adminGuard.from('consultations').delete().eq('company_id', company.id);
  }


  let score = 0;
  let obstacles: string[] = [];
  let plan: string[] = [];
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

  // عقوبة الدين وحالة السداد — المستثمر لا يدخل شركة متعثرة مهما كانت أرقامها
  if (body.has_debt === 'yes') {
    const remaining = Number(body.remaining_debt) || 0;
    const debtRatio = rev > 0 ? remaining / rev : 0;
    if (body.repayment_status === 'default') {
      score = Math.min(score, 28);
      obstacles.unshift('الشركة متعثرة في سداد ديونها — المستثمر لا يدخل شركة متعثرة لأن أمواله ستذهب للدائنين لا للنمو');
    } else if (body.repayment_status === 'slight') {
      score -= 15;
      obstacles.push('تأخر في سداد بعض الأقساط — يثير قلق المستثمر حول انضباط التدفق النقدي');
    }
    if (debtRatio > 0.7) {
      score -= 12;
      obstacles.push('عبء الدين مرتفع — الديون المتبقية تعادل ' + Math.round(debtRatio * 100) + '% من الإيرادات السنوية');
    } else if (debtRatio > 0.4) {
      score -= 6;
    }
  }
  if (score < 0) score = 0;

  let verdict = '';
  if (score >= 80) verdict = 'جاهز لدخول مستثمر';
  else if (score >= 70) verdict = 'جاهز بدرجة جيدة — تحسينات ترفع التقييم';
  else if (score >= 50) verdict = 'يحتاج تجهيزاً قبل العرض على المستثمرين';
  else verdict = 'غير جاهز حالياً — ابدأ بخطة التحسين';

  const { error: fdError } = await supabase.from('financial_data').insert({
    company_id: company.id,
    assessment_type: 'investment',
    sector: body.sector,
    client_concentration: body.client_concentration,
    revenue_recurring: body.revenue_recurring,
    had_investment: body.had_investment,
    has_debt: body.has_debt,
    total_financing: body.total_financing,
    remaining_debt: body.remaining_debt,
    financing_sources: body.financing_sources,
    financing_type: body.financing_type,
    repayment_status: body.repayment_status,
    debt_details: body.debt_details,
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

  let valuationStr = '';
  try {
    const debtRatio = (Number(body.remaining_debt) > 0 && rev > 0) ? Math.round((Number(body.remaining_debt) / rev) * 100) : 0;
    const deep = await generateDeepAnalysis({ ...body, score, debt_to_revenue_pct: debtRatio }, score);
    valuationStr = await (async () => { const v = await estimateValuationAI(rev, profit, body.revenue_growth || '', body.sector || ''); return v ? JSON.stringify(v) : ''; })();
    if (deep !== null) {
      if (deep.obstacles.length > 0) obstacles = deep.obstacles;
      if (deep.plan.length > 0) plan = deep.plan;
    }
  } catch {}

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
