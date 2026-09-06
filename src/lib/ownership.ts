// قراءة الملكية — الحقل الذي يفتح الأبواب ويقفلها.
//
// أكثر عملاء المكتب ملكيتهم غير سعودية، وأكثر البرامج الحكومية تشترط
// الملكية السعودية أو المواطنة. وكان الملف يُبنى بلا هذه المعرفة، فتُقترح
// على مالكٍ غير سعودي أبوابٌ لا تُفتح له. ووعدٌ خاطئ واحد يُحرق صاحبه في
// مجتمعٍ يتكلم مع بعضه.
//
// ★ القاعدة التي يُنفّذها هذا الملف: لا يُذكر برنامج حكومي لمالكٍ غير سعودي
//   إلا بعد تحقق مكتوب من شرط الملكية عنده. والملف لا «يمنع» — يرفع علماً
//   يراه المكتب قبل أن يَعِد.
//
// ★ وأهمّ تفريق فيه ليس «سعودي / أجنبي» بل **كيف صدر السجل**: من يحمل
//   ترخيص وزارة الاستثمار أو إقامة مميزة يُقرأ عند الجهات «مستثمراً
//   مرخّصاً» لا «مقيماً»، وهذان وضعان مختلفان تماماً في باب التمويل.

export type OwnershipType = 'saudi' | 'gcc' | 'foreign' | 'mixed';

export type CrRoute =
  | 'saudi_owner'         // مالك سعودي
  | 'misa_licence'        // ترخيص وزارة الاستثمار
  | 'premium_residency'   // إقامة مميزة
  | 'saudi_partner'       // شريك سعودي في السجل
  | 'gcc_national'        // مواطن خليجي
  | 'unknown';

export type OwnershipInput = {
  ownership_type?: string | null;
  owner_nationality?: string | null;
  cr_route?: string | null;
  parent_company_country?: string | null;
  parent_can_guarantee?: boolean | null;
};

export const OWNERSHIP_LABEL: Record<OwnershipType, string> = {
  saudi: 'ملكية سعودية',
  gcc: 'ملكية خليجية',
  foreign: 'ملكية غير سعودية',
  mixed: 'ملكية مشتركة',
};

export const CR_ROUTE_LABEL: Record<CrRoute, string> = {
  saudi_owner: 'مالك سعودي',
  misa_licence: 'ترخيص وزارة الاستثمار',
  premium_residency: 'إقامة مميزة',
  saudi_partner: 'شريك سعودي في السجل',
  gcc_national: 'مواطن خليجي',
  unknown: 'لم يُسأل بعد',
};

const OWNERSHIP_VALUES: OwnershipType[] = ['saudi', 'gcc', 'foreign', 'mixed'];
const ROUTE_VALUES: CrRoute[] = [
  'saudi_owner', 'misa_licence', 'premium_residency', 'saudi_partner', 'gcc_national', 'unknown',
];

export const asOwnership = (v: unknown): OwnershipType | undefined =>
  OWNERSHIP_VALUES.find((k: OwnershipType) => k === String(v ?? ''));

export const asRoute = (v: unknown): CrRoute | undefined =>
  ROUTE_VALUES.find((k: CrRoute) => k === String(v ?? ''));

export type OwnershipRead = {
  known: boolean;
  type?: OwnershipType;
  route?: CrRoute;
  nationality: string;
  /** شارة قصيرة تُعرض في اللوحات */
  badge: string;
  /** لون الشارة بحسب ما تعنيه للملف */
  tone: 'neutral' | 'good' | 'warn' | 'ask';
  /** هل يجوز اقتراح برنامج حكومي بلا تحقق مكتوب؟ */
  govProgrammesSafe: boolean;
  /** سطر يُقرأ في اللوحة قبل أن يَعِد المكتب بشيء */
  note: string;
  /** الأبواب التي تُفتح بهذه الملكية بعينها — ترتيبها ترتيب الطَّرق */
  doors: string[];
  /** السؤال الذي لم يُسأل بعد، إن بقي */
  ask?: string;
};

/**
 * قراءة واحدة تُستعمل في اللوحات والوثائق.
 *
 * ولا تُصدر حكماً على جهة بعينها: تقول ما الذي يُفتح وما الذي يحتاج تحققاً.
 * فشروط البرامج الحكومية تتغيّر، والمكتوب اليوم قد لا يصحّ بعد شهر — ولذلك
 * الحكم هنا «تحقّق» لا «مرفوض».
 */
