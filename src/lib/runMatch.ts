import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { suggestService, suggestionBox } from '@/lib/serviceSuggestion';

const ACT_LABELS: Record<string, string> = { retail: 'تجزئة/مطاعم', contracting: 'مقاولات/توريد', services: 'خدمات', manufacturing: 'تصنيع', wholesale: 'تجارة جملة', other_activity: 'أخرى' };
const TYPE_LABELS: Record<string, string> = { cash: 'تمويل نقدي', working_capital: 'رأس مال عامل', revenue: 'تمويل الإيرادات', pos: 'تمويل نقاط البيع', invoices: 'تمويل الفواتير والمستخلصات', assets: 'تمويل أصول ومعدات', vehicles: 'تمويل مركبات وأساطيل', real_estate: 'عقاري تجاري', lc: 'اعتمادات وخطابات ضمان', project: 'تمويل مشاريع وعقود' };

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  );
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
    + 'ثم قسم (التفاصيل) مقسّماً بعناوين الطبقات الثلاث (🇸🇦 السعودية / 🌙 الخليج / 🌍 دولي). لكل جهة اذكر: الاسم، الفئة (صندوق/مكتب عائلي/VC/ملائكي/ملكية خاصة)، التركيز الاستثماري، حجم الاستثمار المعتاد إن وُجد، أمثلة على استثماراتها السابقة (خاصة في السعودية/المنطقة إن وجدت)، وسبب ملاءمتها لهذه الشركة تحديدا.\n'
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

async function runInvestmentMatch(companyId: string, scoreArg?: number): Promise<void> {
  const adminClient = admin();

  const { data: company } = await adminClient
    .from('companies')
    .select('id, company_name, cr_number, city, sector, account_status, phone')
    .eq('id', companyId)
    .single();
  if (company === null || company.account_status !== 'active') return;

  const { data: fd } = await adminClient
    .from('financial_data')
    .select('*')
    .eq('company_id', company.id)
    .eq('assessment_type', 'investment')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  if (fd === null) return;

  const { data: rr } = await adminClient
    .from('readiness_results')
    .select('readiness_score, verdict')
    .eq('company_id', company.id)
    .eq('result_type', 'investment')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  const score = scoreArg ?? rr?.readiness_score ?? 0;

  const { data: entities } = await adminClient.from('investment_entities').select('*');
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
    if (sectorMatch(sectors, fd.sector)) { fit += 30; reasons.push('قطاع شركتك ضمن اهتمامات هذه الجهة'); } else { continue; }
    const stages: string[] = e.stages || [];
    if (stages.length === 0 || stages.includes(fd.company_stage)) { fit += 20; reasons.push('مرحلة شركتك تناسب استراتيجية الجهة'); } else { fit += 5; }
    if (score >= 85) { fit += 25; reasons.push('درجة جاهزية عالية جداً'); }
    else if (score >= 75) { fit += 18; reasons.push('درجة جاهزية قوية'); }
    else { fit += 12; reasons.push('درجة الجاهزية تحقق الحد الأدنى'); }
    if (fd.audited_statements === true) { fit += 13; reasons.push('قوائم مالية مراجعة خارجياً'); }
    if (fd.has_governance === true) { fit += 10; reasons.push('نظام حوكمة قائم'); }
    matches.push({ entity: e, fit: Math.min(fit, 97), reasons });
  }
  matches.sort((a, b) => b.fit - a.fit);

  await adminClient.from('investment_matches').insert({
    company_id: company.id,
    match_count: matches.length,
    provider_details: matches.slice(0, 5).map((m) => ({ entity: m.entity, fit: m.fit })),
  });

  let investorSearch = '';
  const isDefaulted = fd?.repayment_status === 'default' || fd?.debt_status === 'late';
  const lowScore = score < 70;
  let planKind: 'recovery' | 'readiness' | 'search' = 'search';
  try {
    if (isDefaulted) { planKind = 'recovery'; investorSearch = await generateRecoveryPath({ ...fd }); }
    else if (lowScore) { planKind = 'readiness'; investorSearch = await generateReadinessPlan({ ...fd, score, sector: fd?.sector || company?.sector }); }
    else { planKind = 'search'; investorSearch = await searchInvestors((fd?.sector || company?.sector || 'غير محدد'), Number(fd?.annual_revenue) || 0, fd?.company_stage || 'نمو'); }
  } catch {}

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
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
        '</div>',
    });
  } catch {}
}

