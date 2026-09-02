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

// ── الحساب الذي يبيع ────────────────────────────────────────────────
// «أنت مؤهّل لتسع جهات، وملفك جاهز لاثنتين منها.»
//
// هذا ليس عرضاً — هو طرح. والعميل لا يجادل الطرح كما يجادل البائع.
// والحساب صريح ولا يُجمَّل: الجهة «جاهزة» إن لم يُسجَّل عليها نقص، و«موقوفة»
// إن سُجِّل. ولا نحتسب جهةً بلا بيانات أصلاً، لأن الصمت ليس جاهزية.

export type Readiness = {
  /** الجهات المطابَقة التي لها بيانات يُحكم عليها */
  total: number;
  /** لا نقص مسجَّلاً عندها — ملفه اليوم يمشي إليها */
  ready: number;
  /** عندها نقص مسجَّل — بابٌ مفتوح لا يملك مفتاحه */
  blocked: number;
};

export function readinessFromMatches(rows: MatchLike[]): Readiness {
  let total = 0;
  let ready = 0;
  for (const r of rows) {
    const g = r.gaps;
    const list = Array.isArray(g)
      ? g.map((x) => String(x).trim()).filter(Boolean)
      : typeof g === 'string' && g.trim()
        ? [g.trim()]
        : null;
    // gaps غير مسجَّلة إطلاقاً = لم تُقيَّم، فلا تُحتسب في الاتجاهين
    if (list === null) continue;
    total++;
    if (list.length === 0) ready++;
  }
  return { total, ready, blocked: total - ready };
}

/** الجملة كما تُقرأ — ولا تُقال إن لم يكن هناك ما يُقاس */
export function readinessLine(r: Readiness): string | null {
  if (r.total < 2) return null;
  return 'أنت مؤهّل لـ' + r.total + ' جهة، وملفك اليوم جاهز لـ' + r.ready + ' منها.';
}
