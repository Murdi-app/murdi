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

  const prompt = 'أنت خبير دراسات جدوى في السوق السعودي. اكتب أقسام دراسة جدوى لمشروع محدد أدناه.\n\n'
    + 'بيانات المشروع كما قدّمها العميل:\n'
    + '- المنشأة: ' + ctx.companyName + (ctx.crNumber ? ' (سجل ' + ctx.crNumber + ')' : '') + '\n'
    + '- المدينة: ' + (ctx.city || 'غير محدد') + (ctx.location ? ' | موقع المشروع: ' + ctx.location : '') + '\n'
    + '- القطاع: ' + ctx.sectorText + '\n'
    + '- وصف المشروع: ' + ctx.projectDescription + '\n'
    + '- نوعه: ' + (ctx.projectKind === 'new' ? 'مشروع جديد من الصفر' : 'توسعة نشاط قائم') + (ctx.existingRevenue ? ' — إيراد النشاط القائم ' + n(ctx.existingRevenue) + ' ريال' : '') + '\n'
    + (ctx.capacityNote ? '- الطاقة المستهدفة: ' + ctx.capacityNote + '\n' : '')
    + (ctx.staffNote ? '- العمالة: ' + ctx.staffNote + '\n' : '')
    + '- التكلفة الرأسمالية: ' + n(ctx.inputs.capex) + ' ريال | رأس المال العامل: ' + n(ctx.inputs.workingCapital) + ' ريال\n'
    + '- التمويل المطلوب: ' + n(ctx.inputs.financingAmount) + ' ريال على ' + ctx.inputs.financingYears + ' سنوات بكلفة سنوية ' + ctx.inputs.financingRate + '% | مساهمة المؤسس: ' + n(ctx.inputs.ownFunds) + ' ريال\n\n'
    + 'الأرقام المحسوبة (محسوبة برمجياً — لا تعد حسابها ولا تخالفها):\n'
    + '- إجمالي الاستثمار ' + n(result.totalInvestment) + ' ريال | فجوة التمويل ' + n(result.fundingGap) + ' ريال\n'
    + '- هامش المساهمة ' + result.contributionMarginPct.toFixed(1) + '% | نقطة التعادل ' + n(result.breakEvenRevenue) + ' ريال سنوياً\n'
    + '- فترة الاسترداد: ' + (result.paybackYears === null ? 'لا تُسترد خلال خمس سنوات بهذه الافتراضات' : result.paybackYears.toFixed(1) + ' سنة') + '\n'
    + '- القسط السنوي للتمويل ' + n(result.annualInstalment) + ' ريال (محسوب — لا تقل إنه غير محدد ولا تفترض غيره)\n'
    + '- صافي ربح السنة الأولى ' + n(result.years[0].netProfit) + ' ريال، والسنة الخامسة ' + n(result.years[4].netProfit) + ' ريال\n\n'
    + '\nمؤشرات الائتمان (محسوبة برمجياً — استند إليها ولا تعِد حسابها):\n'
    + '- نسبة تغطية خدمة الدين: أدناها ' + (credit.minDscr === null ? 'لا تنطبق' : credit.minDscr.toFixed(2) + '× ومتوسطها ' + (credit.avgDscr as number).toFixed(2) + '×') + ' — ' + credit.verdict + '\n'
    + '- التدفق النقدي المتاح لخدمة الدين في السنة الأولى ' + n(credit.years[0].cfads) + ' ريال (يشمل استهلاكاً سنوياً ' + n(credit.years[0].depreciation) + ' ريال)\n'
    + '- التدفق الشهري للسنة الأولى يبلغ أعمق نقطة نقدية في الشهر ' + (credit.deepestMonth ? credit.deepestMonth.month : 0) + '، فرأس المال العامل الفعلي اللازم ' + n(credit.workingCapitalNeeded) + ' ريال\n'
    + '- السيناريو المتحفظ (مبيعات -20% وتكاليف +10%): تغطية ' + (credit.scenarios[0].dscrY1 === null ? '—' : credit.scenarios[0].dscrY1.toFixed(2) + '×') + ' — ' + credit.scenarios[0].verdict + '\n\n'
    + 'الجمهور المستهدف للدراسة: ' + AUD[ctx.audience] + '\n\n'
    + 'قواعد إلزامية:\n'
    + '(ج١) أرقام السوق: اذكر أرقاماً كمّية فعلية لحجم السوق ونموه ومتوسط الإنفاق ومؤشرات القطاع — لا تترك القسم بلا أرقام. وكل رقم يقترن بأساسه في نفس الجملة: إمّا مصدر منشور باسمه وسنته، أو صياغة «تقدير استرشادي مبني على مؤشرات القطاع المعلنة». ولا تنسب رقماً إلى جهة بعينها ما لم تكن قد اطّلعت عليه فعلاً.\n'
    + '(ج١ب) في الخلاصة والمخاطر: علّق صراحةً على نسبة تغطية خدمة الدين وعلى السيناريو المتحفظ، وبيّن ما إذا كان الهيكل المطلوب يتحمّل، وإن كانت التغطية دون 1.25× فاقترح معالجة محددة (تمديد الأجل أو رفع المساهمة أو خفض المطلوب).\n'
    + '(ج٢) لا تعد بعائد ولا تكتب أي عبارة ضمان للنجاح أو للربح، ولا تصف المشروع بأنه مضمون أو مؤكد.\n'
    + '(ج٣) لا تخالف الأرقام المحسوبة أعلاه ولا تعيد حسابها. وإن كانت النتيجة ضعيفة (تعادل مرتفع أو استرداد بعيد) فاذكر ذلك بوضوح ولا تجمّله.\n'
    + '(ج٤) لا تنسب للمنشأة أي صفة لم ترد أعلاه — لا خبرة ولا عملاء ولا تراخيص ولا أصول.\n'
    + '(ج٥) ابحث في الويب عن حجم السوق السعودي لهذا القطاع ونموه وأبرز المنافسين والاتجاهات التنظيمية الحديثة.\n\n'
    + 'أرجع JSON فقط بلا أي نص آخر وبلا markdown:\n'
    + '{"executiveSummary":"الملخص التنفيذي (فقرتان) مصاغ لجمهور الدراسة","marketStudy":"دراسة السوق: الحجم والنمو والشريحة المستهدفة، كل رقم بمصدره","competition":"المنافسون وموقع المشروع بينهم","technicalStudy":"الدراسة الفنية: الموقع والطاقة والمعدات والعمالة ومراحل التنفيذ","assumptionsNote":"جدول الافتراضات: كل افتراض بُنيت عليه الأرقام مع مصدره أو وصفه بأنه افتراض العميل","risks":"أبرز المخاطر وإجراءات تخفيفها","conclusion":"الخلاصة والتوصية بصراحة","sources":["اسم المصدر — الرابط — السنة"]}';

  // استخراج JSON من نص قد يحوي مقدمة أو عدة كتل — نجرب من آخر '{' للخلف
  const pick = (raw: string): Record<string, unknown> | null => {
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
          if (o && typeof o === 'object' && o.executiveSummary) return o as Record<string, unknown>;
        } catch { /* جرّب نهاية أقصر */ }
      }
    }
    // رد مقطوع: نلتقط الحقول النصية المكتملة يدوياً حتى لا تضيع الأقسام
    const keys = ['executiveSummary', 'marketStudy', 'competition', 'technicalStudy', 'assumptionsNote', 'risks', 'conclusion'];
    const out: Record<string, unknown> = {};
    for (const k of keys) {
      const m = c.match(new RegExp('"' + k + '"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"'));
      if (m) out[k] = m[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
    }
    return out.executiveSummary ? out : null;
  };

  let diag = '';
  const attempt = async (withSearch: boolean, ms: number): Promise<FeasibilitySections | null> => {
    const ac = new AbortController();
    const to = setTimeout(() => ac.abort(), ms);
    try {
      const body: Record<string, unknown> = {
        model: MODEL, max_tokens: 12000,
        messages: [{ role: 'user', content: withSearch ? prompt : prompt + '\\n\\nملاحظة: اكتب الأقسام من معرفتك بالسوق السعودي. أعطِ أرقاماً كمّية استرشادية لحجم السوق ونموه ومتوسط الإنفاق، وصِفها في نصها بأنها تقديرات استرشادية مبنية على مؤشرات القطاع تُحدَّث بمصادر منشورة قبل الاعتماد النهائي. لا تنسب رقماً لجهة بعينها، واترك sources فارغة.' }],
      };
      if (withSearch) body.tools = [{ type: 'web_search_20250305', name: 'web_search', max_uses: 4 }];
      const r = await fetch(ANTHROPIC_URL, {
        method: 'POST', signal: ac.signal,
        headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY as string, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify(body),
      });
      clearTimeout(to);
      const tag = withSearch ? ' | بالبحث: ' : ' | بلا بحث: ';
      if (!r.ok) { diag += tag + 'HTTP ' + r.status + ' — ' + (await r.text()).slice(0, 200); return null; }
      const d = await r.json();
      const txt = (d.content || []).filter((c: { type: string }) => c.type === 'text').map((c: { text: string }) => c.text).join('\n');
      const parsed = pick(txt);
      if (!parsed) { diag += tag + 'الرد وصل بطول ' + txt.length + ' حرفاً لكن تعذّر استخراج JSON — بدايته: ' + txt.slice(0, 120); return null; }
      return { ...empty(), ...parsed } as FeasibilitySections;
    } catch (e) {
      clearTimeout(to);
      diag += (withSearch ? ' | بالبحث: ' : ' | بلا بحث: ') + 'استثناء — ' + (e instanceof Error ? e.name + ': ' + e.message : String(e)).slice(0, 200);
      return null;
    }
  };

  // السرعة أولاً: بلا بحث (~30 ثانية) فتخرج الدراسة كاملة دائماً. البحث محاولة إضافية قصيرة فقط.
  const t0 = Date.now();
  const fast = await attempt(false, 230000);
  if (fast) return { sections: fast, result, credit, error: 'أرقام السوق تحتاج تحققاً — لم يُشغَّل بحث المصادر' };
  const left = 275000 - (Date.now() - t0);
  const withSearch = left > 60000 ? await attempt(true, left) : null;
  if (withSearch) return { sections: withSearch, result, credit };
  return { sections: empty(), result, credit, error: 'تعذّر توليد الأقسام النصية' + diag };
}

