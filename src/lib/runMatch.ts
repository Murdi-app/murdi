import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { suggestService, suggestionBox } from '@/lib/serviceSuggestion';

const ACT_LABELS: Record<string, string> = { retail: 'تجزئة/مطاعم', contracting: 'مقاولات/توريد', services: 'خدمات', manufacturing: 'تصنيع', wholesale: 'تجارة جملة', other_activity: 'أخرى' };
const TYPE_LABELS: Record<string, string> = { cash: 'تمويل نقدي', working_capital: 'رأس مال عامل', revenue: 'تمويل الإيرادات', pos: 'تمويل نقاط البيع', invoices: 'تمويل الفواتير والمستخلصات', assets: 'تمويل أصول ومعدات', vehicles: 'تمويل مركبات وأساطيل', real_estate: 'عقاري تجاري', lc: 'اعتمادات وخطابات ضمان', project: 'تمويل مشاريع وعقود' };

let MATCH_DIAG: string[] = [];
// بحث طبقة جغرافية واحدة للتمويل — يُرجع مصفوفة عروض (JSON أصغر = لا ينقطع)
type FundOffer = { region: string; provider: string; product: string; requirements: string; fit: string; source: string };
async function searchFundingLayer(layer: 'saudi' | 'gulf' | 'intl', profile: string, licensed: string, targetCount: number): Promise<FundOffer[]> {
  const layerAr = layer === 'saudi' ? 'السعودية (مرخّصة من ساما: بنوك + شركات تمويل + منصات)' : layer === 'gulf' ? 'الخليج (جهات تموّل شركة سعودية عبر فرع في السعودية أو عبر الحدود)' : 'الدولية (بريطانيا + أوروبا + أمريكا — تموّل عبر الحدود)';
  const regionVal = layer === 'saudi' ? 'السعودية' : layer === 'gulf' ? 'الخليج' : 'دولي';
  const layerScope = layer === 'saudi'
    ? 'جهات مقرّها الرئيسي داخل المملكة العربية السعودية حصراً (بنوك سعودية، شركات تمويل سعودية مرخّصة من ساما، صناديق ومنصات تمويل سعودية، برامج حكومية سعودية). ممنوع منعاً باتاً إدراج أي جهة مقرّها خارج السعودية حتى لو كان لها فرع في السعودية.'
    : layer === 'gulf'
    ? 'جهات مقرّها الرئيسي في دول الخليج ما عدا السعودية حصراً (الإمارات، قطر، الكويت، البحرين، عُمان). ممنوع منعاً باتاً إدراج أي جهة سعودية هنا — السعودية لها طبقة منفصلة. كل جهة تُدرجها هنا يجب أن يكون مقرّها في دولة خليجية غير السعودية.'
    : 'جهات تمويل دولية مقرّها في المملكة المتحدة (بريطانيا) أو دول أوروبا أو الولايات المتحدة الأمريكية حصراً (بنوك دولية، مؤسسات تمويل تنموية، صناديق دين خاص، منصات تمويل عابرة للحدود، جهات تمويل تجاري ومستخلصات وسلاسل إمداد). ممنوع إدراج أي جهة خليجية أو سعودية أو من خارج بريطانيا/أوروبا/أمريكا.';

  const prompt = 'أنت محلل تمويل خبير رفيع المستوى يعمل لـ د. عبدالحكيم المرضي. مهمتك: البحث العميق والذكي والواسع في الويب لاكتشاف أكبر عدد من فرص التمويل الحقيقية المناسبة لهذه الشركة ضمن الطبقة الجغرافية المحددة. ابحث براحة وعمق — الكثرة مطلوبة طالما كل فرصة صالحة ومناسبة فعلاً. ركّز بشكل خاص على المنتجات التمويلية الجديدة والمبتكرة التي أطلقتها الجهات مؤخراً، لا التقليدية فقط. ولا تحصر نفسك في البنوك: ابحث في البنوك وشركات التمويل والمنصات الرقمية وصناديق الدين والبرامج الحكومية وأي ممول حقيقي.\n\n'
    + 'الطبقة الجغرافية المطلوبة (التزم بها حرفياً): ' + layerScope + '\n\n'
    + 'ملف الشركة الباحثة عن تمويل:\n' + profile + '\n\n'
    + 'الجهات المرجعية المرخّصة (استأنس بها):\n' + licensed + '\n\n'
    + 'معايير الانتقاء الصارمة — لا تُدرج جهة إلا إذا اجتازت كل ما يلي:\n'
    + '1) الجغرافيا: مقرّها ضمن الطبقة المحددة أعلاه حصراً. أي خطأ جغرافي مرفوض.\n'
    + '2) حجم الشركة: منتج الجهة يناسب حجم إيرادات الشركة ومرحلتها (لا تقترح تمويلاً لمنشآت كبرى على شركة صغيرة أو العكس).\n'
    + '3) النشاط: المنتج يطابق نشاط الشركة فعلياً (لا تمويل نقاط بيع إلا إن لديها نقاط بيع، لا تمويل فواتير إلا إن تصدر فواتير آجلة، لا تمويل أسطول إلا إن تملك أسطولاً).\n'
    + '4) الأهلية عبر الحدود (حاسمة): الجهة تموّل فعلياً شركة سعودية مقرّها في السعودية. استبعد أي جهة خدماتها التمويلية محصورة في بلدها فقط ولا تموّل خارج حدودها (مثلاً جهة إماراتية تمول داخل الإمارات فقط = مرفوضة). إن لم تتأكد أنها تموّل شركة سعودية، لا تُدرجها.\n\n'    + 'لا تكسل أبداً: استقصِ كل اللاعبين في الطبقة — البنوك وشركات التمويل المرخّصة والمنصّات الرقمية وصناديق الدين، ولا تكتفِ بالأسماء الكبيرة المعروفة. في السعودية تحديداً هناك عشرات شركات التمويل المرخّصة من ساما إضافة للبنوك — غطِّها جميعاً ولا تقتصر على البنوك.\n\n'
    + 'ابحث بأريحية وعمق واستقصِ السوق بدقّة: استهدف ٥٠ جهة مناسبة أو أكثر لهذه الطبقة إن وُجد صالح — لا تبخل بالصالح ولا تتوقف مبكراً. غُص في المنتجات الجديدة والمبتكرة. تغطية واسعة ودقيقة هي جوهر الخدمة. وفي الوقت نفسه لا تُدرج جهة لا تطابق المعايير لمجرد ملء العدد — لكل جهة مبرر حقيقي يربطها بهذه الشركة.\n\n'
    + 'منهجية حاسمة — ركّز على المنتجات لا الجهات فقط: ادرس بيانات الشركة جيداً أولاً، ثم لكل جهة ممولة افتح كامل تشكيلة منتجاتها التمويلية وتعمّق فيها جيداً، واستخرج كل منتج يطابق هذه الشركة فعلاً — لا تتوقف عند منتج أو اثنين إن وُجد ثالث ورابع مناسب، ولا تُجبر رقماً ولا تخترع منتجاً غير موجود. أدرج الموجود المناسب كاملاً فقط. كل منتج = عنصر مستقل في المخرجات (تتكرّر الجهة بمنتجات مختلفة). لا تكتفِ بقول الجهة تموّل — حدّد المنتج بالاسم وشروطه. وفي حقل fit لكل منتج: لماذا يناسب هذا المنتج هذه الشركة تحديداً (الحجم، النشاط، المرحلة، نوع التمويل المطلوب)، وما الذي قد ينقص الشركة لاستيفائه. كن محدداً لا عاماً.\n\n'
    + 'أرجع JSON فقط بلا أي نص آخر وبلا markdown، بهذا الشكل بالضبط:\n'
    + '{"offers":[{"provider":"اسم الجهة الممولة","product":"اسم المنتج التمويلي المحدد","requirements":"شروط المنتج باختصار","fit":"لماذا يناسب هذا المنتج هذه الشركة تحديداً + ما ينقص","source":"رابط المصدر"}]}\n'
    + 'رتّب من الأنسب للأقل. أرجع JSON صالحاً ومكتملاً ومغلقاً بالكامل.';
  try {
    const messages: { role: string; content: unknown }[] = [{ role: 'user', content: prompt }];
    let text = '';
    for (let turn = 0; turn < 8; turn++) {
      let res: Response | null = null;
      // إعادة محاولة عند الضغط (429) أو خطأ مؤقت
      for (let attempt = 0; attempt < 4; attempt++) {
        res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY as string, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({ model: 'claude-opus-4-8', max_tokens: 8000, messages, tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 12 }] }),
        });
        if (res.ok) break;
        if (res.status === 429 || res.status === 529 || res.status >= 500) {
          await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
          continue;
        }
        break;
      }
      if (!res || !res.ok) { MATCH_DIAG.push(layer + ': HTTP ' + (res ? res.status : 'null')); break; }
      const data = await res.json();
      const content = (data.content || []) as { type: string; text?: string }[];
      text += content.filter((b) => b.type === 'text').map((b) => b.text || '').join('');
      if (data.stop_reason === 'pause_turn') { messages.push({ role: 'assistant', content: data.content }); continue; }
      break;
    }
    const offers = parseOffers(text).map((o) => ({ ...o, region: regionVal }));
    MATCH_DIAG.push(layer + ': ' + offers.length + ' جهة' + (offers.length === 0 && text.length > 0 ? ' (نص ' + text.length + ' حرف لكن parse فشل)' : ''));
    return offers;
  } catch (e) { MATCH_DIAG.push(layer + ' خطأ: ' + (e instanceof Error ? e.message : String(e))); return []; }
}

