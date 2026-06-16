import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';


async function searchInvestors(sector: string, revenue: number, stage: string): Promise<string> {
  const MODELS = ['claude-opus-4-8', 'claude-sonnet-4-6'];
  const prompt = 'انت باحث استثماري محترف يعمل لصالح د. عبدالحكيم المرضي (شركة حلول المرضي للاستشارات المالية، السعودية). ابحث في الويب عن جهات استثمار سعودية نشطة مناسبة لشركة بهذا الملف: '
    + 'القطاع: ' + sector + ' | الايرادات السنوية: ' + revenue + ' ريال | المرحلة: ' + stage + '. '
    + 'ابحث عن ثلاث فئات: (1) صناديق استثمار جريء وملكية خاصة سعودية، (2) محافظ ومكاتب عائلية سعودية، (3) مستثمرون افراد اقوياء نشطون في هذا القطاع. '
    + 'مهم جدا في التنسيق: '
    + 'ابدأ اجابتك بقسم بعنوان (الخلاصة التنفيذية) يذكر افضل 3 جهات للتواصل الان فقط، كل واحدة في سطر واحد مختصر: الاسم ثم سبب الاولوية. '
    + 'ثم قسم (التفاصيل) لكل جهة: الاسم، الفئة، التركيز الاستثماري، حجم الاستثمار المعتاد ان وجد، وسبب الملاءمة لهذه الشركة. '
    + 'والاهم: لكل جهة اعطِ سطر (طريقة الوصول العملية) يحدد خطوة تواصل واحدة واضحة ومحددة فقط (مثل: راسلهم عبر نموذج التواصل في موقعهم الرسمي مع الرابط المباشر، او عبر بريد الاستثمار المعلن ان وُجد) — لا تعطِ عدة خيارات ولا تكتفي بقول ابحث في لينكدإن، بل حدد الخطوة الافضل عمليا. '
    + 'ارجع افضل 4 الى 6 جهات مرتبة بالملاءمة. اجب بالعربية، مختصر ومباشر بلا حشو.';

  let diag = '';
  for (const model of MODELS) {
    try {
      const messages: { role: string; content: unknown }[] = [{ role: 'user', content: prompt }];
      let textOut = '';
      for (let turn = 0; turn < 5; turn++) {
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
            messages,
            tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }],
          }),
        });
        if (!res.ok) { diag = model + ' HTTP ' + res.status + ': ' + (await res.text()).slice(0, 300); break; }
        const data = await res.json();
        const content = (data.content || []) as { type: string; text?: string }[];
        textOut += content.filter((b) => b.type === 'text').map((b) => b.text || '').join(' ');
        if (data.stop_reason === 'pause_turn') {
          messages.push({ role: 'assistant', content: data.content });
          continue;
        }
        break;
      }
      textOut = textOut.trim();
      if (textOut.length > 80) return textOut;
      if (diag === '') diag = model + ': رد فارغ بلا توقف';
    } catch (e) {
      diag = model + ' خطأ: ' + (e instanceof Error ? e.message : String(e));
      continue;
    }
  }
  return diag !== '' ? ('تشخيص البحث (يظهر لك انت فقط مؤقتا): ' + diag) : '';
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

