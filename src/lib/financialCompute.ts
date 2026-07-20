// -*- محرك حساب القوائم المالية — حتمي، بلا نموذج -*-
// كل الأرقام تُحسب هنا. النموذج لاحقاً يصيغ فقط، لا يحسب.

export type YearInputs = Record<string, string | undefined>
const n = (v: string | undefined): number => {
  const x = Number(v)
  return isFinite(x) ? x : 0
}

export interface IncomeStatement {
  revenue: number
  cogs: number
  cogsFromComponents: boolean
  cogsInputMismatch: number | null   // فرق بين cogs المُدخل والمحسوب، أو null إن تطابقا/غاب أحدهما
  grossProfit: number
  operatingExpenses: number
  depreciation: number
  doubtfulDebt: number
  operatingProfit: number
  zakat: number
  netProfit: number
}

export function computeIncomeStatement(y: YearInputs): IncomeStatement {
  const revenue = n(y.annual_revenue)

  // تكلفة البضاعة: من المكوّنات إن وجدت، وإلا من الحقل المُدخل
  const oInv = n(y.opening_inventory)
  const pur = n(y.purchases)
  const cInv = n(y.close_inventory)
  const hasComponents = (y.purchases !== undefined && y.purchases !== '')
    || (y.opening_inventory !== undefined && y.opening_inventory !== '')
    || (y.close_inventory !== undefined && y.close_inventory !== '')
  const computedCogs = oInv + pur - cInv
  const inputCogs = n(y.cogs)

  let cogs: number
  let cogsFromComponents: boolean
  let cogsInputMismatch: number | null = null
  if (hasComponents) {
    cogs = computedCogs
    cogsFromComponents = true
    if (y.cogs !== undefined && y.cogs !== '') {
      const diff = inputCogs - computedCogs
      if (Math.abs(diff) > 0.5) cogsInputMismatch = diff
    }
  } else {
    cogs = inputCogs
    cogsFromComponents = false
  }

  const grossProfit = revenue - cogs
  const operatingExpenses = n(y.operating_expenses)
  const depreciation = n(y.depreciation)
  const doubtfulDebt = n(y.doubtful_debt)
  const operatingProfit = grossProfit - operatingExpenses - depreciation
  const zakat = n(y.zakat_due)
  const netProfit = operatingProfit - zakat

  return {
    revenue, cogs, cogsFromComponents, cogsInputMismatch,
    grossProfit, operatingExpenses, depreciation, doubtfulDebt,
    operatingProfit, zakat, netProfit,
  }
}

export interface EquityChanges {
  capital: number
  openingRetainedEarnings: number
  netProfit: number
  distributions: number
  closingRetainedEarnings: number
  ownerCurrentAccount: number   // يُملأ لاحقاً من دالة الميزانية (البند الموازِن)
}

// حقوق الملكية لسنة واحدة. openingREOverride: لقفل سنة ٢ (نمرّر ختامية سنة ١)
export function computeEquity(y: YearInputs, netProfit: number, openingREOverride?: number): EquityChanges {
  const capital = n(y.capital) || n(y.opening_capital)
  const openingRetainedEarnings = openingREOverride !== undefined
    ? openingREOverride
    : n(y.opening_retained_earnings)
  const distributions = n(y.distributions)
  const closingRetainedEarnings = openingRetainedEarnings + netProfit - distributions
  return {
    capital, openingRetainedEarnings, netProfit, distributions,
    closingRetainedEarnings, ownerCurrentAccount: 0,
  }
}

export interface BalanceSheet {
  cash: number
  accountsReceivableNet: number
  inventory: number
  totalCurrentAssets: number
  fixedAssets: number
  ownerReceivable: number       // حساب المالك حين يكون مديناً (يظهر في الأصول)
  totalAssets: number
  accountsPayable: number
  vatDue: number
  zakatDue: number
  eosProvision: number
  totalLiabilities: number
  capital: number
  closingRetainedEarnings: number
  ownerCurrentAccount: number   // حساب المالك حين يكون دائناً (ضمن حقوق الملكية)
  totalEquity: number
  balanced: boolean
  ownerFlag: 'credit' | 'debit' | 'review' | 'none'
  ownerAmountRaw: number        // الفرق الخام قبل التصنيف
  ownerNote: string             // نص التنبيه الجاهز — حتمي حسب الحالة
}