// تحليل متسامح للـ JSON: لو انقطع، يقصّ لآخر عنصر مكتمل
function parseOffers(text: string): FundOffer[] {
  const cleaned = text.replace(/```json|```/g, '').trim();
  // المحاولة 1: تحليل كامل مباشر
  try {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end > start) {
      const p = JSON.parse(cleaned.slice(start, end + 1));
      if (Array.isArray(p.offers) && p.offers.length > 0) return p.offers;
    }
  } catch {}
  // المحاولة 2 (المتينة): استخراج كل كائن جهة على حدة عبر مطابقة الحقول
  const offers: FundOffer[] = [];
  // نلتقط كل كتلة تبدأ بـ "provider" وتنتهي قبل التالية
  const objRegex = /\{[^{}]*?"provider"[\s\S]*?\}/g;
  const matches = cleaned.match(objRegex) || [];
  for (const m of matches) {
    try {
      const o = JSON.parse(m);
      if (o && o.provider) offers.push({ region: '', provider: String(o.provider || ''), product: String(o.product || ''), requirements: String(o.requirements || ''), fit: String(o.fit || ''), source: String(o.source || '') });
    } catch {
      // المحاولة 3: استخراج الحقول يدوياً بالـ regex لو فشل JSON.parse للكائن
      const get = (k: string) => { const r = new RegExp('"' + k + '"\\s*:\\s*"([^"]*)"'); const mm = m.match(r); return mm ? mm[1] : ''; };
      const provider = get('provider');
      if (provider) offers.push({ region: '', provider, product: get('product'), requirements: get('requirements'), fit: get('fit'), source: get('source') });
    }
  }
  return offers;
}

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

