// ════════════════════════════════════════════════════════════════
// الموقف النظامي — مصدر واحد لا يتكرّر ولا يتناقض
// ════════════════════════════════════════════════════════════════
//
// لماذا هذا الملف موجود:
//
// في السعودية، الأجرُ على الوصل بين طرفين نشاطٌ مرخَّص في كل سوق.
// في الأوراق المالية اسمه «الترتيب» ورخصته من هيئة السوق المالية.
// وفي التمويل اسمه «الوساطة الرقمية لجهات التمويل» — أصدرت تعليماته
// ساما في ٢٢ مايو ٢٠٢٣ ضمن قواعد الترخيص للنشاطات المساندة لنشاط
// التمويل، وتعريفه المنشور: «ربط العميل الذي يرغب في الحصول على
// تمويل مع جهات التمويل عبر منصات رقمية، بناءً على وضعه الائتماني».
//
// ومُرضي ليست ذلك، وموقعها النظامي يقوم على ثلاث ركائز — إن سقطت
// واحدةٌ منها تغيّر التكييف كلُّه:
//
//   ١ · الأتعاب من العميل وحده، رسمٌ ثابت مقابل مُنتَجٍ استشاري
//       يُسلَّم (ملف · دراسة · تقييم) — لا نسبةَ من تمويل، ولا أتعابَ
//       نجاح مشروطة بالحصول عليه، ولا ريالَ واحد من جهة ممولة.
//   ٢ · نعمل بتكليفٍ خطّي من العميل، والتقديم والتعاقد يبقيان بينه
//       وبين الجهة مباشرةً — لا نوقّع عنه ولا نلتزم باسمه.
//   ٣ · لا نَعِد بتمويل، ولا نوحي بأننا نمنحه أو نعتمده.
//       (نظام مراقبة شركات التمويل، المادة ٤/٢: يُحظر على غير المرخّص
//        له أن يوحي — صراحةً أو ضمناً — بأنه يزاول نشاط تمويل.)
//
// كل نصٍّ يخرج من المنصة أو يذهب إلى عميل أو جهة يستورد من هنا.
// ولا يُكتب وصفٌ للخدمة في أي ملف آخر.

/** رقم الترخيص ومسمّاه الكامل — يُذكر كما هو، لا مختصراً */
export const LICENCE_NO = 'FL-457927015';
export const LICENCE_FULL =
  'ترخيص مزاولة مهنة الاستشارات المالية لغير الأوراق المالية رقم ' + LICENCE_NO;
export const CR_NO = '7039663724';

/** سطر الهوية — أينما عُرِّفت الشركة */
export const IDENTITY_AR =
  'شركة حلول المرضي للاستشارات المالية — ' + LICENCE_FULL + ' · سجل تجاري ' + CR_NO;
export const IDENTITY_EN =
  'Almurdi Financial Consulting Solutions — Licence ' + LICENCE_NO + ' · CR ' + CR_NO;

/**
 * وصف الخدمة المعتمد. هذا هو النص الوحيد المسموح لوصف ما نفعله.
 * لاحظ ما ليس فيه: «نربطك» · «نطابقك مع الجهات» · «نيابةً عنك» ·
 * «حتى تحصل على التمويل». كلها أفعالُ وساطةٍ لا أفعالُ استشارة.
 */
export const SERVICE_AR =
  'نقيس جاهزية المنشأة رأسمالياً، ونرتّب ملفها المالي، ونبيّن لها الجهات التي تنطبق ' +
  'عليها شروطها المعلنة — ثم نخاطب تلك الجهات بتكليفٍ خطّي منها لعرض الملف، ونتابع ' +
  'حتى يصل الرد. ويبقى قرار التقديم والتعاقد بيد المنشأة وحدها.';

export const SERVICE_EN =
  'We assess a company’s capital readiness, structure its financing file, and set out ' +
  'which institutions’ published criteria it meets — then, when instructed in writing by ' +
  'the company, we present that file to those institutions and follow it up. The company ' +
  'alone decides whether to apply and to contract.';

/** سطر الإفصاح — يُذيَّل به كل مستند وكل صفحة عامة */
export const DISCLOSURE_AR =
  'مُرضي ليست جهة تمويل ولا وسيطاً تمويلياً، ولا تتلقّى أي مقابل من جهات التمويل. ' +
  'وأتعابها رسمٌ ثابت من العميل وحده مقابل خدمةٍ استشارية تُسلَّم، ولا ترتبط بالحصول ' +
  'على تمويل ولا بمقداره. ولا نضمن موافقة أي جهة.';

export const DISCLOSURE_EN =
  'Murdi is neither a financing provider nor a finance intermediary, and receives no ' +
  'consideration from any financing institution. Its fees are a fixed charge paid by the ' +
  'client for a delivered advisory service, unrelated to whether or how much finance is ' +
  'obtained. No approval is guaranteed.';

/** السطر المختصر — للفوتر والشارات وشاشات الدخول */
export const DISCLOSURE_SHORT_AR =
  'منصة استشارية لقياس الجاهزية وتجهيز الملفات — لا نمنح تمويلاً، ولا نتوسّط، ولا نضمن نتيجة';

/**
 * سطر التكليف — يُدرَج في كل مخاطبةٍ تذهب إلى جهة ممولة.
 * الفرق بين «بتكليفٍ منه» و«نيابةً عنه» ليس لفظياً: الأولى تصف
 * مستشاراً كُلِّف بإعداد مستندٍ وعرضه، والثانية تصف وكيلاً يتصرّف
 * مكان موكّله — وهي فعل الوساطة.
 */
