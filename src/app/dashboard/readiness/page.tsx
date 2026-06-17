'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';

type TrackResult = {
  assessment_type: string;
  readiness_score: number;
  verdict: string;
  top_obstacles: string[];
  improvement_plan: string[];
  valuation_estimate?: string;
  months_to_ready?: number;
  created_at: string;
};

const TRACKS = [
  { key: 'funding', label: 'التمويل', icon: '🏦' },
  { key: 'investment', label: 'الاستثمار', icon: '📈' },
  { key: 'ipo', label: 'الطرح', icon: '🏛️' },
];

function sectorPercentile(score: number): number {
  if (score >= 75) return 90;
  if (score >= 70) return 82;
  if (score >= 65) return 74;
  if (score >= 55) return 60;
  if (score >= 45) return 45;
  if (score >= 35) return 30;
  return 18;
}

export default function ReadinessProfile() {
  const [results, setResults] = useState<Record<string, TrackResult | null>>({});
  const [company, setCompany] = useState<{ name: string; sector: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCard, setShowCard] = useState(false);

  useEffect(() => {
    const load = async () => {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL as string,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
      );
      const { data: { user } } = await supabase.auth.getUser();
      if (user === null) { setLoading(false); return; }

      const { data: comp } = await supabase
        .from('companies')
        .select('id, company_name, sector')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (comp === null) { setLoading(false); return; }
      setCompany({ name: comp.company_name || 'شركتك', sector: comp.sector || 'غير محدد' });

      const out: Record<string, TrackResult | null> = {};
      for (const t of TRACKS) {
        const { data: rr } = await supabase
          .from('readiness_results')
          .select('assessment_type, readiness_score, verdict, top_obstacles, improvement_plan, valuation_estimate, months_to_ready, created_at')
          .eq('company_id', comp.id)
          .eq('assessment_type', t.key)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        out[t.key] = rr || null;
      }
      setResults(out);
      setLoading(false);
    };
    load();
  }, []);

  if (loading) {
    return (
      <div style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Cairo, sans-serif', direction: 'rtl', color: '#6B8A80', fontWeight: 700 }}>
        جارٍ تجهيز ملف جاهزيتك…
      </div>
    );
  }

  const done = TRACKS.filter((t) => results[t.key]);
  const scores = done.map((t) => results[t.key]!.readiness_score);
  const overall = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const pct = sectorPercentile(overall);

  const obstacles: { track: string; text: string }[] = [];
  done.forEach((t) => {
    const o = results[t.key]!.top_obstacles;
    if (o && o.length) obstacles.push({ track: t.label, text: o[0] });
  });

  return (
    <div style={{ fontFamily: 'Cairo, sans-serif', direction: 'rtl', color: '#1A3D34', maxWidth: 880, margin: '0 auto', padding: '28px 18px 70px' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&family=Amiri:wght@700&display=swap');`}</style>

      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 900, margin: '0 0 6px' }}>ملف جاهزية رأس المال</h1>
        <p style={{ color: '#6B8A80', fontWeight: 600, fontSize: 14 }}>{company?.name} — قطاع {company?.sector}</p>
      </div>

      <div style={{ background: 'linear-gradient(135deg,#1A3D34,#2E5D4E)', borderRadius: 24, padding: '32px 28px', textAlign: 'center', marginBottom: 22, boxShadow: '0 18px 50px rgba(26,61,52,0.18)' }}>
        <p style={{ color: '#C9D8D0', fontSize: 13, fontWeight: 700, margin: '0 0 8px' }}>مؤشر جاهزيتك العام</p>
        <div style={{ fontSize: 60, fontWeight: 900, color: '#C9A84C', lineHeight: 1 }}>{overall}<span style={{ fontSize: 24, color: '#9DB3AB' }}> / 85</span></div>
        {done.length > 0 && (
          <p style={{ color: '#fff', fontSize: 14, fontWeight: 700, margin: '14px 0 0' }}>
            شركتك أفضل من <span style={{ color: '#C9A84C' }}>{pct}%</span> من الشركات في مرحلتك
          </p>
        )}
        <p style={{ color: '#8FA8A0', fontSize: 11.5, fontWeight: 600, margin: '6px 0 0' }}>تقدير منهجي بحسب معايير الجاهزية — يتحدّث مع كل تقييم</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 24 }}>
        {TRACKS.map((t) => {
          const r = results[t.key];
          return (
            <div key={t.key} style={{ background: '#fff', border: '1.5px solid #EAF2EE', borderRadius: 18, padding: '20px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: 26, marginBottom: 6 }}>{t.icon}</div>
              <div style={{ fontWeight: 900, fontSize: 14, marginBottom: 8 }}>{t.label}</div>
              {r ? (
                <>
                  <div style={{ fontSize: 30, fontWeight: 900, color: r.readiness_score >= 65 ? '#1A3D34' : '#C9A84C', lineHeight: 1 }}>{r.readiness_score}</div>
                  <div style={{ fontSize: 11, color: '#9DB3AB', fontWeight: 600 }}>من 85</div>
                </>
              ) : (
                <a href={`/assessment/${t.key}`} style={{ display: 'inline-block', marginTop: 6, fontSize: 12, fontWeight: 700, color: '#C9A84C', textDecoration: 'none' }}>لم يُقيَّم بعد ←</a>
              )}
            </div>
          );
        })}
      </div>

      {obstacles.length > 0 && (
        <div style={{ background: '#fff', border: '1.5px solid #EAF2EE', borderRadius: 20, padding: '24px 22px', marginBottom: 22 }}>
          <h2 style={{ fontSize: 17, fontWeight: 900, margin: '0 0 14px' }}>أبرز ما يرفع جاهزيتك الآن</h2>
          {obstacles.map((o, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 0', borderBottom: i < obstacles.length - 1 ? '1px solid #F0F5F3' : 'none' }}>
              <span style={{ background: '#FBF5E8', color: '#9A7B2E', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 12, flexShrink: 0 }}>{o.track}</span>
              <span style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.6 }}>{o.text}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ background: 'linear-gradient(135deg,#FBF5E8,#fff)', border: '2px solid #C9A84C', borderRadius: 20, padding: '26px 22px', textAlign: 'center', marginBottom: 14 }}>
        <h2 style={{ fontSize: 18, fontWeight: 900, margin: '0 0 8px' }}>بطاقة عرض شركتك</h2>
        <p style={{ color: '#6B8A80', fontSize: 13.5, fontWeight: 600, lineHeight: 1.7, margin: '0 0 18px' }}>ملخّص احترافي من صفحة واحدة تقدّمه لأي جهة تمويل أو مستثمر — جاهز للطباعة.</p>
        <button onClick={() => setShowCard(true)} style={{ background: '#C9A84C', color: '#1A3D34', border: 'none', padding: '13px 36px', borderRadius: 40, fontFamily: 'Cairo', fontSize: 15, fontWeight: 900, cursor: 'pointer' }}>اعرض بطاقتي</button>
      </div>

      {showCard && company && (
        <div onClick={() => setShowCard(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(11,28,30,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 22, padding: '34px 30px', maxWidth: 460, width: '100%', boxShadow: '0 24px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ borderBottom: '2px solid #C9A84C', paddingBottom: 14, marginBottom: 16 }}>
              <div style={{ fontFamily: 'Amiri, serif', fontSize: 20, fontWeight: 700, color: '#1A3D34' }}>{company.name}</div>
              <div style={{ color: '#6B8A80', fontSize: 12.5, fontWeight: 600 }}>قطاع {company.sector} • ملف جاهزية رأس المال</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 34, fontWeight: 900, color: '#C9A84C', lineHeight: 1 }}>{overall}</div>
                <div style={{ fontSize: 11, color: '#9DB3AB', fontWeight: 600 }}>جاهزية عامة /85</div>
              </div>
              {done.map((t) => (
                <div key={t.key} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: '#1A3D34', lineHeight: 1.4 }}>{results[t.key]!.readiness_score}</div>
                  <div style={{ fontSize: 10.5, color: '#9DB3AB', fontWeight: 600 }}>{t.label}</div>
                </div>
              ))}
            </div>
            {done.find((t) => results[t.key]!.valuation_estimate) && (
              <div style={{ background: '#F3F8F5', borderRadius: 12, padding: '10px 14px', marginBottom: 14, fontSize: 13, fontWeight: 700, color: '#2E5D4E', textAlign: 'center' }}>
                التقييم التقديري: {done.map((t) => results[t.key]!.valuation_estimate).find(Boolean)}
              </div>
            )}
            <p style={{ fontSize: 12, color: '#9DB3AB', fontWeight: 600, textAlign: 'center', margin: '0 0 16px' }}>صادر عن منصة مُرضي — د. عبدالحكيم المرضي</p>
            <button onClick={() => window.print()} style={{ width: '100%', background: '#1A3D34', color: '#fff', border: 'none', padding: '12px', borderRadius: 30, fontFamily: 'Cairo', fontSize: 14, fontWeight: 900, cursor: 'pointer' }}>طباعة / حفظ PDF</button>
          </div>
        </div>
      )}
    </div>
  );
}
