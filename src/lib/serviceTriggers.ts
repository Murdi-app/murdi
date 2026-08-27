// لماذا هذه الخدمة لك أنت — طبقة الدليل.
// المبدأ: لا نعرض خدمة، بل نُري العميل ما ظهر في ملفه ثم نسمّي ما يسدّه.
// «٢١ جهة من أصل ٤٠ تشترط قوائم مدققة» تبيع أكثر من أي وصف تسويقي،
// لأنها ليست عرضاً بل نتيجة قياس على بياناته هو.

export interface ClientSignals {
  // من ملف المنشأة
  foreignOwner?: boolean;
  ownerNationality?: string;
  hasParentCompany?: boolean;

  // من التقييم أو البيانات المالية
  hasStatements?: boolean;
  hasCollateral?: boolean;
  hasDebt?: boolean;
  annualInstalment?: number;
  annualRevenue?: number;
  imports?: boolean;
  sellsToLargeBuyers?: boolean;
  collectionDays?: number;
  governanceReady?: boolean;

  // من نية العميل
  intent?: 'funding' | 'investor' | 'sell' | 'listing';
  projectKind?: 'new' | 'expansion' | 'none';

  // من نتائج المطابقة — الدليل الأقوى لأنه من السوق لا منّا
  totalFunders?: number;
  gapCounts?: Record<string, number>;   // مثال: { 'قوائم مالية مدققة': 21, 'ضمان': 25 }
}

export interface ServiceReason {
  service: string;
  urgency: 'blocking' | 'strong' | 'fit';   // يمنع التقديم · دليل قوي · مناسب لحالته
  evidence: string;                          // الجملة التي تظهر للعميل
  hook?: string;                             // قبل المطابقة: السؤال الذي لا تجيبه إلا المطابقة
}

// موجتا الدليل:
//   pre  = بعد التقييم المجاني مباشرة — دليل من إجابات العميل نفسه، بلا أرقام سوق
//   post = بعد المطابقة — نفس العائق وقد صار عدداً من السوق: «21 جهة من أصل 40»
// الأولى تخلق السؤال، والثانية وحدها تجيبه — وهذا ما يبيع فتح المطابقة.
export type EvidencePhase = 'pre' | 'post';

const pct = (n: number, of: number) => of > 0 ? Math.round((n / of) * 100) : 0;

// يبحث في عدّادات الفجوات عن كلمة، ويجمع ما يطابقها
function gapHits(g: Record<string, number> | undefined, words: string[]): number {
  if (!g) return 0;
  let n = 0;
  for (const [k, v] of Object.entries(g)) if (words.some(w => k.includes(w))) n += v;
  return n;
}

