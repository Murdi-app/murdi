// وثيقة «ملف العقد الائتماني» — مخرَج خدمة تمويل العقد.
//
// تُقرأ في مكانين: على طاولة صاحب العقد ليعرف كم يحتاج نقداً قبل أن يوقّع
// أو قبل أن يبدأ، وعلى طاولة لجنة الائتمان لتعرف من يدفعه ومتى. ولذلك
// كُتبت بلغة اللجنة لا بلغة المكاتب: أرقامٌ مشتقّة من بنود العقد نفسه،
// وكل رقم يُقال من أين جاء.
//
// ولا نداء لنموذج لغوي هنا ولا في مساره: كل حرفٍ فيها محسوبٌ من ثمانية
// مدخلات. فهي تخرج في ثوانٍ وبلا كلفة، وتُراجَع بالحاسبة إن شُكّ فيها.

import {
  type ContractInputs, type ContractPack, type ContractScenario, type FundingLeg,
  money, pct, times, arMonths, arEntities, renderContractFlow, renderScenarios, awarderNote,
} from './contractCompute';

export type ContractCompany = {
  company_name?: string | null;
  cr_number?: string | null;
  city?: string | null;
  sector?: string | null;
  owner_name?: string | null;
};

/** صفّ جهة كما يخرج من match_results — الحقول المستعملة وحدها */
export type ContractDoor = {
  provider?: string | null;
  product?: string | null;
  instrument?: string | null;
  amount_range?: string | null;
  timeline?: string | null;
  apply_channel?: string | null;
  verdict?: string | null;
  gaps?: unknown;
};

const esc = (s: unknown): string =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const gapsOf = (g: unknown): string[] => {
  if (Array.isArray(g)) return (g as unknown[]).map((x: unknown) => String(x)).filter((s: string) => s !== '');
  if (typeof g === 'string' && g.trim() !== '') {
    return g.split(/[·،,\n]+/).map((s: string) => s.trim()).filter((s: string) => s !== '');
  }
  return [];
};

// ── الحكم على العقد ───────────────────────────────────────────────────
//
// أربع حالات لا خامس لها، وكلها من رقمين: الفجوة والربح. والترتيب مقصود:
// الخسارة تسبق كل شيء — فمن يخسر لا يُبحث له عن تمويل، يُبحث له عن مخرج.

export type ContractVerdictKind = 'loss' | 'heavy' | 'gap' | 'clear';

export type ContractVerdict = { kind: ContractVerdictKind; headline: string; because: string };

export function verdictOfContract(p: ContractPack): ContractVerdict {
  if (p.profit <= 0) {
    return {
      kind: 'loss',
      headline: 'هذا العقد لا يربح — وتمويله يؤجّل الخسارة لا يمنعها',
      because: 'تكلفتك المباشرة ' + money(p.totalCost) + ' ريال مقابل قيمة عقد أقلّ منها أو مساوية لها، '
        + 'فالنتيجة ' + money(p.profit) + ' ريال قبل أي مصروف إداري أو تمويلي. '
        + 'ولن نطرق لك باباً على هذا الأساس: ما يلزمك أولاً مراجعة التسعير أو أوامر التغيير أو نطاق العمل، '
        + 'وهذا ما نبدأ به معك — لأن جلب تمويلٍ لعقدٍ خاسر يضيف كلفةً إلى خسارة.',
    };
  }
  if (p.gap <= 0) {
    return {
      kind: 'clear',
      headline: 'عقدك يموّل نفسه — ولا يلزمك رأس مال عامل',
      because: 'تدفقك لا يهبط تحت الصفر في أي شهر من أشهر العقد، بفضل دفعتك المقدمة وقِصَر مدة تحصيلك. '
        + 'وما يلزمك ليس تمويلاً بل ضمانات: ' + money(p.bonds.total) + ' ريال منها، وهي التي قد تُوقفك '
        + 'إن لم يكن لك سقفٌ لدى جهة تُصدرها.',
    };
  }
  if (p.fundsMoreThanEarns) {
    return {
      kind: 'heavy',
      headline: 'تحتاج نقداً أكثر ممّا سيربحه هذا العقد',
      because: 'أعمق نقطة في تدفقك ' + money(p.gap) + ' ريال، وربحك من العقد كلّه ' + money(p.profit) + ' ريال. '
        + 'أي أنك تموّل ' + times(p.gap / Math.max(p.profit, 1)) + ' ما ستجنيه. '
        + 'وهذا لا يعني رفض العقد — يعني أن تنفيذه بمالك وحدك غير ممكن، وأن الشروط التي أوصلتك إلى هذا الرقم '
        + 'قابلة للتغيير إن لم تكن قد وقّعت بعد، وقابلة للمعالجة بأدوات محددة إن كنت قد وقّعت.',
    };
  }
  return {
    kind: 'gap',
    headline: 'العقد رابح، وينقصه ' + money(p.gap) + ' ريال نقداً في الشهر ' + (p.worst !== null ? p.worst.m : '—'),
    because: 'ربحك ' + money(p.profit) + ' ريال، وهو ربحٌ حقيقي. لكنه لا يصل إليك في وقت حاجتك إليه: '
      + 'تصرف على التنفيذ شهراً بشهر وتُحصّل متأخراً، فتهبط سيولتك إلى ما دون الصفر بـ' + money(p.gap) + ' ريال قبل أن ترتفع. '
      + 'وهذه فجوةُ توقيتٍ لا فجوةُ جدوى — وهي بالضبط ما تموّله الأدوات المذكورة في هذه الوثيقة.',
  };
}

