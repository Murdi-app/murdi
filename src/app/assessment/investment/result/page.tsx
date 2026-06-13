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
            <h2 className="font-black text-[#1A3D34] mb-4">خطة التحسين</h2>
            <ul className="space-y-3">
              {result.improvement_plan.map((p, i) => (
                <li key={i} className="text-[#1A3D34] text-sm font-bold bg-[#E8F5EF] rounded-xl p-3">{i + 1}. {p}</li>
              ))}
            </ul>
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
              <div className="space-y-3">
                <p className="text-[#2E9E7B] font-black text-sm">شركتك مؤهلة لـ {matchCount} جهة استثمارية</p>
                {matches.map((m, i) => (
                  <div key={i} className="border border-[#E8F5EF] rounded-xl p-4">
                    <div className="flex justify-between items-center mb-2">
                      <p className="font-black text-[#1A3D34] text-sm">{m.funding_type}</p>
                      <span className="bg-[#E8F5EF] text-[#2E9E7B] font-black text-xs px-3 py-1 rounded-full">ملاءمة {m.fit_percent}%</span>
                    </div>
                    <ul className="space-y-1 mb-2">
                      {m.reasons.map((r, j) => (
                        <li key={j} className="text-[#6B8A80] text-xs font-bold">✓ {r}</li>
                      ))}
                    </ul>
                    <p className="text-[#2E9E7B] text-xs font-black">{m.next_step}</p>
                  </div>
                ))}
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
