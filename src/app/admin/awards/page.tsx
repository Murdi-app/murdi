'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import AdminNav from '@/components/AdminNav'

// الترسيات — شاشة المالك وحده (الحارس في التخطيط، والمسار يردّ غيره).
// المحتوى — نصوص الرسائل والحدود — يُقرأ من القاعدة عبر الخادم؛ هذه الصفحة
// تعرضه وتنسخه وتعدّله، ولا تحمل نصّاً منه (المستودع عام).

type Msg = { subject: string; body: string; stage: string; link: string }
type Award = {
  id: string; source: string; company_name: string; cr_number: string | null; tender_title: string | null
  buyer_entity: string | null; category: string; contract_value: number | null; awarded_at: string | null
  track: string | null; decision_maker_name: string | null; decision_maker_role: string | null
  contact_email: string | null; contact_phone: string | null; contact_channel: string | null
  status: string; messaged_at: string | null; reminder_at: string | null; replied_at: string | null
  gap_sent_at: string | null; notes: string | null; created_at: string; updated_at: string
  addressed: boolean; src: string; next: string[]; message: Msg | null; stage: string | null
}
type Template = { id: string; category: string; stage: string; subject: string; context_paragraph: string; active: boolean }

const STATUS: Record<string, string> = {
  new: 'جديدة', qualified: 'مؤهَّلة', messaged: 'أُرسلت', reminder_call: 'مكالمة التذكير', replied: 'ردّ',
  gap_sent: 'جدول الفجوة أُرسل', meeting: 'اجتماع', priced: 'مسعَّرة', paid: 'مدفوعة', dropped: 'مُسقطة',
}
const CATEGORY: Record<string, string> = {
  construction: 'إنشاءات', om_services: 'تشغيل وصيانة', supply_it: 'توريد وتقنية',
  consulting: 'استشارات', transport: 'نقل', other: 'أخرى',
}
const TRACK: Record<string, string> = {
  contract_finance: 'تمويل عقد', working_capital: 'رأس مال عامل', skip: 'دون الحد', unknown: 'بلا قيمة',
}
const STAGE: Record<string, string> = { early: 'بداية', in_execution: 'في التنفيذ' }
const SOURCE: Record<string, string> = { etimad: 'اعتماد', tadawul: 'تداول', nomu: 'نمو', linkedin: 'لينكدإن', news: 'أخبار', manual: 'يدوي' }

const G = '#1A3D34', M = '#6B8A80', LINE = '#E1EDE8'
const btn = (bg: string, fg = '#fff'): React.CSSProperties => ({ background: bg, color: fg, border: bg === '#fff' ? '1px solid ' + LINE : 'none', padding: '7px 14px', borderRadius: 999, fontFamily: 'inherit', fontWeight: 800, fontSize: 12.5, cursor: 'pointer' })
const input: React.CSSProperties = { width: '100%', border: '1px solid ' + LINE, borderRadius: 8, padding: '7px 10px', fontFamily: 'inherit', fontSize: 13.5, boxSizing: 'border-box' }
const sar = (n: number | null) => n == null ? '—' : Number(n).toLocaleString('en-US')

