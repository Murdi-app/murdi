'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';

type Result = {
  readiness_score: number;
  months_to_ready?: number;
  valuation_estimate?: string;
  verdict: string;
  top_obstacles: string[];
  required_documents: string[];
  improvement_plan: string[];
};

export default function IpoResult() {
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [eligibility, setEligibility] = useState('');
  const [eligLoading, setEligLoading] = useState(true);
  const [finData, setFinData] = useState<{ rev: number; profit: number; growth: string } | null>(null);

  useEffect(() => {
    const load = async () => {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL as string,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
      );
      const { data: { user } } = await supabase.auth.getUser();
      if (user === null) { setLoading(false); return; }

      const { data: company } = await supabase
        .from('companies')
        .select('id')
        .eq('user_id', user.id)
        .single();
      if (company === null) { setLoading(false); return; }

      const { data: fd } = await supabase
        .from('financial_data')
        .select('annual_revenue, net_profit, revenue_growth')
        .eq('company_id', company.id)
        .eq('assessment_type', 'ipo')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      if (fd) setFinData({ rev: Number(fd.annual_revenue) || 0, profit: Number(fd.net_profit) || 0, growth: fd.revenue_growth || '' });

      const { data: rr } = await supabase
        .from('readiness_results')
        .select('readiness_score, verdict, top_obstacles, required_documents, improvement_plan, months_to_ready, valuation_estimate')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      setResult(rr);
      setLoading(false);

      // إشعار الأدمن بالتفاصيل الكاملة (خفي عن العميل)
      try { await fetch('/api/match/ipo', { method: 'POST' }); } catch {}
      fetch('/api/consultation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'ipo' }) }).catch(() => {});

      // تحليل الأهلية للطرح (بحث في مصادر الهيئة — يظهر للعميل)
      fetch('/api/ipo-eligibility', { method: 'POST' })
        .then((r) => r.json())
        .then((d) => { setEligibility(d.eligibility || ''); setEligLoading(false); })
        .catch(() => setEligLoading(false));
    };
    load();
  }, []);

  if (loading) {
    return (
      <div dir="rtl" className="min-h-screen bg-[#FBFCFB] flex items-center justify-center" style={{ fontFamily: 'Cairo, sans-serif' }}>
        <p className="text-[#6B8A80] font-bold">جارٍ تحميل النتيجة...</p>
      </div>
    );
  }

  if (result === null) {
    return (
      <div dir="rtl" className="min-h-screen bg-[#FBFCFB] flex items-center justify-center" style={{ fontFamily: 'Cairo, sans-serif' }}>
        <p className="text-[#6B8A80] font-bold">لا توجد نتيجة — ابدأ التقييم أولاً</p>
      </div>
    );
  }

  const parseValuation = () => {
    if (!result?.valuation_estimate) return null;
    try {
      const v = JSON.parse(result.valuation_estimate);
      if (typeof v.lo === 'number' && typeof v.hi === 'number' && v.hi > 0) return v;
    } catch {}
    return null;
  };
  const estimateValuation = () => {
    if (finData === null) return null;
    const { rev, profit, growth } = finData;
    let lo = 0, hi = 0, basis = '';
    if (profit > 0) {
      let ml = 6, mh = 8;
      if (growth === 'high') { ml = 9; mh = 12; }
      else if (growth === 'medium') { ml = 7; mh = 9; }
      lo = profit * ml; hi = profit * mh; basis = 'multiple';
    } else if (rev > 0) {
      lo = rev * 1; hi = rev * 1.5; basis = 'revenue';
    } else {
      return null;
    }
    return { lo, hi, basis };
  };
  const aiVal = parseValuation();
  const valuation = aiVal ? { lo: aiVal.lo, hi: aiVal.hi, basis: 'multiple', note: aiVal.note || '' } : estimateValuation();
  const fmtM = (n: number) => (n >= 1000000 ? (n / 1000000).toFixed(1) + ' مليون' : Math.round(n / 1000).toLocaleString() + ' ألف');

  const scoreColor = result.readiness_score >= 70 ? '#2E9E7B' : result.readiness_score >= 50 ? '#C9A84C' : '#C0564B';
  const roadmap = result.improvement_plan?.filter((p) => p.startsWith('السوق المقترح') === false) || [];
  const market = result.improvement_plan?.find((p) => p.startsWith('السوق المقترح'));

  return (
    <div dir="rtl" className="min-h-screen bg-[#FBFCFB] px-4 py-8" style={{ fontFamily: 'Cairo, sans-serif' }}>
      <div className="max-w-2xl mx-auto mb-4">
        <a href="/goal" className="inline-flex items-center gap-2 text-[#6B8A80] hover:text-[#2E9E7B] font-black text-sm transition-colors">
          <span style={{ fontSize: 18 }}>→</span> رجوع للمركز
        </a>
      </div>
      <div className="max-w-xl mx-auto space-y-6">

        <div className="bg-white rounded-2xl p-8 shadow-sm border border-[#E8F5EF] text-center">
          <p className="text-[#6B8A80] font-bold mb-2">IPO Readiness Score</p>
          <p className="text-6xl font-black" style={{ color: scoreColor }}>{result.readiness_score}</p>
          <p className="text-lg font-black text-[#1A3D34] mt-3">{result.verdict}</p>
          <p className="text-[#A3BAB2] text-xs font-bold mt-2 leading-relaxed">تحليل وفق منهجية د. عبدالحكيم المرضي — دكتوراه إدارة الأعمال، عضوية البورد الأمريكي، وخبرة 15 عاماً في القطاع المالي</p>
          {market && <p className="text-[#2E9E7B] font-black text-sm mt-2">{market}</p>}
        </div>

        {(result.months_to_ready ?? 0) > 0 && (
          <div className="bg-gradient-to-br from-[#1A3D34] to-[#2E5D4E] rounded-2xl p-6 text-center shadow-sm">
            <p className="text-[#D8E8E0] font-bold text-sm mb-1">المدة التقديرية حتى جاهزية الطرح</p>
            <p className="text-white font-black text-5xl mb-1">{result.months_to_ready}</p>
            <p className="text-[#C9A84C] font-black text-lg mb-3">شهراً</p>
            <p className="text-[#D8E8E0] text-xs font-bold leading-relaxed">تقدير مبني على الفجوات الحالية في ملفك — يقصُر كلما عالجت العوائق. فريق مُرضي يضع لك خطة زمنية تختصر هذه المدة.</p>
          </div>
        )}

        {result.top_obstacles?.length > 0 && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#E8F5EF]">
            <h2 className="font-black text-[#1A3D34] mb-4">العوائق أمام الطرح</h2>
            <ul className="space-y-2">
              {result.top_obstacles.map((o, i) => (
                <li key={i} className="text-[#6B8A80] font-bold text-sm">• {o}</li>
              ))}
            </ul>
          </div>
        )}

        {valuation !== null && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border-2 border-[#C9A84C]">
            <h2 className="font-black text-[#1A3D34] mb-1">💰 القيمة السوقية التقديرية للطرح</h2>
            <p className="text-[#6B8A80] text-xs font-bold mb-4">تقدير استرشادي مبدئي وفق ربحية شركتك ونموها على أساس مضاعفات السوق</p>
            <div className="bg-[#FBF5E8] rounded-xl p-5 text-center">
              <p className="text-[#9A7B2E] font-black text-2xl">{fmtM(valuation.lo)} — {fmtM(valuation.hi)} ريال</p>
              {(valuation as { note?: string }).note && (
                <p className="text-[#6B5B2E] text-xs font-bold mt-3 leading-relaxed">{(valuation as { note?: string }).note}</p>
              )}
              {valuation.basis === 'revenue' && (
                <p className="text-[#6B5B2E] text-xs font-bold mt-2">قُدّرت على أساس الإيرادات (الشركة دون ربحية صافية حالياً)</p>
              )}
            </div>
            <div className="relative mt-4">
              <div className="bg-[#F0F5F3] rounded-xl p-5 select-none" style={{ filter: 'blur(5px)', pointerEvents: 'none' }} aria-hidden="true">
                <p className="text-[#1A3D34] font-black text-sm mb-2">عند استيفاء متطلبات الحوكمة والإفصاح، يرتفع مضاعف التقييم إلى:</p>
                <p className="text-[#2E9E7B] font-black text-xl">{fmtM(valuation.hi * 1.5)} ريال</p>
              </div>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
                <span className="text-3xl mb-1">🔒</span>
                <p className="font-black text-[#1A3D34] text-sm">سيناريوهات رفع التقييم محجوبة</p>
              </div>
            </div>
            <p className="text-[#6B8A80] text-xs font-bold mt-4 leading-relaxed">القيمة الفعلية عند الطرح تحتاج تقييماً معمّقاً يعدّه فريق د. عبدالحكيم المرضي بالتنسيق مع المستشار المالي المرخّص.</p>
          </div>
        )}

        {roadmap.length > 0 && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border-2 border-[#2E9E7B]">
            <h2 className="font-black text-[#1A3D34] mb-1">خارطة الطريق للجاهزية</h2>
            <p className="text-[#6B8A80] text-xs font-bold mb-4">خطوات مرتبة للوصول لمتطلبات الإدراج</p>
            <ul className="space-y-3">
              {/* المرحلة الأولى — عيّنة مكشوفة */}
              <li className="text-[#1A3D34] text-sm font-bold bg-[#E8F5EF] rounded-xl p-3">1. {roadmap[0]}</li>
            </ul>

            {roadmap.length > 1 && (
              <div className="relative mt-3">
                {/* الباقي مقفل بضبابية */}
                <ul className="space-y-3 select-none" style={{ filter: 'blur(5px)', pointerEvents: 'none' }} aria-hidden="true">
                  {roadmap.slice(1).map((p, i) => (
                    <li key={i} className="text-[#1A3D34] text-sm font-bold bg-[#E8F5EF] rounded-xl p-3">{i + 2}. {p}</li>
                  ))}
                </ul>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
                  <span style={{ fontSize: 26 }}>🔒</span>
                  <p className="text-[#1A3D34] font-black text-sm mt-1">خارطة الطريق الكاملة محجوبة</p>
                  <p className="text-[#6B8A80] font-bold text-xs mt-1">{roadmap.length - 1} مراحل إضافية بالمدد والتفاصيل</p>
                </div>
              </div>
            )}

            {/* الدعوة حسب الأهلية */}
            {result.readiness_score >= 65 ? (
              <div className="mt-5 bg-gradient-to-l from-[#FBF5E8] to-white rounded-xl p-5 border-2 border-[#C9A84C]">
                <h3 className="font-black text-[#1A3D34] mb-1">🎯 شركتك مؤهلة — افتح خطة الطرح الكاملة</h3>
                <p className="text-[#6B8A80] text-sm font-bold leading-relaxed mb-4">يُعدّ لك فريق د. عبدالحكيم المرضي خطة طرح تنفيذية كاملة: كل مرحلة بمدتها وتكلفتها، تجهيز ملف الهيئة، واختيار السوق الأنسب — بمرافقة حتى الإدراج.</p>
                <a href="https://wa.me/966570314005?text=السلام%20عليكم،%20شركتي%20مؤهلة%20للطرح%20وأريد%20خطة%20الطرح%20الكاملة%20من%20فريق%20مُرضي" target="_blank" rel="noopener noreferrer" className="inline-block px-7 py-3 rounded-full bg-[#C9A84C] text-white font-black text-sm">اطلب خطة الطرح الكاملة ←</a>
              </div>
            ) : (
              <div className="mt-5 bg-[#FBFCFB] rounded-xl p-5 border border-[#F0F5F3]">
                <h3 className="font-black text-[#1A3D34] mb-1">شركتك تحتاج تجهيزاً قبل الطرح</h3>
                <p className="text-[#6B8A80] text-sm font-bold leading-relaxed">ركّز على رفع جاهزيتك عبر معالجة العوائق أعلاه. عند وصولك لمستوى الجاهزية، يفتح فريق مُرضي لك خطة الطرح الكاملة ويرافقك في الطريق.</p>
              </div>
            )}
          </div>
        )}

        {result.required_documents?.length > 0 && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#E8F5EF]">
            <h2 className="font-black text-[#1A3D34] mb-4">المستندات الأساسية</h2>
            <ul className="space-y-2">
              {result.required_documents.map((d, i) => (
                <li key={i} className="text-[#6B8A80] font-bold text-sm">📄 {d}</li>
              ))}
            </ul>
          </div>
        )}

        {/* تحليل الأهلية للطرح — بحث في مصادر الهيئة */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border-2 border-[#1A3D34]">
          <h2 className="font-black text-[#1A3D34] mb-1">🏛️ تحليل أهليتك للطرح</h2>
          <p className="text-[#6B8A80] text-xs font-bold mb-4">وفق آخر متطلبات هيئة السوق المالية وتداول — مطابقة بأرقام شركتك</p>
          {eligLoading && (
            <div className="flex items-center gap-3 bg-[#FBFCFB] rounded-xl p-4">
              <div className="w-5 h-5 rounded-full border-2 border-[#1A3D34]/30 border-t-[#1A3D34] animate-spin" />
              <p className="text-[#6B8A80] font-bold text-sm">جارٍ تحليل أهليتك وفق متطلبات الهيئة... (قد يأخذ دقيقة)</p>
            </div>
          )}
          {eligLoading === false && eligibility !== '' && (() => {
            const clean = eligibility.replace(/^#+ /gm, '').replace(/\*\*/g, '');
            const cut = Math.min(450, Math.floor(clean.length / 3));
            const sample = clean.slice(0, cut);
            const rest = clean.slice(cut);
            return (
              <div>
                <div className="bg-[#FBFCFB] rounded-xl p-5 border border-[#F0F5F3] whitespace-pre-wrap text-[#1A3D34] text-sm font-bold leading-loose">{sample}…</div>
                {rest.length > 0 && (
                  <div className="relative mt-3">
                    <div className="bg-[#FBFCFB] rounded-xl p-5 border border-[#F0F5F3] whitespace-pre-wrap text-[#1A3D34] text-sm font-bold leading-loose select-none" style={{ filter: 'blur(6px)', maxHeight: '180px', overflow: 'hidden', pointerEvents: 'none' }} aria-hidden="true">{rest}</div>
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
                      <span className="text-3xl mb-1">🔒</span>
                      <p className="font-black text-[#1A3D34] text-sm">تحليل الأهلية الكامل + خطوات العمل الفورية محجوبة</p>
                    </div>
                  </div>
                )}
                {result.readiness_score >= 65 ? (
                  <div className="mt-5 rounded-2xl p-5 text-center" style={{ background: 'linear-gradient(135deg,#1A3D34,#2E5D4E)' }}>
                    <p className="text-3xl mb-2">🏛️</p>
                    <p className="font-black text-white mb-1">شركتك على أعتاب الطرح</p>
                    <p className="text-[#D8E8E0] text-sm font-bold leading-relaxed mb-4">يُعدّ لك فريق د. عبدالحكيم المرضي تحليل الأهلية الكامل وخطوات العمل الفورية، ويرافقك في تجهيز ملف الشركة لهيئة السوق المالية مرحلةً بمرحلة.</p>
                    <a href={'https://wa.me/966570314005?text=' + encodeURIComponent('السلام عليكم، أنهيت تقييم الطرح في مُرضي وأرغب في تحليل الأهلية الكامل وخطة الطرح')} target="_blank" rel="noopener noreferrer" className="inline-block bg-[#C9A84C] text-[#1A3D34] font-black px-6 py-3 rounded-xl">تواصل مع فريق مُرضي عبر واتساب</a>
                  </div>
                ) : (
                  <div className="mt-5 rounded-2xl p-5 text-center bg-[#FBF5E8] border border-[#E8D9B5]">
                    <p className="font-black text-[#1A3D34] mb-1">الطريق إلى الطرح يبدأ من هنا</p>
                    <p className="text-[#6B5B2E] text-sm font-bold leading-relaxed">ارفع جاهزيتك بمعالجة العوائق أعلاه، وفريق مُرضي مستعد لمرافقتك خطوة بخطوة حتى تستوفي متطلبات الهيئة.</p>
                  </div>
                )}
              </div>
            );
          })()}
          {eligLoading === false && eligibility === '' && (
            <p className="text-[#6B8A80] font-bold text-sm">تعذّر جلب المتطلبات حالياً — حاول لاحقاً أو تواصل مع فريق مُرضي.</p>
          )}
        </div>

        <div className="bg-[#E8F5EF] rounded-2xl p-6 text-center">
          <p className="text-[#1A3D34] font-black text-sm">فريق مُرضي استلم نتيجتك وسيتواصل معك لمناقشة خطة الطرح والخطوات التالية.</p>
        </div>

      </div>
    </div>
  );
}
