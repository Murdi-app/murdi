'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import AskBox from '@/components/landing/AskBox';
import { isAskKind, type AskKind } from '@/lib/inquiryQuestions';

// رابط العميل الخاص لأسئلة استشارته (١٧ أكتوبر) — ترسله الموظفة في رسالة الأسئلة،
// فيجيب العميل بنفسه وتُكتب استشارته وتظهر له هنا، بدل أن تلصق الموظفة ردّه بيدها.

export default function AskPage() {
  const p = useParams<{ id: string; k: string }>();
  const id = String(p?.id || ''), k = String(p?.k || '');
  const [st, setSt] = useState<{ kind: AskKind; initial: 'ask' | 'wait' | 'ready' } | null>(null);
  const [bad, setBad] = useState(false);

  useEffect(() => {
    fetch('/api/services/inquiry/answers?id=' + encodeURIComponent(id) + '&k=' + encodeURIComponent(k))
      .then((r) => r.json())
      .then((d) => {
        if (!d?.ok) { setBad(true); return; }
        setSt({ kind: isAskKind(d.kind) ? d.kind : 'new', initial: d.ready ? 'wait' : d.answered ? 'wait' : 'ask' });
      })
      .catch(() => setBad(true));
  }, [id, k]);

  return (
    <div dir="rtl" style={{ background: '#FBFCFB', minHeight: '100vh', fontFamily: 'Tajawal, Cairo, sans-serif' }}>
      <nav style={{ background: '#fff', borderBottom: '1px solid #EAF2EE', padding: '16px 20px' }}>
        <div style={{ maxWidth: 680, margin: '0 auto', color: '#1A3D34', fontWeight: 900, fontSize: 22 }}>
          مُرضي <span style={{ fontSize: 11, color: '#9DB3AB', letterSpacing: '.14em', fontWeight: 500 }}>MURDI</span>
        </div>
      </nav>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '34px 20px 70px' }}>
        {bad ? (
          <div style={{ background: '#fff', border: '1.5px solid #EAF2EE', borderRadius: 18, padding: 28, textAlign: 'center', color: '#6B8A80', fontWeight: 800 }}>
            الرابط غير صالح — تواصل مع فريقنا على واتساب ونرسله لك من جديد.
          </div>
        ) : st ? (
          <AskBox id={id} k={k} kind={st.kind} fresh={false} initial={st.initial} />
        ) : (
          <div style={{ textAlign: 'center', color: '#9DB3AB', fontWeight: 800 }}>لحظة…</div>
        )}
      </div>
    </div>
  );
}
