// مولّد دراسة الجدوى الاقتصادية — مُرضي
// الأرقام تُحسب في feasibilityCompute (كود)، والنموذج يكتب التحليل والسوق فقط
import { computeFeasibility, renderProjectionTable, renderFeasibilitySummary, computeCredit, renderCreditTable, renderMonthlyTable, renderScenarioTable, type FeasibilityInputs, type FeasibilityResult, type CreditPack } from './feasibilityCompute';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-6';

export interface FeasibilityContext {
  companyName: string;
  crNumber?: string;
  city?: string;
  projectDescription: string;      // وصف المشروع
  sectorText: string;              // القطاع بنص حر
  audience: 'financier' | 'investor' | 'regulator' | 'internal';
  projectKind: 'new' | 'expansion';
  location?: string;
  capacityNote?: string;           // الطاقة المستهدفة
  staffNote?: string;              // العمالة
  existingRevenue?: number;        // للتوسعة فقط
  inputs: FeasibilityInputs;
}

export interface FeasibilitySections {
  executiveSummary: string;
  marketStudy: string;
  competition: string;
  technicalStudy: string;
  assumptionsNote: string;
  risks: string;
  conclusion: string;
  sources: string[];
}

const AUD: Record<FeasibilityContext['audience'], string> = {
  financier: 'جهة تمويل — ركّز على القدرة على السداد وتغطية الأقساط والضمانات وحساسية التدفق النقدي',
  investor: 'مستثمر — ركّز على حجم السوق والنمو والعائد وفرصة التوسع وميزة المشروع التنافسية',
  regulator: 'جهة حكومية أو ترخيص — ركّز على الامتثال والاشتراطات والأثر الاقتصادي والتوطين',
  internal: 'استخدام داخلي لصاحب المشروع — ركّز على الواقعية وما يجب التحقق منه قبل الالتزام',
};

