'use client';
import AdminNav from '@/components/AdminNav';
import { useState, useEffect } from 'react';

type Row = {
  id: string; company_id: string; company_name: string; track: string;
  provider: string; product: string | null; fit_score: number | null;
  apply_channel: string | null; apply_url: string | null; apply_steps: string | null;
  required_docs: string | null; apply_status: string | null; apply_note: string | null;
  verdict?: string | null; region?: string | null;
  requirements?: string | null;
  evidence_grade?: string | null; gulf_presence?: string | null;
  link_status?: string | null;
  incomplete?: boolean; file_ready?: boolean; contract_ok?: boolean;
};

type Draft = {
  id: string; subject: string; body: string; email: string | null; language: string;
  contactMethod: string | null; altContact: string | null; emailConfidence: string | null;
  sent?: boolean;
};

const C = { ink: '#1A3D34', gold: '#C9A84C', green: '#2E9E7B', gray: '#6B8A80', mint: '#E8F5EF' };
const STATES = ['لم يُقدَّم', 'قيد التقديم', 'قُدِّم', 'ردّت'];
const PRODUCTS = [
  { id: 'liq', label: 'سيولة', re: 'تورق|تورّق|رأس مال عامل|مرابحة نقدية|تمويل نقدي|قرض مباشر|working capital|term loan|cash' },
  { id: 'inv', label: 'فواتير', re: 'فواتير|فاتورة|مستخلص|factoring|receivable|discount' },
  { id: 'veh', label: 'مركبات ومعدات', re: 'مركبات|أسطول|إجارة|معدات|آلات|fleet|equipment|leas|vehicle|auto' },
  { id: 're', label: 'عقار', re: 'عقار|رهن|mortgage|home equity|real estate|بيع وإعادة' },
  { id: 'prj', label: 'عقود ومشاريع', re: 'مشاريع|مشروع|عقود|أوامر شراء|contract|project|purchase order' },
  { id: 'lc', label: 'اعتمادات وضمانات', re: 'اعتماد|خطاب ضمان|letter of credit|guarantee|كفالة' },
  { id: 'scf', label: 'موردين', re: 'تمويل موردي|موردّي|supplier finance|supply chain|سلاسل الإمداد|reverse factoring|payables|early payment|taulia' },
];

const norm = (s?: string | null) => {
  const v = (s || 'لم يُقدَّم').trim();
  return v === 'قُدِم' ? 'قُدِّم' : v;
};

// «متأهل» قبل «متأهل بشرط» — الأخيرة تحتاج إغلاق عائق قبل التقديم
// سلّم القرب: الدليل المؤكّد قبل المرجّح قبل ما يحتاج تحققاً
const lk = (s?: string | null) => { const x = String(s || ''); return x === '\u064a\u0639\u0645\u0644' ? 0 : x === '\u0645\u062d\u062c\u0648\u0628 \u0622\u0644\u064a\u0627\u064b' ? 1 : x ? 2 : 1; };
const ev = (g?: string | null) => { const t = String(g || ''); return t.includes('\u0645\u0624\u0643') ? 0 : t.includes('\u0645\u0631\u062c') ? 1 : t ? 2 : 3; };
const tier = (v?: string | null) => /بشرط/.test(String(v || '')) ? 1 : 0;

const NEEDS: { rx: string; label: string; svc: string }[] = [
  { rx: 'ضمان|رهن|كفالة', label: 'ضمانات ورهن', svc: 'ملف الضمانات والرهن' },
  { rx: 'مدقق|مراجع', label: 'قوائم مدققة', svc: 'إعداد القوائم المالية' },
  { rx: 'فاتور|ذمم|عقود', label: 'فواتير وعقود', svc: 'دورة الفوترة وملف الذمم' },
  { rx: 'جدوى|خطة عمل|تدفق', label: 'جدوى وخطة عمل', svc: 'دراسة الجدوى الاقتصادية' },
  { rx: 'حوكمة|مجلس إدارة', label: 'حوكمة', svc: 'بناء الحوكمة المؤسسية' },
  { rx: 'تعثر|متعثر|سمة|جدولة', label: 'سجل ائتماني', svc: 'إعادة جدولة الديون' },
];

