// محرك توليد ملف التمويل/الاستثمار الاحترافي — مُرضي
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-6';

export interface FileClientData {
  companyName: string;
  crNumber?: string;
  sector?: string;
  city?: string;
  goal?: string;
  revenue?: number;
  profit?: number;
  assets?: number;
  liabilities?: number;
  readinessScore?: number;
  verdict?: string;
  valuationEstimate?: string;
  fundingAmount?: number;
  fundingType?: string;
  fundingPurpose?: string;
  majorBuyers?: string;
  clientType?: string;
  collectionCycle?: string;
  hasFleet?: boolean;
  issuesInvoices?: boolean;
  hasCollateral?: string;
  yearsOperating?: number;
  debtDetail?: string;
  pitchNums?: Record<string, string>;
}

export interface GeneratedFile {
  executiveSummary: string;
  companyOverview: string;
  financialPosition: string;
  theRequest: string;
  strengths: string;
  closing: string;
  companyNameEn?: string;
  cityEn?: string;
  sectorEn?: string;
}

export async function generateFileContent(
  client: FileClientData,
  track: 'funding' | 'investment' | 'acquisition' | 'valuation' | 'negotiation' | 'intake',
  region?: string
): Promise<GeneratedFile> {
  const isIn = track === 'intake';
  const isNeg = track === 'negotiation';
  const isVal = track === 'valuation';
  const isAcq = track === 'acquisition';
  const isInvestment = track === 'investment';
  const isIntl = (region || '').includes('دولي') || (region || '').toLowerCase().includes('intl');
  const docType = isIntl
    ? (isIn ? 'due diligence document and question checklist' : isNeg ? 'confidential negotiation position paper' : isVal ? 'independent valuation report' : isAcq ? 'sale memorandum' : isInvestment ? 'investment offering document' : 'financing proposal document')
    : (isIn ? 'قائمة المستندات والأسئلة' : isNeg ? 'ورقة موقف تفاوضي سرّية' : isVal ? 'تقرير تقييم مستقل' : isAcq ? 'مذكرة بيع' : isInvestment ? 'ملف عرض استثماري' : 'ملف تمويلي');
  const targetAudience = isIntl
    ? (isIn ? 'the client' : isNeg ? 'the owner and his advisor only' : isVal ? 'the business owner' : isAcq ? 'potential acquirers' : isInvestment ? 'institutional investors' : 'international financing institutions and banks')
    : (isIn ? 'العميل' : isNeg ? 'المالك ومستشاره فقط' : isVal ? 'مالك الشركة وحده' : isAcq ? 'المشترين المحتملين' : isInvestment ? 'المستثمرين المؤسسيين' : 'جهات التمويل والبنوك');
  const num = (n?: number) => n ? n.toLocaleString('en-US') + ' ريال' : '';

  const lines = [
    'الاسم: ' + client.companyName,
    client.crNumber ? 'السجل التجاري: ' + client.crNumber : '',
    client.sector ? 'القطاع: ' + client.sector : '',
    client.city ? 'المدينة: ' + client.city : '',
    client.goal ? 'الهدف: ' + client.goal : '',
    client.revenue ? 'الإيرادات السنوية: ' + num(client.revenue) : '',
    client.profit ? 'صافي الربح: ' + num(client.profit) : '',
    client.assets ? 'إجمالي الأصول: ' + num(client.assets) : '',
    client.liabilities ? 'إجمالي الالتزامات: ' + num(client.liabilities) : '',
    client.valuationEstimate ? 'التقييم التقديري: ' + client.valuationEstimate : '',
    client.fundingAmount ? 'المبلغ المطلوب (حدّده المستشار — استخدمه حرفياً ولا تجتهد في تقديره): ' + num(client.fundingAmount) : '',
    client.fundingPurpose ? 'غرض التمويل وأوجه استخدامه (كما ذكره العميل — فصّله في theRequest ولا تعمّمه): ' + client.fundingPurpose : '',
    client.majorBuyers ? 'الجهات الكبيرة التي يتعامل معها العميل أو يورّد لها: ' + client.majorBuyers : '',
    client.clientType ? 'نوع عملائه: ' + client.clientType : '',
    client.collectionCycle ? 'دورة التحصيل: ' + client.collectionCycle + ' يوماً' : '',
    client.yearsOperating ? 'عمر النشاط: ' + client.yearsOperating + ' سنوات' : '',
    client.hasFleet ? 'يملك أسطولاً أو معدات تشغيلية' : '',
    client.issuesInvoices ? 'يصدر فواتير أو مستخلصات على عملائه' : '',
    (client.hasCollateral && client.hasCollateral !== 'none') ? 'أصول قابلة للرهن: ' + client.hasCollateral : '',
    client.debtDetail ? 'تفاصيل الالتزامات القائمة: ' + client.debtDetail : '',
  ].filter(Boolean).join('\\n');

  const PITCH_LBL: Record<string, string> = { branch_revenue: 'متوسط إيراد الفرع الواحد (ر.س/سنة)', branch_cost: 'الكلفة الرأسمالية لافتتاح الفرع (ر.س — لمرة واحدة)', payback: 'فترة استرداد كلفة الفرع (شهر)', branches_now: 'عدد الفروع العاملة اليوم', branches_target: 'عدد الفروع المستهدفة من الجولة', headcount: 'عدد الموظفين', equity_offered: 'الحصة المعروضة (%)', pre_money: 'التقييم قبل الجولة (ر.س)', target_return: 'مضاعف العائد المستهدف وأفقه' };

  const pn = client.pitchNums || {};
  const pnLines = Object.entries(pn).filter(([, v]) => String(v || '').trim() !== '')
    .map(([k, v]) => '- ' + (PITCH_LBL[k] || k) + ': ' + v).join('\\n');
  const pnBlock = pnLines
    ? '\\n\\nأرقام مؤكَّدة من المستشار — استخدمها حرفياً ولا تقرّبها ولا تجتهد في تقديرها، وهي نفسها الواردة في العرض التقديمي المقدَّم للمستثمر:\\n' + pnLines
    : '';

  const reqLine = isIntl
    ? (isInvestment
        ? 'theRequest: the investment offer — amount sought, use of funds, and value offered to the investor'
        : 'theRequest: the financing request — amount, purpose, and repayment capacity')
    : (isInvestment
        ? 'theRequest: عرض الاستثمار — المبلغ المطلوب وأوجه استخدامه والقيمة المعروضة للمستثمر'
        : 'theRequest: طلب التمويل — المبلغ والغرض والقدرة على السداد');

  const ENTITY_RULE = 'قاعدة إلزامية عن الجهات: لا تصف أي جهة بأنها ستموّل العميل قبل التأكد من أداتها. جهة الضمان مثل وكالات ائتمان التصدير وبرنامج كفالة تضمن ولا تدفع للعميل ريالاً، والقناة مثل منصات التمويل الجماعي ومنصات الفواتير تعرض الطلب على ممولين آخرين ولا تموّل من ميزانيتها. اذكر دور كل جهة كما هو، ولا تحوّل ضامناً إلى ممول. ';
  const FUND_RULES = 'قواعد إلزامية لملف التمويل: (1) ممنوع منعاً باتاً ذكر درجة الجاهزية أو أي رقم أو تقييم داخلي لمنصة مُرضي — رقم داخلي لا يُعرض على جهة تمويل إطلاقاً. (2) ممنوع منعاً باتاً أي صيغة وساطة: لا «نيابةً عن العميل» ولا «on behalf of» ولا ما يوحي بأننا نتفاوض أو نتعاقد بدلاً عنه. الصيغة الصحيحة أننا جهّزنا ملف العميل ورفعنا جاهزيته وندعو الجهة لدراسته، ويبقى قرار التقديم والتعاقد بيد العميل وحده. (3) ممنوع أن يظهر المستشار كمن يحدد طلب العميل: المبلغ طلب العميل مبنيٌّ على خطته، لا توصية منا. (4) الالتزامات القائمة تُذكر كاملة وبصدق — أي تمويل قائم وأي إيجار تمويلي أو تأجير منتهٍ بالتملّك وأي قسط شهري وارد في البيانات — لأن السجل الائتماني سيكشفها، ونقصها يهدم المصداقية. (5) في theRequest فصّل أوجه استخدام المبلغ كما وردت حرفياً في غرض التمويل: كم للأصول وكم لرأس المال العامل وكم للتشغيل، ولا تكتفِ بوصف عام مثل «تعزيز الطاقة التشغيلية». (6) ابنِ نقاط القوة على وقائع العميل المذكورة في البيانات — أسماء عملائه وعقوده الموقّعة وأصوله المملوكة ودورة تحصيله — لا على كلام عام عن نمو القطاع أو الرؤية أو موقع المدينة. أي جملة تصلح لأي منشأة أخرى فهي حشو يُحذف. (7) لا تذكر رقماً لم يرد في البيانات ولا تقدّر رقماً بنفسك. (8) في الخاتمة اذكر وسيلة تواصل صريحة: البريد partners@murdi.sa. (9) ممنوع منعاً باتاً الإفصاح السلبي: لا تذكر ما لا يوجد في البيانات ولا تعلّق على نقص المعطيات — لا تكتب «لا تتضمن البيانات المتاحة كذا» ولا «لم تُدرج أرقام كذا» ولا أي جملة عن منهجية التحرير أو حدوده. اكتب ما لدى العميل فقط، واسكت عمّا سواه؛ فالإشارة إلى غياب معلومة تلفت نظر الممول إلى فجوة وتوحي بإخفاء. (10) وينطبق البند (4) على ما ورد في البيانات فعلاً: إن وردت التزامات فاذكرها كاملة، وإن لم ترد فلا تنفِ وجودها. ';
  const IN_RULES = 'قواعد إلزامية لقائمة المستندات: (1) المستند موجّه للعميل، يطلب منه ما نحتاجه لتجهيز صفقته. خاطبه مباشرةً بلغة مهنية موجزة. (2) كل بند سطر مستقل يبدأ بـ «– »، محدّد لا عام، ومعه سبب مختصر لماذا نطلبه: إما يرفع سعره أو يحميه من مفاجأة. (3) كيّف القائمة على قطاع العميل وطبيعة نشاطه: التقنية تُسأل عن الملكية الفكرية والشفرة والاشتراكات، والتجارة عن المخزون والفروع والموردين، والخدمات عن العقود والكوادر. (4) في executiveSummary: لماذا هذه القائمة وما أثر التأخر في تسليمها على السعر. (5) في companyOverview: مستندات الكيان والتراخيص وشروط انتقالها عند تغيّر الملكية. (6) في financialPosition: المستندات المالية والزكوية والتأمينات والالتزامات. (7) في theRequest: العقود والعملاء والملكية الفكرية والفريق، وأبرز فيها شرط تغيّر السيطرة في عقود العملاء. (8) في strengths: أسئلة عن المشتري والصفقة وما قيل في الاجتماعات، ومنها ما قُصد بأي وعد غير مكتوب عن دور المؤسس بعد البيع. (9) في closing: أسئلة عن أهداف العميل نفسه: المبلغ الذي يحتاجه، والحد الأدنى، وأي ضغط زمني عليه، وهل يقبل جزءاً مؤجّلاً، وهل يرغب في الاستمرار مع المشتري. (10) ممنوع ذكر درجة الجاهزية أو أي سعر أو تقييم. ';
  const NEG_RULES = 'قواعد إلزامية لورقة الموقف: (1) وثيقة داخلية سرّية للمالك ومستشاره وحدهما، ولا تُرسل لأي مشترٍ إطلاقاً. اكتبها مخاطباً المالك. (2) في executiveSummary: ملخّص الموقف ومواطن قوته التفاوضية ومواطن ضعفه. (3) في companyOverview: نقاط القوة مرتّبة بالأثر، وما يُطرح أولاً وما يُدّخر للحظة الضغط. (4) في financialPosition: نقاط الضعف صراحةً قبل أن يكتشفها المشتري، وجواب جاهز لكل واحدة. (5) في theRequest: هيكل الصفقة المقترح بستة عناصر: ما يُباع، ونسبة النقد إلى المؤجّل وشروط المؤجّل ومن يتحكم في تحقق أهدافه، وعملة الدفع، والمبلغ المحجوز ومدته، وسقف الإقرارات والضمانات ومدتها، وفصل عقد عمل المؤسس عن ثمن الشركة. (6) في strengths: اعتراضات المشتري المتوقعة ورد مكتوب على كل اعتراض. (7) في closing: ما لا يُقال في الجلسة — الحاجة للمال، ودرجة الاستعجال، وأي رقم قبل أوانه، وقاعدة ألا ينطق المالك بالرقم أولاً. (8) لا تخترع معلومة غير واردة؛ وما نقص فاذكره كسؤال يُطرح على المالك. ';
  const VAL_RULES = 'قواعد إلزامية لتقرير التقييم: (1) المستند موجّه لمالك الشركة وحده ولا يُرسل لأي مشترٍ أو مستثمر. (2) المخرَج إلزاماً نطاق من رقمين بالريال مع المنهجية والحساب ظاهراً خطوة خطوة، لا رقم مرسل. (3) استخدم مضاعفات ربح محافظة للشركات الخاصة غير المدرجة: تقنية وبرمجيات 5ℒ7؛ صحة وتعليم 4ℒ6؛ تجزئة وخدمات 3ℒ5؛ صناعة ومقاولات وتجارة 3ℒ4؛ أغذية وزراعة 4ℒ5. الحد الأدنى مع النمو الضعيف والأعلى مع العالي. (4) اعرض ثلاث زوايا إن أمكن: مضاعف الربح، وكلفة وزمن بناء ما تملكه الشركة من الصفر، وسوابق صفقات مشابهة إن وجدت؛ وإن تعذّرت زاوية فقل صراحةً إنها تحتاج بيانات إضافية. (5) إن كانت الشركة خاسرة أو ربحها صفر فلا تعط رقماً، واشرح ما يلزم للوصول إلى تقييم ذي معنى. (6) اذكر صراحةً عوامل ترفع القيمة وعوامل تخفضها، وما لم تستطع تقييمه لنقص البيانات. (7) التقرير تقدير مهني لا ضمان سعر، ولا يُلزم أي طرف ثالث. ';
  const ACQ_RULES = 'قواعد إلزامية لمذكرة البيع: (1) المستند موجّه لمشترٍ يريد تملّك الشركة كاملة أو حصة أغلبية، لا لمستثمر يشارك في جولة. ممنوع ذكر التقييم قبل الجولة أو الحصة المعروضة أو استخدام رأس المال أو أي لغة جمع تمويل أو سداد. (2) ممنوع منعاً باتاً ذكر أي سعر أو نطاق ثمن أو قيمة مطلوبة وممنوع ذكر أي مضاعف ربح أو مضاعف إيراد أو تقدير قيمة مرجعي أو نطاق تقييم مهما كان مسنوداً — أي رقم يدل على قيمة الشركة يُعد مخالفة جسيمة، والجملة الوحيدة المسموحة أن التقييم يُحدّد بدراسة مستقلة. (2ب) ممنوع اختراع أي معلومة غير واردة في البيانات: لا تفترض قطاعاً ولا نشاطاً ولا منتجات ولا مدينة؛ وإن كان الحقل غير مفهوم فلا تذكره أصلاً. — الرقم يخرج من التقييم المستقل في التفاوض لا من هذا المستند. (3) في theRequest اكتب ما يُطرح للتملّك وما ينتقل مع الصفقة: الحصص أو الأصول، والتراخيص، والعقود الجارية، والفريق، والملكية الفكرية، وما يبقى خارج الصفقة. (4) اعتمد الأداء التاريخي المحقق لا التوقّعات. (5) بيّن مدى اعتماد التشغيل على المؤسس وقابلية استمرار العمل بعد انتقال الملكية. (6) اذكر الالتزامات القائمة بشفافية مرة واحدة — العناية النافية ستكشفها. (7) ممنوع ذكر درجة الجاهزية أو أي تقييم داخلي للمنصة. (8) ممنوع أي وصف لا يُشتق من البيانات المعطاة: لا تدّع ملكية فكرية أو علامة تجارية أو عقوداً أو فريقاً مؤهلاً أو قلة اعتماد على المؤسس إلا إذا وردت صراحةً في البيانات؛ وإن لم ترد فاذكر أنها تُفصَّل في العناية النافية. (9) الدقة الحسابية إلزامية: إذا كان الهامش ثلاثين بالمئة فقل ثلاثين لا «يتجاوز ثلاثين». لا تصف أداء سنة واحدة بأنه على مدار السنوات. ';
  const INVEST_RULES = 'قواعد إلزامية لمسار الاستثمار: (1) ممنوع منعاً باتاً ذكر درجة الجاهزية أو أي تقييم داخلي للمنصة، وممنوع أي إشارة إلى نقص في الجاهزية أو الحوكمة أو التوثيق. (2) ممنوع لغة الإقراض بالكامل: لا سداد، ولا خدمة دين، ولا جدارة ائتمانية، ولا قدرة على السداد، ولا وصف المبلغ بأنه تمويل يُسترد — المستثمر يشتري حصة ولا يُسدَّد له. (3) في theRequest اذكر صراحةً الحصة المعروضة والتقييم قبل الجولة إن وردا في البيانات، مع أوجه استخدام رأس المال بالتفصيل. (4) ممنوع إدراج الوعي بالجاهزية أو الرغبة في التحسين أو أي إقرار بنقص ضمن نقاط القوة — نقاط القوة إنجازات محققة فقط. (5) الالتزامات تُذكر مرة واحدة كحقيقة عابرة: لا تُجعل عنواناً ولا أبرز ميزة، ولا تُحسب نسبتها إلى الإيراد. (6) صافي الربح إن وُجد هو الرقم الأبرز، وابدأ به الملخص التنفيذي. (7) ممنوع أي مقارنة بمعايير القطاع أو متوسطات السوق أو المنافسين — لا تملك مرجعاً لها. (8) ممنوع أي وصف لا يُشتق حسابياً من الأرقام المعطاة (مثل: خفيف الأصول، رائد، الأرسخ) — صف ما تثبته الأرقام فقط. (9) تحقّق من صحة كل جمع أو مضاعفة قبل كتابتها: الطاقة الإيرادية بعد التوسع = (الفروع الحالية + الجديدة) × إيراد الفرع، وصف المضاعفة بدقة (مثلاً ثلاثة أضعاف لا ضعفين) ولا تقرّبها. ';

  const prompt = (isIntl
    ? 'You are an expert preparing a professional ' + docType + ' at Holol Almurdi Financial Consulting (Murdi). Write the entire content in formal institutional ENGLISH. '
      + 'Address it to ' + targetAudience + '. Use the same 6-section JSON structure and rules described below, but write every section in professional English, no Arabic. '
      + 'Keep the exact same JSON keys. For companyNameEn/cityEn/sectorEn: translate ONLY if the Arabic value is a real, meaningful name; if a field is empty, numeric, or meaningless (e.g. 2, 222, a dash), copy it verbatim and never invent a substitute. Also provide companyNameEn (establishment name in English/transliteration), cityEn (English city e.g. Riyadh), sectorEn (English sector e.g. Trade).\\n\\n'
    : '')
    + 'أنت خبير في إعداد ' + docType + ' احترافي في حلول المرضي للاستشارات المالية (منصة مُرضي).\\n'
    + 'اكتب محتوى ' + docType + ' متكامل ومقنع موجّه إلى ' + targetAudience + '.\\n\\n'
    + 'بيانات الشركة والوضع المالي:\\n' + lines + pnBlock + '\\n\\n'
    + 'اكتب ٦ أقسام احترافية، كل قسم فقرات متماسكة (لا نقاط مختصرة):\\n'
    + '1. executiveSummary: ملخص تنفيذي موجز وقوي (٣-٤ أسطر).\\n'
    + '2. companyOverview: نبذة عن الشركة ونشاطها وموقعها (٤-٥ أسطر).\\n'
    + '3. financialPosition: تحليل الوضع المالي من الأرقام المتاحة، يبرز الجدارة (٤-٥ أسطر). لا تختلق أرقاما.\\n'
    + '4. ' + reqLine + ' (٤-٥ أسطر).\\n'
    + '5. strengths: نقاط القوة التي تبرّر القرار (٤-٥ أسطر سردية).\\n'
    + '6. closing: خاتمة مهنية تدعو للتواصل ودراسة الملف.\\n\\n'
    + 'ضوابط: لا تختلق أرقاماً، لا ضمانات، لا ذكر لأي ذكاء اصطناعي، أسلوب عربي مؤسسي، المحتوى منسوب لحلول المرضي.\\n\\n'
    + 'أرجع JSON نقي فقط بدون أي نص قبله أو بعده:\\n'
    + 'IMPORTANT: do not compare this client to other clients, no ranking claims, no invented facts beyond the figures given. '
    + (isIn ? IN_RULES : isNeg ? NEG_RULES : isVal ? VAL_RULES : isAcq ? ACQ_RULES : isInvestment ? INVEST_RULES : FUND_RULES)
    + ENTITY_RULE
    + ((isAcq || isVal || isNeg || isIn) ? '' : 'In theRequest you MUST state a concrete financing/investment ask: an explicit amount or a clear range derived from the client goal or, if absent, a defensible range tied to annual revenue, plus the specific use of funds and the repayment/return basis. Never leave the amount to be decided later. ')
    + '{"executiveSummary":"...","companyOverview":"...","financialPosition":"...","theRequest":"...","strengths":"...","closing":"..."}';

  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY as string,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model: MODEL, max_tokens: 8000, tools: [{ name: 'build_file', description: 'file content', input_schema: { type: 'object', properties: { executiveSummary: { type: 'string' }, companyOverview: { type: 'string' }, financialPosition: { type: 'string' }, theRequest: { type: 'string' }, strengths: { type: 'string' }, closing: { type: 'string' }, companyNameEn: { type: 'string' }, cityEn: { type: 'string' }, sectorEn: { type: 'string' } }, required: ['executiveSummary','companyOverview','financialPosition','theRequest','strengths','closing','companyNameEn','cityEn','sectorEn'] } }], tool_choice: { type: 'tool', name: 'build_file' }, messages: [{ role: 'user', content: prompt }] }),
  });

  if (!res.ok) throw new Error('تعذّر توليد الملف (HTTP ' + res.status + ')');

  const data = await res.json();
  const toolUse = (data.content || []).find((b: { type: string; input?: unknown }) => b.type === 'tool_use') as { input?: Record<string, unknown> } | undefined;
  if (!toolUse || !toolUse.input) throw new Error('no tool output stop=' + (data.stop_reason || '?'));
  const parsed = toolUse.input;
  return {
    executiveSummary: String(parsed.executiveSummary || '').trim(),
    companyOverview: String(parsed.companyOverview || '').trim(),
    financialPosition: String(parsed.financialPosition || '').trim(),
    theRequest: String(parsed.theRequest || '').trim(),
    strengths: String(parsed.strengths || '').trim(),
    closing: String(parsed.closing || '').trim(),
    companyNameEn: parsed.companyNameEn ? String(parsed.companyNameEn).trim() : undefined,
    cityEn: parsed.cityEn ? String(parsed.cityEn).trim() : undefined,
    sectorEn: parsed.sectorEn ? String(parsed.sectorEn).trim() : undefined,
  };
}