export async function generateFeasibility(ctx: FeasibilityContext): Promise<{ sections: FeasibilitySections; result: FeasibilityResult; credit: CreditPack; error?: string }> {
  const result = computeFeasibility(ctx.inputs);
  const credit = computeCredit(ctx.inputs, result);
  const n = (v: number) => Math.round(v).toLocaleString('en-US');

  // حجم المشروع يحدد نطاقه التنافسي — منشأة بمليون ريال منافسها الحي لا السلاسل الوطنية
  const inv = result.totalInvestment;
  const scaleLabel = inv <= 3_000_000 ? 'مشروع صغير — منفذ أو فرع واحد'
    : inv <= 20_000_000 ? 'مشروع متوسط — عدة فروع أو خط إنتاج' : 'مشروع كبير — حضور على مستوى المنطقة أو المملكة';
  const scaleRadius = inv <= 3_000_000 ? 'الحي أو النطاق الجغرافي المباشر داخل المدينة، مع قنوات التوصيل الرقمية التي تصل إلى هذا النطاق'
    : inv <= 20_000_000 ? 'المدينة أو المنطقة' : 'السوق الوطني';

  const mkPrompt = (marketBlock: string) => 'أنت خبير دراسات جدوى في السوق السعودي. اكتب أقسام دراسة جدوى لمشروع محدد أدناه.\n\n'
    + 'بيانات المشروع كما قدّمها العميل:\n'
    + '- المنشأة: ' + ctx.companyName + (ctx.crNumber ? ' (سجل ' + ctx.crNumber + ')' : '') + '\n'
    + '- المدينة: ' + (ctx.city || 'غير محدد') + (ctx.location ? ' | موقع المشروع: ' + ctx.location : '') + '\n'
    + '- القطاع: ' + ctx.sectorText + '\n'
    + '- وصف المشروع: ' + ctx.projectDescription + '\n'
    + '- نوعه: ' + (ctx.projectKind === 'new' ? 'مشروع جديد من الصفر' : 'توسعة نشاط قائم') + (ctx.existingRevenue ? ' — إيراد النشاط القائم ' + n(ctx.existingRevenue) + ' ريال' : '') + '\n'
    + (ctx.capacityNote ? '- الطاقة المستهدفة: ' + ctx.capacityNote + '\n' : '')
    + (ctx.staffNote ? '- العمالة: ' + ctx.staffNote + '\n' : '')
    + '- التكلفة الرأسمالية: ' + n(ctx.inputs.capex) + ' ريال | رأس المال العامل: ' + n(ctx.inputs.workingCapital) + ' ريال\n'
    + '- افتراضات التشغيل كما قدّمها العميل: سعر الوحدة ' + n(ctx.inputs.unitPrice) + ' ريال | وحدات السنة الأولى ' + n(ctx.inputs.unitsYear1)
      + ' | نمو المبيعات ' + ctx.inputs.growthRate + '% سنوياً | التكلفة المتغيرة ' + ctx.inputs.variableCostPct + '% من الإيراد | المصاريف الثابتة '
      + n(ctx.inputs.fixedCostsAnnual) + ' ريال سنوياً تنمو ' + ctx.inputs.inflationRate + '% سنوياً\n'
    + '- التمويل المطلوب: ' + n(ctx.inputs.financingAmount) + ' ريال على ' + ctx.inputs.financingYears + ' سنوات بكلفة سنوية ' + ctx.inputs.financingRate + '% | مساهمة المؤسس: ' + n(ctx.inputs.ownFunds) + ' ريال\n\n'
    + 'الأرقام المحسوبة (محسوبة برمجياً — لا تعد حسابها ولا تخالفها):\n'
    + '- إجمالي الاستثمار ' + n(result.totalInvestment) + ' ريال | فجوة التمويل ' + n(result.fundingGap) + ' ريال\n'
    + '- حجم المشروع: ' + scaleLabel + ' | نطاقه التنافسي: ' + scaleRadius + '\n'
    + '- هامش المساهمة ' + result.contributionMarginPct.toFixed(1) + '% | نقطة التعادل ' + n(result.breakEvenRevenue) + ' ريال سنوياً\n'
    + '- فترة الاسترداد: ' + (result.paybackYears === null ? 'لا تُسترد خلال خمس سنوات بهذه الافتراضات' : result.paybackYears.toFixed(1) + ' سنة') + '\n'
    + '- القسط السنوي للتمويل ' + n(result.annualInstalment) + ' ريال (محسوب — لا تقل إنه غير محدد ولا تفترض غيره)\n'
    + '- صافي الربح المحاسبي (بعد الاستهلاك وكلفة التمويل): السنة الأولى ' + n(result.years[0].netProfit) + ' ريال، والسنة الخامسة ' + n(result.years[4].netProfit) + ' ريال\n'
    + '- صافي التدفق النقدي بعد القسط الكامل: السنة الأولى ' + n(result.years[0].cashFlow) + ' ريال، والسنة الخامسة ' + n(result.years[4].cashFlow) + ' ريال\n'
    + '- الاستهلاك السنوي ' + n(result.years[0].depreciation) + ' ريال، وكلفة التمويل السنوية ' + n(result.years[0].financeCharge) + ' ريال من أصل قسط ' + n(result.years[0].debtService) + ' ريال (الباقي سداد أصل)\n\n'
    + '\nمؤشرات الائتمان (محسوبة برمجياً — استند إليها ولا تعِد حسابها):\n'
    + '- نسبة تغطية خدمة الدين: أدناها ' + (credit.minDscr === null ? 'لا تنطبق' : credit.minDscr.toFixed(2) + '× ومتوسطها ' + (credit.avgDscr as number).toFixed(2) + '×') + ' — ' + credit.verdict + '\n'
    + '- التدفق المتاح لخدمة الدين في السنة الأولى ' + n(credit.years[0].cfads) + ' ريال = صافي الربح + الاستهلاك ' + n(credit.years[0].depreciation) + ' + كلفة التمويل ' + n(credit.years[0].financeCharge) + '\n'
    + '- التدفق الشهري للسنة الأولى يبلغ أعمق نقطة نقدية في الشهر ' + (credit.deepestMonth ? credit.deepestMonth.month : 0) + '، فرأس المال العامل الفعلي اللازم ' + n(credit.workingCapitalNeeded) + ' ريال\n'
    + '- السيناريو المتحفظ (مبيعات -20% وتكاليف +10%): تغطية ' + (credit.scenarios[0].dscrY1 === null ? '—' : credit.scenarios[0].dscrY1.toFixed(2) + '×') + ' — ' + credit.scenarios[0].verdict + '\n\n'
    + marketBlock
    + 'الجمهور المستهدف للدراسة: ' + AUD[ctx.audience] + '\n\n'
    + 'قواعد إلزامية:\n'
    + '(ج١) أرقام السوق: اذكر أرقاماً كمّية فعلية لحجم السوق ونموه ومتوسط الإنفاق ومؤشرات القطاع — لا تترك القسم بلا أرقام. ما ورد في «نتائج بحث السوق» أعلاه انسبه إلى مصدره باسمه وسنته، وما لم يرد فيه اكتبه بصياغة «تقدير استرشادي مبني على مؤشرات القطاع المعلنة». ولا تنسب رقماً إلى جهة بعينها ما لم يرد في نتائج البحث أعلاه. ولا تعتمد رقماً منسوباً إلى صحيفة تنقل عن «تقرير سوق» غير مُسمّى — إمّا أن يُنسب إلى التقرير نفسه باسمه، أو يُكتب تقديراً استرشادياً؛ فأضعف مصدر في الوثيقة يُسقط ما حوله إذا شكّك فيه الممول.\n'
    + '(ج١ب) في الخلاصة والمخاطر: علّق صراحةً على نسبة تغطية خدمة الدين وعلى السيناريو المتحفظ، وبيّن ما إذا كان الهيكل المطلوب يتحمّل، وإن كانت التغطية دون 1.25× فاقترح معالجة محددة (تمديد الأجل أو رفع المساهمة أو خفض المطلوب).\n'
    + '(ج٢) لا تعد بعائد ولا تكتب أي عبارة ضمان للنجاح أو للربح، ولا تصف المشروع بأنه مضمون أو مؤكد.\n'
    + '(ج٣) لا تخالف الأرقام المحسوبة أعلاه ولا تعيد حسابها. وإن كانت النتيجة ضعيفة (تعادل مرتفع أو استرداد بعيد) فاذكر ذلك بوضوح ولا تجمّله.\n'
    + '(ج٤) لا تنسب للمنشأة أي صفة لم ترد أعلاه — لا خبرة ولا عملاء ولا تراخيص ولا أصول.\n'
    + '(ج٤ب) لا تكرر عنوان القسم في أول سطر من نصه. وإن احتجت جدولاً فاكتبه بصيغة الأنبوب | فقط، ولا تستخدم ** ولا # ولا أي ترميز آخر.\n'
    + '(ج٦) نطاق المنافسة يُحدَّد بحجم المشروع المذكور أعلاه. اكتب قسم المنافسين عن المنافسين الفعليين في ذلك النطاق وعند ذلك الحجم: عددهم وأنماطهم ومستوى أسعارهم وقنواتهم. أما السلاسل الكبرى والعلامات الوطنية فتُذكر — إن لزم — في سياق بنية السوق وسقف الأسعار وتوقعات العميل فقط، ولا تُقدَّم بوصفها منافساً مباشراً لمشروع بهذا الحجم: مقارنة منشأة صغيرة بسلاسل وطنية تُضعف الملف أمام الممول ولا تعطي العميل معلومة قابلة للتنفيذ. وإن لم تتوفر أسماء على مستوى النطاق فاوصف بنية المنافسة فيه بدل حشو القسم بأسماء لا تخصه.\n'
    + '(ج٧) المخاطر تخص هذا المشروع وحده: كل خطر يُشتق من أرقامه أو موقعه أو تراخيصه أو هيكل تمويله، ويقترن بإجراء تخفيفي ينفّذه المشروع فعلاً. ويُمنع منعاً باتاً إدراج معدلات تعثّر أو إغلاق أو خروج عامة للقطاع (نسبة المنشآت التي أُغلقت خلال مدة ونحوها) — فهي حكم على القطاع لا على المشروع، ولا يملك المشروع إجراءً يخفّضها، فتضر الدراسة دون أن تضيف معلومة. وهذا لا يُخلّ بالقاعدة (ج١ب): نسبة التغطية المحسوبة والسيناريو المتحفظ يبقيان إلزاميين لأنهما مشتقان من أرقام العميل نفسه ولهما معالجات محددة.\n'
    + '(ج٥) في حقل sources أدرج المصادر الواردة في نتائج البحث أعلاه فقط، ولا تخترع مصدراً ولا رابطاً.\n\n'
    + 'أرجع JSON فقط بلا أي نص آخر وبلا markdown:\n'
    + '{"executiveSummary":"الملخص التنفيذي (فقرتان) مصاغ لجمهور الدراسة","marketStudy":"دراسة السوق: الحجم والنمو والشريحة المستهدفة، كل رقم بمصدره","competition":"المنافسة عند حجم المشروع ونطاقه: بنية المنافسة في النطاق ومستوى الأسعار والقنوات، ثم موقع المشروع وعوامل تمايزه ونقاط ضعفه","technicalStudy":"الدراسة الفنية: الموقع والطاقة والمعدات والعمالة ومراحل التنفيذ","assumptionsNote":"جدول الافتراضات: كل افتراض بُنيت عليه الأرقام مع مصدره أو وصفه بأنه افتراض العميل","risks":"مخاطر هذا المشروع تحديداً، كل خطر بإجراء تخفيفي ينفّذه — بلا إحصاءات تعثّر عامة للقطاع","conclusion":"الخلاصة والتوصية بصراحة","sources":["اسم المصدر — الرابط — السنة"]}';

  // استخراج JSON من نص قد يحوي مقدمة أو عدة كتل — نجرب من آخر '{' للخلف
  const pick = (raw: string, need = 'executiveSummary'): Record<string, unknown> | null => {
    const c = raw.replace(/```json|```/g, '').trim();
    const starts: number[] = [];
    for (let k = 0; k < c.length; k++) if (c[k] === '{') starts.push(k);
    // نجرب كل بداية مع كل نهاية محتملة، من الأطول للأقصر
    const ends: number[] = [];
    for (let k = c.length - 1; k >= 0; k--) if (c[k] === '}') ends.push(k);
    for (const st of starts) {
      for (const en of ends) {
        if (en <= st) break;
        try {
          const o = JSON.parse(c.slice(st, en + 1));
          if (o && typeof o === 'object' && o[need]) return o as Record<string, unknown>;
        } catch { /* جرّب نهاية أقصر */ }
      }
    }
    // رد مقطوع: نلتقط الحقول النصية المكتملة يدوياً حتى لا تضيع الأقسام
    const keys = ['executiveSummary', 'marketStudy', 'competition', 'technicalStudy', 'assumptionsNote', 'risks', 'conclusion', 'facts'];
    const out: Record<string, unknown> = {};
    for (const k of keys) {
      const m = c.match(new RegExp('"' + k + '"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"'));
      if (m) out[k] = m[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
    }
    return out[need] ? out : null;
  };

  let diag = '';
  const call = async (body: Record<string, unknown>, ms: number, tag: string): Promise<string | null> => {
    const ac = new AbortController();
    const to = setTimeout(() => ac.abort(), ms);
    try {
      const r = await fetch(ANTHROPIC_URL, {
        method: 'POST', signal: ac.signal,
        headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY as string, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: MODEL, ...body }),
      });
      clearTimeout(to);
      if (!r.ok) { diag += tag + 'HTTP ' + r.status + ' — ' + (await r.text()).slice(0, 200); return null; }
      const d = await r.json();
      return (d.content || []).filter((c: { type: string }) => c.type === 'text').map((c: { text: string }) => c.text).join('\n');
    } catch (e) {
      clearTimeout(to);
      diag += tag + 'استثناء — ' + (e instanceof Error ? e.name + ': ' + e.message : String(e)).slice(0, 200);
      return null;
    }
  };

  // ═══ النداء الأول: بحث سوق فقط، مخرجاته قصيرة فيبقى سريعاً ═══
  const researchPrompt = 'ابحث في الويب عن مؤشرات السوق السعودي لهذا النشاط: ' + ctx.sectorText
    + (ctx.city ? ' في ' + ctx.city : '') + '. وصف المشروع: ' + ctx.projectDescription + '\n'
    + 'حجم المشروع: ' + scaleLabel + '، ونطاقه التنافسي هو ' + scaleRadius + '.\n'
    + 'اجمع تحديداً: حجم السوق ونموه المتوقع · متوسط إنفاق العميل أو متوسط قيمة الطلب · مستوى الأسعار وبنية المنافسة عند حجم المشروع ونطاقه تحديداً (لا على مستوى السلاسل الوطنية إن كان المشروع صغيراً) · أحدث الاشتراطات التنظيمية المؤثرة · مؤشرات التكلفة المحلية كالإيجار وأجور التشغيل في المدينة.\n'
    + 'لا تجمع معدلات تعثّر أو إغلاق عامة للقطاع — لا تُستخدم في الدراسة.\n'
    + 'أرجع JSON فقط بلا أي نص آخر: {"facts":"نقاط مرقّمة، كل نقطة رقم واحد مع اسم مصدره وسنته","sources":["اسم المصدر — الرابط — السنة"]}\n'
    + 'لا تكتب رقماً لم تره في نتيجة بحث فعلية، ولا تنسب رقماً لمصدر لم تفتحه.';
  const t0 = Date.now();
  const rTxt = await call({
    max_tokens: 2500,
    tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }],
    messages: [{ role: 'user', content: researchPrompt }],
  }, 95000, ' | بحث السوق: ');
  const rJson = rTxt ? pick(rTxt, 'facts') as { facts?: string; sources?: string[] } | null : null;
  const facts = rJson && typeof rJson.facts === 'string' ? rJson.facts.trim() : '';
  const foundSources = rJson && Array.isArray(rJson.sources) ? rJson.sources.filter(x => typeof x === 'string') : [];
  const marketBlock = facts
    ? 'نتائج بحث السوق (من بحث فعلي — استند إليها وانسب كل رقم لمصدره):\n' + facts + '\n\nالمصادر المتاحة: ' + foundSources.join(' | ') + '\n\n'
    : 'لم تصل نتائج بحث سوق لهذه التشغيلة — اكتب أرقام السوق من معرفتك بالسوق السعودي بصفتها تقديرات استرشادية مبنية على مؤشرات القطاع تُحدَّث بمصادر منشورة قبل الاعتماد النهائي، واترك sources فارغة.\n\n';

  // ═══ النداء الثاني: كتابة الأقسام بلا أدوات — وهو النداء الذي ينجح دائماً ═══
  const txt = await call({
    max_tokens: 12000,
    messages: [{ role: 'user', content: mkPrompt(marketBlock) }],
  }, Math.max(60000, 265000 - (Date.now() - t0)), ' | كتابة الأقسام: ');
  const parsed = txt ? pick(txt) : null;
  if (!parsed) {
    if (txt) diag += ' | الرد وصل بطول ' + txt.length + ' حرفاً لكن تعذّر استخراج JSON — بدايته: ' + txt.slice(0, 120);
    return { sections: empty(), result, credit, error: 'تعذّر توليد الأقسام النصية' + diag };
  }
  const sections = { ...empty(), ...parsed } as FeasibilitySections;
  if (!sections.sources?.length && foundSources.length) sections.sources = foundSources;
  return { sections, result, credit, error: facts ? undefined : 'أرقام السوق تقديرات استرشادية — لم تصل نتائج البحث في هذه التشغيلة' + diag };
}

