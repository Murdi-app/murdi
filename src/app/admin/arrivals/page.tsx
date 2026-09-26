'use client';
import { useEffect, useState, useCallback } from 'react';
import AdminNav from '@/components/AdminNav';

// «الوارد» — من طرق بابنا، من أي باب، أحدثُ أولاً.
//
// صُمّمت للجوال: الصفّ يُقرأ بلا فتح — اسمٌ وجوالٌ وما الذي فعله ومتى —
// وزرّا الاتصال والواتساب في الصفّ نفسه. فالغرض مكالمة، لا قراءة لوحة.

type Row = {
  source: string; ref_id: string; company_id: string | null; at: string;
  kind_label: string; name: string | null; person: string | null;
  phone: string | null; phone_pretty: string; wa: string | null;
  email: string | null; city: string | null; detail: string | null;
  marketing_source: string | null;
  contacted: boolean; contacted_at: string | null; outcome: string | null;
};

type Stats = { open: number; today: number; week: number; done: number; oldest_open_days: number };

const TONE: Record<string, { bg: string; fg: string; br: string; icon: string }> = {
  inquiry:    { bg: '#FDF1E8', fg: '#B4622A', br: '#F0D8C6', icon: '🧾' },
  order:      { bg: '#FDF1E8', fg: '#B4622A', br: '#F0D8C6', icon: '🛒' },
  payment:    { bg: '#FBF3DC', fg: '#8A6B12', br: '#EFE2B8', icon: '💰' },
  match:      { bg: '#EEF3FB', fg: '#2B558A', br: '#D8E3F2', icon: '🎯' },
  assessment: { bg: '#F4F8F6', fg: '#1E7A5E', br: '#DCEBE4', icon: '🔥' },
  signup:     { bg: '#F4F6F5', fg: '#4A6B60', br: '#E3EAE7', icon: '🆕' },
};
const tone = (s: string) => TONE[s] || TONE.signup;

const OUTCOMES = ['لم يرد', 'مهتم', 'طلب معاودة', 'غير مهتم', 'رقم خاطئ', 'تحوّل عميلاً'];

// «قبل ساعتين» أنفع من تاريخٍ يحتاج حساباً
function ago(iso: string): string {
  const t = Date.parse(iso);
  if (!t) return '';
  const m = Math.floor((Date.now() - t) / 60000);
  if (m < 1) return 'الآن';
  if (m < 60) return 'قبل ' + m + ' دقيقة';
  const h = Math.floor(m / 60);
  if (h < 24) return 'قبل ' + h + ' ساعة';
  const d = Math.floor(h / 24);
  if (d === 1) return 'أمس';
  if (d < 30) return 'قبل ' + d + ' يوم';
  return new Date(t).toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' });
}