const TONE: Record<ContractVerdictKind, { bg: string; bd: string; fg: string; tag: string }> = {
  clear: { bg: '#EAF7F0', bd: '#BFE0D3', fg: '#1A5C46', tag: 'ينفَّذ بلا تمويل' },
  gap: { bg: '#FBF5E8', bd: '#E8D9AE', fg: '#8A6D1F', tag: 'فجوة توقيت — قابلة للتمويل' },
  heavy: { bg: '#FDF1EC', bd: '#F0D6D2', fg: '#8A3B33', tag: 'حاجة نقدية تفوق الربح' },
  loss: { bg: '#FBEEEC', bd: '#F0D6D2', fg: '#8A3B33', tag: 'العقد لا يربح' },
};

// ── قراءة بنود العقد التي تصنع الفجوة ────────────────────────────────
//
// وهذه أثمن ورقة لمن لم يوقّع بعد: كل بند منها يُقاس أثره بالريال، فيعرف
// على أيّها يفاوض وأيّها يحتمل. ومن وقّع يعرف على الأقل ما التزم به.

export type ClauseRead = { clause: string; yours: string; effect: string; ask: string };

export function readClauses(i: ContractInputs, p: ContractPack, scen: ContractScenario[]): ClauseRead[] {
  const out: ClauseRead[] = [];
  const find = (needle: string): ContractScenario | undefined => scen.find((s: ContractScenario) => s.name.indexOf(needle) >= 0);
  const noAdvance = find('الدفعة المقدمة');
  const slower = find('تأخّر');

  out.push({
    clause: 'الدفعة المقدمة',
    yours: i.advancePct > 0 ? pct(i.advancePct, 0) + ' · ' + money(p.advance) + ' ريال' : 'لا توجد',
    effect: i.advancePct > 0
      ? 'هي التي تُبقي فجوتك عند ' + money(p.gap) + ' ريال. وبدونها تصير ' + money(noAdvance ? noAdvance.gap : p.gap) + '.'
      : 'غيابها وحده يرفع حاجتك النقدية بمقدار قيمة الدفعة التي لم تُصرف لك.',
    ask: i.advancePct > 0
      ? 'اطلب صرفها فور إصدار ضمانها لا بعد التعبئة — التأخير فيها يُلغي أثرها.'
      : 'اطلب دفعة مقدمة ولو ٥٪. وهي أرخص تمويلٍ في العقد: بلا عمولة وبلا جهة.',
  });

  out.push({
    clause: 'مدة صرف المستخلص',
    yours: arMonths(i.collectDelay) + ' من تقديمه',
    effect: slower
      ? 'كل شهرين إضافيين يرفعان حاجتك النقدية إلى ' + money(slower.gap) + ' ريال — ' + pct(slower.pctOfValue) + ' من قيمة العقد.'
      : 'كلما طالت، عمُقت فجوتك — لأنك تصرف بلا أن تُحصّل.',
    ask: 'اطلب سقفاً زمنياً مكتوباً لاعتماد المستخلص لا للصرف وحده. فالتأخير يقع في الاعتماد غالباً لا في الخزينة.',
  });

  out.push({
    clause: 'المحتجزات',
    yours: i.retentionPct > 0 ? pct(i.retentionPct, 0) + ' · ' + money(p.retentionAmount) + ' ريال' : 'لا يوجد',
    effect: i.retentionPct > 0
      ? 'ربحك موقوفٌ فيها حتى الشهر ' + p.retentionMonth + ' — أي ما يعادل ' + pct(p.retentionAmount / Math.max(p.profit, 1), 0) + ' من ربحك محبوسٌ سنةَ ضمان كاملة.'
      : 'بندٌ نظيف. وهذا نادر — احتفظ به في عقودك القادمة.',
    ask: i.retentionPct > 0
      ? 'اطلب استبدالها بضمان بدل محتجزات. يُفرج عن نقدك فوراً ويبقى حق الجهة محفوظاً.'
      : '—',
  });

  out.push({
    clause: 'استرداد الدفعة من المستخلصات',
    yours: i.advanceRecoverPct > 0 ? pct(i.advanceRecoverPct, 0) + ' من كل مستخلص' : 'لا يوجد',
    effect: i.advanceRecoverPct > 0
      ? 'يقتطع من كل تحصيل، فيؤخّر خروجك من العجز حتى بعد وصول أول مستخلص.'
      : 'لا اقتطاع — كل ما تُحصّله يصل إليك كاملاً ناقصاً المحتجز.',
    ask: 'اطلب تأجيل بدء الاسترداد إلى المستخلص الثالث. البند التفاوضي الأسهل في العقد، والأقل مطالبةً به.',
  });

  if ((i.penaltyPct || 0) > 0) {
    out.push({
      clause: 'غرامة التأخير',
      yours: pct(i.penaltyPct || 0, 2) + ' حسب عقدك',
      effect: 'تُحتسب على قيمة العقد لا على ما تأخّر منه في أكثر الصيغ — فتلتهم هامشك بأسابيع.',
      ask: 'اطلب سقفاً أعلى للغرامة، واستثناءً لتأخير سببه اعتمادُ المستخلص أو أوامر التغيير.',
    });
  }

  out.push({
    clause: 'التنازل عن المستحقات',
    yours: 'يُقرأ في عقدك',
    effect: 'إن مَنَع العقد التنازل، سقط تمويل المستخلصات كلّه — وهو أنسب أداة لحالتك.',
    ask: 'اطلب السماح بالتنازل لصالح جهة تمويل مرخّصة. بندٌ لا يكلّف المُسنِد شيئاً، ويفتح لك باباً كاملاً.',
  });

  return out;
}

