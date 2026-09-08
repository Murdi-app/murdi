import { createClient } from '@supabase/supabase-js';

type Lead = { company_name: string; sector: string; signal: string; contact_phone: string; contact_email: string; contact_social: string; source: string; notes: string; lead_kind: string; hotness: string; entry_angle: string };

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string);
}

function parseLeads(text: string): Lead[] {
  const cleaned = text.replace(/```json|```/g, '').trim();
  const out: Lead[] = [];
  const norm = (o: Record<string, unknown>): Lead => ({
    company_name: String(o.company_name || o.name || '').trim(),
    sector: String(o.sector || '').trim(),
    signal: String(o.signal || '').trim(),
    contact_phone: String(o.contact_phone || o.phone || '').trim(),
    contact_email: String(o.contact_email || o.email || '').trim(),
    contact_social: String(o.contact_social || o.social || '').trim(),
    source: String(o.source || '').trim(),
    notes: String(o.notes || '').trim(),
    lead_kind: String(o.lead_kind || 'direct').trim() === 'scout' ? 'scout' : 'direct',
    hotness: String(o.hotness || '').trim(),
    entry_angle: String(o.entry_angle || '').trim(),
  });
  try {
    const start = cleaned.indexOf('{'); const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end > start) {
      const p = JSON.parse(cleaned.slice(start, end + 1));
      if (Array.isArray(p.leads)) return p.leads.map(norm).filter((l: Lead) => l.company_name);
    }
  } catch { /* تابع */ }
  const objs = cleaned.match(/\{[^{}]*"(?:company_name|name)"[^{}]*\}/g) || [];
  for (const o of objs) { try { out.push(norm(JSON.parse(o))); } catch { /* تجاهل */ } }
  return out.filter((l) => l.company_name);
}