export default function AwardsPage() {
  const [awards, setAwards] = useState<Award[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [ok, setOk] = useState('')
  const [busy, setBusy] = useState('')
  const [fTrack, setFTrack] = useState('')
  const [fCat, setFCat] = useState('')
  const [fStatus, setFStatus] = useState('')
  const [showSkip, setShowSkip] = useState(false)
  const [open, setOpen] = useState('')
  const [copied, setCopied] = useState('')
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState<Record<string, string>>({ category: 'construction' })
  const [cfgOpen, setCfgOpen] = useState(false)
  const [draftT, setDraftT] = useState<Record<string, { subject: string; context_paragraph: string }>>({})
  const [draftS, setDraftS] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setErr('')
    try {
      const r = await fetch('/api/admin/awards')
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setErr(d.error || 'تعذّر التحميل'); setLoading(false); return }
      setAwards(d.awards || []); setTemplates(d.templates || []); setSettings(d.settings || {})
    } catch { setErr('تعذّر الاتصال بالخادم') }
    setLoading(false)
  }, [])
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load() }, [load])

  const flash = (m: string) => { setOk(m); setTimeout(() => setOk(''), 2500) }

  // كل كتابةٍ تُفحص نتيجتها — لا فشل صامت
  const call = async (url: string, method: string, body: unknown, what: string): Promise<boolean> => {
    setErr('')
    try {
      const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setErr('لم يقع — ' + what + ': ' + (d.error || 'خطأ ' + r.status)); return false }
      return true
    } catch { setErr('انقطع الاتصال — ' + what + ' لم يُنفَّذ'); return false }
  }

  const move = async (a: Award, to: string) => {
    if (to === 'dropped' && !confirm('إسقاط «' + a.company_name + '»؟')) return
    setBusy(a.id)
    if (await call('/api/admin/awards', 'PATCH', { id: a.id, to }, 'الانتقال إلى «' + STATUS[to] + '»')) { flash('صارت «' + STATUS[to] + '»'); await load() }
    setBusy('')
  }

  const saveNotes = async (a: Award) => {
    setBusy(a.id)
    if (await call('/api/admin/awards', 'PATCH', { id: a.id, fields: { notes: notes[a.id] ?? a.notes ?? '' } }, 'حفظ الملاحظة')) { flash('حُفظت الملاحظة'); await load() }
    setBusy('')
  }

  const copy = async (a: Award) => {
    if (!a.message) return
    try {
      await navigator.clipboard.writeText(a.message.subject + '\n\n' + a.message.body)
      setCopied(a.id); setTimeout(() => setCopied(''), 1800)
    } catch { setErr('تعذّر النسخ — انسخ النص يدوياً') }
  }

  const add = async () => {
    if (!String(form.company_name || '').trim()) { setErr('اسم الشركة مطلوب'); return }
    setBusy('add')
    if (await call('/api/admin/awards', 'POST', form, 'إضافة الترسية')) {
      setForm({ category: 'construction' }); setAdding(false); flash('أُضيفت'); await load()
    }
    setBusy('')
  }

  const saveTemplate = async (t: Template) => {
    const d = draftT[t.id]; if (!d) return
    setBusy('t' + t.id)
    if (await call('/api/admin/awards/config', 'PUT', { template: { id: t.id, ...d } }, 'حفظ القالب')) { flash('حُفظ القالب'); setDraftT((x) => { const y = { ...x }; delete y[t.id]; return y }); await load() }
    setBusy('')
  }
  const toggleTemplate = async (t: Template) => {
    setBusy('t' + t.id)
    if (await call('/api/admin/awards/config', 'PUT', { template: { id: t.id, active: !t.active } }, 'تبديل القالب')) await load()
    setBusy('')
  }
  const saveSetting = async (key: string) => {
    setBusy('s' + key)
    if (await call('/api/admin/awards/config', 'PUT', { setting: { key, value: draftS[key] } }, 'حفظ الإعداد')) { flash('حُفظ'); setDraftS((x) => { const y = { ...x }; delete y[key]; return y }); await load() }
    setBusy('')
  }

  const shown = useMemo(() => awards.filter((a) =>
    (showSkip || fTrack === 'skip' || a.track !== 'skip')
    && (!fTrack || a.track === fTrack)
    && (!fCat || a.category === fCat)
    && (!fStatus || a.status === fStatus)
  ), [awards, fTrack, fCat, fStatus, showSkip])

  const sel = (v: string, set: (s: string) => void, opts: Record<string, string>, all: string) => (
    <select value={v} onChange={(e) => set(e.target.value)} style={{ ...input, width: 'auto', minWidth: 130 }}>
      <option value="">{all}</option>
      {Object.entries(opts).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
    </select>
  )

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: '#F7FBF9', fontFamily: 'Tajawal, Cairo, sans-serif', color: G }}>
      <AdminNav />
      <div style={{ maxWidth: 980, margin: '0 auto', padding: '18px 14px 60px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>الترسيات</h1>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setAdding((x) => !x)} style={btn(G)}>{adding ? 'إغلاق' : '+ ترسية يدوياً'}</button>
            <button onClick={() => setCfgOpen((x) => !x)} style={btn('#fff', G)}>{cfgOpen ? 'إغلاق القوالب' : 'القوالب والإعدادات'}</button>
          </div>
        </div>
        <p style={{ color: M, fontSize: 13, margin: '4px 0 14px' }}>شركاتٌ رُسّي عليها عقد — تُخاطَب بسيولة التنفيذ. الرسالة تُركَّب من القوالب والإعدادات، وتُنسخ لتُرسل من قناتك.</p>

        {err && <div style={{ background: '#FBEEEC', color: '#A5281B', border: '1px solid #F0D6D1', borderRadius: 10, padding: '10px 14px', fontSize: 13.5, fontWeight: 700, marginBottom: 12 }}>{err}</div>}
        {ok && <div style={{ background: '#EAF6F1', color: '#1A5C46', border: '1px solid #BFE0D3', borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 800, marginBottom: 12 }}>✓ {ok}</div>}

        {adding && (
          <div style={{ background: '#fff', border: '1px solid ' + LINE, borderRadius: 14, padding: 16, marginBottom: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 10 }}>
              {([['company_name', 'اسم الشركة *'], ['tender_title', 'اسم المنافسة'], ['buyer_entity', 'الجهة المرسِية'], ['contract_value', 'قيمة العقد (ريال)'],
                ['awarded_at', 'تاريخ الترسية YYYY-MM-DD'], ['cr_number', 'السجل التجاري'], ['decision_maker_name', 'صاحب القرار'], ['decision_maker_role', 'منصبه'],
                ['contact_phone', 'الهاتف'], ['contact_email', 'البريد']] as const).map(([k, l]) => (
                <label key={k} style={{ fontSize: 12, color: M, fontWeight: 700 }}>{l}
                  <input value={form[k] || ''} onChange={(e) => setForm({ ...form, [k]: e.target.value })} style={input} />
                </label>
              ))}
              <label style={{ fontSize: 12, color: M, fontWeight: 700 }}>الفئة
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} style={input}>
                  {Object.entries(CATEGORY).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
              </label>
              <label style={{ fontSize: 12, color: M, fontWeight: 700 }}>قناة التواصل
                <select value={form.contact_channel || ''} onChange={(e) => setForm({ ...form, contact_channel: e.target.value })} style={input}>
                  <option value="">—</option><option value="email">بريد</option><option value="whatsapp">واتساب</option><option value="linkedin">لينكدإن</option><option value="call">مكالمة</option>
                </select>
              </label>
            </div>
            <button onClick={add} disabled={busy === 'add'} style={{ ...btn(G), marginTop: 12 }}>{busy === 'add' ? 'جارٍ…' : 'أضف'}</button>
          </div>
        )}

        {cfgOpen && (
          <div style={{ background: '#fff', border: '1px solid ' + LINE, borderRadius: 14, padding: 16, marginBottom: 14 }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>القوالب — فقرة السياق بالفئة والمرحلة</h3>
            <p style={{ color: M, fontSize: 12, margin: '0 0 10px' }}>المتغيّرات: {'{tender}'} اسم المنافسة · {'{entity}'} الجهة (تُحذف «مع {'{entity}'}» إن غابت) · {'{link}'} في التوقيع مكان الرابط.</p>
            {templates.map((t) => {
              const d = draftT[t.id] || { subject: t.subject, context_paragraph: t.context_paragraph }
              return (
                <div key={t.id} style={{ borderTop: '1px dashed ' + LINE, padding: '10px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <b style={{ fontSize: 13.5 }}>{CATEGORY[t.category]} · {STAGE[t.stage]} {!t.active && <span style={{ color: '#B4453C' }}>(موقوف)</span>}</b>
                    <button onClick={() => toggleTemplate(t)} disabled={busy === 't' + t.id} style={btn('#fff', G)}>{t.active ? 'أوقفه' : 'فعّله'}</button>
                  </div>
                  <input value={d.subject} onChange={(e) => setDraftT({ ...draftT, [t.id]: { ...d, subject: e.target.value } })} style={{ ...input, marginBottom: 6 }} />
                  <textarea value={d.context_paragraph} rows={4} onChange={(e) => setDraftT({ ...draftT, [t.id]: { ...d, context_paragraph: e.target.value } })} style={{ ...input, lineHeight: 1.8 }} />
                  {draftT[t.id] && <button onClick={() => saveTemplate(t)} disabled={busy === 't' + t.id} style={{ ...btn(G), marginTop: 6 }}>احفظ القالب</button>}
                </div>
              )
            })}
            <h3 style={{ margin: '14px 0 8px', fontSize: 15 }}>الإعدادات</h3>
            {Object.entries(settings).map(([k, v]) => {
              const d = draftS[k] ?? v
              const long = v.length > 60 || v.includes('\n')
              return (
                <div key={k} style={{ borderTop: '1px dashed ' + LINE, padding: '8px 0' }}>
                  <div style={{ fontSize: 12, color: M, fontWeight: 800, marginBottom: 4, direction: 'ltr', textAlign: 'right' }}>{k}</div>
                  {long
                    ? <textarea value={d} rows={4} onChange={(e) => setDraftS({ ...draftS, [k]: e.target.value })} style={{ ...input, lineHeight: 1.8 }} />
                    : <input value={d} onChange={(e) => setDraftS({ ...draftS, [k]: e.target.value })} style={input} />}
                  {draftS[k] !== undefined && draftS[k] !== v && <button onClick={() => saveSetting(k)} disabled={busy === 's' + k} style={{ ...btn(G), marginTop: 6 }}>احفظ</button>}
                </div>
              )
            })}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
          {sel(fTrack, setFTrack, TRACK, 'كل المسارات')}
          {sel(fCat, setFCat, CATEGORY, 'كل الفئات')}
          {sel(fStatus, setFStatus, STATUS, 'كل الحالات')}
          <label style={{ fontSize: 13, color: M, fontWeight: 700, display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="checkbox" checked={showSkip} onChange={(e) => setShowSkip(e.target.checked)} /> أظهر ما دون الحد
          </label>
          <span style={{ color: M, fontSize: 12.5 }}>{shown.length.toLocaleString('ar-SA')} من {awards.length.toLocaleString('ar-SA')}</span>
        </div>

        {loading ? <div style={{ color: M }}>جارٍ التحميل…</div> : shown.length === 0 ? <div style={{ color: M }}>لا ترسيات بهذه الفلاتر.</div> : shown.map((a) => (
          <div key={a.id} style={{ background: '#fff', border: '1px solid ' + LINE, borderRadius: 14, padding: 14, marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 900, fontSize: 15.5 }}>{a.company_name}</div>
                <div style={{ color: M, fontSize: 13, lineHeight: 1.8 }}>
                  {a.tender_title || 'بلا اسم منافسة'}{a.buyer_entity ? ' — ' + a.buyer_entity : ''}
                  <br />{CATEGORY[a.category] || a.category} · {TRACK[a.track || ''] || a.track} · قيمة {sar(a.contract_value)}
                  {a.awarded_at ? ' · رُسّيت ' + a.awarded_at : ''}{a.stage ? ' · ' + STAGE[a.stage] : ''} · {SOURCE[a.source] || a.source}
                  {(a.decision_maker_name || a.contact_phone || a.contact_email) && <><br />{[a.decision_maker_name, a.decision_maker_role, a.contact_phone, a.contact_email].filter(Boolean).join(' · ')}</>}
                </div>
              </div>
              <div style={{ textAlign: 'left' }}>
                <span style={{ background: '#EAF4F0', borderRadius: 99, padding: '3px 10px', fontSize: 12, fontWeight: 800 }}>{STATUS[a.status] || a.status}</span>
                <div style={{ color: M, fontSize: 11, marginTop: 4, direction: 'ltr' }}>{a.src}</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
              {a.next.map((to) => (
                <button key={to} onClick={() => move(a, to)} disabled={busy === a.id || (to === 'messaged' && !a.addressed)}
                  style={to === 'dropped' ? btn('#fff', '#B4453C') : btn(G)}>{to === 'dropped' ? 'أسقِط' : '← ' + STATUS[to]}</button>
              ))}
              {a.addressed
                ? <button onClick={() => setOpen(open === a.id ? '' : a.id)} style={btn('#fff', G)}>{open === a.id ? 'أخفِ الرسالة' : 'الرسالة'}</button>
                : <span style={{ background: '#F2F5F4', color: '#7E938C', borderRadius: 99, padding: '6px 12px', fontSize: 12, fontWeight: 800 }}>لا تُخاطَب</span>}
            </div>

            {open === a.id && a.addressed && (
              <div style={{ marginTop: 10, borderTop: '1px dashed ' + LINE, paddingTop: 10 }}>
                {a.message ? (<>
                  <div style={{ fontSize: 12, color: M, fontWeight: 800 }}>العنوان · قالب {CATEGORY[a.category]} / {STAGE[a.message.stage]}</div>
                  <div style={{ fontWeight: 800, margin: '2px 0 8px' }}>{a.message.subject}</div>
                  <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.95, fontSize: 14, background: '#F7FBF9', borderRadius: 10, padding: 12 }}>{a.message.body}</div>
                  <button onClick={() => copy(a)} style={{ ...btn(G), marginTop: 8 }}>{copied === a.id ? '✓ نُسخت' : 'انسخ الرسالة'}</button>
                </>) : <div style={{ color: '#B4453C', fontSize: 13, fontWeight: 700 }}>لا قالب مفعَّل لهذه الفئة والمرحلة — فعّله من «القوالب والإعدادات».</div>}
                <div style={{ marginTop: 10 }}>
                  <textarea rows={2} placeholder="ملاحظة" value={notes[a.id] ?? a.notes ?? ''} onChange={(e) => setNotes({ ...notes, [a.id]: e.target.value })} style={{ ...input, lineHeight: 1.8 }} />
                  {notes[a.id] !== undefined && notes[a.id] !== (a.notes ?? '') && <button onClick={() => saveNotes(a)} disabled={busy === a.id} style={{ ...btn('#fff', G), marginTop: 6 }}>احفظ الملاحظة</button>}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
