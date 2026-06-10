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
  { id: 'growth', label: 'نمو — إيرادات متصاعدة وأبحث عن توسع' },
  { id: 'established', label: 'مستقرة — إيرادات ثابتة وربحية' },
  { id: 'expansion', label: 'توسع — فروع/أسواق جديدة' },
  { id: 'restructuring', label: 'إعادة هيكلة — أحتاج شريكاً استراتيجياً' },
];

const GROWTH = [
  { id: 'high', label: 'أكثر من 30%' },
  { id: 'medium', label: '10% — 30%' },
  { id: 'low', label: 'أقل من 10%' },
  { id: 'declining', label: 'متراجعة' },
];

const STEPS = ['القطاع والمرحلة', 'الأداء المالي', 'الحوكمة والقوائم'];

export default function InvestmentAssessment() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [sector, setSector] = useState('');
  const [stage, setStage] = useState('');
  const [yearsOperating, setYearsOperating] = useState('');
  const [annualRevenue, setAnnualRevenue] = useState('');
  const [netProfit, setNetProfit] = useState('');
  const [growth, setGrowth] = useState('');
  const [hasGovernance, setHasGovernance] = useState<boolean | null>(null);
  const [hasBoard, setHasBoard] = useState<boolean | null>(null);
  const [hasStatements, setHasStatements] = useState<boolean | null>(null);
  const [audited, setAudited] = useState<boolean | null>(null);

  const stepValid = () => {
    if (step === 0) return sector !== '' && stage !== '' && yearsOperating !== '';
    if (step === 1) return annualRevenue !== '' && netProfit !== '' && growth !== '';
    if (step === 2) return hasGovernance !== null && hasBoard !== null && hasStatements !== null && (hasStatements === false || audited !== null);
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
          sector,
          company_stage: stage,
          years_operating: Number(yearsOperating),
          annual_revenue: Number(annualRevenue),
          net_profit: Number(netProfit),
          revenue_growth: growth,
          has_governance: hasGovernance,
          has_board: hasBoard,
          has_financial_statements: hasStatements,
          audited_statements: hasStatements === true ? audited : false,
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

          {error !== '' && <p className="text-red-600 font-bold mt-4 text-sm">{error}</p>}

          <div className="flex gap-3 mt-8">
            {step > 0 && (
              <button type="button" onClick={() => setStep(step - 1)}
                className="px-6 py-3 rounded-xl border-2 border-[#E8F5EF] text-[#6B8A80] font-bold">رجوع</button>
            )}
            {step < 2 && (
              <button type="button" disabled={stepValid() === false} onClick={() => setStep(step + 1)}
                className="flex-1 py-3 rounded-xl bg-[#2E9E7B] text-white font-black disabled:opacity-40">التالي</button>
            )}
            {step === 2 && (
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