// ─── قالب الملف الاحترافي (HTML جاهز للطباعة/حفظ PDF) ───────────

const FIN_DICT: Record<string, string> = {
  'البند': 'Item', 'السنة الأولى (ريال)': 'Year 1 (SAR)', 'السنة الثانية (ريال)': 'Year 2 (SAR)',
  'الإيرادات': 'Revenue', 'تكلفة النشاط (البضاعة/الخدمة)': 'Cost of Sales', 'مجمل الربح': 'Gross Profit',
  'المصروفات التشغيلية': 'Operating Expenses', 'مصروف الإهلاك': 'Depreciation Expense',
  'الربح التشغيلي': 'Operating Profit', 'الزكاة': 'Zakat', 'صافي الربح': 'Net Profit',
  'النقد وما في حكمه (البنوك)': 'Cash and Cash Equivalents', 'الذمم المدينة (صافي)': 'Accounts Receivable (Net)',
  'مخصص الديون المشكوك فيها': 'Allowance for Doubtful Debts', 'المخزون': 'Inventory',
  'أعمال تحت التنفيذ': 'Work in Progress', 'أصول تشغيلية للنشاط': 'Operating Assets',
  'الأصول الثابتة (صافي)': 'Fixed Assets (Net)', 'إجمالي الأصول': 'Total Assets',
  'الذمم الدائنة (موردون)': 'Accounts Payable', 'القروض والتمويل': 'Loans and Financing',
  'دفعات مقدمة من العملاء': 'Customer Advances', 'إيراد مؤجل': 'Deferred Revenue',
  'ضريبة القيمة المضافة المستحقة': 'VAT Payable', 'الزكاة المستحقة': 'Zakat Payable',
  'مخصص نهاية الخدمة': 'End of Service Provision', 'إجمالي الالتزامات': 'Total Liabilities',
  'رأس المال': 'Capital', 'الأرباح المرحّلة (ختامية)': 'Retained Earnings (Closing)',
  'الأرباح المرحّلة — الختامية': 'Retained Earnings — Closing', 'الأرباح المرحّلة — الافتتاحية': 'Retained Earnings — Opening',
  'حساب المالك الجاري': "Owner's Current Account", 'حساب المالك الجاري (دائن)': "Owner's Current Account (Credit)",
  'حساب المالك الجاري (مدين)': "Owner's Current Account (Debit)", 'حركة حساب المالك الجاري': "Movement in Owner's Current Account",
  'إجمالي حقوق الملكية': 'Total Equity', 'إجمالي الالتزامات وحقوق الملكية': 'Total Liabilities and Equity',
  '(+) الإهلاك (غير نقدي)': '(+) Depreciation (Non-Cash)', '(+) صافي ربح السنة': '(+) Net Profit for the Year',
  '(−) التوزيعات': '(−) Distributions', 'التوزيعات/المسحوبات': 'Distributions / Drawings',
  'التغيّر في الذمم المدينة': 'Change in Accounts Receivable', 'التغيّر في المخزون': 'Change in Inventory',
  'التغيّر في الذمم الدائنة': 'Change in Accounts Payable', 'التغيّر في أعمال تحت التنفيذ': 'Change in Work in Progress',
  'التغيّر في الدفعات المقدمة': 'Change in Customer Advances', 'التغيّر في الإيراد المؤجل': 'Change in Deferred Revenue',
  'التغيّر في ضريبة القيمة المضافة': 'Change in VAT', 'التغيّر في الزكاة المستحقة': 'Change in Zakat Payable',
  'التغيّر في مخصص نهاية الخدمة': 'Change in End of Service Provision',
  'التغيّر في أصول النشاط التشغيلية': 'Change in Operating Assets', 'التغيّر في القروض والتمويل': 'Change in Loans and Financing',
  'صافي النقد من التشغيل': 'Net Cash from Operations', 'صافي الحركة في الأصول الثابتة': 'Net Movement in Fixed Assets',
  'صافي النقد من الاستثمار': 'Net Cash from Investing', 'صافي النقد من التمويل': 'Net Cash from Financing',
  'صافي التغيّر في النقد': 'Net Change in Cash', 'النقد الافتتاحي': 'Opening Cash',
  'النقد الختامي (محسوب)': 'Closing Cash (Computed)', 'النقد الختامي بالدفاتر': 'Closing Cash per Books',
  'فرق للمطابقة': 'Reconciliation Difference',
  'الأنشطة التشغيلية': 'Operating Activities',
  'الأنشطة الاستثمارية': 'Investing Activities',
  'الأنشطة التمويلية': 'Financing Activities',
  'مطابقة النقد': 'Cash Reconciliation',
};

