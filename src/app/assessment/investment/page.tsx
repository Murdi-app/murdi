'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const SECTORS = [
  { id: 'retail', label: 'تجزئة وتجارة' },
  { id: 'contracting', label: 'مقاولات وإنشاءات' },
  { id: 'industrial', label: 'صناعي' },
  { id: 'tech', label: 'تقنية' },
  { id: 'food', label: 'أغذية ومطاعم' },
  { id: 'health', label: 'صحي' },
  { id: 'logistics', label: 'لوجستي ونقل' },
  { id: 'services', label: 'خدمات' },
  { id: 'other', label: 'أخرى' },
];

const STAGES = [
  { id: 'seed', label: 'تأسيس — بداية النشاط' },
  { id: 'growth', label: 'نمو — إيرادات متصاعدة وأبحث عن توسع' },
  { id: 'established', label: 'مستقرة — إيرادات ثابتة وربحية' },
  { id: 'expansion', label: 'توسع — فروع/أسواق جديدة' },
  { id: 'pre_ipo', label: 'ما قبل الطرح — نستعد لطرح عام' },
  { id: 'restructuring', label: 'إعادة هيكلة — أحتاج شريكاً استراتيجياً' },
];

const GROWTH = [
  { id: 'high', label: 'أكثر من 30%' },
  { id: 'medium', label: '10% — 30%' },
  { id: 'low', label: 'أقل من 10%' },
  { id: 'declining', label: 'متراجعة' },
];

const CONCENTRATION = [
  { id: 'low', label: 'أقل من 20% — قاعدة عملاء موزّعة' },
  { id: 'mid', label: '20% — 40%' },
  { id: 'high', label: 'أكثر من 40% — معتمد على عميل رئيسي' },
];

const RECURRING = [
  { id: 'recurring', label: 'متكرر غالباً — اشتراكات أو عقود مستمرة' },
  { id: 'mixed', label: 'مزيج بين متكرر ومرة واحدة' },
  { id: 'oneoff', label: 'مرة واحدة غالباً — مشاريع أو صفقات منفصلة' },
];

const REPAYMENT = [
  { id: 'regular', label: 'منتظم في السداد' },
  { id: 'slight', label: 'متأخر بأقساط بسيطة' },
  { id: 'default', label: 'متعثر' },
];

const DEBT_SOURCES = [
  { id: 'one', label: 'جهة تمويل واحدة' },
  { id: 'multi', label: 'أكثر من جهة' },
];

const PRIOR_INV = [
  { id: 'yes', label: 'نعم — دخل مستثمر أو جولة تمويل سابقة' },
  { id: 'no', label: 'لا' },
];

const STEPS = ['القطاع والمرحلة', 'الأداء المالي', 'الحوكمة والقوائم', 'جاذبية الاستثمار'];

