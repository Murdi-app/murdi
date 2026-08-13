/* eslint-disable @typescript-eslint/no-explicit-any */
// محرك المطابقة المشترك

import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { logError } from '@/lib/logError';

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

export   type WebOffer = { region?: string; provider: string; product: string; requirements: string; source: string; verdict?: string; instrument?: string; engagement?: string; gaps?: string[]; amountRange?: string; timeline?: string; saudiPrecedent?: string | null; legalPath?: string | null };

export async function runScopedMatch(args: {
  company: Rec; fd: Rec; typeLabel: string; rev: number;
  years: number; debtDesc: string; isInvest: boolean; budget?: 'light' | 'full';
  scopeFrom?: number; scopeTo?: number;
}): Promise<{ offers: WebOffer[]; ok: boolean; error: string; totalScopes: number }> {
  let totalScopes = 0;
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
      + '- يصدّر/يستورد: ' + (fd.trades_cross_border || 'غير محدد') + ' | نوع العملاء: ' + (fd.client_type || 'غير محدد') + ' | دورة التحصيل: ' + (fd.collection_cycle || 'غير محدد') + ' | أصول قابلة للرهن: ' + (fd.has_collateral || 'غير محدد') + '\n'
      + '- نقاط بيع (مدى): ' + (fd.has_pos ? 'نعم' : 'لا') + ' | يصدر فواتير آجلة: ' + (fd.issues_invoices ? 'نعم' : 'لا') + ' | لديه أسطول/معدات: ' + (fd.has_fleet ? 'نعم' : 'لا') + '\n'
      + '- ' + debtDesc + '\n'
      + '- سجل تجاري ' + (fd.cr_valid ? 'ساري' : 'غير ساري') + '، التزام ضريبي: ' + (fd.tax_compliant ? 'نعم' : 'لا') + '، زكاة: ' + (fd.zakat_compliant ? 'نعم' : 'لا') + '، قوائم مالية: ' + (fd.has_financial_statements ? 'متوفرة' : 'غير متوفرة') + '\n\n'
      + 'ابحث عن منتجات ' + typeLabel + ' لدى هذه الجهات. الهدف ليس ملء القائمة بل التأهيل الصارم: لا تُدرج منتجا إلا إذا كان العميل مؤهلاً له فعلاً، أو مؤهلاً بشرط واضح وقابل للمعالجة. استبعد نهائياً أي منتج لا يستوفي العميل شروطه المعلنة ولا يستطيع استيفاءها. عشرة منتجات مؤهلة أفضل من خمسين ترشيحاً.\n\n'
      + 'قواعد إلزامية:\n'
      + '1) غطِّ مزيجاً متوازناً: لا تقتصر على البنوك — أدرج شركات التمويل المرخصة (مثل نايفات، أمكان، لندو، سلفة، تمام، أملاك) فهي غالباً أنسب للشركات الصغيرة والمتوسطة وفرص القبول فيها أعلى. اجعل نصف العروض على الأقل من شركات التمويل ومنصات التمويل الجماعي إن وُجدت منتجات مناسبة.\n'
      + '2) لا تقترح منتجاً يتطلب خاصية غير مؤكدة لدى الشركة. مثلاً: لا تقترح "تمويل نقاط البيع" إلا إذا كان قطاع الشركة تجزئة أو مطاعم أو خدمات استهلاكية (قد تملك نقاط بيع). ولا تقترح "تمويل الفواتير" إلا إذا كان نشاطها يصدر فواتير آجلة (B2B/مقاولات/توريد). إن لم تتأكد من ملاءمة المنتج لطبيعة نشاطها، لا تدرجه.\n'
      + '3) ركّز على منتجات التمويل العامة المناسبة لقطاع "' + (company.sector || 'غير محدد') + '" تحديداً.\n'
      + '4) طابق المنتجات مع تشخيص النشاط أعلاه بدقة: اقترح تمويل نقاط البيع فقط إن كان "نقاط بيع = نعم"؛ تمويل الفواتير/المستخلصات فقط إن كان "يصدر فواتير = نعم"؛ تمويل اقتناء المعدات أو السيارات جائز اقتراحه ولو كان "لديه أسطول = لا" ما دام الإيراد وطبيعة النشاط يحتملانه، لأن الأصل الجديد نفسه هو الضمان؛ ولا تقترح تمويلاً مقابل أسطول قائم (إعادة تمويل أو بيع وإعادة استئجار) إلا إن كان "لديه أسطول = نعم". إن كانت الإجابة لا في نقاط البيع أو الفواتير، لا تقترح ذلك النوع إطلاقاً مهما بدا مناسباً.\n\n'
      + '5) للطبقة الثانية (الخليج) والثالثة (الدولي): الممولون هناك يطلبون عادةً متطلبات أعلى — قوائم مالية مدققة، كيان قانوني واضح، حد أدنى أعلى للإيرادات، وأحياناً سجل تشغيلي أطول. اذكر في حقل requirements هذه المتطلبات الإضافية بوضوح، وفي حقل fit وضّح ما إذا كانت الشركة تستوفيها أو ما ينقصها للتأهل. ولا تحذف الجهة لمجرد ارتفاع متطلباتها؛ أدرجها بحكم متأهل بشرط مع ذكر ما ينقص.\n'
      + '6) نوّع أنواع المنتجات حسب الطبقة: السعودية (تمويل عامل، مرابحة، إجارة، تمويل المنشآت)؛ الخليج (تمويل عابر للحدود، تمويل تجاري، خطوط ائتمان)؛ الدولي (private credit، تمويل تنموي، تمويل الأسواق الناشئة).\n\n'
      + '7) معيار الجدوى للجهات الخليجية والدولية: كثير من الجهات تموّل خليجياً ولا تنشر صفقاتها، فلا تشترط سابقة منشورة. يكفي أي دليل على قابلية التمويل: مكتب أو فرع أو ممثل في السعودية أو الخليج؛ أو منتج عابر للحدود معلن على موقعها؛ أو تفويض جغرافي يشمل الشرق الأوسط أو الأسواق الناشئة؛ أو شراكة أو مراسلة مع بنك سعودي؛ أو عضوية في شبكة تمويل تجارة تشمل السعودية؛ أو سابقة منشورة إن وجدت. وإن لم تجد أي دليل فلا تحذف الجهة، بل اجعل حكمها متأهل بشرط واكتب في الفجوات: يلزم التحقق من قابلية التمويل عبر الحدود. ورتّب الدولية بالأجدى عملياً لا بالأكبر اسماً.\n'
      + '7أ) المطلوب أوسع تغطية ممكنة: أخرج كل جهة وكل منتج قد يناسب العميل، ولا تختصر القائمة. للجهة الواحدة أخرج صفاً لكل منتج مناسب، ولا تقف عند أول صفحة نتائج، وابحث بالعربية والإنجليزية وباسم المنتج لا باسم الجهة فقط. والقوائم أعلاه أمثلة لا حصر؛ والمنتجات تتغيّر فابحث عن المطروح اليوم.\n'
      + '7ب) التغطية الدولية: المستهدف خمسون جهة دولية خارج الخليج من أمريكا وأوروبا وبريطانيا وسنغافورة والصين، والخليج يُحسب منفصلاً. والأغلب يجب أن يكون جهات تُقرض العميل مباشرةً: بنوك تجارية، ومنصات تمويل فواتير وتجارة، وشركات إقراض مباشر، وأذرعة تمويل المصنّعين، ومموّلي سلاسل الإمداد. ووكالات ائتمان التصدير وتأمين الائتمان خمس جهات كحد أقصى.\n'
      + '7ل) المنطقة تُحدّد بمقر الجهة وترخيصها لا بنوع منتجها: ما كان مرخّصاً أو مقرّه في السعودية فهو السعودية (ومنها جدوى والمؤسسة الإسلامية لتنمية القطاع الخاص بجدة)، وما مقرّه دولة خليجية فهو الخليج، وما عداهما دولي.\n'
      + '7ج) الجهة يجب أن يقدّم لها العميل مباشرةً؛ فاستبعد من يموّل البنوك لتعيد إقراضه. وأي بنك أو شركة تمويل لها فرع مرخّص من البنك المركزي السعودي اجعل region = السعودية.\n'
      + '7د) قدّم المنتجات التي تخدم أنواع التمويل المطلوبة أولاً، وإن ذُكر أن لدى العميل عقاراً أو أصولاً فافتح له المنتجات المضمونة برهن. وما لم تتيقّن من ملاءمته اجعل حكمه متأهل بشرط واذكر الفجوة — ولا تحذفه.\n'

      + '9) توزيع البحث إلزامي ومتساوٍ: خصّص ثلث استعلامات البحث للجهات السعودية والثلثين للخليجية والدولية. وغطِّ المسارات الستة في القائمة الموسّعة: فروع مرخّصة من ساما، خليجي عابر للحدود، مؤسسات تنموية، وكالات ائتمان تصدير، منصات فواتير عابرة، صناديق دين خاص. لا تنهِ البحث وأنت لم تفحص إلا مساراً واحداً — ومع ذلك لا تُدرج أي جهة تخالف القاعدة السابعة مهما بدت مناسبة.\n'
      + 'قاعدة جوهرية — المطابقة على مستوى المنتج لا الجهة: الجهة الواحدة عندها عدة منتجات بشروط مختلفة، ورفض العميل في منتج لا يعني رفضه في الجهة. فأخرج صفاً مستقلاً لكل منتج مناسب ولو تعددت منتجات الجهة الواحدة، وسمّ المنتج باسمه التجاري المعلن لا بوصف عام. وإذا كان العميل لا يتأهل لمنتج الجهة الرئيس، فابحث عن منتج بديل لدى الجهة نفسها يتأهل له واذكره — هذا أهم ما يميز هذه المطابقة.\n'
      + '8) لكل منتج أصدر حكم أهلية صريحاً: متأهل أو متأهل بشرط، أو استبعده. واذكر في gaps الفجوات بدقة واختصار، وamountRange المبلغ المتوقع لهذا العميل تحديداً، وtimeline زمن الدراسة التقريبي.\n'
      + 'قاعدة إلزامية قصوى: لكل جهة املأ حقلي instrument وengagement ولا يجوز تركهما فارغين. '
      + 'instrument قيمة واحدة: تمويل مباشر إذا كانت تعطي العميل المال وتسترده؛ أو ضمان إذا كانت تضمن أمام مموّل ولا تدفع للعميل؛ أو تأمين ائتمان إذا كانت تؤمّن البائع من تعثّر المشتري ولا تموّل أحداً — مثل Coface وAllianz Trade وAtradius وSinosure وICIEC؛ أو دعم'
      + 'engagement قيمة واحدة: طرف مقابل إذا كانت تموّل من ميزانيتها؛ أو قناة إذا كانت منصة يموّل عبرها آخرون أو تحيل الطلب لجهة أخرى — مثل منصات التمويل الجماعي ومنصات الفواتير العابرة.\n'
      + 'أرجع JSON فقط بدون أي نص آخر وبدون markdown، بهذا الشكل:\n'
      + '{"offers":[{"region":"السعودية أو الخليج أو دولي","provider":"اسم الجهة","product":"اسم المنتج","requirements":"الشروط المعلنة باختصار","verdict":"متأهل أو متأهل بشرط","gaps":["فجوة"],"amountRange":"المبلغ المتوقع","timeline":"زمن الدراسة","saudiPrecedent":"السابقة مع الرابط والسنة أو null","legalPath":"المسار القانوني أو null","instrument":"تمويل مباشر أو ضمان أو دعم","engagement":"طرف مقابل أو قناة","source":"رابط المصدر"}]}\n'
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
          max_tokens: 24000,
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

    const MICRO_SCOPES = [
      'اقتصر على بنك التنمية الاجتماعية وبرامج التمويل متناهي الصغر والأسري في السعودية.',
      'اقتصر على منشآت وبرامجها التمويلية والداعمة للمنشآت الصغيرة والمتناهية الصغر، وبرامج الجهات الحكومية المشابهة.',
      'اقتصر على منصات التمويل الجماعي بالدين المرخّصة من البنك المركزي السعودي.',
      'اقتصر على شركات التمويل السعودية التي تمول المنشآت الصغيرة بمبالغ محدودة: نايفات، أمكان، تمويل الأولى، سلفة، تمام، وما شابهها.',
      'اقتصر على برامج الضمان الحكومية وضمانات كفالة والجهات التي تسهّل وصول المنشآت الصغيرة للتمويل البنكي.',
      'اقتصر على تمويل الموردين والدفع الآجل بين الشركات والمنصات التي تموّل المشتريات التشغيلية.',
    ];
    const FUND_SCOPES = [
      'اقتصر على البنوك السعودية المرخّصة من البنك المركزي السعودي فقط.',
      'اقتصر على شركات التمويل ومنصات التمويل الجماعي المرخّصة من البنك المركزي السعودي فقط — لا بنوك.',
      'اقتصر على البنوك الأجنبية التي لها فروع مرخّصة من البنك المركزي السعودي وتعمل داخل المملكة. مسارها القانوني ثابت ولا يحتاج بحثاً — ابحث فقط عن منتجاتها: Standard Chartered، Citi، JP Morgan، Deutsche Bank، BNP Paribas، QNB، Emirates NBD، FAB، NBK، Mashreq، ICBC، Bank of China، GIB، وغيرها إن وجدت.',
      'اقتصر على البنوك والمؤسسات الخليجية التي تموّل عابراً للحدود شركات سعودية.',
      'اقتصر على المؤسسات التنموية ومتعددة الأطراف: ITFC، ICD، IsDB، أبيكورب، برنامج تمويل التجارة العربية، IFC، صندوق أوبك، وما شابهها.',
      'اقتصر على الإقراض المضمون بأصل: شركات التمويل العقاري المرخّصة من البنك المركزي، وبرامج البيع وإعادة الاستئجار، والجهات التي تقرض على قيمة الأصل المرهون لا على السجل الائتماني وحده، وتمويل المخزون والمعدّات برهنها. اذكر لكل منتج نسبة التمويل من قيمة الأصل إن كانت معلنة.',
      'اقتصر على وكالات ائتمان التصدير التي تموّل المشتري السعودي أو تضمن المورّد: UKEF، Allianz Trade، SACE، Coface، Atradius، US EXIM، Sinosure، K-SURE، NEXI، EDC، Bpifrance.',
      'اقتصر على منصات تمويل الفواتير والتجارة العابرة للحدود: Incomlend، Stenn، Drip Capital، Modifi، Velotrade، Tradeteq، Marco، وما شابهها.',
      'اقتصر على شركات التمويل والإجارة الخليجية غير البنكية التي تموّل شركات سعودية عبر الحدود أو عبر فروع مرخّصة.',
      'اقتصر على مؤسسات التمويل التنموي الثنائية (DFIs) التي تموّل القطاع الخاص في الشرق الأوسط: BII البريطانية، Proparco الفرنسية، DEG الألمانية، FMO الهولندية، OeEB النمساوية، SIFEM السويسرية، BIO البلجيكية.',
      'اقتصر على بيوت التمويل الإسلامي وشركات المرابحة الخليجية التي تموّل المنشآت السعودية.',
      'اقتصر على منصات وبرامج تمويل سلاسل الإمداد العالمية (Supply Chain Finance) التي تموّل مورّدي الشركات الكبرى في السعودية.',
      'اقتصر على صناديق الدين الخاص العالمية (أمريكية وأوروبية وآسيوية) ذات التفويض المعلن في الشرق الأوسط والأسواق الناشئة.',
      'اقتصر على مموّلي المعدّات والآلات الدوليين وأذرعة التمويل التابعة للمصنّعين (Vendor وCaptive Finance) التي تموّل المشتري السعودي.',
      'اقتصر على صناديق الدين الخاص والاستثمار الإقليمية النشطة في السعودية: إنفستكورب، جلف كابيتال، NBK Capital Partners، أركابيتا، شعاع كابيتال، رويا بارتنرز، وما شابهها.',
    ];

    const EARLY_SCOPES = [
      'اقتصر على مجموعات المستثمرين الملائكيين المنظّمة في السعودية والخليج.',
      'اقتصر على صناديق رأس المال الجريء في المراحل المبكرة (Pre-Seed وSeed وSeries A) النشطة في السعودية.',
      'اقتصر على الصناديق الحكومية وشبه الحكومية الداعمة للمنشآت الناشئة: صندوق الصناديق (جدا)، الشركة السعودية للاستثمار الجريء، منشآت، وما شابهها.',
      'اقتصر على مسرّعات الأعمال والحاضنات التي تستثمر نقداً مقابل حصة في السعودية والخليج.',
      'اقتصر على المستثمرين الاستراتيجيين في قطاع العميل الباحثين عن تقنية أو ترخيص أو فريق جاهز.',
    ];
    const ACQ_SCOPES = [
      'اقتصر على صناديق تملّك المنشآت الرابحة: search funds وETA وصناديق الاستحواذ على الشركات الصغيرة والمتوسطة، السعودية والخليجية والدولية.',
      'اقتصر على الشركات المدرجة في السوق الموازية نمو وفي السوق الرئيسية تداول الباحثة عن استحواذ مكمّل في قطاع العميل، والمجموعات السعودية الخاصة الكبيرة التي تنمو بالاستحواذ.',
      'اقتصر على المشترين الاستراتيجيين الخليجيين والدوليين في قطاع العميل: منافس أو مورّد أو موزّع يسعى لموطئ قدم في السوق السعودي عبر الاستحواذ.',
    ];
    const EARLY_STAGE = rev < 3000000;
    const intent = String(fd.investment_intent || 'both');
    const INVEST_SCOPES = [
      'اقتصر على صناديق الملكية الخاصة السعودية المرخّصة من هيئة السوق المالية.',
      'اقتصر على صناديق النمو والفرص السعودية المرخّصة وشركات الاستثمار الجريء التي تستثمر في مراحل النمو لا التأسيس.',
      'اقتصر على المكاتب العائلية والمجموعات القابضة السعودية التي تستثمر في المنشآت الخاصة.',
      'اقتصر على منصات التمويل الجماعي بالأسهم المرخّصة من هيئة السوق المالية فقط التي تطرح حصص ملكية. استبعد تماماً منصات التمويل الجماعي بالدين المرخّصة من البنك المركزي مثل Lendo وتمويلي وفرص — أداتها قرض يُسدّد لا حصة ملكية.',
      'اقتصر على شبكات المستثمرين الملائكة والمستثمرين الأفراد المؤهلين المنظّمين في السعودية والخليج.',
      'اقتصر على صناديق النمو والملكية الخاصة الخليجية (الإمارات، الكويت، قطر، البحرين، عُمان).',
      'اقتصر على المكاتب العائلية الخليجية والكيانات الاستثمارية المرتبطة بالصناديق السيادية.',
      'اقتصر على الصناديق الأوروبية والأمريكية التي لها تفويض استثماري في الشرق الأوسط وشمال أفريقيا.',
      'اقتصر على الصناديق الآسيوية (سنغافورة، الصين، اليابان، كوريا) التي لها تفويض خليجي أو سعودي.',
      'اقتصر على المستثمرين الاستراتيجيين السعوديين والخليجيين في قطاع العميل — منافس أو مورّد أو موزّع يبحث عن حصة.',
      'اقتصر على صناديق الدين المرن والميزانين وventure debt التي تستثمر في الشركات الخاصة بالمنطقة.',
    ];
    const EQUITY_SET = EARLY_STAGE ? EARLY_SCOPES : INVEST_SCOPES;
    const INVEST_ALL = intent === 'sell' ? ACQ_SCOPES
      : intent === 'partner' ? EQUITY_SET
      : EQUITY_SET.concat(ACQ_SCOPES);
    const FUND_ALL = rev < 1000000 ? MICRO_SCOPES : FUND_SCOPES;
    const ALL_SCOPES = (isInvest ? INVEST_ALL : FUND_ALL);
    totalScopes = ALL_SCOPES.length;
    const SCOPES = (args.scopeFrom !== undefined || args.scopeTo !== undefined)
      ? ALL_SCOPES.slice(args.scopeFrom || 0, args.scopeTo === undefined ? 99 : args.scopeTo)
      : ALL_SCOPES.slice(0, budget === 'light' ? 2 : 99);

    const INST_RULE = '\nقاعدة إلزامية قصوى: لكل جهة يجب ملء حقلي instrument وengagement ولا يجوز تركهما فارغين أبداً. '
      + 'instrument قيمة واحدة فقط: ملكية إذا كان المقابل حصة، أو دين مساند للميزانين وventure debt، أو دين لأي تمويل يُسدّد. '
      + 'engagement قيمة واحدة فقط: طرف مقابل إذا كانت الجهة تستثمر من مالها، أو قناة إذا كانت منصة تعرض الفرصة على جمهور يموّلون بدلها. '
      + 'مثال: منصة تمويل جماعي بالدين = instrument دين وengagement قناة؛ صندوق نمو = ملكية وطرف مقابل.\n';
    const ACQ_RULE = 'قاعدة إضافية: إذا كانت الجهة تشتري الشركة كاملة أو حصة أغلبية بقصد التملك والسيطرة (صندوق تملّك أو شركة مدرجة أو مشترٍ استراتيجي) فقيمة instrument هي استحواذ لا ملكية. وملكية تعني حصة أقلية في جولة يبقى فيها المؤسس مسيطراً.\n';
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
      + (EARLY_STAGE ? '2) الشركة في مرحلة مبكرة بإيراد محدود. المستهدف الواقعي: المستثمر الملائكي المنظّم، ورأس المال الجريء المبكر، والصناديق الحكومية وشبه الحكومية، والمستثمر الاستراتيجي، ومشتري الاستحواذ. لا تستبعد مستثمراً لمجرد صغر الإيراد؛ قيّم الأصول غير المادية من تراخيص ومنتجات وفريق.\n' : '2) شركة بهذا الحجم ليست هدفاً لصناديق رأس المال الجريء غالباً. المستهدف الواقعي: صناديق النمو والملكية الخاصة، المكاتب العائلية، المستثمر الاستراتيجي (منافس أو مورّد أو موزّع في نفس القطاع)، والدين المرن والميزانين.\n')
      + '3) معيار الجدوى للمستثمرين الخارجيين: كثير من الجهات تستثمر في الخليج ولا تنشر صفقاتها، فلا تشترط سابقة منشورة. يكفي أي دليل على قابلية الاستثمار: مكتب أو فرع أو ممثل في السعودية أو الخليج؛ أو ترخيص من هيئة السوق المالية أو البنك المركزي؛ أو تفويض جغرافي معلن يشمل السعودية أو الشرق الأوسط أو الأسواق الناشئة؛ أو استثمار عبر صندوق أو شريك محلي؛ أو سابقة استثمار منشورة إن وجدت. وإن لم تجد أي دليل فلا تحذف الجهة، بل اجعل حكمها متأهل بشرط واكتب في الفجوات: يلزم التحقق من قابلية الاستثمار في السوق السعودي.\n'
      + '4) أصدر لكل مستثمر حكماً صريحاً: متأهل أو متأهل بشرط، أو استبعده. لا تحش القائمة.\n\n'
      + 'أرجع JSON فقط بدون أي نص آخر وبدون markdown:\n'
      + INST_RULE + ACQ_RULE
      + '{"offers":[{"region":"السعودية أو الخليج أو دولي","provider":"اسم المستثمر أو الصندوق","product":"نوع الاستثمار: حصة نمو أو ملكية خاصة أو استراتيجي أو دين مرن","requirements":"معايير المستثمر: المرحلة وحجم التذكرة والأطروحة القطاعية والتفويض الجغرافي وشهية الحصة والسيطرة","verdict":"متأهل أو متأهل بشرط","gaps":["ما ينقص الشركة للتأهل"],"amountRange":"حجم التذكرة المتوقع","timeline":"أفق إتمام الصفقة والخروج","saudiPrecedent":"سابقة استثمار في السعودية أو الخليج مع الرابط والسنة أو null","legalPath":"آلية الاستثمار: حصة مباشرة أو عبر صندوق أو دين قابل للتحويل أو null","instrument":"أداة الجهة: ملكية أو استحواذ أو دين مساند أو دين","engagement":"طرف مقابل إذا كانت تستثمر من مالها، أو قناة إذا كانت منصة تعرض الفرصة على غيرها","source":"رابط المصدر"}]}';

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
  return { offers: webOffers, ok: webSearchOk, error: webSearchError, totalScopes };
}

