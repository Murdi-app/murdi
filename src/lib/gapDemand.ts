// ما تطلبه جهاتك — لا ما نعرضه نحن.
//
// أذكى بائع في المنصة كان موجوداً ولم يُستعمل: كل صفّ مطابقة يحمل `gaps`
// و`requirements` — أي ما ينقص العميل عند تلك الجهة بالذات، بكلام الجهة لا
// بكلامنا. فإن قال سبعةٌ من تسع جهات «قوائم مدققة»، فهذه ليست حجّة بائع،
// إنما عدٌّ لما قالته السوق.
//
// والقاعدة الحاكمة هنا: **لا يُقال رقم لم يُعدّ.** نعرض الثيمة ومعها عدد
// الجهات التي ذكرتها فعلاً، ولا نضخّم ولا نستنتج حاجةً لم تُذكر.

export type GapTheme = {
  key: string;
  /** اسم الخدمة كما هو مخزَّن في service_title — لا يُغيَّر إلا بترحيل */
  service: string;
  /** ما يراه العميل: الجهة تطلب كذا */
  demand: string;
  /** لماذا يوقفه هذا — بلغة النتيجة لا بلغة الوصف */
  consequence: string;
  /** كلمات تُلتقط من نصّ الجهة نفسها */
  match: RegExp;
};

// الترتيب مقصود: الأعلى تكراراً في السوق السعودي أولاً، فإن تساوى العدد
// رجّحنا ما يفتح أكثر الأبواب.
export const GAP_THEMES: GapTheme[] = [
  {
    key: 'statements',
    service: 'إعداد القوائم المالية المعتمدة',
    demand: 'قوائم مالية معتمدة أو مدقّقة',
    consequence: 'وبدونها لا يُقرأ ملفك أصلاً — يتوقف عند أول شرط',
    match: /قوائم\s*مالية|مدقّ?ق|مراجع\s*خارجي|مُدقّقة|audited|financial\s*statement/i,
  },
  {
    key: 'collateral',
    service: 'تجهيز ملف الضمانات والرهن',
    demand: 'ضمان أو رهن مقبول',
    consequence: 'وأكثر من يُرفض هنا يملك ضماناً لا يعرف أنه مقبول',
    match: /ضمان|رهن|كفالة\s*عقار|collateral|guarantee|security\b/i,
  },
  {
    key: 'receivables',
    service: 'تنظيم دورة الفوترة وملف الذمم',
    demand: 'فواتير وذمم مرتّبة على عملاء مصنّفين',
    consequence: 'وهذا ما يحوّل مستحقاتك المؤجّلة إلى نقد اليوم',
    match: /فوات|ذمم|تحصيل|مستحق|invoice|receivable/i,
  },
  {
    key: 'lc',
    service: 'تجهيز ملف تسهيل الاعتمادات المستندية',
    demand: 'تسهيل اعتماد مستندي للاستيراد',
    consequence: 'ويحرّر سيولتك المحبوسة عند مورّديك بلا دين جديد',
    match: /اعتماد\s*مستندي|استيراد|مورّ?د\s*خارج|letter\s*of\s*credit|\bL\/?C\b|import/i,
  },
  {
    key: 'parent',
    service: 'ملف ضمان الشركة الأم',
    demand: 'ضمان من الشركة الأم',
    consequence: 'ويحوّلك من كيان صغير إلى ذراع مجموعة، فيرتفع السقف والشروط معاً',
    match: /شركة\s*أم|الشركة\s*الأم|parent\s*(company|guarantee)|corporate\s*guarantee/i,
  },
  {
    key: 'feasibility',
    service: 'دراسة الجدوى الاقتصادية',
    demand: 'دراسة جدوى للمشروع',
    consequence: 'وهي أول ما يُطلب في تمويل التوسعة والأصول',
    match: /دراسة\s*جدوى|جدوى\s*اقتصاد|feasibility|business\s*plan/i,
  },
  {
    key: 'governance',
    service: 'بناء الحوكمة المؤسسية',
    demand: 'حوكمة ولوائح ومجلس',
    consequence: 'وهي شرط الجهات المؤسسية الكبيرة قبل أي تسهيل كبير',
    match: /حوكمة|مجلس\s*إدار|لوائح|governance|board\b/i,
  },
  {
    key: 'restructure',
    service: 'إعادة هيكلة الالتزامات ومعالجة التعثّر',
    demand: 'معالجة التزامات قائمة أو تعثّر',
    consequence: 'ولا يُفتح لك باب جديد وقديمك غير مرتّب',
    match: /تعثّ?ر|متأخر|جدولة|إعادة\s*هيكلة|default|restructur|overdue/i,
  },
  {
    key: 'foreign',
    service: 'ملف الممر الأجنبي',
    demand: 'ترتيب ملف الملكية الأجنبية',
    consequence: 'وهو ما يجعل ملفك يُقرأ عند الجهات التي تقبل هذا النوع',
    match: /ملكية\s*أجنب|مستثمر\s*أجنب|جنسية\s*المالك|foreign\s*(owner|ownership)|non-?saudi/i,
  },
];

