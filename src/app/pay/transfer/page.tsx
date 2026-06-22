'use client';
import { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

const BANK = { name: 'البنك الأهلي السعودي SNB', beneficiary: 'شركة حلول المرضي للإستشارات المالية', iban: 'SA3710000026300000961004' };

function TransferInner() {
  const params = useSearchParams();
  const router = useRouter();
  const amountSar = Number(params.get('amount') || '2900');
  const kind = params.get('kind') || 'subscription';
  const companyId = params.get('company_id') || '';
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyIban = () => { navigator.clipboard.writeText(BANK.iban); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    let receiptUrl = '';
    try {
      if (file) {
        const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string);
        const path = companyId + '/' + Date.now() + '_' + file.name.replace(/[^a-zA-Z0-9._-]/g, '');
        const { error } = await supabase.storage.from('receipts').upload(path, file);
        if (!error) { const { data } = supabase.storage.from('receipts').getPublicUrl(path); receiptUrl = data.publicUrl; }
      }
      const r = await fetch('/api/payments/transfer', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, amountSar, kind, receiptUrl, note }),
      });
      if (r.ok) setDone(true);
    } catch { /* تجاهل */ }
    setBusy(false);
  };

  if (done) {
    return (
      <div dir="rtl" style={{ fontFamily: 'Cairo', maxWidth: 520, margin: '0 auto', padding: '60px 20px', minHeight: '100vh', background: '#FBFCFB', textAlign: 'center' }}>
        <div style={{ fontSize: 56 }}>✅</div>
        <h1 style={{ color: '#1A3D34', fontSize: 24, fontWeight: 900 }}>تم استلام تحويلك</h1>
        <p style={{ color: '#3A4D47', fontSize: 15, lineHeight: 1.9 }}>شكراً لك. جارٍ مراجعة التحويل من فريق مُرضي، وسيتم تفعيل اشتراكك فور التأكد. سيصلك إشعار قريباً.</p>
        <button onClick={() => router.push('/goal')} style={{ marginTop: 20, background: '#1A3D34', color: '#fff', border: 'none', padding: '12px 30px', borderRadius: 999, fontFamily: 'Cairo', fontWeight: 900, fontSize: 14, cursor: 'pointer' }}>العودة للوحة</button>
      </div>
    );
  }

  return (
    <div dir="rtl" style={{ fontFamily: 'Cairo', maxWidth: 560, margin: '0 auto', padding: '40px 20px', minHeight: '100vh', background: '#FBFCFB' }}>
      <h1 style={{ color: '#1A3D34', fontSize: 24, fontWeight: 900, textAlign: 'center', margin: 0 }}>الدفع عبر تحويل بنكي</h1>
      <div style={{ color: '#1A3D34', fontSize: 30, fontWeight: 900, textAlign: 'center', margin: '12px 0' }}>{amountSar.toLocaleString('ar-SA')} ريال</div>

      <div style={{ background: '#fff', border: '1.5px solid #EAF2EE', borderRadius: 14, padding: 20, marginTop: 16 }}>
        <div style={{ color: '#6B8A80', fontSize: 13, fontWeight: 700, marginBottom: 12 }}>حوّل المبلغ إلى الحساب التالي:</div>
        <div style={{ marginBottom: 10 }}><span style={{ color: '#9DB3AB', fontSize: 12 }}>المستفيد</span><div style={{ color: '#1A3D34', fontSize: 15, fontWeight: 800 }}>{BANK.beneficiary}</div></div>
        <div style={{ marginBottom: 10 }}><span style={{ color: '#9DB3AB', fontSize: 12 }}>البنك</span><div style={{ color: '#1A3D34', fontSize: 15, fontWeight: 800 }}>{BANK.name}</div></div>
        <div><span style={{ color: '#9DB3AB', fontSize: 12 }}>رقم الآيبان IBAN</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <code style={{ color: '#1A3D34', fontSize: 15, fontWeight: 800, letterSpacing: 0.5, direction: 'ltr', flex: 1 }}>{BANK.iban}</code>
            <button onClick={copyIban} style={{ background: '#F0F4F2', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 800, color: '#1A3D34', cursor: 'pointer', fontFamily: 'Cairo' }}>{copied ? '✓ نُسخ' : 'نسخ'}</button>
          </div>
        </div>
      </div>

      <div style={{ background: '#fff', border: '1.5px solid #EAF2EE', borderRadius: 14, padding: 20, marginTop: 14 }}>
        <div style={{ color: '#1A3D34', fontSize: 14, fontWeight: 800, marginBottom: 10 }}>📎 أرفق إيصال / إشعار الحوالة</div>
        <input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)}
          style={{ width: '100%', fontFamily: 'Cairo', fontSize: 13, marginBottom: 12 }} />
        <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="ملاحظة (اختياري) — مثل: اسم المُحوِّل أو تاريخ الحوالة"
          style={{ width: '100%', minHeight: 70, border: '1px solid #EAF2EE', borderRadius: 10, padding: 10, fontFamily: 'Cairo', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }} />
      </div>

      <button onClick={submit} disabled={busy || !file}
        style={{ width: '100%', background: (busy || !file) ? '#9DB3AB' : '#1A3D34', color: '#fff', border: 'none', padding: '15px', borderRadius: 999, fontFamily: 'Cairo', fontWeight: 900, fontSize: 15, cursor: (busy || !file) ? 'default' : 'pointer', marginTop: 16 }}>
        {busy ? 'جارٍ الإرسال…' : 'أرسلت الحوالة — أرسل للمراجعة'}
      </button>
      {!file && <p style={{ textAlign: 'center', color: '#9DB3AB', fontSize: 12, marginTop: 8 }}>الرجاء إرفاق الإيصال أولاً</p>}
    </div>
  );
}

export default function TransferPage() {
  return (
    <Suspense fallback={<div dir="rtl" style={{ fontFamily: 'Cairo', textAlign: 'center', padding: 60, color: '#9DB3AB' }}>جارٍ التحميل…</div>}>
      <TransferInner />
    </Suspense>
  );
}
