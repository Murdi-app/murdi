'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const GROWTH = [
  { id: 'high', label: 'أكثر من 30%' },
  { id: 'medium', label: '10% — 30%' },
  { id: 'low', label: 'أقل من 10%' },
  { id: 'declining', label: 'متراجعة' },
];

const TARGET = [
  { id: 'nomu', label: 'السوق الموازي (نمو)' },
  { id: 'main', label: 'السوق الرئيسية' },
  { id: 'unsure', label: 'لست متأكداً — وجّهوني' },
];

const STEPS = ['الأداء المالي', 'القوائم والمراجعة', 'الحوكمة', 'الالتزام والاستدامة'];

export default function IpoAssessment() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [annualRevenue, setAnnualRevenue] = useState('');
  const [netProfit, setNetProfit] = useState('');
  const [growth, setGrowth] = useState('');
  const [yearsOperating, setYearsOperating] = useState('');
  const [target, setTarget] = useState('');
  const [statementsYears, setStatementsYears] = useState('');
  const [auditor, setAuditor] = useState<boolean | null>(null);
  const [hasGovernance, setHasGovernance] = useState<boolean | null>(null);
  const [hasBoard, setHasBoard] = useState<boolean | null>(null);
  const [hasCommittees, setHasCommittees] = useState<boolean | null>(null);
  const [taxCompliant, setTaxCompliant] = useState<boolean | null>(null);
  const [zakatCompliant, setZakatCompliant] = useState<boolean | null>(null);
  const [topClientPct, setTopClientPct] = useState('');

  const stepValid = () => {
    if (step === 0) return annualRevenue !== '' && netProfit !== '' && growth !== '' && yearsOperating !== '' && target !== '';
    if (step === 1) return statementsYears !== '' && auditor !== null;
    if (step === 2) return hasGovernance !== null && hasBoard !== null && hasCommittees !== null;
    if (step === 3) return taxCompliant !== null && zakatCompliant !== null && topClientPct !== '';
    return false;
  };

  const submit = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/assessment/ipo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          annual_revenue: Number(annualRevenue),
          net_profit: Number(netProfit),
          revenue_growth: growth,
          years_operating: Number(yearsOperating),
          target_market: target,
          num_statements_years: Number(statementsYears),
          external_auditor: auditor,
          has_governance: hasGovernance,
          has_board: hasBoard,
          has_committees: hasCommittees,
          tax_compliant: taxCompliant,
          zakat_compliant: zakatCompliant,
          top_client_pct: Number(topClientPct),
        }),
      });
      const data = await res.json();
      if (res.ok === false) throw new Error(data.error || 'حدث خطأ');
      router.push('/assessment/ipo/result');
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
      <div className="max-w-xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-black text-[#1A3D34]">تقييم جاهزية الطرح</h1>
          <p className="text-[#6B8A80] mt-2">نقيس مدى جاهزية شركتك للإدراج في السوق المالية</p>
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
                <label className="block font-black text-[#1A3D34] mb-2">الإيرادات السنوية (ريال)</label>
                <input type="number" inputMode="numeric" value={annualRevenue} onChange={(e) => setAnnualRevenue(e.target.value)} placeholder="مثال: 50000000" className={inputCls} />
              </div>
              <div>
                <label className="block font-black text-[#1A3D34] mb-2">صافي الربح السنوي (ريال — اكتب 0 إذا خسارة)</label>
                <input type="number" inputMode="numeric" value={netProfit} onChange={(e) => setNetProfit(e.target.value)} placeholder="مثال: 8000000" className={inputCls} />
              </div>
              <div>
                <label className="block font-black text-[#1A3D34] mb-3">نمو الإيرادات آخر سنة</label>
                <Choice items={GROWTH} value={growth} onChange={setGrowth} cols={2} />
              </div>
              <div>
                <label className="block font-black text-[#1A3D34] mb-2">عمر النشاط (بالسنوات)</label>
                <input type="number" inputMode="decimal" value={yearsOperating} onChange={(e) => setYearsOperating(e.target.value)} placeholder="مثال: 7" className={inputCls} />
              </div>
              <div>
                <label className="block font-black text-[#1A3D34] mb-3">السوق المستهدف</label>
                <Choice items={TARGET} value={target} onChange={setTarget} />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6">
              <div>
                <label className="block font-black text-[#1A3D34] mb-2">كم سنة من القوائم المالية المعتمدة لديكم؟</label>
                <input type="number" inputMode="numeric" value={statementsYears} onChange={(e) => setStatementsYears(e.target.value)} placeholder="مثال: 3" className={inputCls} />
              </div>
              <div>
                <label className="block font-black text-[#1A3D34] mb-2">القوائم مراجعة من مراجع خارجي معتمد؟</label>
                <YesNo value={auditor} onChange={setAuditor} />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div>
                <label className="block font-black text-[#1A3D34] mb-2">يوجد نظام حوكمة موثق؟</label>
                <YesNo value={hasGovernance} onChange={setHasGovernance} />
              </div>
              <div>
                <label className="block font-black text-[#1A3D34] mb-2">يوجد مجلس إدارة فعّال؟</label>
                <YesNo value={hasBoard} onChange={setHasBoard} />
              </div>
              <div>
                <label className="block font-black text-[#1A3D34] mb-2">توجد لجان منبثقة (مراجعة، ترشيحات...)؟</label>
                <YesNo value={hasCommittees} onChange={setHasCommittees} />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div>
                <label className="block font-black text-[#1A3D34] mb-2">ملتزمون بالإقرارات الضريبية؟</label>
                <YesNo value={taxCompliant} onChange={setTaxCompliant} />
              </div>
              <div>
                <label className="block font-black text-[#1A3D34] mb-2">ملتزمون بالزكاة (شهادة سارية)؟</label>
                <YesNo value={zakatCompliant} onChange={setZakatCompliant} />
              </div>
              <div>
                <label className="block font-black text-[#1A3D34] mb-2">كم نسبة أكبر عميل من إيراداتكم؟ (%)</label>
                <input type="number" inputMode="numeric" value={topClientPct} onChange={(e) => setTopClientPct(e.target.value)} placeholder="مثال: 25" className={inputCls} />
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
                {loading ? 'جارٍ التحليل...' : 'احسب جاهزية الطرح'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