async function huntAxis(label: string, category: string, instruction: string, count: number, dateContext: string): Promise<{ category: string; leads: Lead[] }> {
  const prompt = 'أنت صائد فرص أعمال خبير ومحترف وعميق التفكير، تعمل لـ د. عبدالحكيم المرضي (حلول المرضي للاستشارات المالية، السعودية). '
    + 'مهمتك: البحث العميق الذكي الشجاع في كل المصادر المفتوحة عن منشآت سعودية حقيقية (داخل المملكة حصراً) تمثّل فرص عمل لـ' + label + '.\n\n'
    + dateContext + '\n\n'
    + instruction + '\n\n'
    + '=== دستور الصياد المحترف العميق (التزم به حرفياً) ===\n'
    + '1) شركات ومنشآت قائمة فقط — لا أفراد ولا طلاب ولا أصحاب أفكار لم تبدأ. يجب أن تكون منشأة تعمل فعلاً ولها نشاط قائم.\n'
    + '2) حدّ الحجم الصارم: لا تُدرج أي فرصة يقلّ حجمها (التمويل المطلوب أو الإيراد التقديري) عن مليونَي ريال (2,000,000). المشاريع الصغيرة (50 ألف، 200 ألف، نصف مليون) مرفوضة تماماً ولا تُذكر. نريد منشآت متوسطة جادة (2 إلى 300 مليون ريال).\n'
    + '3) سعودية حصراً. ممنوع: المدرجة في تداول، الكبرى المعروفة، اليونيكورن، المدعومة من صندوق الاستثمارات العامة، والأجنبية.\n'
    + '4) صرامة كاملة على من فات أوانه: أي منشأة أغلقت/جمعت جولة تمويل أو حصلت على استثمار = استبعاد فوري.\n'
    + '5) الحداثة صارمة جداً: لا تقبل أي إشارة أقدم من 90 يوماً من تاريخ اليوم المذكور أعلاه. تحقّق من السنة بدقّة — إشارة من 2024 أو منتصف 2025 مرفوضة الآن. إن لم تجد تاريخاً حديثاً موثوقاً، لا تُدرج الفرصة. اذكر التاريخ صراحةً في signal.\n'
    + '6) التعمّق لا التسطّح: لا تمرّ سريعاً على المراتع. ادخل المرتع بعمق، افهم طبيعته، استخرج أكثر ما يمكن منه، اربط الإشارات ببعضها، وافتح آفاقاً مخفية (مراتع أو زوايا أو منصّات جديدة لم تكن معروفة). جودة عميقة لا كمية سطحية.\n'
    + '7) ابحث بالعربية والإنجليزية في كل المصادر: تويتر/X (الأهم للسعوديين)، إنستقرام، تيك توك، سناب، لينكدإن، خرائط جوجل، منصات الشراكة السعودية (شريك، بوست، مرجان، فرصة، السوق المفتوح)، البوابات الحكومية (تعميد، اعتماد، منشآت، كفالة)، مواقع الشركات، الأخبار الحديثة.\n\n'
    + '8) الدقة القابلة للتنفيذ: اذكر الاسم التجاري الدقيق كما ورد في مصدره حرفياً، ورابط المصدر إلزامي في source لكل فرصة direct — فرصة مباشرة بلا رابط مصدر لا تُدرج نهائياً.\n'
    + '9) لكل فرصة direct: اجعل entry_angle رسالة افتتاحية جاهزة للإرسال واتساب أو لينكدإن (سطران إلى ثلاثة، عربية مهنية دافئة، تلمس حاجتهم المذكورة في الإشارة تحديداً، بلا أسعار)، يرسلها د. عبدالحكيم كما هي أو يعدّلها. أما scout فتبقى entry_angle تعليمات الدخول اليدوي.\n\n'
    + '=== مبدأ الصياد + الكشّاف ===\n'
    + 'ما تصطاده بنفسك (منشأة محددة ببياناتها) → lead_kind = "direct" بكامل بياناتها.\n'
    + 'ما لا تصله (تعليقات محمية، حسابات تحتاج دخولاً) → lead_kind = "scout"، في company_name وصف المرتع، في contact_social رابطه الدقيق، في entry_angle تعليمات الدخول اليدوي للفريق. لا تهمل المرتع الثمين أبداً.\n\n'
    + 'لكل فرصة: hotness ("ساخنة"/"دافئة"/"باردة")، entry_angle (زاوية دخول عملية يفتح بها د. عبدالحكيم الحديث).\n'
    + 'بيانات التواصل: ابذل جهدك لإيجاد وسيلة حقيقية. لا تخترع أبداً — إن لم تجد اترك فارغاً.\n\n'
    + 'استهدف ' + count + ' فرصة عميقة وثمينة إن وجدت — الجودة والحداثة والحجم أهم بكثير من العدد. فرصة واحدة ثمينة خير من عشر تافهة. لا تكرّر، ولا تملأ العدد بالضعيف.\n\n'
    + 'في signal: الإشارة + تاريخها الدقيق + سبب الحاجة + الحجم التقديري. في notes: ملاحظة + تأكيد الحجم فوق مليونين. في sector: القطاع.\n\n'
    + 'أرجع JSON فقط بلا أي نص آخر وبلا markdown:\n'
    + '{"leads":[{"company_name":"اسم المنشأة أو وصف المرتع","sector":"القطاع","signal":"الإشارة + التاريخ + سبب الحاجة + الحجم","contact_phone":"","contact_email":"","contact_social":"رابط إن وُجد","source":"رابط المصدر","notes":"ملاحظة + الحجم","lead_kind":"direct أو scout","hotness":"ساخنة أو دافئة أو باردة","entry_angle":"زاوية الدخول"}]}\n'
    + 'أرجع JSON صالحاً ومكتملاً ومغلقاً بالكامل.';
  try {
    const messages: { role: string; content: unknown }[] = [{ role: 'user', content: prompt }];
    let text = '';
    for (let turn = 0; turn < 10; turn++) {
      let res: Response | null = null;
      for (let attempt = 0; attempt < 4; attempt++) {
        res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY as string, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 8000, messages, tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 18 }] }),
        });
        if (res.ok) break;
        if (res.status === 429 || res.status === 529 || res.status >= 500) { await new Promise((r) => setTimeout(r, 3000 * (attempt + 1))); continue; }
        break;
      }
      if (!res || !res.ok) break;
      const data = await res.json();
      const content = (data.content || []) as { type: string; text?: string }[];
      text += content.filter((b) => b.type === 'text').map((b) => b.text || '').join('');
      if (data.stop_reason === 'pause_turn') { messages.push({ role: 'assistant', content: data.content }); continue; }
      break;
    }
    return { category, leads: parseLeads(text) };
  } catch { return { category, leads: [] }; }
}