export type DemandRow = {
  key: string;
  service: string;
  demand: string;
  consequence: string;
  /** عدد الجهات التي ذكرت هذا فعلاً — معدود لا مُقدَّر */
  entities: number;
};

type MatchLike = {
  provider?: string | null;
  requirements?: string | null;
  gaps?: unknown;
};

const textOf = (m: MatchLike): string => {
  const g = m.gaps;
  const gapText = Array.isArray(g)
    ? g.map(String).join(' · ')
    : typeof g === 'string'
      ? g
      : '';
  return (String(m.requirements || '') + ' · ' + gapText).toLowerCase();
};

/**
 * يُرجع ما تطلبه جهات هذا العميل، مرتّباً بعدد الجهات التي طلبته.
 * تُحتسب الجهة مرة واحدة للثيمة الواحدة مهما تكرّرت في نصّها.
 */
export function demandFromMatches(rows: MatchLike[], limit = 3): DemandRow[] {
  const seen = new Map<string, Set<string>>();   // theme -> أسماء الجهات
  for (const r of rows) {
    const t = textOf(r);
    if (!t.trim()) continue;
    const who = String(r.provider || '').trim() || Math.random().toString(36);
    for (const th of GAP_THEMES) {
      if (!th.match.test(t)) continue;
      if (!seen.has(th.key)) seen.set(th.key, new Set());
      seen.get(th.key)!.add(who);
    }
  }
  return GAP_THEMES
    .map((th) => ({
      key: th.key,
      service: th.service,
      demand: th.demand,
      consequence: th.consequence,
      entities: seen.get(th.key)?.size || 0,
    }))
    .filter((d) => d.entities > 0)
    .sort((a, b) => b.entities - a.entities)
    .slice(0, limit);
}

/** «٧ من ٩ جهات تطلب…» — الصياغة التي يقولها العدد لا نحن */
export function demandLine(d: DemandRow, total: number): string {
  const of = total > 0 ? ' من ' + total : '';
  return d.entities + of + (d.entities === 1 ? ' جهة تطلب ' : ' جهة تطلب ') + d.demand;
}

