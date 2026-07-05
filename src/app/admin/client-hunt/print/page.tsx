'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

type CLead = {
  id: string; hunt_date: string; company_name: string; sector: string | null; city: string | null;
  signal: string | null; email: string | null; phone: string | null; source: string | null;
  message: string | null; status: string; call_script: string | null;
};

function PrintInner() {
  const params = useSearchParams();
  const mode = params.get('mode') === 'call_list' ? 'call_list' : 'all';
  const [leads, setLeads] = useState<CLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [marked, setMarked] = useState(false);

  async function markAllDistributed() {
    if (leads.length === 0) return;
    if (!confirm('تعليم كل هذه القائمة (' + leads.length + ' منشأة) كموزَّعة؟ لن تظهر في الطباعات القادمة.')) return;
    try {
      await fetch('/api/admin/client-hunt', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: leads.map((l) => l.id), newStatus: 'distributed' }) });
      setMarked(true);
    } catch { alert('خطأ في الاتصال'); }
  }

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/admin/client-hunt');
        if (r.ok) {
          const d = await r.json();
          const all = (d.leads || []) as CLead[];
          setLeads(mode === 'call_list'
            ? all.filter((l) => l.status === 'call_list')
            : all.filter((l) => l.status === 'new'));
        }
      } catch { /* تجاهل */ }
      setLoading(false);
    })();
  }, [mode]);

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>جاري التحميل…</div>;

  return (
    <div dir="rtl" style={{ fontFamily: 'Tahoma, Arial, sans-serif', background: '#fff', color: '#222', padding: '28px 34px', maxWidth: 800, margin: '0 auto' }}>
      <style>{'@media print { .no-print { display: none } } @page { margin: 14mm }'}</style>

      <button className="no-print" onClick={() => window.print()} style={{ position: 'fixed', top: 14, left: 14, background: '#13302A', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 22px', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>🖨️ حفظ PDF (Cmd+P)</button>
      {mode === 'call_list' && (
        <button className="no-print" onClick={markAllDistributed} disabled={marked} style={{ position: 'fixed', top: 60, left: 14, background: marked ? '#2E9E7B' : '#5B3A8E', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 22px', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>{marked ? '✓ وُزّعت' : '✓ تعليم القائمة كموزَّعة'}</button>
      )}

      <div style={{ textAlign: 'center', borderBottom: '3px solid #C9A24B', paddingBottom: 14, marginBottom: 22 }}>
        <div style={{ color: '#C9A24B', fontWeight: 800, fontSize: 20, letterSpacing: 1 }}>مُرضي</div>
        <h1 style={{ color: '#13302A', fontSize: 21, margin: '6px 0 4px' }}>{mode === 'call_list' ? 'قائمة الاتصال اليومية' : 'قائمة صيد العملاء'}</h1>
        <div style={{ color: '#777', fontSize: 13 }}>حلول المرضي للاستشارات المالية · {new Date().toLocaleDateString('ar-SA')} · {leads.length} منشأة</div>
      </div>

      {leads.map((l, i) => (
        <div key={l.id} style={{ border: '1px solid #ddd', borderRadius: 10, padding: '13px 16px', marginBottom: 13, pageBreakInside: 'avoid' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
            <strong style={{ color: '#13302A', fontSize: 15.5 }}>{i + 1}) {l.company_name}</strong>
            <span style={{ color: '#666', fontSize: 12.5 }}>{[l.sector, l.city].filter(Boolean).join(' · ')}</span>
          </div>
          <div style={{ fontSize: 13.5, margin: '7px 0', color: '#13302A', fontWeight: 700 }}>
            {l.phone ? (l.phone.startsWith('9665') ? '📱 جوال: ' : '☎️ هاتف: ') + l.phone : ''}
            {l.phone && l.email ? ' · ' : ''}
            {l.email ? '✉️ ' + l.email : ''}
          </div>
          {l.signal && <div style={{ fontSize: 12.5, color: '#555', lineHeight: 1.8, marginBottom: 7 }}>ℹ️ {l.signal}</div>}
          {mode === 'call_list' && l.call_script && (
            <div style={{ background: '#f6f3fb', border: '1px solid #e0d5f0', borderRadius: 8, padding: '9px 12px', fontSize: 12.5, lineHeight: 1.9, whiteSpace: 'pre-wrap' }}>
              <strong>📞 سكربت المكالمة:</strong>{'\n'}{l.call_script}
            </div>
          )}
          {mode === 'all' && l.message && (
            <div style={{ background: '#f7f7f4', borderRadius: 8, padding: '9px 12px', fontSize: 12.5, lineHeight: 1.9, whiteSpace: 'pre-wrap' }}>{l.message}</div>
          )}
        </div>
      ))}

      <div style={{ textAlign: 'center', color: '#999', fontSize: 11.5, marginTop: 18 }}>للاستخدام الداخلي — فريق مُرضي</div>
    </div>
  );
}

export default function PrintPage() {
  return <Suspense fallback={<div style={{ padding: 40, textAlign: 'center' }}>جاري التحميل…</div>}><PrintInner /></Suspense>;
}
