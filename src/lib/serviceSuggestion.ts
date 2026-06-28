// منطق اقتراح خدمة مُرضي الأنسب لكل عميل بناءً على وضعه المالي والمسار
type Track = 'funding' | 'investment' | 'ipo';

// خريطة الخدمات: لكل خدمة تعريفها الدقيق + ما يجب أن تُخرجه + المسارات التي تخدمها
// tracks فارغة = خدمة أساسية تصلح لأي مسار قيّمه العميل
export interface ServiceDef { definition: string; output: string; tracks: Track[]; }

export const SERVICES: Record<string, ServiceDef> = {
  'إعداد القوائم المالية المعتمدة': {
    definition: 'إعداد مجموعة القوائم المالية (المركز المالي، الدخل، التدفقات النقدية، التغيرات في حقوق الملكية، الإيضاحات) وفق المعايير المحاسبية السعودية، تمهيداً لاعتمادها من محاسب مرخّص.',
    output: 'وثيقة تحدد نطاق القوائم المطلوبة، هيكل كل قائمة مبنياً على أرقام الشركة الفعلية، وخطة اعتمادها من محاسب SOCPA.',
    tracks: [],
  },
  'بناء الحوكمة المؤسسية': {
    definition: 'تأسيس إطار حوكمة متناسب مع حجم الشركة: مجلس إدارة، لجان، فصل الملكية عن الإدارة، لوائح ومحاضر.',
    output: 'خطة حوكمة متدرّجة: هيكل المجلس واللجان، اللوائح المطلوبة، وجدول تنفيذ زمني مبني على وضع الشركة.',
    tracks: [],
  },
  'التقييم العادل المعمّق': {
    definition: 'تقدير القيمة السوقية العادلة للشركة (كم تساوي بالريال) بمنهجية مضاعفات الربح/الإيراد حسب القطاع والنمو — لا علاقة لها بجاهزية التمويل أو القروض.',
    output: 'تقدير نطاق قيمة الشركة بالريال (حد أدنى وأعلى)، الأساس والمضاعف المستخدم، العوامل الرافعة والخافضة للقيمة، وكيف يُعرض على المستثمر أو يُستخدم في تسعير الطرح. المخرج الأساسي رقم القيمة.',
    tracks: ['investment', 'ipo'],
  },
  'إعادة الهيكلة المالية ومعالجة التعثّر': {
    definition: 'إعادة جدولة الديون، وقف النزيف النقدي، واستعادة انتظام السداد للشركات المتعثّرة.',
    output: 'خطة تعافٍ: جدولة الديون، ضبط المصروفات، تحسين التدفق النقدي، مبنية على أرقام الشركة.',
    tracks: [],
  },
  'تجهيز ملف التمويل والتفاوض': {
    definition: 'إعداد الملف التمويلي الذي يُقدَّم للبنوك وجهات التمويل، ومرافقة التفاوض حتى الحصول على التمويل.',
    output: 'مسوّدة ملف تمويلي متكامل جاهز للعرض على جهات التمويل، يتضمّن: ملخص الشركة وغرض التمويل بالأرقام، نقاط القوة التفاوضية، تحليل القدرة على السداد، وقائمة مرتّبة بالمستندات المطلوبة مقسّمة إلى مستندات داخلية (القوائم المالية، خطة السداد، دراسة الجدوى إن وُجدت) ومستندات خارجية يجهّزها العميل (كشف حساب بنكي، شهادة الزكاة والضريبة، السجل التجاري والرخص، عقود وفواتير داعمة). مع توضيح ما ينقص العميل تحديداً.',
    tracks: ['funding'],
  },
  'إعادة جدولة الديون': {
    definition: 'إعادة ترتيب الالتزامات القائمة لتخفيف الضغط النقدي وتحسين القدرة على السداد.',
    output: 'خطة إعادة جدولة: تحليل الالتزامات الحالية، السيناريو المقترح، وأثره على التدفق النقدي.',
    tracks: ['funding'],
  },
  'تجهيز ملف عرض المستثمر والتفاوض': {
    definition: 'بناء ملف العرض (Pitch) الذي يُبرز قيمة الشركة للمستثمر المؤسسي، ومرافقة التفاوض حتى إتمام الصفقة.',
    output: 'مسوّدة عرض تقديمي للمستثمر (Pitch Deck) منظّمة كشرائح جاهزة للتطوير، تتضمّن: المشكلة والفرصة، الحل ونموذج العمل، حجم السوق، الإنجازات والأرقام المحورية، الميزة التنافسية، الفريق، المبلغ المطلوب وأوجه استخدامه، والتوقّعات المالية — كلها مبنية على أرقام الشركة الفعلية وقصة قيمتها، مع نقاط التفاوض الرئيسية.',
    tracks: ['investment'],
  },
  'بناء خطة جذب المستثمر': {
    definition: 'خطة عملية ترفع جاذبية الشركة وتجهّزها للعرض على الجهات الاستثمارية.',
    output: 'خطة جذب: الفجوات التي تخفض الجاذبية، الإجراءات الرافعة لها، مبنية على أرقام الشركة.',
    tracks: ['investment'],
  },
  'تجهيز ملف هيئة السوق المالية': {
    definition: 'خدمة استشارية ترافقك في رحلة التهيؤ للإدراج: تحديد المتطلبات النظامية لهيئة السوق المالية، تجهيز ملف الشركة، والتنسيق مع مستشار مالي مرخّص من الهيئة يتولّى الإجراءات الخاضعة للترخيص — مع مرافقتك في التفاوض والمتابعة.',
    output: 'خطة تهيؤ للإدراج: المتطلبات النظامية، الفجوات الحالية، خطوات التجهيز، والتنسيق مع المستشار المرخّص الأنسب لحالتك.',
    tracks: ['ipo'],
  },
  'تشكيل لجنة المراجعة والحوكمة': {
    definition: 'تأسيس اللجان والهياكل التي يتطلبها الإدراج وضمان توافقها مع لوائح الهيئة.',
    output: 'خطة تشكيل اللجان: التكوين المطلوب، الاختصاصات، وجدول التنفيذ للإدراج.',
    tracks: ['ipo'],
  },
  'خارطة طريق الإدراج': {
    definition: 'خطة تنفيذية مرحلية بالمدد والمتطلبات تقود الشركة من وضعها الحالي حتى الإدراج.',
    output: 'خارطة طريق زمنية للإدراج: المراحل، المتطلبات لكل مرحلة، والمدد التقديرية.',
    tracks: ['ipo'],
  },
};