export function extractStatementTables(raw: string, toEnglish: boolean): string {
  if (!raw) return '';
  const tables = raw.match(/<table[\s\S]*?<\/table>/g);
  if (!tables || tables.length === 0) return '';
  let html = tables.join('');
  if (toEnglish) {
    for (const [ar, en] of Object.entries(FIN_DICT)) {
      html = html.split('>' + ar + '<').join('>' + en + '<');
    }
    html = html.replace(/dir="rtl"/g, 'dir="ltr"').replace(/text-align:right/g, 'text-align:left');
  }
  return html;
}

export function buildFileHTML(
  client: FileClientData,
  content: GeneratedFile,
  track: 'funding' | 'investment' | 'acquisition' | 'valuation' | 'negotiation' | 'intake',
  region?: string,
  statementsRaw?: string
): string {
  const isInDoc = track === 'intake';
  const isNegDoc = track === 'negotiation';
  const isValDoc = track === 'valuation';
  const isAcqDoc = track === 'acquisition';
  const isInv = track === 'investment';
  const intl = (region || '').includes('دولي') || (region || '').toLowerCase().includes('intl');
  const cAny = content as unknown as Record<string, unknown>;
  const nameOut = intl && cAny.companyNameEn ? String(cAny.companyNameEn) : client.companyName;
  const cityOut = intl && cAny.cityEn ? String(cAny.cityEn) : (client.city || '');
  const sectorOut = intl && cAny.sectorEn ? String(cAny.sectorEn) : (client.sector || '');
  const dirAttr = intl ? 'ltr' : 'rtl';
  const langAttr = intl ? 'en' : 'ar';
  const title = intl
    ? (isInDoc ? 'Document & Question Checklist' : isNegDoc ? 'Negotiation Position (Confidential)' : isValDoc ? 'Independent Valuation' : isAcqDoc ? 'Sale Memorandum' : isInv ? 'Investment Offering' : 'Financing Proposal')
    : (isInDoc ? 'قائمة المستندات والأسئلة' : isNegDoc ? 'ورقة الموقف التفاوضي — سرّية' : isValDoc ? 'تقرير التقييم المستقل' : isAcqDoc ? 'مذكرة بيع' : isInv ? 'ملف العرض الاستثماري' : 'الملف التمويلي');
  const L0 = intl
    ? { exec: 'Executive Summary', company: 'Company Overview', fin: 'Financial Position', req: isAcqDoc ? 'What Is Offered for Acquisition' : isInv ? 'The Investment Offer' : 'The Financing Request', strengths: 'Key Strengths', closing: 'Closing', sector: 'Sector', city: 'City', cr: 'CR Number', score: 'Amount Requested (SAR)', brand: 'HOLOL ALMURDI FINANCIAL CONSULTING' }
    : { exec: 'الملخص التنفيذي', company: 'نبذة عن الشركة', fin: 'الوضع المالي', req: isAcqDoc ? 'ما يُطرح للتملّك' : isInv ? 'العرض الاستثماري' : 'طلب التمويل', strengths: 'نقاط القوة', closing: 'الخاتمة', sector: 'القطاع', city: 'المدينة', cr: 'السجل التجاري', score: 'المبلغ المطلوب (ر.س)', brand: 'حلول المرضي للاستشارات المالية' };
  const L = isInDoc ? { ...L0, exec: 'لماذا هذه القائمة', company: 'مستندات الكيان والتراخيص', fin: 'المستندات المالية', req: 'العقود والعملاء والفريق', strengths: 'أسئلة عن المشتري والصفقة', closing: 'أسئلة عن أهدافك' } : isNegDoc ? { ...L0, exec: 'ملخّص الموقف', company: 'نقاط القوة وترتيب طرحها', fin: 'نقاط الضعف والرد عليها', req: 'هيكل الصفقة المقترح', strengths: 'اعتراضات متوقعة وردودها', closing: 'ما لا يُقال في الجلسة' } : isValDoc ? { ...L0, exec: 'الخلاصة والنطاق التقديري', company: 'المنهجية المتبعة', fin: 'الحساب والزوايا الثلاث', req: 'النطاق السعري والحد الأدنى', strengths: 'عوامل ترفع القيمة', closing: 'عوامل تخفض القيمة والتحفظات' } : L0;
  const ink = '#1A3D34', gold = '#C9A84C', green = '#2E9E7B', gray = '#6B8A80';
  const today = new Date().toLocaleDateString(intl ? 'en-GB' : 'ar-SA', { year: 'numeric', month: 'long', day: 'numeric' });

  const section = (t: string, body: string) =>
    '<div class="sec"><h2>' + t + '</h2><p>' + String(body).replace(/\\n/g, '<br>') + '</p></div>';

  const facts: ([string, string] | null)[] = [
    sectorOut ? [L.sector, sectorOut] as [string, string] : null,
    cityOut ? [L.city, cityOut] as [string, string] : null,
    client.crNumber ? [L.cr, client.crNumber] as [string, string] : null,
    (!isAcqDoc && !isValDoc && !isNegDoc && !isInDoc && client.fundingAmount) ? [L.score, Number(client.fundingAmount).toLocaleString('en-US')] as [string, string] : null,
  ].filter(Boolean);

  const factsHTML = (facts.filter(Boolean) as [string, string][]).map(f => '<div class="fact"><span>' + f[0] + '</span><b>' + f[1] + '</b></div>').join('');

  return '<!DOCTYPE html><html dir="' + dirAttr + '" lang="' + langAttr + '"><head><meta charset="utf-8">'
    + '<title>' + title + ' — ' + nameOut + '</title>'
    + '<style>'
    + '@import url("https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap");'
    + '*{margin:0;padding:0;box-sizing:border-box;font-family:Cairo,Arial,sans-serif}'
    + 'body{color:#2A2A2A;line-height:1.9;background:#fff}'
    + '.page{max-width:800px;margin:0 auto;padding:0}'
    + '.cover{background:linear-gradient(135deg,' + ink + ' 0%,#14302a 100%);color:#fff;padding:90px 60px;text-align:center;page-break-after:always}'
    + '.cover .brand{color:' + gold + ';font-size:15px;font-weight:900;letter-spacing:2px;margin-bottom:40px}'
    + '.cover h1{font-size:42px;font-weight:900;margin-bottom:14px}'
    + '.cover .company{font-size:24px;color:' + gold + ';font-weight:700;margin-bottom:50px}'
    + '.cover .date{font-size:14px;opacity:0.8}'
    + '.cover .line{width:70px;height:4px;background:' + gold + ';margin:30px auto;border-radius:2px}'
    + '.content{padding:50px 60px}'
    + '.facts{display:flex;flex-wrap:wrap;gap:14px;margin-bottom:40px;padding-bottom:30px;border-bottom:2px solid #EEE}'
    + '.fact{background:#F0F5F3;border-radius:12px;padding:12px 20px;flex:1;min-width:130px}'
    + '.fact span{display:block;color:' + gray + ';font-size:12px;font-weight:700;margin-bottom:4px}'
    + '.fact b{color:' + ink + ';font-size:17px;font-weight:900}'
    + '.sec{margin-bottom:34px}'
    + '.sec h2{color:' + ink + ';font-size:20px;font-weight:900;margin-bottom:12px;padding-right:16px;border-right:5px solid ' + gold + '}'
    + '.sec p{color:#3A3A3A;font-size:15px;text-align:justify}'
    + '.footer{margin-top:50px;padding-top:24px;border-top:2px solid #EEE;text-align:center;color:' + gray + ';font-size:13px}'
    + '.footer b{color:' + ink + '}'
    + '@media print{.cover{padding:120px 60px}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}'
    + '</style></head><body><div class="page">'
    + '<div class="cover"><div class="brand">' + L.brand + '</div>'
    + '<div class="line"></div>'
    + '<h1>' + title + '</h1>'
    + '<div class="company">' + nameOut + '</div>'
    + '<div class="date">' + today + '</div></div>'
    + '<div class="content">'
    + (factsHTML ? '<div class="facts">' + factsHTML + '</div>' : '')
    + section(L.exec, content.executiveSummary)
    + section(L.company, content.companyOverview)
    + section(L.fin, content.financialPosition)
    + section(L.req, content.theRequest)
    + section(L.strengths, content.strengths)
    + section(L.closing, content.closing)
    + (() => { const t = extractStatementTables(statementsRaw || '', intl); return t ? '<div class="sec"><h2>' + (intl ? 'Financial Statements' : 'القوائم المالية') + '</h2>' + t + '</div>' : ''; })()
    + '<div class="footer"><b>' + L.brand + '</b><br>'
    + (intl ? 'Prepared by Holol Almurdi Financial Consulting per the methodology of Dr. Abdulhakim Almurdi. All rights reserved.</div>' : 'أُعدّ هذا الملف وفق منهجية د. عبدالحكيم المرضي — جميع الحقوق محفوظة</div>')
    + '</div></div></body></html>';
}