export function computeBalanceSheet(y: YearInputs, eq: EquityChanges): BalanceSheet {
  const cash = n(y.cash_in_banks)
  const arGross = n(y.accounts_receivable)
  const doubtful = n(y.doubtful_debt)
  const accountsReceivableNet = arGross - doubtful
  const inventory = n(y.close_inventory) || n(y.inventory)
  const fixedAssets = n(y.fixed_assets)

  const accountsPayable = n(y.accounts_payable)
  const vatDue = n(y.vat_due)
  const zakatDue = n(y.zakat_due)
  const eosProvision = n(y.eos_provision)
  const totalLiabilities = accountsPayable + vatDue + zakatDue + eosProvision

  const equityBeforeOwner = eq.capital + eq.closingRetainedEarnings
  const assetsBeforeOwner = cash + accountsReceivableNet + inventory + fixedAssets

  // البند الموازِن = الأصول − (الالتزامات + حقوق الملكية قبل المالك)
  const ownerRaw = assetsBeforeOwner - (totalLiabilities + equityBeforeOwner)

  const threshold = 0.15 * Math.abs(equityBeforeOwner)
  let ownerFlag: BalanceSheet['ownerFlag'] = 'none'
  let ownerCurrentAccount = 0
  let ownerReceivable = 0

  if (Math.abs(ownerRaw) < 0.5) {
    ownerFlag = 'none'
  } else if (Math.abs(ownerRaw) > threshold) {
    ownerFlag = 'review'
    if (ownerRaw > 0) ownerCurrentAccount = ownerRaw
    else ownerReceivable = -ownerRaw
  } else if (ownerRaw > 0) {
    ownerFlag = 'credit'
    ownerCurrentAccount = ownerRaw
  } else {
    ownerFlag = 'debit'
    ownerReceivable = -ownerRaw
  }

  const totalCurrentAssets = cash + accountsReceivableNet + inventory
  const totalAssets = assetsBeforeOwner + ownerReceivable
  const totalEquity = equityBeforeOwner + ownerCurrentAccount
  const balanced = Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.5

  const fmt = (x: number) => Math.round(x).toLocaleString('en-US')
  let ownerNote = ''
  if (ownerFlag === 'credit') {
    ownerNote = 'حساب المالك/الشركاء الجاري (' + fmt(ownerCurrentAccount) + ' ريال): رصيد دائن ضمن حقوق الملكية، يمثّل صافي إيداعات المالك الشخصية في المنشأة (مستحق للمالك عليها). ضمن الحدود المعقولة (أقل من 15% من حقوق الملكية)، أُدرج بشفافية دون دفنه في النقد أو الأرباح المرحّلة، ويُطابَق رصيده مع دفاتر المالك عند الاعتماد.'
  } else if (ownerFlag === 'debit') {
    ownerNote = 'حساب المالك/الشركاء الجاري (' + fmt(ownerReceivable) + ' ريال): رصيد مدين يُعرض ضمن الأصول، يمثّل صافي مسحوبات المالك الزائدة عن حقه (مستحق على المالك للمنشأة). ضمن الحدود المعقولة، ويُطابَق مع دفاتر المالك عند الاعتماد.'
  } else if (ownerFlag === 'review') {
    const dir = ownerRaw > 0 ? 'دائن' : 'مدين'
    const amt = fmt(Math.abs(ownerRaw))
    ownerNote = 'فرق ' + dir + ' يحتاج مراجعة الدفاتر (' + amt + ' ريال): يتجاوز الحد المعقول (15% من حقوق الملكية)، ولم يُدرَج ضمن حساب المالك لأنه أكبر من أن يُفسَّر بحركة المالك الشخصية. يُرجّح أنه ناتج عن بند غير مُدرج (قرض، أصل، أو إيراد غير مسجّل) أو خطأ في الأرصدة الافتتاحية. يجب على المحاسب المعتمد تحديد مصدره قبل الاعتماد — القائمة غير مكتملة حتى يُعالَج هذا الفرق.'
  }

  return {
    cash, accountsReceivableNet, inventory, totalCurrentAssets, fixedAssets,
    ownerReceivable, totalAssets, accountsPayable, vatDue, zakatDue, eosProvision,
    totalLiabilities, capital: eq.capital, closingRetainedEarnings: eq.closingRetainedEarnings,
    ownerCurrentAccount, totalEquity, balanced, ownerFlag, ownerAmountRaw: ownerRaw, ownerNote,
  }
}