async function generateRecoveryPath(data: Record<string, unknown>): Promise<string> {
  const MODELS = ['claude-opus-4-8', 'claude-sonnet-4-6'];
  const prompt = 'انت مستشار مالي وفق منهجية د. عبدالحكيم المرضي. الشركة متعثرة في سداد ديونها، فالمستثمر لا يدخلها الان. '
    + 'بياناتها: ' + JSON.stringify(data) + '. '
    + 'اكتب مسار تعافي واقعيا ومتدرجا يقدر عليه صاحب شركة متعثر فعلا، بلا مبالغة ولا حلول خيالية ولا راس مال كبير. '
    + 'ركز على: اعادة جدولة الديون والتفاوض مع الدائنين، وقف النزيف النقدي وضبط المصروفات، تحسين دورة التحصيل، استعادة الانتظام في السداد. '
    + 'اربط كل خطوة بارقام الشركة الفعلية. اجعلها 4 الى 6 خطوات مركزة وموجزة بلا اطالة. اخرج النتيجة HTML عربي بسيط مكتمل ومغلق بالكامل: عنوان <h3>مسار التعافي المقترح</h3> ثم <ol> خطوات مرقمة كل خطوة <li> فيها رقم محسوب من بياناتهم. بلا اي اشارة لذكاء اصطناعي او تقنية. ابدا مباشرة بالـHTML بلا اي نص قبله او بعده.';
  for (const model of MODELS) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY as string, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model, max_tokens: 4000, messages: [{ role: 'user', content: prompt }] }),
      });
      if (!res.ok) continue;
      const j = await res.json();
      const txt = (j.content || []).filter((b: { type: string }) => b.type === 'text').map((b: { text: string }) => b.text).join('').trim();
      if (txt) return txt;
    } catch {}
  }
  return '<h3>مسار التعافي المقترح</h3><p>الشركة بحاجة لإعادة هيكلة ديونها وتحسين تدفقها النقدي قبل التفكير في جذب مستثمر.</p>';
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
    .select('id, company_name, cr_number, city, sector, account_status, phone')
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
    const isDefaulted = fd?.repayment_status === 'default';
    try {
      if (isDefaulted) {
        investorSearch = await generateRecoveryPath({ ...fd });
      } else {
        investorSearch = await searchInvestors((fd?.sector || company?.sector || 'غير محدد'), Number(fd?.annual_revenue) || 0, fd?.company_stage || 'نمو');
      }
    } catch {}

    const resend = new Resend(process.env.RESEND_API_KEY);
    const rows = matches.slice(0, 5).map((m) =>
      '<tr><td style="padding:8px;border:1px solid #ddd">' + (m.entity.entity_name || m.entity.name || '—') +
      '</td><td style="padding:8px;border:1px solid #ddd">' + m.fit + '%</td></tr>'
    ).join('');

    await resend.emails.send({
      from: 'د. عبدالحكيم المرضي <noreply@murdi.sa>',
      to: 'hololalmurdi.fs@gmail.com',
      subject: (isDefaulted ? '⚠️ شركة متعثرة (مسار تعافي) — ' : 'مطابقة استثمار جديدة — ') + company.company_name,
      html:
        '<div dir="rtl" style="font-family:Arial">' +
        '<h2>مطابقة استثمار جديدة</h2>' +
        '<p><b>الشركة:</b> ' + company.company_name + ' — سجل: ' + company.cr_number + '</p>' +
        '<p><b>القطاع:</b> ' + (fd.sector || company.sector || '—') + ' | <b>الجوال:</b> ' + (company.phone || '—') + '</p>' +
        '<p><b>درجة الجاهزية:</b> ' + score + ' — ' + (rr?.verdict ?? '') + '</p>' +
        (investorSearch ? '<div style="background:#FBF5E8;padding:16px;border-radius:12px;margin-top:16px"><h3 style="color:#9A7B2E;margin:0 0 8px">' + (isDefaulted ? '🔧 مسار التعافي المقترح (الشركة متعثرة — فرصة خدمة إعادة هيكلة)' : '🔍 بحث المستثمرين الذكي (سري — لك فقط)') + '</h3><div style="white-space:pre-wrap;color:#1A3D34;font-size:14px;line-height:1.8">' + investorSearch + '</div></div>' : '') +
        '<hr/>' +
        '<p style="margin-top:14px"><a href="https://murdi.sa/admin/approvals" style="background:#1A3D34;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold">📂 افتح الملف الكامل في الأدمن</a></p>' +
        '<p style="color:#6B8A80;font-size:12px;margin-top:8px">تفاصيل الأرقام والجهات المطابقة الكاملة في لوحة الأدمن.</p>' +
        '</div>',
    });
  } catch {}

  return NextResponse.json({
    ok: true,
    match_count: matches.length,
    matches: clientView,
  });
}