export default function ApplyPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [co, setCo] = useState('');
  const [st, setSt] = useState('');
  const [busy, setBusy] = useState('');
  const [genBusy, setGenBusy] = useState('');
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [genErr, setGenErr] = useState<Record<string, string>>({});
  const [q, setQ] = useState('');
  const [showWeak, setShowWeak] = useState(true);
  const [okRisk, setOkRisk] = useState<Record<string, boolean>>({});
  const [editRow, setEditRow] = useState('');
  const [eEmail, setEEmail] = useState('');
  const [eBody, setEBody] = useState('');
  const [collapse, setCollapse] = useState(true);
  const [role, setRole] = useState('admin');
  const [prod, setProd] = useState('');
  const [need, setNeed] = useState('');
  type DueFU = { id: string; company_id: string; entity_name: string; entity_language: string; followup_stage: number; last_sent_at: string | null };
  const [due, setDue] = useState<DueFU[]>([]);
  const [fuMsg, setFuMsg] = useState('');

  const load = () => fetch('/api/admin/apply').then(r => r.json()).then(d => {
    const rs = d.rows || [];
    setRows(rs);
    if (d.role) setRole(String(d.role));
    const dr: Record<string, Draft> = {};
    for (const r of rs) {
      const m = r.draft;
      if (!m || !m.id) continue;
      dr[r.id] = {
        id: String(m.id),
        subject: String(m.subject || ''),
        body: String(m.admin_edited_body || m.message_body || ''),
        email: m.entity_email || null,
        language: '',
        contactMethod: m.contact_method || null,
        altContact: m.alt_contact || null,
        emailConfidence: null,
        sent: String(m.status || '').replace(/[\u064B-\u0652]/g, '') === 'مرسلة' || !!m.sent_at || !!m.last_sent_at,
      };
    }
    setDrafts(dr);
  }).catch(() => {});
  useEffect(() => { load(); fetch('/api/admin/outreach/followups').then(r => r.json()).then(d => setDue(d.due || [])).catch(() => {}); }, []);

  async function sendFU(item: DueFU) {
    setFuMsg('جارٍ إرسال المتابعة لـ ' + item.entity_name + '\u2026');
    const r = await fetch('/api/admin/outreach/followups', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item.id, company_name: '' }) });
    if (r.ok) { setFuMsg('\u2705 أُرسلت المتابعة لـ ' + item.entity_name); setDue(p => p.filter(x => x.id !== item.id)); }
    else { setFuMsg('تعذّر الإرسال لـ ' + item.entity_name); }
  }

  async function setStatus(id: string, s: string) {
    setBusy(id);
    await fetch('/api/admin/apply', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, apply_status: s }) });
    setRows(p => p.map(r => r.id === id ? { ...r, apply_status: s } : r));
    setBusy('');
  }

  async function genOutreach(r: Row) {
    setGenBusy(r.id);
    setGenErr(p => ({ ...p, [r.id]: '' }));
    try {
      const res = await fetch('/api/admin/outreach/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rowId: r.id }),
      });
      const d = await res.json();
      if (!res.ok || !d.ok) throw new Error(d.error || 'تعذّر التوليد');
      setDrafts(p => ({ ...p, [r.id]: {
        id: String(d.message?.id || ''),
        subject: d.subject || '', body: d.body || '', email: d.email || null,
        language: d.language || 'عربي', contactMethod: d.contactMethod || null,
        altContact: d.altContact || null, emailConfidence: d.emailConfidence || null,
      } }));
    } catch (e) {
      setGenErr(p => ({ ...p, [r.id]: e instanceof Error ? e.message : 'تعذّر التوليد' }));
    }
    setGenBusy('');
  }

  async function sendOne(r: Row, msgId: string) {
    if (!confirm('إرسال الرسالة إلى ' + r.provider + '؟')) return;
    setGenBusy(r.id);
    setGenErr(p => ({ ...p, [r.id]: '' }));
    try {
      const res = await fetch('/api/admin/outreach/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: r.company_id, ids: [msgId] }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'تعذّر الإرسال');
      setDrafts(p => ({ ...p, [r.id]: { ...p[r.id], sent: true } }));
    } catch (e) {
      setGenErr(p => ({ ...p, [r.id]: e instanceof Error ? e.message : 'تعذّر الإرسال' }));
    }
    setGenBusy('');
  }

  async function saveEdit(r: Row, msgId: string) {
    setGenBusy(r.id);
    try {
      const res = await fetch('/api/admin/outreach/manage', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: msgId, action: 'update', message_body: eBody, entity_email: eEmail }),
      });
      if (!res.ok) throw new Error('save');
      setDrafts(p => ({ ...p, [r.id]: { ...p[r.id], body: eBody, email: eEmail } }));
      setEditRow('');
    } catch { setGenErr(p => ({ ...p, [r.id]: 'تعذّر حفظ التعديل' })); }
    setGenBusy('');
  }

  async function enrich(r: Row) {
    setBusy(r.id);
    await fetch('/api/match/enrich', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ track: r.track, rowId: r.id }) });
    await load();
    setBusy('');
    setTimeout(() => { document.getElementById('row-' + r.id)?.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, 150);
  }

  const cos = Array.from(new Set(rows.map(r => r.company_name).filter(Boolean)));
  const qq = q.trim().toLowerCase();
  const TOKS = (s?: string | null) => {
    const stop = ['تمويل','للشركات','للمنشآت','الصغيرة','والمتوسطة','المنشآت','الشركات','برنامج','عبر','مع','من','على','في','الأعمال'];
    return new Set(String(s || '').replace(/[^\u0621-\u064A ]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !stop.includes(w)));
  };
  const JAC = (a: Set<string>, b: Set<string>) => {
    if (!a.size || !b.size) return 0;
    let i = 0; a.forEach(x => { if (b.has(x)) i++; });
    return i / (a.size + b.size - i);
  };
  const _seen: { p: string; t: Set<string> }[] = [];
  const shown = rows.filter(r => (!co || r.company_name === co) && (!st || norm(r.apply_status) === st) && (!qq || [r.provider, r.product, r.company_name, r.apply_channel].some(v => String(v || '').toLowerCase().includes(qq))) && (!showWeak || (r.fit_score || 0) >= 20) && (!need || new RegExp(need).test(String(r.requirements || '') + ' ' + String(r.required_docs || ''))) && (!prod || new RegExp(prod, 'i').test(String(r.product || '') + ' ' + String(r.requirements || ''))))
    .sort((a, b) => ((norm(a.apply_status) === 'قُدِّم' ? 1 : 0) - (norm(b.apply_status) === 'قُدِّم' ? 1 : 0)) || (tier(a.verdict) - tier(b.verdict)) || (ev(a.evidence_grade) - ev(b.evidence_grade)) || (lk(a.link_status) - lk(b.link_status)) || ((b.fit_score || 0) - (a.fit_score || 0)))
    .filter((r) => {
      if (!collapse) return true;
      const t = TOKS(r.product);
      if (_seen.some(k => k.p === r.provider && JAC(k.t, t) >= 0.6)) return false;
      _seen.push({ p: r.provider, t });
      return true;
    });
  const count = (s: string) => rows.filter(r => norm(r.apply_status) === s).length;
  const weakCount = rows.filter(r => (r.fit_score || 0) >= 20).length;
  const RISKY = /حساب\s+(لدى|في)\s|موثّق|موثقة|سبق\s+(أن|له)|علاقة\s+مسبقة|عميل\s+لديكم/;

  return (
    <div dir="rtl" style={{ fontFamily: 'Cairo, sans-serif', background: '#FBFCFB', minHeight: '100vh' }}>
      <AdminNav />
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 16px' }}>
        <h1 style={{ color: C.ink, fontWeight: 900, fontSize: 24, marginBottom: 6 }}>لوحة التقديم</h1>
        <p style={{ color: C.gray, fontWeight: 700, fontSize: 13, marginBottom: 18 }}>كل جهة مطابَقة وطريق التقديم عليها — ابدأ من الأعلى.</p>

        {due.length > 0 && (
          <div style={{ background: '#FBF5E8', border: '1.5px solid #EAD9A8', borderRadius: 16, padding: 16, marginBottom: 16 }}>
            <div style={{ color: '#6B5A2E', fontWeight: 900, fontSize: 13.5, marginBottom: 10 }}>متابعات مستحقة اليوم: {due.length}</div>
            {due.map(x => (
              <div key={x.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '7px 0', borderTop: '1px solid #EFE3C8' }}>
                <span style={{ color: C.ink, fontWeight: 800, fontSize: 12.5 }}>{x.entity_name} · المتابعة {x.followup_stage === 0 ? 'الأولى' : 'الأخيرة'}</span>
                <button onClick={() => sendFU(x)} style={{ background: C.gold, color: C.ink, border: 'none', borderRadius: 20, padding: '6px 16px', fontFamily: 'Cairo', fontWeight: 900, fontSize: 11.5, cursor: 'pointer' }}>أرسل المتابعة</button>
              </div>
            ))}
            {fuMsg && <div style={{ color: '#6B5A2E', fontWeight: 800, fontSize: 12, marginTop: 8 }}>{fuMsg}</div>}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {PRODUCTS.map(p => {
            const n = rows.filter(r => new RegExp(p.re, 'i').test(String(r.product || '') + ' ' + String(r.requirements || ''))).length;
            if (!n) return null;
            return (
              <button key={p.id} onClick={() => setProd(prod === p.re ? '' : p.re)}
                style={{ background: prod === p.re ? C.gold : '#fff', color: C.ink, border: '1.5px solid ' + C.mint, borderRadius: 30, padding: '7px 14px', fontFamily: 'Cairo', fontWeight: 900, fontSize: 12, cursor: 'pointer' }}>
                {p.label} ({n})
              </button>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
          {STATES.map(s => (
            <button key={s} onClick={() => setSt(st === s ? '' : s)}
              style={{ background: st === s ? C.ink : '#fff', color: st === s ? '#fff' : C.ink, border: '1.5px solid ' + C.mint, borderRadius: 30, padding: '8px 16px', fontFamily: 'Cairo', fontWeight: 900, fontSize: 12.5, cursor: 'pointer' }}>
              {s} ({count(s)})
            </button>
          ))}
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="ابحث باسم الجهة أو المنتج…"
            style={{ border: '1.5px solid ' + C.mint, borderRadius: 30, padding: '8px 16px', fontFamily: 'Cairo', fontWeight: 700, fontSize: 12.5, minWidth: 220 }} />
          <button onClick={() => setCollapse(v => !v)}
            style={{ background: collapse ? C.ink : '#fff', color: collapse ? '#fff' : C.gray, border: '1.5px solid ' + C.mint, borderRadius: 30, padding: '8px 16px', fontFamily: 'Cairo', fontWeight: 900, fontSize: 12.5, cursor: 'pointer' }}>
            {collapse ? 'طيّ المتشابه' : 'اعرض المتشابهة'}
          </button>
          <button onClick={() => setShowWeak(v => !v)}
            style={{ background: showWeak ? C.ink : '#fff', color: showWeak ? '#fff' : C.gray, border: '1.5px solid ' + C.mint, borderRadius: 30, padding: '8px 16px', fontFamily: 'Cairo', fontWeight: 900, fontSize: 12.5, cursor: 'pointer' }}>
            {showWeak ? 'اعرض الكل' : 'الأقوى فقط (' + weakCount + ')'}
          </button>
          <select value={co} onChange={e => setCo(e.target.value)}
            style={{ border: '1.5px solid ' + C.mint, borderRadius: 30, padding: '8px 14px', fontFamily: 'Cairo', fontWeight: 700, fontSize: 12.5 }}>
            <option value="">كل العملاء</option>
            {cos.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {(() => {
          const src = rows.filter(r => (!co || r.company_name === co));
          const txt = (r: Row) => String(r.requirements || '') + ' ' + String(r.required_docs || '');
          const counts = NEEDS.map(n => ({ ...n, count: src.filter(r => new RegExp(n.rx).test(txt(r))).length })).filter(x => x.count > 0).sort((a, b) => b.count - a.count);
          if (counts.length === 0) return null;
          return (
            <div style={{ background: '#FBF5E8', border: '1.5px solid #EAD9A8', borderRadius: 16, padding: 14, marginBottom: 16 }}>
              <div style={{ color: '#6B5A2E', fontWeight: 900, fontSize: 13, marginBottom: 8 }}>ما تطلبه الجهات — اضغط لتصفية الصفوف</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {counts.map(x => (
                  <button key={x.label} onClick={() => setNeed(need === x.rx ? '' : x.rx)}
                    style={{ background: need === x.rx ? C.ink : '#fff', color: need === x.rx ? '#fff' : '#6B5A2E', border: '1.5px solid #EAD9A8', borderRadius: 20, padding: '6px 14px', fontFamily: 'Cairo', fontWeight: 900, fontSize: 12, cursor: 'pointer' }}>
                    {x.label} ({x.count}) — {x.svc}
                  </button>
                ))}
              </div>
            </div>
          );
        })()}
        {shown.map(r => {
          const d = drafts[r.id];
          const portal = Boolean(r.apply_url);
          const unverified = !/السعود|خليج/.test(String(r.region || '')) && !r.apply_url;
          const riskNote = !d ? '' : (unverified ? 'جهة دولية بلا بوابة تقديم يمكن التحقق منها — أكّد وجودها قبل الإرسال' : RISKY.test(String(d.body || '')) ? 'الرسالة تنسب للعميل واقعة غير موجودة في سجله — راجعها قبل الإرسال' : ((d.emailConfidence && d.emailConfidence !== 'مؤكّد') ? 'بريد الجهة غير مؤكّد — تحقّق من وجود الجهة وعنوانها قبل الإرسال' : ''));
          return (
          <div key={r.id} id={'row-' + r.id} style={{ background: '#fff', border: '1.5px solid ' + C.mint, borderRadius: 18, padding: 18, marginBottom: 12, opacity: norm(r.apply_status) === 'قُدِّم' ? 0.7 : 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
              <div>
                <div style={{ color: C.ink, fontWeight: 900, fontSize: 15 }}>{r.provider}</div>
                <div style={{ color: C.gray, fontWeight: 700, fontSize: 12.5, marginTop: 2 }}>{r.product}</div>
                <div style={{ color: C.gold, fontWeight: 900, fontSize: 11.5, marginTop: 4 }}>{r.company_name} · {r.track === 'funding' ? 'تمويل' : 'استثمار'} · {r.fit_score}{r.region ? ' · ' + r.region : ''}</div>
                {r.verdict && <div style={{ marginTop: 4 }}><span style={{ background: /بشرط/.test(String(r.verdict)) ? '#FBF5E8' : C.mint, color: /بشرط/.test(String(r.verdict)) ? '#8A6D1A' : C.ink, borderRadius: 20, padding: '3px 11px', fontWeight: 900, fontSize: 11 }}>{r.verdict}</span></div>}
                {r.incomplete && <div style={{ color: '#C0392B', fontWeight: 900, fontSize: 11, marginTop: 3 }}>{'\u26A0 مطابقة هذا العميل لم تكتمل'}</div>}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                {STATES.map(s => (
                  <button key={s} disabled={busy === r.id} onClick={() => setStatus(r.id, s)}
                    style={{ background: norm(r.apply_status) === s ? C.green : '#fff', color: norm(r.apply_status) === s ? '#fff' : C.gray, border: '1.5px solid ' + C.mint, borderRadius: 20, padding: '5px 11px', fontFamily: 'Cairo', fontWeight: 900, fontSize: 11, cursor: 'pointer' }}>{s}</button>
                ))}
              </div>
            </div>

            <div style={{ background: '#F7FBF9', borderRadius: 12, padding: 12, marginTop: 8 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
                <span style={{ background: portal ? C.mint : '#FBF5E8', color: portal ? C.ink : '#8A6D1A', borderRadius: 20, padding: '3px 11px', fontWeight: 900, fontSize: 11 }}>
                  {portal ? 'بوابة — قدّم مباشرة' : 'بلا بوابة — خاطب أولاً'}
                </span>
                <span style={{ color: C.ink, fontWeight: 900, fontSize: 12.5 }}>القناة: {r.apply_channel || 'غير محددة'}</span>
              </div>
              {r.apply_url && <a href={r.apply_url} target="_blank" rel="noopener noreferrer" style={{ color: C.green, fontWeight: 900, fontSize: 12, textDecoration: 'underline' }}>{'افتح صفحة التقديم \u2190'}</a>}
              {r.apply_steps && <div style={{ color: C.ink, fontWeight: 700, fontSize: 12.5, marginTop: 8, whiteSpace: 'pre-wrap', lineHeight: 1.9 }}>{r.apply_steps}</div>}
              {r.required_docs && <div style={{ color: C.gray, fontWeight: 700, fontSize: 12, marginTop: 8, lineHeight: 1.8 }}>المستندات: {r.required_docs}</div>}

              <div style={{ marginTop: 10, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', fontSize: 11.5, fontWeight: 900 }}>
                {(() => {
                  const t = String(r.requirements || '') + ' ' + String(r.required_docs || '');
                  const hits = NEEDS.filter(n => new RegExp(n.rx).test(t)).slice(0, 3);
                  const mm = t.match(/(?:حد أدنى|الحد الأدنى|الصفقة الدنيا)[^0-9]{0,25}([\d.]+)\s*(?:م|مليون)\s*(دولار|ريال)?/);
                  const big = mm ? Math.round(parseFloat(mm[1]) * ((mm[2] || 'دولار') === 'دولار' ? 3.75 : 1)) : 0;
                  return (
                    <>
                      {hits.map(n => (
                        <span key={n.label} title={'خدمة: ' + n.svc} style={{ background: '#F7F1DF', color: '#8A6D1A', borderRadius: 20, padding: '2px 10px', fontSize: 11 }}>
                          {'\u062a\u0637\u0644\u0628: ' + n.label}
                        </span>
                      ))}
                      {big > 0 && (
                        <span title="هذه الجهة تناسب عميلاً بحجم أكبر — احتفظ بها" style={{ background: '#FBE9E7', color: '#C0392B', borderRadius: 20, padding: '2px 10px', fontSize: 11 }}>
                          {'\u062d\u062f \u0623\u062f\u0646\u0649 ~' + big + '\u0645'}
                        </span>
                      )}
                    </>
                  );
                })()}
                {r.evidence_grade && (
                  <span title={r.gulf_presence || ''} style={{ background: r.evidence_grade.indexOf('\u0645\u0624\u0643') === 0 ? '#E8F5EF' : r.evidence_grade.indexOf('\u0645\u0631\u062c') === 0 ? '#F7F1DF' : '#FBE9E7', color: r.evidence_grade.indexOf('\u0645\u0624\u0643') === 0 ? C.ink : r.evidence_grade.indexOf('\u0645\u0631\u062c') === 0 ? '#8A6D1A' : '#C0392B', borderRadius: 20, padding: '2px 10px', fontSize: 11 }}>
                    {'\u0631\u0627\u0628\u0637 \u0627\u0644\u062c\u0647\u0629: ' + r.evidence_grade + (r.link_status ? ' \u00b7 ' + r.link_status : '')}
                  </span>
                )}
                <span style={{ color: r.file_ready ? C.green : '#C0392B' }}>{r.file_ready ? '\u2713 الملف جاهز' : '\u2715 الملف غير جاهز'}</span>
                <span style={{ color: r.contract_ok ? C.green : '#C0392B' }}>{r.contract_ok ? '\u2713 العقد موقّع' : '\u2715 لا يوجد عقد'}</span>
                {!r.apply_channel && (
                  <button onClick={() => enrich(r)} disabled={busy === r.id}
                    style={{ background: 'none', border: 'none', color: C.green, fontFamily: 'Cairo', fontWeight: 900, fontSize: 11.5, textDecoration: 'underline', cursor: busy === r.id ? 'wait' : 'pointer', padding: 0 }}>
                    {busy === r.id ? '\u23F3 جارٍ التجهيز… قد يستغرق دقيقتين' : 'جهّز طريق التقديم'}
                  </button>
                )}
                <a href={'/admin/services?company_id=' + r.company_id} style={{ color: C.gold, textDecoration: 'underline' }}>{'خدمات العميل \u2190'}</a>
              </div>

              <div style={{ marginTop: 12, borderTop: '1px solid ' + C.mint, paddingTop: 10 }}>
                <button onClick={() => genOutreach(r)} disabled={genBusy === r.id}
                  style={{ background: genBusy === r.id ? C.gray : C.ink, color: '#fff', border: 'none', borderRadius: 20, padding: '7px 18px', fontFamily: 'Cairo', fontWeight: 900, fontSize: 12, cursor: genBusy === r.id ? 'wait' : 'pointer' }}>
                  {genBusy === r.id ? '\u23F3 جارٍ توليد المخاطبة…' : (d ? '\u21BB أعد توليد المخاطبة' : '\u2709 جهّز مخاطبة هذه الجهة')}
                </button>
                {genErr[r.id] && <div style={{ color: '#C0392B', fontWeight: 800, fontSize: 11.5, marginTop: 6 }}>{genErr[r.id]}</div>}

                {d && (
                  <div style={{ marginTop: 10, background: '#fff', border: '1.5px solid ' + C.mint, borderRadius: 12, padding: 12 }}>
                    <div style={{ fontSize: 11.5, color: C.gray, fontWeight: 800, marginBottom: 6 }}>
                      البريد: {d.email || '—'} · اللغة: {d.language}
                      {d.emailConfidence && d.emailConfidence !== 'مؤكّد' && <span style={{ color: '#C0392B' }}> · الإيميل {d.emailConfidence} — تحقّق قبل الإرسال</span>}
                    </div>
                    {d.altContact && (
                      <div style={{ padding: '6px 10px', background: '#FFF8E6', border: '1px solid #E8D9A8', borderRadius: 8, color: '#8A6D1A', fontSize: 11.5, fontWeight: 700, marginBottom: 8 }}>
                        تواصل بديل ({d.contactMethod || 'أخرى'}): {d.altContact}
                      </div>
                    )}
                    <div style={{ color: C.ink, fontWeight: 900, fontSize: 12.5, marginBottom: 6 }}>{d.subject}</div>
                    {editRow === r.id ? (
                      <div>
                        <input value={eEmail} onChange={e => setEEmail(e.target.value)} placeholder="بريد الجهة"
                          style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1.5px solid ' + C.mint, marginBottom: 8, fontSize: 12.5, fontFamily: 'Cairo' }} />
                        <textarea value={eBody} onChange={e => setEBody(e.target.value)} rows={12}
                          style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid ' + C.mint, fontSize: 12.5, fontFamily: 'Cairo', lineHeight: 1.8 }} />
                      </div>
                    ) : (
                      <div style={{ color: C.ink, fontWeight: 600, fontSize: 12.5, whiteSpace: 'pre-wrap', lineHeight: 1.9, maxHeight: 300, overflowY: 'auto', background: '#F7FBF9', borderRadius: 8, padding: 10 }}>{d.body}</div>
                    )}
                    {riskNote && (
                      <div style={{ marginTop: 10, background: '#FDECEA', border: '1.5px solid #F5B7B1', borderRadius: 10, padding: '8px 12px', color: '#C0392B', fontWeight: 900, fontSize: 11.5 }}>
                        {riskNote}
                        <label style={{ display: 'block', marginTop: 6, fontWeight: 800, cursor: 'pointer' }}>
                          <input type="checkbox" checked={!!okRisk[r.id]} onChange={e => setOkRisk(p => ({ ...p, [r.id]: e.target.checked }))} /> راجعتُها وأتحمّل مسؤوليتها
                        </label>
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                      {editRow === r.id ? (
                        <button onClick={() => saveEdit(r, d.id)} disabled={genBusy === r.id}
                          style={{ background: C.ink, color: '#fff', border: 'none', borderRadius: 20, padding: '6px 16px', fontFamily: 'Cairo', fontWeight: 900, fontSize: 11.5, cursor: 'pointer' }}>احفظ التعديل</button>
                      ) : (
                        <button onClick={() => { setEditRow(r.id); setEEmail(d.email || ''); setEBody(d.body || ''); }}
                          hidden={role !== 'admin'}
                          style={{ background: '#fff', color: C.ink, border: '1.5px solid ' + C.mint, borderRadius: 20, padding: '6px 16px', fontFamily: 'Cairo', fontWeight: 900, fontSize: 11.5, cursor: 'pointer' }}>عدّل البريد والنص</button>
                      )}
                      {d.email && d.id && !d.sent && (
                        <button onClick={() => sendOne(r, d.id)} disabled={genBusy === r.id || (!!riskNote && !okRisk[r.id])}
                          style={{ background: C.green, color: '#fff', border: 'none', borderRadius: 20, padding: '6px 18px', fontFamily: 'Cairo', fontWeight: 900, fontSize: 11.5, cursor: genBusy === r.id ? 'wait' : 'pointer' }}>
                          {genBusy === r.id ? 'جارٍ الإرسال…' : 'أرسل الآن'}
                        </button>
                      )}
                      {d.sent && <span style={{ color: C.green, fontWeight: 900, fontSize: 11.5, alignSelf: 'center' }}>{'\u2713 أُرسلت'}</span>}
                      <button onClick={() => { navigator.clipboard.writeText((d.subject ? d.subject + '\n\n' : '') + d.body); alert('نُسخت الرسالة'); }}
                        style={{ background: C.mint, color: C.ink, border: 'none', borderRadius: 20, padding: '6px 16px', fontFamily: 'Cairo', fontWeight: 900, fontSize: 11.5, cursor: 'pointer' }}>انسخ النص</button>
                      <a href={'/admin/outreach?company_id=' + r.company_id + '&track=' + r.track}
                        style={{ background: C.gold, color: C.ink, borderRadius: 20, padding: '6px 16px', fontWeight: 900, fontSize: 11.5, textDecoration: 'none' }}>{'السجل ←'}</a>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          );
        })}
        {shown.length === 0 && <p style={{ color: C.gray, fontWeight: 700, textAlign: 'center', padding: 30 }}>لا توجد جهات بهذا التصنيف.</p>}
      </div>
    </div>
  );
}