export interface CashFlow {
  netProfit: number
  depreciation: number
  changeAR: number
  changeInventory: number
  changeAP: number
  changeVAT: number
  changeZakat: number
  changeEOS: number
  operatingCash: number
  investingCash: number
  financingDistributions: number
  ownerAccountMovement: number
  financingCash: number
  netCashChange: number
  openingCash: number
  closingCashComputed: number
  closingCashBook: number
  reconciliationDiff: number   // (المحسوب − الدفتري)، صفر = مطابقة تامة
}

// prevBS: ميزانية السنة السابقة (للتغيّرات في سنة ٢). null للسنة ١ (يُستخدم opening_*)
export function computeCashFlow(
  y: YearInputs, is: IncomeStatement, eq: EquityChanges, bs: BalanceSheet,
  prevBS: BalanceSheet | null, ownerMovement: number
): CashFlow {
  // الأرصدة الافتتاحية: من السنة السابقة إن وُجدت، وإلا من حقول opening_*
  const openAR   = prevBS ? prevBS.accountsReceivableNet : n(y.opening_ar)
  const openInv  = prevBS ? prevBS.inventory            : n(y.opening_inventory)
  const openAP   = prevBS ? prevBS.accountsPayable      : n(y.opening_ap)
  const openVAT  = prevBS ? prevBS.vatDue               : n(y.opening_vat)
  const openZak  = prevBS ? prevBS.zakatDue             : n(y.opening_zakat)
  const openEOS  = prevBS ? prevBS.eosProvision         : n(y.eos_opening)
  const openCash = prevBS ? prevBS.cash                 : n(y.opening_cash)
  const openFA   = prevBS ? prevBS.fixedAssets          : n(y.opening_fixed_assets)

  // تغيّرات رأس المال العامل (زيادة أصل تُنقص النقد؛ زيادة التزام تزيده)
  const changeAR        = -(bs.accountsReceivableNet - openAR)
  const changeInventory = -(bs.inventory - openInv)
  const changeAP        =  (bs.accountsPayable - openAP)
  const changeVAT       =  (bs.vatDue - openVAT)
  const changeZakat     =  (bs.zakatDue - openZak)
  const changeEOS       =  (bs.eosProvision - openEOS)

  const operatingCash = is.netProfit + is.depreciation
    + changeAR + changeInventory + changeAP + changeVAT + changeZakat + changeEOS

  // الاستثماري: صافي الحركة في الأصول الثابتة = (الختامي − الافتتاحي + الإهلاك) بإشارة سالبة (شراء)
  const investingCash = -((bs.fixedAssets - openFA) + is.depreciation)

  // التمويلي: توزيعات (سالب) + حركة حساب المالك
  const financingDistributions = -eq.distributions
  const ownerAccountMovement = ownerMovement
  const financingCash = financingDistributions + ownerAccountMovement

  const netCashChange = operatingCash + investingCash + financingCash
  const closingCashComputed = openCash + netCashChange
  const closingCashBook = bs.cash
  const reconciliationDiff = closingCashComputed - closingCashBook

  return {
    netProfit: is.netProfit, depreciation: is.depreciation,
    changeAR, changeInventory, changeAP, changeVAT, changeZakat, changeEOS,
    operatingCash, investingCash, financingDistributions, ownerAccountMovement,
    financingCash, netCashChange, openingCash: openCash,
    closingCashComputed, closingCashBook, reconciliationDiff,
  }
}

// تصنيف فرق سنة التأسيس بناءً على إجابة العميل (رمز ثابت لا نص حر)
export type GapCode =
  | 'owner_deposit'      // ضخّ المالك فلوسه → حساب مالك دائن (حقوق ملكية)
  | 'prior_profit'       // أرباح سابقة غير مسحوبة → أرباح مرحّلة
  | 'loan'               // قرض/تمويل خارجي → التزام
  | 'unlisted_assets'    // أصول مملوكة غير مُدرجة → أصول
  | 'unsure'             // غير متأكد → يُترك للمراجعة

