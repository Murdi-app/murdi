'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const FUNDING_TYPES = [
  { id: 'cash', label: 'تمويل نقدي (كاش)' },
  { id: 'working_capital', label: 'رأس مال عامل' },
  { id: 'revenue', label: 'تمويل الإيرادات' },
  { id: 'pos', label: 'تمويل نقاط البيع' },
  { id: 'invoices', label: 'تمويل الفواتير والمستخلصات' },
  { id: 'assets', label: 'تمويل أصول ومعدات' },
  { id: 'vehicles', label: 'تمويل مركبات وأساطيل' },
  { id: 'real_estate', label: 'عقاري تجاري' },
  { id: 'lc', label: 'اعتمادات وخطابات ضمان' },
  { id: 'project', label: 'تمويل مشاريع وعقود' },
  { id: 'other', label: 'أخرى' },
];

const DEBT_TYPES = [
  { id: 'cash', label: 'نقدي' },
  { id: 'vehicles', label: 'سيارات' },
  { id: 'real_estate', label: 'عقاري' },
  { id: 'operational', label: 'تشغيلي' },
  { id: 'other', label: 'أخرى' },
];

const STEPS = ['نوع التمويل', 'الإيرادات وعمر النشاط', 'الديون والتمويل القائم', 'المتطلبات النظامية'];

