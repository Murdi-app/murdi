import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const TYPE_LABELS: Record<string, string> = {
  cash: 'تمويل نقدي',
  working_capital: 'رأس مال عامل',
  revenue: 'تمويل الإيرادات',
  pos: 'تمويل نقاط البيع',
  invoices: 'تمويل الفواتير والمستخلصات',
  assets: 'تمويل أصول ومعدات',
  vehicles: 'تمويل مركبات وأساطيل',
  real_estate: 'عقاري تجاري',
  lc: 'اعتمادات وخطابات ضمان',
  project: 'تمويل مشاريع وعقود',
};

export async function POST() {
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
    .select('id, company_name, cr_number, city, sector, account_status')
    .eq('user_id', user.id)
    .single();

  if (company === null || company.account_status !== 'active') {
    return NextResponse.json({ error: 'الحساب غير مفعّل' }, { status: 403 });
  }

  const { data: fd } = await supabase
    .from('financial_data')
    .select('*')
    .eq('company_id', company.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  const { data: rr } = await supabase
    .from('readiness_results')
    .select('readiness_score, verdict')
    .eq('company_id', company.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (fd === null) return NextResponse.json({ error: 'لا توجد بيانات تقييم' }, { status: 404 });

  const rev = Number(fd.annual_revenue) || 0;
  const years = Number(fd.years_operating) || 0;
  const typeLabel = fd.funding_type === 'other' ? (fd.funding_type_other || 'أخرى') : (TYPE_LABELS[fd.funding_type] || fd.funding_type);
  const debtDesc = fd.has_debt
    ? 'يوجد تمويل قائم بقيمة أصلية ' + Number(fd.original_loan_amount || 0).toLocaleString() + ' ريال، المتبقي ' + Number(fd.debt_remaining || 0).toLocaleString() + ' ريال لدى ' + (fd.lender_name || 'جهة تمويل') + '، الحالة: ' + (fd.debt_status === 'late' ? 'متأخر ' + (fd.months_late || 0) + ' شهر' : 'ملتزم بالسداد')
    : 'لا توجد ديون قائمة';

  // ====== الطبقة 1: Claude يبحث في السوق ======
  type WebOffer = { provider: string; product: string; requirements: string; fit: string; source: string };
  let webOffers: WebOffer[] = [];
  let webSearchOk = false;
  let webSearchError = '';

  try {
    const LICENSED = 'البنوك المرخصة: البنك الأهلي السعودي، مصرف الراجحي، بنك الرياض، البنك السعودي الأول (ساب)، البنك السعودي الفرنسي، البنك العربي الوطني، بنك البلاد، بنك الجزيرة، مصرف الإنماء، البنك السعودي للاستثمار، بنك الخليج الدولي السعودية. شركات التمويل المرخصة من البنك المركزي السعودي (ساما): شركة الأمثل للتمويل، شركة أملاك العالمية، شركة دار التمليك، شركة بداية لتمويل المنازل، الشركة السعودية لتمويل المساكن (سهل)، شركة عبداللطيف جميل المتحدة للتمويل، شركة اليسر للإجارة والتمويل، شركة الراجحي للتمويل، شركة نايفات للتمويل، شركة أمكان للتمويل، شركة تمويل الأولى، شركة المتاجرة المالية، شركة أصيل للتمويل، شركة التيسير العربية، شركة ميفك كابيتال، شركة تسهيل للتمويل، شركة فيول للتمويل، شركة منافع للتمويل، شركة عِمكان للتمويل، شركة سلفة للتمويل، شركة تمام للتمويل (stc)، شركة ماني فيلوز، شركة فورس للتمويل، شركة ميسر للتمويل، شركة لندو (Lendo)، شركة فنتك ردف، منصة فرقد المالية، شركة مرابحة مرنة، شركة تروي (Tarabut)، منصة ليندو، شركة قرض للتمويل الجماعي';
    const prompt = 'أنت محلل تمويل سعودي خبير. ابحث في الويب عن المنتجات التمويلية المتاحة حالياً للشركات في السعودية، حصرياً من الجهات التالية المرخصة من البنك المركزي السعودي ولا تذكر أي جهة خارجها:\n' + LICENSED + '\n\n'
      + 'ملف الشركة الباحثة عن تمويل:\n'
      + '- نوع التمويل المطلوب: ' + typeLabel + '\n'
      + '- الإيرادات السنوية: ' + rev.toLocaleString() + ' ريال\n'
      + '- عمر النشاط: ' + years + ' سنة\n'
      + '- القطاع: ' + (company.sector || 'غير محدد') + '\n'
      + '- ' + debtDesc + '\n'
      + '- سجل تجاري ' + (fd.cr_valid ? 'ساري' : 'غير ساري') + '، التزام ضريبي: ' + (fd.tax_compliant ? 'نعم' : 'لا') + '، زكاة: ' + (fd.zakat_compliant ? 'نعم' : 'لا') + '، قوائم مالية: ' + (fd.has_financial_statements ? 'متوفرة' : 'غير متوفرة') + '\n\n'
      + 'ابحث عن منتجات ' + typeLabel + ' للشركات لدى هذه الجهات. مهم جداً: أرجع دائماً أفضل 4-6 منتجات وجدتها حتى لو لم تتطابق كل الشروط — واذكر في حقل fit ما يتطابق وما ينقص الشركة. لا ترجع قائمة فارغة إلا إذا لم تجد أي منتج إطلاقاً.\n\n'
      + 'أرجع JSON فقط بدون أي نص آخر وبدون markdown، بهذا الشكل:\n'
      + '{"offers":[{"provider":"اسم الجهة","product":"اسم المنتج","requirements":"الشروط المعلنة باختصار","fit":"لماذا يناسب هذه الشركة","source":"رابط المصدر"}]}\n'
      + 'أقصى عدد 6 عروض، رتبها من الأنسب للأقل.';

    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY as string,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 3000,
        messages: [{ role: 'user', content: prompt }],
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }],
      }),
    });

    if (!aiRes.ok) { webSearchError = 'HTTP ' + aiRes.status + ': ' + (await aiRes.text()).slice(0, 300); }
    if (aiRes.ok) {
      const aiData = await aiRes.json();
      const text = (aiData.content || [])
        .filter((b: { type: string }) => b.type === 'text')
        .map((b: { text: string }) => b.text)
        .join('');
      const cleaned = text.replace(/```json|```/g, '').trim();
      const jsonStart = cleaned.indexOf('{');
      const jsonEnd = cleaned.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd > jsonStart) {
        const parsed = JSON.parse(cleaned.slice(jsonStart, jsonEnd + 1));
        if (Array.isArray(parsed.offers)) {
          webOffers = parsed.offers.slice(0, 6);
          webSearchOk = true;
        }
      }
    }
  } catch (err) {
    webSearchError = err instanceof Error ? err.message : String(err);
  }

  // ====== الطبقة 2: مطابقة قاعدة جهاتك الخاصة ======
  type DbMatch = { product: Record<string, unknown>; fit: number };
  const dbMatches: DbMatch[] = [];

  try {
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      process.env.SUPABASE_SERVICE_ROLE_KEY as string
    );
    const { data: products } = await adminClient.from('financing_products').select('*');
    const isLate = fd.has_debt === true && fd.debt_status === 'late';
    const monthsLate = Number(fd.months_late) || 0;

    for (const p of products || []) {
      if (p.min_revenue && rev < Number(p.min_revenue)) continue;
      if (p.min_years_operating && years < Number(p.min_years_operating)) continue;
      if (isLate && p.accepts_late_debt !== true) continue;
      if (isLate && monthsLate > Number(p.max_months_late || 0)) continue;
      if (p.requires_statements === true && fd.has_financial_statements !== true) continue;
      if (p.requires_zakat === true && fd.zakat_compliant !== true) continue;
      const types: string[] = p.funding_types || [];
      let fit = 60;
      if (types.includes(fd.funding_type)) fit += 30;
      if (fd.has_debt === false) fit += 8;
      dbMatches.push({ product: p, fit: Math.min(fit, 97) });
    }
    dbMatches.sort((a, b) => b.fit - a.fit);
  } catch {}

  const totalCount = webOffers.length + dbMatches.length;

  // ====== ما يراه العميل: العدد والأنواع بدون أسماء ======
  const clientMatches = [
    ...webOffers.map(() => ({
      funding_type: typeLabel,
      fit_percent: 0,
      reasons: ['الشروط المعلنة تتطابق مع ملف شركتك'],
      next_step: 'فريق مُرضي سيتولى التواصل وتجهيز ملفك',
    })),
    ...dbMatches.slice(0, 5).map((m) => ({
      funding_type: TYPE_LABELS[(m.product.funding_types as string[] || [])[0]] || 'منتج تمويلي',
      fit_percent: m.fit,
      reasons: ['ضمن شبكة جهات مُرضي المعتمدة'],
      next_step: 'فريق مُرضي سيتولى التواصل وتجهيز ملفك',
    })),
  ].slice(0, 6).map((m, i) => ({ ...m, fit_percent: m.fit_percent || (92 - i * 4) }));

  // ====== الإيميل السري للأدمن: الأسماء والتفاصيل كاملة ======
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const webRows = webOffers.map((o) =>
      '<tr><td style="padding:8px;border:1px solid #ddd"><b>' + o.provider + '</b></td>'
      + '<td style="padding:8px;border:1px solid #ddd">' + o.product + '</td>'
      + '<td style="padding:8px;border:1px solid #ddd">' + o.requirements + '</td>'
      + '<td style="padding:8px;border:1px solid #ddd">' + o.fit + '</td>'
      + '<td style="padding:8px;border:1px solid #ddd"><a href="' + o.source + '">المصدر</a></td></tr>'
    ).join('');
    const dbRows = dbMatches.slice(0, 5).map((m) =>
      '<tr><td style="padding:8px;border:1px solid #ddd"><b>' + (m.product.provider_name || m.product.product_name || '—') + '</b></td>'
      + '<td style="padding:8px;border:1px solid #ddd">' + (m.product.product_name || '—') + '</td>'
      + '<td style="padding:8px;border:1px solid #ddd">ملاءمة ' + m.fit + '%</td></tr>'
    ).join('');

    await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: 'hololalmurdi.fs@gmail.com',
      subject: 'مطابقة تمويل — ' + company.company_name + ' (' + totalCount + ' فرصة)',
      html:
        '<div dir="rtl" style="font-family:Arial">'
        + '<h2>مطابقة تمويل جديدة</h2>'
        + '<p><b>الشركة:</b> ' + company.company_name + ' — سجل: ' + company.cr_number + '</p>'
        + '<p><b>درجة الجاهزية:</b> ' + (rr?.readiness_score ?? '—') + ' — ' + (rr?.verdict ?? '') + '</p>'
        + '<p><b>المطلوب:</b> ' + typeLabel + ' | <b>الإيرادات:</b> ' + rev.toLocaleString() + ' ر.س | <b>العمر:</b> ' + years + ' سنة | <b>بنك الشركة:</b> ' + (fd.company_bank || '—') + '</p>'
        + '<p><b>الديون:</b> ' + debtDesc + (fd.has_debt ? ' | القسط الشهري: ' + Number(fd.monthly_installment || 0).toLocaleString() + ' ر.س' : '') + '</p>'
        + '<hr/>'
        + '<h3>🔍 عروض السوق (بحث Claude — ' + webOffers.length + ')</h3>'
        + (webOffers.length > 0
          ? '<table style="border-collapse:collapse"><tr style="background:#E8F5EF"><th style="padding:8px;border:1px solid #ddd">الجهة</th><th style="padding:8px;border:1px solid #ddd">المنتج</th><th style="padding:8px;border:1px solid #ddd">الشروط المعلنة</th><th style="padding:8px;border:1px solid #ddd">سبب الملاءمة</th><th style="padding:8px;border:1px solid #ddd">المصدر</th></tr>' + webRows + '</table>'
          : '<p>' + (webSearchOk ? 'لم يجد البحث منتجات معلنة مطابقة' : '⚠️ تعذر البحث: ' + (webSearchError || 'استجابة غير صالحة من API — تحقق من ANTHROPIC_API_KEY في Vercel')) + '</p>')
        + '<h3>🤝 شبكة مُرضي (' + dbMatches.length + ')</h3>'
        + (dbMatches.length > 0
          ? '<table style="border-collapse:collapse"><tr style="background:#E8F5EF"><th style="padding:8px;border:1px solid #ddd">الجهة</th><th style="padding:8px;border:1px solid #ddd">المنتج</th><th style="padding:8px;border:1px solid #ddd">الملاءمة</th></tr>' + dbRows + '</table>'
          : '<p>لا مطابقة من القاعدة الداخلية</p>')
        + '</div>',
    });
  } catch {}

  return NextResponse.json({
    ok: true,
    match_count: totalCount,
    matches: clientMatches,
  });
}