export interface GapClassification {
  code: GapCode
  amount: number
  target: 'equity_owner' | 'retained_earnings' | 'liability' | 'assets' | 'review'
  label: string
  note: string
  resolved: boolean   // true = أُدرج في بند نهائي؛ false = يبقى للمراجعة
}

export function classifyGap(code: GapCode, amount: number): GapClassification {
  const fmt = (x: number) => Math.round(Math.abs(x)).toLocaleString('en-US')
  const a = fmt(amount)
  switch (code) {
    case 'owner_deposit':
      return { code, amount, target: 'equity_owner', resolved: true,
        label: 'حساب المالك/الشركاء الجاري',
        note: 'أفاد المالك أن الفرق (' + a + ' ريال) يمثّل أموالاً ضخّها في المنشأة من ماله الخاص، فأُدرج كرصيد دائن ضمن حقوق الملكية (مستحق للمالك على المنشأة)، ويُطابَق مع دفاتره عند الاعتماد.' }
    case 'prior_profit':
      return { code, amount, target: 'retained_earnings', resolved: true,
        label: 'أرباح مرحّلة من سنوات سابقة',
        note: 'أفاد المالك أن الفرق (' + a + ' ريال) يمثّل أرباح سنوات سابقة لم تُسحب، فأُضيف إلى الأرباح المرحّلة الافتتاحية. يُستحسن دعمه بدفاتر السنوات السابقة عند الاعتماد.' }
    case 'loan':
      return { code, amount, target: 'liability', resolved: true,
        label: 'قرض/تمويل خارجي',
        note: 'أفاد المالك أن الفرق (' + a + ' ريال) يمثّل قرضاً أو تمويلاً خارجياً، فأُدرج ضمن الالتزامات. يُطابَق مع عقد التمويل وكشف الرصيد عند الاعتماد.' }
    case 'unlisted_assets':
      return { code, amount, target: 'assets', resolved: true,
        label: 'أصول مملوكة غير مُدرجة',
        note: 'أفاد المالك أن الفرق (' + a + ' ريال) يمثّل أصولاً تملكها المنشأة لم تُدرج (عقار/مركبات/معدات)، فأُدرجت ضمن الأصول الثابتة. يُوثّق تقييمها ومستنداتها عند الاعتماد.' }
    default:
      return { code: 'unsure', amount, target: 'review', resolved: false,
        label: 'فرق يحتاج مراجعة الدفاتر',
        note: 'لم يُحدَّد مصدر الفرق (' + a + ' ريال) بعد. يجب على المحاسب المعتمد تحديد مصدره من الدفاتر قبل الاعتماد — القائمة غير مكتملة حتى يُعالَج.' }
  }
}

export interface ComputedStatements {
  incomeY1: IncomeStatement; incomeY2: IncomeStatement
  equityY1: EquityChanges;    equityY2: EquityChanges
  balanceY1: BalanceSheet;    balanceY2: BalanceSheet
  cashY1: CashFlow;           cashY2: CashFlow
  gapY1: GapClassification | null
  gapY2: GapClassification | null
  fullyResolved: boolean
}

