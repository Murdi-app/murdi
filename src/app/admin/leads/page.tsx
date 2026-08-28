'use client';
import { useEffect, useMemo, useState } from 'react';
import AdminNav from '@/components/AdminNav';
import { BAND_LABEL, type Band, type Temp } from '@/lib/leadDesk';

// كانت هذه الصفحة قائمة قراءة فقط: أسماء ودرجات مرتّبة بالأحدث، بلا زر واحد.
// ولهذا كان عمود contacted صفراً في كل الصفوف منذ يونيو — لم يكن في المنصة مكان يضبطه.
// الآن: صفٌّ مرتَّب بالتأهّل، وأول جملة مكتوبة لكل اسم، ونتيجة تُسجَّل بنقرة.

type Lead = {
  id: string; created_at: string; full_name: string | null; phone: string | null;
  track: string | null; score: number | null; completed: boolean | null; contacted: boolean | null;
  days: number; band: Band; temp: Temp; registered: boolean;
  headline: string; opener: string; waLink: string;
  contacted_at: string | null; outcome: string | null; contact_note: string | null; next_action_at: string | null;
};
type Stats = { total: number; contacted: number; registered: number; open: number; ready: number; gap: number; weak: number; unknown: number; today: number };

const OUTCOMES = ['مهتم', 'طلب معاودة', 'لا يرد', 'غير مؤهل الآن', 'تحوّل عميلاً', 'رفض'];

const BAND_TONE: Record<Band, { bg: string; fg: string; br: string }> = {
  ready:   { bg: '#EAF7F0', fg: '#1E7A5E', br: '#BFE6D6' },
  gap:     { bg: '#FBF5E8', fg: '#9A7B2E', br: '#EADFC0' },
  weak:    { bg: '#FDF1E8', fg: '#B4622A', br: '#F0D8C6' },
  unknown: { bg: '#F4F6F5', fg: '#6B8A80', br: '#E3EAE7' },
};