export { runInvestmentMatch };
async function runFundingMatch(companyId: string): Promise<void> {
  const adminClient = admin();

  const { data: company } = await adminClient
    .from('companies')
    .select('id, company_name, cr_number, city, sector, account_status, phone')
    .eq('id', companyId)
    .single();
  if (company === null || company.account_status !== 'active') return;

  const { data: fd } = await adminClient
    .from('financial_data')
    .select('*')
    .eq('company_id', company.id)
    .eq('assessment_type', 'funding')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  if (fd === null) {
    // fallback: قد لا يكون assessment_type=funding، نأخذ الأحدث
    const { data: fd2 } = await adminClient.from('financial_data').select('*').eq('company_id', company.id).order('created_at', { ascending: false }).limit(1).single();
    if (fd2 === null) return;
    Object.assign(fd as object || {}, fd2);
  }
  const FD = fd as Record<string, unknown>;

  const { data: rr } = await adminClient
    .from('readiness_results')
    .select('readiness_score, verdict')
    .eq('company_id', company.id)
    .eq('result_type', 'funding')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  const rev = Number(FD.annual_revenue) || 0;
  const years = Number(FD.years_operating) || 0;
  const typeLabel = FD.funding_type === 'other' ? (String(FD.funding_type_other) || 'أخرى') : (TYPE_LABELS[String(FD.funding_type)] || String(FD.funding_type));
  const debtDesc = FD.has_debt
    ? 'يوجد تمويل قائم بقيمة أصلية ' + Number(FD.original_loan_amount || 0).toLocaleString() + ' ريال، المتبقي ' + Number(FD.debt_remaining || 0).toLocaleString() + ' ريال لدى ' + (FD.lender_name || 'جهة تمويل') + '، الحالة: ' + (FD.debt_status === 'late' ? 'متأخر ' + (FD.months_late || 0) + ' شهر' : 'ملتزم بالسداد')
    : 'لا توجد ديون قائمة';

  type WebOffer = { region?: string; provider: string; product: string; requirements: string; fit: string; source: string };
  let webOffers: WebOffer[] = [];
  let webSearchOk = false;
  let webSearchError = '';

  try {
    const LICENSED = 'البنوك المرخصة: البنك الأهلي السعودي، مصرف الراجحي، بنك الرياض، البنك السعودي الأول (ساب)، البنك السعودي الفرنسي، البنك العربي الوطني، بنك البلاد، بنك الجزيرة، مصرف الإنماء، البنك السعودي للاستثمار، بنك الخليج الدولي السعودية. شركات التمويل المرخصة من ساما: الأمثل، أملاك العالمية، دار التمليك، بداية، سهل، عبداللطيف جميل، اليسر، الراجحي للتمويل، نايفات، أمكان، تمويل الأولى، المتاجرة المالية، أصيل، التيسير العربية، ميفك كابيتال، تسهيل، فيول، منافع، عِمكان، سلفة، تمام (stc)، ماني فيلوز، فورس، ميسر، لندو (Lendo)، فنتك ردف، فرقد، مرابحة مرنة، قرض للتمويل الجماعي. جهات خليجية قد تموّل شركات سعودية: الإمارات دبي الوطني، أبوظبي الأول (FAB)، دبي الإسلامي، أبوظبي الإسلامي، الكويت الوطني (NBK)، بيتك، QNB، قطر الإسلامي، البحرين والكويت، الأهلي المتحد. جهات دولية: مؤسسة التمويل الدولية (IFC)، البنك الإسلامي للتنمية، صناديق private credit الدولية، منصات تمويل المنشآت العابرة للحدود.';
    const prompt = 'أنت محلل تمويل خبير رفيع المستوى في السوق السعودي والخليجي والدولي تعمل لـ د. عبدالحكيم المرضي. مهمتك بحث ويب دقيق ومتعمّق عن المنتجات التمويلية المتاحة حالياً للشركة. مطلوب منك أن تجتهد وتبحث بعناية فائقة وتُرجع عدداً وفيراً من الجهات (استهدف 30 جهة أو أكثر موزّعة على الطبقات الثلاث إن وجدت فعلاً ومناسبة)، لا تكتفِ بعدد قليل.\n\n'
      + 'قسّم بحثك إلى ثلاث طبقات بالأولوية:\n'
      + 'الطبقة الأولى (الأهم والأوسع — استهدف نصف النتائج أو أكثر): الجهات السعودية المرخّصة من ساما (بنوك + شركات تمويل + منصات). ابحث بعمق فهناك جهات كثيرة.\n'
      + 'الطبقة الثانية (الخليج): جهات خليجية تموّل شركة سعودية فعلاً (لها فرع في السعودية أو تموّل عبر الحدود). ابحث في الإمارات والكويت والبحرين وقطر وعمان.\n'
      + 'الطبقة الثالثة (الدولي): جهات دولية تموّل شركات في السعودية أو الأسواق الناشئة.\n'
      + 'الجهات المرجعية:\n' + LICENSED + '\n\n'
      + 'شرط استبعاد إلزامي: لا تُدرج أي جهة تشترط أن تكون الشركة مسجّلة أو مقيمة في بلد تلك الجهة كي تموّلها (مثال: جهة لا تمول إلا شركات مسجّلة في قطر أو الكويت). أدرج فقط الجهات التي تموّل فعلياً شركة سعودية (سواء سعودية، أو خليجية/دولية تموّل عبر الحدود أو عبر فرعها في السعودية). إن لم تتأكد أن الجهة تموّل شركة سعودية، لا تُدرجها.\n\n'
      + 'ملف الشركة الباحثة عن تمويل:\n'
      + '- نوع التمويل المطلوب: ' + typeLabel + '\n'
      + '- الإيرادات السنوية: ' + rev.toLocaleString() + ' ريال\n'
      + '- عمر النشاط: ' + years + ' سنة\n'
      + '- القطاع: ' + (company.sector || 'غير محدد') + '\n'
      + '- طبيعة النشاط: ' + (ACT_LABELS[String(FD.activity_type)] || FD.activity_type || 'غير محدد') + '\n'
      + '- نقاط بيع: ' + (FD.has_pos ? 'نعم' : 'لا') + ' | يصدر فواتير آجلة: ' + (FD.issues_invoices ? 'نعم' : 'لا') + ' | أسطول/معدات: ' + (FD.has_fleet ? 'نعم' : 'لا') + '\n'
      + '- ' + debtDesc + '\n'
      + '- سجل تجاري ' + (FD.cr_valid ? 'ساري' : 'غير ساري') + '، التزام ضريبي: ' + (FD.tax_compliant ? 'نعم' : 'لا') + '، زكاة: ' + (FD.zakat_compliant ? 'نعم' : 'لا') + '، قوائم مالية: ' + (FD.has_financial_statements ? 'متوفرة' : 'غير متوفرة') + '\n\n'
      + 'قواعد إلزامية:\n'
      + '1) غطِّ مزيجاً متوازناً: لا تقتصر على البنوك — أدرج شركات التمويل المرخصة (نايفات، أمكان، لندو، سلفة، تمام، أملاك...) فهي أنسب للصغيرة والمتوسطة وفرص القبول أعلى. اجعل نصف العروض على الأقل من شركات التمويل والمنصات.\n'
      + '2) طابق المنتجات مع تشخيص النشاط بدقة: اقترح تمويل نقاط البيع فقط إن كان "نقاط بيع = نعم"؛ تمويل الفواتير فقط إن "يصدر فواتير = نعم"؛ تمويل الأسطول/المعدات فقط إن "أسطول = نعم". إن كانت لا، لا تقترح ذلك النوع إطلاقاً.\n'
      + '3) للخليج والدولي: اذكر في requirements المتطلبات الأعلى (قوائم مدققة، حد أدنى أعلى للإيرادات، سجل أطول)، وفي fit ما تستوفيه الشركة أو ما ينقصها. لا تقترح جهة إلا إذا كان حجم الشركة منطقياً لها وتموّل شركة سعودية.\n'
      + '4) نوّع المنتجات حسب الطبقة: السعودية (تمويل عامل، مرابحة، إجارة، تمويل المنشآت)؛ الخليج (عابر للحدود، تجاري، خطوط ائتمان)؛ الدولي (private credit، تنموي، أسواق ناشئة).\n\n'
      + 'أرجع JSON فقط بدون أي نص آخر وبدون markdown:\n'
      + '{"offers":[{"region":"السعودية أو الخليج أو دولي","provider":"اسم الجهة","product":"اسم المنتج","requirements":"الشروط باختصار","fit":"ما يتطابق وما ينقص","source":"رابط المصدر"}]}\n'
      + 'اجتهد وابحث بعمق وأرجع كل العروض المناسبة فعلاً (استهدف 30+) عبر الطبقات الثلاث — الأولوية للسعودية ثم الخليج ثم الدولي. رتب داخل كل طبقة من الأنسب للأقل. لا تُدرج جهة تشترط بلدها ولا جهة غير مناسبة لمجرد العدد.';

    const messages: { role: string; content: unknown }[] = [{ role: 'user', content: prompt }];
    let text = '';
    for (let turn = 0; turn < 10; turn++) {
      const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY as string, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-opus-4-8', max_tokens: 8000, messages, tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 20 }] }),
      });
      if (!aiRes.ok) { webSearchError = 'HTTP ' + aiRes.status + ': ' + (await aiRes.text()).slice(0, 300); break; }
      const aiData = await aiRes.json();
      const content = (aiData.content || []) as { type: string; text?: string }[];
      text += content.filter((b) => b.type === 'text').map((b) => b.text || '').join('');
      if (aiData.stop_reason === 'pause_turn') { messages.push({ role: 'assistant', content: aiData.content }); continue; }
      break;
    }
    const cleaned = text.replace(/```json|```/g, '').trim();
    const jsonStart = cleaned.indexOf('{');
    const jsonEnd = cleaned.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd > jsonStart) {
      const parsed = JSON.parse(cleaned.slice(jsonStart, jsonEnd + 1));
      if (Array.isArray(parsed.offers)) { webOffers = parsed.offers; webSearchOk = true; }
    }
  } catch (err) { webSearchError = err instanceof Error ? err.message : String(err); }

  type DbMatch = { product: Record<string, unknown>; fit: number };
  const dbMatches: DbMatch[] = [];
  try {
    const { data: products } = await adminClient.from('financing_products').select('*');
    const isLate = FD.has_debt === true && FD.debt_status === 'late';
    const monthsLate = Number(FD.months_late) || 0;
    for (const pr of products || []) {
      if (pr.min_revenue && rev < Number(pr.min_revenue)) continue;
      if (pr.min_years_operating && years < Number(pr.min_years_operating)) continue;
      if (isLate && pr.accepts_late_debt !== true) continue;
      if (isLate && monthsLate > Number(pr.max_months_late || 0)) continue;
      if (pr.requires_statements === true && FD.has_financial_statements !== true) continue;
      if (pr.requires_zakat === true && FD.zakat_compliant !== true) continue;
      const types: string[] = pr.funding_types || [];
      let fit = 60;
      if (types.includes(String(FD.funding_type))) fit += 30;
      if (FD.has_debt === false) fit += 8;
      dbMatches.push({ product: pr, fit: Math.min(fit, 97) });
    }
    dbMatches.sort((a, b) => b.fit - a.fit);
  } catch {}

  const totalCount = webOffers.length + dbMatches.length;

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const regionBadge = (r?: string) => { const x = r || 'السعودية'; const c = x.includes('خليج') ? '#3B5BA5' : x.includes('دولي') ? '#A53B3B' : '#2E9E7B'; return '<span style="background:' + c + ';color:#fff;padding:2px 8px;border-radius:10px;font-size:11px">' + x + '</span>'; };
    const regionOrder = (r?: string) => { const x = r || ''; return x.includes('خليج') ? 1 : x.includes('دولي') ? 2 : 0; };
    const sortedOffers = [...webOffers].sort((a, b) => regionOrder(a.region) - regionOrder(b.region));
    const webRows = sortedOffers.map((o) =>
      '<tr><td style="padding:8px;border:1px solid #ddd">' + regionBadge(o.region) + '</td>'
      + '<td style="padding:8px;border:1px solid #ddd"><b>' + o.provider + '</b></td>'
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
      from: 'د. عبدالحكيم المرضي <noreply@murdi.sa>',
      to: 'hololalmurdi.fs@gmail.com',
      subject: 'مطابقة تمويل — ' + company.company_name + ' (' + totalCount + ' فرصة)',
      html:
        '<div dir="rtl" style="font-family:Arial">'
        + '<h2>مطابقة تمويل جديدة</h2>'
        + '<p><b>الشركة:</b> ' + company.company_name + ' — سجل: ' + company.cr_number + '</p>'
        + '<p><b>الجوال:</b> ' + (company.phone || '—') + ' | <b>درجة الجاهزية:</b> ' + (rr?.readiness_score ?? '—') + ' — ' + (rr?.verdict ?? '') + '</p>'
        + '<p><b>المطلوب:</b> ' + typeLabel + ' | <b>عروض السوق:</b> ' + webOffers.length + ' | <b>شبكة مُرضي:</b> ' + dbMatches.length + ' مطابقة</p>'
        + (webOffers.length === 0 && !webSearchOk ? '<p style="color:#A33">⚠️ تعذر بحث السوق: ' + (webSearchError || 'تحقق من ANTHROPIC_API_KEY') + '</p>' : '')
        + '<hr/>'
        + (webRows ? '<h3 style="margin-top:18px">🌐 عروض السوق (بحث مباشر)</h3><table style="border-collapse:collapse;width:100%;font-size:13px"><tr style="background:#1A3D34;color:#fff"><th style="padding:8px;border:1px solid #ddd">المنطقة</th><th style="padding:8px;border:1px solid #ddd">الجهة</th><th style="padding:8px;border:1px solid #ddd">المنتج</th><th style="padding:8px;border:1px solid #ddd">المتطلبات</th><th style="padding:8px;border:1px solid #ddd">الملاءمة</th><th style="padding:8px;border:1px solid #ddd">المصدر</th></tr>' + webRows + '</table>' : '')
        + (dbRows ? '<h3 style="margin-top:18px">🔒 شبكة مُرضي المعتمدة</h3><table style="border-collapse:collapse;width:100%;font-size:13px"><tr style="background:#C9A84C;color:#1A3D34"><th style="padding:8px;border:1px solid #ddd">الجهة</th><th style="padding:8px;border:1px solid #ddd">المنتج</th><th style="padding:8px;border:1px solid #ddd">الملاءمة</th></tr>' + dbRows + '</table>' : '')
        + '<p style="margin-top:18px"><a href="https://murdi.sa/admin/approvals" style="background:#1A3D34;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold">📂 افتح الملف الكامل في الأدمن</a></p>'
        + suggestionBox(suggestService({ ...FD }, 'funding', Number(rr?.readiness_score) || 0))
        + '</div>',
    });
  } catch {}
}

