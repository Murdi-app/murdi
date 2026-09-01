'use client';
import { useEffect, useState, useCallback } from 'react';
import AdminNav from '@/components/AdminNav';

// لوحة الصفقة — الشاشة التي تقول أين وقف كل ملف، لا كيف قُيّم.
// التقييم كان يعيش في المنصة، والإيصال إلى الممول كان يعيش في صندوق بريد.
// هنا يجتمعان: خطّ زمني واحد، ومن خوطب، ومن سكت، ومن نعرفه هناك.

type Ev = {
  at: string; kind: string; entity_name: string | null;
  title: string; detail: string | null; actor: string; needs_owner: boolean;
};
type Contact = {
  entity_name: string; person_name: string | null; role_title: string | null;
  email: string | null; phone: string | null; replies_count: number; note: string | null;
};
type Out = {
  entity_name: string; entity_email: string | null; status: string;
  reply_status: string | null; sent_at: string | null; reply_at: string | null;
  next_followup_at: string | null; reply_received: string | null; silent_days: number | null;
};
type Co = { id: string; company_name: string; account_status: string | null };

const C = {
  ink: '#12302A', gray: '#6B8A80', line: '#E4EFEA', soft: '#F7FAF9',
  green: '#1A6B52', amber: '#8A6A1E', red: '#B4622A',
};

const TONE: Record<string, string> = {
  contract_signed: C.green, outreach_reply: C.green, payment: C.green,
  approval: C.amber, outreach_sent: C.gray, match: C.gray,
  declined: C.red, offer: C.green,
};

const fmt = (d: string) =>
  new Date(d).toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' });