export async function saveMatchResults(companyId: string, track: string, offers: WebOffer[], clientRev?: number, keepPrev?: boolean) {
  if (!companyId || !offers.length) return { saved: 0, error: 'no offers' };
  try {
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      process.env.SUPABASE_SERVICE_ROLE_KEY as string
    );
    if (!keepPrev) {
      await admin.from('match_results')
        .update({ status: 'superseded' })
        .eq('company_id', companyId)
        .eq('track', track);
    }
    const rows = offers.map((o) => ({
      company_id: companyId,
      track,
      region: o.region || null,
      provider: o.provider,
      product: o.product,
      requirements: o.requirements,
      fit: o.verdict || null,
      fit_score: (() => {
        const inst = String(o.instrument || '');
        const txt2 = (String(o.product || '') + ' ' + String(o.requirements || '') + ' ' + String(o.region || '') + ' ' + String(o.verdict || '') + ' ' + String(o.provider || '') + ' ' + (Array.isArray(o.gaps) ? o.gaps.join(' ') : '')).toLowerCase();
        if (/الشركات الكبرى والمؤسسات|كبرى فقط|المجموعات العائلية الكبرى|large corporates|multinational/.test(txt2)) return 0;
        if (/transaction banking|تمويل المعاملات|إدارة السيولة|treasury|gtb/.test(txt2)) return 0;
        if (/أُغلق فعلي|أغلق فعلا|مغلق|توقفت|تحت الحراسة|in administration/.test(txt2)) return 0;
        if (/مشاريع الطاقة|البترول|النفط والغاز|البنية التحتية الكبرى|project finance|تمويل المشاريع|مؤسسة الخليج للاستثمار/.test(txt2)) return 0;
        if (/مخصص للمستثمرين|وحدات استثمارية|اشتراك في الصندوق|limited partner/.test(txt2)) return 0;
        // وكالات ائتمان التصدير بالاسم — تموّل مشتري منتج بلدها لا تمويلاً عاماً
        if (/ukef|bpifrance|sinosure|sace|nexi|k-sure|edc|us exim|exim bank|coface|allianz trade|atradius|iciec|الإسلامية لضمان الاستثمار/.test(txt2)) return 0;
        // صناديق الدين الخاص — تذاكرها كبيرة؛ لا تُرشّح إلا لمنشأة إيرادها مناسب
        if (/private credit|private debt|دين خاص|ائتمان خاص|mezzanine|مزانين/.test(txt2) && (!clientRev || clientRev < 50000000)) return 0;
        if (/venture debt|\u062f\u064a\u0646 \u0645\u062e\u0627\u0637\u0631|non-dilutive|growth credit|vc-backed|\u0645\u062f\u0639\u0648\u0645\u0629 \u0628\u0631\u0623\u0633 \u0645\u0627\u0644 \u062c\u0631\u064a\u0621/.test(txt2)) return 0;
        if (/\u063a\u064a\u0631 \u0645\u0624\u0647\u0644|\u0645\u0633\u062a\u0628\u0639\u062f|\u063a\u064a\u0631 \u0645\u062a\u0627\u062d/.test(txt2)) return 0;
        if (/\u0645\u0624\u0633\u0633\u0627\u062a \u0645\u0627\u0644\u064a\u0629|\u0645\u0624\u0633\u0633\u0629 \u0648\u0633\u064a\u0637\u0629|on-lending|wholesale|\u0644\u0628\u0646\u0648\u0643|financial institution/.test(txt2)) return 0;
        if (/private equity|\u0645\u0644\u0643\u064a\u0629 \u062e\u0627\u0635\u0629|\u0625\u062f\u0627\u0631\u0629 \u0623\u0635\u0648\u0644|\u0627\u0633\u062a\u062b\u0645\u0627\u0631 \u0628\u062f\u064a\u0644|\u062d\u0635\u0635 \u0623\u0642\u0644\u064a\u0629|\u062d\u0635\u0629 \u0623\u063a\u0644\u0628\u064a\u0629/.test(txt2)) return 0;
        if (track === 'investment' && inst.includes('دين') && !inst.includes('مساند')) return 0;
        if (track === 'funding' && (inst.includes('تأمين') || inst.includes('دعم'))) return 0;
        // بنوك التنمية التي ولايتها الدول النامية — المملكة خارج نطاقها
        if (/proparco|oe-?eb|oesterreichische entwicklungsbank|\bfmo\b|\bdeg\b|british international investment|\bbii\b|norfund|swedfund|finnfund|cofides|\bsimest\b|entwicklungsbank/.test(txt2)) return 0;
        // السابقة الخليجية أو المسار القانوني — نُقلت من البرومبت إلى الكود
        {
          const reg = String(o.region || '');
          const foreign = reg.indexOf('السعود') < 0 && reg.indexOf('خليج') < 0;
          if (foreign) {
            const weak = (x: unknown) => {
              const t = String(x || '').trim();
              return t.length < 12 || /^(لا يوجد|لا توجد|غير معروف|غير متاح|غير محدد|none|n\/a|-)$/i.test(t);
            };
            if (weak(o.saudiPrecedent) && weak(o.legalPath)) return 0;
          }
        }
        const v = String(o.verdict || '');
        if (/غير مؤهل|مستبعد|غير متاح/.test(v)) return 0;
        const prob = v.includes('بشرط') ? 0.3 : 0.6;
        const txt = String(o.amountRange || '');
        const nums = (txt.match(/[\d.,]+/g) || []).map(x => Number(x.replace(/,/g, ''))).filter(n => n > 0);
        let mid = nums.length > 1 ? (nums[0] + nums[1]) / 2 : (nums[0] || 0);
        if (/مليار/.test(txt)) mid *= 1000000000;
        else if (/مليون/.test(txt)) mid *= 1000000;
        if (/دولار|USD/i.test(txt)) mid *= 3.75;
        if (!mid) mid = (clientRev && clientRev > 0) ? clientRev * 0.3 : 0;
        if (!mid) return prob >= 0.6 ? 3 : 1.5;
        const tl = String(o.timeline || '');
        const rng = tl.match(/(\d+)\s*[-–—]\s*(\d+)\s*(?:شهر|أشهر|شهرا|شهراً)/);
        const one = tl.match(/(\d+)\s*(?:شهر|أشهر|شهرا|شهراً)/);
        const months = rng ? (Number(rng[1]) + Number(rng[2])) / 2 : (one ? Number(one[1]) : 12);
        const cap = (clientRev && clientRev > 0) ? clientRev : 0;
        if (cap > 0 && mid > cap * 2) return 0;
        const fit = cap > 0 ? Math.min(1, cap / Math.max(mid, 1)) : 1;
        const ev = prob * fit * (Math.min(mid, cap > 0 ? cap : mid) / 1000000) / Math.max(1, months) * 10;
        return ev;
      })(),
      instrument: o.instrument || null,
      engagement: o.engagement || null,
      source: o.source || null,
      verdict: o.verdict || null,
      gaps: o.gaps || [],
      amount_range: o.amountRange || null,
      timeline: o.timeline || null,
      saudi_precedent: o.saudiPrecedent || null,
      legal_path: o.legalPath || null,
      status: 'new',
    }));
    const raws = rows.map(r => Number(r.fit_score) || 0).filter(v => v > 0);
    if (raws.length > 1) {
      const lo = Math.min(...raws), hi = Math.max(...raws);
      for (const r of rows) {
        const v = Number(r.fit_score) || 0;
        r.fit_score = v <= 0 ? 0 : (hi > lo ? Math.round(1 + 99 * (Math.log(1 + v - lo) / Math.log(1 + hi - lo))) : 50);
      }
    } else {
      for (const r of rows) r.fit_score = (Number(r.fit_score) || 0) > 0 ? 50 : 0;
    }
    const firmKey = (p: string) => {
      const acr = /\(([A-Za-z][A-Za-z .&]{1,})\)/.exec(p);
      const base = acr ? acr[1] : String(p).split(/[\u2013\u2014(|]|\s-\s/)[0];
      return base.toLowerCase().replace(/\s+/g, ' ').trim();
    };
    const bestByFirm = new Map<string, typeof rows[number]>();
    for (const r of rows) {
      const norm = (x: string) => x.toLowerCase().replace(/[\u0640()\u2014\u2013,\-\/]/g,' ').replace(/[a-z]{2,}/g,'').replace(/\s+/g,' ').trim().slice(0, 28);
      const k = firmKey(String(r.provider || '').replace(/\(.*/,'').trim()) + '|' + norm(String(r.product || ''));
      const cur = bestByFirm.get(k);
      if (!cur || (r.fit_score || 0) > (cur.fit_score || 0)) bestByFirm.set(k, r);
    }
    const deduped = Array.from(bestByFirm.values());
    const { error } = await admin.from('match_results').insert(deduped);
    if (error) return { saved: 0, error: error.message };
    return { saved: deduped.length, error: '' };
  } catch (e) {
    await logError('match.save', e, { company_id: companyId, entity: track });
    return { saved: 0, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function runAutoMatch(companyId: string, track: 'funding' | 'investment', batch?: number): Promise<{ done: boolean; total: number; next: number }> {
  try {
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      process.env.SUPABASE_SERVICE_ROLE_KEY as string
    );
    const { data: company } = await admin.from('companies').select('*').eq('id', companyId).single();
    if (!company) return { done: true, total: 0, next: 0 };
    const { data: fd } = await admin.from('financial_data').select('*')
      .eq('company_id', companyId).order('created_at', { ascending: false }).limit(1).single();
    if (!fd) return { done: true, total: 0, next: 0 };
    const isInvest = track === 'investment';
    const rev = Number(fd.annual_revenue) || 0;
    const years = Number(fd.years_operating) || 0;
    const typeLabel = String(fd.funding_type || '').split(',').filter(Boolean)
      .map((k: string) => k === 'other' ? String(fd.funding_type_other || 'أخرى') : (TYPE_LABELS[k] || k))
      .join('، ') || 'تمويل';
    const debtDesc = fd.has_debt
      ? '\u064a\u0648\u062c\u062f \u062a\u0645\u0648\u064a\u0644 \u0642\u0627\u0626\u0645'
      : '\u0644\u0627 \u062a\u0648\u062c\u062f \u062f\u064a\u0648\u0646 \u0642\u0627\u0626\u0645\u0629';
    const SIZE = 5;
    const from = (batch === undefined ? 0 : batch) * SIZE;
    const r = await runScopedMatch({ company, fd, typeLabel, rev, years, debtDesc, isInvest, budget: 'full',
      scopeFrom: batch === undefined ? undefined : from, scopeTo: batch === undefined ? undefined : from + SIZE });
    const nextB = (batch === undefined ? 0 : batch) + 1;
    const doneAll = batch === undefined || (nextB * SIZE) >= r.totalScopes;
    if (r.offers.length) await saveMatchResults(companyId, track, r.offers, rev, batch !== undefined && batch > 0);
    if (!r.offers.length && batch === undefined) return { done: true, total: r.totalScopes, next: 0 };
    if (doneAll && batch === undefined) try {
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
    return { done: doneAll, total: r.totalScopes, next: nextB };
  } catch (e) {
    await logError('match.run', e, { company_id: companyId, entity: track });
    return { done: true, total: 0, next: 0 };
  }
}


// إثراء طريق التقديم — يعمل داخل العامل بلا سقف زمني
export async function enrichApplyPaths(companyId: string, track: string): Promise<number> {
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string);
  const { data: rows } = await admin.from('match_results')
    .select('id, provider, product')
    .eq('company_id', companyId).eq('track', track).eq('status', 'new').gt('fit_score', 0)
    .order('fit_score', { ascending: false });
  const all = rows || [];
  let done = 0;
  for (let i = 0; i < all.length; i += 8) {
    const chunk = all.slice(i, i + 8);
    const list = chunk.map((r, n) => (n + 1) + ') ' + r.provider + ' — ' + (r.product || '')).join('\n');
    const prompt = 'أنت مستشار تمويل سعودي. لكل جهة ومنتج أدناه ابحث عن طريقة التقديم الفعلية اليوم.\n\n'
      + list + '\n\n'
      + 'لكل رقم أرجع كائناً فيه: applyChannel وapplyUrl وapplySteps وrequiredDocs. '
      + 'أغلب البنوك السعودية لا تقبل طلبات التمويل بالبريد. '
      + 'وفي applySteps اكتب خطوات مرقّمة ينفّذها موظف لا يعرف الجهة. ولا تترك حقلاً فارغاً؛ إن لم تجد رابطاً فاذكر اسم الإدارة.\n'
      + 'أرجع JSON نقي: {"items":[{"n":1,"applyChannel":"...","applyUrl":"...","applySteps":"...","requiredDocs":"..."}]}';
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY as string, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 8000,
          tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 8 }],
          messages: [{ role: 'user', content: prompt }] }),
      });
      const d = await res.json();
      const text = (d.content || []).map((c: { type: string; text?: string }) => c.type === 'text' ? (c.text || '') : '').join('\n');
      const m = text.match(/\{[\s\S]*\}/);
      const parsed = m ? JSON.parse(m[0]) : { items: [] };
      for (const it of (parsed.items || [])) {
        const row = chunk[Number(it.n) - 1];
        if (!row) continue;
        await admin.from('match_results').update({
          apply_channel: it.applyChannel || null,
          apply_url: it.applyUrl && String(it.applyUrl) !== 'null' ? it.applyUrl : null,
          apply_steps: it.applySteps || null,
          required_docs: it.requiredDocs || null,
        }).eq('id', row.id);
        done++;
      }
    } catch (e) { await logError('match.enrichAll', e, { company_id: companyId, entity: track }); }
  }
  return done;
}