export { runFundingMatch };
async function ipoRecoveryPath(data: Record<string, unknown>): Promise<string> {
  const MODELS = ['claude-opus-4-8', 'claude-sonnet-4-6'];
  const prompt = 'انت مستشار مالي وفق منهجية د. عبدالحكيم المرضي. الشركة متعثرة في سداد ديونها، والادراج في السوق المالي مرفوض نظاما لمن لا ينتظم في التزاماته، فالطرح هدف بعيد يسبقه تعافي واستقرار. '
    + 'بياناتها: ' + JSON.stringify(data) + '. '
    + 'اكتب مسار تعافي واقعيا ومتدرجا يقدر عليه صاحب شركة متعثر فعلا، بلا مبالغة ولا حلول خيالية ولا راس مال كبير. '
    + 'ركز على: اعادة جدولة الديون والتفاوض مع الدائنين، وقف النزيف النقدي وضبط المصروفات، تحسين التدفق النقدي والربحية، استعادة الانتظام في السداد، ثم بعد سنوات من الاستقرار يعاد تقييم جاهزية الطرح. '
    + 'اربط كل خطوة بارقام الشركة الفعلية. اخرج HTML عربي بسيط: <h3>مسار التعافي قبل التفكير في الطرح</h3> ثم <ol> خطوات مرقمة كل خطوة <li> فيها رقم محسوب من بياناتهم. بلا اي اشارة لذكاء اصطناعي او تقنية. ابدا مباشرة بالـHTML.';
  for (const model of MODELS) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY as string, 'anthropic-version': '2023-06-01' }, body: JSON.stringify({ model, max_tokens: 2000, messages: [{ role: 'user', content: prompt }] }) });
      if (!res.ok) continue;
      const j = await res.json();
      const txt = (j.content || []).filter((b: { type: string }) => b.type === 'text').map((b: { text: string }) => b.text).join('').trim();
      if (txt) return txt;
    } catch {}
  }
  return '<h3>مسار التعافي قبل التفكير في الطرح</h3><p>الشركة بحاجة لإعادة هيكلة ديونها واستعادة انتظام السداد قبل أي تفكير في الإدراج.</p>';
}

