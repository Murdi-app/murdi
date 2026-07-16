// تعريف الأنشطة التجارية وحقولها المالية لخدمة إعداد القوائم المالية.
// كل نشاط يحدد: مسمّى تكلفة النشاط، والحقول الخاصة به.
// الحقول المالية الأساسية موحّدة (المحاسبة لغة واحدة)، وتُضاف حقول خاصة بكل نشاط.

export type FieldDef = {
  key: string
  label: string
  hint?: string
  group: 'income' | 'assets' | 'liabilities' | 'equity'
}

export type ActivityDef = {
  key: string
  name: string
  costLabel: string        // مسمّى تكلفة النشاط (يتغير حسب القطاع)
  specificFields: FieldDef[] // حقول خاصة بهذا النشاط فقط
}

// الحقول المشتركة لكل الأنشطة
export const COMMON_FIELDS: FieldDef[] = [
  { key: 'annual_revenue', label: 'الإيراد السنوي', hint: 'إجمالي المبيعات/الإيرادات للسنة', group: 'income' },
  { key: 'operating_expenses', label: 'المصروفات التشغيلية', hint: 'رواتب، إيجارات، مصاريف إدارية وبيعية', group: 'income' },
  { key: 'cash_in_banks', label: 'النقد في البنوك', hint: 'الرصيد بنهاية السنة', group: 'assets' },
  { key: 'accounts_receivable', label: 'الذمم المدينة', hint: 'مستحقات على العملاء الآجلين', group: 'assets' },
  { key: 'doubtful_debt', label: 'مخصص الديون المشكوك فيها', hint: 'يُطرح من الذمم المدينة لإظهار صافيها', group: 'assets' },
  { key: 'fixed_assets', label: 'الأصول الثابتة', hint: 'المعدات والأجهزة بالتكلفة', group: 'assets' },
  { key: 'accounts_payable', label: 'الذمم الدائنة', hint: 'مستحقات للموردين', group: 'liabilities' },
  { key: 'zakat_due', label: 'الزكاة المستحقة', hint: 'مخصص الزكاة', group: 'liabilities' },
  { key: 'vat_due', label: 'ضريبة القيمة المضافة المستحقة', group: 'liabilities' },
  { key: 'eos_provision', label: 'مخصص نهاية الخدمة', hint: 'مكافآت نهاية خدمة الموظفين', group: 'liabilities' },
  { key: 'capital', label: 'رأس المال', group: 'equity' },
  { key: 'opening_capital', label: 'رأس المال أول المدة', hint: 'رأس المال المسجّل في بداية السنة', group: 'equity' },
  { key: 'opening_retained_earnings', label: 'الأرباح المرحّلة أول المدة', hint: 'رصيد الأرباح المتراكمة من دفاتر السنة السابقة — يُدخل ولا يُحسب بالطرح', group: 'equity' },
  { key: 'opening_cash', label: 'النقد أول المدة', hint: 'رصيد النقد في بداية السنة (للمقارنة والتدفقات)', group: 'assets' },
  { key: 'opening_ar', label: 'الذمم المدينة أول المدة', hint: 'أرصدة العملاء في بداية السنة', group: 'assets' },
  { key: 'opening_inventory', label: 'المخزون أول المدة', hint: 'قيمة المخزون في بداية السنة', group: 'assets' },
  { key: 'opening_ap', label: 'الذمم الدائنة أول المدة', hint: 'أرصدة الموردين في بداية السنة', group: 'liabilities' },
  { key: 'purchases', label: 'المشتريات خلال السنة', hint: 'مكوّن لاشتقاق تكلفة البضاعة بدل إدخالها رقما واحداً', group: 'income' },
  { key: 'close_inventory', label: 'المخزون آخر المدة', hint: 'يجب أن يطابق المخزون في قائمة المركز المالي', group: 'income' },
  { key: 'employee_count', label: 'عدد الموظفين', hint: 'لو أكبر من صفر يلزم مخصص نهاية خدمة موجب', group: 'liabilities' },
  { key: 'monthly_wage_bill', label: 'إجمالي الرواتب الشهرية', hint: 'لتقدير حركة مخصص نهاية الخدمة', group: 'liabilities' },
  { key: 'eos_opening', label: 'مخصص نهاية الخدمة أول المدة', hint: 'رصيد موجب فقط — لا يُقبل سالب', group: 'liabilities' },
  { key: 'distributions', label: 'التوزيعات/المسحوبات خلال السنة', hint: 'مسحوبات المالك أو توزيعات الأرباح', group: 'equity' },
  { key: 'opening_fixed_assets', label: 'الأصول الثابتة أول المدة', hint: 'صافي قيمة الأصول الثابتة في بداية السنة', group: 'assets' },
  { key: 'depreciation', label: 'مصروف الإهلاك السنوي', hint: 'إهلاك الأصول الثابتة المحمّل على السنة — يُغلق النشاط الاستثماري', group: 'assets' },
]