// أسماء المسارات بالعربية للتنبيهات
export const TRACK_LABEL: Record<Track, string> = { funding: 'التمويل', investment: 'الاستثمار', ipo: 'الطرح' };

interface SuggestInput {
  repayment_status?: unknown;
  debt_status?: unknown;
  has_financial_statements?: unknown;
  audited_statements?: unknown;
  has_governance?: unknown;
  has_debt?: unknown;
  [key: string]: unknown;
}

// urgency: 'required' = ضروري قبل التقديم | 'recommended' = يقوّي فرصه | 'none' = ملف سليم، قدّمه مباشرة
interface ServiceSuggestion { service: string; icon: string; why: string; urgency: 'required' | 'recommended' | 'none'; }

export function suggestService(fd: SuggestInput, track: Track, score: number): ServiceSuggestion {
  const isDefaulted = fd?.repayment_status === 'default' || fd?.debt_status === 'late';
  // نميّز "نعرف أنها ناقصة" (false صريح) عن "لا نعرف" (null/غير مذكور) — عند الشك لا نُرهق العميل
  const stmtKnown = fd?.has_financial_statements !== undefined && fd?.has_financial_statements !== null;
  const audKnown = fd?.audited_statements !== undefined && fd?.audited_statements !== null;
  const noStatements = (stmtKnown || audKnown) && fd?.has_financial_statements !== true && fd?.audited_statements !== true;
  const govKnown = fd?.has_governance !== undefined && fd?.has_governance !== null;
  const noGovernance = govKnown && fd?.has_governance !== true;
  const hasDebt = fd?.has_debt === true;
  const qualified = score >= (track === 'ipo' ? 65 : 70);

  // ===== حالات ضرورية (يحتاج إصلاح قبل التقديم) =====
  if (isDefaulted) {
    return { urgency: 'required', icon: '🔧', service: 'إعادة الهيكلة المالية ومعالجة التعثّر', why: 'الشركة متعثّرة في السداد — لا يمكن التقديم لأي جهة قبل معالجة التعثّر. هذه أول خدمة ضرورية.' };
  }
  if (noStatements && (track === 'investment' || track === 'ipo')) {
    return { urgency: 'required', icon: '📊', service: 'إعداد القوائم المالية المعتمدة', why: 'لا توجد قوائم مالية معتمدة — وهي شرط أساسي للمستثمر والجهات الرقابية. ضرورية قبل التقديم.' };
  }
  if (noGovernance && track === 'ipo') {
    return { urgency: 'required', icon: '🏛️', service: 'بناء الحوكمة المؤسسية', why: 'لا يوجد نظام حوكمة — وهو شرط تشترطه هيئة السوق المالية للطرح. ضروري قبل التقدّم للإدراج.' };
  }

  // ===== ملف سليم + مؤهّل: قدّمه مباشرة، لا تُرهق العميل =====
  if (qualified && !hasDebt && !noStatements && !noGovernance) {
    const direct: Record<Track, string> = {
      funding: 'ملف الشركة سليم ومؤهّل للتمويل — قدّمه مباشرة للجهات التي رشّحها البحث، دون الحاجة لأي خدمة تجهيز. وفّر على العميل.',
      investment: 'ملف الشركة سليم وجاذب للمستثمر — قدّمه مباشرة للجهات المرشّحة، دون الحاجة لخدمة تجهيز. وفّر على العميل.',
      ipo: 'ملف الشركة سليم ومؤهّل للطرح — يمكن البدء برحلة الإدراج مع المستشار المرخّص مباشرة.',
    };
    return { urgency: 'none', icon: '✅', service: 'قدّمه مباشرة — لا حاجة لخدمة تجهيز', why: direct[track] };
  }

  // ===== موصى به (يقوّي فرصه، اختياري) =====
  if (noStatements && track === 'funding') {
    return { urgency: 'recommended', icon: '📊', service: 'إعداد القوائم المالية المعتمدة', why: 'بعض منتجات التمويل لا تشترط قوائم مدققة (نقاط بيع، كشف حساب). لكن إعدادها يفتح خيارات أوسع وبشروط أفضل — اعرضها إن رغب العميل.' };
  }
  if (hasDebt && !qualified) {
    return { urgency: 'recommended', icon: '🗓️', service: 'إعادة جدولة الديون', why: 'لدى الشركة ديون تضغط على وضعها — إعادة الجدولة تخفّف العبء وترفع فرص القبول. خدمة تقوّي ملفه.' };
  }
  if (noGovernance && track === 'investment') {
    return { urgency: 'recommended', icon: '🏛️', service: 'بناء الحوكمة المؤسسية', why: 'نظام الحوكمة يطمئن المستثمر ويرفع التقييم. ليست شرطاً إلزامياً لكنها تقوّي العرض كثيراً.' };
  }

  // ===== غير المؤهّل في الاستثمار: خطة جذب المستثمر ترفع جاذبيته =====
  if (!qualified && track === 'investment') {
    return { urgency: 'recommended', icon: '🎯', service: 'بناء خطة جذب المستثمر', why: 'درجة جاذبيتك للمستثمر لم تبلغ العتبة بعد. خطة جذب المستثمر تعالج الفجوات التي تخفض جاذبيتك وتجهّز شركتك للعرض — الخطوة الأنسب قبل تجهيز ملف العرض.' };
  }

  // ===== غير المؤهّل بلا عائق واضح: لا نرشّح خدمة تجهيز (لا نَعِد بما لا يناسب وضعه) =====
  if (!qualified) {
    const wait: Record<Track, string> = {
      funding: 'درجة جاهزيتك للتمويل لم تبلغ العتبة بعد. راجع العوائق وخطة التحسين أعلاه — وعند ارتفاع جاهزيتك تنفتح لك خيارات أقوى. فريق مُرضي جاهز لمرافقتك متى احتجت.',
      investment: 'درجة جاذبيتك للمستثمر لم تبلغ العتبة بعد. ركّز على معالجة العوائق أعلاه أولاً — وعند جاهزيتك يرافقك فريق مُرضي في تجهيز العرض.',
      ipo: 'شركتك تحتاج تهيؤاً قبل الطرح. ركّز على معالجة العوائق أعلاه — وعند بلوغك مستوى الجاهزية يرافقك فريق مُرضي في رحلة الإدراج.',
    };
    return { urgency: 'none', icon: '🧭', service: 'ركّز على رفع جاهزيتك أولاً', why: wait[track] };
  }

  // ===== المؤهل في مساره: خدمة تجهيز احترافية (تقوّي، اختيارية) =====
  if (track === 'funding') {
    return { urgency: 'recommended', icon: '🏦', service: 'تجهيز ملف التمويل والتفاوض', why: 'الشركة مؤهّلة. تجهيز الملف احترافياً والتفاوض نيابةً عنها يرفع فرص القبول وبشروط أفضل — خدمة بعمولة نجاح عند صدور الموافقة.' };
  }
  if (track === 'investment') {
    return { urgency: 'recommended', icon: '📈', service: 'تجهيز ملف عرض المستثمر والتفاوض', why: 'الشركة جاذبة. تجهيز ملف العرض والتفاوض نيابةً عنها يرفع فرص الصفقة وبتقييم أفضل — خدمة بعمولة نجاح عند إتمام الاستثمار.' };
  }
  return { urgency: 'recommended', icon: '📁', service: 'تجهيز ملف هيئة السوق المالية', why: 'الشركة في طريقها للطرح. نرافقك استشارياً في التهيؤ للإدراج وننسّق لك مع مستشار مالي مرخّص من الهيئة يتولّى الإجراءات الخاضعة للترخيص — خدمة عالية القيمة.' };
}

