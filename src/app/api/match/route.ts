import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { suggestService, suggestionBox } from '@/lib/serviceSuggestion';
import { runScopedMatch, saveMatchResults, TYPE_LABELS } from '@/lib/matchEngine';


export async function POST(req: Request) {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (user === null) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

  let overrideId = '';
  let allowEntity = false;
  try { const b = await req.json(); overrideId = String((b || {}).company_id || ''); allowEntity = Boolean((b || {}).allow_entity); } catch {}
  const isAdmin = user.email === 'hololalmurdi.fs@gmail.com';
  const asAdmin = isAdmin && overrideId.length > 0;
  const db = asAdmin
    ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string)
    : supabase;

  const { data: company } = asAdmin
    ? await db.from('companies')
        .select('id, company_name, cr_number, city, sector, account_status, phone')
        .eq('id', overrideId)
        .single()
    : await db
    .from('companies')
    .select('id, company_name, cr_number, city, sector, account_status, phone')
    .eq('user_id', user.id)
    .single();

  if (company === null || company.account_status !== 'active') {
    return NextResponse.json({ error: 'الحساب غير مفعّل' }, { status: 403 });
  }

  const { data: fd } = await db
    .from('financial_data')
    .select('*')
    .eq('company_id', company.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  const { data: rr } = await db
    .from('readiness_results')
    .select('readiness_score, verdict')
    .eq('company_id', company.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (fd === null) return NextResponse.json({ error: 'لا توجد بيانات تقييم' }, { status: 404 });

  const isInvest = String(fd.assessment_type || 'funding') === 'investment';
  const soleEstab = /^\s*(مؤسسة|مؤسسه|موسسة|موسسه)/.test(String(company.company_name || ''));
  if (isInvest && soleEstab && !allowEntity) {
    return NextResponse.json({
      error: 'المؤسسة الفردية لا تُصدر حصصاً — لا يمكن دخول مستثمر قبل التحويل إلى شركة ذات مسؤولية محدودة. التحويل هو الخطوة الأولى، ثم تُفتح مطابقة المستثمرين.',
      blocker: 'entity_form',
      suggested_service: 'تحويل الكيان إلى شركة ذات مسؤولية محدودة تمهيداً لجولة استثمارية',
    }, { status: 409 });
  }

  const rev = Number(fd.annual_revenue) || 0;
  const years = Number(fd.years_operating) || 0;
  const typeLabel = fd.funding_type === 'other' ? (fd.funding_type_other || 'أخرى') : (TYPE_LABELS[fd.funding_type] || fd.funding_type);
  const trackLabel = isInvest ? 'استثمار' : 'تمويل';
  const askLabel = isInvest ? 'استثمار — حصة أو دين مرن' : typeLabel;
  const debtDesc = fd.has_debt
    ? 'يوجد تمويل قائم بقيمة أصلية ' + Number(fd.original_loan_amount || 0).toLocaleString() + ' ريال، المتبقي ' + Number(fd.debt_remaining || 0).toLocaleString() + ' ريال لدى ' + (fd.lender_name || 'جهة تمويل') + '، الحالة: ' + (fd.debt_status === 'late' ? 'متأخر ' + (fd.months_late || 0) + ' شهر' : 'ملتزم بالسداد')
    : 'لا توجد ديون قائمة';

  // ====== الطبقة 1: Claude يبحث في السوق ======
  const _m = await runScopedMatch({ company, fd, typeLabel, rev, years, debtDesc, isInvest });
  const webOffers = _m.offers;
  const webSearchOk = _m.ok;
  const webSearchError = _m.error;
  const _save = await saveMatchResults(company.id, isInvest ? 'investment' : 'funding', webOffers);

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

  const totalCount = webOffers.length;

  // تجميع الفجوات عبر كل الجهات
  const GAP_RULES: [RegExp, string][] = [
    [/مدقق|معتمد|قوائم مالي/, 'قوائم مالية مدققة أو معتمدة'],
    [/كفال|ضمان|رهن/, 'كفالة أو ضمان'],
    [/سجل تجاري|تجديد|ساري/, 'تجديد السجل التجاري'],
    [/حساب بنكي|كشف حساب|كشوفات/, 'حساب بنكي نشط وكشوفات'],
    [/عمر|سنوات|سنتين|تشغيلي/, 'عمر تشغيلي أطول'],
    [/زكا|ضريب/, 'الالتزام الزكوي والضريبي'],
    [/فاتور|فواتير|عقود|مستخلص/, 'فواتير أو عقود موثقة'],
    [/ائتمان|سمة|تصنيف/, 'السجل الائتماني'],
  ];
  const gapCount = new Map<string, number>();
  for (const o of webOffers) {
    const here = new Set<string>();
    for (const g of (o.gaps || [])) {
      const r = GAP_RULES.find(([re]) => re.test(String(g)));
      const label = r ? r[1] : String(g).slice(0, 40);
      if (here.has(label)) continue;
      here.add(label);
      gapCount.set(label, (gapCount.get(label) || 0) + 1);
    }
  }
  const gapBox = gapCount.size === 0 ? '' :
    '<div style="margin-top:18px;background:#FBF5E8;border:2px solid #E8D9A8;border-radius:10px;padding:14px 16px">'
    + '<div style="color:#9A7B2E;font-weight:900;font-size:14px;margin-bottom:8px">🔑 أكثر ما يقفل الأبواب (من ' + webOffers.length + ' جهة)</div>'
    + [...gapCount.entries()].sort((x, y) => y[1] - x[1]).slice(0, 8).map(([lbl, n]) =>
        '<div style="font-size:13px;color:#5C4A1F;padding:3px 0">• <b>' + lbl + '</b> — تشترطها ' + n + ' جهة</div>').join('')
    + '<div style="font-size:12px;color:#8A6D1A;margin-top:8px">عالج الأعلى تكراراً قبل المخاطبة — كل فجوة تُغلق تفتح عدة أبواب دفعة واحدة.</div></div>';

  // ====== ما يراه العميل: العدد والأنواع بدون أسماء ======
  const clientMatches = [
    ...webOffers.map((o) => ({
      funding_type: typeLabel,
      fit_percent: String(o.verdict || '').includes('بشرط') ? 70 : 90,
      reasons: ['الشروط المعلنة تتطابق مع ملف شركتك'],
      next_step: 'فريق مُرضي سيتولى التواصل وتجهيز ملفك',
    })),
    ...dbMatches.slice(0, 0).map((m) => ({
      funding_type: TYPE_LABELS[(m.product.funding_types as string[] || [])[0]] || 'منتج تمويلي',
      fit_percent: m.fit,
      reasons: ['ضمن شبكة جهات مُرضي المعتمدة'],
      next_step: 'فريق مُرضي سيتولى التواصل وتجهيز ملفك',
    })),
  ].slice(0, 80);

  // ====== الإيميل السري للأدمن: الأسماء والتفاصيل كاملة ======
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const regionBadge = (r?: string) => { const x = r || 'السعودية'; const c = x.includes('خليج') ? '#9A7B2E' : x.includes('دولي') ? '#A53B3B' : '#2E9E7B'; return '<span style="background:' + c + ';color:#fff;padding:2px 8px;border-radius:10px;font-size:11px">' + x + '</span>'; };
    const regionOrder = (r?: string) => { const x = r || ''; return x.includes('خليج') ? 1 : x.includes('دولي') ? 2 : 0; };
    const sortedOffers = [...webOffers].sort((a, b) => regionOrder(a.region) - regionOrder(b.region));
    const webRows = sortedOffers.map((o) =>
      '<tr><td style="padding:8px;border:1px solid #ddd">' + regionBadge(o.region) + '</td>'
      + '<td style="padding:8px;border:1px solid #ddd"><b>' + o.provider + '</b></td>'
      + '<td style="padding:8px;border:1px solid #ddd">' + o.product + '</td>'
      + '<td style="padding:8px;border:1px solid #ddd">' + o.requirements + '</td>'
      + '<td style="padding:8px;border:1px solid #ddd"><b>' + (o.verdict || '—') + '</b>' + ((o.gaps && o.gaps.length) ? '<br><span style="color:#9A7B2E;font-size:11px">ينقص: ' + o.gaps.join('، ') + '</span>' : '') + (o.amountRange ? '<br><span style="font-size:11px">المبلغ: ' + o.amountRange + '</span>' : '') + (o.timeline ? '<br><span style="font-size:11px">المدة: ' + o.timeline + '</span>' : '') + (o.saudiPrecedent ? '<br><span style="color:#2E9E7B;font-size:11px">سابقة: ' + o.saudiPrecedent + '</span>' : '') + (o.legalPath ? '<br><span style="color:#9A7B2E;font-size:11px">المسار: ' + o.legalPath + '</span>' : '') + '</td>'
      + '<td style="padding:8px;border:1px solid #ddd"><a href="' + o.source + '">المصدر</a></td></tr>'
    ).join('');
    const dbRows = dbMatches.slice(0, 0).map((m) =>
      '<tr><td style="padding:8px;border:1px solid #ddd"><b>' + (m.product.provider_name || m.product.product_name || '—') + '</b></td>'
      + '<td style="padding:8px;border:1px solid #ddd">' + (m.product.product_name || '—') + '</td>'
      + '<td style="padding:8px;border:1px solid #ddd">ملاءمة ' + m.fit + '%</td></tr>'
    ).join('');

    await resend.emails.send({
      from: 'د. عبدالحكيم المرضي <noreply@murdi.sa>',
      to: 'hololalmurdi.fs@gmail.com',
      subject: 'مطابقة ' + trackLabel + ' — ' + company.company_name + ' (' + totalCount + ' فرصة)',
      html:
        '<div dir="rtl" style="font-family:Arial">'
        + '<h2>مطابقة ' + trackLabel + ' جديدة</h2>'
        + '<p><b>الشركة:</b> ' + company.company_name + ' — سجل: ' + company.cr_number + '</p>'
        + '<p><b>الجوال:</b> ' + (company.phone || '—') + ' | <b>درجة الجاهزية:</b> ' + (rr?.readiness_score ?? '—') + ' — ' + (rr?.verdict ?? '') + '</p>'
        + '<p><b>المطلوب:</b> ' + askLabel + ' | <b>عروض السوق:</b> ' + webOffers.length + '</p>'
        + (webOffers.length === 0 && !webSearchOk ? '<p style="color:#A33">⚠️ تعذر بحث السوق: ' + (webSearchError || 'تحقق من ANTHROPIC_API_KEY في Vercel') + '</p>' : '')
        + '<hr/>'
        + gapBox
        + (webRows ? '<h3 style="margin-top:18px">🌐 عروض السوق (بحث مباشر)</h3><table style="border-collapse:collapse;width:100%;font-size:13px"><tr style="background:#1A3D34;color:#fff"><th style="padding:8px;border:1px solid #ddd">المنطقة</th><th style="padding:8px;border:1px solid #ddd">الجهة</th><th style="padding:8px;border:1px solid #ddd">المنتج</th><th style="padding:8px;border:1px solid #ddd">المتطلبات</th><th style="padding:8px;border:1px solid #ddd">الملاءمة</th><th style="padding:8px;border:1px solid #ddd">المصدر</th></tr>' + webRows + '</table>' : '')
        + (dbRows ? '<h3 style="margin-top:18px">🔒 شبكة مُرضي المعتمدة</h3><table style="border-collapse:collapse;width:100%;font-size:13px"><tr style="background:#C9A84C;color:#1A3D34"><th style="padding:8px;border:1px solid #ddd">الجهة</th><th style="padding:8px;border:1px solid #ddd">المنتج</th><th style="padding:8px;border:1px solid #ddd">الملاءمة</th></tr>' + dbRows + '</table>' : '')
        + '<p style="margin-top:18px"><a href="https://murdi.sa/admin/approvals" style="background:#1A3D34;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold">📂 افتح الملف الكامل في الأدمن</a></p>'
        + suggestionBox(suggestService({ ...fd }, isInvest ? 'investment' : 'funding', Number(rr?.readiness_score) || 0))
        + '</div>',
    });
  } catch {}

  return NextResponse.json({
    ok: true,
    match_count: totalCount,
    saved: _save.saved,
    save_error: _save.error,
    matches: clientMatches,
  });
}
