/* eslint-disable @typescript-eslint/no-explicit-any */
// محرك المطابقة المشترك

import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

type Rec = Record<string, any>;

export const TYPE_LABELS: Record<string, string> = {
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

const ACT_LABELS: Record<string, string> = { retail: 'تجزئة/مطاعم', contracting: 'مقاولات/توريد', services: 'خدمات', manufacturing: 'تصنيع', wholesale: 'تجارة جملة', other_activity: 'أخرى' };

export   type WebOffer = { region?: string; provider: string; product: string; requirements: string; source: string; verdict?: string; gaps?: string[]; amountRange?: string; timeline?: string; saudiPrecedent?: string | null; legalPath?: string | null };

export async function runScopedMatch(args: {
  company: Rec; fd: Rec; typeLabel: string; rev: number;
  years: number; debtDesc: string; isInvest: boolean; budget?: 'light' | 'full';
}): Promise<{ offers: WebOffer[]; ok: boolean; error: string }> {
  const { company, fd, typeLabel, rev, years, debtDesc, isInvest, budget } = args;
  let webOffers: WebOffer[] = [];
  let webSearchOk = false;
  let webSearchError = '';

  try {
    const LICENSED = 'البنوك المرخصة: البنك الأهلي السعودي، مصرف الراجحي، بنك الرياض، البنك السعودي الأول (ساب)، البنك السعودي الفرنسي، البنك العربي الوطني، بنك البلاد، بنك الجزيرة، مصرف الإنماء، البنك السعودي للاستثمار، بنك الخليج الدولي السعودية. شركات التمويل المرخصة من البنك المركزي السعودي (ساما): شركة الأمثل للتمويل، شركة أملاك العالمية، شركة دار التمليك، شركة بداية لتمويل المنازل، الشركة السعودية لتمويل المساكن (سهل)، شركة عبداللطيف جميل المتحدة للتمويل، شركة اليسر للإجارة والتمويل، شركة الراجحي للتمويل، شركة نايفات للتمويل، شركة أمكان للتمويل، شركة تمويل الأولى، شركة المتاجرة المالية، شركة أصيل للتمويل، شركة التيسير العربية، شركة ميفك كابيتال، شركة تسهيل للتمويل، شركة فيول للتمويل، شركة منافع للتمويل، شركة عِمكان للتمويل، شركة سلفة للتمويل، شركة تمام للتمويل (stc)، شركة ماني فيلوز، شركة فورس للتمويل، شركة ميسر للتمويل، شركة لندو (Lendo)، شركة فنتك ردف، منصة فرقد المالية، شركة مرابحة مرنة، شركة تروي (Tarabut)، منصة ليندو، شركة قرض للتمويل الجماعي. جهات خليجية قد تموّل شركات سعودية (عبر فروع أو تمويل عابر للحدود): بنك الإمارات دبي الوطني، بنك أبوظبي الأول (FAB)، بنك دبي الإسلامي، مصرف أبوظبي الإسلامي، بنك الكويت الوطني (NBK)، بيت التمويل الكويتي (بيتك)، بنك قطر الوطني (QNB)، مصرف قطر الإسلامي، بنك البحرين والكويت، البنك الأهلي المتحد، جهات تمويل المنشآت في الخليج، صناديق التمويل التنموي الخليجية. جهات ومنصات تمويل دولية قد تموّل شركات في السعودية أو الأسواق الناشئة: مؤسسة التمويل الدولية (IFC)، البنك الإسلامي للتنمية، صناديق التمويل الخاصة (private credit) الإقليمية والدولية، منصات تمويل المنشآت العابرة للحدود.';
    const FOREIGN = 'قائمة موسّعة للجهات الخارجية — مصنّفة حسب المسار القانوني للتمويل داخل السعودية:\n(١) بنوك أجنبية لها فروع مرخّصة من البنك المركزي السعودي: ستاندرد تشارترد، سيتي بنك، جي بي مورغان، دويتشه بنك، بي إن بي باريبا، بنك قطر الوطني QNB، بنك الإمارات دبي الوطني، بنك أبوظبي الأول FAB، بنك الكويت الوطني NBK، بنك المشرق، بنك الصين، البنك الصناعي التجاري الصيني ICBC، بنك الخليج الدولي GIB.\n(٢) بنوك ومؤسسات خليجية تموّل عابراً للحدود: بنك دبي الإسلامي، مصرف أبوظبي الإسلامي، بنك أبوظبي التجاري، بيت التمويل الكويتي، مصرف قطر الإسلامي، بنك البحرين والكويت، البنك الأهلي المتحد، مؤسسة الخليج للاستثمار.\n(٣) مؤسسات تنموية ومتعددة الأطراف تموّل التجارة والمنشآت السعودية: المؤسسة الدولية الإسلامية لتمويل التجارة ITFC (جدة)، المؤسسة الإسلامية لتنمية القطاع الخاص ICD (جدة)، البنك الإسلامي للتنمية IsDB (جدة)، الشركة العربية للاستثمارات البترولية أبيكورب (الدمام)، برنامج تمويل التجارة العربية، مؤسسة التمويل الدولية IFC، صندوق أوبك للتنمية الدولية.\n(٤) وكالات ائتمان التصدير التي تموّل المشتري السعودي أو تضمن المورّد: UK Export Finance، Allianz Trade، SACE، Coface، Atradius، US EXIM، Sinosure الصينية، K-SURE الكورية، NEXI اليابانية، EDC الكندية، Bpifrance.\n(٥) منصات تمويل الفواتير والتجارة العابرة للحدود: Incomlend (سنغافورة)، Stenn، Drip Capital، Modifi، Velotrade، Tradeteq، Marco.\n(٦) صناديق دين خاص واستثمار إقليمية نشطة في السعودية: إنفستكورب، جلف كابيتال، NBK Capital Partners، أركابيتا، شعاع كابيتال، رويا بارتنرز.';
    const prompt = 'أنت محلل تمويل خبير في السوق السعودي والخليجي. ابحث في الويب بحثاً دقيقاً ومهنياً عن المنتجات التمويلية المتاحة حالياً للشركة، وقسّم بحثك إلى ثلاث طبقات بالأولوية:\nالطبقة الأولى (الأهم والأوسع): الجهات السعودية المرخّصة من البنك المركزي السعودي (ساما) — غطِّها بعمق.\nالطبقة الثانية: جهات خليجية قد تموّل شركة سعودية (لها فروع في السعودية أو تموّل عبر الحدود).\nالطبقة الثالثة: جهات تمويل دولية قد تموّل شركات في السعودية أو الأسواق الناشئة.\nالجهات المرجعية لكل طبقة:\n' + LICENSED + '\n' + FOREIGN + '\n\n'
      + 'ملف الشركة الباحثة عن تمويل:\n'
      + '- نوع التمويل المطلوب: ' + typeLabel + '\n'
      + '- الإيرادات السنوية: ' + rev.toLocaleString() + ' ريال\n'
      + '- عمر النشاط: ' + years + ' سنة\n'
      + '- القطاع: ' + (company.sector || 'غير محدد') + '\n'
      + '- طبيعة النشاط: ' + (ACT_LABELS[String(fd.activity_type)] || fd.activity_type || 'غير محدد') + '\n'
      + '- نقاط بيع (مدى): ' + (fd.has_pos ? 'نعم' : 'لا') + ' | يصدر فواتير آجلة: ' + (fd.issues_invoices ? 'نعم' : 'لا') + ' | لديه أسطول/معدات: ' + (fd.has_fleet ? 'نعم' : 'لا') + '\n'
      + '- ' + debtDesc + '\n'
      + '- سجل تجاري ' + (fd.cr_valid ? 'ساري' : 'غير ساري') + '، التزام ضريبي: ' + (fd.tax_compliant ? 'نعم' : 'لا') + '، زكاة: ' + (fd.zakat_compliant ? 'نعم' : 'لا') + '، قوائم مالية: ' + (fd.has_financial_statements ? 'متوفرة' : 'غير متوفرة') + '\n\n'
      + 'ابحث عن منتجات ' + typeLabel + ' لدى هذه الجهات. الهدف ليس ملء القائمة بل التأهيل الصارم: لا تُدرج منتجا إلا إذا كان العميل مؤهلاً له فعلاً، أو مؤهلاً بشرط واضح وقابل للمعالجة. استبعد نهائياً أي منتج لا يستوفي العميل شروطه المعلنة ولا يستطيع استيفاءها. عشرة منتجات مؤهلة أفضل من خمسين ترشيحاً.\n\n'
      + 'قواعد إلزامية:\n'
      + '1) غطِّ مزيجاً متوازناً: لا تقتصر على البنوك — أدرج شركات التمويل المرخصة (مثل نايفات، أمكان، لندو، سلفة، تمام، أملاك) فهي غالباً أنسب للشركات الصغيرة والمتوسطة وفرص القبول فيها أعلى. اجعل نصف العروض على الأقل من شركات التمويل ومنصات التمويل الجماعي إن وُجدت منتجات مناسبة.\n'
      + '2) لا تقترح منتجاً يتطلب خاصية غير مؤكدة لدى الشركة. مثلاً: لا تقترح "تمويل نقاط البيع" إلا إذا كان قطاع الشركة تجزئة أو مطاعم أو خدمات استهلاكية (قد تملك نقاط بيع). ولا تقترح "تمويل الفواتير" إلا إذا كان نشاطها يصدر فواتير آجلة (B2B/مقاولات/توريد). إن لم تتأكد من ملاءمة المنتج لطبيعة نشاطها، لا تدرجه.\n'
      + '3) ركّز على منتجات التمويل العامة المناسبة لقطاع "' + (company.sector || 'غير محدد') + '" تحديداً.\n'
      + '4) طابق المنتجات مع تشخيص النشاط أعلاه بدقة: اقترح تمويل نقاط البيع فقط إن كان "نقاط بيع = نعم"؛ تمويل الفواتير/المستخلصات فقط إن كان "يصدر فواتير = نعم"؛ تمويل اقتناء المعدات أو السيارات جائز اقتراحه ولو كان "لديه أسطول = لا" ما دام الإيراد وطبيعة النشاط يحتملانه، لأن الأصل الجديد نفسه هو الضمان؛ ولا تقترح تمويلاً مقابل أسطول قائم (إعادة تمويل أو بيع وإعادة استئجار) إلا إن كان "لديه أسطول = نعم". إن كانت الإجابة لا في نقاط البيع أو الفواتير، لا تقترح ذلك النوع إطلاقاً مهما بدا مناسباً.\n\n'
      + '5) للطبقة الثانية (الخليج) والثالثة (الدولي): الممولون هناك يطلبون عادةً متطلبات أعلى — قوائم مالية مدققة، كيان قانوني واضح، حد أدنى أعلى للإيرادات، وأحياناً سجل تشغيلي أطول. اذكر في حقل requirements هذه المتطلبات الإضافية بوضوح، وفي حقل fit وضّح ما إذا كانت الشركة تستوفيها أو ما ينقصها للتأهل. لا تقترح جهة خليجية أو دولية إلا إذا كان حجم الشركة وإيراداتها منطقيين لها.\n'
      + '6) نوّع أنواع المنتجات حسب الطبقة: السعودية (تمويل عامل، مرابحة، إجارة، تمويل المنشآت)؛ الخليج (تمويل عابر للحدود، تمويل تجاري، خطوط ائتمان)؛ الدولي (private credit، تمويل تنموي، تمويل الأسواق الناشئة).\n\n'
      + '7) قاعدة حاسمة للجهات الخليجية والدولية: لا تُدرج جهة خارجية إلا إذا توفر أحد أمرين موثّقين: (أ) سابقة فعلية — دليل منشور أنها موّلت منشأة سعودية أو خليجية مع الرابط والسنة، أو (ب) مسار قانوني واضح للتمويل داخل السعودية: فرع مرخّص من البنك المركزي السعودي، أو تمويل تجاري عابر مضمون بفواتير تصدير أو اعتمادات مستندية، أو التمويل عبر بنك أو شريك محلي، أو صندوق دين خاص إقليمي يستثمر في السعودية. أي جهة خارجية بلا سابقة وبلا مسار قانوني: استبعدها تماماً مهما بدت مناسبة.\n'
      + '9) توزيع البحث إلزامي ومتساوٍ: خصّص نصف استعلامات البحث للجهات السعودية والنصف الآخر للجهات الخليجية والدولية مجتمعة. وغطِّ المسارات الستة في القائمة الموسّعة: فروع مرخّصة من ساما، خليجي عابر للحدود، مؤسسات تنموية، وكالات ائتمان تصدير، منصات فواتير عابرة، صناديق دين خاص. لا تنهِ البحث وأنت لم تفحص إلا مساراً واحداً — ومع ذلك لا تُدرج أي جهة تخالف القاعدة السابعة مهما بدت مناسبة.\n'
      + '8) لكل منتج أصدر حكم أهلية صريحاً: متأهل أو متأهل بشرط، أو استبعده. واذكر في gaps الفجوات بدقة واختصار، وamountRange المبلغ المتوقع لهذا العميل تحديداً، وtimeline زمن الدراسة التقريبي.\n'
      + 'أرجع JSON فقط بدون أي نص آخر وبدون markdown، بهذا الشكل:\n'
      + '{"offers":[{"region":"السعودية أو الخليج أو دولي","provider":"اسم الجهة","product":"اسم المنتج","requirements":"الشروط المعلنة باختصار","verdict":"متأهل أو متأهل بشرط","gaps":["فجوة"],"amountRange":"المبلغ المتوقع","timeline":"زمن الدراسة","saudiPrecedent":"السابقة مع الرابط والسنة أو null","legalPath":"المسار القانوني أو null","source":"رابط المصدر"}]}\n'
      + 'ابحث براحتك وأرجع كل العروض المناسبة فعلاً عبر الطبقات الثلاث دون التقيّد بعدد معيّن — وازِن التغطية بين السعودية والخارج بالتساوي. رتب داخل كل طبقة من الأنسب للأقل، ولا تُدرج عرضاً غير مناسب لمجرد زيادة العدد.';

    const askMarket = async (pmt: string): Promise<WebOffer[]> => {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY as string,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 8000,
          messages: [{ role: 'user', content: pmt }],
          tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: budget === 'light' ? 8 : 25 }],
        }),
      });
      if (!r.ok) { webSearchError += ' | HTTP ' + r.status; return []; }
      const d = await r.json();
      const txt = (d.content || [])
        .filter((blk: { type: string }) => blk.type === 'text')
        .map((blk: { text: string }) => blk.text)
        .join('');
      const cleaned = txt.replace(/```json|```/g, '').trim();
      const j0 = cleaned.indexOf('{');
      const j1 = cleaned.lastIndexOf('}');
      if (j0 === -1 || j1 <= j0) return [];
      try {
        const parsed = JSON.parse(cleaned.slice(j0, j1 + 1));
        return Array.isArray(parsed.offers) ? parsed.offers : [];
      } catch { return []; }
    };

    const FUND_SCOPES = [
      'اقتصر على البنوك السعودية المرخّصة من البنك المركزي السعودي فقط.',
      'اقتصر على شركات التمويل ومنصات التمويل الجماعي المرخّصة من البنك المركزي السعودي فقط — لا بنوك.',
      'اقتصر على البنوك الأجنبية التي لها فروع مرخّصة من البنك المركزي السعودي وتعمل داخل المملكة. مسارها القانوني ثابت ولا يحتاج بحثاً — ابحث فقط عن منتجاتها: Standard Chartered، Citi، JP Morgan، Deutsche Bank، BNP Paribas، QNB، Emirates NBD، FAB، NBK، Mashreq، ICBC، Bank of China، GIB، وغيرها إن وجدت.',
      'اقتصر على البنوك والمؤسسات الخليجية التي تموّل عابراً للحدود شركات سعودية.',
      'اقتصر على المؤسسات التنموية ومتعددة الأطراف: ITFC، ICD، IsDB، أبيكورب، برنامج تمويل التجارة العربية، IFC، صندوق أوبك، وما شابهها.',
      'اقتصر على وكالات ائتمان التصدير التي تموّل المشتري السعودي أو تضمن المورّد: UKEF، Allianz Trade، SACE، Coface، Atradius، US EXIM، Sinosure، K-SURE، NEXI، EDC، Bpifrance.',
      'اقتصر على منصات تمويل الفواتير والتجارة العابرة للحدود: Incomlend، Stenn، Drip Capital، Modifi، Velotrade، Tradeteq، Marco، وما شابهها.',
      'اقتصر على صناديق الدين الخاص والاستثمار الإقليمية النشطة في السعودية: إنفستكورب، جلف كابيتال، NBK Capital Partners، أركابيتا، شعاع كابيتال، رويا بارتنرز، وما شابهها.',
    ];

    const INVEST_SCOPES = [
      'اقتصر على صناديق الملكية الخاصة وصناديق النمو المرخّصة من هيئة السوق المالية السعودية.',
      'اقتصر على المكاتب العائلية والمجموعات القابضة السعودية التي تستثمر في المنشآت الخاصة.',
      'اقتصر على منصات الاستثمار الجماعي في الأسهم المرخّصة من هيئة السوق المالية السعودية.',
      'اقتصر على صناديق النمو والملكية الخاصة الخليجية (الإمارات، الكويت، قطر، البحرين، عُمان).',
      'اقتصر على المكاتب العائلية الخليجية والكيانات الاستثمارية المرتبطة بالصناديق السيادية.',
      'اقتصر على الصناديق الأوروبية والأمريكية التي لها تفويض استثماري في الشرق الأوسط وشمال أفريقيا.',
      'اقتصر على الصناديق الآسيوية (سنغافورة، الصين، اليابان، كوريا، الهند) التي لها تفويض خليجي أو سعودي.',
      'اقتصر على المستثمرين الاستراتيجيين عالمياً في قطاع العميل — منافس أو مورّد أو موزّع يبحث عن موطئ قدم في السوق السعودي.',
      'اقتصر على صناديق الدين المرن والميزانين وventure debt التي تستثمر في الشركات الخاصة بالمنطقة.',
    ];
    const SCOPES = (isInvest ? INVEST_SCOPES : FUND_SCOPES).slice(0, budget === 'light' ? 2 : 99);

    const investPrompt = 'أنت محلل استثمار خبير في السوق السعودي والخليجي والعالمي. مهمتك إيجاد مستثمرين مناسبين فعلاً لهذه الشركة السعودية.\n\n'
      + 'ملف الشركة:\n'
      + '- الاسم: ' + (company.company_name || '') + '\n'
      + '- القطاع: ' + (company.sector || 'غير محدد') + '\n'
      + '- المدينة: ' + (company.city || 'غير محدد') + '\n'
      + '- الإيرادات السنوية: ' + rev.toLocaleString() + ' ريال\n'
      + '- صافي الربح: ' + Number(fd.net_profit || 0).toLocaleString() + ' ريال\n'
      + '- عمر النشاط: ' + years + ' سنة\n'
      + '- طبيعة النشاط: ' + (ACT_LABELS[String(fd.activity_type)] || 'غير محدد') + '\n\n'
      + 'قواعد إلزامية:\n'
      + '1) الاستثمار لا يُطابق على الإيراد وحده. طابق على: مرحلة الشركة، حجم التذكرة التي يكتبها المستثمر، أطروحته القطاعية، تفويضه الجغرافي، شهيته للحصة والسيطرة، وأفق خروجه. لا تقترح مستثمراً لا تتوافق تذكرته مع حجم الشركة.\n'
      + '2) شركة بهذا الحجم ليست هدفاً لصناديق رأس المال الجريء غالباً. المستهدف الواقعي: صناديق النمو والملكية الخاصة، المكاتب العائلية، المستثمر الاستراتيجي (منافس أو مورّد أو موزّع في نفس القطاع)، والدين المرن والميزانين.\n'
      + '3) للمستثمرين الخارجيين: لا تُدرج جهة إلا بسابقة استثمار موثّقة في السعودية أو الخليج مع الرابط والسنة، أو تفويض استثماري معلن يشمل السعودية أو الشرق الأوسط. وإلا استبعدها.\n'
      + '4) أصدر لكل مستثمر حكماً صريحاً: متأهل أو متأهل بشرط، أو استبعده. لا تحش القائمة.\n\n'
      + 'أرجع JSON فقط بدون أي نص آخر وبدون markdown:\n'
      + '{"offers":[{"region":"السعودية أو الخليج أو دولي","provider":"اسم المستثمر أو الصندوق","product":"نوع الاستثمار: حصة نمو أو ملكية خاصة أو استراتيجي أو دين مرن","requirements":"معايير المستثمر: المرحلة وحجم التذكرة والأطروحة القطاعية والتفويض الجغرافي وشهية الحصة والسيطرة","verdict":"متأهل أو متأهل بشرط","gaps":["ما ينقص الشركة للتأهل"],"amountRange":"حجم التذكرة المتوقع","timeline":"أفق إتمام الصفقة والخروج","saudiPrecedent":"سابقة استثمار في السعودية أو الخليج مع الرابط والسنة أو null","legalPath":"آلية الاستثمار: حصة مباشرة أو عبر صندوق أو دين قابل للتحويل أو null","source":"رابط المصدر"}]}';

    const basePrompt = isInvest ? investPrompt : prompt;

    const results = await Promise.all(SCOPES.map(sc => askMarket(
      basePrompt + '\n\nنطاق هذا الطلب حصراً: ' + sc +
      '\nاستثمر كل ميزانية البحث داخل هذا النطاق وحده، وأرجع كل جهة مؤهلة تجدها فيه دون سقف عددي. ' +
      'لا تُدرج جهة خارج النطاق، ولا تحش القائمة: إن لم تجد إلا جهتين مؤهلتين فأرجع جهتين. القاعدة السابعة تبقى إلزامية.'
    )));

    const seen = new Set<string>();
    webOffers = results.flat().filter(o => {
      const k = (o.provider || '') + '|' + (o.product || '');
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    webSearchOk = webOffers.length > 0;
  } catch (err) {
    webSearchError = err instanceof Error ? err.message : String(err);
  }
  return { offers: webOffers, ok: webSearchOk, error: webSearchError };
}

