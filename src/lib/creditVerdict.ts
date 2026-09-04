// الحكم الائتماني الموقّع — مخرَج الفحص السريع على مسار التمويل (٩٩٠).
//
// الفرق بينه وبين الشاشة: الشاشة تعطي العميل اتساعاً — عدد جهاته وما تطلبه
// منه. وهذا يعطيه الحكم: كم يستطيع أن يحمل فعلاً، وبأي منتج، وأي ثلاثة
// أبواب يطرق أولاً ولماذا، وما يُصلحه قبل أن يطرق. والأسماء هنا أول مرة —
// فهي ما يُشترى، ولا تُعرض في الشاشة المجانية.
//
// وقاعدته كقاعدة ملف الغرض: **لا يُخترع رقم**. كل عدد أدناه إمّا مقروء من
// القاعدة أو محسوب بمعادلة معلنة في الوثيقة نفسها، وما ليس مسجّلاً يُقال
// «غير مسجّل» ويُدرج في قائمة الإصلاح. ورقمٌ مخترع في وثيقة يحملها العميل
// إلى بنك يُسقط الوثيقة والمكتب معاً.

import { blockersFromMatches, cycleDays, isImporter, type Blocker } from './gapDemand';
import { COMMERCIAL } from './servicePricing';
import { displayName } from './serviceCatalog';

// ── ثوابت الحساب ───────────────────────────────────────────────────
// هي نفسها ثوابت ملف غرض التمويل (creditMemo.dscr) عمداً: وثيقتان تخرجان
// من مكتب واحد لا يجوز أن تتناقض أرقامهما أمام نفس البنك.
const COST = 0.08;        // كلفة تمويل سنوية تقديرية
const YEARS = 4;          // مدة تقديرية
const DSCR_MIN = 1.25;    // الحدّ البنكي المعتاد لتغطية خدمة الدين

export type VerdictCompany = {
  company_name?: string | null; cr_number?: string | null; city?: string | null;
  sector?: string | null; owner_name?: string | null;
};

export type VerdictFin = Record<string, unknown>;

export type VerdictMatch = {
  provider?: string | null;
  product?: string | null;
  instrument?: string | null;
  fit_score?: number | null;
  verdict?: string | null;
  amount_range?: string | null;
  timeline?: string | null;
  evidence_grade?: string | null;
  apply_channel?: string | null;
  apply_url?: string | null;
  link_status?: string | null;
  required_docs?: string | null;
  requirements?: string | null;
  gaps?: unknown;
};