function empty(): FeasibilitySections {
  return { executiveSummary: '', marketStudy: '', competition: '', technicalStudy: '', assumptionsNote: '', risks: '', conclusion: '', sources: [] };
}

export function buildFeasibilityHTML(ctx: FeasibilityContext, s: FeasibilitySections, r: FeasibilityResult, warn?: string, credit?: CreditPack): string {
  const sec = (title: string, body: string) => body ? '<h2>' + title + '</h2><div class="bd">' + String(body).replace(/\n/g, '<br>') + '</div>' : '';
  const srcList = (s.sources || []).length ? '<h2>المصادر</h2><ul>' + s.sources.map(x => '<li>' + x + '</li>').join('') + '</ul>' : '';
  return '<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>دراسة جدوى — ' + ctx.companyName + '</title>'
    + '<style>body{font-family:Arial,sans-serif;color:#1F2A44;line-height:1.9;padding:32px;max-width:900px;margin:auto}'
    + 'h1{color:#B8860B;font-size:26px}h2{color:#1F2A44;border-bottom:2px solid #B8860B;padding-bottom:6px;margin-top:28px;font-size:19px}'
    + '.bd{font-size:15px}table.fz{width:100%;border-collapse:collapse;margin:14px 0;font-size:13px}'
    + 'table.fz th,table.fz td{border:1px solid #E0E0E0;padding:7px;text-align:right}table.fz th{background:#EFE6D0;font-weight:bold}'
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
