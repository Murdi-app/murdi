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
  kind?: 'تقييم' | 'تسجيل'; company_name?: string | null;
};
type Stats = { total: number; contacted: number; registered: number; open: number; ready: number; gap: number; weak: number; unknown: number; today: number };

// من يبقى في صفّ المكالمات.
//
// ★ «مسجَّل» كان يُخرج الصفَّ من الصف، وذلك صحيحٌ لسببٍ واحد: التكرار —
//   صاحبُ التقييم السريع فتح حساباً بعده، فيُتابَع من حسابه لا من تقييمه.
//   لكن صفَّ **التسجيل** نفسه مسجَّلٌ بالضرورة، وهو العميل الجديد عينه. فكان
//   يسقط بالقاعدة التي وُضعت للمكرَّر: أربعة عشر عميلاً سجّلوا في المنصة ولم
//   يُتّصل بأحدهم، ولا يظهر منهم واحدٌ إلا في تبويب «الكل». وعدّاد المفتوح
//   فوقهم يعدّهم فيقول عشرين، والقائمة تحته تعرض ستة — والفرق أربعة عشر
//   عميلاً جديداً لا يراهم أحد.
//   فالاستثناء للمكرَّر وحده، لا لمن كان التسجيل هو صفَّه.
const inQueue = (l: Lead) => !l.contacted && !(l.registered && l.kind !== 'تسجيل');

// مكالمةٌ وقعت ولم تُكتب نتيجتها — وهذه مكالمةٌ ضائعة.
//
// ★ كان زرّ «اتصلتُ» وحده يُخرج الصفَّ من الصف ويُدخله «تم التواصل»، والنتيجةُ
//   والملاحظةُ تحت زرٍّ ثانٍ لا يُضغط. فبلغ المُعلَّم مئةَ صفٍّ ولم تُكتب نتيجةٌ
//   على منشأةٍ واحدة: لا يُعرف ماذا قال أحدُهم ولا لماذا اتُّصل به، ولا أيُّ
//   إعلانٍ جلب عميلاً جادّاً وأيُّه أحرق المال. والمكالمة نفسُها تُنفق مرتين.
//   فالاتصالُ لا يُتمّ الصفَّ وحده بعد اليوم: الصفُّ يبقى معلّقاً في تبويبٍ
//   خاصٍّ اسمُه «بلا نتيجة» حتى تُكتب، و«تم التواصل» لمن كُتبت نتيجتُه فقط.
const needsResult = (l: Lead) => Boolean(l.contacted) && !l.outcome;
const isDone = (l: Lead) => Boolean(l.contacted) && Boolean(l.outcome);

export type Filter = 'open' | 'ready' | 'noresult' | 'done' | 'all';

