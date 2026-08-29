'use client';
import { useEffect, useState, useCallback } from 'react';
import AdminNav from '@/components/AdminNav';

// سجلّ الجهات. قبله كانت المنصة تكتشف الجهات لكل عميل ثم تنساها:
// ٩٤٣ اسماً لأربعة عملاء، ٨٤٥ منها ظهر مرة واحدة فقط. فلا تراكم ولا ذاكرة.
// هذه الشاشة تجعل ما يتعلّمه المحرك — ثم ما يتعلّمه الواقع من الردود — رأسَ مال يبقى.

type Ent = {
  id: string; display_name: string; tracks: string[]; regions: string[];
  companies_seen: number; times_matched: number; best_fit_score: number | null;
  evidence_grade: string | null; apply_url: string | null; apply_channel: string | null;
  link_status: string | null; gulf_presence: string | null;
  outreach_sent: number; outreach_replied: number;
  first_reply_hours: number | null; median_reply_hours: number | null;
  last_sent_at: string | null; last_reply_at: string | null;
  verdict: string | null; blocked: boolean; admin_note: string | null;
};
type Stats = {
  total: number; core: number; once: number; confirmed: number; needsCheck: number;
  broken: number; contacted: number; replied: number; blocked: number; medianReplyHours: number | null;
};

const VIEWS: { k: string; t: string }[] = [
  { k: 'core',    t: 'النواة — ظهرت لأكثر من عميل' },
  { k: 'replied', t: 'ترد' },
  { k: 'silent',  t: 'لا ترد' },
  { k: 'broken',  t: 'رابط مكسور' },
  { k: 'once',    t: 'ظهرت مرة — تحتاج تحققاً' },
  { k: 'blocked', t: 'مستبعدة' },
];
const VERDICTS = ['معتمدة', 'قيد التحقق', 'لا تُناسبنا', 'لا وجود لها'];

const GRADE_TONE: Record<string, { bg: string; fg: string }> = {
  'مؤكّد':      { bg: '#EAF7F0', fg: '#1E7A5E' },
  'مرجّح':      { bg: '#FBF5E8', fg: '#9A7B2E' },
  'يحتاج تحقق': { bg: '#FDF1E8', fg: '#B4622A' },
};

// سرعة الرد هي أثمن ما يتراكم: جهة ترد خلال يومين تُقدَّم على جهة ترد بعد شهر
// ولو تساوى التطابق — لأن وقت العميل جزء من الصفقة.
function speedLabel(h: number | null): { t: string; c: string } | null {
  if (h === null || h === undefined || !(h > 0)) return null;
  if (h <= 48) return { t: 'ترد خلال يومين', c: '#1E7A5E' };
  if (h <= 168) return { t: 'ترد خلال أسبوع', c: '#9A7B2E' };
  return { t: 'ترد بعد أسابيع', c: '#B4622A' };
}

