'use client';

import { useState, useEffect } from 'react';
import { KIND_QUESTIONS, type AskKind } from '@/lib/inquiryQuestions';

// أسئلة الاستشارة الأربعة ثم الاستشارة نفسها حين تجهز — على صفحة التسجيل بعد الإرسال،
// وعلى رابط العميل الخاص (/q/…) الذي ترسله له الموظفة بدل أن تلصق ردّه بيدها (١٧ أكتوبر).

const GREEN = '#1A3D34';
const MUTED = '#6B8A80';
const FONT = 'Tajawal, Cairo, sans-serif';
const box: React.CSSProperties = { background: '#fff', border: '1.5px solid #BFE0D3', borderRadius: 18, padding: '28px 24px' };
const inputCls: React.CSSProperties = {
  width: '100%', padding: '12px 15px', borderRadius: 12, border: '1.5px solid #D9E5DF', fontFamily: FONT,
  fontSize: 14.5, fontWeight: 700, color: GREEN, background: '#fff', boxSizing: 'border-box', resize: 'vertical', lineHeight: 1.8,
};

export default function AskBox({ id, k, kind, phone, fresh = true, onSkip, initial = 'ask' }: {
  id: string; k: string; kind: AskKind; phone?: string; fresh?: boolean; onSkip?: () => void; initial?: 'ask' | 'wait' | 'ready';
}) {
  const [answers, setAnswers] = useState<string[]>(['', '', '', '']);
  const [stage, setStage] = useState<'ask' | 'wait' | 'ready'>(initial);
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const enough = answers.filter((a) => a.trim().length >= 2).length >= 2;

  useEffect(() => {
    if (stage !== 'wait') return;
    let n = 0;
    const poll = async () => {
      try {
        const r = await fetch('/api/services/inquiry/answers?id=' + encodeURIComponent(id) + '&k=' + encodeURIComponent(k));
        const d = await r.json();
        if (d?.ready && d?.code) { setCode(String(d.code)); setStage('ready'); return true; }
      } catch { /* الدورة التالية */ }
      return false;
    };
    poll();
    const t = setInterval(async () => { if (++n > 90 || (await poll())) clearInterval(t); }, 30_000);
    return () => clearInterval(t);
  }, [stage, id, k]);

  const send = async () => {
    setErr(''); setBusy(true);
    try {
      const r = await fetch('/api/services/inquiry/answers', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, k, answers }),
      });
      const d = await r.json();
      if (!r.ok || d?.error) setErr(d?.error || 'تعذّر الإرسال');
      else setStage('wait');
    } catch { setErr('تعذّر الاتصال — تحقق من الشبكة وأعد المحاولة'); }
    setBusy(false);
  };

  const tail = phone ? <>يرسلها لك فريقنا على <b style={{ color: GREEN }}>{phone}</b></> : <>يرسلها لك فريقنا على واتساب</>;

  if (stage === 'wait') return (
    <div style={{ ...box, textAlign: 'center' }}>
      <div style={{ color: '#1A5C46', fontWeight: 900, fontSize: 20, marginBottom: 10 }}>وصلت إجاباتك — استشارتك تُكتب الآن</div>
      <p style={{ color: MUTED, fontSize: 14, fontWeight: 700, lineHeight: 2, margin: 0 }}>
        تظهر لك في هذه الصفحة حين تجهز — عادةً خلال دقائق، وقد تصل لنصف ساعة. خلّ الصفحة مفتوحة، وإن أغلقتها {tail}.
      </p>
    </div>
  );
  if (stage === 'ready') return (
    <div style={{ ...box, textAlign: 'center' }}>
      <div style={{ color: '#1A5C46', fontWeight: 900, fontSize: 21, marginBottom: 10 }}>استشارتك جاهزة ✓</div>
      <p style={{ color: MUTED, fontSize: 14, fontWeight: 700, lineHeight: 2, margin: '0 0 20px' }}>
        كتبها الدكتور عبدالحكيم على ما أرسلته — اقرأها، ويتواصل معك فريقنا للخطوة التالية.
      </p>
      <a href={'/r/' + code} target="_blank" rel="noopener"
        style={{ display: 'inline-block', background: GREEN, color: '#fff', padding: '13px 34px', borderRadius: 999, fontWeight: 900, fontSize: 15, textDecoration: 'none' }}>
        افتح استشارتك
      </a>
    </div>
  );
  return (
    <div style={box}>
      <div style={{ color: '#1A5C46', fontWeight: 900, fontSize: 20, marginBottom: 6, textAlign: 'center' }}>{fresh ? 'وصلنا مشروعك ✓' : 'أسئلة استشارتك'}</div>
      <p style={{ color: MUTED, fontSize: 14, fontWeight: 700, lineHeight: 1.95, margin: '0 0 20px', textAlign: 'center' }}>
        {fresh ? <>باقي <b style={{ color: GREEN }}>٤ أسئلة سريعة</b> — </> : null}ويكتب لك الدكتور عبدالحكيم <b style={{ color: GREEN }}>استشارة مبدئية على وضعك</b> تظهر لك هنا خلال دقائق، بدون أي التزام. سطر لكل سؤال يكفي.
      </p>
      {KIND_QUESTIONS[kind].map((q, i) => (
        <div key={q} style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', color: GREEN, fontWeight: 900, fontSize: 14, marginBottom: 7 }}>{'١٢٣٤'[i]} · {q}</label>
          <textarea value={answers[i]} rows={2} maxLength={600} style={inputCls}
            onChange={(e) => setAnswers((a) => a.map((x, j) => (j === i ? e.target.value : x)))} />
        </div>
      ))}
      {err && <div style={{ background: '#FDECEA', border: '1px solid #F3C4BE', borderRadius: 10, padding: '10px 13px', marginBottom: 12, color: '#A8342A', fontSize: 13, fontWeight: 800 }}>{err}</div>}
      <button type="button" onClick={send} disabled={busy || !enough}
        style={{ width: '100%', background: GREEN, color: '#fff', border: 'none', borderRadius: 999, padding: '15px', fontSize: 16, fontWeight: 900, cursor: 'pointer', fontFamily: FONT, opacity: busy || !enough ? 0.5 : 1 }}>
        {busy ? 'لحظة…' : 'أرسل إجاباتي — وجهّزوا استشارتي'}
      </button>
      {onSkip && (
        <button type="button" onClick={onSkip}
          style={{ display: 'block', margin: '12px auto 0', background: 'none', border: 'none', color: '#9DB3AB', fontWeight: 800, fontSize: 12.5, cursor: 'pointer', fontFamily: FONT }}>
          أفضّل أن يتصل بي الفريق ويسألني
        </button>
      )}
    </div>
  );
}