// ── ما يقف بينك وبين الجهات ─────────────────────────────────────────
//
// كان هنا مقياس «مؤهّل لكذا، جاهز لكذا» يَعُدّ الجهةَ جاهزةً إن لم يُسجَّل
// عليها نقص. وقياسُه على تشغيلة حقيقية كشف أنه معطوب من أصله:
//
//   • كل صفّ مطابقة يحمل ٢ إلى ٤ ملاحظات دائماً — فـ«صفر نواقص» لا تقع
//     لأي عميل مهما كان ملفه. النتيجة كانت «جاهز لجهة واحدة من ٣٩»
//     لعميلٍ درجةُ تقييمه ٨٥ و«جاهز للتمويل». تناقضٌ يراه بعينه.
//
//   • وأسوأ: الملاحظات تخلط نوعين. «لا قوائم مالية مدققة» نقصٌ في العميل
//     نبيع إصلاحه. أما «Marco مختصة بممر أمريكا اللاتينية» و«BBK لا فرع
//     لها في السعودية» فليست نقصاً فيه إطلاقاً — هي سببُ استبعاد الجهة.
//     واحتسابها ضدّه ظلمٌ حسابي.
//
// فحلّ محلَّه ما يُقاس فعلاً: أكثرُ النواقص تكراراً، وكم جهةً يفتحها كلٌّ
// منها. والعميل يرى عائقه ثلاثةَ أشياء لا ثمانيةً وثلاثين باباً موصداً.
// ولا تُحتسب إلا الملاحظات التي تطابق ثيمةً نعرفها — فما كان عن الجهة
// نفسها يسقط من الحساب وحده.

export type Blocker = {
  key: string;
  service: string;
  /** ما ينقصه بكلامنا المختصر */
  what: string;
  /** عدد الجهات المختلفة التي يقف عندها هذا النقص */
  entities: number;
};

const gapsOf = (m: MatchLike): string[] => {
  const g = m.gaps;
  if (Array.isArray(g)) return g.map((x) => String(x)).filter(Boolean);
  if (typeof g === 'string' && g.trim()) return [g.trim()];
  return [];
};

/** أكثر ما يتكرر من نواقصه — من نصّ النواقص وحده، لا من شروط الجهة */
export function blockersFromMatches(rows: MatchLike[], limit = 3): Blocker[] {
  const seen = new Map<string, Set<string>>();
  for (const r of rows) {
    const text = gapsOf(r).join(' · ').toLowerCase();
    if (!text) continue;
    const who = String(r.provider || '').trim();
    if (!who) continue;
    for (const th of GAP_THEMES) {
      if (!th.match.test(text)) continue;
      if (!seen.has(th.key)) seen.set(th.key, new Set());
      seen.get(th.key)!.add(who);
    }
  }
  return GAP_THEMES
    .map((th) => ({ key: th.key, service: th.service, what: th.demand, entities: seen.get(th.key)?.size || 0 }))
    .filter((b) => b.entities > 0)
    .sort((a, b) => b.entities - a.entities)
    .slice(0, limit);
}

// ── حكم المحرك نفسه ─────────────────────────────────────────────────
//
// المحرك يكتب في `verdict` حكمه على الجهة: «متأهل» أو «متأهل بشرط» أو
// سببَ استبعادها صريحاً. ولم يكن أحدٌ يقرأ هذا الحقل في طريق العميل.
//
// وثمنُ ذلك مقيسٌ لا مُتخيَّل: صفٌّ واحد في تشغيلة حقيقية —
//   Marco (marcofi.com) · fit_score = ٧٧ ·
//   «غير مناسب — التغطية الجغرافية محدودة بأمريكا اللاتينية والولايات المتحدة»
// كان سيظهر للعميل ضمن «المطابقات القوية»، والمحرك نفسه كتب أنها لا تصلح.
//
// فصار حكم المحرك مقدَّماً على الدرجة: ما استبعده لا يُعرض مهما علت درجته.
// وهذا يحذف الجهات التي لا تصل عميلنا — ولا يمسّ الدولي الصالح بحرف،
// لأن المعيار ليس «أين مقرّها» بل «هل قال المحرك إنها لا تصلح».

const REJECTED = /غير\s*مناسب|مستبعد|لا\s*يناسب|غير\s*متاح|not\s*suitable|excluded|ineligible/i;

/** هل استبعد المحركُ هذه الجهة صراحةً؟ */
export function isRejected(verdict: unknown): boolean {
  const v = String(verdict || '').trim();
  return v !== '' && REJECTED.test(v);
}

/** «متأهل» بلا شرط — أقوى ما يملكه العميل، بحكم المحرك لا بعتبة رقمية */
export function isFullyQualified(verdict: unknown): boolean {
  return String(verdict || '').trim() === 'متأهل';
}
