'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function DoneInner() {
  const params = useSearchParams();
  const paymentId = params.get('id') || '';
  const moyasarStatus = params.get('status') || '';
  const [state, setState] = useState<'checking' | 'paid' | 'failed'>('checking');

  useEffect(() => {
    if (!paymentId) { setState('failed'); return; }
    (async () => {
      try {
        const r = await fetch('/api/payments/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentId }),
        });
        const d = await r.json();
        setState(d.paid ? 'paid' : 'failed');
      } catch {
        setState('failed');
      }
    })();
  }, [paymentId, moyasarStatus]);

  return (
    <div dir="rtl" style={{ fontFamily: 'Cairo', maxWidth: 520, margin: '0 auto', padding: '60px 20px', minHeight: '100vh', background: '#FBFCFB', textAlign: 'center' }}>
      {state === 'checking' && (
        <>
          <div style={{ fontSize: 40 }}>⏳</div>
          <h1 style={{ color: '#1A3D34', fontSize: 22, fontWeight: 900 }}>جار تأكيد الدفع…</h1>
          <p style={{ color: '#6B8A80', fontSize: 14 }}>لحظات من فضلك، نتحقّق من عملية الدفع.</p>
        </>
      )}
      {state === 'paid' && (
        <>
          <div style={{ fontSize: 56 }}>✅</div>
          <h1 style={{ color: '#1A3D34', fontSize: 24, fontWeight: 900 }}>تمّ الدفع بنجاح</h1>
          <p style={{ color: '#3A4D47', fontSize: 15, lineHeight: 1.9 }}>شكراً لك. تم تفعيل طلبك، وستصلك التفاصيل قريباً.</p>
          <a href="/" style={{ display: 'inline-block', marginTop: 20, background: '#1A3D34', color: '#fff', textDecoration: 'none', padding: '12px 30px', borderRadius: 999, fontWeight: 900, fontSize: 14 }}>العودة للرئيسية</a>
        </>
      )}
      {state === 'failed' && (
        <>
          <div style={{ fontSize: 56 }}>⚠️</div>
          <h1 style={{ color: '#C0564B', fontSize: 24, fontWeight: 900 }}>لم تكتمل عملية الدفع</h1>
          <p style={{ color: '#3A4D47', fontSize: 15, lineHeight: 1.9 }}>حدث خطأ أو أُلغيت العملية. يمكنك المحاولة مرّة أخرى، أو اختيار الدفع بالتحويل البنكي.</p>
          <a href="/" style={{ display: 'inline-block', marginTop: 20, background: '#1A3D34', color: '#fff', textDecoration: 'none', padding: '12px 30px', borderRadius: 999, fontWeight: 900, fontSize: 14 }}>العودة للرئيسية</a>
        </>
      )}
    </div>
  );
}

export default function PayDonePage() {
  return (
    <Suspense fallback={<div dir="rtl" style={{ fontFamily: 'Cairo', textAlign: 'center', padding: 60, color: '#9DB3AB' }}>جارٍ التحميل…</div>}>
      <DoneInner />
    </Suspense>
  );
}