export function reasonsFor(s: ClientSignals, phase: EvidencePhase = 'post'): ServiceReason[] {
  const out: ServiceReason[] = [];
  const total = phase === 'pre' ? 0 : (s.totalFunders || 0);
  const add = (service: string, urgency: ServiceReason['urgency'], evidence: string, hook?: string) =>
    out.push({ service, urgency, evidence, ...(phase === 'pre' && hook ? { hook } : {}) });
  const ofList = (n: number) => total > 0 ? n + ' جهة من أصل ' + total + ' في قائمتك (' + pct(n, total) + '%)' : n + ' جهة في قائمتك';

  // ═══ الدليل الأقوى: فجوات الجهات نفسها ═══
  const gStatements = gapHits(s.gapCounts, ['قوائم مالية', 'قوائم مدققة', 'مالية مدققة']);
  if (gStatements > 0 || s.hasStatements === false) {
    add('إعداد القوائم المالية المعتمدة', gStatements > 0 ? 'blocking' : 'strong',
      gStatements > 0
        ? ofList(gStatements) + ' تشترط قوائم مالية. بلا هذي الخطوة يتوقف ملفك عندها قبل أن يُقرأ.'
        : 'ملفك بلا قوائم مالية منظّمة — وهذا أكثر شرط يتكرر عند جهات التمويل.',
      'افتح المطابقة لتعرف كم جهة من جهاتك تشترطها بالضبط.');
  }

  const gCollateral = gapHits(s.gapCounts, ['ضمان', 'رهن', 'كفالة عينية', 'أصول']);
  if (gCollateral > 0 || s.hasCollateral === false) {
    add('تجهيز ملف الضمانات والرهن', gCollateral > 0 ? 'blocking' : 'strong',
      gCollateral > 0
        ? ofList(gCollateral) + ' تطلب ضماناً. وأغلب من يتوقف هنا يملك ضماناً مقبولاً ولا يعرف أنه مقبول.'
        : 'لم تُسجَّل لديك أصول قابلة للضمان — وهذا أكثر ما يوقف الملفات الجيدة.',
      'افتح المطابقة لتعرف كم جهة تطلب ضماناً وأي نوع تقبله كل واحدة.');
  }

  // ═══ الممر الأجنبي: تُفتح بملكيته لا بطلبه ═══
  if (s.foreignOwner) {
    add('ملف الممر الأجنبي', 'strong',
      'منشأتك مملوكة لمستثمر' + (s.ownerNationality ? ' من ' + s.ownerNationality : ' أجنبي')
      + '، والجهات السعودية تتعامل مع هذا الملف بحذر. مسارك مختلف: بنوك بلد المالك وفروعها الخليجية، والفروع الأجنبية المرخّصة في المملكة.',
      'افتح المطابقة لترى أبواب ممرك مفتوحةً بالأسماء — ولن نعرض عليك برنامجاً حكومياً لا تنطبق شروط ملكيته عليك.');
    if (s.hasParentCompany) {
      add('ملف ضمان الشركة الأم', 'strong',
        'لديك شركة أم قادرة على الضمان — وهي أقوى ورقة في ملفك، وأكثرها إهمالاً. وضعها داخل الملف يغيّر قراءته كلها.');
    }
  }

  // ═══ الاستيراد ═══
  if (s.imports) {
    add('تجهيز ملف تسهيل الاعتمادات المستندية', 'strong',
      'أنت تستورد وتدفع لمورّديك مقدماً — فرأس مالك محبوس في بضاعة في الطريق. الاعتماد يحرّره بلا دين جديد، لأن البنك يضمن ولا يُقرض.');
  }

  // ═══ الذمم: يبيع آجلاً لشركات ═══
  if (s.sellsToLargeBuyers || (s.collectionDays || 0) >= 60) {
    add('تنظيم دورة الفوترة وملف الذمم', 'strong',
      (s.collectionDays ? 'دورة تحصيلك ' + s.collectionDays + ' يوماً' : 'تبيع آجلاً لشركات كبرى')
      + ' — أي أن جزءاً من مالك عند عملائك في كل لحظة. ذممك يمكن أن تتحول إلى سيولة اليوم بلا رهن.');
  }

  // ═══ ثقل الدين: أخطر إشارة، وتُقاس لا تُقدَّر ═══
  const inst = s.annualInstalment || 0, rev = s.annualRevenue || 0;
  if (s.hasDebt && inst > 0 && rev > 0) {
    const burden = pct(inst, rev);
    if (burden >= 25) {
      add('إعادة هيكلة الالتزامات ومعالجة التعثّر', 'blocking',
        'أقساطك السنوية تعادل ' + burden + '% من إيرادك — وهذا مستوى يُقلق أي ممول جديد ويسبق التعثّر عادةً. المبادرة قبل التعثّر تفتح خيارات تُغلق بعده.');
    } else if (burden >= 15) {
      add('إعادة هيكلة الالتزامات ومعالجة التعثّر', 'fit',
        'أقساطك تعادل ' + burden + '% من إيرادك. تخفيفها الآن يرفع قدرتك على تمويل جديد.');
    }
  }

  // ═══ المشروع: جديد أو توسعة ═══
  if (s.projectKind === 'new' || s.projectKind === 'expansion') {
    add('دراسة الجدوى الاقتصادية', 'blocking',
      s.projectKind === 'new'
        ? 'مشروعك جديد بلا سجل تشغيلي، فالممول لا يملك ماضياً يكتتب عليه — يكتتب على أرقام مستقبلك، ولا يقبلها إلا مدروسة بمعايير ائتمانية.'
        : 'توسعتك ستُقاس بسؤال واحد: هل يسدّد الفرع الجديد قسطه؟ وهذا لا يُجاب بوصف بل بجدول تغطية.');
  }

  // ═══ النية ═══
  if (s.intent === 'investor') {
    add('تجهيز ملف عرض المستثمر والتفاوض', 'strong',
      'تبحث عن شريك — وأول رقم يُقال في الغرفة يحكم التفاوض كله. من يدخل بلا تقييم مسبّب يخرج بأقل مما يستحق.');
    add('التقييم العادل المعمّق', 'fit',
      'قبل أول اجتماع: اعرف نطاقك العادل وحدّك الأدنى، فالفرق بين تقييم مبني وآخر مرتجل قد يكون ملايين في صفقة واحدة.');
  }
  if (s.intent === 'sell') {
    add('تجهيز صفقة التملّك والتفاوض', 'strong',
      'بيع الشركة لحظة تتكرر مرة في عمرها. أي خطأ في الترتيب أو فيما تكشفه ومتى يكلّفك جزءاً من الثمن لا يُستعاد.');
  }
  if (s.intent === 'listing') {
    add('خارطة طريق الإدراج', 'strong',
      'قبل الالتزام بالإدراج: اعرف موقعك من الطريق برقم لا بانطباع، وكم يكلّف كل ما ينقصك.');
    if (s.governanceReady === false) {
      add('بناء الحوكمة المؤسسية', 'blocking', 'الإدراج يشترط حوكمة فاعلة، وملفك لا يُظهر هيكل صلاحيات ولا لجاناً ولا محاضر.');
    }
  }
  if (s.governanceReady === false && s.intent === 'investor') {
    add('بناء الحوكمة المؤسسية', 'strong', 'المستثمر يسأل: من يعتمد الصرف؟ وأين محاضر القرارات؟ — وغياب الجواب يخفّض تقييمك قبل أن يبدأ التفاوض.');
  }

  // ترتيب: ما يمنع التقديم أولاً، ثم الدليل القوي، ثم المناسب
  const rank = { blocking: 0, strong: 1, fit: 2 } as const;
  return out.sort((a, b) => rank[a.urgency] - rank[b.urgency]);
}