export const ACTIVITIES: ActivityDef[] = [
  {
    key: 'trade', name: 'تجارة (جملة/تجزئة)', costLabel: 'تكلفة البضاعة المباعة',
    specificFields: [
      { key: 'cogs', label: 'تكلفة البضاعة المباعة', hint: 'مخزون أول + مشتريات − مخزون آخر', group: 'income' },
      { key: 'inventory', label: 'المخزون البضاعي', hint: 'قيمة البضاعة بنهاية السنة بالتكلفة', group: 'assets' },
    ],
  },
  {
    key: 'contracting', name: 'مقاولات وإنشاءات', costLabel: 'تكلفة العقود المنفّذة',
    specificFields: [
      { key: 'cogs', label: 'تكلفة العقود المنفّذة', hint: 'مواد + عمالة + مقاولين من الباطن', group: 'income' },
      { key: 'wip', label: 'أعمال تحت التنفيذ', hint: 'قيمة المشاريع الجارية غير المكتملة', group: 'assets' },
      { key: 'advances_received', label: 'دفعات مقدمة من العملاء', hint: 'مبالغ مقبوضة عن مشاريع لم تُنفّذ بعد', group: 'liabilities' },
    ],
  },
  {
    key: 'logistics', name: 'خدمات لوجستية ونقل', costLabel: 'تكلفة التشغيل',
    specificFields: [
      { key: 'cogs', label: 'تكلفة التشغيل', hint: 'وقود، صيانة، رواتب سائقين، تأمين أسطول', group: 'income' },
      { key: 'fleet_value', label: 'قيمة الأسطول', hint: 'المركبات بالتكلفة ناقص الإهلاك', group: 'assets' },
    ],
  },
  {
    key: 'services', name: 'خدمات مهنية (استشارات/تقنية)', costLabel: 'تكلفة تقديم الخدمة',
    specificFields: [
      { key: 'cogs', label: 'تكلفة تقديم الخدمة', hint: 'أجور الفريق المنفّذ ومصاريف مباشرة', group: 'income' },
    ],
  },
  {
    key: 'restaurant', name: 'مطاعم وضيافة', costLabel: 'تكلفة المواد الغذائية',
    specificFields: [
      { key: 'cogs', label: 'تكلفة المواد الغذائية', hint: 'مواد أولية + مشتريات مطبخ', group: 'income' },
      { key: 'inventory', label: 'مخزون المواد', hint: 'المخزون بنهاية السنة (سريع التلف)', group: 'assets' },
    ],
  },
  {
    key: 'manufacturing', name: 'صناعة وتصنيع', costLabel: 'تكلفة الإنتاج',
    specificFields: [
      { key: 'cogs', label: 'تكلفة الإنتاج', hint: 'مواد خام + عمالة مباشرة + تكاليف صناعية', group: 'income' },
      { key: 'inventory', label: 'المخزون', hint: 'مواد خام + تحت التشغيل + تام الصنع', group: 'assets' },
    ],
  },
  {
    key: 'healthcare', name: 'رعاية صحية (عيادات)', costLabel: 'تكلفة الخدمات الطبية',
    specificFields: [
      { key: 'cogs', label: 'تكلفة الخدمات الطبية', hint: 'مستلزمات طبية + أجور كوادر', group: 'income' },
      { key: 'medical_equipment', label: 'الأجهزة الطبية', hint: 'قيمة الأجهزة بالتكلفة ناقص الإهلاك', group: 'assets' },
    ],
  },
  {
    key: 'realestate', name: 'عقارات وتطوير', costLabel: 'تكلفة الوحدات المباعة',
    specificFields: [
      { key: 'cogs', label: 'تكلفة الوحدات المباعة', hint: 'تكلفة تطوير/شراء الوحدات المبيعة', group: 'income' },
      { key: 'property_inventory', label: 'المخزون العقاري', hint: 'قيمة الوحدات المتاحة للبيع', group: 'assets' },
    ],
  },
  {
    key: 'education', name: 'تعليم وتدريب', costLabel: 'تكلفة التشغيل التعليمي',
    specificFields: [
      { key: 'cogs', label: 'تكلفة التشغيل التعليمي', hint: 'أجور المعلمين والمدربين ومواد', group: 'income' },
      { key: 'deferred_revenue', label: 'إيراد مؤجل', hint: 'رسوم مقبوضة عن فترات لم تبدأ بعد', group: 'liabilities' },
    ],
  },
  {
    key: 'agriculture', name: 'زراعة', costLabel: 'تكلفة المحاصيل',
    specificFields: [
      { key: 'cogs', label: 'تكلفة المحاصيل', hint: 'بذور، أسمدة، ري، عمالة', group: 'income' },
      { key: 'bio_assets', label: 'الأصول البيولوجية', hint: 'محاصيل/ماشية قائمة', group: 'assets' },
    ],
  },
  {
    key: 'saas', name: 'تقنية وبرمجيات (SaaS)', costLabel: 'تكلفة الاستضافة والتطوير',
    specificFields: [
      { key: 'cogs', label: 'تكلفة الاستضافة والتطوير', hint: 'خوادم + أجور مطورين مباشرة', group: 'income' },
      { key: 'deferred_revenue', label: 'إيراد اشتراكات مؤجل', hint: 'اشتراكات مدفوعة عن فترات قادمة', group: 'liabilities' },
    ],
  },
  {
    key: 'general', name: 'عام / نشاط آخر', costLabel: 'تكلفة النشاط',
    specificFields: [
      { key: 'cogs', label: 'تكلفة النشاط', hint: 'التكلفة المباشرة المرتبطة بالإيراد', group: 'income' },
    ],
  },
]

export const getActivity = (key: string): ActivityDef =>
  ACTIVITIES.find(a => a.key === key) || ACTIVITIES[ACTIVITIES.length - 1]

export const fieldsFor = (key: string): FieldDef[] => {
  const act = getActivity(key)
  // ندمج المشتركة مع الخاصة، ونضع حقل التكلفة مباشرة بعد الإيراد
  const income = COMMON_FIELDS.filter(f => f.group === 'income')
  const rest = COMMON_FIELDS.filter(f => f.group !== 'income')
  return [...income, ...act.specificFields, ...rest]
}
