import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { suggestService, suggestionBox } from '@/lib/serviceSuggestion';


async function searchInvestors(sector: string, revenue: number, stage: string): Promise<string> {
  const MODELS = ['claude-opus-4-8', 'claude-sonnet-4-6'];
  const prompt = 'انت باحث استثماري محترف رفيع المستوى تعمل لصالح د. عبدالحكيم المرضي (شركة حلول المرضي للاستشارات المالية، السعودية). مهمتك بحث ذكي ودقيق في الويب عن المستثمرين الأنسب لشركة بهذا الملف:\n'
    + 'القطاع: ' + sector + ' | الإيرادات السنوية: ' + revenue + ' ريال | المرحلة: ' + stage + '.\n\n'
    + 'ابحث وقسّم نتائجك إلى ثلاث طبقات جغرافية بهذا الترتيب من الأولوية:\n'
    + '🇸🇦 الطبقة الأولى — السعودية (الأعمق والأكثر): صناديق الاستثمار الجريء والملكية الخاصة السعودية، المكاتب العائلية، المسرّعات، والمستثمرون الأفراد النشطون في القطاع. هذه الطبقة هي الأساس وأعطها أكبر نصيب وأعمق بحث.\n'
    + '🌙 الطبقة الثانية — الخليج: مستثمرون وصناديق خليجية. الأولوية القصوى لمن سبق له الاستثمار فعلياً في السعودية أو في شركات سعودية (اذكر الاستثمار السابق صراحةً)، يليهم من لا يمانع الاستثمار في السعودية ويناسب القطاع.\n'
    + '🌍 الطبقة الثالثة — دولي (أمريكا وأوروبا): صناديق رأس المال الجريء (VC)، صناديق النمو، المحافظ الاستثمارية، والمستثمرون الملائكة. الأولوية القصوى لمن سبق له الاستثمار في السعودية أو الشرق الأوسط ويتطابق قطاعه واستثماراته السابقة مع هذه الشركة (اذكر استثماره السابق المشابه)، يليهم من أبدى اهتماماً بالأسواق الناشئة ولا يمانع.\n\n'
    + 'قاعدة الأولوية الذهبية: داخل كل طبقة، رتّب المستثمرين بحيث (من سبق له الاستثمار في السعودية + يتطابق قطاعه) يأتي أولاً دائماً. لا تحصر نفسك فيهم فقط — إن وجدت جهة قوية ترغب ولا تمانع وتناسب القطاع فأضفها، لكن بدرجة ثانية بعد أصحاب السابقة، ووضّح ذلك.\n\n'
    + 'لتبحث بذكاء ودقة عالية، راعِ هذه المعايير في المطابقة:\n'
    + '- تطابق القطاع: ابحث عن مستثمرين استثمروا في شركات بنفس قطاع هذه الشركة أو قطاع قريب.\n'
    + '- مرحلة الشركة وحجم الجولة: طابق حجم الاستثمار المعتاد للمستثمر مع حجم وإيرادات الشركة — لا تقترح صندوقاً ضخماً لجولة صغيرة أو العكس.\n'
    + '- نشاط حديث: فضّل من استثمر خلال آخر 2-3 سنوات (نشط فعلاً).\n'
    + '- نوع المستثمر المناسب للمرحلة: ملائكي/تأسيسي للمراحل المبكرة، VC للنمو، ملكية خاصة للشركات الناضجة.\n\n'
    + 'مهم جداً في التنسيق:\n'
    + 'ابدأ بقسم (الخلاصة التنفيذية): أفضل 3 جهات للتواصل الآن، كل واحدة سطر مختصر: الاسم — الطبقة — سبب الأولوية (خاصة إن سبق له الاستثمار في السعودية).\n'
    + 'ثم قسم (التفاصيل) مقسّماً بعناوين الطبقات الثلاث (🇸🇦 السعودية / 🌙 الخليج / 🌍 دولي). لكل جهة اذكر: الاسم، الفئة (صندوق/مكتب عائلي/VC/ملائكي/ملكية خاصة)، التركيز الاستثماري، حجم الاستثمار المعتاد إن وُجد، أمثلة على استثماراتها السابقة (خاصة في السعودية/المنطقة إن وُجدت)، وسبب ملاءمتها لهذه الشركة تحديدا.\n'
    + 'والأهم: لكل جهة سطر (طريقة الوصول العملية) — خطوة تواصل واحدة واضحة ومحددة فقط (نموذج التواصل الرسمي مع الرابط المباشر، أو بريد الاستثمار المعلن إن وُجد). لا تعطِ عدة خيارات ولا تكتفِ بـ"ابحث في لينكدإن"، بل حدد الخطوة الأفضل عملياً.\n\n'
    + 'ابحث براحتك وأرجع كل الجهات المناسبة فعلاً عبر الطبقات الثلاث دون التقيّد بعدد معيّن — الأولوية للسعودية (الأكثر) ثم الخليج ثم الدولي. لا تُدرج جهة غير مناسبة لمجرد زيادة العدد. اجب بالعربية، مهني ومباشر بلا حشو.';

  let diag = '';
  for (const model of MODELS) {
    try {
      const messages: { role: string; content: unknown }[] = [{ role: 'user', content: prompt }];
      let textOut = '';
      for (let turn = 0; turn < 10; turn++) {
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
            tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 12 }],
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

async function generateReadinessPlan(data: Record<string, unknown>): Promise<string> {
  const MODELS = ['claude-opus-4-8', 'claude-sonnet-4-6'];
  const score = Number((data as { score?: number }).score) || 0;
  const prompt = 'انت مستشار مالي وفق منهجية د. عبدالحكيم المرضي، تكتب لصاحب شركة سعودية سكور جاهزيتها للاستثمار ' + score + ' من 100 — أي دون عتبة جذب المستثمر (70). '
    + 'مهمتك: خطة دقيقة وذكية ترفع جاهزية الشركة لتتجاوز 70 وتصبح جاذبة لمستثمر. '
    + 'بيانات الشركة: ' + JSON.stringify(data) + '. '
    + 'حلل الفجوة بدقة: ما الذي يخفض سكورها تحديدا (هامش الربح، النمو، الحوكمة، فصل الملكية، القوائم المدققة، عمر النشاط، حجم الإيرادات)، ورتب الخطوات حسب الأثر الأكبر على رفع السكور أولا. '
    + 'لكل خطوة: ماذا يفعل بالضبط، ولماذا يرفع جاذبيته للمستثمر، مربوطة بأرقام الشركة الفعلية. واقعية بلا حلول خيالية ولا رأس مال ضخم. '
    + 'اجعلها 4 الى 6 خطوات مركزة وموجزة. اخرج HTML عربي بسيط مكتمل ومغلق: <h3>خطة رفع الجاهزية للاستثمار</h3> ثم <ol> خطوات مرقمة كل <li> فيها رقم محسوب من بياناتهم. بلا اي اشارة لذكاء اصطناعي او تقنية. ابدا مباشرة بالـHTML بلا اي نص قبله او بعده.';
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
  return '<h3>خطة رفع الجاهزية للاستثمار</h3><p>تحتاج الشركة رفع هامش ربحها وبناء حوكمة واضحة وفصل الملكية عن الإدارة قبل أن تصبح جاذبة للمستثمر.</p>';
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
    const isDefaulted = fd?.repayment_status === 'default' || fd?.debt_status === 'late';
    const lowScore = score < 70;
    let planKind: 'recovery' | 'readiness' | 'search' = 'search';
    try {
      if (isDefaulted) {
        planKind = 'recovery';
        investorSearch = await generateRecoveryPath({ ...fd });
      } else if (lowScore) {
        planKind = 'readiness';
        investorSearch = await generateReadinessPlan({ ...fd, score, sector: fd?.sector || company?.sector });
      } else {
        planKind = 'search';
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
      subject: (planKind === 'recovery' ? '⚠️ شركة متعثرة (مسار تعافي) — ' : planKind === 'readiness' ? '📈 خطة رفع جاهزية (سكور < 70) — ' : 'مطابقة استثمار جديدة — ') + company.company_name,
      html:
        '<div dir="rtl" style="font-family:Arial">' +
        '<h2>مطابقة استثمار جديدة</h2>' +
        '<p><b>الشركة:</b> ' + company.company_name + ' — سجل: ' + company.cr_number + '</p>' +
        '<p><b>القطاع:</b> ' + (fd.sector || company.sector || '—') + ' | <b>الجوال:</b> ' + (company.phone || '—') + '</p>' +
        '<p><b>درجة الجاهزية:</b> ' + score + ' — ' + (rr?.verdict ?? '') + '</p>' +
        (investorSearch ? '<div style="background:#FBF5E8;padding:16px;border-radius:12px;margin-top:16px"><h3 style="color:#9A7B2E;margin:0 0 8px">' + (planKind === 'recovery' ? '🔧 مسار التعافي المقترح (الشركة متعثرة — فرصة خدمة إعادة هيكلة)' : planKind === 'readiness' ? '📈 خطة رفع الجاهزية للاستثمار (سكور < 70 — فرصة خدمة تجهيز)' : '🔍 بحث المستثمرين الذكي (سري — لك فقط)') + '</h3><div style="white-space:pre-wrap;color:#1A3D34;font-size:14px;line-height:1.8">' + investorSearch + '</div></div>' : '') +
        suggestionBox(suggestService({ ...fd }, 'investment', score)) +
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
