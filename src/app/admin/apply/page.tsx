'use client';
import AdminNav from '@/components/AdminNav';
import { useState, useEffect } from 'react';

type Row = {
  id: string; company_id: string; company_name: string; track: string;
  provider: string; product: string | null; fit_score: number | null;
  apply_channel: string | null; apply_url: string | null; apply_steps: string | null;
  required_docs: string | null; apply_status: string | null; apply_note: string | null;
  entity_email: string | null;
};

const C = { ink: '#1A3D34', gold: '#C9A84C', green: '#2E9E7B', gray: '#6B8A80', mint: '#E8F5EF' };
const STATES = ['لم يُقدَّم', 'قيد التقديم', 'قُدِم', 'ردّت'];

export default function ApplyPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [co, setCo] = useState('');
  const [st, setSt] = useState('');
  const [busy, setBusy] = useState('');
  type DueFU = { id: string; company_id: string; entity_name: string; entity_language: string; followup_stage: number; last_sent_at: string | null };
  const [due, setDue] = useState<DueFU[]>([]);
  const [fuMsg, setFuMsg] = useState('');

  const load = () => fetch('/api/admin/apply').then(r => r.json()).then(d => setRows(d.rows || [])).catch(() => {});
  useEffect(() => { load(); fetch('/api/admin/outreach/followups').then(r => r.json()).then(d => setDue(d.due || [])).catch(() => {}); }, []);

  async function sendFU(item: DueFU) {
    setFuMsg('جارٍ إرسال المتابعة لـ ' + item.entity_name + '\u2026');
    const r = await fetch('/api/admin/outreach/followups', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item.id, company_name: '' }) });
    if (r.ok) { setFuMsg('✅ أُرسلت المتابعة لـ ' + item.entity_name); setDue(p => p.filter(x => x.id !== item.id)); }
    else { setFuMsg('تعذّر الإرسال لـ ' + item.entity_name); }
  }

  async function setStatus(id: string, s: string) {
    setBusy(id);
    await fetch('/api/admin/apply', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, apply_status: s }) });
    setRows(p => p.map(r => r.id === id ? { ...r, apply_status: s } : r));
    setBusy('');
  }

  const cos = Array.from(new Set(rows.map(r => r.company_name).filter(Boolean)));
  const shown = rows.filter(r => (!co || r.company_name === co) && (!st || (r.apply_status || 'لم يُقدَّم') === st))
    .sort((a, b) => ((a.apply_status === 'قُدِّم' ? 1 : 0) - (b.apply_status === 'قُدِّم' ? 1 : 0)) || ((b.fit_score || 0) - (a.fit_score || 0)));
  const count = (s: string) => rows.filter(r => (r.apply_status || 'لم يُقدَّم') === s).length;

  return (
    <div dir="rtl" style={{ fontFamily: 'Cairo, sans-serif', background: '#FBFCFB', minHeight: '100vh' }}>
      <AdminNav />
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 16px' }}>
        <h1 style={{ color: C.ink, fontWeight: 900, fontSize: 24, marginBottom: 6 }}>لوحة التقديم</h1>
        <p style={{ color: C.gray, fontWeight: 700, fontSize: 13, marginBottom: 18 }}>كل جهة مطابَقة وطريق التقديم عليها — ابدأ من الأعلى.</p>

        {due.length > 0 && (
          <div style={{ background: '#FBF5E8', border: '1.5px solid #EAD9A8', borderRadius: 16, padding: 16, marginBottom: 16 }}>
            <div style={{ color: '#6B5A2E', fontWeight: 900, fontSize: 13.5, marginBottom: 10 }}>متابعات مستحقة اليوم: {due.length}</div>
            {due.map(x => (
              <div key={x.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '7px 0', borderTop: '1px solid #EFE3C8' }}>
                <span style={{ color: C.ink, fontWeight: 800, fontSize: 12.5 }}>{x.entity_name} · المتابعة {x.followup_stage === 0 ? 'الأولى' : 'الأخيرة'}</span>
                <button onClick={() => sendFU(x)} style={{ background: C.gold, color: C.ink, border: 'none', borderRadius: 20, padding: '6px 16px', fontFamily: 'Cairo', fontWeight: 900, fontSize: 11.5, cursor: 'pointer' }}>أرسل المتابعة</button>
              </div>
            ))}
            {fuMsg && <div style={{ color: '#6B5A2E', fontWeight: 800, fontSize: 12, marginTop: 8 }}>{fuMsg}</div>}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
          {STATES.map(s => (
            <button key={s} onClick={() => setSt(st === s ? '' : s)}
              style={{ background: st === s ? C.ink : '#fff', color: st === s ? '#fff' : C.ink, border: '1.5px solid ' + C.mint, borderRadius: 30, padding: '8px 16px', fontFamily: 'Cairo', fontWeight: 900, fontSize: 12.5, cursor: 'pointer' }}>
              {s} ({count(s)})
            </button>
          ))}
          <select value={co} onChange={e => setCo(e.target.value)}
            style={{ border: '1.5px solid ' + C.mint, borderRadius: 30, padding: '8px 14px', fontFamily: 'Cairo', fontWeight: 700, fontSize: 12.5 }}>
            <option value="">كل العملاء</option>
            {cos.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {shown.map(r => (
          <div key={r.id} style={{ background: '#fff', border: '1.5px solid ' + C.mint, borderRadius: 18, padding: 18, marginBottom: 12, opacity: r.apply_status === 'قُدِّم' ? 0.7 : 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
              <div>
                <div style={{ color: C.ink, fontWeight: 900, fontSize: 15 }}>{r.provider}</div>
                <div style={{ color: C.gray, fontWeight: 700, fontSize: 12.5, marginTop: 2 }}>{r.product}</div>
                <div style={{ color: C.gold, fontWeight: 900, fontSize: 11.5, marginTop: 4 }}>{r.company_name} · {r.track === 'funding' ? 'تمويل' : 'استثمار'} · {r.fit_score}</div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                {STATES.map(s => (
                  <button key={s} disabled={busy === r.id} onClick={() => setStatus(r.id, s)}
                    style={{ background: (r.apply_status || 'لم يُقدَّم') === s ? C.green : '#fff', color: (r.apply_status || 'لم يُقدَّم') === s ? '#fff' : C.gray, border: '1.5px solid ' + C.mint, borderRadius: 20, padding: '5px 11px', fontFamily: 'Cairo', fontWeight: 900, fontSize: 11, cursor: 'pointer' }}>{s}</button>
                ))}
              </div>
            </div>

            <div style={{ background: '#F7FBF9', borderRadius: 12, padding: 12, marginTop: 8 }}>
              <div style={{ color: C.ink, fontWeight: 900, fontSize: 12.5, marginBottom: 4 }}>القناة: {r.apply_channel || 'غير محددة'}</div>
              {r.apply_url && <a href={r.apply_url} target="_blank" rel="noopener noreferrer" style={{ color: C.green, fontWeight: 900, fontSize: 12, textDecoration: 'underline' }}>افتح صفحة التقديم ←</a>}
              {r.apply_steps && <div style={{ color: C.ink, fontWeight: 700, fontSize: 12.5, marginTop: 8, whiteSpace: 'pre-wrap', lineHeight: 1.9 }}>{r.apply_steps}</div>}
              {r.required_docs && <div style={{ color: C.gray, fontWeight: 700, fontSize: 12, marginTop: 8, lineHeight: 1.8 }}>المستندات: {r.required_docs}</div>}
              {r.entity_email && <a href={'/admin/outreach?company_id=' + r.company_id} style={{ display: 'inline-block', marginTop: 10, color: C.gold, fontWeight: 900, fontSize: 12, textDecoration: 'underline' }}>افتح المخاطبة بالبريد ←</a>}
            </div>
          </div>
        ))}
        {shown.length === 0 && <p style={{ color: C.gray, fontWeight: 700, textAlign: 'center', padding: 30 }}>لا توجد جهات بهذا التصنيف.</p>}
      </div>
    </div>
  );
}
