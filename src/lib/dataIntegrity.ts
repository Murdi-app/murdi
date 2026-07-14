// فحص سلامة البيانات المالية قبل توليد أي مخرَج يُخاطَب به طرف خارجي.
// الهدف: منع خروج وثيقة باسم حلول المرضي تحمل تناقضاً حسابياً.
//
// ملاحظة مهمة: المنصة تستخدم اسمين مختلفين لحقول الدين بحسب المسار:
//   - مسار التمويل (funding):            original_loan_amount / debt_remaining
//   - مسارا الاستثمار والطرح (inv/ipo):  total_financing      / remaining_debt
// هذا الملف يوحّدهما.

export type IntegrityIssue = {
  code: string
  title: string
  detail: string
  fields: string[]
}

export type FinancialInput = {
  has_debt?: boolean | string | null
  // مسار التمويل
  original_loan_amount?: number | string | null
  debt_remaining?: number | string | null
  // مسارا الاستثمار والطرح
  total_financing?: number | string | null
  remaining_debt?: number | string | null
  annual_revenue?: number | string | null
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

const truthy = (v: unknown) => v === true || v === 'yes' || v === 'true'

// يوحّد الحقلين بغض النظر عن المسار
export function normalizeDebt(fd: FinancialInput | null) {
  if (!fd) return { original: null, remaining: null, revenue: null }
  return {
    original: num(fd.original_loan_amount) ?? num(fd.total_financing),
    remaining: num(fd.debt_remaining) ?? num(fd.remaining_debt),
    revenue: num(fd.annual_revenue),
  }
}

export function checkFinancialIntegrity(fd: FinancialInput | null): IntegrityIssue[] {
  const issues: IntegrityIssue[] = []
  if (!fd) {
    issues.push({
      code: 'NO_DATA',
      title: 'لا توجد بيانات مالية',
      detail: 'لم يُعثر على سجل مالي لهذه الشركة. لا يمكن توليد وثيقة بلا أرقام.',
      fields: [],
    })
    return issues
  }

  const { original: orig, remaining: rem, revenue: rev } = normalizeDebt(fd)
  const hasDebt = truthy(fd.has_debt)

  // 1) المتبقي أكبر من الأصل — تناقض حسابي صارخ
  if (orig !== null && rem !== null && orig > 0 && rem > orig) {
    issues.push({
      code: 'DEBT_EXCEEDS_ORIGINAL',
      title: 'المتبقي من الدين يتجاوز أصل التمويل',
      detail: 'أصل التمويل المسجّل ' + orig.toLocaleString('en-US') + ' ريال، بينما المتبقي ' + rem.toLocaleString('en-US') + ' ريال. الرقمان متناقضان، ولا يمكن أن يتجاوز المتبقي الأصل. يجب الحصول على كشف رسمي من الجهة الممولة قبل التوليد.',
      fields: ['original_loan_amount', 'debt_remaining'],
    })
  }

  // 2) دين مُعلن بلا أرقام مكتملة
  if (hasDebt && (orig === null || orig <= 0 || rem === null)) {
    issues.push({
      code: 'DEBT_MISSING_FIGURES',
      title: 'دين قائم بلا أرقام مكتملة',
      detail: 'الشركة أقرّت بوجود دين، لكن أرقام أصل التمويل أو المتبقي ناقصة. أي وثيقة تُخاطَب بها جهة تمويلية يجب أن تحمل أرقام دين دقيقة.',
      fields: ['original_loan_amount', 'debt_remaining'],
    })
  }

  // 3) إيراد مفقود أو صفر
  if (rev === null || rev <= 0) {
    issues.push({
      code: 'REVENUE_MISSING',
      title: 'الإيراد السنوي مفقود أو صفر',
      detail: 'لا يمكن بناء ملف تمويلي بلا إيراد سنوي موثوق — فهو أساس تقدير القدرة على السداد.',
      fields: ['annual_revenue'],
    })
  }

  return issues
}
