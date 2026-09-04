'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

const FUNDING_TYPES = [
  { id: 'cash', label: 'سيولة نقدية', desc: 'مبلغ يدخل حسابك للتشغيل أو المخزون أو الرواتب أو أي غرض' },
  { id: 'invoices', label: 'تمويل الفواتير والمستخلصات', desc: 'فواتير أو مستخلصات على عملاء لم تُحصَّل بعد، فتأخذ قيمتها اليوم' },
  { id: 'vehicles', label: 'مركبات ومعدات', desc: 'لشراء سيارات أو شاحنات أو آلات تبقى ملكاً لشركتك' },
  { id: 'real_estate', label: 'عقار تجاري', desc: 'لشراء مقر أو مستودع، أو سيولة برهن عقار تملكه' },
  { id: 'project', label: 'عقود ومشاريع', desc: 'عندك عقد أو مشروع مُرسى وتحتاج تمويل تنفيذه' },
  { id: 'lc', label: 'اعتمادات وخطابات ضمان', desc: 'تعهّد بنكي يطلبه مورّدك أو الجهة المتعاقدة' },
  { id: 'other', label: 'أخرى', desc: 'نوع آخر تكتبه بنفسك' },
];


const DEBT_TYPES = [
  { id: 'cash', label: 'نقدي' },
  { id: 'vehicles', label: 'سيارات' },
  { id: 'real_estate', label: 'عقاري' },
  { id: 'operational', label: 'تشغيلي' },
  { id: 'other', label: 'أخرى' },
];

const STEPS = ['نوع التمويل', 'الإيرادات وعمر النشاط', 'الديون والتمويل القائم', 'المتطلبات النظامية', 'طبيعة نشاطك'];