// years: { '1': {...}, '2': {...} } — نفس بنية inputs.years
export function buildComputedStatements(years: Record<string, YearInputs>): ComputedStatements {
  const y1 = years['1'] || {}
  const y2 = years['2'] || {}

  const incomeY1 = computeIncomeStatement(y1)
  const incomeY2 = computeIncomeStatement(y2)

  const equityY1 = computeEquity(y1, incomeY1.netProfit)
  const equityY2 = computeEquity(y2, incomeY2.netProfit, equityY1.closingRetainedEarnings) // القفل

  const balanceY1 = computeBalanceSheet(y1, equityY1)
  const balanceY2 = computeBalanceSheet(y2, equityY2)

  const cashY1 = computeCashFlow(y1, incomeY1, equityY1, balanceY1, null, balanceY1.ownerCurrentAccount)
  const cashY2 = computeCashFlow(y2, incomeY2, equityY2, balanceY2, balanceY1,
    balanceY2.ownerCurrentAccount - balanceY1.ownerCurrentAccount)

  // تصنيف الفرق من اختيار العميل (gap_classification_y1/y2) إن وُجد فرق review
  const gapY1 = (balanceY1.ownerFlag === 'review' && y1.gap_classification)
    ? classifyGap(y1.gap_classification as GapCode, balanceY1.ownerAmountRaw) : null
  const gapY2 = (balanceY2.ownerFlag === 'review' && y2.gap_classification)
    ? classifyGap(y2.gap_classification as GapCode, balanceY2.ownerAmountRaw) : null

  // مكتمل = ما فيه فرق review غير مُصنّف (أو مُصنّف resolved) في أي سنة
  const y1ok = balanceY1.ownerFlag !== 'review' || (gapY1?.resolved ?? false)
  const y2ok = balanceY2.ownerFlag !== 'review' || (gapY2?.resolved ?? false)
  const fullyResolved = y1ok && y2ok

  return { incomeY1, incomeY2, equityY1, equityY2, balanceY1, balanceY2,
    cashY1, cashY2, gapY1, gapY2, fullyResolved }
}

// ═══ مولّد جداول القوائم (HTML) — الكود يبني الأرقام والعرض، النموذج يصيغ التفسير فقط ═══
const money = (x: number): string => {
  const r = Math.round(x)
  const s = Math.abs(r).toLocaleString('en-US')
  return r < 0 ? '(' + s + ')' : s
}
const row = (label: string, y1: string, y2: string, bold = false): string =>
  '<tr' + (bold ? ' style="font-weight:700;background:#F7FAF9"' : '') + '>'
  + '<td style="padding:7px 10px;border-bottom:1px solid #EAF2EE">' + label + '</td>'
  + '<td style="padding:7px 10px;border-bottom:1px solid #EAF2EE;text-align:left;direction:ltr">' + y1 + '</td>'
  + '<td style="padding:7px 10px;border-bottom:1px solid #EAF2EE;text-align:left;direction:ltr">' + y2 + '</td></tr>'

function tableWrap(title: string, bodyRows: string): string {
  return '<h3 style="color:#1A3D34;font-family:Cairo,sans-serif;margin:18px 0 8px">' + title + '</h3>'
    + '<table style="width:100%;border-collapse:collapse;font-family:Cairo,sans-serif;font-size:13px">'
    + '<thead><tr style="background:#1A3D34;color:#fff">'
    + '<th style="padding:8px 10px;text-align:right">البند</th>'
    + '<th style="padding:8px 10px;text-align:left">السنة الأولى (ريال)</th>'
    + '<th style="padding:8px 10px;text-align:left">السنة الثانية (ريال)</th>'
    + '</tr></thead><tbody>' + bodyRows + '</tbody></table>'
}

export function renderIncomeTable(a: IncomeStatement, b: IncomeStatement): string {
  const r = [
    row('الإيرادات', money(a.revenue), money(b.revenue)),
    row('تكلفة النشاط (البضاعة/الخدمة)', money(-a.cogs), money(-b.cogs)),
    row('مجمل الربح', money(a.grossProfit), money(b.grossProfit), true),
    row('المصروفات التشغيلية', money(-a.operatingExpenses), money(-b.operatingExpenses)),
    row('مصروف الإهلاك', money(-a.depreciation), money(-b.depreciation)),
    a.doubtfulDebt || b.doubtfulDebt ? row('مخصص الديون المشكوك فيها', money(-a.doubtfulDebt), money(-b.doubtfulDebt)) : '',
    row('الربح التشغيلي', money(a.operatingProfit), money(b.operatingProfit), true),
    row('الزكاة', money(-a.zakat), money(-b.zakat)),
    row('صافي الربح', money(a.netProfit), money(b.netProfit), true),
  ].join('')
  return tableWrap('قائمة الدخل', r)
}