export const MANDATE_AR =
  'أعدّت مُرضي هذا الملف بتكليفٍ من المنشأة، وتعرضه عليكم للدراسة. ' +
  'ويتم التقديم والتعاقد بينكم وبين المنشأة مباشرةً.';

export const MANDATE_EN =
  'Murdi prepared this file under engagement by the company and presents it for your ' +
  'review. Any application and contracting is directly between your institution and the company.';

/**
 * الألفاظ المحظورة — يُمنع ظهورها في أي نصٍّ يخرج من المنصة.
 * تُستعمل في الحارس أدناه وفي موجّهات التوليد.
 */
export const FORBIDDEN_AR: readonly RegExp[] = [
  /نياب(ةً|ة)\s*عن/,
  /نحصل\s*لك\s*على\s*(ال)?تمويل/,
  /نضمن\s*(لك)?\s*(ال)?(تمويل|موافقة|قبول)/,
  /حتى\s*(ال)?حصول\s*على\s*(ال)?تمويل/,
  /نربطك\s*(ب|مع)/,
  /نوصّ?لك\s*(ب|مع|إلى)/,
  /نطابقك\s*(مع|ب)/,
  /نسبةً?\s*من\s*(ال)?تمويل(ك)?\b(?!.*لا)/,
  /عمولة\s*من\s*(ال)?جهة/,
  /أتعاب\s*نجاح/,
  /وسيط\s*تمويل/,
];

export const FORBIDDEN_EN: readonly RegExp[] = [
  /\bon\s+behalf\s+of\b/i,
  /\bacting\s+for\b/i,
  /\brepresenting\s+the\s+client\b/i,
  /\bmandated\s+by\b/i,
  /\bwe\s+will\s+(secure|obtain|arrange)\s+(the\s+)?financing\b/i,
  /\bsuccess\s+fee\b/i,
  /\bguarantee\s+(approval|financing|funding)\b/i,
];

/**
 * حارسٌ يُستدعى قبل عرض أي نصٍّ مولَّد أو إرساله.
 * يرجع قائمة المخالفات — فارغةً إن سلم النص.
 */
export function stanceViolations(text: string): string[] {
  const out: string[] = [];
  for (const re of FORBIDDEN_AR) {
    const m = text.match(re);
    if (m) out.push(m[0]);
  }
  for (const re of FORBIDDEN_EN) {
    const m = text.match(re);
    if (m) out.push(m[0]);
  }
  return out;
}

/**
 * القواعد التي تُحقن في كل موجّه توليد — عربيةً وإنجليزية معاً.
 * سببُ جمعها هنا أن النص إذا انفلت في موضعٍ واحد نقض الموقف كلّه:
 * الجهة الرقابية تقرأ ما نسوّق به، لا ما نُخليه في صفحة الإخلاء.
 */
export const STANCE_RULES_PROMPT = `
═══ الموقف النظامي — قواعد آمرة لا تُخالَف بأي لغة ═══
أ) ممنوع منعاً باتاً: «نيابةً عن العميل» أو «وكالةً عنه» أو "on behalf of" أو
   "acting for" أو "representing the client". الصيغة الصحيحة: أعدّت مُرضي الملف
   **بتكليفٍ من المنشأة** وتعرضه للدراسة، والتقديم والتعاقد بين الجهة والمنشأة مباشرةً.
ب) ممنوع الالتزام باسم العميل بأي شيء لم يرد نصاً في بياناته: لا دفعةً مقدمة،
   ولا ضماناً، ولا قبولَ نسبةٍ أو شرط، ولا استعداداً للتوقيع. اسأل الجهة عمّا تطلبه،
   ولا تَعِدها بما سيقدّمه العميل.
ج) ممنوع أي وعدٍ بنتيجة أو ضمانٍ لموافقة، وممنوع كل ما يوحي بأننا نمنح التمويل
   أو نعتمده أو نتوسّط فيه.
د) ممنوع ذكر أتعاب نجاح أو نسبةٍ من التمويل أو أي مقابلٍ من الجهة الممولة —
   فأتعابنا رسمٌ ثابت من العميل مقابل خدمةٍ استشارية، ولا علاقة لها بنتيجة الطلب.
هـ) الخاتمة تطلب الخطوات والمستندات **ليتقدّم العميل**، لا لنتقدّم نحن عنه.
`.trim();

export const STANCE_RULES_EN = `
═══ REGULATORY STANCE — binding, no exceptions ═══
1) NEVER write "on behalf of", "acting for", "representing the client", "authorised by"
   or "mandated by". Correct framing: Murdi PREPARED and STRUCTURED the file UNDER
   ENGAGEMENT BY the company and is presenting it; the company alone applies and contracts.
2) NEVER commit the client to anything absent from the client data — no down payment,
   no collateral, no rate, no willingness to sign.
3) NEVER promise or imply an outcome, an approval, or that we provide or approve finance.
4) NEVER mention a success fee, a percentage of the financing, or any consideration
   from the institution. Our fee is a fixed charge paid by the client for an advisory
   deliverable, unrelated to the outcome.
5) Close by asking for the steps and documents SO THAT THE COMPANY MAY APPLY.
`.trim();
