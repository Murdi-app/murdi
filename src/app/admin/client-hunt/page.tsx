'use client';
import AdminNav from '@/components/AdminNav';
import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';

const ADMIN_EMAIL = 'hololalmurdi.fs@gmail.com';

type CLead = {
  id: string; hunt_date: string; company_name: string; sector: string | null; city: string | null;
  signal: string | null; email: string | null; phone: string | null; source: string | null;
  message: string | null; status: string; email_sent_at: string | null; call_script: string | null;
};

export default function ClientHuntPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [leads, setLeads] = useState<CLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState('');
  const [q, setQ] = useState('');
  const [copied, setCopied] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggleSelect(id: string) {
    setSelected(prev => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  }

  async function sendSelected() {
    if (selected.size === 0) return;
    if (!confirm('إرسال إيميل لـ ' + selected.size + ' شركة محددة؟ (ضمن حد ٣٥ اليومي)')) return;
    setSending(true); setMsg('جاري الإرسال للمحدد…');
    try {
      const r = await fetch('/api/admin/client-hunt', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: Array.from(selected) }) });
      const d = await r.json();
      if (r.ok) {
        let t = '✅ أُرسل: ' + (d.sent || 0);
        if (d.failed) t += ' · فشل: ' + d.failed;
        if (d.note) t += ' · ' + d.note;
        setMsg(t);
      } else setMsg('❌ ' + (d.error || 'فشل الإرسال'));
      setSelected(new Set());
      await load();
    } catch { setMsg('❌ خطأ في الاتصال'); }
    setSending(false);
  }

  async function excludeSelected() {
    if (selected.size === 0) return;
    if (!confirm('استبعاد ' + selected.size + ' شركة من قوائم الإرسال؟ (مناسب لمن ستراسلهم واتساب أو لا تريد مراسلتهم)')) return;
    try {
      const r = await fetch('/api/admin/client-hunt', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: Array.from(selected) }) });
      const d = await r.json();
      setMsg(r.ok ? '✅ استُبعد: ' + (d.excluded || 0) : '❌ ' + (d.error || 'فشل الاستبعاد'));
      setSelected(new Set());
      await load();
    } catch { setMsg('❌ خطأ في الاتصال'); }
  }

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
      const r = await fetch('/api/admin/client-hunt');
      if (r.ok) { const d = await r.json(); setLeads(d.leads || []); }
    } catch { /* تجاهل */ }
  }

  const [view, setView] = useState<'all' | 'call_list'>('all');

  async function runCallHunt() {
    setRunning(true); setMsg('جولة قائمة الاتصال انطلقت… قد تستغرق حتى ٥ دقائق، لا تغلق الصفحة.');
    try {
      const r = await fetch('/api/admin/client-hunt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'call_list' }) });
      const d = await r.json();
      setMsg(r.ok ? '✅ اكتملت الجولة: ' + (d.total || 0) + ' منشأة بجوال وسكربت' : '❌ ' + (d.error || 'فشل الصيد'));
      await load();
      setView('call_list');
    } catch { setMsg('❌ خطأ في الاتصال'); }
    setRunning(false);
  }

  function copyForEmployee(items: CLead[]) {
    const chunk = items.slice(0, 25);
    const text = chunk.map((l, i) =>
      (i + 1) + ') ' + l.company_name + (l.city ? ' — ' + l.city : '') + (l.sector ? ' (' + l.sector + ')' : '')
      + '\n📱 ' + (l.phone || '')
      + (l.signal ? '\nℹ️ ' + l.signal : '')
      + (l.call_script ? '\n📞 السكربت:\n' + l.call_script : '')
    ).join('\n\n──────────\n\n');
    navigator.clipboard.writeText('📋 قائمة اتصال مُرضي — ' + new Date().toLocaleDateString('ar-SA') + ' (' + chunk.length + ' منشأة)\n\n' + text);
    setMsg('✅ نُسخت قائمة ' + chunk.length + ' منشأة — الصقها في واتساب الموظفة، ثم علّميها كموزّعة');
  }

  async function markDistributed(items: CLead[]) {
    const ids = items.slice(0, 25).map((l) => l.id);
    if (ids.length === 0) return;
    if (!confirm('تعليم ' + ids.length + ' منشأة كموزَّعة على موظفة؟ (تختفي من القائمة المتاحة)')) return;
    try {
      await fetch('/api/admin/client-hunt', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids, newStatus: 'distributed' }) });
      setMsg('✅ وُزّعت ' + ids.length + ' منشأة');
      await load();
    } catch { setMsg('❌ خطأ'); }
  }

  async function runHunt() {
    setRunning(true); setMsg('جولة الصيد انطلقت… قد تستغرق حتى ٥ دقائق، لا تغلق الصفحة.');
    try {
      const r = await fetch('/api/admin/client-hunt', { method: 'POST' });
      const d = await r.json();
      setMsg(r.ok ? '✅ اكتملت الجولة: ' + (d.total || 0) + ' شركة جديدة' : '❌ ' + (d.error || 'فشل الصيد'));
      await load();
    } catch { setMsg('❌ خطأ في الاتصال'); }
    setRunning(false);
  }

  async function sendBatch() {
    if (!confirm('إرسال دفعة الإيميل اليومية (حتى ٣٥ شركة)؟')) return;
    setSending(true); setMsg('جاري الإرسال…');
    try {
      const r = await fetch('/api/admin/client-hunt', { method: 'PATCH' });
      const d = await r.json();
      if (r.ok) {
        let t = '✅ أُرسل: ' + (d.sent || 0);
        if (d.failed) t += ' · فشل: ' + d.failed;
        if (d.note) t += ' · ' + d.note;
        setMsg(t);
      } else setMsg('❌ ' + (d.error || 'فشل الإرسال'));
      await load();
    } catch { setMsg('❌ خطأ في الاتصال'); }
    setSending(false);
  }

  function waLink(l: CLead): string {
    const p = (l.phone || '').replace(/[^0-9]/g, '');
    const intl = p.startsWith('966') ? p : p.startsWith('05') ? '966' + p.slice(1) : p.startsWith('5') ? '966' + p : p;
    return 'https://wa.me/' + intl + '?text=' + encodeURIComponent(l.message || '');
  }

  async function markWhatsapped(id: string) {
    setLeads(prev => prev.map(x => x.id === id ? { ...x, status: 'whatsapped' } : x));
    try { await fetch('/api/admin/client-hunt', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }); } catch { /* تجاهل */ }
  }

  function copyMsg(l: CLead) {
    navigator.clipboard.writeText(l.message || '');
    setCopied(l.id);
    setTimeout(() => setCopied(''), 1500);
  }

  const filtered = leads.filter((l) => view === 'all' ? l.status !== 'call_list' && l.status !== 'distributed' : (l.status === 'call_list' || l.status === 'distributed')).filter((l) =>
    !q || l.company_name.includes(q) || (l.sector || '').includes(q) || (l.city || '').includes(q) || (l.status || '').includes(q)
  );
  const stats = {
    total: leads.length,
    withEmail: leads.filter((l) => l.email).length,
    withPhone: leads.filter((l) => l.phone).length,
    emailed: leads.filter((l) => l.status === 'emailed').length,
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>جاري التحميل…</div>;
  if (authorized === false) return <div style={{ padding: 40, textAlign: 'center' }}>غير مصرح</div>;

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: '#f7f7f4', paddingBottom: 60 }}>
      <AdminNav />
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px' }}>
        <h1 style={{ color: '#13302A', fontSize: 26, marginBottom: 6 }}>🎯 صيد العملاء</h1>
        <p style={{ color: '#666', fontSize: 14, marginBottom: 18 }}>شركات سعودية مرشحة للاشتراك في مُرضي — برسائل جاهزة للإرسال</p>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
          <button onClick={runHunt} disabled={running} style={{ background: '#13302A', color: '#fff', border: 'none', borderRadius: 10, padding: '11px 22px', fontWeight: 700, cursor: 'pointer', opacity: running ? 0.6 : 1 }}>
            {running ? '⏳ جاري الصيد…' : '🔍 جولة صيد جديدة'}
          </button>
          <button onClick={runCallHunt} disabled={running} style={{ background: '#5B3A8E', color: '#fff', border: 'none', borderRadius: 10, padding: '11px 22px', fontWeight: 700, cursor: 'pointer', opacity: running ? 0.6 : 1 }}>
            {running ? '⏳ جاري الصيد…' : '📞 جولة قائمة الاتصال (للموظفات)'}
          </button>
          <button onClick={sendBatch} disabled={sending} style={{ background: '#C9A24B', color: '#13302A', border: 'none', borderRadius: 10, padding: '11px 22px', fontWeight: 800, cursor: 'pointer', opacity: sending ? 0.6 : 1 }}>
            {sending ? '⏳ جاري الإرسال…' : '✉️ إرسال دفعة الإيميل اليومية'}
          </button>
        </div>

        {selected.size > 0 && (
          <div style={{ position: 'sticky', top: 8, zIndex: 5, background: '#13302A', borderRadius: 12, padding: '11px 16px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', boxShadow: '0 3px 10px rgba(0,0,0,0.18)' }}>
            <span style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>محدد: {selected.size}</span>
            <button onClick={sendSelected} disabled={sending} style={{ background: '#C9A24B', color: '#13302A', border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 800, fontSize: 13.5, cursor: 'pointer' }}>✉️ إرسال إيميل للمحدد</button>
            <button onClick={excludeSelected} style={{ background: '#A53B3B', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 700, fontSize: 13.5, cursor: 'pointer' }}>🚫 استبعاد</button>
            <button onClick={() => setSelected(new Set())} style={{ background: 'transparent', color: '#cfd6e4', border: '1px solid #3d5449', borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer' }}>إلغاء التحديد</button>
          </div>
        )}

        {msg && <div style={{ background: '#fff', border: '1px solid #e2e0d8', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 14, color: '#13302A' }}>{msg}</div>}

        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 14, fontSize: 13.5, color: '#444' }}>
          <span>الإجمالي: <strong>{stats.total}</strong></span>
          <span>بإيميل: <strong>{stats.withEmail}</strong></span>
          <span>بجوال: <strong>{stats.withPhone}</strong></span>
          <span>رُوسلوا إيميل: <strong style={{ color: '#2E9E7B' }}>{stats.emailed}</strong></span>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button onClick={() => setView('all')} style={{ background: view === 'all' ? '#13302A' : '#e8e6df', color: view === 'all' ? '#fff' : '#555', border: 'none', borderRadius: 99, padding: '8px 18px', fontWeight: 700, fontSize: 13.5, cursor: 'pointer' }}>الكل</button>
          <button onClick={() => setView('call_list')} style={{ background: view === 'call_list' ? '#5B3A8E' : '#e8e6df', color: view === 'call_list' ? '#fff' : '#555', border: 'none', borderRadius: 99, padding: '8px 18px', fontWeight: 700, fontSize: 13.5, cursor: 'pointer' }}>📞 قائمة الاتصال</button>
        </div>

        {view === 'call_list' && (() => {
          const avail = leads.filter((l) => l.status === 'call_list');
          return avail.length > 0 ? (
            <div style={{ background: '#5B3A8E', borderRadius: 12, padding: '12px 16px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>متاح للتوزيع: {avail.length}</span>
              <button onClick={() => copyForEmployee(avail)} style={{ background: '#C9A24B', color: '#13302A', border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 800, fontSize: 13.5, cursor: 'pointer' }}>📋 نسخ قائمة موظفة (٢٥)</button>
              <button onClick={() => markDistributed(avail)} style={{ background: 'transparent', color: '#e8dff5', border: '1px solid #7c5bb0', borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer' }}>✓ تعليمها كموزَّعة</button>
            </div>
          ) : <div style={{ textAlign: 'center', color: '#999', padding: 20, marginBottom: 10 }}>لا توجد منشآت متاحة — شغّل جولة قائمة الاتصال</div>;
        })()}

        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث: اسم، قطاع، مدينة، حالة…"
          style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: '1px solid #ddd', marginBottom: 18, fontSize: 14 }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map((l) => (
            <div key={l.id} style={{ background: '#fff', borderRadius: 12, padding: '16px 18px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 6 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  {l.status === 'new' && <input type="checkbox" checked={selected.has(l.id)} onChange={() => toggleSelect(l.id)} style={{ width: 18, height: 18, accentColor: '#13302A', cursor: 'pointer' }} />}
                  <strong style={{ color: '#13302A', fontSize: 16 }}>{l.company_name}</strong>
                </label>
                <span style={{ fontSize: 12.5, color: l.status === 'emailed' || l.status === 'whatsapped' ? '#2E9E7B' : '#999', fontWeight: 700 }}>
                  {l.status === 'emailed' ? '✓ أُرسل إيميل' : l.status === 'whatsapped' ? '✓ أُرسل واتساب' : l.status === 'excluded' ? '🚫 مستبعدة' : 'جديدة'} · {l.hunt_date}
                </span>
              </div>
              <div style={{ fontSize: 13.5, color: '#666', marginBottom: 8 }}>
                {[l.sector, l.city].filter(Boolean).join(' · ')}
                {l.email ? ' · ✉️ ' + l.email : ''}
                {l.phone ? ' · 📱 ' + l.phone : ''}
              </div>
              {l.signal && <p style={{ fontSize: 13.5, color: '#444', lineHeight: 1.8, marginBottom: 8 }}>{l.signal}</p>}
              {l.call_script && (
                <div style={{ background: '#f3eefb', border: '1px solid #d9cbf0', borderRadius: 10, padding: '10px 14px', fontSize: 13.5, color: '#3a2960', lineHeight: 1.9, marginBottom: 10, whiteSpace: 'pre-wrap' }}><strong>📞 سكربت المكالمة:</strong>{'\n'}{l.call_script}</div>
              )}
              {l.message && (
                <div style={{ background: '#f7f7f4', borderRadius: 10, padding: '10px 14px', fontSize: 13.5, color: '#333', lineHeight: 1.9, marginBottom: 10, whiteSpace: 'pre-wrap' }}>{l.message}</div>
              )}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {l.phone && <a href={waLink(l)} onClick={() => markWhatsapped(l.id)} target="_blank" rel="noopener noreferrer" style={{ background: '#25D366', color: '#fff', borderRadius: 8, padding: '7px 16px', fontSize: 13.5, fontWeight: 700, textDecoration: 'none' }}>واتساب 📲</a>}
                <button onClick={() => copyMsg(l)} style={{ background: '#13302A', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 16px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>
                  {copied === l.id ? '✓ نُسخت' : 'نسخ الرسالة 📋'}
                </button>
                {l.source && <a href={l.source} target="_blank" rel="noopener noreferrer" style={{ background: '#eee', color: '#444', borderRadius: 8, padding: '7px 16px', fontSize: 13.5, textDecoration: 'none' }}>المصدر 🔗</a>}
              </div>
            </div>
          ))}
          {filtered.length === 0 && <div style={{ textAlign: 'center', color: '#999', padding: 40 }}>لا توجد شركات بعد — شغّل جولة صيد جديدة</div>}
        </div>
      </div>
    </div>
  );
}