function empty(): FeasibilitySections {
  return { executiveSummary: '', marketStudy: '', competition: '', technicalStudy: '', assumptionsNote: '', risks: '', conclusion: '', sources: [] };
}

// النموذج يكتب markdown أحياناً رغم المنع — نحوّله بدل أن يظهر خاماً في وثيقة تُسلَّم لبنك
function mdToHtml(body: string, title: string): string {
  // داخل الخلايا: تشديد فقط — لا نحذف '#' لأنه قد يكون عنوان عمود «رقم»
  const cell = (t: string) => t
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>');
  const inline = (t: string) => cell(t)
    .replace(/^\s*#{1,6}\s+/, '')
    .replace(/^\s*[-*]\s+/, '• ');
  const bare = (t: string) => t.replace(/[*_#:：\s]/g, '');
  const parts: string[] = [];
  let text: string[] = [];
  let tbl: string[][] = [];
  const flushText = () => { if (text.length) { parts.push(text.join('<br>')); text = []; } };
  const flushTable = () => {
    if (!tbl.length) return;
    const rows = tbl.filter(r => !r.every(c => /^:?-{2,}:?$/.test(c)));
    if (rows.length) {
      const head = rows[0], rest = rows.slice(1);
      parts.push('<table class="fz"><thead><tr><th>' + head.map(cell).join('</th><th>') + '</th></tr></thead><tbody>'
        + rest.map(r => '<tr><td>' + r.map(cell).join('</td><td>') + '</td></tr>').join('') + '</tbody></table>');
    }
    tbl = [];
  };
  let first = true;
  for (const ln of String(body).split('\n')) {
    if (/^\s*\|.*\|\s*$/.test(ln)) {
      flushText();
      tbl.push(ln.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim()));
      continue;
    }
    flushTable();
    if (first && ln.trim()) { first = false; if (bare(ln) === bare(title)) continue; }
    text.push(inline(ln));
  }
  flushTable(); flushText();
  return parts.join('');
}

export function buildFeasibilityHTML(ctx: FeasibilityContext, s: FeasibilitySections, r: FeasibilityResult, warn?: string, credit?: CreditPack): string {
  const sec = (title: string, body: string) => body ? '<h2>' + title + '</h2><div class="bd">' + mdToHtml(body, title) + '</div>' : '';
  const srcList = (s.sources || []).length ? '<h2>المصادر</h2><ul>' + s.sources.map(x => '<li>' + x + '</li>').join('') + '</ul>' : '';
  return '<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>دراسة جدوى — ' + ctx.companyName + '</title>'
    + '<style>body{font-family:Arial,sans-serif;color:#1F2A44;line-height:1.9;padding:32px;max-width:900px;margin:auto}'
    + 'h1{color:#B8860B;font-size:26px}h2{color:#1F2A44;border-bottom:2px solid #B8860B;padding-bottom:6px;margin-top:28px;font-size:19px}'
    + '.bd{font-size:15px}table.fz{width:100%;border-collapse:collapse;margin:14px 0;font-size:13px}'
    + 'table.fz th,table.fz td{border:1px solid #E0E0E0;padding:7px;text-align:right}table.fz th{background:#EFE6D0;font-weight:bold}'
    + 'table.fz.sm{font-size:11px}table.fz.sm th,table.fz.sm td{padding:5px}'
    + '.note{background:#FBF7EC;border-right:4px solid #B8860B;padding:12px;margin:16px 0;font-size:13px}</style></head><body>'
    + '<h1>دراسة الجدوى الاقتصادية</h1><p><b>' + ctx.companyName + '</b>' + (ctx.crNumber ? ' — سجل تجاري ' + ctx.crNumber : '') + (ctx.city ? ' — ' + ctx.city : '') + '</p>'
    + '<p>' + ctx.projectDescription + '</p>'
    + sec('الملخص التنفيذي', s.executiveSummary)
    + '<h2>المؤشرات المالية</h2>' + renderFeasibilitySummary(r)
    + '<h2>التوقعات المالية لخمس سنوات</h2>' + renderProjectionTable(r)
    + '<div class="note">الأرقام أعلاه محسوبة من افتراضات العميل المذكورة في جدول الافتراضات، وليست وعداً بعائد. وأي تغيّر في السعر أو حجم المبيعات أو التكاليف يغيّر النتائج.</div>'
    + (credit ? '<h2>ملف الائتمان — تغطية خدمة الدين</h2>' + renderCreditTable(credit) + '<h2>التدفق النقدي الشهري للسنة الأولى</h2>' + renderMonthlyTable(credit) + '<h2>تحليل الحساسية — ثلاثة سيناريوهات</h2>' + renderScenarioTable(credit) : '')
    + sec('دراسة السوق', s.marketStudy)
    + sec('المنافسون', s.competition)
    + sec('الدراسة الفنية', s.technicalStudy)
    + sec('جدول الافتراضات', s.assumptionsNote)
    + sec('المخاطر وإجراءات التخفيف', s.risks)
    + sec('الخلاصة والتوصية', s.conclusion)
    + srcList
    + '<p style="margin-top:30px;font-size:12px;color:#666">أُعدّت بواسطة حلول المرضي للاستشارات المالية — ترخيص FL-457927015</p>'
    + '</body></html>';
}
