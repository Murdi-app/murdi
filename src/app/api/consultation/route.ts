import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

const MODELS = ['claude-opus-4-8', 'claude-sonnet-4-6'];

async function generateWithFallback(prompt: string): Promise<{ text: string; model: string } | null> {
  for (const model of MODELS) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY as string,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: 8000,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      if (!res.ok) continue;
      const data = await res.json();
      const text = (data.content || [])
        .filter((b: { type: string }) => b.type === 'text')
        .map((b: { text: string }) => b.text)
        .join('');
      if (text && text.length > 100) return { text, model };
    } catch { continue; }
  }
  return null;
}

// توليد الاستشارة (يستدعى تلقائياً بعد التقييم)
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const aType: string = ['funding', 'investment', 'ipo'].includes(body?.type) ? body.type : 'funding';
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
    .select('id, company_name, sector, city, account_status')
    .eq('user_id', user.id)
    .single();

  if (company === null || company.account_status !== 'active') {
    return NextResponse.json({ error: 'الحساب غير مفعّل' }, { status: 403 });
  }

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  );

  // لا نولّد نسخة جديدة إذا توجد واحدة قيد التحليل أو صادرة
  const { data: existing, error: exErr } = await adminClient
    .from('consultations')
    .select('id, status')
    .eq('company_id', company.id)
    .eq('assessment_type', aType)
    .order('created_at', { ascending: false })
    .limit(1);

  if (exErr) return NextResponse.json({ error: 'فحص الاستشارات: ' + exErr.message }, { status: 500 });
  if (existing && existing.length > 0 && existing[0].status !== 'failed') {
    return NextResponse.json({ ok: true, status: existing[0].status });
  }

  // إنشاء سجل بحالة "جارٍ التحليل" فوراً (العميل يرى البطاقة)
  const { data: created, error: crErr } = await adminClient
    .from('consultations')
    .insert({ company_id: company.id, status: 'analyzing', assessment_type: aType })
    .select('id')
    .single();

  if (crErr || created === null) return NextResponse.json({ error: 'فشل الإنشاء: ' + (crErr?.message || 'غير معروف') }, { status: 500 });

  // جلب بيانات العميل كاملة للتحليل
  let fdQuery = adminClient
    .from('financial_data')
    .select('*')
    .eq('company_id', company.id);
  if (aType !== 'funding') fdQuery = fdQuery.eq('assessment_type', aType);
  const { data: fd } = await fdQuery
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  const { data: rr } = await adminClient
    .from('readiness_results')
    .select('*')
    .eq('company_id', company.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();


  const FOCUS: Record<string, string> = {
    funding: 'ركّز على جاهزية التمويل: كلفة التمويل الحقيقية، نسبة الدين للإيرادات، التدفق النقدي، سمة، وشروط الجهات التمويلية. الطابع: عملي يحل مشكلة سيولة أو دين.',
    investment: 'ركّز على جاذبية الشركة لمستثمر: هامش الربح، النمو، الحوكمة، فصل الملكية عن الإدارة، التقييم العادل، وما يطمئن المستثمر المؤسسي. الطابع: بناء قيمة وإقناع مستثمر.',
    ipo: 'ركّز على جاهزية الطرح العام: الإفصاح، المراجعة الخارجية، الحوكمة المؤسسية، اللجان، السجل التشغيلي، ومتطلبات هيئة السوق المالية. الطابع: انضباط مؤسسي وشفافية نظامية.',
  };
  const ATYPE_AR: Record<string, string> = { funding: 'التمويل', investment: 'الاستثمار', ipo: 'الطرح العام' };

  const prompt = 'أنت تكتب نيابة عن د. عبدالحكيم المرضي — مستشار مالي سعودي، دكتوراه إدارة أعمال، عضوية البورد الأمريكي، 15 سنة خبرة في القطاع المالي وعلاقات مباشرة مع جهات التمويل السعودية. أسلوبه: مباشر، عملي، صريح بلا مجاملات فارغة، يحلل بعمق ويعطي خطوات قابلة للتنفيذ فوراً.\n\n'
    + 'هذه استشارة في مسار ' + ATYPE_AR[aType] + '. ' + FOCUS[aType] + '\n\n'
    + 'اكتب "استشارة خاصة" من صفحتين (1000-1300 كلمة) لهذه الشركة:\n'
    + '- الاسم: ' + company.company_name + '\n'
    + '- القطاع: ' + (company.sector || 'غير محدد') + ' | المدينة: ' + (company.city || 'غير محددة') + '\n'
    + '- بيانات التقييم: ' + JSON.stringify(fd || {}) + '\n'
    + '- نتيجة الجاهزية: ' + JSON.stringify(rr || {}) + '\n\n'
    + 'هيكل الاستشارة (Markdown):\n'
    + '# استشارة د. عبدالحكيم المرضي الخاصة لشركة ' + company.company_name + ' — مسار ' + ATYPE_AR[aType] + '\n'
    + '## أولاً: قراءتي لوضعكم الحالي — تحليل عميق ومخصص لأرقامهم الفعلية (نسب، مقارنات بالسوق السعودي، مخاطر حقيقية). ممنوع الكلام العام.\n'
    + '## ثانياً: خطة النجاح — خطة عملية مرتبة زمنياً (30/90/180 يوم) كل بند مرتبط بأرقامهم.\n'
    + '## ثالثاً: توعية مالية يحتاجها صاحب هذه الشركة تحديداً — 4-5 مفاهيم مرتبطة بوضعهم (مثلاً إن كان عندهم دين: كيف تقرأ كلفة التمويل الحقيقية).\n'
    + '## رابعاً: كلمة أخيرة — فقرة ختامية شخصية محفزة وواقعية.\n\n'
    + 'مهم: كل جملة يجب أن تكون مخصصة لأرقام هذه الشركة. لا تكتب أي عبارة تصلح لأي شركة أخرى. مهم: أكمل الاستشارة حتى نهاية قسم كلمة أخيرة — لا تتوقف في المنتصف أبداً. قواعد الهوية: الاستشارة باسم د. عبدالحكيم المرضي وفريقه عبر منصة مُرضي — ممنوع ذكر أو تلميح لأي ذكاء اصطناعي أو نموذج أو Claude أو تقنية مهما كان السياق. وقاعدة السرية التجارية: ممنوع ذكر أسماء جهات أو منصات أو برامج تمويل كقنوات تقديم — التوصية دائماً أن المطابقة والترشيح يتمان عبر شبكة مُرضي وفريق د. عبدالحكيم. يجوز ذكر الجهات التنظيمية فقط (سمة، هيئة المراجعين، هيئة الزكاة) كمتطلبات إجرائية.';

  const result = await generateWithFallback(prompt);

  if (result === null) {
    await adminClient.from('consultations')
      .update({ status: 'failed' })
      .eq('id', created.id);
    return NextResponse.json({ ok: false, status: 'failed' });
  }

  await adminClient.from('consultations')
    .update({ status: 'ready', content: result.text, generated_at: new Date().toISOString() })
    .eq('id', created.id);

  return NextResponse.json({ ok: true, status: 'ready' });
}

