'use client';
import { useEffect, useState, useCallback } from 'react';
import AdminNav from '@/components/AdminNav';

// صندوق التعميد. صُمّم للجوال أولاً: البند سطر واحد يُفهم بلا فتح، والجواب نقرة.
// وترتيبه بالمال — ما يؤخّر مبلغاً يسبق ما يؤخّر إجراءً.

type Item = {
  id: string; created_at: string; kind: string; title: string; detail: string | null;
  options: { key: string; label: string }[];
  value_label: string | null; value_hint: string | null;
  urgency: 'money' | 'normal' | 'low'; status: string;
  answer_key: string | null; answer_value: string | null; answered_at: string | null;
  companies: { company_name: string } | null;
};

const TONE: Record<string, { bg: string; fg: string; br: string; t: string }> = {
  money:  { bg: '#FDF1E8', fg: '#B4622A', br: '#F0D8C6', t: 'يؤخّر مالاً' },
  normal: { bg: '#F4F8F6', fg: '#1E7A5E', br: '#DCEBE4', t: 'يحتاج كلمتك' },
  low:    { bg: '#F4F6F5', fg: '#6B8A80', br: '#E3EAE7', t: 'متى تيسّر' },
};

const fmt = (d: string) => new Date(d).toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' });

export default function InboxPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [tab, setTab] = useState<'pending' | 'answered'>('pending');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [vals, setVals] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [delId, setDelId] = useState('');   // البند الذي طُلب حذفه وينتظر التأكيد

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    const r = await fetch('/api/admin/inbox?status=' + tab);
    const d = await r.json();
    if (!r.ok) { setErr(d.error || 'تعذّر التحميل'); setLoading(false); return; }
    setItems(d.items || []); setLoading(false);
  }, [tab]);
  useEffect(() => { load(); }, [load]);

  const answer = async (it: Item, key: string) => {
    setBusy(it.id); setErr('');
    const r = await fetch('/api/admin/inbox', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: it.id, answer_key: key, answer_value: vals[it.id] || '', answer_note: notes[it.id] || '' }),
    });
    setBusy('');
    if (!r.ok) { const d = await r.json().catch(() => ({})); setErr(d.error || 'تعذّر الحفظ'); return; }
    setItems(prev => prev.filter(x => x.id !== it.id));
  };

  // الحذف نقرتان: الأولى تُظهر «تأكيد الحذف»، والثانية تحذف. وتسقط الأولى وحدها بعد أربع ثوانٍ
  // حتى لا يمسح إبهامٌ عابرٌ بنداً على الجوال.
  const remove = async (it: Item) => {
    if (delId !== it.id) {
      setDelId(it.id);
      setTimeout(() => setDelId(cur => (cur === it.id ? '' : cur)), 4000);
      return;
    }
    setBusy(it.id); setErr('');
    const r = await fetch('/api/admin/inbox', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: it.id }),
    });
    setBusy(''); setDelId('');
    if (!r.ok) { const d = await r.json().catch(() => ({})); setErr(d.error || 'تعذّر الحذف'); return; }
    setItems(prev => prev.filter(x => x.id !== it.id));
  };

  return (
    <div dir="rtl" style={{ fontFamily: 'Cairo,sans-serif', maxWidth: 780, margin: '0 auto', padding: '28px 18px', background: '#FBFCFB', minHeight: '100vh' }}>
      <AdminNav />
      <h1 style={{ color: '#1A3D34', fontSize: 24, fontWeight: 900, margin: 0 }}>✅ صندوق التعميد</h1>
      <p style={{ color: '#6B8A80', fontSize: 13, marginTop: 6, marginBottom: 16, lineHeight: 1.9 }}>
        كل ما ينتظر كلمتك في مكان واحد. اعتمد من جوالك، وأُكمل أنا من حيث تقف.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {([['pending', 'ينتظرك'], ['answered', 'ما اعتمدته']] as const).map(([k, lb]) => (
          <div key={k} onClick={() => setTab(k)} style={{
            padding: '7px 16px', borderRadius: 30, cursor: 'pointer', fontSize: 12.5,
            fontWeight: tab === k ? 900 : 700,
            background: tab === k ? '#1A3D34' : '#fff', color: tab === k ? '#fff' : '#6B8A80',
            border: '1.5px solid ' + (tab === k ? '#1A3D34' : '#E8F5EF'),
          }}>{lb}</div>
        ))}
      </div>

      {err && <div style={{ background: '#FDF1F1', border: '1.5px solid #F2D4D4', color: '#B4342A', borderRadius: 12, padding: '11px 15px', marginBottom: 14, fontSize: 13, fontWeight: 700 }}>{err}</div>}

      {loading ? <div style={{ color: '#9DB3AB', textAlign: 'center', padding: 40 }}>جارٍ التحميل…</div>
        : items.length === 0 ? (
          <div style={{ background: '#fff', border: '1px solid #EAF2EE', borderRadius: 14, padding: 34, textAlign: 'center', color: '#6B8A80', fontSize: 14 }}>
            {tab === 'pending' ? 'لا شيء ينتظرك. أُكمل عملي.' : 'لم تعتمد شيئاً بعد.'}
          </div>
        ) : items.map(it => {
          const tone = TONE[it.urgency] || TONE.normal;
          const done = it.status === 'answered';
          const asking = delId === it.id;
          return (
            <div key={it.id} style={{ background: '#fff', border: '1.5px solid ' + (asking ? '#F2D4D4' : tone.br), borderRadius: 14, padding: '16px 18px', marginBottom: 12 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
                <span style={{ background: tone.bg, color: tone.fg, borderRadius: 20, padding: '3px 11px', fontSize: 11, fontWeight: 900 }}>{tone.t}</span>
                {it.companies?.company_name && (
                  <span style={{ fontSize: 12, color: '#1A3D34', fontWeight: 800 }}>{it.companies.company_name}</span>
                )}
                <span style={{ fontSize: 11.5, color: '#9DB3AB', marginInlineStart: 'auto' }}>{fmt(it.created_at)}</span>
                {/* ★ كان الزرّ ✕ رماديّاً باهتاً (#C2CFCA) بلا خلفية ولا إطار،
                      فلم يره المالكُ أصلاً وقال: «وأمّا الحذف فلا أعرف».
                      وزرٌّ لا يُرى زرٌّ غير موجود — مهما كان الخادم خلفه سليماً.
                      فصار كلمةً مقروءةً في إطارٍ ظاهر، ويحمرّ عند طلب التأكيد. */}
                <button
                  onClick={() => remove(it)}
                  disabled={busy === it.id}
                  aria-label="حذف البند"
                  style={{
                    background: asking ? '#FDF1F1' : '#F7FAF9',
                    border: '1px solid ' + (asking ? '#E9BFBB' : '#DFEAE5'),
                    color: asking ? '#B4342A' : '#7E938C',
                    borderRadius: 20, padding: '5px 13px',
                    cursor: 'pointer', fontFamily: 'Cairo', fontSize: 11.5, fontWeight: 800, lineHeight: 1,
                  }}>
                  {busy === it.id ? '…' : asking ? 'تأكيد الحذف' : '✕ حذف'}
                </button>
              </div>

              <div style={{ fontSize: 15.5, fontWeight: 900, color: '#1A3D34', lineHeight: 1.7 }}>{it.title}</div>
              {it.detail && <div style={{ fontSize: 13.5, color: '#3E534C', lineHeight: 1.95, marginTop: 7, whiteSpace: 'pre-wrap' }}>{it.detail}</div>}

              {done ? (
                <div style={{ marginTop: 10, fontSize: 13, color: '#1E7A5E', fontWeight: 800 }}>
                  ✓ {it.options.find(o => o.key === it.answer_key)?.label || it.answer_key}
                  {it.answer_value ? ' — ' + it.answer_value : ''}
                </div>
              ) : (
                <>
                  {it.value_label && (
                    <div style={{ marginTop: 12 }}>
                      <label style={{ fontSize: 12, fontWeight: 800, color: '#1A3D34', display: 'block', marginBottom: 5 }}>{it.value_label}</label>
                      <input
                        inputMode="decimal"
                        value={vals[it.id] || ''}
                        placeholder={it.value_hint || ''}
                        onChange={e => setVals(v => ({ ...v, [it.id]: e.target.value }))}
                        style={{ width: '100%', maxWidth: 220, padding: '11px 13px', borderRadius: 10, border: '1.5px solid #E8F5EF', fontFamily: 'Cairo', fontSize: 15, fontWeight: 800 }}
                      />
                    </div>
                  )}
                  <input
                    value={notes[it.id] || ''}
                    placeholder="ملاحظة لي (اختياري)"
                    onChange={e => setNotes(n => ({ ...n, [it.id]: e.target.value }))}
                    style={{ width: '100%', marginTop: 10, padding: '9px 12px', borderRadius: 10, border: '1.5px solid #F0F5F3', fontFamily: 'Cairo', fontSize: 12.5 }}
                  />
                  <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                    {it.options.map((o, i) => (
                      <button key={o.key} disabled={busy === it.id} onClick={() => answer(it, o.key)}
                        style={{
                          flex: '1 1 120px', padding: '13px 18px', borderRadius: 999, cursor: 'pointer',
                          fontFamily: 'Cairo', fontWeight: 900, fontSize: 14,
                          background: i === 0 ? '#2E9E7B' : '#fff',
                          color: i === 0 ? '#fff' : '#6B8A80',
                          border: i === 0 ? 'none' : '1.5px solid #E8F5EF',
                        }}>{busy === it.id ? '…' : o.label}</button>
                    ))}
                  </div>
                </>
              )}
            </div>
          );
        })}
    </div>
  );
}