async function ipoReadinessPlan(data: Record<string, unknown>): Promise<string> {
  const MODELS = ['claude-opus-4-8', 'claude-sonnet-4-6'];
  const score = Number((data as { score?: number }).score) || 0;
  const prompt = 'انت مستشار مالي وفق منهجية د. عبدالحكيم المرضي، تكتب لصاحب شركة سعودية سكور جاهزيتها للطرح ' + score + ' من 100 — أي دون عتبة الجاهزية للإدراج. الشركة ليست متعثرة، لكنها تحتاج تجهيزا مؤسسيا قبل الطرح. '
    + 'مهمتك: خطة دقيقة ذكية ترفع جاهزيتها لمتطلبات الإدراج في السوق السعودي (تداول — السوق الرئيسية أو نمو). '
    + 'بيانات الشركة: ' + JSON.stringify(data) + '. '
    + 'حلل الفجوة بدقة وفق متطلبات هيئة السوق المالية: الحوكمة المؤسسية ولوائحها، تشكيل مجلس إدارة بأعضاء مستقلين، لجنة المراجعة، تعيين مراجع خارجي معتمد، توفر قوائم مالية مدققة لعدد السنوات المطلوب، الإفصاح والشفافية، تنويع قاعدة العملاء وتقليل التركّز، استقرار الربحية والنمو. '
    + 'رتب الخطوات حسب الأثر الأكبر على الجاهزية أولا، ولكل خطوة: ماذا يفعل بالضبط، ولماذا تطلبه الهيئة أو يطمئن المستثمر، مربوطة بأرقام الشركة الفعلية. واقعية ومتدرجة. '
    + 'اجعلها 4 الى 6 خطوات مركزة. اخرج HTML عربي بسيط مكتمل: <h3>خطة رفع الجاهزية للطرح</h3> ثم <ol> خطوات مرقمة كل <li> فيها رقم/تفصيل من بياناتهم. بلا اي اشارة لذكاء اصطناعي او تقنية. ابدا مباشرة بالـHTML.';
  for (const model of MODELS) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY as string, 'anthropic-version': '2023-06-01' }, body: JSON.stringify({ model, max_tokens: 2000, messages: [{ role: 'user', content: prompt }] }) });
      if (!res.ok) continue;
      const j = await res.json();
      const txt = (j.content || []).filter((b: { type: string }) => b.type === 'text').map((b: { text: string }) => b.text).join('').trim();
      if (txt) return txt;
    } catch {}
  }
  return '<h3>خطة رفع الجاهزية للطرح</h3><p>تحتاج الشركة بناء الحوكمة المؤسسية، تعيين مراجع خارجي معتمد، تشكيل لجنة مراجعة، وتجهيز القوائم المالية المدققة قبل التقدم للإدراج.</p>';
}