export function suggestionBox(s: ServiceSuggestion): string {
  const theme = s.urgency === 'required'
    ? { bg: '#FBECEC', border: '#C0564B', label: '🔴 خدمة ضرورية قبل التقديم', labelColor: '#A33' }
    : s.urgency === 'none'
    ? { bg: '#EAF7F0', border: '#2E9E7B', label: '✅ لا حاجة لخدمة — قدّمه مباشرة', labelColor: '#1E7A5A' }
    : { bg: '#FBF5E8', border: '#C9A84C', label: '💡 خدمة موصى بها (تقوّي فرصه)', labelColor: '#9A7B2E' };
  return '<div style="background:' + theme.bg + ';border:2px solid ' + theme.border + ';border-radius:12px;padding:16px 18px;margin:14px 0">'
    + '<div style="color:' + theme.labelColor + ';font-size:14px;font-weight:900;margin-bottom:6px">' + theme.label + '</div>'
    + '<div style="color:#1A3D34;font-size:15px;font-weight:900;margin-bottom:6px">' + s.icon + ' ' + s.service + '</div>'
    + '<div style="color:#5C4A1F;font-size:13.5px;line-height:1.8">' + s.why + '</div>'
    + '</div>';
}

// ════════════════════════════════════════════════════════════════
// suggestAllServices — ترجّع كل الخدمات التي يحتاجها العميل (مرتّبة بالأولوية)
// تستخدم لزر "قدّم لكل ما تحتاجه دفعة واحدة" لغير المؤهل
// لا تمسّ suggestService الأصلية — منطق مستقل يجمع كل العوائق
// ════════════════════════════════════════════════════════════════
export function suggestAllServices(fd: SuggestInput, track: Track, score: number): ServiceSuggestion[] {
  const out: ServiceSuggestion[] = [];
  const seen = new Set<string>();
  const add = (s: ServiceSuggestion) => { if (!seen.has(s.service)) { seen.add(s.service); out.push(s); } };

  const isDefaulted = fd?.repayment_status === 'default' || fd?.debt_status === 'late';
  const stmtKnown = fd?.has_financial_statements !== undefined && fd?.has_financial_statements !== null;
  const audKnown = fd?.audited_statements !== undefined && fd?.audited_statements !== null;
  const noStatements = (stmtKnown || audKnown) && fd?.has_financial_statements !== true && fd?.audited_statements !== true;
  const govKnown = fd?.has_governance !== undefined && fd?.has_governance !== null;
  const noGovernance = govKnown && fd?.has_governance !== true;
  const hasDebt = fd?.has_debt === true;
  const qualified = score >= (track === 'ipo' ? 65 : 70);

  // ١) التعثّر — أول وأهم عائق (ضروري)
  if (isDefaulted) {
    add({ urgency: 'required', icon: '🔧', service: 'إعادة الهيكلة المالية ومعالجة التعثّر', why: 'الشركة متعثّرة في السداد — معالجة التعثّر أول خطوة ضرورية قبل أي تقديم.' });
  }

  // ٢) غياب القوائم المالية (ضروري للاستثمار/الطرح، يقوّي للتمويل)
  if (noStatements) {
    const req = (track === 'investment' || track === 'ipo');
    add({ urgency: req ? 'required' : 'recommended', icon: '📊', service: 'إعداد القوائم المالية المعتمدة', why: req ? 'لا توجد قوائم مالية معتمدة — وهي شرط أساسي للمستثمر والجهات الرقابية.' : 'إعداد القوائم يفتح خيارات تمويل أوسع وبشروط أفضل.' });
  }

  // ٣) غياب الحوكمة (ضروري للطرح، يقوّي للاستثمار)
  if (noGovernance && (track === 'ipo' || track === 'investment')) {
    const req = track === 'ipo';
    add({ urgency: req ? 'required' : 'recommended', icon: '🏛️', service: 'بناء الحوكمة المؤسسية', why: req ? 'لا يوجد نظام حوكمة — شرط تشترطه هيئة السوق المالية للطرح.' : 'نظام الحوكمة يطمئن المستثمر ويرفع التقييم.' });
  }

  // ٤) الديون (جدولة — تقوّي)
  if (hasDebt) {
    add({ urgency: 'recommended', icon: '🗓️', service: 'إعادة جدولة الديون', why: 'إعادة جدولة الديون تخفّف الضغط النقدي وترفع فرص القبول.' });
  }

  // ٥) خطة جذب المستثمر (للاستثمار غير المؤهل)
  if (!qualified && track === 'investment') {
    add({ urgency: 'recommended', icon: '🎯', service: 'بناء خطة جذب المستثمر', why: 'خطة الجذب تعالج الفجوات التي تخفض جاذبيتك وتجهّز شركتك للعرض.' });
  }

  return out;
}