export async function runDailyHunt(): Promise<{ total: number; byCategory: Record<string, number> }> {
  const now = new Date();
  const cutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const dateContext = '=== التاريخ مهم جداً ===\nتاريخ اليوم: ' + fmt(now) + '. لا تقبل أي إشارة أقدم من: ' + fmt(cutoff) + ' (آخر 90 يوماً). أي خبر أو إعلان قبل هذا التاريخ مرفوض تماماً مهما كان مغرياً.';

  const adminClient = admin();
  // ★ الاستبعاد كان ينظر إلى جولات الصيد وحدها، فيعود الصيّاد باسمٍ هو عندنا
  //   أصلاً: عميل مسجَّل، أو اسمٌ في قائمة اتصال المساعدة. والمكالمة التي
  //   تُبذل على من في اليد ضائعةٌ مرتين — تُنفق وقتاً وتُحرج المتّصلة.
  //   فيُقرأ القمعُ كلّه: جولات أسبوعين، وشركات المنصة، وقائمة الصيد.
  const since14 = fmt(new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000));
  const [recentRows, ownRows, huntRows] = await Promise.all([
    adminClient.from('daily_leads').select('company_name').gte('hunt_date', since14),
    adminClient.from('companies').select('company_name'),
    adminClient.from('client_hunt_leads').select('company_name').limit(300),
  ]);
  const namesOf = (r: { data: unknown }) =>
    ((r.data || []) as { company_name: string | null }[])
      .map((x) => String(x.company_name || '').trim())
      .filter(Boolean);
  const recentNames = Array.from(new Set([
    ...namesOf(recentRows), ...namesOf(ownRows), ...namesOf(huntRows),
  ])).slice(0, 200);
  const dedupContext = recentNames.length
    ? '\n\n=== ممنوع التكرار (مهم جداً) ===\nالمنشآت التالية عندنا بالفعل — عميلٌ مسجَّل أو اسمٌ في قائمة اتصالنا أو صيدُ جولةٍ سابقة. لا تُدرج أياً منها مجدداً مهما بدت مغرية، وابحث عن جديدٍ غيرها:\n' + recentNames.join('، ')
    : '';

  // ★ المحاور هي الخدمات الثلاث التي تُباع فعلاً — لا تقسيمٌ نظري.
  //   كانت: تمويل عام · استثمار · طرح. والطرح لا يُباع اليوم، والاستثمار
  //   ليس في الخدمات الثلاث التي تُصاد لها. فصار كل محور خدمةً بعينها،
  //   ويخرج منه اثنا عشر اسماً ليبقى بعد الاستبعاد عشرة على الأقل.
  const axes = [
    {
      label: 'تمويل العقد — من رسا عليه عقد',
      category: 'contract_finance',
      count: 12,
      instruction: 'ابحث عن منشآت سعودية **رسا عليها عقد حديثاً** أو فازت بمنافسة خلال التسعين يوماً الماضية. مراتعك: منصة اعتماد وتعميد لترسيات المقاولين، وحسابات الشركات على لينكدإن وتويتر/X التي تعلن فوزها بمشروع، وأخبار المقاولات والتوريد والصيانة والتشغيل، وإعلانات الجهات الحكومية وشبه الحكومية عن ترسية أعمالها، ومنشورات «الحمد لله ترسّى علينا مشروع». '
        + 'القطاعات: مقاولات · توريد · خدمات · صيانة وتشغيل · نقل. '
        + 'الشرط: أن يكون العقد **مُرسى فعلاً أو منافسة قائمة** — لا نية ولا طموح. وقيمة العقد يُفضَّل أن تتجاوز خمسة ملايين ريال. '
        + 'وفي حقل الإشارة اكتب: اسم المشروع وقيمته إن ذُكرت والجهة المُسنِدة وتاريخ الترسية. '
        + 'وفي زاوية الدخول اكتب جملة تُقال له في المكالمة مبنيّة على عقده هو.',
    },
    {
      label: 'مسار التمويل — منشأة قائمة تحتاج تمويلاً',
      category: 'funding_track',
      count: 12,
      instruction: 'ابحث عن **منشآت قائمة لها إيراد** كشفت حاجة تمويلية حديثة: رأس مال عامل، أو توسعة، أو شراء معدات وأصول. مراتعك: تعليقات حسابات جهات التمويل السعودية (الرائدة · بنك التنمية الاجتماعية · الإنماء · ANB · كفالة · بنك المنشآت · منافع · لندو) على تويتر/X وإنستقرام، ومنصات الشراكة (شريك · بوست · مرجان · فرصة · السوق المفتوح)، ومجموعات أصحاب الأعمال، ومن يشتكي علناً من رفض بنكي أو تأخّر تحصيل. '
        + 'الشرط: منشأة قائمة إيرادها فوق مليونين — لا أفكار ولا أفراد. '
        + 'وأعطِ أولويةً خاصة لمن ظهر أن **ملكيته غير سعودية** أو أن البنوك ردّته، فهذا تخصّص المكتب. '
        + 'وفي حقل الإشارة اكتب: ما الذي كشف حاجته حرفياً وأين ومتى.',
    },
    {
      label: 'دراسة الجدوى الائتمانية — مشروع يُبنى أو توسعة',
      category: 'feasibility',
      count: 12,
      instruction: 'ابحث عن **كل من يبدأ مشروعاً أو يتوسّع** ويحتاج دراسة جدوى. '
        + '**وطلبُ جهةٍ للدراسة إشارةٌ قويّة لا شرط** — فمن لم تطلبها منه جهةٌ بعدُ هو عميلٌ كذلك، بل أكثرهم، لأنه سيُطالَب بها حين يطرق أول باب. فلا تحصر بحثك فيمن طُلبت منه. '
        + 'ومراتعك: من يعلن نيّته فتح فرع جديد أو خط إنتاج أو مصنع أو مستودع، ومن اشترى أرضاً أو استأجر موقعاً لمشروع، ومن يسأل علناً عن جدوى مشروع أو عن تمويل توسعة، ومن قالت له جهة تمويلية أو حاضنة أو صندوق أن يُحضر دراسة جدوى، وإعلانات الحاضنات والمسرّعات التي تشترطها، وبرامج الدعم الحكومية التي تطلبها ضمن مستنداتها. '
        + 'الشرط: **نية جادة ومشروع محدد** — لا تأمّل عام. '
        + '**والدراسة التي نبيعها ائتمانية لا أكاديمية**: تُكتب لتُقرأ في لجنة ائتمان — تدفّق نقدي شهري وقدرة على خدمة الدين وحساسية وضمانات، لا تحليل سوق إنشائياً. فاجعل زاوية الدخول تنطق بهذا الفرق: أن دراسةً عادية تُردّ من البنك، وأن دراستنا مبنيّة على ما تسأل عنه اللجنة نفسها. '
        + '**ثم لا تقف عند الدراسة**: زاوية الدخول تقول له إن المكتب — بعد الدراسة — يفتح له أبواب الجهات المناسبة ويخاطبها عنه، فهو لا يشتري ورقةً بل طريقاً إلى تمويل. '
        + 'وفي حقل الإشارة اكتب: ما المشروع، وحجم الاستثمار إن ذُكر، وهل طُلبت منه دراسة ومن طلبها إن وُجد.',
    },
  ];


  const results = await Promise.all(axes.map((a) => huntAxis(a.label, a.category, a.instruction, a.count, dateContext + dedupContext)));

  const today = fmt(now);
  await adminClient.from('daily_leads').delete().eq('hunt_date', today).neq('saved', true);

  const byCategory: Record<string, number> = {};
  let total = 0;
  for (const r of results) {
    if (r.leads.length === 0) { byCategory[r.category] = 0; continue; }
    const rows = r.leads.map((l) => ({
      hunt_date: today, category: r.category, company_name: l.company_name, sector: l.sector,
      signal: l.signal, contact_phone: l.contact_phone || null, contact_email: l.contact_email || null,
      contact_social: l.contact_social || null, source: l.source || null, notes: l.notes || null,
      lead_kind: l.lead_kind, hotness: l.hotness || null, entry_angle: l.entry_angle || null,
    }));
    await adminClient.from('daily_leads').insert(rows);
    byCategory[r.category] = rows.length;
    total += rows.length;
  }
  return { total, byCategory };
}