async function searchInvestmentLayer(layer: 'saudi' | 'gulf' | 'intl', profile: string, targetCount: number): Promise<FundOffer[]> {
  const regionVal = layer === 'saudi' ? 'السعودية' : layer === 'gulf' ? 'الخليج' : 'دولي';
  const layerScope = layer === 'saudi'
    ? 'مستثمرون مقرّهم داخل المملكة العربية السعودية حصراً: صناديق استثمار جريء وملكية خاصة سعودية، مكاتب عائلية، مسرّعات وحاضنات، ومستثمرون أفراد (ملائكيون) نشطون في السعودية. هذه الطبقة الأعمق والأكثر — أعطها أكبر نصيب.'
    : layer === 'gulf'
    ? 'مستثمرون مقرّهم في دول الخليج ما عدا السعودية حصراً (الإمارات، قطر، الكويت، البحرين، عُمان): صناديق، مكاتب عائلية، VC، ومستثمرون أفراد. الأولوية القصوى لمن سبق له الاستثمار فعلياً في السعودية أو شركات سعودية (اذكر الاستثمار السابق صراحةً في حقل fit)، يليهم من لا يمانع الاستثمار في السعودية. ممنوع إدراج أي مستثمر سعودي هنا.'
    : 'مستثمرون مقرّهم في بريطانيا أو أوروبا أو الولايات المتحدة الأمريكية حصراً: صناديق رأس مال جريء (VC)، صناديق نمو، ملكية خاصة، محافظ استثمارية، ومستثمرون أفراد. الأولوية القصوى لمن سبق له الاستثمار في السعودية أو الشرق الأوسط ويتطابق قطاعه (اذكر استثماره السابق المشابه في fit)، يليهم من أبدى انفتاحاً على الأسواق الناشئة. ممنوع إدراج أي مستثمر خليجي أو سعودي هنا.';

  const prompt = 'أنت باحث استثماري خبير رفيع المستوى يعمل لـ د. عبدالحكيم المرضي. مهمتك: البحث العميق والذكي والواسع في الويب لاكتشاف أكبر عدد من المستثمرين الحقيقيين المناسبين لهذه الشركة ضمن الطبقة الجغرافية المحددة. ابحث براحة وعمق — الكثرة مطلوبة طالما كل مستثمر مناسب فعلاً. لا تحصر نفسك في نوع واحد: ابحث في الصناديق والمكاتب العائلية وصناديق VC وPE والمستثمرين الأفراد (الملائكيين) معاً.\n\n'
    + 'الطبقة الجغرافية المطلوبة (التزم بها حرفياً): ' + layerScope + '\n\n'
    + 'ملف الشركة الباحثة عن استثمار:\n' + profile + '\n\n'
    + 'قاعدة الأولوية الذهبية: داخل هذه الطبقة، رتّب بحيث (من سبق له الاستثمار في السعودية + يتطابق قطاعه) يأتي أولاً دائماً، ثم من ينفتح على السعودية ويناسب القطاع.\n\n'
    + 'معايير المطابقة الذكية — لا تُدرج مستثمراً إلا إذا اجتاز:\n'
    + '1) الجغرافيا: مقرّه ضمن الطبقة المحددة أعلاه حصراً.\n'
    + '2) تطابق القطاع: استثمر في شركات بنفس قطاع هذه الشركة أو قطاع قريب.\n'
    + '3) المرحلة وحجم الجولة: حجم استثماره المعتاد يناسب حجم وإيرادات ومرحلة الشركة (لا صندوق ضخم لجولة صغيرة ولا العكس).\n'
    + '4) نشاط حديث: فضل من استثمر خلال آخر 2-3 سنوات.\n'
    + '5) نوع المستثمر للمرحلة: ملائكي/تأسيسي للمبكرة، VC للنمو، ملكية خاصة للناضجة.\n\n'
    + 'ابحث بأريحية وعمق واستقصِ السوق بدقّة: استهدف ٥٠ مستثمراً مناسباً أو أكثر لهذه الطبقة إن وُجد صالح — لا تبخل بالصالح ولا تتوقف مبكراً. وفي الوقت نفسه لا تُدرج مستثمراً غير مناسب لمجرد ملء العدد.\n\n'
    + 'في حقل fit لكل مستثمر: لماذا يناسب هذه الشركة تحديداً (القطاع، المرحلة، حجم الجولة)، استثماراته السابقة المشابهة خاصة في السعودية/المنطقة إن وُجدت، وطريقة الوصول العملية (نموذج تواصل رسمي برابط مباشر أو بريد استثمار معلن — خطوة واحدة محددة لا عدة خيارات). في حقل requirements: شروط/تركيز المستثمر باختصار. في حقل product: فئة المستثمر (صندوق VC / ملكية خاصة / مكتب عائلي / مستثمر ملائكي / مسرّعة).\n\n'
    + 'أرجع JSON فقط بلا أي نص آخر وبلا markdown، بهذا الشكل بالضبط:\n'
    + '{"offers":[{"provider":"اسم المستثمر/الجهة","product":"فئة المستثمر","requirements":"تركيز/شروط المستثمر باختصار","fit":"لماذا يناسب هذه الشركة + استثمار سابق في السعودية إن وُجد + طريقة الوصول","source":"رابط المصدر"}]}\n'
    + 'رتّب من الأنسب للأقل. أرجع JSON صالحاً ومكتملاً ومغلقاً بالكامل.';
  try {
    const messages: { role: string; content: unknown }[] = [{ role: 'user', content: prompt }];
    let text = '';
    for (let turn = 0; turn < 8; turn++) {
      let res: Response | null = null;
      for (let attempt = 0; attempt < 4; attempt++) {
        res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY as string, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({ model: 'claude-opus-4-8', max_tokens: 8000, messages, tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 12 }] }),
        });
        if (res.ok) break;
        if (res.status === 429 || res.status === 529 || res.status >= 500) { await new Promise((r) => setTimeout(r, 3000 * (attempt + 1))); continue; }
        break;
      }
      if (!res || !res.ok) { MATCH_DIAG.push(layer + ': HTTP ' + (res ? res.status : 'null')); break; }
      const data = await res.json();
      const content = (data.content || []) as { type: string; text?: string }[];
      text += content.filter((b) => b.type === 'text').map((b) => b.text || '').join('');
      if (data.stop_reason === 'pause_turn') { messages.push({ role: 'assistant', content: data.content }); continue; }
      break;
    }
    const offers = parseOffers(text).map((o) => ({ ...o, region: regionVal }));
    MATCH_DIAG.push(layer + ': ' + offers.length + ' مستثمر' + (offers.length === 0 && text.length > 0 ? ' (نص ' + text.length + ' حرف لكن parse فشل)' : ''));
    return offers;
  } catch (e) { MATCH_DIAG.push(layer + ' خطأ: ' + (e instanceof Error ? e.message : String(e))); return []; }
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
  MATCH_DIAG = [];
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

  const isDefaulted = fd?.repayment_status === 'default' || fd?.debt_status === 'late';
  const lowScore = score < 70;
  let planKind: 'recovery' | 'readiness' | 'search' = 'search';
  let webCount = 0;
  // المتعثّر/منخفض السكور: لا بحث مستثمرين (تغطّيه العوائق وخطة التحسين). المؤهّل: بحث عميق ثلاثي الطبقات.
  if (isDefaulted) { planKind = 'recovery'; }
  else if (lowScore) { planKind = 'readiness'; }
  else {
    planKind = 'search';
    try {
      const invProfile = 'القطاع: ' + (fd?.sector || company?.sector || 'غير محدد')
        + ' | الإيرادات السنوية: ' + rev + ' ريال'
        + ' | مرحلة الشركة: ' + (fd?.company_stage || 'نمو')
        + ' | نمو الإيرادات: ' + (fd?.revenue_growth || 'غير محدد')
        + ' | سنوات التشغيل: ' + (fd?.years_operating || 'غير محدد')
        + ' | صافي الربح: ' + (fd?.net_profit || 'غير محدد')
        + ' | حوكمة: ' + (fd?.has_governance === true ? 'نعم' : 'لا')
        + ' | قوائم مدققة: ' + (fd?.audited_statements === true ? 'نعم' : 'لا')
        + ' | السوق المستهدف: ' + (fd?.target_market || 'غير محدد')
        + ' | درجة الجاهزية: ' + score + ' من 100';
      const [invSa, invGulf, invIntl] = await Promise.all([
        searchInvestmentLayer('saudi', invProfile, 50),
        searchInvestmentLayer('gulf', invProfile, 50),
        searchInvestmentLayer('intl', invProfile, 50),
      ]);
      const webInvestors = [...invSa, ...invGulf, ...invIntl];
      webCount = webInvestors.length;
      if (webInvestors.length > 0) {
        await adminClient.from('match_results').insert(webInvestors.map((o) => ({
          company_id: company.id, track: 'investment', region: o.region,
          provider: o.provider, product: o.product, requirements: o.requirements, fit: o.fit, source: o.source,
        })));
      }
    } catch {}
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: 'د. عبدالحكيم المرضي <noreply@murdi.sa>',
      to: 'hololalmurdi.fs@gmail.com',
      subject: (planKind === 'recovery' ? '⚠️ شركة متعثرة (مسار تعافي) — ' : planKind === 'readiness' ? '📈 خطة رفع جاهزية (سكور < 70) — ' : 'مطابقة استثمار جديدة — ') + company.company_name,
      html:
        '<div dir="rtl" style="font-family:Arial;max-width:560px;margin:auto">' +
        '<div style="background:#1A3D34;color:#fff;padding:20px 24px;border-radius:12px 12px 0 0"><h2 style="margin:0;font-size:18px">🔔 مطابقة استثمار جديدة</h2></div>' +
        '<div style="background:#fff;border:1px solid #EAF2EE;border-top:none;padding:24px;border-radius:0 0 12px 12px">' +
        '<p style="font-size:15px;color:#1A3D34"><b>' + company.company_name + '</b> — سجل: ' + (company.cr_number || '—') + '</p>' +
        '<p style="color:#3A4D47">🏢 ' + (fd.sector || company.sector || '—') + ' &nbsp;|&nbsp; 📱 ' + (company.phone || '—') + '</p>' +
        '<div style="display:flex;gap:12px;margin:18px 0">' +
        '<div style="flex:1;background:#F0F7F4;border-radius:10px;padding:14px;text-align:center"><div style="color:#9DB3AB;font-size:12px">درجة الجاهزية</div><div style="color:#2E9E7B;font-size:24px;font-weight:900">' + score + '</div></div>' +
        '<div style="flex:1;background:#FBF8EE;border-radius:10px;padding:14px;text-align:center"><div style="color:#9DB3AB;font-size:12px">الحكم</div><div style="color:#C9A84C;font-size:15px;font-weight:900;padding-top:6px">' + (rr?.verdict ?? '—') + '</div></div>' +
        '</div>' +
        '<p style="color:#6B8A80;font-size:13px">التحليل الكامل (العوائق، خطة التحسين، المستثمرون المطابقون) محفوظ في ملف العميل بلوحة الأدمن.</p>' +(planKind === 'search' ? '<p style="color:#9DB3AB;font-size:12px;border-top:1px dashed #EAF2EE;padding-top:10px">🔎 بحث مُرضي: ' + webCount + ' مستثمر عبر الطبقات &nbsp;|&nbsp; تشخيص: ' + MATCH_DIAG.join(' · ') + '</p>' : '') +
        '<p style="margin-top:20px;text-align:center"><a href="https://murdi.sa/admin/approvals" style="background:#1A3D34;color:#fff;padding:13px 32px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">📂 افتح الملف في الأدمن</a></p>' +
        '</div></div>',
    });
  } catch {}
}