export default function FundingAssessment() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  // حارس المغادرة أثناء الإرسال. وكان يبقى مشتعلاً بعد نجاح الحفظ، لأن
  // `loading` لا يعود false في مسار النجاح — فيخرج للعميل «هل تريد مغادرة
  // الموقع؟» في الثانية التي تسبق نتيجته، وهو لم يطلب مغادرة شيئاً.
  // فإن ضغط «مغادرة» ظنّها إلغاءً، خرج من نتيجةٍ دُفع ثمنها استدعاءَ نموذج.
  // صار يُنزع فور رجوع الخادم بالحفظ: ما بعد الحفظ لا شيء يُفقد.
  const savedRef = useRef(false);
  useEffect(() => {
    if (!loading) return;
    const warn = (e: BeforeUnloadEvent) => {
      if (savedRef.current) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [loading]);
  const [error, setError] = useState('');

  const [fundingType, setFundingType] = useState('');
  const [fundingTypeOther, setFundingTypeOther] = useState('');
  const [annualRevenue, setAnnualRevenue] = useState('');
  // الرقم الذي يُبنى عليه كل قرار ائتماني، ولم يكن يُسأل عنه في مسار
  // التمويل إطلاقاً — يُسأل في مسارَي الاستثمار والطرح وحدهما. فكان ثلاثةٌ
  // من كل خمسة عملاء يصلون بلا صافي ربح، فلا تُحسب لهم قدرةٌ ولا تغطية خدمة
  // دين ولا يخرج لهم حكم. والممول لا يسأل «كم تبيع» بل «كم يبقى لك».
  const [netProfit, setNetProfit] = useState('');
  const [companyBank, setCompanyBank] = useState('');
  const [yearsOperating, setYearsOperating] = useState('');
  const [hasDebt, setHasDebt] = useState<boolean | null>(null);
  const [originalLoan, setOriginalLoan] = useState('');
  const [debtRemaining, setDebtRemaining] = useState('');
  const [monthlyInstallment, setMonthlyInstallment] = useState('');
  const [lenderType, setLenderType] = useState('');
  const [lenderName, setLenderName] = useState('');
  const [debtStatus, setDebtStatus] = useState('');
  const [monthsLate, setMonthsLate] = useState('');
  const [debtType, setDebtType] = useState('');
  const [debtNarrative, setDebtNarrative] = useState('');
  const [debtTypeOther, setDebtTypeOther] = useState('');
  const [crValid, setCrValid] = useState<boolean | null>(null);
  const [taxCompliant, setTaxCompliant] = useState<boolean | null>(null);
  const [zakatCompliant, setZakatCompliant] = useState<boolean | null>(null);
  const [hasStatements, setHasStatements] = useState<boolean | null>(null);
  const [hasBankStatement, setHasBankStatement] = useState<boolean | null>(null);
  const [activityType, setActivityType] = useState('');
  const [activityTypeOther, setActivityTypeOther] = useState('');
  const [hasPos, setHasPos] = useState<boolean | null>(null);
  const [posCount, setPosCount] = useState('');
  const [posUsage, setPosUsage] = useState('');
  const [majorBuyers, setMajorBuyers] = useState('');
  const [posTypes, setPosTypes] = useState('');
  const [issuesInvoices, setIssuesInvoices] = useState<boolean | null>(null);
  const [hasFleet, setHasFleet] = useState<boolean | null>(null);
  const [reqAmount, setReqAmount] = useState('');
  const [fundPurpose, setFundPurpose] = useState('');
  const [crossBorder, setCrossBorder] = useState('');
  const [clientType, setClientType] = useState('');
  const [ownership, setOwnership] = useState('');
  const [ownerNationality, setOwnerNationality] = useState('');
  const [hasParentCo, setHasParentCo] = useState('');
  const [parentCountry, setParentCountry] = useState('');
  const [parentGuarantee, setParentGuarantee] = useState('');
  const [supplierCountries, setSupplierCountries] = useState('');
  const [collectionCycle, setCollectionCycle] = useState('');
  const [collateral, setCollateral] = useState('');

  const stepValid = () => {
    if (step === 0) return fundingType !== '' && (fundingType !== 'other' || fundingTypeOther.trim() !== '');
    // الربح قد يكون سالباً (خسارة) فلا يُشترط أن يكون موجباً — لكنه لا
    // يتجاوز الإيراد منطقاً، وتجاوزُه خطأُ إدخالٍ يُفسد الحكم كله.
    if (step === 1) return annualRevenue !== '' && netProfit !== ''
      && Number(netProfit) <= Number(annualRevenue)
      && companyBank.trim() !== '' && yearsOperating !== '' && Number(yearsOperating) >= 0;
    if (step === 2) {
      if (hasDebt === null) return false;
      if (hasDebt === false) return true;
      if (originalLoan === '' || debtRemaining === '' || monthlyInstallment === '' || lenderType === '' || lenderName.trim() === '' || debtStatus === '' || debtType === '') return false;
      if (debtStatus === 'late' && monthsLate === '') return false;
      if (debtType === 'other' && debtTypeOther.trim() === '') return false;
      return true;
    }
    if (step === 3) return crValid !== null && taxCompliant !== null && zakatCompliant !== null && hasStatements !== null && hasBankStatement !== null;
    if (step === 4) return activityType !== '' && (activityType !== 'other_activity' || activityTypeOther.trim() !== '') && hasPos !== null && issuesInvoices !== null && hasFleet !== null;
    return false;
  };

  const submit = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/assessment/funding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          funding_type: fundingType,
          funding_type_other: fundingType === 'other' ? fundingTypeOther.trim() : null,
          annual_revenue: Number(annualRevenue),
          net_profit: Number(netProfit),
          company_bank: companyBank.trim(),
          years_operating: Number(yearsOperating),
          has_debt: hasDebt,
          original_loan_amount: hasDebt ? Number(originalLoan) : null,
          debt_remaining: hasDebt ? Number(debtRemaining) : null,
          monthly_installment: hasDebt ? Number(monthlyInstallment) : null,
          lender_type: hasDebt ? lenderType : null,
          lender_name: hasDebt ? lenderName.trim() : null,
          debt_status: hasDebt ? debtStatus : null,
          months_late: hasDebt && debtStatus === 'late' ? Number(monthsLate) : null,
          debt_type: hasDebt ? debtType : null,
          debt_narrative: hasDebt ? (debtNarrative.trim() || null) : null,
          debt_type_other: hasDebt && debtType === 'other' ? debtTypeOther.trim() : null,
          cr_valid: crValid,
          tax_compliant: taxCompliant,
          zakat_compliant: zakatCompliant,
          has_financial_statements: hasStatements,
          has_bank_statement: hasBankStatement,
          activity_type: activityType,
          activity_type_other: activityType === 'other_activity' ? activityTypeOther.trim() : null,
          major_buyers: majorBuyers.trim() || null,
          has_pos: hasPos,
          pos_count: hasPos ? (posCount.trim() || null) : null,
          pos_usage_pct: hasPos ? (posUsage.trim() || null) : null,
          pos_types: hasPos ? (posTypes.trim() || null) : null,
          issues_invoices: issuesInvoices,
          has_fleet: hasFleet,
          requested_amount: reqAmount ? Number(reqAmount) : null,
          funding_purpose: fundPurpose.trim() || null,
          trades_cross_border: crossBorder || null,
          client_type: clientType || null,
          ownership_type: ownership || null,
          owner_nationality: ownerNationality.trim() || null,
          has_parent_company: hasParentCo || null,
          parent_company_country: parentCountry.trim() || null,
          parent_can_guarantee: parentGuarantee || null,
          supplier_countries: supplierCountries.trim() || null,
          collection_cycle: collectionCycle || null,
          has_collateral: collateral || null,
        }),
      });
      const data = await res.json();
      if (res.ok === false) throw new Error(data.error || 'حدث خطأ');
      // حُفظ التقييم في القاعدة — يُنزع الحارس قبل أي انتقال
      savedRef.current = true;
      router.push('/assessment/funding/result');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'حدث خطأ غير متوقع');
      setLoading(false);
    }
  };

  const YesNo = ({ value, onChange }: { value: boolean | null; onChange: (v: boolean) => void }) => (
    <div className="flex gap-3">
      <button type="button" onClick={() => onChange(true)}
        className={'flex-1 py-3 rounded-xl border-2 font-bold transition ' + (value === true ? 'border-[#1A3D34] bg-[#E8F5EF] text-[#1A3D34]' : 'border-[#E8F5EF] bg-white text-[#6B8A80]')}>نعم</button>
      <button type="button" onClick={() => onChange(false)}
        className={'flex-1 py-3 rounded-xl border-2 font-bold transition ' + (value === false ? 'border-[#1A3D34] bg-[#E8F5EF] text-[#1A3D34]' : 'border-[#E8F5EF] bg-white text-[#6B8A80]')}>لا</button>
    </div>
  );

  const inputCls = 'w-full p-4 rounded-xl border-2 border-[#E8F5EF] bg-white text-[#1A3D34] font-bold focus:border-[#1A3D34] focus:outline-none text-left';

  return (
    <div dir="rtl" className="min-h-screen bg-[#FBFCFB] px-4 py-8" style={{ fontFamily: 'Tajawal, Cairo, sans-serif' }}>
      <div className="max-w-xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-black text-[#1A3D34]">تقييم جاهزية التمويل</h1>
          <p className="text-[#6B8A80] mt-2">أجب بدقة — كل إجابة تؤثر على نتيجة جاهزيتك</p>
        </div>

        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div key={s} className="flex-1">
              <div className={'h-2 rounded-full ' + (i <= step ? 'bg-[#1A3D34]' : 'bg-[#E8F5EF]')} />
              <p className={'text-[10px] mt-1 text-center font-bold ' + (i <= step ? 'text-[#1A3D34]' : 'text-[#6B8A80]')}>{s}</p>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#E8F5EF]">

          {step === 0 && (
            <div className="space-y-3">
              <h2 className="font-black text-[#1A3D34] mb-4">ما نوع التمويل الذي تحتاجه شركتك؟</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {FUNDING_TYPES.map((t) => {
                  const sel = fundingType.split(',').filter(Boolean);
                  const on = sel.includes(t.id);
                  return (
                  <button key={t.id} type="button" onClick={() => setFundingType((on ? sel.filter(x => x !== t.id) : sel.concat([t.id])).join(','))}
                    className={'p-4 rounded-xl border-2 text-right transition ' + (on ? 'border-[#1A3D34] bg-[#E8F5EF]' : 'border-[#E8F5EF] bg-white')}>
                    <div className={'font-bold text-sm ' + (on ? 'text-[#1A3D34]' : 'text-[#6B8A80]')}>{t.label}</div>
                    <div className="text-[11px] font-bold mt-1 leading-relaxed text-[#8AA79D]">{t.desc}</div>
                  </button>
                  );
                })}
              </div>
              {fundingType.split(',').includes('other') && (
                <input value={fundingTypeOther} onChange={(e) => setFundingTypeOther(e.target.value)}
                  placeholder="اكتب نوع التمويل المطلوب" className={inputCls + ' text-right'} />
              )}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6">
              <div>
                <label className="block font-black text-[#1A3D34] mb-2">الإيرادات السنوية (ريال سعودي)</label>
                <input type="number" min="0" onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()} inputMode="numeric" value={annualRevenue} onChange={(e) => setAnnualRevenue(e.target.value)} placeholder="مثال: 3000000" className={inputCls} />
              </div>
              <div>
                <label className="block font-black text-[#1A3D34] mb-2">صافي الربح السنوي (ريال سعودي)</label>
                <p className="text-[#6B8A80] text-xs font-bold leading-relaxed mb-2">
                  ما يبقى بعد كل المصروفات والزكاة. وهو الرقم الذي تُقاس عليه قدرتك على السداد —
                  الممول لا يسأل كم تبيع بل كم يبقى لك. وإن كانت السنة خسارة فاكتبها بالسالب،
                  فالصدق هنا يفتح مساراً آخر ولا يغلق ملفك.
                </p>
                <input type="number" onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()} inputMode="numeric" value={netProfit} onChange={(e) => setNetProfit(e.target.value)} placeholder="مثال: 450000" className={inputCls} />
                {netProfit !== '' && annualRevenue !== '' && Number(netProfit) > Number(annualRevenue) && (
                  <p className="text-[#B4453C] text-xs font-black mt-2">صافي الربح لا يتجاوز الإيراد — راجع الرقمين.</p>
                )}
              </div>
              <div>
                <label className="block font-black text-[#1A3D34] mb-2">البنك الذي فيه حساب الشركة</label>
                <input value={companyBank} onChange={(e) => setCompanyBank(e.target.value)} placeholder="اكتب اسم البنك" className={inputCls + ' text-right'} />
              </div>

              <div>
                <label className="block font-black text-[#1A3D34] mb-2">عمر النشاط (بالسنوات)</label>
                <input type="number" min="0" onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()} inputMode="decimal" value={yearsOperating} onChange={(e) => setYearsOperating(e.target.value)} placeholder="مثال: 5" className={inputCls} />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div>
                <label className="block font-black text-[#1A3D34] mb-2">هل يوجد على الشركة ديون أو تمويل قائم؟</label>
                <YesNo value={hasDebt} onChange={setHasDebt} />
              </div>
              {hasDebt === true && (
                <>
                  <div>
                    <label className="block font-black text-[#1A3D34] mb-2">قيمة التمويل الأصلية (ريال)</label>
                    <input type="number" min="0" onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()} inputMode="numeric" value={originalLoan} onChange={(e) => setOriginalLoan(e.target.value)} placeholder="مثال: 2000000" className={inputCls} />
                  </div>
                  <div>
                    <label className="block font-black text-[#1A3D34] mb-2">المبلغ المتبقي (ريال)</label>
                    <input type="number" min="0" onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()} inputMode="numeric" value={debtRemaining} onChange={(e) => setDebtRemaining(e.target.value)} placeholder="مثال: 500000" className={inputCls} />
                  </div>
                  <div>
                    <label className="block font-black text-[#1A3D34] mb-2">القسط الشهري (ريال)</label>
                    <input type="number" min="0" onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()} inputMode="numeric" value={monthlyInstallment} onChange={(e) => setMonthlyInstallment(e.target.value)} placeholder="مثال: 15000" className={inputCls} />
                  </div>
                  <div>
                    <label className="block font-black text-[#1A3D34] mb-2">جهة التمويل</label>
                    <div className="flex gap-3 mb-3">
                      <button type="button" onClick={() => setLenderType('bank')}
                        className={'flex-1 py-3 rounded-xl border-2 font-bold transition ' + (lenderType === 'bank' ? 'border-[#1A3D34] bg-[#E8F5EF] text-[#1A3D34]' : 'border-[#E8F5EF] bg-white text-[#6B8A80]')}>بنك</button>
                      <button type="button" onClick={() => setLenderType('finance_company')}
                        className={'flex-1 py-3 rounded-xl border-2 font-bold transition ' + (lenderType === 'finance_company' ? 'border-[#1A3D34] bg-[#E8F5EF] text-[#1A3D34]' : 'border-[#E8F5EF] bg-white text-[#6B8A80]')}>شركة تمويل</button>
                    </div>
                    {lenderType !== '' && (
                      <input value={lenderName} onChange={(e) => setLenderName(e.target.value)}
                        placeholder={lenderType === 'bank' ? 'اكتب اسم البنك' : 'اكتب اسم شركة التمويل'} className={inputCls + ' text-right'} />
                    )}
                  </div>
                  <div>
                    <label className="block font-black text-[#1A3D34] mb-2">حالة السداد</label>
                    <div className="flex gap-3">
                      <button type="button" onClick={() => setDebtStatus('committed')}
                        className={'flex-1 py-3 rounded-xl border-2 font-bold transition ' + (debtStatus === 'committed' ? 'border-[#1A3D34] bg-[#E8F5EF] text-[#1A3D34]' : 'border-[#E8F5EF] bg-white text-[#6B8A80]')}>ملتزم بالسداد</button>
                      <button type="button" onClick={() => setDebtStatus('late')}
                        className={'flex-1 py-3 rounded-xl border-2 font-bold transition ' + (debtStatus === 'late' ? 'border-[#C9A84C] bg-[#FDF8EC] text-[#1A3D34]' : 'border-[#E8F5EF] bg-white text-[#6B8A80]')}>متأخر</button>
                    </div>
                  </div>
                  {debtStatus === 'late' && (
                    <div>
                      <label className="block font-black text-[#1A3D34] mb-2">كم شهر التأخر؟</label>
                      <input type="number" min="0" onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()} inputMode="numeric" value={monthsLate} onChange={(e) => setMonthsLate(e.target.value)} placeholder="مثال: 2" className={inputCls} />
                    </div>
                  )}
                  <div>
                    <label className="block font-black text-[#1A3D34] mb-2">نوع الدين</label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {DEBT_TYPES.map((t) => (
                        <button key={t.id} type="button" onClick={() => setDebtType(t.id)}
                          className={'p-3 rounded-xl border-2 font-bold transition ' + (debtType === t.id ? 'border-[#1A3D34] bg-[#E8F5EF] text-[#1A3D34]' : 'border-[#E8F5EF] bg-white text-[#6B8A80]')}>
                          {t.label}
                        </button>
                      ))}
                    </div>
                    {debtType === 'other' && (
                      <input value={debtTypeOther} onChange={(e) => setDebtTypeOther(e.target.value)}
                        placeholder="اكتب نوع الدين" className={inputCls + ' text-right mt-3'} />
                    )}
                  </div>
                  <div>
                    <label className="block font-black text-[#1A3D34] mb-2">اشرح طبيعة ديونك (اختياري — وإن كان عليك أكثر من تمويل، فصّلها كلها هنا)</label>
                    <textarea value={debtNarrative} onChange={(e) => setDebtNarrative(e.target.value)} rows={4}
                      placeholder={'لو عندك أكثر من تمويل، اكتب كل واحد في سطر:\nبنك الراجحي — 800,000 ريال — قسط 25,000 شهرياً\nشركة تمويل — 400,000 ريال — قسط 12,000 شهرياً'} className={inputCls + ' text-right leading-relaxed'} />
                  </div>
                </>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div>
                <label className="block font-black text-[#1A3D34] mb-2">السجل التجاري ساري؟</label>
                <YesNo value={crValid} onChange={setCrValid} />
              </div>
              <div>
                <label className="block font-black text-[#1A3D34] mb-2">ملتزمون بالإقرارات الضريبية؟</label>
                <YesNo value={taxCompliant} onChange={setTaxCompliant} />
              </div>
              <div>
                <label className="block font-black text-[#1A3D34] mb-2">ملتزمون بالزكاة (شهادة زكاة سارية)؟</label>
                <YesNo value={zakatCompliant} onChange={setZakatCompliant} />
              </div>
              <div>
                <label className="block font-black text-[#1A3D34] mb-2">توجد قوائم مالية للشركة؟</label>
                <YesNo value={hasStatements} onChange={setHasStatements} />
              </div>
              <div>
                <label className="block font-black text-[#1A3D34] mb-2">يتوفر كشف حساب بنكي حديث (آخر 6 أشهر)؟</label>
                <YesNo value={hasBankStatement} onChange={setHasBankStatement} />
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <p className="text-[#6B8A80] text-sm font-bold leading-relaxed">هذه الأسئلة تساعدنا نرشّح لك المنتجات التمويلية المناسبة لطبيعة نشاطك تحديداً — لا منتجات عامة.</p>
              <div>
                <label className="block font-black text-[#1A3D34] mb-2">ما طبيعة نشاط شركتك؟</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    { id: 'retail', label: 'تجزئة / مطاعم' },
                    { id: 'contracting', label: 'مقاولات / توريد' },
                    { id: 'services', label: 'خدمات' },
                    { id: 'manufacturing', label: 'تصنيع' },
                    { id: 'wholesale', label: 'تجارة جملة' },
                    { id: 'other_activity', label: 'أخرى' },
                  ].map((a) => (
                    <button key={a.id} type="button" onClick={() => setActivityType(a.id)}
                      className={'p-3 rounded-xl border-2 text-right font-bold text-sm transition ' + (activityType === a.id ? 'border-[#1A3D34] bg-[#E8F5EF] text-[#1A3D34]' : 'border-[#E8F5EF] bg-white text-[#6B8A80]')}>
                      {a.label}
                    </button>
                  ))}
                </div>
                {activityType === 'other_activity' && (
                  <input value={activityTypeOther} onChange={(e) => setActivityTypeOther(e.target.value)}
                    placeholder="اكتب طبيعة نشاطك بالتفصيل" className={inputCls + ' text-right mt-3'} />
                )}
              </div>
              <div>
                <label className="block font-black text-[#1A3D34] mb-2">هل تورّد لجهات كبيرة أو حكومية؟</label>
                <input value={majorBuyers} onChange={(e) => setMajorBuyers(e.target.value)}
                  placeholder="اكتب أسماءها — أرامكو، سابك، البريد السعودي، وزارة، مستشفى… واتركه فارغاً إن لا يوجد" className={inputCls + ' text-right'} />
                <p className="text-[11px] font-bold mt-2 text-[#8AA79D]">يفتح لك برامج تمويل الموردين المرتبطة بتلك الجهات.</p>
              </div>
              <div>
                <label className="block font-black text-[#1A3D34] mb-2">تستقبل مدفوعات عبر نقاط بيع (مدى / شبكة)؟</label>
                <YesNo value={hasPos} onChange={setHasPos} />
                {hasPos === true && (
                  <div className="space-y-3 mt-3 bg-[#FBFCFB] rounded-xl p-4 border border-[#F0F5F3]">
                    <input value={posTypes} onChange={(e) => setPosTypes(e.target.value)}
                      placeholder="أنواع نقاط البيع (مثال: مدى، Apple Pay، STC Pay)" className={inputCls + ' text-right'} />
                    <input type="number" min="0" onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()} inputMode="numeric" value={posCount} onChange={(e) => setPosCount(e.target.value)}
                      placeholder="عدد أجهزة نقاط البيع" className={inputCls + ' text-right'} />
                    <input type="number" min="0" onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()} inputMode="numeric" value={posUsage} onChange={(e) => setPosUsage(e.target.value)}
                      placeholder="نسبة مبيعاتك عبر نقاط البيع تقريباً (%)" className={inputCls + ' text-right'} />
                  </div>
                )}
              </div>
              <div>
                <label className="block font-black text-[#1A3D34] mb-2">تُصدر فواتير آجلة أو مستخلصات لعملاء/جهات؟</label>
                <YesNo value={issuesInvoices} onChange={setIssuesInvoices} />
              </div>
              <div>
                <label className="block font-black text-[#1A3D34] mb-2">تملك أسطول مركبات أو معدات تشغيلية (على ملك الشركة، لا مؤجّرة باسم بنك)؟</label>
                <YesNo value={hasFleet} onChange={setHasFleet} />
                <div style={{ marginTop: 22 }}>
                  <label className="block font-black text-[#1A3D34] mb-2">كم المبلغ الذي تحتاجه؟ (ريال)</label>
                  <input type="number" min="0" onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()} inputMode="decimal" value={reqAmount} onChange={(e) => setReqAmount(e.target.value)} placeholder="مثال: 3000000" className={inputCls} />
                </div>
                <div style={{ marginTop: 18 }}>
                  <label className="block font-black text-[#1A3D34] mb-2">ما الغرض من التمويل؟</label>
                  <input type="text" value={fundPurpose} onChange={(e) => setFundPurpose(e.target.value)} placeholder="مثال: شراء مخزون موسمي وتغطية دورة تحصيل 90 يوماً" className={inputCls} />
                </div>
                <div style={{ marginTop: 22 }}>
                  <label className="block font-black text-[#1A3D34] mb-2">هل تصدّر أو تستورد؟</label>
                  <select value={crossBorder} onChange={e => {
                    setCrossBorder(e.target.value);
                    // من رجع وقال «لا» بعد أن كتب دولاً، لا تُرسَل دوله معه
                    if (e.target.value === 'none' || e.target.value === '') setSupplierCountries('');
                  }} className="w-full p-3 rounded-xl border-2 border-[#E8F5EF] bg-[#FBFCFB] text-[#1A3D34] font-bold">
                    <option value="">— اختر —</option><option value="none">لا</option><option value="import">أستورد</option><option value="export">أصدّر</option><option value="both">الاثنان</option>
                  </select>
                </div>
                {/* «مختلطة» و«أجنبية بالكامل» كلمتان إداريتان: المستثمر الأجنبي
                    يقرؤهما فلا يعرف أن السؤال عنه هو. وهذا السؤال بالذات يفتح
                    مساراً كاملاً — الشركة الأم وضمانها والممر الأجنبي — فإن
                    أخطأ فيه أُغلق عليه باب لا يعلم به. فذُكرت كلمة «مستثمر»
                    في كل خيار، ليعرف نفسه في السطر من أول قراءة.
                    والقيم المخزَّنة كما هي: saudi · mixed · foreign. */}
                <div style={{ marginTop: 18 }}>
                  <label className="block font-black text-[#1A3D34] mb-1">ملكية المنشأة</label>
                  <p className="text-[#6B8A80] text-xs font-bold mb-2 leading-relaxed">من يملك المنشأة اليوم؟ إن كان فيها مستثمر غير سعودي — شريكاً أو مالكاً — فاذكره هنا، فبعض الجهات لها منتجات خاصة بهذه الحالة.</p>
                  <select value={ownership} onChange={e => setOwnership(e.target.value)} className="w-full p-3 rounded-xl border-2 border-[#E8F5EF] bg-[#FBFCFB] text-[#1A3D34] font-bold">
                    <option value="">— اختر —</option>
                    <option value="saudi">سعودية بالكامل — كل الملّاك سعوديون</option>
                    <option value="mixed">مختلطة — شريك سعودي مع مستثمر أجنبي</option>
                    <option value="foreign">أجنبية بالكامل — المالك مستثمر أجنبي</option>
                  </select>
                </div>
                {ownership && ownership !== 'saudi' && (
                  <>
                <div style={{ marginTop: 18 }}>
                  <label className="block font-black text-[#1A3D34] mb-2">جنسية المستثمر الرئيسي</label>
                  <input type="text" value={ownerNationality} onChange={e => setOwnerNationality(e.target.value)} placeholder="جنسية المستثمر — مثال: مصر، الهند، بريطانيا" className={inputCls} />
                </div>
                <div style={{ marginTop: 18 }}>
                  <label className="block font-black text-[#1A3D34] mb-2">هل للمالك شركة أم أو كيان قائم خارج السعودية؟</label>
                  <select value={hasParentCo} onChange={e => setHasParentCo(e.target.value)} className="w-full p-3 rounded-xl border-2 border-[#E8F5EF] bg-[#FBFCFB] text-[#1A3D34] font-bold">
                    <option value="">— اختر —</option><option value="yes">نعم</option><option value="no">لا</option>
                  </select>
                </div>
                    {hasParentCo === 'yes' && (
                      <>
                <div style={{ marginTop: 18 }}>
                  <label className="block font-black text-[#1A3D34] mb-2">في أي دولة الشركة الأم؟</label>
                  <input type="text" value={parentCountry} onChange={e => setParentCountry(e.target.value)} placeholder="دولة الشركة الأم" className={inputCls} />
                </div>
                <div style={{ marginTop: 18 }}>
                  <label className="block font-black text-[#1A3D34] mb-2">هل يمكنها مبدئياً ضمان المنشأة السعودية أمام جهة تمويل؟</label>
                  <select value={parentGuarantee} onChange={e => setParentGuarantee(e.target.value)} className="w-full p-3 rounded-xl border-2 border-[#E8F5EF] bg-[#FBFCFB] text-[#1A3D34] font-bold">
                    <option value="">— اختر —</option><option value="yes">نعم</option><option value="no">لا</option><option value="unsure">غير متأكد</option>
                  </select>
                </div>
                      </>
                    )}
                  </>
                )}
                {/* كان يُعرض للجميع، فيصل سؤال «من أي دول تشترون وتستوردون؟»
                    إلى من قال قبل سطرين إنه لا يستورد ولا يصدّر — فيقف حائراً
                    أمام سؤالٍ أجاب عنه بـ«لا». صار مشروطاً بجوابه، ونصّه يتبع
                    ما اختاره: المستورد يُسأل عن مورّديه، والمصدّر عن أسواقه. */}
                {(crossBorder === 'import' || crossBorder === 'export' || crossBorder === 'both') && (
                <div style={{ marginTop: 18 }}>
                  <label className="block font-black text-[#1A3D34] mb-2">
                    {crossBorder === 'export'
                      ? 'إلى أي دول تصدّرون بشكل رئيسي؟'
                      : crossBorder === 'both'
                        ? 'ما الدول التي تستوردون منها وتصدّرون إليها؟'
                        : 'من أي دول تشترون وتستوردون بشكل رئيسي؟'}
                  </label>
                  <input type="text" value={supplierCountries} onChange={e => setSupplierCountries(e.target.value)} placeholder="مثال: الصين والهند — أو: الإمارات ومصر" className={inputCls} />
                </div>
                )}
                <div style={{ marginTop: 18 }}>
                  <label className="block font-black text-[#1A3D34] mb-2">من عملاؤك غالباً؟</label>
                  <select value={clientType} onChange={e => setClientType(e.target.value)} className="w-full p-3 rounded-xl border-2 border-[#E8F5EF] bg-[#FBFCFB] text-[#1A3D34] font-bold">
                    <option value="">— اختر —</option><option value="gov">جهات حكومية</option><option value="large">شركات كبرى</option><option value="sme">شركات صغيرة</option><option value="retail">أفراد</option>
                  </select>
                </div>
                {/* نفس علّة سؤال الدول: من قال إنه لا يُصدر فواتير آجلة وإن
                    عملاءه أفراد، ليس عنده مستحقات تُحصَّل أصلاً — فلا يُسأل
                    عن مدّتها. وما عدا هذه الحالة الصريحة يبقى السؤال، لأن
                    البيع الآجل قد يقع بلا فاتورة رسمية. */}
                {!(issuesInvoices === false && clientType === 'retail') && (
                <div style={{ marginTop: 18 }}>
                  <label className="block font-black text-[#1A3D34] mb-2">كم تستغرق تحصيل مستحقاتك؟</label>
                  <select value={collectionCycle} onChange={e => setCollectionCycle(e.target.value)} className="w-full p-3 rounded-xl border-2 border-[#E8F5EF] bg-[#FBFCFB] text-[#1A3D34] font-bold">
                    <option value="">— اختر —</option><option value="instant">فوري</option><option value="30">حتى 30 يوماً</option><option value="90">30 إلى 90 يوماً</option><option value="90plus">أكثر من 90 يوماً</option>
                  </select>
                </div>
                )}
                <div style={{ marginTop: 18 }}>
                  <label className="block font-black text-[#1A3D34] mb-2">هل لديك أصول قابلة للرهن؟</label>
                  <select value={collateral} onChange={e => setCollateral(e.target.value)} className="w-full p-3 rounded-xl border-2 border-[#E8F5EF] bg-[#FBFCFB] text-[#1A3D34] font-bold">
                    <option value="">— اختر —</option><option value="realestate">عقار</option><option value="assets">معدّات وأصول</option><option value="none">لا يوجد</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {error !== '' && <p className="text-red-600 font-bold mt-4 text-sm">{error}</p>}

          <div className="flex gap-3 mt-8">
            {step > 0 && (
              <><button type="button" onClick={() => setStep(step - 1)}
                className="px-6 py-3 rounded-xl border-2 border-[#E8F5EF] text-[#6B8A80] font-bold">رجوع</button>
              <button type="button" disabled={loading}
                onClick={() => { if (confirm('ستخرج من التقييم وتفقد إجاباتك الحالية. هل تريد الخروج؟')) window.location.href = '/goal'; }}
                className="px-6 py-3 rounded-xl border-2 border-[#F0D9D9] text-[#C0392B] font-bold disabled:opacity-40">خروج</button></>
            )}
            {step < 4 && (
              <button type="button" disabled={stepValid() === false} onClick={() => setStep(step + 1)}
                className="flex-1 py-3 rounded-xl bg-[#1A3D34] text-white font-black disabled:opacity-40">التالي</button>
            )}
            {step === 4 && loading && (
              <div style={{ width:'100%', background:'#FDF8EC', border:'2px solid #C9A84C', borderRadius:12, padding:'12px 16px', marginBottom:10, color:'#9A7B2E', fontWeight:900, fontSize:13.5, textAlign:'center', lineHeight:1.7 }}>
                التحليل جارٍ — لا تغلق الصفحة ولا تنتقل منها حتى تظهر النتيجة.
              </div>
            )}
            {step === 4 && (
              <button type="button" disabled={stepValid() === false || loading} onClick={submit}
                className="flex-1 py-3 rounded-xl bg-[#1A3D34] text-white font-black disabled:opacity-40">
                {loading ? 'جارٍ التحليل...' : 'احسب جاهزيتي'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