export default function InvestmentAssessment() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [sector, setSector] = useState('');
  const [customSector, setCustomSector] = useState('');
  const [stage, setStage] = useState('');
  const [yearsOperating, setYearsOperating] = useState('');
  const [annualRevenue, setAnnualRevenue] = useState('');
  const [netProfit, setNetProfit] = useState('');
  const [growth, setGrowth] = useState('');
  const [hasGovernance, setHasGovernance] = useState<boolean | null>(null);
  const [hasBoard, setHasBoard] = useState<boolean | null>(null);
  const [hasStatements, setHasStatements] = useState<boolean | null>(null);
  const [audited, setAudited] = useState<boolean | null>(null);
  const [concentration, setConcentration] = useState('');
  const [recurring, setRecurring] = useState('');
  const [priorInvestment, setPriorInvestment] = useState('');
  const [hasDebt, setHasDebt] = useState<boolean | null>(null);
  const [totalFinancing, setTotalFinancing] = useState('');
  const [remainingDebt, setRemainingDebt] = useState('');
  const [financingSources, setFinancingSources] = useState('');
  const [repaymentStatus, setRepaymentStatus] = useState('');
  const [debtDetails, setDebtDetails] = useState('');

  const stepValid = () => {
    if (step === 0) return sector !== '' && (sector !== 'other' || customSector.trim() !== '') && stage !== '' && yearsOperating !== '';
    if (step === 1) return annualRevenue !== '' && netProfit !== '' && growth !== '';
    if (step === 2) return hasGovernance !== null && hasBoard !== null && hasStatements !== null && (hasStatements === false || audited !== null);
    if (step === 3) return concentration !== '' && recurring !== '' && priorInvestment !== '' && hasDebt !== null && (hasDebt === false || (totalFinancing !== '' && remainingDebt !== '' && financingSources !== '' && repaymentStatus !== '' && (financingSources !== 'multi' || debtDetails.trim() !== '')));
    return false;
  };

  const submit = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/assessment/investment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sector: sector === 'other' ? customSector.trim() : sector,
          company_stage: stage,
          years_operating: Number(yearsOperating),
          annual_revenue: Number(annualRevenue),
          net_profit: Number(netProfit),
          revenue_growth: growth,
          has_governance: hasGovernance,
          has_board: hasBoard,
          has_financial_statements: hasStatements,
          audited_statements: hasStatements === true ? audited : false,
          client_concentration: concentration,
          revenue_recurring: recurring,
          had_investment: priorInvestment,
          has_debt: hasDebt ? 'yes' : 'no',
          total_financing: hasDebt ? Number(totalFinancing) : 0,
          remaining_debt: hasDebt ? Number(remainingDebt) : 0,
          financing_sources: hasDebt ? financingSources : '',
          repayment_status: hasDebt ? repaymentStatus : '',
          debt_details: hasDebt && financingSources === 'multi' ? debtDetails.trim() : '',
        }),
      });
      const data = await res.json();
      if (res.ok === false) throw new Error(data.error || 'حدث خطأ');
      router.push('/assessment/investment/result');
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

  const Choice = ({ items, value, onChange, cols = 1 }: { items: { id: string; label: string }[]; value: string; onChange: (v: string) => void; cols?: number }) => (
    <div className={cols === 2 ? 'grid grid-cols-2 gap-3' : 'space-y-3'}>
      {items.map((t) => (
        <button key={t.id} type="button" onClick={() => onChange(t.id)}
          className={'w-full p-4 rounded-xl border-2 text-right font-bold transition ' + (value === t.id ? 'border-[#2E9E7B] bg-[#E8F5EF] text-[#1A3D34]' : 'border-[#E8F5EF] bg-white text-[#6B8A80]')}>
          {t.label}
        </button>
      ))}
    </div>
  );

  const inputCls = 'w-full p-4 rounded-xl border-2 border-[#E8F5EF] bg-white text-[#1A3D34] font-bold focus:border-[#2E9E7B] focus:outline-none text-left';

  return (
    <div dir="rtl" className="min-h-screen bg-[#FBFCFB] px-4 py-8" style={{ fontFamily: 'Cairo, sans-serif' }}>
      <div className="max-w-xl mx-auto mb-4">
        <button onClick={() => router.push('/goal')} className="flex items-center gap-2 text-[#6B8A80] hover:text-[#2E9E7B] font-black text-sm transition-colors">
          <span style={{ fontSize: 18 }}>→</span> رجوع للمركز
        </button>
      </div>
      <div className="max-w-xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-black text-[#1A3D34]">تقييم جاهزية الاستثمار</h1>
          <p className="text-[#6B8A80] mt-2">نقيس مدى جاهزية شركتك لدخول مستثمر</p>
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
            <div className="space-y-6">
              <div>
                <label className="block font-black text-[#1A3D34] mb-3">قطاع الشركة</label>
                <Choice items={SECTORS} value={sector} onChange={setSector} cols={2} />
                {sector === 'other' && (
                  <input type="text" value={customSector} onChange={(e) => setCustomSector(e.target.value)}
                    placeholder="اكتب قطاع شركتك بالتحديد..."
                    className="w-full mt-3 p-4 rounded-xl border-2 border-[#E8F5EF] bg-[#FBFCFB] text-[#1A3D34] font-bold focus:border-[#2E9E7B] focus:outline-none text-right" />
                )}
              </div>
              <div>
                <label className="block font-black text-[#1A3D34] mb-3">مرحلة الشركة الحالية</label>
                <Choice items={STAGES} value={stage} onChange={setStage} />
              </div>
              <div>
                <label className="block font-black text-[#1A3D34] mb-2">عمر النشاط (بالسنوات)</label>
                <input type="number" inputMode="decimal" value={yearsOperating} onChange={(e) => setYearsOperating(e.target.value)} placeholder="مثال: 5" className={inputCls} />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6">
              <div>
                <label className="block font-black text-[#1A3D34] mb-2">الإيرادات السنوية (ريال)</label>
                <input type="number" inputMode="numeric" value={annualRevenue} onChange={(e) => setAnnualRevenue(e.target.value)} placeholder="مثال: 5000000" className={inputCls} />
              </div>
              <div>
                <label className="block font-black text-[#1A3D34] mb-2">صافي الربح السنوي (ريال — اكتب 0 إذا خسارة)</label>
                <input type="number" inputMode="numeric" value={netProfit} onChange={(e) => setNetProfit(e.target.value)} placeholder="مثال: 800000" className={inputCls} />
              </div>
              <div>
                <label className="block font-black text-[#1A3D34] mb-3">نمو الإيرادات آخر سنة</label>
                <Choice items={GROWTH} value={growth} onChange={setGrowth} cols={2} />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div>
                <label className="block font-black text-[#1A3D34] mb-2">يوجد نظام حوكمة (لوائح، صلاحيات، فصل ملكية عن إدارة)؟</label>
                <YesNo value={hasGovernance} onChange={setHasGovernance} />
              </div>
              <div>
                <label className="block font-black text-[#1A3D34] mb-2">يوجد مجلس إدارة أو مجلس استشاري؟</label>
                <YesNo value={hasBoard} onChange={setHasBoard} />
              </div>
              <div>
                <label className="block font-black text-[#1A3D34] mb-2">توجد قوائم مالية؟</label>
                <YesNo value={hasStatements} onChange={setHasStatements} />
              </div>
              {hasStatements === true && (
                <div>
                  <label className="block font-black text-[#1A3D34] mb-2">القوائم مراجعة من مراجع خارجي معتمد؟</label>
                  <YesNo value={audited} onChange={setAudited} />
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div>
                <label className="block font-black text-[#1A3D34] mb-3">كم نسبة أكبر عميل من إجمالي إيراداتك؟</label>
                <Choice items={CONCENTRATION} value={concentration} onChange={setConcentration} />
              </div>
              <div>
                <label className="block font-black text-[#1A3D34] mb-3">ما طبيعة إيراداتك؟</label>
                <Choice items={RECURRING} value={recurring} onChange={setRecurring} />
              </div>
              <div>
                <label className="block font-black text-[#1A3D34] mb-3">هل دخل مستثمر أو جولة تمويل سابقة؟</label>
                <Choice items={PRIOR_INV} value={priorInvestment} onChange={setPriorInvestment} />
              </div>
              <div>
                <label className="block font-black text-[#1A3D34] mb-2">هل على الشركة تمويل أو ديون قائمة؟</label>
                <YesNo value={hasDebt} onChange={setHasDebt} />
              </div>
              {hasDebt === true && (
                <>
                  <div>
                    <label className="block font-black text-[#1A3D34] mb-2">إجمالي مبلغ التمويل الأصلي (ريال)</label>
                    <input type="number" value={totalFinancing} onChange={(e) => setTotalFinancing(e.target.value)}
                      placeholder="مثال: 2000000"
                      className="w-full p-4 rounded-xl border-2 border-[#E8F5EF] bg-[#FBFCFB] text-[#1A3D34] font-bold focus:border-[#2E9E7B] focus:outline-none text-right" />
                  </div>
                  <div>
                    <label className="block font-black text-[#1A3D34] mb-2">المبلغ المتبقي على الشركة الآن (ريال)</label>
                    <input type="number" value={remainingDebt} onChange={(e) => setRemainingDebt(e.target.value)}
                      placeholder="مثال: 1200000"
                      className="w-full p-4 rounded-xl border-2 border-[#E8F5EF] bg-[#FBFCFB] text-[#1A3D34] font-bold focus:border-[#2E9E7B] focus:outline-none text-right" />
                  </div>
                  <div>
                    <label className="block font-black text-[#1A3D34] mb-3">كم عدد جهات التمويل؟</label>
                    <Choice items={DEBT_SOURCES} value={financingSources} onChange={setFinancingSources} />
                  </div>
                  {financingSources === 'multi' && (
                    <div>
                      <label className="block font-black text-[#1A3D34] mb-2">فصّل جهات التمويل (المبلغ من كل جهة، اسمها، والقسط الشهري)</label>
                      <textarea value={debtDetails} onChange={(e) => setDebtDetails(e.target.value)} rows={4}
                        placeholder={'مثال:\nبنك الراجحي — 800,000 ريال — قسط 25,000 شهرياً\nشركة تمويل — 400,000 ريال — قسط 12,000 شهرياً'}
                        className="w-full p-4 rounded-xl border-2 border-[#E8F5EF] bg-[#FBFCFB] text-[#1A3D34] font-bold focus:border-[#2E9E7B] focus:outline-none text-right leading-relaxed" />
                    </div>
                  )}
                  <div>
                    <label className="block font-black text-[#1A3D34] mb-3">ما وضع سداد الديون حالياً؟</label>
                    <Choice items={REPAYMENT} value={repaymentStatus} onChange={setRepaymentStatus} />
                  </div>
                </>
              )}
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
