'use client';
import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';

const ADMIN_EMAIL = 'hololalmurdi.fs@gmail.com';

type Lead = {
  id: string; category: string; company_name: string; sector: string; signal: string;
  contact_phone: string | null; contact_email: string | null; contact_social: string | null;
  source: string | null; notes: string | null; status: string;
  lead_kind: string | null; hotness: string | null; entry_angle: string | null; saved: boolean | null;
};

const CAT_META: Record<string, { ar: string; icon: string; color: string }> = {
  funding_reserves: { ar: 'التمويل — مراتع وعملاء كشفوا حاجتهم', icon: '🎯', color: '#2E9E7B' },
  investment_reserves: { ar: 'الاستثمار — مراتع وعملاء كشفوا رغبتهم', icon: '🎯', color: '#3B5BA5' },
  ipo_early_intent: { ar: 'الطرح — رغبة مبكّرة (قابل للتجهيز)', icon: '🌑', color: '#A53B3B' },
};

export default function HuntPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [viewMode, setViewMode] = useState<'today' | 'saved'>('today');
  const [date, setDate] = useState('');
  const [msg, setMsg] = useState('');

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
    await loadLeads();
    setLoading(false);
  }

  async function loadLeads(mode: 'today' | 'saved' = 'today') {
    try {
      const r = await fetch('/api/admin/daily-hunt' + (mode === 'saved' ? '?saved=true' : ''));
      if (r.ok) { const d = await r.json(); setLeads(d.leads || []); setDate(d.date || ''); }
    } catch { /* تجاهل */ }
  }
  function switchView(mode: 'today' | 'saved') { setViewMode(mode); loadLeads(mode); }

  async function toggleSave(id: string, current: boolean) {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, saved: !current } : l));
    try { await fetch('/api/admin/save-lead', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, saved: !current }) }); }
    catch { setLeads(prev => prev.map(l => l.id === id ? { ...l, saved: current } : l)); }
  }

  async function deleteLead(id: string) {
    if (!confirm('حذف هذه الفرصة نهائياً؟')) return;
    setLeads(prev => prev.filter(l => l.id !== id));
    try { await fetch('/api/admin/save-lead?id=' + id, { method: 'DELETE' }); } catch { /* تجاهل */ }
  }

  async function runHunt() {
    if (running) return;
    setRunning(true);
    setMsg('🔍 مرضي يصطاد الفرص الآن… قد يستغرق بضع دقائق. لا تغلق الصفحة.');
    try {
      const r = await fetch('/api/admin/daily-hunt', { method: 'POST' });
      const d = await r.json();
      if (r.ok) { setMsg('✅ اكتملت الجولة: ' + d.total + ' فرصة.'); await loadLeads(); }
      else setMsg('تعذّر إكمال الجولة: ' + (d.error || 'خطأ غير معروف'));
    } catch { setMsg('تعذّر الاتصال. حاول مرة أخرى.'); }
    setRunning(false);
  }

  if (loading) return <div style={{ padding: 40, fontFamily: 'Cairo', textAlign: 'center', color: '#6B8A80' }}>جار التحميل…</div>;
  if (authorized === false) return <div style={{ padding: 40, fontFamily: 'Cairo', textAlign: 'center', color: '#A33' }}>غير مصرّح</div>;

  const cats = Object.keys(CAT_META);
  const byCat = (c: string) => leads.filter((l) => l.category === c);

  return (
    <div dir="rtl" style={{ fontFamily: 'Cairo', maxWidth: 1100, margin: '0 auto', padding: '28px 20px', background: '#FBFCFB', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 8 }}>
        <h1 style={{ color: '#1A3D34', fontSize: 24, fontWeight: 900, margin: 0 }}>🎯 صيد الفرص اليومي</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', background: '#EEF3F1', borderRadius: 999, padding: 3 }}>
            <button onClick={() => switchView('today')} style={{ background: viewMode === 'today' ? '#1A3D34' : 'transparent', color: viewMode === 'today' ? '#fff' : '#6B8A80', border: 'none', padding: '8px 18px', borderRadius: 999, fontFamily: 'Cairo', fontWeight: 900, fontSize: 13, cursor: 'pointer' }}>فرص اليوم</button>
            <button onClick={() => switchView('saved')} style={{ background: viewMode === 'saved' ? '#C9A84C' : 'transparent', color: viewMode === 'saved' ? '#fff' : '#6B8A80', border: 'none', padding: '8px 18px', borderRadius: 999, fontFamily: 'Cairo', fontWeight: 900, fontSize: 13, cursor: 'pointer' }}>📌 المحفوظة</button>
          </div>
          <button onClick={runHunt} disabled={running}
            style={{ background: running ? '#9DB3AB' : '#1A3D34', color: '#fff', border: 'none', padding: '12px 28px', borderRadius: 999, fontFamily: 'Cairo', fontWeight: 900, fontSize: 14, cursor: running ? 'default' : 'pointer' }}>
            {running ? 'جارٍ الصيد…' : '🔍 شغّل جولة اليوم'}
          </button>
        </div>
      </div>
      <p style={{ color: '#6B8A80', fontSize: 13, marginTop: 0, marginBottom: 6 }}>مُرضي يبحث في السوق السعودي عن شركات تمثّل فرص تمويل واستثمار وطرح — مع بيانات التواصل.</p>
      {date && <p style={{ color: '#9DB3AB', fontSize: 12, marginTop: 0 }}>جولة تاريخ: {date} &nbsp;·&nbsp; الإجمالي: {leads.length} فرصة</p>}
      {msg && <div style={{ background: '#F0F7F4', border: '1px solid #D8E8E0', borderRadius: 10, padding: '12px 16px', color: '#1A3D34', fontSize: 13.5, fontWeight: 700, margin: '12px 0' }}>{msg}</div>}

      {leads.length === 0 && !running && (
        <div style={{ textAlign: 'center', color: '#9DB3AB', padding: '60px 0', fontSize: 14 }}>لا توجد فرص لهذا اليوم بعد. اضغط «شغّل جولة اليوم» ليبدأ مُرضي الصيد.</div>
      )}

      {cats.map((c) => {
        const list = byCat(c);
        if (list.length === 0) return null;
        const meta = CAT_META[c];
        return (
          <div key={c} style={{ marginTop: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ color: meta.color, fontSize: 16, fontWeight: 900 }}>{meta.icon} {meta.ar}</span>
              <span style={{ background: meta.color, color: '#fff', borderRadius: 999, padding: '2px 11px', fontSize: 12, fontWeight: 900 }}>{list.length}</span>
            </div>
            <div style={{ display: 'grid', gap: 12 }}>
              {list.map((l) => {
                const isScout = l.lead_kind === 'scout';
                const hot = l.hotness || '';
                const hotColor = hot.includes('ساخ') ? '#C0564B' : hot.includes('داف') ? '#C9A84C' : '#9DB3AB';
                return (
                <div key={l.id} style={{ background: isScout ? '#FFFBF2' : '#fff', border: isScout ? '1.5px solid #E8DBB8' : '1.5px solid #EAF2EE', borderRadius: 12, padding: '16px 18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <div style={{ color: '#1A3D34', fontSize: 16, fontWeight: 900 }}>{l.company_name}</div>
                      {isScout && <span style={{ background: '#C9A84C', color: '#fff', borderRadius: 6, padding: '2px 9px', fontSize: 11, fontWeight: 900 }}>🏞️ مرتع — صيد يدوي</span>}
                      {hot && <span style={{ background: hotColor, color: '#fff', borderRadius: 6, padding: '2px 9px', fontSize: 11, fontWeight: 900 }}>{hot.includes('ساخ') ? '🔥' : ''} {hot}</span>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {l.sector && <div style={{ color: '#6B8A80', fontSize: 12.5, fontWeight: 700 }}>{l.sector}</div>}
                      <button onClick={() => toggleSave(l.id, l.saved === true)} title={l.saved ? 'محفوظة — اضغط للإلغاء' : 'احفظ هذه الفرصة'}
                        style={{ background: l.saved ? '#C9A84C' : '#F0F4F2', color: l.saved ? '#fff' : '#6B8A80', border: 'none', borderRadius: 8, padding: '5px 10px', fontSize: 13, cursor: 'pointer', fontWeight: 900 }}>
                        {l.saved ? '📌 محفوظة' : '📌 حفظ'}
                      </button>
                      <button onClick={() => deleteLead(l.id)} title="حذف نهائي"
                        style={{ background: '#FBEEEC', color: '#C0564B', border: 'none', borderRadius: 8, padding: '5px 9px', fontSize: 13, cursor: 'pointer', fontWeight: 900 }}>🗑️</button>
                    </div>
                  </div>
                  {l.signal && <div style={{ color: '#3A4D47', fontSize: 13.5, fontWeight: 700, margin: '8px 0', lineHeight: 1.8 }}>📌 {l.signal}</div>}
                  {l.notes && <div style={{ color: '#6B8A80', fontSize: 12.5, lineHeight: 1.8, marginBottom: 8 }}>{l.notes}</div>}
                  {l.entry_angle && <div style={{ background: '#F0F7F4', borderRight: '3px solid #2E9E7B', color: '#1A3D34', fontSize: 12.5, lineHeight: 1.8, padding: '8px 12px', borderRadius: 6, marginBottom: 8 }}>💬 زاوية الدخول: {l.entry_angle}</div>}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 8 }}>
                    {l.contact_phone && <a href={'tel:' + l.contact_phone} style={{ background: '#F0F7F4', color: '#1E7A5A', borderRadius: 8, padding: '6px 12px', fontSize: 12.5, fontWeight: 700, textDecoration: 'none' }}>📞 {l.contact_phone}</a>}
                    {l.contact_email && <a href={'mailto:' + l.contact_email} style={{ background: '#F0F7F4', color: '#1E7A5A', borderRadius: 8, padding: '6px 12px', fontSize: 12.5, fontWeight: 700, textDecoration: 'none' }}>✉️ {l.contact_email}</a>}
                    {l.contact_social && <a href={l.contact_social.startsWith('http') ? l.contact_social : '#'} target="_blank" rel="noopener noreferrer" style={{ background: '#EAF0FB', color: '#3B5BA5', borderRadius: 8, padding: '6px 12px', fontSize: 12.5, fontWeight: 700, textDecoration: 'none' }}>🔗 {l.contact_social}</a>}
                    {l.source && <a href={l.source} target="_blank" rel="noopener noreferrer" style={{ color: '#9DB3AB', fontSize: 12, padding: '6px 0', textDecoration: 'none' }}>↗️ المصدر</a>}
                  </div>
                  {!l.contact_phone && !l.contact_email && !l.contact_social && !isScout && <div style={{ color: '#C0564B', fontSize: 12, marginTop: 6 }}>⚠️ بلا بيانات تواصل — يحتاج بحثاً يدوياً</div>}
                </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