/** تبويبٌ واحد. معرَّفٌ خارج الصفحة: المكوّن الذي يُبنى داخل الرسم يُبنى من جديد كل مرة. */
function Chip({ k, label, n, warn, on, pick }: {
  k: Filter; label: string; n: number; warn?: boolean; on: boolean; pick: (k: Filter) => void;
}) {
  // «بلا نتيجة» يُصبغ بالأحمر حين يكون فيه أحد — فهو دَينٌ على المكتب لا تبويبٌ محايد
  const idle = warn && n > 0
    ? { bg: '#FDF1EC', fg: '#B4453C', br: '#F0D6D2' }
    : { bg: '#fff', fg: '#6B8A80', br: '#E8F5EF' };
  return (
    <div onClick={() => pick(k)} style={{
      padding: '7px 15px', borderRadius: 30, cursor: 'pointer', fontSize: 12.5, fontWeight: on ? 900 : 700,
      background: on ? '#1A3D34' : idle.bg, color: on ? '#fff' : idle.fg,
      border: '1.5px solid ' + (on ? '#1A3D34' : idle.br),
    }}>{label} <span style={{ opacity: .75 }}>{n}</span></div>
  );
}

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
  const [filter, setFilter] = useState<Filter>('open');
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
    if (filter === 'done') return isDone(l);
    if (filter === 'noresult') return needsResult(l);
    if (filter === 'ready') return inQueue(l) && l.band === 'ready';
    return inQueue(l);
  }), [leads, filter]);

  const copyOpener = async (l: Lead) => {
    try { await navigator.clipboard.writeText(l.opener); setCopied(l.id); setTimeout(() => setCopied(''), 1800); } catch { /* المتصفح منع النسخ */ }
  };

  const countOpen = leads.filter(inQueue).length;
  const countReady = leads.filter(l => inQueue(l) && l.band === 'ready').length;
  const countNoResult = leads.filter(needsResult).length;
  const countDone = leads.filter(isDone).length;

  const chip = (k: Filter, label: string, n: number, warn?: boolean) => (
    <Chip key={k} k={k} label={label} n={n} warn={warn} on={filter === k} pick={setFilter} />
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
        {chip('open', 'الصف', countOpen)}
        {chip('ready', 'المؤهَّلون', countReady)}
        {chip('noresult', 'بلا نتيجة', countNoResult, true)}
        {chip('done', 'تم التواصل', countDone)}
        {chip('all', 'الكل', leads.length)}
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
                    <span style={{ color: '#1A3D34', fontSize: 16.5, fontWeight: 900 }}>{l.company_name || l.full_name || 'بلا اسم'}</span>
                    {l.company_name && l.full_name && <span style={{ color: '#6B8A80', fontSize: 12.5, fontWeight: 700 }}>— {l.full_name}</span>}
                    {l.kind === 'تسجيل'
                      ? <span style={{ background: '#EEF3FF', color: '#3A5AA8', border: '1px solid #D6E0F7', borderRadius: 20, padding: '3px 11px', fontSize: 11.5, fontWeight: 900 }}>سجّل في المنصة</span>
                      : <span style={{ background: '#F4F6F5', color: '#6B8A80', border: '1px solid #E3EAE7', borderRadius: 20, padding: '3px 11px', fontSize: 11.5, fontWeight: 900 }}>تقييم سريع</span>}
                    <span style={{ background: tone.bg, color: tone.fg, border: '1px solid ' + tone.br, borderRadius: 20, padding: '3px 11px', fontSize: 11.5, fontWeight: 900 }}>{BAND_LABEL[l.band]}</span>
                    {l.registered && l.kind !== 'تسجيل' && <span style={{ background: '#EEF3FF', color: '#3A5AA8', border: '1px solid #D6E0F7', borderRadius: 20, padding: '3px 11px', fontSize: 11.5, fontWeight: 900 }}>مسجَّل في المنصة</span>}
                    {l.contacted && (l.outcome
                      ? <span style={{ background: '#EAF7F0', color: '#1E7A5E', borderRadius: 20, padding: '3px 11px', fontSize: 11.5, fontWeight: 900 }}>✓ {l.outcome}</span>
                      : <span style={{ background: '#FDF1EC', color: '#B4453C', border: '1px solid #F0D6D2', borderRadius: 20, padding: '3px 11px', fontSize: 11.5, fontWeight: 900 }}>اتُّصل — سجّلي النتيجة</span>)}
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
                  {/* ★ والضغطةُ تفتح البطاقة معها حين تُعلَّم مكالمةً جديدة: فأزرارُ
                      النتيجة والملاحظة تصير تحت إصبعها في اللحظة التي تذكر فيها
                      ما قاله الرجل — لا تحت زرٍّ ثانٍ تنساه بعد خمس مكالمات. */}
                  <button disabled={busy === l.id}
                    onClick={() => { const on = !l.contacted; void save(l.id, { contacted: on }); if (on) setOpenId(l.id); }}
                    style={{
                      background: l.contacted ? (l.outcome ? '#EAF7F0' : '#FDF1EC') : '#1A3D34',
                      color: l.contacted ? (l.outcome ? '#1E7A5E' : '#B4453C') : '#fff',
                      border: '1.5px solid ' + (l.contacted ? (l.outcome ? '#BFE6D6' : '#F0D6D2') : '#1A3D34'),
                      padding: '9px 18px', borderRadius: 30,
                      fontSize: 12.5, fontWeight: 900, cursor: 'pointer', fontFamily: 'Cairo',
                    }}>{l.contacted ? '✓ اتصلتُ' : 'اتصلتُ'}</button>
                  {l.phone && <a href={'tel:' + l.phone} style={{ background: '#fff', border: '1.5px solid #E8F5EF', color: '#1A3D34', padding: '9px 16px', borderRadius: 30, fontSize: 12.5, fontWeight: 900, textDecoration: 'none' }}>اتصال</a>}
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
                  {needsResult(l) && (
                    <div style={{ background: '#FDF1EC', border: '1px solid #F0D6D2', color: '#B4453C', borderRadius: 10, padding: '9px 12px', fontSize: 12.5, fontWeight: 700, marginBottom: 8, lineHeight: 1.8 }}>
                      هذه المكالمة بلا نتيجة، وتبقى في صفّك حتى تُسجَّل. اختاري نتيجةً، واكتبي في الملاحظة سببَ اتصالك وماذا قال.
                    </div>
                  )}
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