export default function DealPage() {
  const [companies, setCompanies] = useState<Co[]>([]);
  const [id, setId] = useState('');
  const [ev, setEv] = useState<Ev[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [out, setOut] = useState<Out[]>([]);
  const [stats, setStats] = useState({ approached: 0, replied: 0, overdue: 0 });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (cid: string) => {
    setLoading(true); setErr('');
    const r = await fetch('/api/admin/deal' + (cid ? '?company_id=' + cid : ''));
    const d = await r.json();
    setLoading(false);
    if (!r.ok) { setErr(d.error || 'تعذّر التحميل'); return; }
    setCompanies(d.companies || []);
    if (cid) {
      setEv(d.timeline || []); setContacts(d.contacts || []);
      setOut(d.outreach || []); setStats(d.stats || { approached: 0, replied: 0, overdue: 0 });
    }
  }, []);

  useEffect(() => { load(id); }, [load, id]);

  const addNote = async () => {
    if (!id || !note.trim()) return;
    setSaving(true);
    await fetch('/api/admin/deal', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company_id: id, kind: 'note', title: note.trim() }),
    });
    setSaving(false); setNote(''); load(id);
  };

  const card: React.CSSProperties = {
    background: '#fff', border: '1px solid ' + C.line, borderRadius: 14,
    padding: '15px 17px', marginBottom: 12,
  };

  return (
    <div dir="rtl" style={{ fontFamily: 'Cairo,sans-serif', maxWidth: 900, margin: '0 auto', padding: '26px 16px', background: '#FBFCFB', minHeight: '100vh' }}>
      <AdminNav />
      <h1 style={{ color: C.ink, fontSize: 23, fontWeight: 900, margin: 0 }}>🧭 لوحة الصفقة</h1>
      <p style={{ color: C.gray, fontSize: 12.8, marginTop: 5, marginBottom: 16, lineHeight: 1.9 }}>
        أين وقف كل ملف: من خوطب، ومن ردّ، ومن سكت، ومن نعرفه هناك.
      </p>

      <select
        value={id} onChange={(e) => setId(e.target.value)}
        style={{ width: '100%', maxWidth: 380, padding: '11px 13px', borderRadius: 10, border: '1.5px solid ' + C.line, fontFamily: 'Cairo', fontSize: 14, fontWeight: 800, marginBottom: 16, background: '#fff' }}
      >
        <option value="">— اختر المنشأة —</option>
        {companies.map((c) => <option key={c.id} value={c.id}>{c.company_name}</option>)}
      </select>

      {err && <div style={{ background: '#FDF1F1', border: '1.5px solid #F2D4D4', color: '#B4342A', borderRadius: 12, padding: '11px 15px', marginBottom: 14, fontSize: 13, fontWeight: 700 }}>{err}</div>}

      {!id ? (
        <div style={{ ...card, textAlign: 'center', color: C.gray, fontSize: 13.5, padding: 32 }}>
          اختر منشأة لترى خطّ صفقتها.
        </div>
      ) : loading ? (
        <div style={{ color: '#9DB3AB', textAlign: 'center', padding: 36 }}>جارٍ التحميل…</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 9, marginBottom: 14 }}>
            {([['جهة خوطبت', stats.approached, C.ink],
               ['ردّت', stats.replied, C.green],
               ['تجاوزت المعاودة', stats.overdue, stats.overdue ? C.red : C.gray]] as const).map(([l, v, col]) => (
              <div key={l} style={{ background: C.soft, border: '1px solid ' + C.line, borderRadius: 11, padding: '11px 13px' }}>
                <div style={{ fontSize: 20, fontWeight: 900, color: col }}>{v}</div>
                <div style={{ fontSize: 11.5, color: C.gray, fontWeight: 700 }}>{l}</div>
              </div>
            ))}
          </div>

          <a href={'/api/admin/credit-memo?company_id=' + id} target="_blank" rel="noreferrer"
            style={{ display: 'inline-block', background: C.ink, color: '#fff', borderRadius: 10, padding: '11px 18px', fontSize: 13.5, fontWeight: 900, textDecoration: 'none', marginBottom: 16 }}>
            📄 ولّد ملف غرض التمويل
          </a>

          {/* من سكت — أهم قائمة في الشاشة */}
          {out.some((o) => !o.reply_at) && (
            <div style={card}>
              <div style={{ fontSize: 14.5, fontWeight: 900, color: C.ink, marginBottom: 9 }}>من لم يردّ بعد</div>
              {out.filter((o) => !o.reply_at).map((o, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '7px 0', borderBottom: '1px solid #F1F6F4', fontSize: 12.8, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 800, color: C.ink }}>{o.entity_name}</span>
                  <span style={{ color: o.silent_days !== null && o.silent_days >= 4 ? C.red : C.gray, fontWeight: 700 }}>
                    {o.silent_days === null ? '—' : 'صامتة منذ ' + o.silent_days + ' يوم'}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* من ردّ */}
          {out.some((o) => o.reply_at) && (
            <div style={card}>
              <div style={{ fontSize: 14.5, fontWeight: 900, color: C.green, marginBottom: 9 }}>من ردّ</div>
              {out.filter((o) => o.reply_at).map((o, i) => (
                <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid #F1F6F4' }}>
                  <div style={{ fontSize: 13, fontWeight: 900, color: C.ink }}>{o.entity_name}</div>
                  {o.reply_received && <div style={{ fontSize: 12.5, color: '#33544B', lineHeight: 1.9, marginTop: 3 }}>{o.reply_received}</div>}
                </div>
              ))}
            </div>
          )}

          {/* دفتر الأسماء */}
          <div style={card}>
            <div style={{ fontSize: 14.5, fontWeight: 900, color: C.ink, marginBottom: 4 }}>📇 دفتر الأسماء</div>
            <div style={{ fontSize: 11.5, color: C.gray, marginBottom: 9, lineHeight: 1.8 }}>
              يتراكم من كل ردّ ومكالمة. وبه تصير الصفقة الثانية أسرع من الأولى.
            </div>
            {contacts.length === 0 ? (
              <div style={{ color: C.gray, fontSize: 12.5 }}>لم يُسجّل أحد بعد.</div>
            ) : contacts.map((c, i) => (
              <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid #F1F6F4', fontSize: 12.8 }}>
                <div style={{ fontWeight: 900, color: C.ink }}>
                  {c.person_name || '—'} <span style={{ fontWeight: 700, color: C.gray }}>· {c.entity_name}</span>
                </div>
                <div style={{ color: C.gray, marginTop: 2 }}>
                  {[c.role_title, c.email, c.phone].filter(Boolean).join(' · ')}
                  {c.replies_count > 1 ? ` · ${c.replies_count} تواصل` : ''}
                </div>
              </div>
            ))}
          </div>

          {/* الخطّ الزمني */}
          <div style={card}>
            <div style={{ fontSize: 14.5, fontWeight: 900, color: C.ink, marginBottom: 10 }}>الخطّ الزمني</div>
            {ev.map((e, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, paddingBottom: 12 }}>
                <div style={{ flex: '0 0 52px', fontSize: 11, color: C.gray, fontWeight: 700, paddingTop: 2 }}>{fmt(e.at)}</div>
                <div style={{ flex: '0 0 8px', paddingTop: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 4, background: TONE[e.kind] || C.line }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: C.ink, lineHeight: 1.7 }}>{e.title}</div>
                  {e.entity_name && <div style={{ fontSize: 11.5, color: C.gray }}>{e.entity_name}</div>}
                  {e.detail && <div style={{ fontSize: 12, color: '#4E6B62', lineHeight: 1.85, marginTop: 2 }}>{e.detail}</div>}
                </div>
              </div>
            ))}
          </div>

          {/* تسجيل ما يقع خارج المنصة */}
          <div style={card}>
            <div style={{ fontSize: 13.5, fontWeight: 900, color: C.ink, marginBottom: 7 }}>سجّل ما وقع خارج المنصة</div>
            <input
              value={note} onChange={(e) => setNote(e.target.value)}
              placeholder="مثال: كلّمت مدير العلاقات في الأهلي — طلب كشف ١٢ شهراً"
              style={{ width: '100%', padding: '11px 13px', borderRadius: 10, border: '1.5px solid ' + C.line, fontFamily: 'Cairo', fontSize: 13 }}
            />
            <button onClick={addNote} disabled={saving || !note.trim()}
              style={{ marginTop: 9, background: C.ink, color: '#fff', border: 'none', borderRadius: 999, padding: '10px 22px', fontFamily: 'Cairo', fontWeight: 900, fontSize: 13, cursor: 'pointer', opacity: saving || !note.trim() ? 0.5 : 1 }}>
              {saving ? '…' : 'أضف إلى الخطّ'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