export { runInvestmentMatch };
async function runFundingMatch(companyId: string): Promise<void> {
  MATCH_DIAG = [];
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
    ? 'يوجد تمويل قائم بقيمة أصلية ' + Number(FD.original_loan_amount || 0).toLocaleString() + ' ريال، المتبقي ' + Number(FD.debt_remaining || 0).toLocaleString() + ' ريال لدى ' + (FD.lender_name || 'جهة تمويل') + '، الحالة: ' + (FD.debt_status === 'late' ? 'متأخر ' + (FD.months_late || 0) + ' شهر' : 'ملتزم بالسداد') + (FD.debt_narrative ? '. طبيعة الدين كما وصفها العميل: ' + FD.debt_narrative : '')
    : 'لا توجد ديون قائمة';

  // ====== البحث الثلاثي المتوازي (سعودي + خليج + دولي) — لا ينقطع، يُحفظ في match_results ======
  const profile =
    '- نوع التمويل المطلوب: ' + typeLabel + '\n'
    + '- الإيرادات السنوية: ' + rev.toLocaleString() + ' ريال\n'
    + '- عمر النشاط: ' + years + ' سنة\n'
    + '- القطاع: ' + (company.sector || 'غير محدد') + '\n'
    + '- طبيعة النشاط: ' + (FD.activity_type === 'other_activity' && FD.activity_type_other ? FD.activity_type_other : (ACT_LABELS[String(FD.activity_type)] || FD.activity_type || 'غير محدد')) + '\n'
    + '- نقاط بيع: ' + (FD.has_pos ? ('نعم' + (FD.pos_types ? ' (' + FD.pos_types + ')' : '') + (FD.pos_count ? '، عدد الأجهزة: ' + FD.pos_count : '') + (FD.pos_usage_pct ? '، نسبة المبيعات عبرها: ' + FD.pos_usage_pct + '%' : '')) : 'لا') + ' | يصدر فواتير آجلة: ' + (FD.issues_invoices ? 'نعم' : 'لا') + ' | أسطول/معدات مملوكة: ' + (FD.has_fleet ? 'نعم' : 'لا') + '\n'
    + '- ' + debtDesc + '\n'
    + '- سجل تجاري ' + (FD.cr_valid ? 'ساري' : 'غير ساري') + '، التزام ضريبي: ' + (FD.tax_compliant ? 'نعم' : 'لا') + '، زكاة: ' + (FD.zakat_compliant ? 'نعم' : 'لا') + '، قوائم مالية: ' + (FD.has_financial_statements ? 'متوفرة' : 'غير متوفرة');

  const LICENSED = 'البنوك المرخصة: البنك الأهلي السعودي، مصرف الراجحي، بنك الرياض، البنك السعودي الأول (ساب)، البنك السعودي الفرنسي، البنك العربي الوطني، بنك البلاد، بنك الجزيرة، مصرف الإنماء، البنك السعودي للاستثمار، بنك الخليج الدولي السعودية. شركات التمويل المرخصة من ساما: الأمثل، أملاك العالمية، دار التمليك، بداية، سهل، عبداللطيف جميل، اليسر، الراجحي للتمويل، نايفات، أمكان، تمويل الأولى، المتاجرة المالية، أصيل، التيسير العربية، ميفك كابيتال، تسهيل، فيول، منافع، عِمكان، سلفة، تمام (stc)، ماني فيلوز، فورس، ميسر، لندو، فنتك ردف، فرقد، مرابحة مرنة، قرض للتمويل الجماعي. جهات خليجية قد تمول شركات سعودية: الإمارات دبي الوطني، أبوظبي الأول (FAB)، دبي الإسلامي، أبوظبي الإسلامي، الكويت الوطني (NBK)، بيتك، QNB، قطر الإسلامي، البحرين والكويت، الأهلي المتحد. جهات دولية: مؤسسة التمويل الدولية (IFC)، البنك الإسلامي للتنمية، صناديق private credit الدولية، منصات تمويل المنشآت العابرة للحدود.';

  type WebOffer = { region: string; provider: string; product: string; requirements: string; fit: string; source: string };
  let webOffers: WebOffer[] = [];
  const webSearchError = '';
  try {
    const [sa, gulf, intl] = await Promise.all([
      searchFundingLayer('saudi', profile, LICENSED, 50),
      searchFundingLayer('gulf', profile, LICENSED, 30),
      searchFundingLayer('intl', profile, LICENSED, 30),
    ]);
    webOffers = [...sa, ...gulf, ...intl];
  } catch {}

  // حفظ الجهات في قاعدة البيانات (تظهر في الأدمن)
  if (webOffers.length > 0) {
    try {
      await adminClient.from('match_results').insert(
        webOffers.map((o) => ({
          company_id: company.id,
          track: 'funding',
          region: o.region,
          provider: o.provider,
          product: o.product,
          requirements: o.requirements,
          fit: o.fit,
          source: o.source,
        }))
      );
    } catch {}
  }

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
        '<div dir="rtl" style="font-family:Arial;max-width:560px;margin:auto">'
        + '<div style="background:#1A3D34;color:#fff;padding:20px 24px;border-radius:12px 12px 0 0"><h2 style="margin:0;font-size:18px">🔔 مطابقة تمويل جديدة</h2></div>'
        + '<div style="background:#fff;border:1px solid #EAF2EE;border-top:none;padding:24px;border-radius:0 0 12px 12px">'
        + '<p style="font-size:15px;color:#1A3D34"><b>' + company.company_name + '</b> — سجل: ' + (company.cr_number || '—') + '</p>'
        + '<p style="color:#3A4D47">📱 ' + (company.phone || '—') + '</p>'
        + '<div style="display:flex;gap:12px;margin:18px 0">'
        + '<div style="flex:1;background:#F0F7F4;border-radius:10px;padding:14px;text-align:center"><div style="color:#9DB3AB;font-size:12px">درجة الجاهزية</div><div style="color:#2E9E7B;font-size:24px;font-weight:900">' + (rr?.readiness_score ?? '—') + '</div></div>'
        + '<div style="flex:1;background:#FBF8EE;border-radius:10px;padding:14px;text-align:center"><div style="color:#9DB3AB;font-size:12px">عدد الجهات المطابقة</div><div style="color:#C9A84C;font-size:24px;font-weight:900">' + totalCount + '</div></div>'
        + '</div>'
        + '<p style="color:#6B8A80;font-size:13px">الجهات كاملة (سعودي/خليج/دولي) محفوظة في ملف العميل بلوحة الأدمن مع كل التفاصيل.</p>'
        + '<p style="margin-top:20px;text-align:center"><a href="https://murdi.sa/admin/approvals" style="background:#1A3D34;color:#fff;padding:13px 32px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">📂 افتح الملف في الأدمن</a></p>'
        + '</div></div>',
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

async function searchIpoAdvisors(sector: string, market: string, revenue: number): Promise<FundOffer[]> {
  const prompt = 'أنت باحث أسواق مال خبير رفيع المستوى يعمل لـ د. عبدالحكيم المرضي. شركة قطاعها "' + sector + '" وإيراداتها السنوية ' + revenue + ' ريال تستهدف الإدراج في ' + market + ' بالسوق السعودي (تداول). مهمتك: البحث العميق والذكي والواسع في الويب عن الجهات المرخّصة من هيئة السوق المالية السعودية (CMA) القابلة للتواصل التي تخدم طرحاً بهذا الحجم والقطاع. ابحث براحة وعمق — الكثرة مطلوبة طالما كل جهة مرخّصة ومناسبة فعلاً.\n\n'
    + 'ابحث في ثلاثة أنواع من الجهات (وميّزها في حقل product):\n'
    + '1) "مستشار مالي CMA": المستشارون الماليون المرخّصون من الهيئة الذين يقودون الطرح والإدراج (مديرو الاكتتاب والترتيب) — النشطون فعلياً في طروحات ' + market + '.\n'
    + '2) "متعهد تغطية": متعهّدو التغطية المرخّصون المناسبون لطرح بهذا الحجم.\n'
    + '3) "مراجع معتمد": مكاتب المراجعة (المدققون) المعتمدون لدى الهيئة المناسبون لشركة بهذا الحجم.\n\n'
    + 'معايير المطابقة الذكية — لا تُدرج جهة إلا إذا اجتازت:\n'
    + '1) الترخيص: مرخّصة فعلياً من هيئة السوق المالية السعودية للنشاط المذكور.\n'
    + '2) الحجم: تخدم طروحاً بحجم يناسب إيرادات هذه الشركة (لا جهة تخدم الطروحات العملاقة فقط لشركة متوسطة).\n'
    + '3) القطاع/النشاط: لها خبرة في قطاع هذه الشركة أو قطاع قريب إن أمكن.\n'
    + '4) نشاط حديث: فضّل من شارك في طروحات خلال آخر 2-3 سنوات.\n\n'
    + 'ابحث بأريحية وعمق واستقصِ السوق بدقّة: أدرج كل جهة مرخّصة ومناسبة فعلاً — لا تبخل بالصالح ولا تتوقف مبكراً، ولا تُدرج جهة غير مرخّصة أو غير مناسبة لمجرد العدد.\n\n'
    + 'في حقل fit لكل جهة: لماذا تناسب هذه الشركة تحديداً (الحجم، القطاع، خبرتها في طروحات مشابهة)، وطريقة الوصول العملية (موقع رسمي أو بريد إدارة الترتيب/الاستشارات — خطوة واحدة محددة). في حقل requirements: تركيز/متطلبات الجهة باختصار. في حقل product: نوع الجهة (مستشار مالي CMA / متعهد تغطية / مراجع معتمد).\n\n'
    + 'أرجع JSON فقط بلا أي نص آخر وبلا markdown، بهذا الشكل بالضبط:\n'
    + '{"offers":[{"provider":"اسم الجهة","product":"نوع الجهة","requirements":"تركيز/متطلبات الجهة باختصار","fit":"لماذا تناسب هذه الشركة + طريقة الوصول","source":"رابط المصدر"}]}\n'
    + 'رتّب من الأنسب للأقل. أرجع JSON صالحاً ومكتملاً ومغلقاً بالكامل.';
  try {
    const messages: { role: string; content: unknown }[] = [{ role: 'user', content: prompt }];
    let text = '';
    for (let turn = 0; turn < 10; turn++) {
      let res: Response | null = null;
      for (let attempt = 0; attempt < 4; attempt++) {
        res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY as string, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({ model: 'claude-opus-4-8', max_tokens: 8000, messages, tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 20 }] }),
        });
        if (res.ok) break;
        if (res.status === 429 || res.status === 529 || res.status >= 500) { await new Promise((r) => setTimeout(r, 3000 * (attempt + 1))); continue; }
        break;
      }
      if (!res || !res.ok) { MATCH_DIAG.push('ipo: HTTP ' + (res ? res.status : 'null')); break; }
      const data = await res.json();
      const content = (data.content || []) as { type: string; text?: string }[];
      text += content.filter((b) => b.type === 'text').map((b) => b.text || '').join('');
      if (data.stop_reason === 'pause_turn') { messages.push({ role: 'assistant', content: data.content }); continue; }
      break;
    }
    const offers = parseOffers(text).map((o) => ({ ...o, region: 'السعودية' }));
    MATCH_DIAG.push('ipo: ' + offers.length + ' جهة' + (offers.length === 0 && text.length > 0 ? ' (نص ' + text.length + ' حرف لكن parse فشل)' : ''));
    return offers;
  } catch (e) { MATCH_DIAG.push('ipo خطأ: ' + (e instanceof Error ? e.message : String(e))); return []; }
}

