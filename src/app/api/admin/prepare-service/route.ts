import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { SERVICES } from '@/lib/serviceSuggestion';
import { checkFinancialIntegrity, normalizeDebt } from '@/lib/dataIntegrity';

const ADMIN_EMAIL = 'hololalmurdi.fs@gmail.com';
const MODELS = ['claude-opus-4-8', 'claude-sonnet-4-6'];

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await sb.auth.getUser();
  if (!user || user.email !== ADMIN_EMAIL) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });

  const body = await req.json();
  const { requestId } = body;
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  );

  const { data: sr } = await admin.from('service_requests').select('*, companies(company_name, sector)').eq('id', requestId).single();
  if (!sr) return NextResponse.json({ error: 'الطلب غير موجود' }, { status: 404 });

  const companyId = sr.company_id;
  const { data: fd } = await admin.from('financial_data').select('*').eq('company_id', companyId).order('created_at', { ascending: false }).limit(1).maybeSingle();
  const { data: rr } = await admin.from('readiness_results').select('*').eq('company_id', companyId).order('created_at', { ascending: false }).limit(1).maybeSingle();

  // مدخلات مالية يدوية (لخدمة إعداد القوائم المالية) — إن وُجدت، تُبنى عليها قوائم فعلية
  const { data: si } = await admin.from('service_inputs').select('*').eq('service_request_id', requestId).maybeSingle();

  // طبقة التصحيح: إن وُجد تصحيح معتمد من الأدمن، فهو مصدر الحقيقة
  const { data: corr } = await admin.from('admin_corrections').select('*').eq('company_id', companyId).order('created_at', { ascending: false }).limit(1).maybeSingle();

  const effective = {
    ...(fd || {}),
    ...(corr?.original_loan_amount != null ? { original_loan_amount: corr.original_loan_amount, total_financing: corr.original_loan_amount } : {}),
    ...(corr?.debt_remaining != null ? { debt_remaining: corr.debt_remaining, remaining_debt: corr.debt_remaining } : {}),
    ...(corr?.annual_revenue != null ? { annual_revenue: corr.annual_revenue } : {}),
  };

  // بوابة السلامة: لا تُولَّد وثيقة تُخاطَب بها جهة خارجية وهي تحمل تناقضاً
  const issues = checkFinancialIntegrity(effective);
  if (issues.length > 0) {
    const dn = normalizeDebt(effective); return NextResponse.json({ error: 'INTEGRITY_FAILED', issues, current: { original_loan_amount: dn.original, debt_remaining: dn.remaining, annual_revenue: dn.revenue }, companyId }, { status: 422 });
  }

  const companyName = (sr.companies as { company_name?: string })?.company_name || 'الشركة';
  const sector = (sr.companies as { sector?: string })?.sector || 'غير محدد';

  const prompt = 'أنت تكتب نيابةً عن د. عبدالحكيم المرضي — مستشار مالي سعودي معتمد، دكتوراه إدارة أعمال، عضوية البورد الأمريكي، 15 سنة خبرة، عبر شركة حلول المرضي للاستشارات المالية. '
    + 'تلتزم بمنهجية مُرضي في كل ما تكتب: تحليل مبني حصراً على أرقام الشركة الفعلية، تقديرات محافظة واقعية بلا مبالغة ولا حلول خيالية، خطوات عملية قابلة للتنفيذ مرتبة حسب الأثر، ولغة مهنية واضحة تخاطب صاحب الشركة باحترام وثقة. '
    + 'مهمتك: تجهيز مخرَج خدمة "' + sr.service_title + '" لشركة "' + companyName + '" (قطاع: ' + sector + ') بشكل احترافي دقيق جاهز للتسليم للعميل.\\n'
    + (SERVICES[sr.service_title] ? ('تعريف هذه الخدمة بالتحديد: ' + SERVICES[sr.service_title].definition + '\\nالمخرج المطلوب منك تحديداً: ' + SERVICES[sr.service_title].output + '\\nالتزم بهذا التعريف حصراً ولا تنحرف لموضوع آخر (مثلاً لا تكتب عن جاهزية التمويل إن كانت الخدمة تقييم قيمة).\\n') : '')
    + '\\n'
    + 'بيانات الشركة المالية: ' + JSON.stringify(effective) + '\\n'
    + (si && si.inputs && Object.keys(si.inputs).length > 0 ? (
        '\\n════ أرقام مالية فعلية أدخلها المستشار (نوع النشاط: ' + (si.activity_kind || 'عام') + ') ════\\n'
        + (si.inputs && (si.inputs as any).multi_year && (si.inputs as any).years
            ? ('قوائم لسنتين للمقارنة. أرقام كل سنة:\\nالسنة الأولى: ' + JSON.stringify((si.inputs as any).years['1']) + '\\nالسنة الثانية: ' + JSON.stringify((si.inputs as any).years['2']) + '\\nاعرض جميع القوائم الخمس بعمودين متجاورين (السنة الأولى / السنة الثانية) للمقارنة — قائمة الدخل والمركز المالي والتدفقات النقدية والتغيرات في حقوق الملكية كلها بعمودين، وليست قائمة الدخل فقط. البنك يطلب ميزانية سنتين للمقارنة. اربط السنتين محاسبياً: الأرباح المرحّلة الافتتاحية للسنة الثانية يجب أن تساوي (الأرباح المرحّلة الافتتاحية للسنة الأولى + صافي ربح السنة الأولى − توزيعات السنة الأولى)، فإن اختلف الرقم المُدخل للسنة الثانية عن هذا الناتج فاعتمد الناتج المحسوب وأشر للفرق كبند يحتاج مراجعة. طبّق قاعدة لا-الفبركة على كل سنة على حدة، وإن ظهر فرق أظهره صريحاً لتلك السنة.')
            : JSON.stringify(si.inputs)) + '\\n'
        + 'مهم جداً: هذي أرقام فعلية موثّقة من دفاتر العميل. ابنِ عليها قوائم مالية كاملة ومترابطة رياضياً (قائمة الدخل، المركز المالي، التدفقات النقدية، التغيرات في حقوق الملكية، والإيضاحات) وفق معايير SOCPA السعودية، متكيّفة مع طبيعة النشاط المذكور. '
        + 'تحقّق إلزامياً من تكلفة البضاعة لكل سنة: احسب (المخزون الافتتاحي + المشتريات − المخزون الختامي) وقارنها بتكلفة البضاعة المُدخلة؛ إن اختلفتا فأظهر تنبيهاً صريحاً بالفرق ولا تتجاهله. احسب البنود المشتقة بدقة: مجمل الربح = الإيراد − تكلفة النشاط؛ الربح التشغيلي = مجمل الربح − المصروفات؛ صافي الربح = الربح التشغيلي − الزكاة. استخدم opening_fixed_assets و depreciation لبناء النشاط الاستثماري في التدفقات: صافي الحركة في الأصول = (الأصول الثابتة الختامية − opening_fixed_assets + depreciation)، فيُغلق فرق النقد بدل تركه معلّقاً. الأرباح المرحّلة الختامية = opening_retained_earnings + صافي الربح − distributions — تُحسب بهذه المعادلة فقط لا بالطرح من الأصول. ممنوع منعاً باتاً اختلاق أي رقم لتحقيق التوازن. بعد إدراج كل البنود الفعلية، إن لم يتساو إجمالي الأصول مع إجمالي الالتزامات وحقوق الملكية فأظهِر بنداً صريحاً في المركز المالي باسم (فرق غير مفسَّر — يحتاج مراجعة الدفاتر) بقيمته، ولا تدفنه في الأرباح المرحّلة أو أي بند. وإن كان opening_retained_earnings غير مدخل فاذكر أن حقوق الملكية تحتاج استخراجاً من دفاتر السنة السابقة وأن القائمة غير مكتملة. '
        + 'اطرح مخصص الديون المشكوك فيها (doubtful_debt) من الذمم المدينة لإظهار صافيها في المركز المالي، واحمل المخصص كمصروف في قائمة الدخل. عامل مصروف الإهلاك (depreciation) دائماً كبند مستقل غير مضمّن في المصروفات التشغيلية: اطرحه مرة واحدة فقط في قائمة الدخل، وأضِفه مرة واحدة في التدفقات التشغيلية كبند غير نقدي. لا تعرض نسختين للأرباح ولا تتردد في معالجته. وأوصِ صراحةً في الإيضاحات بإعداد جدول أعمار الذمم المدينة عند الاعتماد (كمستند مساند لا يدخل في متن القوائم). قدّم القوائم مكتملة بالأرقام لا كهيكل فارغ. أي بند غير مُدخل، عالجه بمنطق محاسبي سليم أو أشر إليه صراحة كبند يحتاج استكمالاً، دون اختلاق رقم.\\n'
      ) : '')
    + (corr ? ('⚠️ تنبيه: بيانات الدين/الإيراد المُدخلة من العميل كانت غير دقيقة، وصُحّحت رسمياً بواسطة المستشار بناءً على: ' + corr.source_note + '. اعتمد الأرقام المصحّحة أعلاه حصرا، ولا تُشر إلى وجود تصحيح في الوثيقة.\\n') : '')
    + 'نتيجة تقييم الجاهزية: ' + JSON.stringify(rr || {}) + '\\n\\n'
    + 'اكتب وثيقة الخدمة كاملة ومتقنة، مبنية على أرقام الشركة الفعلية، عملية وقابلة للتنفيذ، مرتّبة بعناوين وخطوات واضحة. '
    + 'اكتبها بصيغة وثيقة رسمية صادرة عن حلول المرضي للاستشارات المالية، بلا أي إشارة لذكاء اصطناعي أو تقنية. '
    + 'مهم جداً في التأطير: هذه وثيقة استشارية تُجهّز قوائم مالية شبه مكتملة تحتاج اعتماد محاسب قانوني مرخّص — وليست بديلاً عن التنفيذ القانوني/المحاسبي النهائي (كاعتماد القوائم من محاسب مرخّص أو توثيق لوائح المجلس رسمياً). اجعل العميل يشعر بقيمتها كخارطة طريق جاهزة ودقيقة. '
    + 'اذكر بوضوح مرة واحدة أن هذه قوائم أوّلية تحتاج اعتماد محاسب قانوني مرخّص لتصبح جاهزة للبنك (دون تكرار أو تهويل). ثم أضف قبل سطر الإصدار فقرة ختامية بعنوان "الخطوة الأخيرة: اعتماد قوائمك رسمياً" تدعو العميل لإتمام الاعتماد عبر محاسب حلول المرضي المرخّص لتصبح القوائم جاهزة لتقديمها للجهة التمويلية تقول بوضوح: إن رغبتم في إتمام الجوانب التنفيذية والقانونية الواردة في هذه الخطة (مثل اعتماد القوائم من محاسب مرخّص، أو توثيق لوائح ومحاضر المجلس، أو أي مخرج رسمي)، تواصلوا مع فريق حلول المرضي وسنرشدكم خطوة بخطوة وننفّذها معكم بسرعة عالية عبر محاسبنا ومستشارينا المعتمدين، بناءً على هذه الوثيقة الجاهزة. '
    + 'اكتب العنوان الرئيسي بصيغة "القوائم المالية — [اسم الشركة]" أو "مجموعة القوائم المالية الأوّلية". اكتب بنبرة مستشار بشري خبير يخاطب صاحب المنشأة مباشرةً — طبيعية ودافئة ومهنية، دون أي صياغة آلية أو قوالب جامدة أو ذكر لأي تقنية أو نظام. '
    + 'ابدأ مباشرة بمحتوى الوثيقة بصيغة نصية واضحة (يمكن استخدام عناوين بخطوط وفواصل)، واختم بسطر: "صادر عن: د. عبدالحكيم المرضي — حلول المرضي للاستشارات المالية".';

  for (const model of MODELS) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY as string, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model, max_tokens: 8000, messages: [{ role: 'user', content: prompt }] }),
      });
      if (!res.ok) continue;
      const data = await res.json();
      const text = (data.content || []).filter((b: { type: string }) => b.type === 'text').map((b: { text: string }) => b.text).join('').trim();
      if (text.length > 80) {
        await admin.from('service_requests').update({ admin_deliverable: text, status: 'in_progress', updated_at: new Date().toISOString() }).eq('id', requestId);
        return NextResponse.json({ ok: true, deliverable: text });
      }
    } catch {}
  }
  return NextResponse.json({ error: 'فشل التجهيز' }, { status: 500 });
}
