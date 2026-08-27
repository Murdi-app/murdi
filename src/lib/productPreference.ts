// ترتيب عرض المنتجات التمويلية أمام العميل — طبقة عرض بحتة.
//
// ★ لا يمسّ هذا الملف محرك المطابقة ولا درجات fit_score. المحرك يقيس الانطباق،
//   وهذا يقيس ما يريده العميل فعلاً — وهما سؤالان مختلفان.
//
// القاعدة التجارية التي بُني عليها (من واقع عملاء مُرضي):
//   لا أحد يسلّم أصلاً ممولاً إلا مرهوناً. ففي الإجارة التمويلية تبقى المركبة أو
//   المعدة باسم الممول حتى آخر قسط: لا تُرهن لتمويل آخر، ولا تُباع، ولا تُقرأ
//   أصلاً حرّاً في المركز المالي. والعميل يريد أحد اثنين — أصلاً يملكه، أو نقداً
//   يتصرّف به. فيُقدَّم النقدي والذممي، وتُعرض الإجارة أخيراً وبتنبيه مكتوب.

export type ProductFamily = 'receivable' | 'cash' | 'secured' | 'lease' | 'other';

export interface RankableProduct {
  provider?: string | null;
  product?: string | null;
  instrument?: string | null;
}

const RE_LEASEBACK = /إعادة\s*الاستئجار|إعادة\s*التأجير|sale\s*(and|&)\s*lease\s*back|leaseback/i;
const RE_RECEIVABLE = /فوات(ير|ورة)|الذمم|ذمم|تعميد|خصم\s*الفوات|سلاسل\s*الإمداد|invoice|factoring|receivab|supply\s*chain/i;
const RE_LEASE = /إجار(ة|ه)|اجار(ة|ه)|تأجير\s*تمويل|التأجير\s*التمويل|منتهي(ة|ةً)?\s*بالتمليك|منتهٍ\s*بالتمل|تأجير\s*منتهي|ijara|leas(e|ing)|hire\s*purchase/i;
const RE_CASH = /نقدي|نقداً|مرابحة\s*نقدية|رأس\s*المال\s*العامل|رأس\s*مال\s*عامل|تورق|تمويل\s*لأجل|cash|working\s*capital|term\s*loan|murabaha/i;
const RE_SECURED = /رهن|مرهون|بضمان\s*العقار|ضمان\s*عقاري|collateral|mortgage/i;

function hay(m: RankableProduct): string {
  return [m.product, m.instrument, m.provider].filter(Boolean).join(' · ');
}

/** عائلة المنتج كما يفهمها العميل — لا كما يصنّفها المحرك. */
export function familyOf(m: RankableProduct): ProductFamily {
  const t = hay(m);
  // البيع وإعادة الاستئجار يُحوّل أصلاً مملوكاً إلى نقد، فهو ليس إجارةً بمعناها المرفوض
  if (RE_LEASEBACK.test(t)) return 'secured';
  if (RE_RECEIVABLE.test(t)) return 'receivable';
  if (RE_LEASE.test(t)) return 'lease';
  if (RE_CASH.test(t)) return 'cash';
  if (RE_SECURED.test(t)) return 'secured';
  return 'other';
}

const RANK: Record<ProductFamily, number> = {
  receivable: 0,  // سيولة من فواتيره · بلا رهن · يُسدَّد من مشتريه لا منه
  cash: 1,        // المال يصل حسابه فيشتري باسمه حرّاً
  secured: 2,     // مضمون بأصل يملكه أصلاً — لا يسلبه ملكية جديدة
  other: 3,
  lease: 4,       // الأصل يبقى مرهوناً — آخر ما يُعرض
};

export function rankOf(m: RankableProduct): number {
  return RANK[familyOf(m)];
}

/** التنبيه الذي يُطبع بجوار كل منتج إجارة، فيرى العميل الفرق قبل أن يسأل عنه. */
export function pledgeWarning(m: RankableProduct): string | null {
  return familyOf(m) === 'lease'
    ? 'الأصل الممول يبقى مرهوناً ومسجّلاً باسم الممول حتى آخر قسط — لا يُرهن لتمويل آخر ولا يُباع.'
    : null;
}

export const FAMILY_LABEL: Record<ProductFamily, string> = {
  receivable: 'سيولة من فواتيرك',
  cash: 'نقد تملك به',
  secured: 'مضمون بأصلك القائم',
  other: 'تمويل مباشر',
  lease: 'إجارة — الأصل مرهون',
};

/**
 * ترتيب العرض: العائلة أولاً ثم درجة الانطباق داخل كل عائلة.
 * نسخة جديدة — لا يُعدَّل المصفوف الأصلي.
 */
export function orderForClient<T extends RankableProduct & { fit_score?: number | null; fit?: number | null }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const r = rankOf(a) - rankOf(b);
    if (r !== 0) return r;
    const fa = Number(a.fit_score ?? a.fit ?? 0);
    const fb = Number(b.fit_score ?? b.fit ?? 0);
    return fb - fa;
  });
}
