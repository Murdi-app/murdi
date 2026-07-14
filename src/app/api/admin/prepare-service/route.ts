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
    + (corr ? ('⚠️ تنبيه: بيانات الدين/الإيراد المُدخلة من العميل كانت غير دقيقة، وصُحّحت رسمياً بواسطة المستشار بناءً على: ' + corr.source_note + '. اعتمد الأرقام المصحّحة أعلاه حصرا، ولا تُشر إلى وجود تصحيح في الوثيقة.\\n') : '')
    + 'نتيجة تقييم الجاهزية: ' + JSON.stringify(rr || {}) + '\\n\\n'
    + 'اكتب وثيقة الخدمة كاملة ومتقنة، مبنية على أرقام الشركة الفعلية، عملية وقابلة للتنفيذ، مرتّبة بعناوين وخطوات واضحة. '
    + 'اكتبها بصيغة وثيقة رسمية صادرة عن حلول المرضي للاستشارات المالية، بلا أي إشارة لذكاء اصطناعي أو تقنية. '
    + 'مهم جداً في التأطير: هذه وثيقة استشارية و"خطة عمل" إرشادية تَقطع للعميل نصف المشوار وتجهّز الأرضية الكاملة — وليست بديلاً عن التنفيذ القانوني/المحاسبي النهائي (كاعتماد القوائم من محاسب مرخّص أو توثيق لوائح المجلس رسمياً). اجعل العميل يشعر بقيمتها كخارطة طريق جاهزة ودقيقة. '
    + 'أضف قبل سطر الإصدار فقرة ختامية بعنوان "الخطوة التالية مع فريق حلول المرضي" تقول بوضوح: إن رغبتم في إتمام الجوانب التنفيذية والقانونية الواردة في هذه الخطة (مثل اعتماد القوائم من محاسب مرخّص، أو توثيق لوائح ومحاضر المجلس، أو أي مخرج رسمي)، تواصلوا مع فريق حلول المرضي وسنرشدكم خطوة بخطوة وننفّذها معكم بسرعة عالية عبر محاسبنا ومستشارينا المعتمدين، بناءً على هذه الوثيقة الجاهزة. '
    + 'اكتب العنوان الرئيسي للوثيقة بصيغة "خطة: [اسم الخدمة]" أو "وثيقة استشارية وخطة عمل: [اسم الخدمة]". '
    + 'ابدأ مباشرة بمحتوى الوثيقة بصيغة نصية واضحة (يمكن استخدام عناوين بخطوط وفواصل)، واختم بسطر: "صادر عن: د. عبدالحكيم المرضي — حلول المرضي للاستشارات المالية".';

  for (const model of MODELS) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY as string, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model, max_tokens: 5000, messages: [{ role: 'user', content: prompt }] }),
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
