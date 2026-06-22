'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

const PUB_KEY = process.env.NEXT_PUBLIC_MOYASAR_PUBLISHABLE_KEY || '';

function PayInner() {
  const params = useSearchParams();
  const amountSar = Number(params.get('amount') || '2900');
  const kind = params.get('kind') || 'subscription';
  const companyId = params.get('company_id') || '';
  const label = kind === 'subscription' ? 'اشتراك العضوية الربعي' : 'خدمة استشارية';
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // تحميل نموذج Moyasar (CSS + JS) مرة واحدة
    if (document.getElementById('moyasar-css')) { setReady(true); return; }
    const css = document.createElement('link');
    css.id = 'moyasar-css';
    css.rel = 'stylesheet';
    css.href = 'https://cdn.moyasar.com/mpf/1.15.0/moyasar.css';
    document.head.appendChild(css);
    const js = document.createElement('script');
    js.src = 'https://cdn.moyasar.com/mpf/1.15.0/moyasar.js';
    js.onload = () => setReady(true);
    document.body.appendChild(js);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const w = window as unknown as { Moyasar?: { init: (o: unknown) => void } };
    if (!w.Moyasar) return;
    const origin = window.location.origin;
    w.Moyasar.init({
      element: '.mysr-form',
      amount: Math.round(amountSar * 100), // هللات
      currency: 'SAR',
      description: label,
      publishable_api_key: PUB_KEY,
      callback_url: origin + '/pay/done',
      methods: ['creditcard'],
      metadata: { kind, company_id: companyId },
    });
  }, [ready, amountSar, kind, companyId, label]);

  return (
    <div dir="rtl" style={{ fontFamily: 'Cairo', maxWidth: 560, margin: '0 auto', padding: '40px 20px', minHeight: '100vh', background: '#FBFCFB' }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <h1 style={{ color: '#1A3D34', fontSize: 24, fontWeight: 900, margin: 0 }}>إتمام الدفع</h1>
        <p style={{ color: '#6B8A80', fontSize: 14, marginTop: 8 }}>{label}</p>
        <div style={{ color: '#1A3D34', fontSize: 32, fontWeight: 900, marginTop: 12 }}>{amountSar.toLocaleString('ar-SA')} ريال</div>
      </div>
      {!PUB_KEY && <div style={{ background: '#FBEEEC', color: '#C0564B', padding: 16, borderRadius: 10, textAlign: 'center', fontSize: 13 }}>مفتاح الدفع غير مهيّأ. تواصل مع الدعم.</div>}
      <div className="mysr-form" />
      {!ready && PUB_KEY && <div style={{ textAlign: 'center', color: '#9DB3AB', padding: 30 }}>جارٍ تحميل نموذج الدفع الآمن…</div>}
      <p style={{ textAlign: 'center', color: '#9DB3AB', fontSize: 12, marginTop: 20 }}>🔒 دفع آمن ومشفّر عبر بوابة ميسر المرخّصة من ساما</p>
    </div>
  );
}

export default function PayPage() {
  return (
    <Suspense fallback={<div dir="rtl" style={{ fontFamily: 'Cairo', textAlign: 'center', padding: 60, color: '#9DB3AB' }}>جارٍ التحميل…</div>}>
      <PayInner />
    </Suspense>
  );
}