// ── الوثيقة ───────────────────────────────────────────────────────────

export function buildContractFile(
  co: ContractCompany,
  i: ContractInputs,
  p: ContractPack,
  scen: ContractScenario[],
  legs: FundingLeg[],
  doors: ContractDoor[]
): string {
  const v = verdictOfContract(p);
  const tone = TONE[v.kind];
  const today = new Date().toLocaleDateString('ar-SA');
  const clauses = readClauses(i, p, scen);

  const stat = (val: string, label: string, color?: string) =>
    '<div class="stat"><div class="sv"' + (color ? ' style="color:' + color + '"' : '') + '>' + val + '</div><div class="sl2">' + label + '</div></div>';

  const legRow = (l: FundingLeg) => '<tr>'
    + '<td class="sm">' + esc(l.moment) + '</td>'
    + '<td><b>' + esc(l.instrument) + '</b><div class="lbl">' + esc(l.need) + '</div></td>'
    + '<td class="n">' + (l.amount === null ? '—' : money(l.amount)) + '</td>'
    + '<td class="sm">' + esc(l.note) + '</td>'
    + '</tr>';

  const doorRow = (d: ContractDoor) => {
    const g = gapsOf(d.gaps);
    return '<tr>'
      + '<td><b>' + esc(d.provider || '—') + '</b></td>'
      + '<td class="sm">' + esc(String(d.product || '').slice(0, 90)) + '</td>'
      + '<td class="sm">' + esc(d.amount_range || '—') + '</td>'
      + '<td class="sm">' + esc(d.timeline || '—') + '</td>'
      + '<td class="sm">' + (g.length > 0 ? esc(g.slice(0, 3).join(' · ')) : '<span class="ok">لا نواقص مسجّلة</span>') + '</td>'
      + '</tr>';
  };

  const clauseRow = (c: ClauseRead) => '<tr>'
    + '<td><b>' + esc(c.clause) + '</b></td>'
    + '<td class="sm">' + esc(c.yours) + '</td>'
    + '<td class="sm">' + esc(c.effect) + '</td>'
    + '<td class="sm ask">' + esc(c.ask) + '</td>'
    + '</tr>';

  const head = [
    i.awarderName ? 'المُسنِد: ' + esc(i.awarderName) : '',
    'قيمة العقد ' + money(i.value) + ' ريال',
    'مدة التنفيذ ' + arMonths(i.months),
    i.awarded ? 'مُرسى' : 'قبل الترسية',
    today,
  ].filter(Boolean).join(' · ');

  return `<div class="doc" dir="rtl">
  <div class="eyebrow">مُرضي · حلول المرضي للاستشارات المالية · ترخيص FL-457927015 · سجل 7039663724</div>
  <h1>ملف العقد الائتماني<br>${esc(co.company_name || 'منشأة')}</h1>
  <p class="lede">${head}</p>

  <div class="verdict" style="background:${tone.bg};border-color:${tone.bd}">
    <div class="vtag" style="color:${tone.fg}">${tone.tag}</div>
    <div class="vh" style="color:${tone.fg}">${esc(v.headline)}</div>
    <div class="vb">${esc(v.because)}</div>
  </div>

  <div class="stats">
    ${stat(money(p.profit), 'الربح المتوقع · ' + pct(p.marginPct), p.profit > 0 ? '#1A5C46' : '#8A3B33')}
    ${stat(money(p.gap), p.worst !== null ? 'أعمق فجوة · الشهر ' + p.worst.m : 'أعمق فجوة نقدية', p.gap > 0 ? '#8A3B33' : '#1A5C46')}
    ${stat(money(p.bonds.total), 'ضمانات مطلوبة')}
    ${stat(String(p.horizon), 'شهراً حتى آخر ريال')}
  </div>

  <h2>١ · خريطة عقدك النقدية</h2>
  <p class="mini">جدولٌ شهري من أول يوم تنفيذ إلى الإفراج عن المحتجز. الداخل من دفعتك المقدمة ومستخلصاتك بعد خصم المحتجز والاسترداد، والخارج تكلفتك المباشرة موزّعةً على مدة التنفيذ. والصفّ المظلَّل هو أعمق نقطة — وهو رأس المال العامل الذي يلزمك فعلاً.</p>
  ${renderContractFlow(p)}
  ${p.gap > 0
      ? `<div class="stop"><b>الرقم الذي لم يقله لك أحد:</b> تحتاج ${money(p.gap)} ريال نقداً في الشهر ${p.worst !== null ? p.worst.m : '—'} — أي ${pct(p.gapPct)} من قيمة عقدك — قبل أن ترى أول تحصيل حقيقي. وهذا ليس خسارة، هو فارق توقيت بين صرفك وتحصيلك.</div>`
      : `<div class="key">لا تهبط سيولتك تحت الصفر في أي شهر. عقدك يموّل نفسه، وما يلزمك ضماناتٌ لا نقد.</div>`}

  <h2>٢ · نفس العقد، شروط أخرى</h2>
  <p class="mini">القيمة نفسها والمدة نفسها والتكلفة نفسها — يتغيّر بندٌ أو بندان في العقد وحدهما. اقرأ الفرق بين السطر الأول وما تحته:</p>
  ${renderScenarios(scen)}
  <div class="${scen.some((s: ContractScenario) => s.exceedsProfit) ? 'stop' : 'key'}">
    ${scen.some((s: ContractScenario) => s.exceedsProfit)
      ? 'في بعض هذه الحالات تتجاوز حاجتك النقدية ربحك من العقد كلّه — أي أنك تموّل أكثر ممّا ستجني. وهذه هي اللحظة التي يموت فيها أكثر أصحاب العقود، ولا أحد يحسبها لهم قبل التوقيع.'
      : 'حاجتك النقدية تبقى دون ربحك في كل الحالات المعروضة. وهذا وضعٌ سليم — يعني أن العقد يحتمل تمويله من ربحه.'}
  </div>

  <h2>٣ · حزمة ضماناتك</h2>
  <table>
    <tr><th>الضمان</th><th class="l">المبلغ</th><th>متى يُطلب</th></tr>
    ${p.bonds.bid > 0 ? `<tr><td>ضمان عطاء (ابتدائي)</td><td class="n">${money(p.bonds.bid)}</td><td class="sm">مع تقديم العرض — ولا يُقبل عرضك بدونه</td></tr>` : ''}
    ${p.bonds.advance > 0 ? `<tr><td>ضمان الدفعة المقدمة</td><td class="n">${money(p.bonds.advance)}</td><td class="sm">قبل صرف الدفعة، ويتناقص مع استردادها</td></tr>` : ''}
    ${p.bonds.perf > 0 ? `<tr><td>ضمان حسن الأداء</td><td class="n">${money(p.bonds.perf)}</td><td class="sm">خلال أيام من الترسية — وإلا سقطت عنك</td></tr>` : ''}
    <tr><td><b>الإجمالي</b></td><td class="n">${money(p.bonds.total)}</td><td class="sm">${pct(i.value > 0 ? p.bonds.total / i.value : 0)} من قيمة العقد</td></tr>
    ${p.bonds.cashCover > 0 ? `<tr><td>الغطاء النقدي المطلوب عليها</td><td class="n">${money(p.bonds.cashCover)}</td><td class="sm">وهذا ما يُحجز من حسابك فعلاً — لا كامل قيمة الضمان</td></tr>` : ''}
  </table>
  <p class="mini">أكثر من يُستبعد في هذه اللحظة يُستبعد وهو يظن أن الضمان يلزمه نقداً بكامل قيمته. وهو يُصدَر بغطاء جزئي عند جهات كثيرة، ويُصدَر بكفالة برنامج «كفالة» لمن لا غطاء له. وهذا ما نطرقه لك.</p>

  <h2>٤ · هيكل تمويلك — مركَّباً لا مفرداً</h2>
  <p class="mini">العقد لا يُموَّل بمنتج واحد. لكل لحظة أداتها واسمها عند الجهة، ومن يطرق بأداة واحدة يُردّ وهو مؤهَّل للأخرى. هذه لحظاتك بالترتيب:</p>
  <table>
    <tr><th>متى</th><th>الأداة وما تسدّه</th><th class="l">المبلغ</th><th>ملاحظة تُقال للجهة</th></tr>
    ${legs.map(legRow).join('')}
  </table>

  <h2>٥ · مَن يدفعك — وهو أول ما تسأل عنه اللجنة</h2>
  <div class="key">${esc(awarderNote(i.awarderKind))}</div>
  <p class="mini">الجهة الممولة لا تُقرض قوّتك أنت وحدها في هذا النوع من التمويل — تُقرض قوّة من يدفعك، وقابليةَ مستحقّك للتنازل. ولذلك يُقبل صاحب عقدٍ حكومي بميزانية ضعيفة، ويُردّ صاحب ميزانية قوية بعقدٍ من مُسنِدٍ مجهول.</p>

  <h2>٦ · بنود عقدك التي تصنع الفجوة</h2>
  <p class="mini">${i.awarded
      ? 'عقدك مُرسى، فهذه قراءةٌ لِما التزمت به وكيف يُعالَج بالأدوات لا بالتفاوض.'
      : 'لم تُرسِ بعد — وهذه أثمن صفحة في الملف كلّه: كل بند منها يُقاس أثره بالريال، فتعرف على أيّها تفاوض قبل أن تلتزم.'}</p>
  <table>
    <tr><th>البند</th><th>ما في عقدك</th><th>أثره بالريال</th><th>ما تطلبه</th></tr>
    ${clauses.map(clauseRow).join('')}
  </table>

  ${doors.length > 0 ? `<h2>٧ · جهاتك المرشّحة</h2>
  <p class="mini">${arEntities(doors.length)} انطبقت أدواتها على لحظات عقدك — ضمانات واعتمادات وتسييل مستخلصات. مرتّبةً بحكم المحرك، ومعها ما نقص عندها في ملفك.</p>
  <table>
    <tr><th>الجهة</th><th>الأداة</th><th>الحدود</th><th>المدة</th><th>ما ينقصك عندها</th></tr>
    ${doors.map(doorRow).join('')}
  </table>
  <p class="mini">وطَرقها بالترتيب مقصود: الجهة الثانية ترى أثر استعلام الأولى. ونحن من يخاطبها باسمك ويتابع ردّها ويفاوض على الغطاء والعمولة — لا أنت.</p>`
      : `<h2>٧ · جهاتك المرشّحة</h2>
  <div class="stop">لم تُشغَّل المطابقة على هذا الملف بعد، فلا جهات مسمّاة فيه. وتشغيلها هو الخطوة التالية مباشرةً — وبها يكتمل هذا القسم بالأسماء والحدود وأبواب الدخول.</div>`}

  <h2>٨ · ما لا تشمله هذه الوثيقة</h2>
  <div class="stop">
    هذه قراءةٌ لعقدك وهيكلُ تمويله وجهاتُه. ولا تشمل: إصدار أي ضمان أو تمويل — فالإصدار قرار الجهة لا قرارنا ·
    ولا مراجعةً قانونية لعقدك، وهي تخصّ محامياً لا مستشاراً مالياً · ولا ضماناً لموافقة أي جهة.
    وما نلتزم به: أن نخاطبها باسمك، ونتابع، ونفاوض على الغطاء والعمولة حتى يصدر الضمان أو يُصرف التمويل. وأتعابنا رسمٌ ثابت دفعتَه، لا نسبةَ فيه من تمويلك ولا عمولةَ من أي جهة — فلا مصلحة لنا في جهةٍ دون أخرى، ولا في أن يكبر مبلغك فوق ما تحتمله.
  </div>

  <div class="sig">
    <div class="sn">د. عبدالحكيم المرضي</div>
    <div class="sl">مستشار مالي معتمد · ترخيص FL-457927015 · حلول المرضي للاستشارات المالية</div>
  </div>
  <div class="foot">أُعدّ لصالح ${esc(co.company_name || '')}${co.owner_name ? ' — ' + esc(co.owner_name) : ''} · وثيقة سرّية لا تُتداول خارج أطرافها · ${today}</div>
</div>`;
}