export default function EntitiesPage() {
  const [ents, setEnts] = useState<Ent[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [view, setView] = useState('core');
  const [track, setTrack] = useState('');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams({ view, ...(track ? { track } : {}), ...(q ? { q } : {}) });
    const r = await fetch('/api/admin/entities?' + p.toString());
    const d = await r.json();
    if (!r.ok) { setMsg(d.error || 'تعذّر التحميل'); setLoading(false); return; }
    setEnts(d.entities || []); setStats(d.stats || null); setLoading(false);
  }, [view, track, q]);
  useEffect(() => { load(); }, [load]);

  // الفحص يمشي على دفعات: كل نداء يفحص خمس عشرة جهة، فلا يصطدم بمهلة الدالة السحابية
  const [checking, setChecking] = useState(false);
  const [checkMsg, setCheckMsg] = useState('');
  const checkLinks = async () => {
    setChecking(true); setCheckMsg('يفحص…'); setMsg('');
    let checked = 0, broken = 0, rounds = 0;
    const names: string[] = [];
    try {
      for (;;) {
        rounds++;
        if (rounds > 60) { setCheckMsg('توقفت عند حدّ الأمان — اضغط مرة أخرى للمتابعة'); break; }
        const r = await fetch('/api/admin/entities/check-links', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ limit: 15 }),
        });
        const d = await r.json();
        if (!r.ok) { setCheckMsg(d.error || 'تعذّر الفحص'); break; }
        checked += d.checked || 0;
        broken += d.broken || 0;
        for (const n of (d.brokenNames || [])) if (names.length < 12) names.push(n);
        setCheckMsg('فُحصت ' + checked + ' جهة · مكسور ' + broken + ' · بقي ' + (d.remaining ?? 0));
        if (d.done || !d.checked) {
          setCheckMsg('انتهى الفحص: ' + checked + ' جهة، منها ' + broken + ' رابطاً مكسوراً'
            + (names.length ? ' — ' + names.join('، ') : ''));
          break;
        }
      }
    } catch { setCheckMsg('انقطع الفحص — اضغط مرة أخرى ويكمل من حيث وقف'); }
    setChecking(false);
    load();
  };

  const rebuild = async () => {
    setBusy('rebuild'); setMsg('');
    const r = await fetch('/api/admin/entities', { method: 'POST' });
    const d = await r.json();
    setBusy('');
    setMsg(r.ok ? ('أُعيد البناء — الإجمالي ' + (d.result?.total ?? '؟') + ' جهة') : (d.error || 'تعذّر'));
    if (r.ok) load();
  };

  const save = async (id: string, patch: Record<string, unknown>) => {
    setBusy(id);
    const r = await fetch('/api/admin/entities', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...patch }),
    });
    setBusy('');
    if (!r.ok) { const d = await r.json().catch(() => ({})); setMsg(d.error || 'تعذّر الحفظ'); return; }
    setEnts(prev => prev.map(e => e.id === id ? { ...e, ...(patch as Partial<Ent>) } : e));
  };

  return (
    <div dir="rtl" style={{ fontFamily: 'Cairo,sans-serif', maxWidth: 980, margin: '0 auto', padding: '28px 20px', background: '#FBFCFB', minHeight: '100vh' }}>
      <AdminNav />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ color: '#1A3D34', fontSize: 24, fontWeight: 900, margin: 0 }}>🏦 سجلّ الجهات</h1>
          <p style={{ color: '#6B8A80', fontSize: 13, marginTop: 6, marginBottom: 0, lineHeight: 1.9, maxWidth: 620 }}>
            ما اكتشفه المحرك عبر كل عميل، مجموعاً في مكان واحد ولا يُنسى — ومعه ما تعلّمه الواقع: من ردّ، وبعد كم.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={rebuild} disabled={busy === 'rebuild' || checking} style={{ background: '#1A3D34', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 30, fontFamily: 'Cairo', fontWeight: 900, fontSize: 12.5, cursor: 'pointer' }}>
            {busy === 'rebuild' ? 'جارٍ…' : '↻ إعادة البناء من المطابقات'}
          </button>
          <button onClick={checkLinks} disabled={checking} style={{ background: 'transparent', color: '#1A3D34', border: '1.5px solid #E8F5EF', padding: '10px 20px', borderRadius: 30, fontFamily: 'Cairo', fontWeight: 900, fontSize: 12.5, cursor: 'pointer' }}>
            {checking ? 'يفحص…' : '🔗 افحص روابط التقديم'}
          </button>
        </div>
      </div>

      {stats && (
        <div style={{ background: '#fff', border: '1.5px solid #EAF2EE', borderRadius: 14, padding: '14px 18px', margin: '18px 0 14px', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <N n={stats.core} t="جهة متكررة (النواة)" tone="#1E7A5E" big />
          <N n={stats.confirmed} t="إثباتها مؤكّد" tone="#1E7A5E" />
          <N n={stats.once} t="ظهرت مرة — تحتاج تحققاً" tone="#B4622A" />
          <N n={stats.broken} t="رابط مكسور" tone="#B4342A" />
          <N n={stats.contacted} t="خوطبت" />
          <N n={stats.replied} t="ردّت" tone="#2E9E7B" />
          <N n={stats.total} t="الإجمالي" />
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        {VIEWS.map(v => (
          <div key={v.k} onClick={() => setView(v.k)} style={{
            padding: '7px 15px', borderRadius: 30, cursor: 'pointer', fontSize: 12.5, fontWeight: view === v.k ? 900 : 700,
            background: view === v.k ? '#1A3D34' : '#fff', color: view === v.k ? '#fff' : '#6B8A80',
            border: '1.5px solid ' + (view === v.k ? '#1A3D34' : '#E8F5EF'),
          }}>{v.t}</div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18, alignItems: 'center' }}>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="ابحث باسم الجهة"
          style={{ flex: '1 1 240px', padding: '9px 12px', borderRadius: 10, border: '1.5px solid #E8F5EF', fontFamily: 'Cairo', fontSize: 12.5 }} />
        <select value={track} onChange={e => setTrack(e.target.value)}
          style={{ padding: '9px 12px', borderRadius: 10, border: '1.5px solid #E8F5EF', fontFamily: 'Cairo', fontSize: 12.5 }}>
          <option value="">كل المسارات</option>
          <option value="funding">تمويل</option>
          <option value="investment">استثمار</option>
          <option value="feasibility">جدوى</option>
        </select>
      </div>

      {checkMsg && <div style={{ background: '#F7FAF9', border: '1.5px solid #E1EDE8', color: '#1A3D34', borderRadius: 12, padding: '10px 14px', marginBottom: 10, fontSize: 12.5, fontWeight: 700 }}>{checkMsg}</div>}
      {msg && <div style={{ background: '#F7FAF9', border: '1.5px solid #E1EDE8', color: '#1A3D34', borderRadius: 12, padding: '10px 14px', marginBottom: 14, fontSize: 12.5, fontWeight: 700 }}>{msg}</div>}

      {loading ? <div style={{ color: '#9DB3AB', textAlign: 'center', padding: 40 }}>جارٍ التحميل…</div>
        : ents.length === 0 ? <div style={{ color: '#9DB3AB', textAlign: 'center', padding: 34, background: '#fff', borderRadius: 12, border: '1px solid #EAF2EE' }}>لا جهات في هذا العرض.</div>
        : ents.map(e => {
          const sp = speedLabel(e.median_reply_hours ?? e.first_reply_hours);
          const gt = e.evidence_grade ? GRADE_TONE[e.evidence_grade] : null;
          return (
            <div key={e.id} style={{ background: '#fff', border: '1.5px solid #EAF2EE', borderRadius: 14, padding: '15px 18px', marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <div style={{ flex: '1 1 340px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                    <span style={{ color: '#1A3D34', fontSize: 15.5, fontWeight: 900 }}>{e.display_name}</span>
                    {gt && <span style={{ background: gt.bg, color: gt.fg, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 900 }}>{e.evidence_grade}</span>}
                    {sp && <span style={{ background: '#F4F8F6', color: sp.c, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 900 }}>{sp.t}</span>}
                    {e.verdict && <span style={{ background: '#1A3D34', color: '#fff', borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 900 }}>{e.verdict}</span>}
                  </div>
                  <div style={{ color: '#6B8A80', fontSize: 12, marginTop: 6, lineHeight: 1.9 }}>
                    ظهرت لـ<b>{e.companies_seen}</b> عميل · <b>{e.times_matched}</b> مطابقة
                    {e.tracks?.length ? ' · ' + e.tracks.join(' + ') : ''}
                    {e.regions?.length ? ' · ' + e.regions.slice(0, 2).join('، ') : ''}
                    {e.outreach_sent > 0 ? ' · خوطبت ' + e.outreach_sent + '، ردّت ' + e.outreach_replied : ''}
                    {e.median_reply_hours ? ' · وسيط الرد ' + Math.round(Number(e.median_reply_hours)) + ' ساعة' : ''}
                  </div>
                  {e.link_status && e.link_status !== 'يعمل' && (
                    <div style={{ color: '#B4342A', fontSize: 11.5, fontWeight: 800, marginTop: 4 }}>الرابط: {e.link_status}</div>
                  )}
                  {e.apply_url && <a href={e.apply_url} target="_blank" rel="noopener noreferrer" style={{ color: '#2E9E7B', fontSize: 12, fontWeight: 700 }}>قناة التقديم ↗</a>}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  {VERDICTS.map(v => (
                    <button key={v} disabled={busy === e.id} onClick={() => save(e.id, { verdict: e.verdict === v ? '' : v })}
                      style={{
                        background: e.verdict === v ? '#1A3D34' : '#fff', color: e.verdict === v ? '#fff' : '#6B8A80',
                        border: '1.5px solid ' + (e.verdict === v ? '#1A3D34' : '#E8F5EF'), padding: '6px 12px', borderRadius: 30,
                        fontSize: 11.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'Cairo',
                      }}>{v}</button>
                  ))}
                  <button disabled={busy === e.id} onClick={() => save(e.id, { blocked: !e.blocked })}
                    style={{ background: 'transparent', color: e.blocked ? '#2E9E7B' : '#B4342A', border: '1.5px solid #E8F5EF', padding: '6px 12px', borderRadius: 30, fontSize: 11.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'Cairo' }}>
                    {e.blocked ? 'أعِدها' : 'استبعد'}
                  </button>
                </div>
              </div>
              <input defaultValue={e.admin_note || ''} placeholder="ملاحظتك عن هذه الجهة: من تكلّمه، ما تشترطه، ما رفضته"
                onBlur={ev => { if (ev.target.value !== (e.admin_note || '')) save(e.id, { admin_note: ev.target.value }); }}
                style={{ width: '100%', marginTop: 10, padding: '8px 11px', borderRadius: 10, border: '1.5px solid #F0F5F3', fontFamily: 'Cairo', fontSize: 12 }} />
            </div>
          );
        })}
    </div>
  );
}

function N({ n, t, tone, big }: { n: number; t: string; tone?: string; big?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: big ? 26 : 21, fontWeight: 900, color: tone || '#1A3D34', lineHeight: 1.1 }}>{n}</div>
      <div style={{ fontSize: 11.5, color: '#6B8A80', fontWeight: 700, marginTop: 3 }}>{t}</div>
    </div>
  );
}
