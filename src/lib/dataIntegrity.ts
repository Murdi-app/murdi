// فحص سلامة البيانات المالية قبل توليد أي مخرَج يُخاطَب به طرف خارجي.
// الهدف: منع خروج وثيقة باسم حلول المرضي تحمل تناقضاً حسابياً.

export type IntegrityIssue = {
  code: string
  title: string
  detail: string
  fields: string[]
}

export type FinancialInput = {
  has_debt?: boolean | null
  total_financing?: number | string | null
  remaining_debt?: number | string | null
  annual_revenue?: number | string | null
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
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

  const orig = num(fd.total_financing)
  const rem = num(fd.remaining_debt)
  const rev = num(fd.annual_revenue)
  const hasDebt = fd.has_debt === true

  // 1) المتبقي أكبر من الأصل — تناقض حسابي صارخ
  if (orig !== null && rem !== null && orig > 0 && rem > orig) {
    issues.push({
      code: 'DEBT_EXCEEDS_ORIGINAL',
      title: 'المتبقي من الدين يتجاوز أصل التمويل',
      detail: 'أصل التمويل المسجّل ' + orig.toLocaleString('en-US') + ' ريال، بينما المتبقي ' + rem.toLocaleString('en-US') + ' ريال. الرقمان متناقضان، ولا يمكن أن يتجاوز المتبقي الأصل. يجب الحصول على كشف رسمي من الجهة الممولة قبل التوليد.',
      fields: ['total_financing', 'remaining_debt'],
    })
  }

  // 2) دين مُعلن بلا أرقام
  if (hasDebt && (orig === null || orig <= 0 || rem === null)) {
    issues.push({
      code: 'DEBT_MISSING_FIGURES',
      title: 'دين قائم بلا أرقام مكتملة',
      detail: 'الشركة أقرّت بوجود دين، لكن أرقام أصل التمويل أو المتبقي ناقصة. أي وثيقة تُخاطَب بها جهة تمويلية يجب أن تحمل أرقام دين دقيقة.',
      fields: ['total_financing', 'remaining_debt'],
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