export default function FundingAssessment() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [fundingType, setFundingType] = useState('');
  const [fundingTypeOther, setFundingTypeOther] = useState('');
  const [annualRevenue, setAnnualRevenue] = useState('');
  const [yearsOperating, setYearsOperating] = useState('');
  const [hasDebt, setHasDebt] = useState<boolean | null>(null);
  const [debtRemaining, setDebtRemaining] = useState('');
  const [monthlyInstallment, setMonthlyInstallment] = useState('');
  const [lenderType, setLenderType] = useState('');
  const [lenderName, setLenderName] = useState('');
  const [debtStatus, setDebtStatus] = useState('');
  const [monthsLate, setMonthsLate] = useState('');
  const [debtType, setDebtType] = useState('');
  const [debtTypeOther, setDebtTypeOther] = useState('');
  const [crValid, setCrValid] = useState<boolean | null>(null);
  const [taxCompliant, setTaxCompliant] = useState<boolean | null>(null);
  const [zakatCompliant, setZakatCompliant] = useState<boolean | null>(null);
  const [hasStatements, setHasStatements] = useState<boolean | null>(null);
  const [hasBankStatement, setHasBankStatement] = useState<boolean | null>(null);

  const stepValid = () => {
    if (step === 0) return fundingType !== '' && (fundingType !== 'other' || fundingTypeOther.trim() !== '');
    if (step === 1) return annualRevenue !== '' && yearsOperating !== '';
    if (step === 2) {
      if (hasDebt === null) return false;
      if (hasDebt === false) return true;
      if (debtRemaining === '' || monthlyInstallment === '' || lenderType === '' || lenderName.trim() === '' || debtStatus === '' || debtType === '') return false;
      if (debtStatus === 'late' && monthsLate === '') return false;
      if (debtType === 'other' && debtTypeOther.trim() === '') return false;
      return true;
    }
    if (step === 3) return crValid !== null && taxCompliant !== null && zakatCompliant !== null && hasStatements !== null && hasBankStatement !== null;
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
          years_operating: Number(yearsOperating),
          has_debt: hasDebt,
          debt_remaining: hasDebt ? Number(debtRemaining) : null,
          monthly_installment: hasDebt ? Number(monthlyInstallment) : null,
          lender_type: hasDebt ? lenderType : null,
          lender_name: hasDebt ? lenderName.trim() : null,
          debt_status: hasDebt ? debtStatus : null,
          months_late: hasDebt && debtStatus === 'late' ? Number(monthsLate) : null,
          debt_type: hasDebt ? debtType : null,
          debt_type_other: hasDebt && debtType === 'other' ? debtTypeOther.trim() : null,
          cr_valid: crValid,
          tax_compliant: taxCompliant,
          zakat_compliant: zakatCompliant,
          has_financial_statements: hasStatements,
          has_bank_statement: hasBankStatement,
        }),
      });
      const data = await res.json();
      if (res.ok === false) throw new Error(data.error || 'حدث خطأ');
      router.push('/assessment/funding/result');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'حدث خطأ غير متوقع');
      setLoading(false);
    }
  };

  const YesNo = ({ value, onChange }: { value: boolean | null; onChange: (v: boolean) => void }) => (
    <div className="flex gap-3">
      <button type="button" onClick={() => onChange(true)}
        className={'flex-1 py-3 rounded-xl border-2 font-bold transition ' + (value === true ? 'border-[#2E9E7B] bg-[#E8F5EF] text-[#1A3D34]' : 'border-[#E8F5EF] bg-white text-[#6B8A80]')}>نعم</button>
      <button type="button" onClick={() => onChange(false)}
        className={'flex-1 py-3 rounded-xl border-2 font-bold transition ' + (value === false ? 'border-[#2E9E7B] bg-[#E8F5EF] text-[#1A3D34]' : 'border-[#E8F5EF] bg-white text-[#6B8A80]')}>لا</button>
    </div>
  );

  const inputCls = 'w-full p-4 rounded-xl border-2 border-[#E8F5EF] bg-white text-[#1A3D34] font-bold focus:border-[#2E9E7B] focus:outline-none text-left';

  return (
    <div dir="rtl" className="min-h-screen bg-[#FBFCFB] px-4 py-8" style={{ fontFamily: 'Cairo, sans-serif' }}>
      <div className="max-w-xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-black text-[#1A3D34]">تقييم جاهزية التمويل</h1>
          <p className="text-[#6B8A80] mt-2">أجب بدقة — كل إجابة تؤثر على نتيجة جاهزيتك</p>
        </div>

        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div key={s} className="flex-1">
              <div className={'h-2 rounded-full ' + (i <= step ? 'bg-[#2E9E7B]' : 'bg-[#E8F5EF]')} />
              <p className={'text-[10px] mt-1 text-center font-bold ' + (i <= step ? 'text-[#2E9E7B]' : 'text-[#6B8A80]')}>{s}</p>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#E8F5EF]">

          {step === 0 && (
            <div className="space-y-3">
              <h2 className="font-black text-[#1A3D34] mb-4">ما نوع التمويل الذي تحتاجه شركتك؟</h2>
              <div className="grid grid-cols-2 gap-3">
                {FUNDING_TYPES.map((t) => (
                  <button key={t.id} type="button" onClick={() => setFundingType(t.id)}
                    className={'p-4 rounded-xl border-2 text-right font-bold text-sm transition ' + (fundingType === t.id ? 'border-[#2E9E7B] bg-[#E8F5EF] text-[#1A3D34]' : 'border-[#E8F5EF] bg-white text-[#6B8A80]')}>
                    {t.label}
                  </button>
                ))}
              </div>
              {fundingType === 'other' && (
                <input value={fundingTypeOther} onChange={(e) => setFundingTypeOther(e.target.value)}
                  placeholder="اكتب نوع التمويل المطلوب" className={inputCls + ' text-right'} />
              )}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6">
              <div>
                <label className="block font-black text-[#1A3D34] mb-2">الإيرادات السنوية (ريال سعودي)</label>
                <input type="number" inputMode="numeric" value={annualRevenue} onChange={(e) => setAnnualRevenue(e.target.value)} placeholder="مثال: 3000000" className={inputCls} />
              </div>
              <div>
                <label className="block font-black text-[#1A3D34] mb-2">عمر النشاط (بالسنوات)</label>
                <input type="number" inputMode="decimal" value={yearsOperating} onChange={(e) => setYearsOperating(e.target.value)} placeholder="مثال: 5" className={inputCls} />
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
                    <label className="block font-black text-[#1A3D34] mb-2">المبلغ المتبقي (ريال)</label>
                    <input type="number" inputMode="numeric" value={debtRemaining} onChange={(e) => setDebtRemaining(e.target.value)} placeholder="مثال: 500000" className={inputCls} />
                  </div>
                  <div>
                    <label className="block font-black text-[#1A3D34] mb-2">القسط الشهري (ريال)</label>
                    <input type="number" inputMode="numeric" value={monthlyInstallment} onChange={(e) => setMonthlyInstallment(e.target.value)} placeholder="مثال: 15000" className={inputCls} />
                  </div>
                  <div>
                    <label className="block font-black text-[#1A3D34] mb-2">جهة التمويل</label>
                    <div className="flex gap-3 mb-3">
                      <button type="button" onClick={() => setLenderType('bank')}
                        className={'flex-1 py-3 rounded-xl border-2 font-bold transition ' + (lenderType === 'bank' ? 'border-[#2E9E7B] bg-[#E8F5EF] text-[#1A3D34]' : 'border-[#E8F5EF] bg-white text-[#6B8A80]')}>بنك</button>
                      <button type="button" onClick={() => setLenderType('finance_company')}
                        className={'flex-1 py-3 rounded-xl border-2 font-bold transition ' + (lenderType === 'finance_company' ? 'border-[#2E9E7B] bg-[#E8F5EF] text-[#1A3D34]' : 'border-[#E8F5EF] bg-white text-[#6B8A80]')}>شركة تمويل</button>
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
                        className={'flex-1 py-3 rounded-xl border-2 font-bold transition ' + (debtStatus === 'committed' ? 'border-[#2E9E7B] bg-[#E8F5EF] text-[#1A3D34]' : 'border-[#E8F5EF] bg-white text-[#6B8A80]')}>ملتزم بالسداد</button>
                      <button type="button" onClick={() => setDebtStatus('late')}
                        className={'flex-1 py-3 rounded-xl border-2 font-bold transition ' + (debtStatus === 'late' ? 'border-[#C9A84C] bg-[#FDF8EC] text-[#1A3D34]' : 'border-[#E8F5EF] bg-white text-[#6B8A80]')}>متأخر</button>
                    </div>
                  </div>
                  {debtStatus === 'late' && (
                    <div>
                      <label className="block font-black text-[#1A3D34] mb-2">كم شهر التأخر؟</label>
                      <input type="number" inputMode="numeric" value={monthsLate} onChange={(e) => setMonthsLate(e.target.value)} placeholder="مثال: 2" className={inputCls} />
                    </div>
                  )}
                  <div>
                    <label className="block font-black text-[#1A3D34] mb-2">نوع الدين</label>
                    <div className="grid grid-cols-2 gap-3">
                      {DEBT_TYPES.map((t) => (
                        <button key={t.id} type="button" onClick={() => setDebtType(t.id)}
                          className={'p-3 rounded-xl border-2 font-bold transition ' + (debtType === t.id ? 'border-[#2E9E7B] bg-[#E8F5EF] text-[#1A3D34]' : 'border-[#E8F5EF] bg-white text-[#6B8A80]')}>
                          {t.label}
                        </button>
                      ))}
                    </div>
                    {debtType === 'other' && (
                      <input value={debtTypeOther} onChange={(e) => setDebtTypeOther(e.target.value)}
                        placeholder="اكتب نوع الدين" className={inputCls + ' text-right mt-3'} />
                    )}
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

          {error !== '' && <p className="text-red-600 font-bold mt-4 text-sm">{error}</p>}

          <div className="flex gap-3 mt-8">
            {step > 0 && (
              <button type="button" onClick={() => setStep(step - 1)}
                className="px-6 py-3 rounded-xl border-2 border-[#E8F5EF] text-[#6B8A80] font-bold">رجوع</button>
            )}
            {step < 3 && (
              <button type="button" disabled={stepValid() === false} onClick={() => setStep(step + 1)}
                className="flex-1 py-3 rounded-xl bg-[#2E9E7B] text-white font-black disabled:opacity-40">التالي</button>
            )}
            {step === 3 && (
              <button type="button" disabled={stepValid() === false || loading} onClick={submit}
                className="flex-1 py-3 rounded-xl bg-[#2E9E7B] text-white font-black disabled:opacity-40">
                {loading ? 'جارٍ التحليل...' : 'احسب جاهزيتي'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