export default function ArrivalsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [tab, setTab] = useState<'open' | 'done' | 'all'>('open');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [openId, setOpenId] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const r = await fetch('/api/staff/arrivals?tab=' + tab);
      const d = await r.json();
      if (!r.ok) { setErr(d.error || 'تعذّر التحميل'); setLoading(false); return; }
      setRows(d.rows || []); setStats(d.stats || null);
    } catch { setErr('تعذّر الاتصال'); }
    setLoading(false);
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  const mark = async (r: Row, outcome: string) => {
    setBusy(r.source + r.ref_id); setErr('');
    try {
      const res = await fetch('/api/staff/arrivals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: r.source, ref_id: r.ref_id, outcome, note: note || null }),
      });
      const d = await res.json();
      if (!res.ok) { setErr(d.error || 'تعذّر التسجيل'); setBusy(''); return; }
      setOpenId(''); setNote(''); await load();
    } catch { setErr('تعذّر الاتصال'); }
    setBusy('');
  };

  const key = (r: Row) => r.source + ':' + r.ref_id;

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: '#F7FBF9', fontFamily: 'Tajawal, sans-serif' }}>
      <AdminNav />
      <div style={{ maxWidth: 820, margin: '0 auto', padding: '18px 14px 60px' }}>

        <h1 style={{ fontSize: 22, fontWeight: 900, color: '#1A3D34', margin: '0 0 2px' }}>الوارد</h1>
        <p style={{ margin: '0 0 14px', color: '#6B8A80', fontSize: 13 }}>
          كل من دخل المنصة — سجّل، أو قاس جاهزيته، أو طلب خدمة، أو حوّل. أحدثُهم أولاً.
        </p>

        {stats && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            {[
              { n: stats.today, t: 'دخلوا خلال ٢٤ ساعة', hot: stats.today > 0 },
              { n: stats.week, t: 'هذا الأسبوع', hot: false },
              { n: stats.open, t: 'بلا تواصل', hot: stats.open > 0 },
              { n: stats.oldest_open_days, t: 'يوماً ينتظر أقدمُهم', hot: stats.oldest_open_days > 3 },
            ].map((s, i) => (
              <div key={i} style={{
                flex: '1 1 150px', background: s.hot ? '#FDF1E8' : '#fff',
                border: '1px solid ' + (s.hot ? '#F0D8C6' : '#E3EAE7'),
                borderRadius: 10, padding: '10px 12px',
              }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: s.hot ? '#B4622A' : '#1A3D34' }}>{s.n}</div>
                <div style={{ fontSize: 11.5, color: '#6B8A80' }}>{s.t}</div>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          {([['open', 'ينتظر تواصلاً'], ['done', 'تُوُوصل معه'], ['all', 'الكل']] as const).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} style={{
              flex: 1, padding: '9px 6px', borderRadius: 8, cursor: 'pointer',
              fontFamily: 'Tajawal, sans-serif', fontWeight: 700, fontSize: 13,
              border: '1px solid ' + (tab === k ? '#1A3D34' : '#E3EAE7'),
              background: tab === k ? '#1A3D34' : '#fff',
              color: tab === k ? '#fff' : '#4A6B60',
            }}>{l}</button>
          ))}
        </div>

        {err && (
          <div style={{ background: '#FDECEC', border: '1px solid #F5C6C6', color: '#9B2C2C', padding: '10px 12px', borderRadius: 8, marginBottom: 12, fontSize: 13 }}>{err}</div>
        )}
        {loading && <div style={{ color: '#6B8A80', padding: 20, textAlign: 'center' }}>جارٍ التحميل…</div>}
        {!loading && rows.length === 0 && (
          <div style={{ color: '#6B8A80', padding: 30, textAlign: 'center', background: '#fff', borderRadius: 10, border: '1px solid #E3EAE7' }}>
            لا أحد هنا.
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.map((r) => {
            const t = tone(r.source);
            const isOpen = openId === key(r);
            const markable = r.source === 'assessment' || r.source === 'inquiry' || r.source === 'signup';
            return (
              <div key={key(r)} style={{ background: '#fff', border: '1px solid #E3EAE7', borderRadius: 10, padding: '12px 13px' }}>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <span style={{
                      display: 'inline-block', background: t.bg, color: t.fg, border: '1px solid ' + t.br,
                      borderRadius: 20, padding: '2px 10px', fontSize: 11.5, fontWeight: 700, marginBottom: 6,
                    }}>{t.icon} {r.kind_label}</span>
                    <div style={{ fontSize: 15.5, fontWeight: 900, color: '#1A3D34', wordBreak: 'break-word' }}>
                      {r.name || 'بلا اسم'}
                    </div>
                    {r.person && r.person !== r.name && (
                      <div style={{ fontSize: 13, color: '#4A6B60' }}>{r.person}</div>
                    )}
                    <div style={{ fontSize: 12.5, color: '#6B8A80', marginTop: 3 }}>
                      {r.detail}{r.city ? ' · ' + r.city : ''}
                    </div>
                    {r.source === 'inquiry' && (
                      <div style={{ fontSize: 12, color: '#4A6B60', marginTop: 4 }}>
                        المصدر: {r.marketing_source || 'غير محدد'}
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: 11.5, color: '#94ADA4', whiteSpace: 'nowrap' }}>{ago(r.at)}</div>
                </div>

                <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                  {r.phone ? (
                    <>
                      <a href={'tel:' + r.phone} style={{
                        background: '#1A3D34', color: '#fff', padding: '7px 16px', borderRadius: 8,
                        textDecoration: 'none', fontWeight: 700, fontSize: 13,
                      }}>اتصل · {r.phone_pretty}</a>
                      {r.wa && (
                        <a href={r.wa} target="_blank" rel="noreferrer" style={{
                          background: '#E8F5EE', color: '#1E7A5E', border: '1px solid #CFE7DA',
                          padding: '7px 14px', borderRadius: 8, textDecoration: 'none', fontWeight: 700, fontSize: 13,
                        }}>واتساب</a>
                      )}
                    </>
                  ) : (
                    <span style={{ fontSize: 12.5, color: '#B4622A' }}>
                      لا جوال — {r.email ? 'راسله على ' + r.email : 'ولا بريد'}
                    </span>
                  )}

                  {markable && !r.contacted && (
                    <button onClick={() => { setOpenId(isOpen ? '' : key(r)); setNote(''); }} style={{
                      marginInlineStart: 'auto', background: '#fff', color: '#4A6B60', border: '1px solid #E3EAE7',
                      padding: '7px 14px', borderRadius: 8, cursor: 'pointer',
                      fontFamily: 'Tajawal, sans-serif', fontWeight: 700, fontSize: 12.5,
                    }}>{isOpen ? 'إغلاق' : 'سجّل تواصلاً'}</button>
                  )}
                  {r.contacted && (
                    <span style={{ marginInlineStart: 'auto', fontSize: 12, color: '#1E7A5E', fontWeight: 700 }}>
                      ✓ {r.outcome || 'تُوُوصل معه'}
                    </span>
                  )}
                  {!markable && !r.contacted && (
                    <span style={{ marginInlineStart: 'auto', fontSize: 11.5, color: '#94ADA4' }}>
                      يُغلَق من مكتب الطلبات
                    </span>
                  )}
                </div>

                {isOpen && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed #E3EAE7' }}>
                    <input
                      value={note} onChange={(e) => setNote(e.target.value)}
                      placeholder="ماذا قال؟ (اختياري)"
                      style={{
                        width: '100%', padding: '9px 11px', borderRadius: 8, border: '1px solid #E3EAE7',
                        fontFamily: 'Tajawal, sans-serif', fontSize: 13, marginBottom: 8, boxSizing: 'border-box',
                      }}
                    />
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {OUTCOMES.map((o) => (
                        <button key={o} disabled={busy === r.source + r.ref_id} onClick={() => mark(r, o)} style={{
                          background: '#F4F8F6', color: '#1A3D34', border: '1px solid #DCEBE4',
                          padding: '7px 13px', borderRadius: 20, cursor: 'pointer',
                          fontFamily: 'Tajawal, sans-serif', fontWeight: 700, fontSize: 12.5,
                          opacity: busy === r.source + r.ref_id ? 0.5 : 1,
                        }}>{o}</button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
