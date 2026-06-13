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

export default function IpoResult() {
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);

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

      // إشعار الأدمن بالتفاصيل الكاملة (خفي عن العميل)
      try { await fetch('/api/match/ipo', { method: 'POST' }); } catch {}
      fetch('/api/consultation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'ipo' }) }).catch(() => {});
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
          {market && <p className="text-[#2E9E7B] font-black text-sm mt-2">{market}</p>}
        </div>

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

        {roadmap.length > 0 && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border-2 border-[#2E9E7B]">
            <h2 className="font-black text-[#1A3D34] mb-1">خارطة الطريق للجاهزية</h2>
            <p className="text-[#6B8A80] text-xs font-bold mb-4">خطوات مرتبة للوصول لمتطلبات الإدراج</p>
            <ul className="space-y-3">
              {roadmap.map((p, i) => (
                <li key={i} className="text-[#1A3D34] text-sm font-bold bg-[#E8F5EF] rounded-xl p-3">{i + 1}. {p}</li>
              ))}
            </ul>
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

        <div className="bg-[#E8F5EF] rounded-2xl p-6 text-center">
          <p className="text-[#1A3D34] font-black text-sm">فريق مُرضي استلم نتيجتك وسيتواصل معك لمناقشة خطة الطرح والخطوات التالية.</p>
        </div>

      </div>
    </div>
  );
}