const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [filter, setFilter] = useState<'open' | 'ready' | 'done' | 'all'>('open');
  const [openId, setOpenId] = useState('');
  const [busy, setBusy] = useState('');
  const [copied, setCopied] = useState('');

  const load = async () => {
    const r = await fetch('/api/admin/leads');
    const d = await r.json();
    if (!r.ok) { setErr(d.error || 'تعذّر التحميل'); setLoading(false); return; }
    setLeads(d.leads || []); setStats(d.stats || null); setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const save = async (id: string, patch: Record<string, unknown>) => {
    setBusy(id);
    const r = await fetch('/api/admin/leads', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...patch }),
    });
    setBusy('');
    if (!r.ok) { const d = await r.json().catch(() => ({})); setErr(d.error || 'تعذّر الحفظ'); return; }
    // تحديث محلي فوري: البطاقة لا تقفز من تحت يده قبل أن يقرأ ما سجّله
    setLeads(prev => prev.map(l => l.id === id
      ? { ...l, ...(patch as Partial<Lead>), contacted: patch.contacted !== undefined ? Boolean(patch.contacted) : (patch.outcome ? true : l.contacted) }
      : l));
  };

  const shown = useMemo(() => leads.filter(l => {
    if (filter === 'all') return true;
    if (filter === 'done') return Boolean(l.contacted);
    if (filter === 'ready') return !l.contacted && !l.registered && l.band === 'ready';
    return !l.contacted && !l.registered;
  }), [leads, filter]);

  const copyOpener = async (l: Lead) => {
    try { await navigator.clipboard.writeText(l.opener); setCopied(l.id); setTimeout(() => setCopied(''), 1800); } catch { /* المتصفح منع النسخ */ }
  };

  const countOpen = leads.filter(l => !l.contacted && !l.registered).length;
  const countReady = leads.filter(l => !l.contacted && !l.registered && l.band === 'ready').length;
  const countDone = leads.filter(l => Boolean(l.contacted)).length;

  const Chip = ({ k, label, n }: { k: 'open' | 'ready' | 'done' | 'all'; label: string; n: number }) => (
    <div onClick={() => setFilter(k)} style={{
      padding: '7px 15px', borderRadius: 30, cursor: 'pointer', fontSize: 12.5, fontWeight: filter === k ? 900 : 700,
      background: filter === k ? '#1A3D34' : '#fff', color: filter === k ? '#fff' : '#6B8A80',
      border: '1.5px solid ' + (filter === k ? '#1A3D34' : '#E8F5EF'),
    }}>{label} <span style={{ opacity: .75 }}>{n}</span></div>
  );

  return (
    <div dir="rtl" style={{ fontFamily: 'Cairo,sans-serif', maxWidth: 940, margin: '0 auto', padding: '28px 20px', background: '#FBFCFB', minHeight: '100vh' }}>
      <AdminNav />
      <h1 style={{ color: '#1A3D34', fontSize: 24, fontWeight: 900, margin: 0 }}>📋 مكتب المتابعة</h1>
      <p style={{ color: '#6B8A80', fontSize: 13, marginTop: 6, marginBottom: 16, lineHeight: 1.9 }}>
        من دخل التقييم السريع في الواجهة. الترتيب بالتأهّل أولاً لا بالتاريخ: المؤهَّل يُغلق أسرع ويموّل بقية القائمة.
      </p>

      {stats && (
        <div style={{ background: '#fff', border: '1.5px solid #EAF2EE', borderRadius: 14, padding: '14px 18px', marginBottom: 16, display: 'flex', gap: 22, flexWrap: 'wrap' }}>
          <Num n={stats.open} t="لم يُتواصل معهم" big />
          <Num n={stats.ready} t="مؤهَّل — اتصل أولاً" tone="#1E7A5E" big />
          <Num n={stats.gap} t="فجوة محددة" tone="#9A7B2E" />
          <Num n={stats.weak} t="يحتاج رفع جاهزية" tone="#B4622A" />
          <Num n={stats.unknown} t="لم يُكمل التقييم" />
          <Num n={stats.contacted} t="تم التواصل" tone="#2E9E7B" />
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
        <Chip k="open" label="الصف" n={countOpen} />
        <Chip k="ready" label="المؤهَّلون" n={countReady} />
        <Chip k="done" label="تم التواصل" n={countDone} />
        <Chip k="all" label="الكل" n={leads.length} />
      </div>

      {err && <div style={{ background: '#FDF1F1', border: '1.5px solid #F2D4D4', color: '#B4342A', borderRadius: 12, padding: '12px 16px', marginBottom: 14, fontSize: 13, fontWeight: 700 }}>{err}</div>}

      {loading ? <div style={{ color: '#9DB3AB', textAlign: 'center', padding: 40 }}>جارٍ التحميل…</div>
        : shown.length === 0 ? <div style={{ color: '#9DB3AB', textAlign: 'center', padding: 34, background: '#fff', borderRadius: 12, border: '1px solid #EAF2EE' }}>لا أحد في هذا الصف.</div>
        : shown.map((l) => {
          const tone = BAND_TONE[l.band];
          const isOpen = openId === l.id;
          return (
            <div key={l.id} style={{ background: '#fff', border: '1.5px solid ' + (isOpen ? tone.br : '#EAF2EE'), borderRadius: 14, padding: '16px 18px', marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 320px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ color: '#1A3D34', fontSize: 16.5, fontWeight: 900 }}>{l.full_name || 'بلا اسم'}</span>
                    <span style={{ background: tone.bg, color: tone.fg, border: '1px solid ' + tone.br, borderRadius: 20, padding: '3px 11px', fontSize: 11.5, fontWeight: 900 }}>{BAND_LABEL[l.band]}</span>
                    {l.registered && <span style={{ background: '#EEF3FF', color: '#3A5AA8', border: '1px solid #D6E0F7', borderRadius: 20, padding: '3px 11px', fontSize: 11.5, fontWeight: 900 }}>مسجَّل في المنصة</span>}
                    {l.contacted && <span style={{ background: '#EAF7F0', color: '#1E7A5E', borderRadius: 20, padding: '3px 11px', fontSize: 11.5, fontWeight: 900 }}>✓ {l.outcome || 'تم التواصل'}</span>}
                  </div>
                  <div style={{ color: '#6B8A80', fontSize: 12.5, marginTop: 6, fontWeight: 700 }}>{l.headline}</div>
                  <div style={{ color: '#9DB3AB', fontSize: 12, marginTop: 4 }}>
                    {l.phone || '—'}{l.track ? ' · ' + l.track : ''} · {fmtDate(l.created_at)}
                    {l.contacted_at ? ' · تواصل: ' + fmtDate(l.contacted_at) : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ textAlign: 'center', minWidth: 46 }}>
                    <div style={{ fontSize: 26, fontWeight: 900, color: tone.fg, lineHeight: 1 }}>{l.completed ? (l.score ?? '—') : '—'}</div>
                    <div style={{ fontSize: 10.5, color: '#9DB3AB' }}>{l.completed ? '/ ١٠٠' : 'لم يُكمل'}</div>
                  </div>
                  {l.waLink && <a href={l.waLink} target="_blank" rel="noopener noreferrer" style={{ background: '#25D366', color: '#fff', padding: '9px 16px', borderRadius: 30, fontSize: 12.5, fontWeight: 900, textDecoration: 'none' }}>واتساب بالرسالة</a>}
                  <button onClick={() => setOpenId(isOpen ? '' : l.id)} style={{ background: 'transparent', border: '1.5px solid #E8F5EF', color: '#6B8A80', padding: '9px 15px', borderRadius: 30, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'Cairo' }}>{isOpen ? 'إغلاق' : 'الرسالة والنتيجة'}</button>
                </div>
              </div>

              {isOpen && (
                <div style={{ marginTop: 14, borderTop: '1.5px dashed #EAF2EE', paddingTop: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 900, color: '#1A3D34', marginBottom: 6 }}>أول رسالة تُرسل له</div>
                  <div style={{ background: '#F7FAF9', border: '1.5px solid #E1EDE8', borderRadius: 12, padding: '12px 14px', fontSize: 13, lineHeight: 2, color: '#1A3D34', whiteSpace: 'pre-wrap' }}>{l.opener}</div>
                  <button onClick={() => copyOpener(l)} style={{ marginTop: 8, background: 'transparent', border: '1.5px solid #E8F5EF', color: '#2E9E7B', padding: '7px 15px', borderRadius: 30, fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'Cairo' }}>{copied === l.id ? '✓ نُسخت' : 'نسخ الرسالة'}</button>

                  <div style={{ fontSize: 12, fontWeight: 900, color: '#1A3D34', margin: '16px 0 6px' }}>النتيجة</div>
                  <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                    {OUTCOMES.map(o => (
                      <button key={o} disabled={busy === l.id} onClick={() => save(l.id, { outcome: l.outcome === o ? '' : o })}
                        style={{
                          background: l.outcome === o ? '#1A3D34' : '#fff', color: l.outcome === o ? '#fff' : '#6B8A80',
                          border: '1.5px solid ' + (l.outcome === o ? '#1A3D34' : '#E8F5EF'), padding: '7px 14px', borderRadius: 30,
                          fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'Cairo',
                        }}>{o}</button>
                    ))}
                  </div>

                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12, alignItems: 'center' }}>
                    <input
                      defaultValue={l.contact_note || ''}
                      placeholder="ملاحظة: نشاطه، المبلغ، ما قاله بالضبط"
                      onBlur={(e) => { if (e.target.value !== (l.contact_note || '')) save(l.id, { contact_note: e.target.value }); }}
                      style={{ flex: '1 1 300px', padding: '9px 12px', borderRadius: 10, border: '1.5px solid #E8F5EF', fontFamily: 'Cairo', fontSize: 12.5 }}
                    />
                    <label style={{ fontSize: 12, color: '#6B8A80', fontWeight: 700 }}>معاودة في</label>
                    <input type="date" defaultValue={l.next_action_at || ''}
                      onChange={(e) => save(l.id, { next_action_at: e.target.value || null })}
                      style={{ padding: '9px 12px', borderRadius: 10, border: '1.5px solid #E8F5EF', fontFamily: 'Cairo', fontSize: 12.5 }} />
                    <button disabled={busy === l.id} onClick={() => save(l.id, { contacted: !l.contacted })}
                      style={{ background: l.contacted ? 'transparent' : '#2E9E7B', color: l.contacted ? '#6B8A80' : '#fff', border: l.contacted ? '1.5px solid #E8F5EF' : 'none', padding: '9px 18px', borderRadius: 30, fontSize: 12.5, fontWeight: 900, cursor: 'pointer', fontFamily: 'Cairo' }}>
                      {l.contacted ? 'إرجاع للصف' : 'تم التواصل'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
    </div>
  );
}

function Num({ n, t, tone, big }: { n: number; t: string; tone?: string; big?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: big ? 26 : 21, fontWeight: 900, color: tone || '#1A3D34', lineHeight: 1.1 }}>{n}</div>
      <div style={{ fontSize: 11.5, color: '#6B8A80', fontWeight: 700, marginTop: 3 }}>{t}</div>
    </div>
  );
}