export async function saveMatchResults(companyId: string, track: string, offers: WebOffer[]) {
  if (!companyId || !offers.length) return { saved: 0, error: 'no offers' };
  try {
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      process.env.SUPABASE_SERVICE_ROLE_KEY as string
    );
    await admin.from('match_results')
      .update({ status: 'superseded' })
      .eq('company_id', companyId)
      .eq('track', track);
    const rows = offers.map((o) => ({
      company_id: companyId,
      track,
      region: o.region || null,
      provider: o.provider,
      product: o.product,
      requirements: o.requirements,
      fit: o.verdict || null,
      fit_score: (() => {
        const v = String(o.verdict || '');
        if (/\u063a\u064a\u0631 \u0645\u0624\u0647\u0644|\u0645\u0633\u062a\u0628\u0639\u062f|\u063a\u064a\u0631 \u0645\u062a\u0627\u062d/.test(v)) return 0;
        if (v.includes('\u0628\u0634\u0631\u0637')) return 70;
        return 90;
      })(),
      source: o.source || null,
      verdict: o.verdict || null,
      gaps: o.gaps || [],
      amount_range: o.amountRange || null,
      timeline: o.timeline || null,
      saudi_precedent: o.saudiPrecedent || null,
      legal_path: o.legalPath || null,
      status: 'new',
    }));
    const { error } = await admin.from('match_results').insert(rows);
    if (error) return { saved: 0, error: error.message };
    return { saved: rows.length, error: '' };
  } catch (e) {
    return { saved: 0, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function runAutoMatch(companyId: string, track: 'funding' | 'investment'): Promise<void> {
  try {
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      process.env.SUPABASE_SERVICE_ROLE_KEY as string
    );
    const { data: company } = await admin.from('companies').select('*').eq('id', companyId).single();
    if (!company) return;
    const { data: fd } = await admin.from('financial_data').select('*')
      .eq('company_id', companyId).order('created_at', { ascending: false }).limit(1).single();
    if (!fd) return;
    const isInvest = track === 'investment';
    const rev = Number(fd.annual_revenue) || 0;
    const years = Number(fd.years_operating) || 0;
    const typeLabel = fd.funding_type === 'other'
      ? (fd.funding_type_other || '\u0623\u062e\u0631\u0649')
      : (TYPE_LABELS[fd.funding_type as string] || fd.funding_type || '\u062a\u0645\u0648\u064a\u0644');
    const debtDesc = fd.has_debt
      ? '\u064a\u0648\u062c\u062f \u062a\u0645\u0648\u064a\u0644 \u0642\u0627\u0626\u0645'
      : '\u0644\u0627 \u062a\u0648\u062c\u062f \u062f\u064a\u0648\u0646 \u0642\u0627\u0626\u0645\u0629';
    const r = await runScopedMatch({ company, fd, typeLabel, rev, years, debtDesc, isInvest, budget: 'full' });
    if (!r.offers.length) return;
    await saveMatchResults(companyId, track, r.offers);
    try {
      const { data: rr } = await admin.from('readiness_results')
        .select('readiness_score, verdict').eq('company_id', companyId)
        .order('created_at', { ascending: false }).limit(1).single();
      const has = (re: RegExp) => r.offers.filter((o) => re.test(String(o.region || ''))).length;
      const gulf = has(/خليج/);
      const intl = has(/دولي/);
      const saudi = r.offers.length - gulf - intl;
      const bad = /غير مؤهل|مستبعد|غير متاح/;
      const ok = r.offers.filter((o) => !bad.test(String(o.verdict || ''))).length;
      const cond = r.offers.filter((o) => String(o.verdict || '').includes('بشرط')).length;
      const label = track === 'investment' ? 'استثمار' : 'تمويل';
      const box = (t: string, v: number, c: string) =>
        '<td style="padding:14px;text-align:center;border:1px solid #E3E8E6;background:' + c + '">'
        + '<div style="font-size:26px;font-weight:900;color:#1A3D34">' + v + '</div>'
        + '<div style="font-size:12px;color:#5C6B66">' + t + '</div></td>';
      await new Resend(process.env.RESEND_API_KEY).emails.send({
        from: 'د. عبدالحكيم المرضي <noreply@murdi.sa>',
        to: 'hololalmurdi.fs@gmail.com',
        subject: 'مطابقة ' + label + ' — ' + company.company_name + ' (' + r.offers.length + ' فرصة)',
        html: '<div dir="rtl" style="font-family:Arial">'
          + '<h2 style="color:#1A3D34">مطابقة ' + label + ' جديدة</h2>'
          + '<p><b>الشركة:</b> ' + company.company_name + ' — سجل: ' + (company.cr_number || '—') + '</p>'
          + '<p><b>الجوال:</b> ' + (company.phone || '—') + ' | <b>الجاهزية:</b> ' + (rr?.readiness_score ?? '—') + ' — ' + (rr?.verdict ?? '') + '</p>'
          + '<table style="border-collapse:collapse;width:100%;margin-top:12px"><tr>'
          + box('إجمالي الفرص', r.offers.length, '#F7FAF9')
          + box('متأهلة', ok - cond, '#EAF6F1')
          + box('بشرط', cond, '#FBF5E8')
          + '</tr><tr>'
          + box('سعودية', saudi, '#F7FAF9')
          + box('خليجية', gulf, '#F7FAF9')
          + box('دولية', intl, '#F7FAF9')
          + '</tr></table>'
          + '<p style="margin-top:18px"><a href="https://murdi.sa/admin/approvals" style="background:#1A3D34;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold">📂 افتح أسماء الجهات في الأدمن</a></p>'
          + '</div>',
      });
    } catch {}
  } catch {}
}