async function runIpoMatch(companyId: string, scoreArg?: number): Promise<void> {
  MATCH_DIAG = [];
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
    const recoveryHtml = '';
    // مسار التعافي/خطة الجاهزية أُلغيا — مُغطّيان بالعوائق وخطة التحسين في التقييم
    let planKind: 'recovery' | 'readiness' | 'qualified' | 'waiting' = score >= 65 ? 'qualified' : 'waiting';
    if (isDefaulted) { planKind = 'recovery'; }
    else if (lowScore) { planKind = 'readiness'; }
    let ipoCount = 0;
    if (planKind === 'qualified') {
      try {
        const advisors = await searchIpoAdvisors(fd?.sector || company?.sector || 'غير محدد', marketLabel, rev);
        ipoCount = advisors.length;
        if (advisors.length > 0) {
          await adminClient.from('match_results').insert(advisors.map((o) => ({
            company_id: company.id, track: 'ipo', region: o.region,
            provider: o.provider, product: o.product, requirements: o.requirements, fit: o.fit, source: o.source,
          })));
        }
      } catch {}
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: 'د. عبدالحكيم المرضي <noreply@murdi.sa>',
      to: 'hololalmurdi.fs@gmail.com',
      subject: (isDefaulted ? '⚠️ شركة متعثرة (مسار تعافي) — ' : (score >= 65 ? '🎯 مؤهل طرح — ' : 'تقييم طرح — ')) + company.company_name + ' (درجة ' + score + ')',
      html:
        '<div dir="rtl" style="font-family:Arial;max-width:560px;margin:auto">' +
        '<div style="background:#1A3D34;color:#fff;padding:20px 24px;border-radius:12px 12px 0 0"><h2 style="margin:0;font-size:18px">🔔 ملف طرح جديد</h2></div>' +
        '<div style="background:#fff;border:1px solid #EAF2EE;border-top:none;padding:24px;border-radius:0 0 12px 12px">' +
        (isDefaulted
          ? '<div style="background:#FBECEC;border-right:4px solid #C0564B;border-radius:8px;padding:12px 14px;margin-bottom:14px;color:#A33;font-weight:700">⚠️ غير مؤهل حالياً — شركة متعثرة (فرصة خدمة إعادة هيكلة)</div>'
          : (score >= 65
          ? '<div style="background:#FBF5E8;border-right:4px solid #C9A84C;border-radius:8px;padding:12px 14px;margin-bottom:14px;color:#9A7B2E;font-weight:700">🎯 مؤهل للطرح — فرصة خدمة مدفوعة</div>'
          : '<div style="background:#F0F5F3;border-right:4px solid #6B8A80;border-radius:8px;padding:12px 14px;margin-bottom:14px;color:#6B8A80;font-weight:700">⏳ يحتاج تجهيزاً قبل الطرح — فرصة خدمة تجهيز</div>')) +
        '<p style="font-size:15px;color:#1A3D34"><b>' + company.company_name + '</b> — سجل: ' + (company.cr_number || '—') + '</p>' +
        '<p style="color:#3A4D47">📱 ' + (company.phone || '—') + ' &nbsp;|&nbsp; 🏙️ ' + (company.city || '—') + ' &nbsp;|&nbsp; 🏢 ' + (fd?.sector || company.sector || '—') + '</p>' +
        '<div style="display:flex;gap:12px;margin:18px 0">' +
        '<div style="flex:1;background:#F0F7F4;border-radius:10px;padding:14px;text-align:center"><div style="color:#9DB3AB;font-size:12px">IPO Readiness</div><div style="color:#2E9E7B;font-size:24px;font-weight:900">' + score + '</div></div>' +
        '<div style="flex:1;background:#FBF8EE;border-radius:10px;padding:14px;text-align:center"><div style="color:#9DB3AB;font-size:12px">السوق المقترح</div><div style="color:#C9A84C;font-size:15px;font-weight:900;padding-top:6px">' + marketLabel + '</div></div>' +
        '</div>' +
        '<p style="color:#6B8A80;font-size:13px">التحليل الكامل (العوائق، خطة التحسين، الأهلية، جهات الطرح) محفوظ في ملف العميل بلوحة الأدمن.</p>' +(planKind === 'qualified' ? '<p style="color:#9DB3AB;font-size:12px;border-top:1px dashed #EAF2EE;padding-top:10px">🔎 بحث مُرضي: ' + ipoCount + ' جهة طرح &nbsp;|&nbsp; تشخيص: ' + MATCH_DIAG.join(' · ') + '</p>' : '') +
        '<p style="margin-top:20px;text-align:center"><a href="https://murdi.sa/admin/approvals" style="background:#1A3D34;color:#fff;padding:13px 32px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">📂 افتح الملف في الأدمن</a></p>' +
        '</div></div>',
    });
  } catch {}
}

export { runIpoMatch };