export const CONTRACT_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap');
*{box-sizing:border-box}
body{margin:0;background:#F4F7F6;font-family:Cairo,system-ui,sans-serif;color:#12302A;line-height:1.95;padding:20px 14px 50px}
.doc{max-width:860px;margin:0 auto;background:#fff;border:1px solid #E1EDE8;border-radius:16px;padding:28px 26px}
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
.stats{display:flex;flex-wrap:wrap;gap:10px;margin:16px 0 6px}
.stat{flex:1 1 150px;background:#F7FAF9;border:1.5px solid #E7F1ED;border-radius:12px;padding:12px 14px;text-align:center}
.sv{font-size:19px;font-weight:900;font-variant-numeric:tabular-nums;line-height:1.5}
.sl2{font-size:11.5px;color:#8AA49B;font-weight:700}
table{width:100%;border-collapse:collapse;font-size:13px;margin:10px 0}
th{text-align:right;background:#1A3D34;color:#EAF2EE;padding:8px 11px;font-size:11.5px;font-weight:900}
th.l{text-align:left}
td{padding:8px 11px;border-bottom:1px solid #EFF5F2;vertical-align:top}
td.n{text-align:left;font-weight:900;white-space:nowrap;font-variant-numeric:tabular-nums}
td.sm{font-size:12px;color:#4A6A60;line-height:1.8}
td.ask{color:#1A6B52}
.lbl{font-size:11.5px;color:#8AA49B;font-weight:700}
tr.worst td{background:#FDF1EC;font-weight:900}
tr.skip td{text-align:center;color:#C3D4CD;font-weight:900;padding:2px}
.ok{color:#1A6B52;font-weight:800}
.key{background:#F6FAF8;border-right:4px solid #2E9E7B;border-radius:9px;padding:12px 15px;margin:12px 0;font-size:13.3px}
.stop{background:#FDF1EC;border-right:4px solid #B4622A;border-radius:9px;padding:12px 15px;margin:12px 0;font-size:13.3px}
.sig{margin-top:34px;padding-top:14px;border-top:2px solid #EDF4F1}
.sn{font-size:15px;font-weight:900}
.sl{font-size:11.8px;color:#8AA49B;font-weight:700}
.foot{font-size:11.5px;color:#9DB3AB;text-align:center;padding-top:14px;margin-top:14px;border-top:1px solid #EFF5F2}
/* بلا هذا الأمر يُسقط المتصفّح كل لون خلفية عند الطباعة، فتخرج الوثيقة
   بيضاء بلا رؤوس جداول ولا حكم ملوّن — وهي تُطبع أكثر مما تُقرأ على شاشة:
   العميل يحملها إلى بنك. */
*{-webkit-print-color-adjust:exact;print-color-adjust:exact}
@media print{body{background:#fff;padding:0}.doc{border:none;border-radius:0;padding:0}
  h2,table,.verdict,.key,.stop,.stats{break-inside:avoid}}
`;
