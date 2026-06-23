'use client';
import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';

const ADMIN_EMAIL = 'hololalmurdi.fs@gmail.com';

type Payment = {
  id: string; company_id: string | null; company_name: string; kind: string;
  description: string | null; amount_sar: number; method: string | null; status: string;
  moyasar_id: string | null; transfer_receipt_url: string | null; transfer_note: string | null;
  paid_at: string | null; created_at: string;
};

const STATUS_META: Record<string, { ar: string; color: string; bg: string }> = {
  paid: { ar: 'مدفوع', color: '#1A7A4C', bg: '#E8F5EF' },
  awaiting_confirmation: { ar: 'بانتظار التأكيد', color: '#B8860B', bg: '#FBF3DC' },
  pending: { ar: 'معلّق', color: '#6B8A80', bg: '#F0F4F2' },
  failed: { ar: 'فشل', color: '#C0564B', bg: '#FBEEEC' },
  rejected: { ar: 'مرفوض', color: '#C0564B', bg: '#FBEEEC' },
};

export default function PaymentsPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
  );

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/auth/login'); return; }
    if (user.email !== ADMIN_EMAIL) { setAuthorized(false); setLoading(false); return; }
    setAuthorized(true);
    await load();
    setLoading(false);
  }

  async function load() {
    try {
      const r = await fetch('/api/admin/payments');
      if (r.ok) { const d = await r.json(); setPayments(d.payments || []); }
    } catch { /* تجاهل */ }
  }

  async function act(id: string, action: 'confirm' | 'reject') {
    if (action === 'reject' && !confirm('رفض هذا التحويل؟')) return;
    setBusy(id);
    try {
      await fetch('/api/admin/payments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      });
      await load();
    } catch { /* تجاهل */ }
    setBusy(null);
  }

  if (loading) return <div dir="rtl" style={{ fontFamily: 'Cairo', textAlign: 'center', padding: 80, color: '#9DB3AB' }}>جارٍ التحميل…</div>;
  if (!authorized) return <div dir="rtl" style={{ fontFamily: 'Cairo', textAlign: 'center', padding: 80, color: '#C0564B' }}>غير مصرّح لك بالدخول.</div>;

  const pending = payments.filter((p) => p.status === 'awaiting_confirmation');
  const others = payments.filter((p) => p.status !== 'awaiting_confirmation');

  const card = (p: Payment) => {
    const st = STATUS_META[p.status] || STATUS_META.pending;
    return (
      <div key={p.id} style={{ background: '#fff', border: '1.5px solid #EAF2EE', borderRadius: 12, padding: '16px 18px', marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ color: '#1A3D34', fontSize: 16, fontWeight: 900 }}>{p.company_name}</div>
          <span style={{ background: st.bg, color: st.color, borderRadius: 6, padding: '3px 11px', fontSize: 12, fontWeight: 900 }}>{st.ar}</span>
        </div>
        <div style={{ color: '#3A4D47', fontSize: 13.5, fontWeight: 700, margin: '8px 0' }}>{p.description || '—'}</div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', color: '#6B8A80', fontSize: 12.5, marginBottom: 8 }}>
          <span>المبلغ: <b style={{ color: '#1A3D34' }}>{p.amount_sar?.toLocaleString('ar-SA')} ريال</b></span>
          <span>الطريقة: {p.method === 'online' ? '💳 أونلاين' : p.method === 'transfer' ? '🏦 تحويل' : '—'}</span>
          <span>{new Date(p.created_at).toLocaleDateString('ar-SA')}</span>
        </div>
        {p.transfer_note && <div style={{ color: '#6B8A80', fontSize: 12.5, marginBottom: 8 }}>📝 {p.transfer_note}</div>}
        {p.transfer_receipt_url && (
          <a href={p.transfer_receipt_url} target="_blank" rel="noopener noreferrer"
            style={{ display: 'inline-block', color: '#2E9E7B', fontSize: 13, fontWeight: 800, textDecoration: 'none', marginBottom: 8 }}>📎 عرض الإيصال</a>
        )}
        {p.status === 'awaiting_confirmation' && (
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button onClick={() => act(p.id, 'confirm')} disabled={busy === p.id}
              style={{ flex: 1, background: '#1A3D34', color: '#fff', border: 'none', padding: '10px', borderRadius: 999, fontFamily: 'Cairo', fontWeight: 900, fontSize: 13.5, cursor: 'pointer' }}>
              {busy === p.id ? '…' : '✅ تأكيد وتفعيل الاشتراك'}
            </button>
            <button onClick={() => act(p.id, 'reject')} disabled={busy === p.id}
              style={{ background: '#FBEEEC', color: '#C0564B', border: 'none', padding: '10px 16px', borderRadius: 999, fontFamily: 'Cairo', fontWeight: 900, fontSize: 13.5, cursor: 'pointer' }}>رفض</button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div dir="rtl" style={{ fontFamily: 'Cairo', maxWidth: 900, margin: '0 auto', padding: '28px 20px', background: '#FBFCFB', minHeight: '100vh' }}>
      <div style={{ display:'flex', gap:8, marginBottom:22, borderBottom:'2px solid #EAF2EE', paddingBottom:0, flexWrap:'wrap' }}>
        <div onClick={()=>router.push('/admin')} style={{ padding:'10px 18px', color:'#6B8A80', fontWeight:700, fontSize:14, cursor:'pointer', fontFamily:'Cairo,sans-serif' }}>لوحة التحكم</div>
        <div onClick={()=>router.push('/admin/approvals')} style={{ padding:'10px 18px', color:'#6B8A80', fontWeight:700, fontSize:14, cursor:'pointer', fontFamily:'Cairo,sans-serif' }}>الاعتمادات</div>
        <div onClick={()=>router.push('/admin/entities')} style={{ padding:'10px 18px', color:'#6B8A80', fontWeight:700, fontSize:14, cursor:'pointer', fontFamily:'Cairo,sans-serif' }}>الجهات</div>
        <div onClick={()=>router.push('/admin/services')} style={{ padding:'10px 18px', color:'#6B8A80', fontWeight:700, fontSize:14, cursor:'pointer', fontFamily:'Cairo,sans-serif' }}>الخدمات</div>
        <div onClick={()=>router.push('/admin/hunt')} style={{ padding:'10px 18px', color:'#6B8A80', fontWeight:700, fontSize:14, cursor:'pointer', fontFamily:'Cairo,sans-serif' }}>🎯 صيد الفرص</div>
        <div style={{ padding:'10px 18px', color:'#2E9E7B', fontWeight:900, fontSize:14, borderBottom:'2px solid #2E9E7B', fontFamily:'Cairo,sans-serif' }}>💳 المدفوعات</div>
      </div>
      <h1 style={{ color: '#1A3D34', fontSize: 24, fontWeight: 900, margin: 0 }}>💳 المدفوعات</h1>
      <p style={{ color: '#6B8A80', fontSize: 13, marginTop: 4, marginBottom: 20 }}>التحويلات البنكية بانتظار تأكيدك، وسجلّ كل المدفوعات.</p>

      <h2 style={{ color: '#B8860B', fontSize: 16, fontWeight: 900, marginBottom: 12 }}>🏦 تحويلات بانتظار التأكيد ({pending.length})</h2>
      {pending.length === 0 ? <div style={{ color: '#9DB3AB', fontSize: 13, padding: '16px 0', marginBottom: 12 }}>لا توجد تحويلات معلّقة.</div> : pending.map(card)}

      <h2 style={{ color: '#1A3D34', fontSize: 16, fontWeight: 900, margin: '24px 0 12px' }}>📋 سجلّ المدفوعات ({others.length})</h2>
      {others.length === 0 ? <div style={{ color: '#9DB3AB', fontSize: 13, padding: '16px 0' }}>لا توجد مدفوعات بعد.</div> : others.map(card)}
    </div>
  );
}