export function renderBalanceTable(a: BalanceSheet, b: BalanceSheet): string {
  const assets = [
    row('النقد وما في حكمه (البنوك)', money(a.cash), money(b.cash)),
    row('الذمم المدينة (صافي)', money(a.accountsReceivableNet), money(b.accountsReceivableNet)),
    row('المخزون', money(a.inventory), money(b.inventory)),
    (a.ownerReceivable || b.ownerReceivable) ? row('حساب المالك الجاري (مدين)', money(a.ownerReceivable), money(b.ownerReceivable)) : '',
    row('الأصول الثابتة (صافي)', money(a.fixedAssets), money(b.fixedAssets)),
    row('إجمالي الأصول', money(a.totalAssets), money(b.totalAssets), true),
  ].join('')
  const liab = [
    row('الذمم الدائنة (موردون)', money(a.accountsPayable), money(b.accountsPayable)),
    row('ضريبة القيمة المضافة المستحقة', money(a.vatDue), money(b.vatDue)),
    row('الزكاة المستحقة', money(a.zakatDue), money(b.zakatDue)),
    row('مخصص نهاية الخدمة', money(a.eosProvision), money(b.eosProvision)),
    row('إجمالي الالتزامات', money(a.totalLiabilities), money(b.totalLiabilities), true),
  ].join('')
  const equity = [
    row('رأس المال', money(a.capital), money(b.capital)),
    row('الأرباح المرحّلة (ختامية)', money(a.closingRetainedEarnings), money(b.closingRetainedEarnings)),
    (a.ownerCurrentAccount || b.ownerCurrentAccount) ? row('حساب المالك الجاري (دائن)', money(a.ownerCurrentAccount), money(b.ownerCurrentAccount)) : '',
    row('إجمالي حقوق الملكية', money(a.totalEquity), money(b.totalEquity), true),
    row('إجمالي الالتزامات وحقوق الملكية', money(a.totalLiabilities + a.totalEquity), money(b.totalLiabilities + b.totalEquity), true),
  ].join('')
  return tableWrap('قائمة المركز المالي', assets)
    + '<div style="margin-top:6px">' + tableWrap('الالتزامات', liab) + '</div>'
    + '<div style="margin-top:6px">' + tableWrap('حقوق الملكية', equity) + '</div>'
}

export function renderCashFlowTable(a: CashFlow, b: CashFlow): string {
  const sec = (t: string) => '<tr style="background:#EAF2EE;font-weight:700"><td colspan="3" style="padding:6px 10px">' + t + '</td></tr>'
  const r =
    sec('الأنشطة التشغيلية')
    + row('صافي الربح', money(a.netProfit), money(b.netProfit))
    + row('(+) الإهلاك (غير نقدي)', money(a.depreciation), money(b.depreciation))
    + row('التغيّر في الذمم المدينة', money(a.changeAR), money(b.changeAR))
    + row('التغيّر في المخزون', money(a.changeInventory), money(b.changeInventory))
    + row('التغيّر في الذمم الدائنة', money(a.changeAP), money(b.changeAP))
    + row('التغيّر في ضريبة القيمة المضافة', money(a.changeVAT), money(b.changeVAT))
    + row('التغيّر في الزكاة المستحقة', money(a.changeZakat), money(b.changeZakat))
    + row('التغيّر في مخصص نهاية الخدمة', money(a.changeEOS), money(b.changeEOS))
    + row('صافي النقد من التشغيل', money(a.operatingCash), money(b.operatingCash), true)
    + sec('الأنشطة الاستثمارية')
    + row('صافي الحركة في الأصول الثابتة', money(a.investingCash), money(b.investingCash))
    + row('صافي النقد من الاستثمار', money(a.investingCash), money(b.investingCash), true)
    + sec('الأنشطة التمويلية')
    + row('التوزيعات/المسحوبات', money(a.financingDistributions), money(b.financingDistributions))
    + row('حركة حساب المالك الجاري', money(a.ownerAccountMovement), money(b.ownerAccountMovement))
    + row('صافي النقد من التمويل', money(a.financingCash), money(b.financingCash), true)
    + sec('مطابقة النقد')
    + row('صافي التغيّر في النقد', money(a.netCashChange), money(b.netCashChange))
    + row('النقد الافتتاحي', money(a.openingCash), money(b.openingCash))
    + row('النقد الختامي (محسوب)', money(a.closingCashComputed), money(b.closingCashComputed), true)
    + row('النقد الختامي بالدفاتر', money(a.closingCashBook), money(b.closingCashBook))
    + (a.reconciliationDiff || b.reconciliationDiff ? row('فرق للمطابقة', money(a.reconciliationDiff), money(b.reconciliationDiff)) : '')
  return tableWrap('قائمة التدفقات النقدية', r)
}