// جلب حالة/محتوى الاستشارة (للعميل وللأدمن)
export async function GET() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (user === null) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

  const isAdmin = user.email === 'hololalmurdi.fs@gmail.com';
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  );

  if (isAdmin) {
    const { data } = await adminClient
      .from('consultations')
      .select('id, company_id, status, content, generated_at, released_at, assessment_type, companies(company_name)')
      .order('created_at', { ascending: false });
    return NextResponse.json({ consultations: data || [] });
  }

  const { data: company } = await supabase
    .from('companies').select('id').eq('user_id', user.id).single();
  if (company === null) return NextResponse.json({ consultations: {} });

  const { data: rows } = await adminClient
    .from('consultations')
    .select('status, content, released_at, assessment_type, created_at')
    .eq('company_id', company.id)
    .order('created_at', { ascending: false });

  // أحدث استشارة لكل مسار، والمحتوى لا يظهر إلا بعد الإصدار
  const byType: Record<string, { status: string; content: string | null; released_at: string | null }> = {};
  for (const r of rows || []) {
    const t = (r.assessment_type as string) || 'funding';
    if (byType[t]) continue;
    byType[t] = {
      status: r.status as string,
      content: r.status === 'released' ? (r.content as string) : null,
      released_at: r.released_at as string | null,
    };
  }
  return NextResponse.json({ consultations: byType });
}

// إصدار الاستشارة (أدمن فقط — زرّك)
export async function PATCH(req: Request) {
  const body = await req.json();
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (user === null || user.email !== 'hololalmurdi.fs@gmail.com') {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  }

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  );

  await adminClient.from('consultations')
    .update({ status: 'released', released_at: new Date().toISOString(), released_by: user.email })
    .eq('id', body.id);

  return NextResponse.json({ ok: true });
}