export const URGENCY_LABEL: Record<ServiceReason['urgency'], string> = {
  blocking: 'يوقف ملفك الآن',
  strong: 'ظهر في ملفك',
  fit: 'يرفع فرصتك',
};

// أهم جملة في المنصة: ما يُقال للعميل بعد التقييم المجاني ليفتح المطابقة.
// تُبنى من إشاراته هو — فهي وعدٌ بجواب لسؤالٍ صنعته بياناته، لا عرضٌ لخدمة.
export function unlockPitch(s: ClientSignals): { headline: string; lines: string[]; cta: string } {
  const pre = reasonsFor(s, 'pre');
  const blocking = pre.filter(r => r.urgency === 'blocking').length;
  const lines: string[] = [];

  if (s.foreignOwner) {
    lines.push('ملكيتك أجنبية — ولهذا مسارك ليس مسار غيرك: بنوك بلد المالك وفروعها الخليجية، والفروع الأجنبية المرخّصة في المملكة، وضمان الشركة الأم إن وُجدت.');
  }
  if (s.imports) lines.push('أنت تستورد — وهذا يفتح لك أبواب تمويل التجارة والاعتمادات التي لا تُعرض على غيرك.');
  if (s.projectKind === 'new') lines.push('مشروعك جديد — فالأبواب المفتوحة لك تختلف عن أبواب منشأة قائمة، ولا فائدة من طرق ما يشترط سجلاً تشغيلياً.');

  // العربية تعدّ ثلاثة أعداد لا عدداً واحداً — والخطأ النحوي في أول سطر يُفقد الثقة قبل السعر
  const count = blocking === 1 ? 'عائقاً واحداً يقف'
    : blocking === 2 ? 'عائقين يقفان'
    : blocking + ' عوائق تقف';
  const headline = blocking > 0
    ? 'بياناتك تُظهر ' + count + ' بين ملفك وبين الموافقة'
    : 'ملفك مؤهَّل — والسؤال الآن: من يموّلك بالضبط؟';

  lines.push(blocking > 0
    ? 'والمطابقة تحوّل هذي العوائق من كلام إلى أرقام: كم جهة تشترط كل واحدة منها، وأيّها يقبلك رغمها.'
    : 'المطابقة تعطيك الجهات التي تنطبق شروطها عليك بالاسم، وحدود مبالغها، وما ينقصك عند كل واحدة، وطريقة التقديم إليها.');

  return {
    headline,
    lines,
    cta: 'افتح المطابقة — 990 ريال، وتُخصم بالكامل من ملفك التمويلي',
  };
}