async function searchIpoAdvisors(sector: string, market: string, revenue: number): Promise<string> {
  const MODELS = ['claude-opus-4-8', 'claude-sonnet-4-6'];
  const prompt = 'أنت باحث أسواق مال محترف رفيع المستوى تعمل لصالح د. عبدالحكيم المرضي (حلول المرضي للاستشارات المالية، السعودية). شركة قطاعها "' + sector + '" وإيراداتها السنوية ' + revenue + ' ريال تستهدف الإدراج في ' + market + ' بالسوق السعودي (تداول). ابحث في الويب بدقة ومهنية وعمق (اجتهد ولا تكتفِ بعدد قليل) وقسّم نتائجك إلى ثلاثة أقسام:\n\n'
    + '1) المستشارون الماليون المرخّصون من هيئة السوق المالية السعودية (CMA) الذين يقودون عمليات الطرح والإدراج — ركّز على المرخّصين فعلياً والنشطين في طروحات ' + market + '. لكل واحد: الاسم، ولماذا يناسب حجم وقطاع هذه الشركة، وطريقة تواصل عملية محددة (موقع رسمي/بريد إدارة الترتيب والاستشارات).\n\n'
    + '2) متعهّدو التغطية والمراجعون (المدققون) المعتمدون لدى الهيئة المناسبون لطرح بهذا الحجم.\n\n'
    + '3) طروحات مشابهة حديثة (آخر 2-3 سنوات) في قطاع "' + sector + '" أو قطاع قريب بالسوق السعودي (' + market + '): اسم الشركة، سنة الطرح، حجم الطرح والتغطية إن توفّر، ومن كان مستشارها المالي — كمرجع يستفيد منه صاحب الشركة.\n\n'
    + 'ابدأ بقسم (الخلاصة التنفيذية): أفضل مستشارين ماليَّين للتواصل معهما الآن وسبب الترشيح. ثم التفاصيل بالأقسام الثلاثة أعلاه. ابحث براحتك دون التقيّد بعدد، أدرج فقط الجهات المرخّصة والمناسبة فعلاً لحجم الشركة. اجب بالعربية، مهني ومباشر بلا حشو، وأخرج HTML عربي بسيط (h3 للأقسام، ul/li للقوائم) وابدأ مباشرة بالـHTML بلا أي إشارة لذكاء اصطناعي.';
  for (const model of MODELS) {
    try {
      const messages: { role: string; content: unknown }[] = [{ role: 'user', content: prompt }];
      let textOut = '';
      for (let turn = 0; turn < 10; turn++) {
        const res = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY as string, 'anthropic-version': '2023-06-01' }, body: JSON.stringify({ model, max_tokens: 5000, messages, tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 20 }] }) });
        if (!res.ok) break;
        const data = await res.json();
        const content = (data.content || []) as { type: string; text?: string }[];
        textOut += content.filter((b) => b.type === 'text').map((b) => b.text || '').join(' ');
        if (data.stop_reason === 'pause_turn') { messages.push({ role: 'assistant', content: data.content }); continue; }
        break;
      }
      textOut = textOut.trim();
      if (textOut.length > 80) return textOut;
    } catch {}
  }
  return '<h3>جهات الطرح والإدراج</h3><p>يتولى فريق حلول المرضي ترشيح المستشار المالي المرخّص الأنسب ومرافقتكم في رحلة الإدراج.</p>';
}