export function renderEquityChangesTable(a: EquityChanges, b: EquityChanges, ao: number, bo: number): string {
  const r =
    row('رأس المال', money(a.capital), money(b.capital))
    + row('الأرباح المرحّلة — الافتتاحية', money(a.openingRetainedEarnings), money(b.openingRetainedEarnings))
    + row('(+) صافي ربح السنة', money(a.netProfit), money(b.netProfit))
    + row('(−) التوزيعات', money(-a.distributions), money(-b.distributions))
    + row('الأرباح المرحّلة — الختامية', money(a.closingRetainedEarnings), money(b.closingRetainedEarnings), true)
    + (ao || bo ? row('حساب المالك الجاري', money(ao), money(bo)) : '')
    + row('إجمالي حقوق الملكية', money(a.capital + a.closingRetainedEarnings + ao), money(b.capital + b.closingRetainedEarnings + bo), true)
  return tableWrap('قائمة التغيّرات في حقوق الملكية', r)
}

export function renderNotes(c: ComputedStatements): string {
  const notes: string[] = [
    'أُعدّت هذه القوائم وفق معايير الهيئة السعودية للمراجعين والمحاسبين (SOCPA) على أساس الاستحقاق ومبدأ الاستمرارية، بالريال السعودي، بعمودين للمقارنة بين السنتين.',
    'تكلفة النشاط محسوبة من مكوّناتها (المخزون الافتتاحي + المشتريات − المخزون الختامي) حين توفّرها؛ والتحقق المستندي النهائي (الفواتير، الكشوف البنكية، جرد المخزون) من اختصاص المحاسب القانوني المعتمد عند الاعتماد.',
    'الأرباح المرحّلة الختامية محسوبة بالمعادلة: الافتتاحية + صافي الربح − التوزيعات؛ ورصيد افتتاحي السنة الثانية مقفل ومترابط تلقائياً مع ختامي السنة الأولى.',
    'مصروف الإهلاك عولج كبند مستقل يُطرح مرة واحدة في قائمة الدخل ويُضاف كبند غير نقدي في التدفقات التشغيلية.',
  ]
  // تنبيه حساب المالك / الفرق (نصوص حتمية من الدوال)
  const ownerNotes: string[] = []
  if (c.gapY1) ownerNotes.push('السنة الأولى: ' + c.gapY1.note)
  else if (c.balanceY1.ownerNote) ownerNotes.push('السنة الأولى: ' + c.balanceY1.ownerNote)
  if (c.gapY2) ownerNotes.push('السنة الثانية: ' + c.gapY2.note)
  else if (c.balanceY2.ownerNote) ownerNotes.push('السنة الثانية: ' + c.balanceY2.ownerNote)

  const li = (t: string, i: number) => '<p style="margin:6px 0;font-size:13px;line-height:1.9"><b>إيضاح (' + (i+1) + '):</b> ' + t + '</p>'
  const oli = (t: string) => '<p style="margin:6px 0;font-size:13px;line-height:1.9;color:#8A6D1A">• ' + t + '</p>'
  return '<h3 style="color:#1A3D34;font-family:Cairo,sans-serif;margin:18px 0 8px">الإيضاحات المتممة</h3>'
    + notes.map(li).join('')
    + (ownerNotes.length ? '<div style="margin-top:10px;background:#FBF7EC;border:1px solid #E8D9A8;border-radius:8px;padding:10px 14px">' + ownerNotes.map(oli).join('') + '</div>' : '')
}

// الدالة الجامعة: كل القوائم الخمس + الإيضاحات في وثيقة واحدة
export function renderStatementsHtml(c: ComputedStatements): string {
  return '<div style="font-family:Cairo,sans-serif" dir="rtl">'
    + renderIncomeTable(c.incomeY1, c.incomeY2)
    + renderBalanceTable(c.balanceY1, c.balanceY2)
    + renderCashFlowTable(c.cashY1, c.cashY2)
    + renderEquityChangesTable(c.equityY1, c.equityY2, c.balanceY1.ownerCurrentAccount, c.balanceY2.ownerCurrentAccount)
    + renderNotes(c)
    + '</div>'
}
