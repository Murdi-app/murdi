import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';


async function searchInvestors(sector: string, revenue: number, stage: string): Promise<string> {
  const MODELS = ['claude-fable-5', 'claude-sonnet-4-5-20250929'];
  const prompt = 'أنت باحث استثماري محترف يعمل لصالح د. عبدالحكيم المرضي (شركة حلول المرضي للاستشارات المالية، السعودية). ابحث في الويب عن جهات استثمار سعودية نشطة مناسبة لشركة بهذا الملف:\n'
    + 'القطاع: ' + sector + ' | الإيرادات السنوية: ' + revenue + ' ريال | المرحلة: ' + stage + '\n\n'
    + 'ابحث عن ثلاث فئات: (1) صناديق استثمار جريء وملكية خاصة سعودية نشطة حالياً، (2) محافظ عائلية سعودية (Family Offices) معلنة الاهتمام بهذا القطاع، (3) مستثمرون أفراد أقوياء معلنون — رواد أعمال خرجوا من شركاتهم ببيع ناجح، مستثمرون ملائكيون معروفون إعلامياً ونشطون في هذا القطاع.\n\n'
    + 'لكل جهة أو شخص اجمع: الاسم، الفئة، تركيزهم الاستثماري، حجم الاستثمار المعتاد إن وجد، آخر استثماراتهم المعلنة، وأي بيانات تواصل معلنة (موقع رسمي، إيميل عام، لينكدإن، حساب X). اعتمد حصرياً على معلومات معلنة من مصادر موثوقة واذكر المصدر لكل جهة.\n'
    + 'أرجع أفضل 4-8 نتائج مرتبة بالملاءمة، مع سطر لكل جهة يشرح لماذا تناسب هذا الملف تحديداً. أجب بالعربية بتنسيق واضح.';

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
          max_tokens: 4000,
          messages: [{ role: 'user', content: prompt }],
          tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }],
        }),
      });
      if (!res.ok) continue;
      const data = await res.json();
      const text = (data.content || [])
        .filter((b: { type: string }) => b.type === 'text')
        .map((b: { text: string }) => b.text)
        .join('\n').trim();
      if (text.length > 100) return text;
    } catch { continue; }
  }
  return '';
}

