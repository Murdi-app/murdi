'use client';
import AdminNav from '@/components/AdminNav';
import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';

const ADMIN_EMAIL = 'hololalmurdi.fs@gmail.com';

type CLead = {
  id: string; hunt_date: string; company_name: string; sector: string | null; city: string | null;
  signal: string | null; email: string | null; phone: string | null; source: string | null;
  message: string | null; status: string; email_sent_at: string | null;
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

  const filtered = leads.filter((l) =>
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
          <button onClick={sendBatch} disabled={sending} style={{ background: '#C9A24B', color: '#13302A', border: 'none', borderRadius: 10, padding: '11px 22px', fontWeight: 800, cursor: 'pointer', opacity: sending ? 0.6 : 1 }}>
            {sending ? '⏳ جاري الإرسال…' : '✉️ إرسال دفعة الإيميل اليومية'}
          </button>
        </div>

        {msg && <div style={{ background: '#fff', border: '1px solid #e2e0d8', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 14, color: '#13302A' }}>{msg}</div>}

        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 14, fontSize: 13.5, color: '#444' }}>
          <span>الإجمالي: <strong>{stats.total}</strong></span>
          <span>بإيميل: <strong>{stats.withEmail}</strong></span>
          <span>بجوال: <strong>{stats.withPhone}</strong></span>
          <span>رُوسلوا إيميل: <strong style={{ color: '#2E9E7B' }}>{stats.emailed}</strong></span>
        </div>

        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث: اسم، قطاع، مدينة، حالة…"
          style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: '1px solid #ddd', marginBottom: 18, fontSize: 14 }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map((l) => (
            <div key={l.id} style={{ background: '#fff', borderRadius: 12, padding: '16px 18px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 6 }}>
                <strong style={{ color: '#13302A', fontSize: 16 }}>{l.company_name}</strong>
                <span style={{ fontSize: 12.5, color: l.status === 'emailed' || l.status === 'whatsapped' ? '#2E9E7B' : '#999', fontWeight: 700 }}>
                  {l.status === 'emailed' ? '✓ أُرسل إيميل' : l.status === 'whatsapped' ? '✓ أُرسل واتساب' : 'جديدة'} · {l.hunt_date}
                </span>
              </div>
              <div style={{ fontSize: 13.5, color: '#666', marginBottom: 8 }}>
                {[l.sector, l.city].filter(Boolean).join(' · ')}
                {l.email ? ' · ✉️ ' + l.email : ''}
                {l.phone ? ' · 📱 ' + l.phone : ''}
              </div>
              {l.signal && <p style={{ fontSize: 13.5, color: '#444', lineHeight: 1.8, marginBottom: 8 }}>{l.signal}</p>}
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