async function runIpoMatch(companyId: string, scoreArg?: number): Promise<void> {
  const adminClient = admin();
  const { data: company } = await adminClient.from('companies').select('id, company_name, cr_number, city, sector, phone, account_status').eq('id', companyId).single();
  if (company === null || company.account_status !== 'active') return;

  const { data: fd } = await adminClient.from('financial_data').select('*').eq('company_id', company.id).eq('assessment_type', 'ipo').order('created_at', { ascending: false }).limit(1).single();
  if (fd === null) return;

  const { data: rr } = await adminClient.from('readiness_results').select('readiness_score, verdict, top_obstacles, improvement_plan, months_to_ready, valuation_estimate').eq('company_id', company.id).eq('result_type', 'ipo').order('created_at', { ascending: false }).limit(1).single();

  const rev = Number(fd.annual_revenue) || 0;
  const score = scoreArg ?? rr?.readiness_score ?? 0;
  const marketLabel = fd.target_market === 'main' ? 'السوق الرئيسية' : 'السوق الموازي (نمو)';
  const monthsTxt = rr?.months_to_ready ? rr.months_to_ready + ' شهراً' : '—';

  try {
    const isDefaulted = fd?.repayment_status === 'default' || fd?.debt_status === 'late';
    const lowScore = score < 65;
    let recoveryHtml = '';
    let planKind: 'recovery' | 'readiness' | 'qualified' | 'waiting' = score >= 65 ? 'qualified' : 'waiting';
    if (isDefaulted) { planKind = 'recovery'; try { recoveryHtml = await ipoRecoveryPath({ ...fd }); } catch {} }
    else if (lowScore) { planKind = 'readiness'; try { recoveryHtml = await ipoReadinessPlan({ ...fd, score, sector: fd?.sector || company?.sector }); } catch {} }
    let advisorsHtml = '';
    if (planKind === 'qualified') { try { advisorsHtml = await searchIpoAdvisors(fd?.sector || company?.sector || 'غير محدد', marketLabel, rev); } catch {} }

    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: 'د. عبدالحكيم المرضي <noreply@murdi.sa>',
      to: 'hololalmurdi.fs@gmail.com',
      subject: (isDefaulted ? '⚠️ شركة متعثرة (مسار تعافي) — ' : (score >= 65 ? '🎯 مؤهل طرح — ' : 'تقييم طرح — ')) + company.company_name + ' (درجة ' + score + ')',
      html:
        '<div dir="rtl" style="font-family:Arial">' +
        (isDefaulted
          ? '<div style="background:#FBECEC;border:2px solid #C0564B;border-radius:10px;padding:14px;margin-bottom:14px"><b style="color:#A33;font-size:16px">⚠️ غير مؤهل للطرح حالياً — شركة متعثرة</b><br/>الفرصة هنا خدمة <b>إعادة هيكلة وتعافٍ</b> تقدّمها حلول المرضي، تمهّد لاحقاً للطرح.</div>'
          : (score >= 65
          ? '<div style="background:#FBF5E8;border:2px solid #C9A84C;border-radius:10px;padding:14px;margin-bottom:14px"><b style="color:#9A7B2E;font-size:16px">🎯 مؤهل للطرح — فرصة خدمة مدفوعة</b><br/>تواصل مع العميل لعرض خطة الطرح الكاملة.</div>'
          : '<div style="background:#F0F5F3;border:1px solid #ddd;border-radius:10px;padding:14px;margin-bottom:14px"><b style="color:#6B8A80;font-size:16px">⏳ يحتاج تجهيزاً قبل الطرح — فرصة خدمة تجهيز</b><br/>عرض خطة رفع الجاهزية أدناه على العميل.</div>')) +
        '<h2>ملف طرح جديد</h2>' +
        '<p><b>الشركة:</b> ' + company.company_name + ' — سجل: ' + company.cr_number + '</p>' +
        '<p><b>الجوال:</b> ' + (company.phone || '—') + ' | <b>المدينة:</b> ' + (company.city || '—') + ' | <b>القطاع:</b> ' + (fd?.sector || company.sector || '—') + '</p>' +
        '<p><b>IPO Readiness Score:</b> ' + score + ' — ' + (rr?.verdict ?? '—') + '</p>' +
        '<p><b>السوق المقترح:</b> ' + marketLabel + ' | <b>المدة التقديرية:</b> ' + monthsTxt + '</p>' +
        (recoveryHtml ? '<hr/><div style="background:#F0F7F4;border-radius:10px;padding:14px;margin-top:10px;white-space:pre-wrap;line-height:1.8">' + recoveryHtml + '</div>' : '') +
        (advisorsHtml ? '<hr/><h3 style="color:#1A3D34;margin-top:16px">🏛️ جهات الطرح والإدراج (بحث مباشر)</h3><div style="background:#FBF8EE;border-radius:10px;padding:14px;margin-top:6px;line-height:1.9">' + advisorsHtml + '</div>' : '') +
        suggestionBox(suggestService({ ...fd }, 'ipo', score)) +
        '<hr/>' +
        '<p style="margin-top:14px"><a href="https://murdi.sa/admin/approvals" style="background:#1A3D34;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold">📂 افتح الملف الكامل في الأدمن</a></p>' +
        '</div>',
    });
  } catch {}
}

export { runIpoMatch };