export function readOwnership(c: OwnershipInput | null | undefined): OwnershipRead {
  const type = asOwnership(c?.ownership_type);
  const route = asRoute(c?.cr_route);
  const nationality = String(c?.owner_nationality || '').trim();
  const parentCountry = String(c?.parent_company_country || '').trim();
  const parentGuarantees = c?.parent_can_guarantee === true;

  if (type === undefined) {
    return {
      known: false,
      nationality,
      badge: 'الملكية غير مسجّلة',
      tone: 'ask',
      // المجهول لا يُعامَل معاملة الآمن: أكثر عملاء المكتب ملكيتهم غير سعودية،
      // فالافتراض الصامت بالسلامة هو بعينه الخطأ الذي وقع.
      govProgrammesSafe: false,
      note: 'لم تُسجَّل ملكية هذه المنشأة بعد. ولا يُقترح عليها برنامج حكومي قبل معرفتها — أكثر البرامج تشترط الملكية السعودية أو المواطنة.',
      doors: [],
      ask: 'اسأله سؤالاً واحداً: سجلك التجاري صدر بأي طريق؟ مالك سعودي · ترخيص وزارة الاستثمار · إقامة مميزة · شريك سعودي · مواطن خليجي.',
    };
  }

  if (type === 'saudi') {
    return {
      known: true, type, route, nationality,
      badge: OWNERSHIP_LABEL.saudi,
      tone: 'good',
      govProgrammesSafe: true,
      note: 'ملكية سعودية — البرامج الحكومية مفتوحة له من حيث شرط الملكية، ويبقى شرط النشاط والحجم والسجل.',
      doors: [
        'البرامج الحكومية والصناديق التنموية',
        'برنامج كفالة عبر البنوك المشاركة',
        'البنوك المحلية',
        'منصات التمويل المرخّصة من ساما',
      ],
    };
  }

  // خليجي أو مرخّص أو إقامة مميزة — هؤلاء لا يُقرَؤون «مقيمين»
  const licensed = route === 'misa_licence' || route === 'premium_residency' || route === 'gcc_national' || type === 'gcc';

  const doors: string[] = [
    'منصات التمويل المرخّصة من ساما — قرارها على الفاتورة والسجل',
    'منصات التمويل عبر الحدود',
    'فروع البنوك الخليجية والأجنبية في السعودية',
    ...(nationality !== '' ? ['بنك ' + nationality + ' عبر فرعه أو مكتبه الخليجي'] : ['بنك بلد المالك عبر فرعه الخليجي']),
    'التمويل بضمان الأصل — إجارة ومعدات وبيع مع إعادة استئجار',
    ...(parentGuarantees
      ? ['ضمان الشركة الأم' + (parentCountry !== '' ? ' — ' + parentCountry : '') + ' مركَّباً فوق ما سبق']
      : []),
  ];

  if (route === 'saudi_partner' || type === 'mixed') {
    return {
      known: true, type, route, nationality,
      badge: OWNERSHIP_LABEL[type] + ' · شريك سعودي',
      tone: 'good',
      // الشراكة تفتح البرامج غالباً، لكن أكثرها يشترط نسبةً بعينها —
      // فالنسبة تُقرأ من عقد التأسيس قبل أي وعد، لا تُفترض.
      govProgrammesSafe: false,
      note: 'ملكية مشتركة مع شريك سعودي — وهذا يفتح أكثر البرامج، لكن أغلبها يشترط نسبة ملكية سعودية بعينها. اقرأ النسبة من عقد التأسيس قبل أن تَعِد ببرنامج.',
      doors: ['البرامج الحكومية — بعد التحقق من نسبة الشريك السعودي', ...doors],
      ask: 'كم نسبة الشريك السعودي في عقد التأسيس؟',
    };
  }

  if (licensed) {
    return {
      known: true, type, route, nationality,
      badge: OWNERSHIP_LABEL[type] + ' · ' + (route ? CR_ROUTE_LABEL[route] : 'مرخّصة'),
      tone: 'good',
      govProgrammesSafe: false,
      note: 'مالكٌ مرخّص لا «مقيم» — وهذا فرقٌ تقرؤه الجهات. لا تُسقط عنه برنامجاً حكومياً بناءً على الجنسية وحدها: تحقّق من شرط الملكية عند الجهة نفسها، فبعضها يقيس الترخيص لا الجواز.',
      doors,
    };
  }

  return {
    known: true, type, route, nationality,
    badge: OWNERSHIP_LABEL[type] + (route && route !== 'unknown' ? ' · ' + CR_ROUTE_LABEL[route] : ''),
    tone: 'warn',
    govProgrammesSafe: false,
    note: 'ملكية غير سعودية بلا ترخيص استثماري مسجَّل. أكثر البرامج الحكومية تشترط الملكية السعودية، فلا يُذكر له برنامج منها قبل تحقق مكتوب — والممر الصحيح له أبوابٌ أخرى.',
    doors,
    ask: route === undefined || route === 'unknown'
      ? 'سجله التجاري صدر بأي طريق؟ الجواب يغيّر ملفه كله.'
      : undefined,
  };
}

/** سطرٌ قصير للوحات — الشارة ونبرتها */
export function ownershipBadge(c: OwnershipInput | null | undefined): { text: string; tone: OwnershipRead['tone'] } {
  const r = readOwnership(c);
  return { text: r.badge, tone: r.tone };
}
