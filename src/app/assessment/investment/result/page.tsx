'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';

type Result = {
  readiness_score: number;
  verdict: string;
  top_obstacles: string[];
  required_documents: string[];
  improvement_plan: string[];
};

type Match = {
  funding_type: string;
  fit_percent: number;
  reasons: string[];
  next_step: string;
};

export default function InvestmentResult() {
  const [result, setResult] = useState<Result | null>(null);
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [matchCount, setMatchCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [matchLoading, setMatchLoading] = useState(false);

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

      const { data: rr } = await supabase
        .from('readiness_results')
        .select('readiness_score, verdict, top_obstacles, required_documents, improvement_plan')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      setResult(rr);
      setLoading(false);

      if (rr !== null && rr.readiness_score >= 70) {
        setMatchLoading(true);
        try {
          const res = await fetch('/api/match/investment', { method: 'POST' });
          fetch('/api/consultation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'investment' }) }).catch(() => {});
          const data = await res.json();
          if (res.ok) { setMatches(data.matches); setMatchCount(data.match_count); }
        } catch {}
        setMatchLoading(false);
      }
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

  const scoreColor = result.readiness_score >= 70 ? '#2E9E7B' : result.readiness_score >= 50 ? '#C9A84C' : '#C0564B';

  return (
    <div dir="rtl" className="min-h-screen bg-[#FBFCFB] px-4 py-8" style={{ fontFamily: 'Cairo, sans-serif' }}>
      <div className="max-w-2xl mx-auto mb-4">
        <a href="/goal" className="inline-flex items-center gap-2 text-[#6B8A80] hover:text-[#2E9E7B] font-black text-sm transition-colors">
          <span style={{ fontSize: 18 }}>→</span> رجوع للمركز
        </a>
      </div>
      <div className="max-w-xl mx-auto space-y-6">

        <div className="bg-white rounded-2xl p-8 shadow-sm border border-[#E8F5EF] text-center">
          <p className="text-[#6B8A80] font-bold mb-2">درجة جاهزية الاستثمار</p>
          <p className="text-6xl font-black" style={{ color: scoreColor }}>{result.readiness_score}</p>
          <p className="text-xl font-black text-[#1A3D34] mt-3">{result.verdict}</p>
          <p className="text-[#A3BAB2] text-xs font-bold mt-2 leading-relaxed">تحليل وفق منهجية د. عبدالحكيم المرضي — دكتوراه إدارة الأعمال، عضوية البورد الأمريكي، وخبرة 15 عاماً في القطاع المالي</p>
        </div>

        {result.top_obstacles?.length > 0 && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#E8F5EF]">
            <h2 className="font-black text-[#1A3D34] mb-4">أبرز العوائق</h2>
            <ul className="space-y-2">
              {result.top_obstacles.map((o, i) => (
                <li key={i} className="text-[#6B8A80] font-bold text-sm">• {o}</li>
              ))}
            </ul>
          </div>
        )}

        {result.improvement_plan?.length > 0 && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#E8F5EF]">
            <h2 className="font-black text-[#1A3D34] mb-4">خطة جذب المستثمر</h2>
            <ul className="space-y-3">
              <li className="text-[#1A3D34] text-sm font-bold bg-[#E8F5EF] rounded-xl p-3">1. {result.improvement_plan[0]}</li>
            </ul>
            {result.improvement_plan.length > 1 && (
              <div className="relative mt-3">
                <ul className="space-y-3 select-none" style={{ filter: 'blur(6px)', pointerEvents: 'none' }} aria-hidden="true">
                  {result.improvement_plan.slice(1).map((p, i) => (
                    <li key={i} className="text-[#1A3D34] text-sm font-bold bg-[#E8F5EF] rounded-xl p-3">{i + 2}. {p}</li>
                  ))}
                </ul>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
                  <span className="text-3xl mb-1">🔒</span>
                  <p className="font-black text-[#1A3D34] text-sm">بقية خطة الجذب ({result.improvement_plan.length - 1} خطوات) محجوبة</p>
                </div>
              </div>
            )}
            {result.readiness_score >= 65 ? (
              <div className="mt-5 rounded-2xl p-5 text-center" style={{ background: 'linear-gradient(135deg,#1A3D34,#2E5D4E)' }}>
                <p className="text-3xl mb-2">🏆</p>
                <p className="font-black text-white mb-1">شركتك جاذبة للمستثمر</p>
                <p className="text-[#D8E8E0] text-sm font-bold leading-relaxed mb-4">يعدّ لك فريق د. عبدالحكيم المرضي خطة جذب المستثمر الكاملة خطوةً بخطوة، مع تجهيز ملف الشركة للعرض على المستثمرين المناسبين.</p>
                <a href="https://wa.me/966570314005?text=%D8%A7%D9%84%D8%B3%D9%84%D8%A7%D9%85%20%D8%B9%D9%84%D9%8A%D9%83%D9%85%D8%8C%20%D8%A3%D9%86%D9%87%D9%8A%D8%AA%20%D8%AA%D9%82%D9%8A%D9%8A%D9%85%20%D8%A7%D9%84%D8%A7%D8%B3%D8%AA%D8%AB%D9%85%D8%A7%D8%B1%20%D9%81%D9%8A%20%D9%85%D9%8F%D8%B1%D8%B6%D9%8A%20%D9%88%D8%A3%D8%B1%D8%BA%D8%A8%20%D9%81%D9%8A%20%D8%AE%D8%B7%D8%A9%20%D8%AC%D8%B0%D8%A8%20%D8%A7%D9%84%D9%85%D8%B3%D8%AA%D8%AB%D9%85%D8%B1%20%D8%A7%D9%84%D9%83%D8%A7%D9%85%D9%84%D8%A9" target="_blank" rel="noopener noreferrer"
                  className="inline-block bg-[#C9A84C] text-[#1A3D34] font-black px-6 py-3 rounded-xl">تواصل مع فريق مُرضي عبر واتساب</a>
              </div>
            ) : (
              <div className="mt-5 rounded-2xl p-5 text-center bg-[#FBF5E8] border border-[#E8D9B5]">
                <p className="font-black text-[#1A3D34] mb-1">أنت في الطريق الصحيح</p>
                <p className="text-[#6B5B2E] text-sm font-bold leading-relaxed">ارفع جاهزيتك أولاً عبر معالجة العوائق أعلاه، وفريق مُرضي مستعد لمرافقتك خطوة بخطوة حتى تصبح شركتك جاهزة لجذب المستثمرين.</p>
              </div>
            )}
          </div>
        )}

        {result.required_documents?.length > 0 && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#E8F5EF]">
            <h2 className="font-black text-[#1A3D34] mb-4">المستندات المطلوبة</h2>
            <ul className="space-y-2">
              {result.required_documents.map((d, i) => (
                <li key={i} className="text-[#6B8A80] font-bold text-sm">📄 {d}</li>
              ))}
            </ul>
          </div>
        )}

        {result.readiness_score >= 70 && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border-2 border-[#2E9E7B]">
            <h2 className="font-black text-[#1A3D34] mb-1">فرص الاستثمار المتاحة</h2>
            <p className="text-[#6B8A80] text-xs font-bold mb-4">بناءً على ملفك، هذه الفرص التي تتطابق معها شركتك</p>

            {matchLoading && <p className="text-[#6B8A80] font-bold text-sm">جارٍ البحث عن الجهات المتطابقة...</p>}

            {matchLoading === false && matches !== null && matches.length > 0 && (
              <div>
                <div className="bg-[#E8F5EF] rounded-xl p-4 text-center mb-3">
                  <p className="text-3xl mb-1">🎯</p>
                  <p className="text-[#1A3D34] font-black">وجدنا لك {matchCount} جهة استثمارية مناسبة</p>
                  <p className="text-[#6B8A80] text-xs font-bold mt-1">طابقناها مع ملف شركتك — التفاصيل محفوظة لك مع فريق مُرضي</p>
                </div>
                <div className="relative">
                  <div className="space-y-3 select-none" style={{ filter: 'blur(6px)', pointerEvents: 'none' }} aria-hidden="true">
                    {matches.map((m, i) => (
                      <div key={i} className="border border-[#E8F5EF] rounded-xl p-4">
                        <div className="flex justify-between items-center mb-2">
                          <p className="font-black text-[#1A3D34] text-sm">{m.funding_type}</p>
                          <span className="bg-[#E8F5EF] text-[#2E9E7B] font-black text-xs px-3 py-1 rounded-full">ملاءمة {m.fit_percent}%</span>
                        </div>
                        <ul className="space-y-1">
                          {m.reasons.map((r, j) => (
                            <li key={j} className="text-[#6B8A80] text-xs font-bold">✓ {r}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
                    <span className="text-3xl mb-1">🔒</span>
                    <p className="font-black text-[#1A3D34] text-sm">أسماء الجهات وتفاصيل المطابقة محجوبة</p>
                  </div>
                </div>
                <div className="mt-5 rounded-2xl p-5 text-center" style={{ background: 'linear-gradient(135deg,#1A3D34,#2E5D4E)' }}>
                  <p className="font-black text-white mb-1">جهاتك الاستثمارية جاهزة</p>
                  <p className="text-[#D8E8E0] text-sm font-bold leading-relaxed mb-4">يشاركك فريق د. عبدالحكيم المرضي قائمة الجهات المطابقة وطريقة الوصول إليها، ويرافقك في عرض شركتك عليها بأفضل صورة.</p>
                  <a href={'https://wa.me/966570314005?text=' + encodeURIComponent('السلام عليكم، أنهيت تقييم الاستثمار في مُرضي وأرغب في معرفة الجهات الاستثمارية المطابقة لشركتي')} target="_blank" rel="noopener noreferrer" className="inline-block bg-[#C9A84C] text-[#1A3D34] font-black px-6 py-3 rounded-xl">تواصل مع فريق مُرضي عبر واتساب</a>
                </div>
              </div>
            )}

            {matchLoading === false && (matches === null || matches.length === 0) && (
              <p className="text-[#6B8A80] font-bold text-sm">فريق مُرضي يراجع ملفك وسيتواصل معك بالفرص المناسبة.</p>
            )}
          </div>
        )}

        {result.readiness_score < 70 && (
          <div className="bg-[#E8F5EF] rounded-2xl p-6 text-center">
            <p className="text-[#1A3D34] font-black text-sm">عند وصول درجتك إلى 70 فأكثر، يبدأ فريق مُرضي بمطابقة شركتك مع الجهات الاستثمارية المناسبة.</p>
          </div>
        )}

        {/* بطاقة الاستشارة القادمة — لفت انتباه العميل */}
        <div className="bg-gradient-to-l from-[#FBF5E8] to-white rounded-2xl p-6 border-2 border-[#C9A84C]">
          <div className="flex items-start gap-3">
            <span style={{ fontSize: 28 }}>🎓</span>
            <div className="flex-1">
              <h2 className="font-black text-[#1A3D34] mb-1">استشارتك الخاصة قيد الإعداد الآن</h2>
              <p className="text-[#6B8A80] text-sm font-bold leading-relaxed mb-4">د. عبدالحكيم المرضي وفريقه يُعدّون لك استشارة استثمار مخصّصة لأرقام شركتك — تحليل عميق، خطة نجاح، وتوعية مالية. ستجدها جاهزة في قسم الاستشارات فور مراجعتها واعتمادها.</p>
              <a href="/dashboard/consultation" className="inline-block px-6 py-2.5 rounded-full bg-[#C9A84C] text-white font-black text-sm">الذهاب لقسم الاستشارات ←</a>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