const n = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
};
const money = (v: number | null): string => (v === null ? '—' : Math.round(v).toLocaleString('en-US'));
const esc = (s: unknown): string =>
  String(s ?? '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string));
const yes = (v: unknown) => v === true || v === 'true' || v === 'نعم';
const gapsOf = (m: VerdictMatch): string[] => {
  const g = m.gaps;
  if (Array.isArray(g)) return g.map((x) => String(x)).filter(Boolean);
  if (typeof g === 'string' && g.trim()) return [g.trim()];
  return [];
};

// ── ١ · القدرة الحقيقية ────────────────────────────────────────────
//
// البنك لا يسأل «كم تريد» بل «كم تستطيع أن تسدّد». فالحساب يبدأ من الربح
// لا من الرغبة: أقصى خدمة دين آمنة = صافي الربح ÷ ١٫٢٥، يُطرح منها القسط
// القائم، وما بقي يُردّ إلى أصلٍ على أربع سنوات بكلفة ٨٪.

export type Capacity = {
  profit: number;
  safeService: number;      // أقصى خدمة دين سنوية عند ١٫٢٥×
  existingService: number;  // القسط القائم سنوياً
  headroom: number;         // المتاح لخدمة دين جديد
  principal: number;        // المبلغ الواقعي المقابل
  requested: number | null;
  ratio: number | null;     // الواقعي ÷ المطلوب
};

// «غير مسجّل» و«خسارة» ليسا شيئاً واحداً. وخلطُهما يجعل الوثيقة تقول لصاحب
// خسارةٍ مسجّلة إن رقمه ناقص — فيبحث عمّا كتبه أصلاً. فالغياب وحده يُرجع null،
// والخسارة تُرجَع محسوبة ويحكم عليها القسم التالي.
export function capacityOf(f: VerdictFin): Capacity | null {
  const profit = n(f.net_profit);
  if (profit === null) return null;
  const monthly = n(f.monthly_installment) ?? n(f.monthly_installments) ?? 0;
  const existingService = Math.max(0, monthly * 12);
  const safeService = profit > 0 ? profit / DSCR_MIN : 0;
  const headroom = safeService - existingService;
  const principal = headroom > 0 ? (headroom * YEARS) / (1 + COST * YEARS) : 0;
  const requested = n(f.requested_amount);
  return {
    profit,
    safeService,
    existingService,
    headroom,
    principal,
    requested,
    ratio: requested && requested > 0 ? principal / requested : null,
  };
}

// ── ٢ · الحكم ──────────────────────────────────────────────────────

export type VerdictKind = 'now' | 'conditional' | 'amount' | 'blocked' | 'unknown';

export type Verdict = {
  kind: VerdictKind;
  headline: string;
  because: string;
};

/** الالتزام النظامي — ما يوقف الملف عند كل جهة بلا استثناء */
export function complianceGaps(f: VerdictFin): string[] {
  const g: string[] = [];
  if (f.cr_valid !== undefined && f.cr_valid !== null && !yes(f.cr_valid)) g.push('السجل التجاري غير ساري');
  if (f.zakat_compliant !== undefined && f.zakat_compliant !== null && !yes(f.zakat_compliant)) g.push('شهادة الزكاة غير مسدّدة');
  if (f.tax_compliant !== undefined && f.tax_compliant !== null && !yes(f.tax_compliant)) g.push('الالتزام الضريبي غير مكتمل');
  return g;
}

export function verdictOf(cap: Capacity | null, comp: string[], blockers: Blocker[], readyDoors: number): Verdict {
  if (!cap) return {
    kind: 'unknown',
    headline: 'لا يمكن إصدار حكم — صافي ربحك غير مسجّل',
    because: 'الرقم الذي يُبنى عليه كل قرار ائتماني هو صافي الربح، وهو غير مسجّل في ملفك. وبدونه لا يُقاس ما تستطيع حمله، ولا يُكتب حكم يصمد أمام لجنة.',
  };

  if (cap.profit <= 0) return {
    kind: 'blocked',
    headline: cap.profit === 0 ? 'ملفك يُظهر تعادلاً لا ربحاً' : 'ملفك يُظهر خسارة في آخر سنة مسجّلة',
    because: 'وخدمة الدين تُسدَّد من الربح لا من الإيراد، فلا جهة تُقرض على خسارة مهما بلغت مبيعاتك. '
      + 'والمخرج ليس الطرق الآن: إمّا أن ربحك الحقيقي أكبر مما تُظهره دفاترك — ومصاريف مخلوطة أو مبيعات غير موثّقة تخفيه، وهذا يُعالَج بإعداد قوائم سليمة — وإمّا أن الخسارة حقيقية فتُعالَج قبل أي تقديم.',
  };

  if (comp.length > 0) return {
    kind: 'blocked',
    headline: 'ملفك يتوقف عند شرط نظامي قبل أن يُقرأ',
    because: comp.join(' · ') + '. وهذا يوقف الملف عند كل جهة بلا استثناء، مهما كانت أرقامك — فيُعالَج أولاً، ثم يُعاد الحكم بلا رسم جديد.',
  };

  if (cap.headroom <= 0) return {
    kind: 'blocked',
    headline: 'قدرتك على حمل دين جديد مستهلكة بالكامل',
    because: 'قسطك القائم (' + money(cap.existingService) + ' ريال سنوياً) يستنفد الحدّ الآمن لخدمة الدين عند ربحك الحالي (' + money(cap.safeService) + ' ريال). فالباب الأول ليس تمويلاً جديداً بل إعادة ترتيب القائم — أو رفع الربح المسجّل.',
  };

  if (cap.ratio !== null && cap.ratio < 0.5) return {
    kind: 'amount',
    headline: 'أنت ممول — لكن ليس بالمبلغ الذي طلبته',
    because: 'طلبت ' + money(cap.requested) + ' ريال، وقدرتك المحسوبة تحتمل نحو ' + money(cap.principal) + ' ريال. والدخول بطلب يتجاوز القدرة يُقرأ عند اللجنة ضعفاً في التخطيط لا طموحاً، ويُردّ الملف كله لا الفرق.',
  };

  if (blockers.length === 0 && readyDoors > 0 && (cap.ratio === null || cap.ratio >= 1)) return {
    kind: 'now',
    headline: 'ملفك قابل للتمويل الآن',
    because: 'قدرتك تغطي المبلغ، والتزامك النظامي مكتمل، و' + readyDoors + ' من جهاتك لم تُسجَّل عليك عندها أي نواقص. ما ينقصك ليس تأهيلاً بل ملفاً مكتوباً وطَرقاً بالترتيب الصحيح.',
  };

  return {
    kind: 'conditional',
    headline: 'ممول بشرط — والشروط معدودة أدناه',
    because: blockers.length > 0
      ? 'قدرتك تحتمل التمويل، لكن ' + blockers.length + (blockers.length === 1 ? ' نقصاً يتكرر' : ' نواقص تتكرر') + ' عند جهاتك. وكل واحد منها يفتح عدداً محدداً من الأبواب — مذكوراً برقمه في قائمة الإصلاح.'
      : 'قدرتك تحتمل جزءاً من المبلغ المطلوب، والفرق يُعالَج بتقسيم الطلب على أدوات أو بخفض المبلغ إلى حدّه الواقعي.',
  };
}

// ── ٣ · ترتيب الأبواب ──────────────────────────────────────────────
//
// «أي باب أطرق أولاً» سؤالٌ لا يُجاب من جدول. وطَرقها دفعةً واحدة يترك
// أثراً: الجهة الثانية ترى استعلام الأولى. فالترتيب قيمة بذاته، ويُبنى
// هنا بمعايير معلنة لا بذوق: حكم المحرك، ثم خلوّ الصفّ من النواقص، ثم
// قوة الدليل، ثم صلاحية باب التقديم، ثم انطباق المبلغ، ثم الدرجة.

const AMOUNT_RE = /([\d][\d,\.]*)\s*(?:مليون|million|m\b)?/gi;

/** يقرأ حدّي المبلغ من نصّ الجهة كما كُتب — ولا يُقدّر ما لم يُكتب */
export function parseRange(s: unknown): { min: number | null; max: number | null } {
  const t = String(s ?? '');
  if (!t.trim()) return { min: null, max: null };
  const nums: number[] = [];
  let m: RegExpExecArray | null;
  AMOUNT_RE.lastIndex = 0;
  while ((m = AMOUNT_RE.exec(t)) !== null) {
    const raw = m[1].replace(/,/g, '');
    const v = Number(raw);
    if (!Number.isFinite(v) || v <= 0) continue;
    // «٥ مليون» تُكتب رقماً صغيراً ومعه الكلمة — تُضرب، وإلا قُرئت خمسةً
    const tail = t.slice(m.index, m.index + m[0].length + 8);
    nums.push(/مليون|million/i.test(tail) && v < 1000 ? v * 1_000_000 : v);
  }
  if (nums.length === 0) return { min: null, max: null };
  if (nums.length === 1) return /حتى|up\s*to|بحد أقصى/i.test(t) ? { min: null, max: nums[0] } : { min: nums[0], max: nums[0] };
  return { min: Math.min(...nums), max: Math.max(...nums) };
}

export type RankedDoor = { m: VerdictMatch; score: number; why: string[]; gaps: string[] };

export function rankDoors(rows: VerdictMatch[], requested: number | null): RankedDoor[] {
  return rows
    .map((m) => {
      const v = String(m.verdict || '');
      const gaps = gapsOf(m);
      const ev = String(m.evidence_grade || '');
      const ls = String(m.link_status || '');
      const rg = parseRange(m.amount_range);
      const fits = requested !== null && requested > 0
        && (rg.min === null || requested >= rg.min)
        && (rg.max === null || requested <= rg.max)
        && (rg.min !== null || rg.max !== null);

      const why: string[] = [];
      let score = 0;

      if (/متأهل/.test(v) && !/بشرط/.test(v)) { score += 40; why.push('حكم المحرك: متأهل بلا شرط'); }
      else if (/متأهل/.test(v)) { score += 25; why.push('متأهل بشرط'); }

      if (gaps.length === 0) { score += 25; why.push('لم يُسجَّل عليك أي نقص عند هذه الجهة'); }
      else if (gaps.length === 1) { score += 10; why.push('نقص واحد فقط يفصلك عنها'); }

      if (ev === 'مؤكّد') { score += 15; why.push('المنتج مؤكَّد من مصدر الجهة نفسها'); }
      else if (ev === 'مرجّح') { score += 8; }

      if (ls === 'يعمل') { score += 10; why.push('باب التقديم مفحوص ويعمل'); }
      else if (ls === 'غير موجودة' || ls === 'تعذّر الوصول') { score -= 12; }

      if (fits) { score += 10; why.push('مبلغك يقع داخل حدودها المعلنة'); }

      score += (n(m.fit_score) ?? 0) / 20;

      return { m, score, why, gaps };
    })
    .sort((a, b) => b.score - a.score);
}

// ── ٤ · المنتج الصحيح ──────────────────────────────────────────────
//
// كثيرٌ ممن يطلب «تمويلاً» لا يحتاج قرضاً: يحتاج اعتماداً مستندياً أو
// تسييل ذمم. ومن يطرق بالمنتج الخطأ يُرَدّ وهو مؤهَّل. فالاستنتاج هنا
// من إشاراته هو، ويُذكر سببه في الوثيقة ليراجعه بنفسه.

export type ProductHint = { name: string; why: string };

export function productFor(f: VerdictFin): ProductHint[] {
  const out: ProductHint[] = [];
  const purpose = String(f.funding_purpose || '') + ' ' + String(f.use_of_funds || '');

  if (isImporter(f.trades_cross_border, f.supplier_countries)) {
    out.push({
      name: 'تسهيل اعتماد مستندي (LC)',
      why: 'أنت تستورد وتدفع لمورّديك مقدّماً، فرأس مالك محبوس في بضاعة في الطريق. والاعتماد يحرّره بلا دين جديد لأن البنك يضمن ولا يُقرض — ويُقاس على العلاقة التجارية لا على الرهن.',
    });
  }
  const cycle = cycleDays(f.collection_cycle) ?? n(f.avg_collection_days);
  if ((cycle !== null && cycle >= 45) || String(f.major_buyers || '').trim()) {
    out.push({
      name: 'تمويل الذمم / تسييل الفواتير',
      why: (cycle !== null ? 'دورة تحصيلك ' + (cycle >= 120 ? 'أكثر من ٩٠ يوماً' : cycle + ' يوماً') + '، أي أن جزءاً من مالك عند عملائك في كل لحظة. ' : '')
        + 'وهذا المنتج يُسعَّر على ائتمان المدين لا على ائتمانك أنت — فجودة عملائك تصير ورقتك، وهو ذاتيّ التسييل فلا يُقاس بنسبة الطلب إلى الإيراد.',
    });
  }
  if (/توسع|فرع|معدة|معدات|أصل|أصول|شاحن|مركب|شراء/i.test(purpose)) {
    out.push({
      name: 'إجارة تمويلية / تمويل أصول',
      why: 'غرضك اقتناء أصل، والأصل نفسه يصلح ضماناً. فالإجارة تفتح لك جهات لا تشترط رهناً خارجياً وتُنجز أسرع من التمويل النقدي.',
    });
  }
  if (out.length === 0) {
    out.push({
      name: 'تمويل رأس مال عامل',
      why: 'لم تظهر في ملفك إشارة استيراد ولا ذمم مؤجلة ولا اقتناء أصل، فالمسار الافتراضي هو رأس المال العامل — ويُقاس على الربح والتدفق مباشرة.',
    });
  }
  return out;
}

// ── ٥ · الوثيقة ────────────────────────────────────────────────────

const TONE: Record<VerdictKind, { bg: string; bd: string; fg: string; tag: string }> = {
  now: { bg: '#EAF7F0', bd: '#BFE0D3', fg: '#1A5C46', tag: 'قابل للتمويل' },
  conditional: { bg: '#FBF5E8', bd: '#E8D9AE', fg: '#8A6D1F', tag: 'ممول بشرط' },
  amount: { bg: '#FBF5E8', bd: '#E8D9AE', fg: '#8A6D1F', tag: 'المبلغ يحتاج تصحيحاً' },
  blocked: { bg: '#FBEEEC', bd: '#F0D6D2', fg: '#8A3B33', tag: 'يحتاج إصلاحاً أولاً' },
  unknown: { bg: '#F4F7F6', bd: '#E1EDE8', fg: '#5E7C73', tag: 'بيانات ناقصة' },
};

export function buildCreditVerdict(
  c: VerdictCompany,
  f: VerdictFin,
  matches: VerdictMatch[]
): string {
  const cap = capacityOf(f);
  const comp = complianceGaps(f);
  const blockers = blockersFromMatches(matches, 4);
  const ranked = rankDoors(matches, cap?.requested ?? null);
  const readyDoors = ranked.filter((d) => d.gaps.length === 0 && /متأهل/.test(String(d.m.verdict || '')) && !/بشرط/.test(String(d.m.verdict || ''))).length;
  const v = verdictOf(cap, comp, blockers, readyDoors);
  const tone = TONE[v.kind];
  const top = ranked.slice(0, 3);
  const rest = ranked.slice(3);
  const products = productFor(f);

  const doorCard = (d: RankedDoor, i: number) => {
    const m = d.m;
    const chan = String(m.apply_channel || '').trim();
    return `<div class="door">
      <div class="dn">${i + 1}</div>
      <div class="db">
        <div class="dt">${esc(m.provider || '—')}</div>
        <div class="dp">${esc(m.product || '')}</div>
        <div class="dmeta">${[
          m.amount_range ? 'الحدود: ' + esc(m.amount_range) : '',
          m.timeline ? 'المدة: ' + esc(m.timeline) : '',
          m.instrument ? 'الأداة: ' + esc(m.instrument) : '',
        ].filter(Boolean).join(' &nbsp;·&nbsp; ')}</div>
        ${d.why.length ? `<div class="dwhy"><b>لماذا هذا الباب أولاً:</b> ${d.why.map(esc).join(' · ')}</div>` : ''}
        ${chan ? `<div class="dhow"><b>طريقة التقديم:</b> ${esc(chan.slice(0, 420))}</div>` : ''}
        ${d.gaps.length ? `<div class="dgap"><b>ما ينقصك عندها:</b> ${d.gaps.map((g) => esc(g)).join(' · ')}</div>` : '<div class="dok">لا نواقص مسجّلة عندها — هذا بابك الأسرع.</div>'}
      </div>
    </div>`;
  };

  const repairRow = (b: Blocker) => {
    const com = COMMERCIAL[b.service];
    const price = com && typeof com.price === 'number' ? money(com.price) + ' ر.س' : 'بعرض خاص';
    return `<tr>
      <td><b>${esc(b.what)}</b></td>
      <td class="n">${b.entities}</td>
      <td>${esc(displayName(b.service))}</td>
      <td>${esc(com?.days || '—')}</td>
      <td class="n">${price}</td>
    </tr>`;
  };

  const today = new Date().toLocaleDateString('ar-SA');

  return `<div class="doc" dir="rtl">
  <div class="eyebrow">مُرضي · حلول المرضي للاستشارات المالية · ترخيص FL-457927015 · سجل 7039663724</div>
  <h1>الحكم الائتماني<br>${esc(c.company_name || 'منشأة')}</h1>
  <p class="lede">${[c.cr_number ? 'سجل تجاري ' + esc(c.cr_number) : '', esc(c.city || ''), esc(c.sector || ''), today].filter(Boolean).join(' · ')}</p>

  <div class="verdict" style="background:${tone.bg};border-color:${tone.bd}">
    <div class="vtag" style="color:${tone.fg}">${tone.tag}</div>
    <div class="vh" style="color:${tone.fg}">${esc(v.headline)}</div>
    <div class="vb">${esc(v.because)}</div>
  </div>

  <h2>١ · كم تستطيع أن تحمل فعلاً</h2>
  ${cap ? `<table>
    <tr><th>البند</th><th style="text-align:left">ريال</th></tr>
    <tr><td>صافي الربح السنوي المسجّل</td><td class="n">${money(cap.profit)}</td></tr>
    <tr><td>الحدّ الآمن لخدمة الدين (الربح ÷ ١٫٢٥)</td><td class="n">${money(cap.safeService)}</td></tr>
    <tr><td>خدمة الدين القائمة عليك سنوياً</td><td class="n">${money(cap.existingService)}</td></tr>
    <tr><td><b>المتاح لخدمة دين جديد</b></td><td class="n">${money(cap.headroom)}</td></tr>
    <tr><td><b>المبلغ الواقعي المقابل (٤ سنوات · كلفة ٨٪)</b></td><td class="n">${money(cap.principal)}</td></tr>
    ${cap.requested !== null ? `<tr><td>المبلغ الذي طلبته</td><td class="n">${money(cap.requested)}</td></tr>` : ''}
  </table>
  ${cap.ratio !== null ? `<div class="${cap.ratio >= 1 ? 'key' : 'stop'}">${
      cap.ratio >= 1
        ? 'قدرتك المحسوبة تغطي ما طلبت وتزيد. والزيادة ليست دعوةً لرفع الطلب — بل هامشٌ يُقرأ عند اللجنة ثقةً.'
        : 'الفرق بين ما طلبت وما تحتمله قدرتك هو ' + money(cap.requested !== null ? cap.requested - cap.principal : null) + ' ريال. وأمامك بابان: أن تخفض الطلب إلى حدّه الواقعي، أو أن تقسّمه على أدوات مختلفة يُقاس كلٌّ منها على ضمانه لا على ربحك — وهذا ما يفعله الملف الكامل.'
    }</div>` : ''}
  <p class="mini">المعادلة معلنة عمداً لتراجعها بنفسك: البنك لا يسأل كم تريد بل كم تستطيع أن تسدّد، ويقيسها بتغطية خدمة الدين — والحدّ المعتاد ١٫٢٥×. والكلفة والمدة أعلاه تقديران للتفاوض لا عرضٌ من جهة؛ الرقم النهائي يُحدَّد بعرضها هي.</p>`
  : `<div class="stop">صافي الربح غير مسجّل في ملفك، وهو الرقم الذي يُبنى عليه كل ما سبق. تسجيله يفتح الحكم كاملاً بلا رسم جديد.</div>`}

  <h2>٢ · المنتج الصحيح لحالتك</h2>
  <p class="mini">من يطرق بالمنتج الخطأ يُرَدّ وهو مؤهَّل. وهذا ما تقوله إشارات ملفك:</p>
  ${products.map((p) => `<div class="key"><div class="q">${esc(p.name)}</div><div class="a">${esc(p.why)}</div></div>`).join('')}

  <h2>٣ · أبوابك الثلاثة الأولى — بالاسم</h2>
  ${top.length
      ? `<p class="mini">مرتّبة بمعايير معلنة: حكم المحرك، ثم خلوّ صفّك من النواقص عندها، ثم قوة الدليل على المنتج، ثم صلاحية باب التقديم، ثم انطباق مبلغك على حدودها. وطَرقها بالترتيب مقصود — فالجهة الثانية ترى أثر استعلام الأولى.</p>
         ${top.map(doorCard).join('')}`
      : '<div class="stop">لم تُطابَق بعد أي جهة على ملفك. تشغيل المطابقة يسبق هذا الفحص.</div>'}

  ${rest.length ? `<h2>٤ · بقية جهاتك المؤهَّلة</h2>
    <p class="mini">${rest.length} جهة أخرى انطبقت شروطها على ملفك. هذه أسماؤها وحدودها — وترتيبها بعد الثلاثة الأولى.</p>
    <table>
      <tr><th>الجهة</th><th>المنتج</th><th>الحدود</th><th>الحكم</th></tr>
      ${rest.map((d) => `<tr>
        <td><b>${esc(d.m.provider || '—')}</b></td>
        <td class="sm">${esc(String(d.m.product || '').slice(0, 90))}</td>
        <td class="sm">${esc(d.m.amount_range || '—')}</td>
        <td class="sm">${esc(d.m.verdict || '—')}</td>
      </tr>`).join('')}
    </table>` : ''}

  <h2>${rest.length ? '٥' : '٤'} · قائمة الإصلاح — مرتّبة بالأثر</h2>
  ${comp.length ? `<div class="stop"><b>قبل كل شيء:</b> ${comp.map(esc).join(' · ')}. هذه توقف الملف عند كل جهة بلا استثناء، ولا يُجدي إصلاح غيرها قبلها.</div>` : ''}
  ${blockers.length
      ? `<table>
      <tr><th>ما ينقصك</th><th style="text-align:left">كم باباً يفتح</th><th>ما يُصلحه</th><th>المدة</th><th style="text-align:left">الرسم</th></tr>
      ${blockers.map(repairRow).join('')}
    </table>
    <p class="mini">عمود «كم باباً يفتح» معدود من نصّ جهاتك أنت — لا تقديرَ فيه: هو عدد الجهات المختلفة التي سُجِّل عندها هذا النقص بعينه.</p>`
      : '<div class="key">لم يتكرر عليك نقصٌ بعينه عند جهاتك. وهذا وضع نادر — ومعناه أن ما يفصلك عن التمويل ترتيبٌ وطَرقٌ لا تأهيل.</div>'}

  <h2>${rest.length ? '٦' : '٥'} · ما لا يشمله هذا الفحص</h2>
  <div class="stop">
    هذا حكمٌ يُعرّفك بموقفك وأبوابك. ولا يشمل: بناء ملفك التمويلي بالعربية والإنجليزية · مخاطبة أيٍّ من الجهات أعلاه باسمك · متابعة الردود · التفاوض على الشروط.
    وهذه هي «تجهيز ملف التمويل والمخاطبة والتفاوض»، ويُخصم منها ما دفعته في هذا الفحص بالكامل إن أكملت خلال ثلاثين يوماً.
  </div>

  <div class="sig">
    <div class="sn">د. عبدالحكيم المرضي</div>
    <div class="sl">مستشار مالي معتمد · ترخيص FL-457927015 · حلول المرضي للاستشارات المالية</div>
  </div>
  <div class="foot">أُعدّ لصالح ${esc(c.company_name || '')}${c.owner_name ? ' — ' + esc(c.owner_name) : ''} · وثيقة سرّية لا تُتداول خارج أطرافها · ${today}</div>
</div>`;
}

export const VERDICT_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap');
*{box-sizing:border-box}
body{margin:0;background:#F4F7F6;font-family:Cairo,system-ui,sans-serif;color:#12302A;line-height:1.95;padding:20px 14px 50px}
.doc{max-width:840px;margin:0 auto;background:#fff;border:1px solid #E1EDE8;border-radius:16px;padding:28px 26px}
.eyebrow{font-size:11px;letter-spacing:.10em;color:#9DB3AB;font-weight:900}
h1{font-size:25px;margin:6px 0 4px;line-height:1.5}
h2{font-size:17px;margin:30px 0 10px;padding-bottom:7px;border-bottom:2px solid #EDF4F1}
p{font-size:13.8px;margin:0 0 11px}
.lede{font-size:13.5px;color:#5E7C73}
.mini{font-size:11.8px;color:#8AA49B;font-weight:700;line-height:1.85}
.verdict{border:2px solid;border-radius:14px;padding:18px 20px;margin:18px 0 6px}
.vtag{font-size:11px;font-weight:900;letter-spacing:.08em;margin-bottom:4px}
.vh{font-size:19px;font-weight:900;line-height:1.6;margin-bottom:6px}
.vb{font-size:13.5px;color:#33544B;line-height:1.95}
table{width:100%;border-collapse:collapse;font-size:13px;margin:10px 0}
th{text-align:right;background:#F4F8F6;padding:8px 11px;font-size:11.5px;color:#406057;font-weight:900}
td{padding:8px 11px;border-bottom:1px solid #EFF5F2;vertical-align:top}
td.n{text-align:left;font-weight:900;white-space:nowrap;font-variant-numeric:tabular-nums}
td.sm{font-size:12px;color:#4A6A60}
.key{background:#F6FAF8;border-right:4px solid #2E9E7B;border-radius:9px;padding:12px 15px;margin:12px 0;font-size:13.3px}
.stop{background:#FDF1EC;border-right:4px solid #B4622A;border-radius:9px;padding:12px 15px;margin:12px 0;font-size:13.3px}
.q{font-weight:900;margin-bottom:3px;font-size:13.6px}
.a{font-size:13.2px;color:#33544B}
.door{display:flex;gap:14px;border:1.5px solid #E7F1ED;border-radius:13px;padding:15px 17px;margin-bottom:11px;background:#FCFDFD}
.dn{flex:0 0 34px;height:34px;border-radius:50%;background:#1A3D34;color:#fff;font-weight:900;font-size:15px;display:flex;align-items:center;justify-content:center}
.db{flex:1;min-width:0}
.dt{font-size:15px;font-weight:900;line-height:1.6}
.dp{font-size:12.8px;color:#4A6A60;font-weight:700;margin-bottom:5px}
.dmeta{font-size:12px;color:#6B8A80;font-weight:700;margin-bottom:7px}
.dwhy{font-size:12.5px;color:#1A6B52;background:#F2FAF6;border-radius:8px;padding:7px 11px;margin-bottom:6px}
.dhow{font-size:12.4px;color:#33544B;margin-bottom:6px}
.dgap{font-size:12.4px;color:#8A5A2E;background:#FDF6EE;border-radius:8px;padding:7px 11px}
.dok{font-size:12.4px;color:#1A6B52;font-weight:800}
.sig{margin-top:34px;padding-top:14px;border-top:2px solid #EDF4F1}
.sn{font-size:15px;font-weight:900}
.sl{font-size:11.8px;color:#8AA49B;font-weight:700}
.foot{font-size:11.5px;color:#9DB3AB;text-align:center;padding-top:14px;margin-top:14px;border-top:1px solid #EFF5F2}
@media print{body{background:#fff;padding:0}.doc{border:none;border-radius:0;padding:0}.door{break-inside:avoid}}
`;
