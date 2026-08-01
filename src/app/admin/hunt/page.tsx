'use client';
import AdminNav from '@/components/AdminNav';
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
  investment_reserves: { ar: 'الاستثمار — مراتع وعملاء كشفوا رغبتهم', icon: '🎯', color: '#9A7B2E' },
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

  function printLeads() {
    const esc = (t: unknown) => String(t || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const today = new Date().toLocaleDateString('ar-SA', { year:'numeric', month:'long', day:'numeric' });
    let body = '';
    for (const c of cats) {
      const list = byCat(c);
      if (list.length === 0) continue;
      const meta = CAT_META[c];
      body += '<div class=cat>' + esc(meta.icon + ' ' + meta.ar) + ' (' + list.length + ')</div>';
      for (const l of list) {
        const contacts = [];
        if (l.contact_phone) contacts.push('\u260E ' + esc(l.contact_phone));
        if (l.contact_email) contacts.push('\u2709 ' + esc(l.contact_email));
        if (l.contact_social) contacts.push('\uD83D\uDD17 ' + esc(l.contact_social));
        const noContact = !l.contact_phone && !l.contact_email && !l.contact_social;
        body += '<div class=card>'
          + '<div class=name>' + esc(l.company_name) + (l.sector ? ' <span class=sec>' + esc(l.sector) + '</span>' : '') + (l.hotness ? ' <span class=hot>' + esc(l.hotness) + '</span>' : '') + '</div>'
          + (l.signal ? '<div class=sig>\uD83D\uDCCC ' + esc(l.signal) + '</div>' : '')
          + (l.entry_angle ? '<div class=angle>\uD83D\uDCAC \u0632\u0627\u0648\u064A\u0629 \u0627\u0644\u062F\u062E\u0648\u0644: ' + esc(l.entry_angle) + '</div>' : '')
          + (contacts.length ? '<div class=contacts>' + contacts.join(' \u00B7 ') + '</div>' : '')
          + (noContact ? '<div class=nocontact>\u26A0 \u0628\u0644\u0627 \u0628\u064A\u0627\u0646\u0627\u062A \u062A\u0648\u0627\u0635\u0644 \u2014 \u064A\u062D\u062A\u0627\u062C \u0628\u062D\u062B\u0627\u064B</div>' : '')
          + '</div>';
      }
    }
    const html = '<!DOCTYPE html><html dir=rtl lang=ar><head><meta charset=utf-8><title>\u0635\u064A\u062F \u0627\u0644\u0641\u0631\u0635</title>'
      + '<style>'
      + '@import url("https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap");'
      + '*{margin:0;padding:0;box-sizing:border-box;font-family:Cairo,Arial,sans-serif}'
      + 'body{padding:32px;color:#1A3D34}'
      + '.head{text-align:center;border-bottom:3px solid #C9A84C;padding-bottom:16px;margin-bottom:20px}'
      + '.head h1{font-size:24px;color:#1A3D34}.head .sub{color:#6B8A80;font-size:13px;margin-top:6px}'
      + '.cat{font-size:17px;font-weight:900;color:#1A3D34;margin:22px 0 10px;padding-right:10px;border-right:5px solid #2E9E7B}'
      + '.card{border:1.5px solid #EAF2EE;border-radius:10px;padding:12px 14px;margin-bottom:10px}'
      + '.name{font-size:15px;font-weight:900;color:#1A3D34}'
      + '.sec{font-size:12px;color:#6B8A80;font-weight:700}.hot{font-size:11px;background:#C9A84C;color:#fff;padding:2px 8px;border-radius:6px}'
      + '.sig{font-size:13px;color:#3A4D47;margin-top:6px;line-height:1.7}'
      + '.angle{font-size:12.5px;background:#F0F7F4;border-right:3px solid #2E9E7B;padding:6px 10px;border-radius:5px;margin-top:6px;line-height:1.7}'
      + '.contacts{font-size:13px;color:#1E7A5A;font-weight:700;margin-top:8px}'
      + '.nocontact{font-size:12px;color:#C0564B;margin-top:6px}'
      + '.footer{margin-top:26px;padding-top:14px;border-top:2px solid #EEE;text-align:center;color:#9DB3AB;font-size:12px}'
      + '@media print{body{padding:16px}}'
      + '</style></head><body>'
      + '<div class=head><h1>\uD83C\uDFAF \u0635\u064A\u062F \u0627\u0644\u0641\u0631\u0635</h1><div class=sub>\u062D\u0644\u0648\u0644 \u0627\u0644\u0645\u0631\u0636\u064A \u0644\u0644\u0627\u0633\u062A\u0634\u0627\u0631\u0627\u062A \u0627\u0644\u0645\u0627\u0644\u064A\u0629 \u00B7 ' + today + '</div></div>'
      + body
      + '<div class=footer>\u0644\u0644\u0627\u0633\u062A\u062E\u062F\u0627\u0645 \u0627\u0644\u062F\u0627\u062E\u0644\u064A \u2014 \u0641\u0631\u064A\u0642 \u0645\u064F\u0631\u0636\u064A</div>'
      + '</body></html>';
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); }
  }

  if (loading) return <div style={{ padding: 40, fontFamily: 'Cairo', textAlign: 'center', color: '#6B8A80' }}>جار التحميل…</div>;
  if (authorized === false) return <div style={{ padding: 40, fontFamily: 'Cairo', textAlign: 'center', color: '#A33' }}>غير مصرّح</div>;

  const cats = Object.keys(CAT_META);
  const byCat = (c: string) => leads.filter((l) => l.category === c);

  return (
    <div dir="rtl" style={{ fontFamily: 'Cairo', maxWidth: 1100, margin: '0 auto', padding: '28px 20px', background: '#FBFCFB', minHeight: '100vh' }}>
      <AdminNav />
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
          <button onClick={printLeads} disabled={leads.length === 0}
            style={{ background: leads.length === 0 ? '#9DB3AB' : '#2E9E7B', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: 999, fontFamily: 'Cairo', fontWeight: 900, fontSize: 14, cursor: leads.length === 0 ? 'default' : 'pointer' }}>
            🖨️ طباعة PDF للموظفات
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
                    {l.contact_social && <a href={l.contact_social.startsWith('http') ? l.contact_social : '#'} target="_blank" rel="noopener noreferrer" style={{ background: '#EAF7F0', color: '#9A7B2E', borderRadius: 8, padding: '6px 12px', fontSize: 12.5, fontWeight: 700, textDecoration: 'none' }}>🔗 {l.contact_social}</a>}
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
