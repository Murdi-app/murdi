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

export default function FundingResult() {
  const [result, setResult] = useState<Result | null>(null);
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [matchCount, setMatchCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [matchLoading, setMatchLoading] = useState(false);
  const [consultStatus, setConsultStatus] = useState('');
  const [consultContent, setConsultContent] = useState('');

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
        .eq('result_type', 'funding')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      setResult(rr);
      setLoading(false);

      setMatchLoading(true);
      try {
        const res = await fetch('/api/match', { method: 'POST' });
        const data = await res.json();
        if (res.ok) { setMatches(data.matches); setMatchCount(data.match_count); }
      } catch {}
      setMatchLoading(false);

      // الاستشارة الخاصة: توليد تلقائي ثم قراءة الحالة
      try {
        await fetch('/api/consultation', { method: 'POST' });
        const cRes = await fetch('/api/consultation');
        const cData = await cRes.json();
        if (cData.consultation) {
          setConsultStatus(cData.consultation.status || '');
          setConsultContent(cData.consultation.content || '');
        }
      } catch {}
    };
    load();
  }, []);

  if (loading) {
    return (
      <div dir="rtl" className="min-h-screen bg-[#FBFCFB] flex flex-col items-center justify-center gap-4" style={{ fontFamily: 'Cairo, sans-serif' }}>
        <div className="w-12 h-12 rounded-full border-4 border-[#E8F5EF] border-t-[#2E9E7B] animate-spin" />
        <p className="text-[#6B8A80] font-bold">مُرضي يحلل بياناتك...</p>
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

  const score = result.readiness_score;
  const scoreColor = score >= 70 ? '#2E9E7B' : score >= 50 ? '#C9A84C' : '#C0564B';
  const circumference = 2 * Math.PI * 54;
  const dash = (score / 100) * circumference;

  return (
    <div dir="rtl" className="min-h-screen bg-[#FBFCFB] px-4 py-10" style={{ fontFamily: 'Cairo, sans-serif' }}>
      <div className="max-w-xl mx-auto space-y-6">

        <div className="bg-white rounded-3xl p-8 shadow-sm border border-[#E8F5EF] text-center">
          <p className="text-[#6B8A80] font-bold mb-5">درجة جاهزيتك التمويلية</p>
          <div className="relative inline-block">
            <svg width="140" height="140" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="54" fill="none" stroke="#E8F5EF" strokeWidth="10" />
              <circle cx="60" cy="60" r="54" fill="none" stroke={scoreColor} strokeWidth="10"
                strokeLinecap="round" strokeDasharray={dash + ' ' + circumference}
                transform="rotate(-90 60 60)" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-4xl font-black" style={{ color: scoreColor }}>{score}</span>
              <span className="text-[#A3BAB2] text-xs font-bold">من 100</span>
            </div>
          </div>
          <p className="text-xl font-black text-[#1A3D34] mt-4">{result.verdict}</p>
          <p className="text-[#A3BAB2] text-xs font-bold mt-2 leading-relaxed">تحليل وفق منهجية د. عبدالحكيم المرضي — دكتوراه إدارة الأعمال، عضوية البورد الأمريكي، وخبرة 15 عاماً في القطاع المالي</p>
        </div>

        <div className="bg-gradient-to-l from-[#2E9E7B] to-[#7DD3B0] rounded-3xl p-7 text-white shadow-lg">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">🔍</span>
            <h2 className="font-black text-lg">مُرضي حلّل ملفك وفق منهجية د. عبدالحكيم المرضي</h2>
          </div>

          {matchLoading && (
            <div className="flex items-center gap-3 mt-4">
              <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              <p className="font-bold text-sm">جارٍ تحليل ملفك ومطابقته مع جهات التمويل وفق منهجية د. عبدالحكيم...</p>
            </div>
          )}

          {matchLoading === false && matchCount > 0 && (
            <>
              <p className="font-black text-3xl mt-2">{matchCount} {matchCount === 1 ? 'فرصة تمويلية' : 'فرص تمويلية'}</p>
              <p className="font-bold text-sm opacity-90 mt-1">رُشّحت لملفك بعد تحليل احترافي وبسرية تامة — لا نعرض كلام سوق، نعرض ما يناسبك فعلاً</p>
              <div className="space-y-3 mt-5">
                {(matches || []).map((m, i) => (
                  <div key={i} className="bg-white/15 backdrop-blur rounded-2xl p-4">
                    <div className="flex justify-between items-center mb-2">
                      <p className="font-black text-sm">{m.funding_type}</p>
                      <span className="bg-white text-[#2E9E7B] font-black text-xs px-3 py-1 rounded-full">ملاءمة {m.fit_percent}%</span>
                    </div>
                    <ul className="space-y-1">
                      {m.reasons.slice(0, 3).map((r, j) => (
                        <li key={j} className="text-xs font-bold opacity-90">✓ {r}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </>
          )}

          {matchLoading === false && matchCount === 0 && (
            <p className="font-bold text-sm mt-2 opacity-95">حلّلنا ملفك وفق منهجية د. عبدالحكيم — وضعك الحالي يحتاج خطوات قبل التقديم. اتبع خطة التحسين أدناه، وفريقنا سيراجع ملفك يدوياً بسرية تامة.</p>
          )}

          <div className="bg-white/20 rounded-2xl p-4 mt-5 text-center">
            <p className="font-black text-sm">✓ تم استلام ملفك — فريق مُرضي سيتواصل معك خلال 24-48 ساعة عمل</p>
          </div>
        </div>

        {result.top_obstacles?.length > 0 && (
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-[#E8F5EF]">
            <h2 className="font-black text-[#1A3D34] mb-4">⚠️ أبرز العوائق</h2>
            <ul className="space-y-2">
              {result.top_obstacles.map((o, i) => (
                <li key={i} className="text-[#6B8A80] font-bold text-sm bg-[#FBFCFB] rounded-xl p-3 border border-[#F0F5F3]">{o}</li>
              ))}
            </ul>
          </div>
        )}

        {result.improvement_plan?.length > 0 && (
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-[#E8F5EF]">
            <h2 className="font-black text-[#1A3D34] mb-4">📈 خطة التحسين</h2>
            <ul className="space-y-3">
              {result.improvement_plan.map((p, i) => (
                <li key={i} className="text-[#1A3D34] text-sm font-bold bg-[#E8F5EF] rounded-xl p-3 flex gap-3">
                  <span className="text-[#2E9E7B] font-black">{i + 1}</span> {p}
                </li>
              ))}
            </ul>
          </div>
        )}

        {result.required_documents?.length > 0 && (
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-[#E8F5EF]">
            <h2 className="font-black text-[#1A3D34] mb-4">📄 جهّز هذه المستندات</h2>
            <ul className="space-y-2">
              {result.required_documents.map((d, i) => (
                <li key={i} className="text-[#6B8A80] font-bold text-sm">✓ {d}</li>
              ))}
            </ul>
          </div>
        )}


        {consultStatus !== '' && (
          <div className="bg-white rounded-3xl p-7 shadow-sm border-2 border-[#C9A84C]">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-3xl">🎓</span>
              <div>
                <h2 className="font-black text-[#1A3D34]">استشارة د. عبدالحكيم المرضي الخاصة</h2>
                <p className="text-[#6B8A80] text-xs font-bold">تحليل خاص + خطة نجاح + توعية مالية — لشركتك تحديداً</p>
              </div>
            </div>
            {consultStatus !== 'released' && (
              <div className="bg-[#FBF5E8] rounded-2xl p-5 text-center">
                <div className="inline-block w-6 h-6 rounded-full border-2 border-[#C9A84C]/30 border-t-[#C9A84C] animate-spin mb-2" />
                <p className="text-[#9A7B2E] font-black text-sm">جارٍ التحليل من قبل د. عبدالحكيم المرضي...</p>
                <p className="text-[#A3BAB2] text-xs font-bold mt-1">ستصدر استشارتك الخاصة هنا فور اكتمال المراجعة</p>
              </div>
            )}
            {consultStatus === 'released' && consultContent !== '' && (
              <div className="bg-[#FBFCFB] rounded-2xl p-5 border border-[#F0F5F3] whitespace-pre-wrap text-[#1A3D34] text-sm font-bold leading-loose" style={{ maxHeight: '500px', overflowY: 'auto' }}>
                {consultContent.replace(/^#+ /gm, '').replace(/\*\*/g, '')}
              </div>
            )}
          </div>
        )}

        <p className="text-center text-[#A3BAB2] text-xs font-bold leading-relaxed pb-6">
          نتائج مُرضي تمثل مؤشرات جاهزية مبدئية فقط، ولا تعني الموافقة النهائية من أي جهة تمويل.
        </p>

      </div>
    </div>
  );
}
