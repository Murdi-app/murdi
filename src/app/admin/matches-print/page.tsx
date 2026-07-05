'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

type MatchRow = Record<string, unknown> & { id: string; track: string | null; status: string | null; created_at: string };

const TRACK_AR: Record<string, string> = { funding: 'التمويل', investment: 'الاستثمار', ipo: 'الطرح' };

function val(m: MatchRow, keys: string[]): string {
  for (const k of keys) {
    const v = m[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (typeof v === 'number') return String(v);
  }
  return '';
}
function arr(m: MatchRow, keys: string[]): string[] {
  for (const k of keys) {
    const v = m[k];
    if (Array.isArray(v)) return v.map(String).filter(Boolean);
  }
  return [];
}

function MatchesPrintInner() {
  const params = useSearchParams();
  const companyId = params.get('company_id') || '';
  const track = params.get('track') || '';
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [companyName, setCompanyName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!companyId) { setLoading(false); return; }
      try {
        const sb = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL as string,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
        );
        const { data: c } = await sb.from('companies').select('company_name, name').eq('id', companyId).single();
        if (c) setCompanyName(String((c as Record<string, unknown>).company_name || (c as Record<string, unknown>).name || ''));
        const r = await fetch('/api/admin/matches?company_id=' + companyId + (track ? '&track=' + track : ''));
        if (r.ok) { const d = await r.json(); setMatches(d.matches || []); }
      } catch { /* تجاهل */ }
      setLoading(false);
    })();
  }, [companyId, track]);

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>جاري التحميل…</div>;
  if (!companyId) return <div style={{ padding: 40, textAlign: 'center' }}>أضف company_id في الرابط</div>;

  return (
    <div dir="rtl" style={{ fontFamily: 'Tahoma, Arial, sans-serif', background: '#fff', color: '#222', padding: '28px 34px', maxWidth: 800, margin: '0 auto' }}>
      <style>{'@media print { .no-print { display: none } } @page { margin: 14mm }'}</style>

      <button className="no-print" onClick={() => window.print()} style={{ position: 'fixed', top: 14, left: 14, background: '#13302A', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 22px', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>🖨️ حفظ PDF (Cmd+P)</button>

      <div style={{ textAlign: 'center', borderBottom: '3px solid #C9A24B', paddingBottom: 14, marginBottom: 8 }}>
        <div style={{ color: '#C9A24B', fontWeight: 800, fontSize: 20, letterSpacing: 1 }}>مُرضي</div>
        <h1 style={{ color: '#13302A', fontSize: 21, margin: '6px 0 4px' }}>الجهات المرشحة{track ? ' — مسار ' + (TRACK_AR[track] || track) : ''}</h1>
        <div style={{ color: '#555', fontSize: 14, fontWeight: 700 }}>{companyName}</div>
        <div style={{ color: '#777', fontSize: 12.5, marginTop: 3 }}>حلول المرضي للاستشارات المالية · {new Date().toLocaleDateString('ar-SA')} · {matches.length} جهة</div>
      </div>

      <p style={{ fontSize: 12, color: '#888', lineHeight: 1.8, marginBottom: 18, textAlign: 'center' }}>
        أُعدت هذه القائمة وفق منهجية مُرضي بناءً على تقييم المنشأة ومعطياتها — الترتيب لا يعني أفضلية مطلقة، والمواءمة النهائية تتم مع فريق مُرضي.
      </p>

      {matches.map((m, i) => {
        const name = val(m, ['entity_name', 'name', 'funding_type', 'investor_type', 'entity']);
        const etype = val(m, ['entity_type', 'type', 'category', 'layer']);
        const product = val(m, ['product', 'funding_type', 'program']);
        const fit = val(m, ['fit_percent', 'fit', 'score']);
        const reasons = arr(m, ['reasons', 'reason_list']);
        const next = val(m, ['next_step', 'next']);
        return (
          <div key={m.id} style={{ border: '1px solid #ddd', borderRadius: 10, padding: '13px 16px', marginBottom: 13, pageBreakInside: 'avoid' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
              <strong style={{ color: '#13302A', fontSize: 15.5 }}>{i + 1}) {name || 'جهة'}</strong>
              <span style={{ color: '#C9A24B', fontWeight: 800, fontSize: 13.5 }}>{fit ? 'الملاءمة: ' + fit + '%' : ''}</span>
            </div>
            <div style={{ fontSize: 12.5, color: '#666', margin: '5px 0' }}>{[etype, product && product !== name ? product : ''].filter(Boolean).join(' · ')}</div>
            {reasons.length > 0 && (
              <ul style={{ fontSize: 12.5, color: '#444', lineHeight: 1.9, margin: '7px 0 0', paddingRight: 18 }}>
                {reasons.slice(0, 4).map((r, j) => <li key={j}>{r}</li>)}
              </ul>
            )}
            {next && <div style={{ fontSize: 12.5, color: '#13302A', marginTop: 7, fontWeight: 700 }}>الخطوة التالية: {next}</div>}
          </div>
        );
      })}

      {matches.length === 0 && <div style={{ textAlign: 'center', color: '#999', padding: 30 }}>لا توجد مطابقات محفوظة لهذا العميل{track ? ' في هذا المسار' : ''}</div>}

      <div style={{ textAlign: 'center', color: '#999', fontSize: 11.5, marginTop: 18 }}>وثيقة صادرة من منصة مُرضي — murdi.sa</div>
    </div>
  );
}

export default function MatchesPrintPage() {
  return <Suspense fallback={<div style={{ padding: 40, textAlign: 'center' }}>جاري التحميل…</div>}><MatchesPrintInner /></Suspense>;
}