function normalizeAr(t: string): string {
  return (t || '').trim().replace(/^ال/, '').replace(/ة$/, 'ه').replace(/[أإآ]/g, 'ا').toLowerCase();
}
function sectorMatch(list: string[], val: string): boolean {
  if (!list || list.length === 0) return true;
  const v = normalizeAr(val);
  return list.some(x => {
    const n = normalizeAr(x);
    return n === v || n.includes(v) || v.includes(n);
  });
}

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
    .eq('assessment_type', 'investment')
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

  if (fd === null) return NextResponse.json({ error: 'لا توجد بيانات تقييم استثمار' }, { status: 404 });

  const score = rr?.readiness_score ?? 0;
  if (score < 70) {
    return NextResponse.json({ ok: true, match_count: 0, matches: [], reason: 'الدرجة أقل من الحد الأدنى للمطابقة (70)' });
  }

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  );

  const { data: entities } = await adminClient
    .from('investment_entities')
    .select('*');

  const rev = Number(fd.annual_revenue) || 0;

  type Match = { entity: Record<string, unknown>; fit: number; reasons: string[] };
  const matches: Match[] = [];

  for (const e of entities || []) {
    const reasons: string[] = [];
    let fit = 0;

    if (e.min_revenue && rev < Number(e.min_revenue)) continue;
    if (e.min_murdi_score && score < Number(e.min_murdi_score)) continue;
    if (e.requires_audited === true && fd.audited_statements !== true) continue;
    if (e.requires_governance === true && fd.has_governance !== true) continue;

    const sectors: string[] = e.sectors || [];
    if (sectorMatch(sectors, fd.sector)) {
      fit += 30; reasons.push('قطاع شركتك ضمن اهتمامات هذه الجهة');
    } else {
      continue;
    }

    const stages: string[] = e.stages || [];
    if (stages.length === 0 || stages.includes(fd.company_stage)) {
      fit += 20; reasons.push('مرحلة شركتك تناسب استراتيجية الجهة');
    } else {
      fit += 5;
    }

    if (score >= 85) { fit += 25; reasons.push('درجة جاهزية عالية جداً'); }
    else if (score >= 75) { fit += 18; reasons.push('درجة جاهزية قوية'); }
    else { fit += 12; reasons.push('درجة الجاهزية تحقق الحد الأدنى'); }

    if (fd.audited_statements === true) { fit += 13; reasons.push('قوائم مالية مراجعة خارجياً'); }
    if (fd.has_governance === true) { fit += 10; reasons.push('نظام حوكمة قائم'); }

    matches.push({ entity: e, fit: Math.min(fit, 97), reasons });
  }

  matches.sort((a, b) => b.fit - a.fit);

  const STAGE_LABELS: Record<string, string> = {
    growth: 'صناديق نمو',
    established: 'محافظ استثمارية',
    expansion: 'صناديق توسع وملكية خاصة',
    restructuring: 'شركاء استراتيجيون',
  };

  const clientView = matches.slice(0, 5).map((m) => ({
    funding_type: STAGE_LABELS[fd.company_stage] || 'جهة استثمارية',
    fit_percent: m.fit,
    reasons: m.reasons,
    next_step: 'فريق مرضي سيتولى التواصل مع الجهة وعرض ملفك',
  }));

  await adminClient.from('investment_matches').insert({
    company_id: company.id,
    match_count: matches.length,
    provider_details: matches.slice(0, 5).map((m) => ({ entity: m.entity, fit: m.fit })),
  });

  try {
    let investorSearch = '';
    try {
      investorSearch = await searchInvestors(company?.sector || 'غير محدد', Number(fd?.annual_revenue) || 0, fd?.company_stage || 'نمو');
    } catch {}

    const resend = new Resend(process.env.RESEND_API_KEY);
    const rows = matches.slice(0, 5).map((m) =>
      '<tr><td style="padding:8px;border:1px solid #ddd">' + (m.entity.entity_name || m.entity.name || '—') +
      '</td><td style="padding:8px;border:1px solid #ddd">' + m.fit + '%</td></tr>'
    ).join('');

    await resend.emails.send({
      from: 'د. عبدالحكيم المرضي <noreply@murdi.sa>',
      to: 'hololalmurdi.fs@gmail.com',
      subject: 'مطابقة استثمار جديدة — ' + company.company_name,
      html:
        '<div dir="rtl" style="font-family:Arial">' +
        '<h2>مطابقة استثمار جديدة</h2>' +
        '<p><b>الشركة:</b> ' + company.company_name + ' — سجل: ' + company.cr_number + '</p>' +
        '<p><b>القطاع:</b> ' + (fd.sector || company.sector || '—') + ' | <b>المرحلة:</b> ' + (fd.company_stage || '—') + '</p>' +
        '<p><b>درجة الجاهزية:</b> ' + score + ' — ' + (rr?.verdict ?? '') + '</p>' +
        '<p><b>الإيرادات:</b> ' + rev.toLocaleString() + ' ر.س | <b>صافي الربح:</b> ' + Number(fd.net_profit || 0).toLocaleString() + ' ر.س</p>' +
        '<p><b>قوائم مراجعة:</b> ' + (fd.audited_statements ? 'نعم' : 'لا') + ' | <b>حوكمة:</b> ' + (fd.has_governance ? 'نعم' : 'لا') + '</p>' +
        '<table style="border-collapse:collapse;margin-top:12px"><tr style="background:#E8F5EF">' +
        '<th style="padding:8px;border:1px solid #ddd">الجهة</th><th style="padding:8px;border:1px solid #ddd">الملاءمة</th></tr>' +
        rows + '</table></div>',
    });
  } catch {}

  return NextResponse.json({
    ok: true,
    match_count: matches.length,
    matches: clientView,
  });
}
