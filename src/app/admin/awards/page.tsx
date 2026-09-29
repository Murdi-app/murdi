'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import AdminNav from '@/components/AdminNav'

// الترسيات — شاشة المالك وحده (الحارس في التخطيط، والمسار يردّ غيره).
// المحتوى — نصوص الرسائل والحدود — يُقرأ من القاعدة عبر الخادم؛ هذه الصفحة
// تعرضه وتنسخه وتعدّله، ولا تحمل نصّاً منه (المستودع عام).

type Touch = { id: string; channel: string; direction: string; actor: string; to_address: string | null; subject: string | null; body: string | null; outcome: string | null; created_at: string }
type Msg = { subject: string; body: string; stage: string; kind: string; link: string }
type Award = {
  id: string; source: string; source_ref?: string | null; company_name: string; cr_number: string | null; tender_title: string | null
  buyer_entity: string | null; category: string; contract_value: number | null; is_subcontract: boolean | null; kind: string | null; awarded_at: string | null
  track: string | null; decision_maker_name: string | null; decision_maker_role: string | null
  contact_email: string | null; contact_phone: string | null; contact_channel: string | null
  status: string; messaged_at: string | null; reminder_at: string | null; replied_at: string | null
  gap_sent_at: string | null; notes: string | null; created_at: string; updated_at: string
  addressed: boolean; src: string; next: string[]; message: Msg | null; stage: string | null; touches: Touch[]
  gap_pdf_path: string | null; gap_generated_at: string | null; gap_inputs: Record<string, unknown> | null
  consult: { status: string; generated_at: string | null; released_at: string | null } | null
  org_awards: number
  contact_whatsapp: string | null; phone_source: string | null; phone_source_url: string | null
  email_source: string | null; email_source_url: string | null
  dnc_reason: string | null; dnc_by: string | null; dnc_at: string | null
  fit_service: string | null; qualified_at: string | null; qualified_by: string | null
  phone_check: string | null; phone_checked_at: string | null; phone_checked_by: string | null
}
// صاحب القرار: كل رقمٍ وبريد بمصدره المنشور ورابطه (ما نشرته المنشأة أو سجلٌّ رسمي)
const DM_FIELDS = [
  ['decision_maker_name', 'صاحب القرار'], ['decision_maker_role', 'منصبه'],
  ['contact_phone', 'الهاتف'], ['contact_whatsapp', 'واتساب (إن اختلف)'], ['phone_source', 'مصدر الرقم'], ['phone_source_url', 'رابط مصدر الرقم'],
  ['contact_email', 'البريد'], ['email_source', 'مصدر البريد'], ['email_source_url', 'رابط مصدر البريد'],
] as const
const needsPhone = (a: { status: string; contact_phone: string | null; contact_whatsapp: string | null; phone_check: string | null }) =>
  a.status !== 'dropped' && (!(a.contact_phone || a.contact_whatsapp) || a.phone_check === 'no')
type Template = { id: string; category: string; stage: string; subject: string; context_paragraph: string; active: boolean }

const STATUS: Record<string, string> = {
  new: 'جديدة', qualified: 'موثّقة', messaged: 'أُرسلت', reminder_call: 'مكالمة التذكير', replied: 'ردّ',
  gap_sent: 'جدول الفجوة أُرسل', meeting: 'اجتماع', priced: 'مسعَّرة', paid: 'مدفوعة', dropped: 'مُسقطة', do_not_contact: 'لا تتواصل',
}
const CATEGORY: Record<string, string> = {
  construction: 'إنشاءات', om_services: 'تشغيل وصيانة', supply_it: 'توريد وتقنية',
  consulting: 'استشارات', transport: 'نقل', other: 'أخرى',
}
const TRACK: Record<string, string> = {
  contract_finance: 'تمويل عقد', working_capital: 'رأس مال عامل', skip: 'دون الحد', unknown: 'بلا قيمة',
}
// الخدمة المناسبة (التأهيل) — أسماءٌ لا أسعار
const FIT: Record<string, string> = { contract_finance: 'تمويل عقد', working_capital: 'رأس مال عامل', feasibility_credit: 'جدوى ائتمانية', broader_funding: 'مسار تمويل أوسع', not_fit: 'لا يناسب' }
const STAGE: Record<string, string> = { early: 'بداية', in_execution: 'في التنفيذ' }
const SOURCE: Record<string, string> = { etimad: 'اعتماد', tadawul: 'تداول', nomu: 'نمو', linkedin: 'لينكدإن', news: 'الأخبار', manual: 'يدوي' }

const G = '#1A3D34', M = '#6B8A80', LINE = '#E1EDE8'
const btn = (bg: string, fg = '#fff'): React.CSSProperties => ({ background: bg, color: fg, border: bg === '#fff' ? '1px solid ' + LINE : 'none', padding: '7px 14px', borderRadius: 999, fontFamily: 'inherit', fontWeight: 800, fontSize: 12.5, cursor: 'pointer' })
const input: React.CSSProperties = { width: '100%', border: '1px solid ' + LINE, borderRadius: 8, padding: '7px 10px', fontFamily: 'inherit', fontSize: 13.5, boxSizing: 'border-box' }
const CH: Record<string, string> = { email: 'بريد', whatsapp: 'واتساب', call: 'اتصال' }
const when = (t: string) => new Date(t).toLocaleString('ar-SA', { dateStyle: 'medium', timeStyle: 'short' })
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
  const [showDropped, setShowDropped] = useState(false)
  const [onlyNeedPhone, setOnlyNeedPhone] = useState(false)
  const [dm, setDm] = useState<Record<string, Record<string, string>>>({})
  const [gap, setGap] = useState<Record<string, Record<string, string>>>({})
  const [gapOut, setGapOut] = useState<Record<string, { url: string | null; line: string }>>({})
  const [reply, setReply] = useState<Record<string, { channel: string; body: string }>>({})
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
    let reason: string | null = null
    if (to === 'do_not_contact') {
      reason = prompt('«لا تتواصل» مع ' + a.company_name + ' — تسري على كل ترسياتها وتمنع إعادة استيرادها. السبب:')
      if (!reason || !reason.trim()) return
    }
    setBusy(a.id)
    if (await call('/api/admin/awards', 'PATCH', { id: a.id, to, reason }, 'الانتقال إلى «' + STATUS[to] + '»')) { flash('صارت «' + STATUS[to] + '»'); await load() }
    setBusy('')
  }

  // إرسال البريد من المنصة — يُسجَّل بحرفه في المراسلات
  const send = async (a: Award) => {
    if (!a.message || !a.contact_email) return
    if (!confirm('إرسال البريد إلى ' + a.contact_email + '؟')) return
    setBusy('send' + a.id); setErr('')
    try {
      const r = await fetch('/api/admin/awards/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: a.id }) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) setErr('لم يخرج البريد — ' + (d.error || 'خطأ ' + r.status))
      else { if (d.warn) setErr(d.warn); flash('خرج البريد وسُجّل'); await load() }
    } catch { setErr('انقطع الاتصال — لم يُرسل') }
    setBusy('')
  }

  const logReply = async (a: Award) => {
    const r = reply[a.id]
    if (!r?.body?.trim()) return
    setBusy('reply' + a.id)
    if (await call('/api/admin/awards/touch', 'POST', { id: a.id, channel: r.channel || 'email', body: r.body }, 'تسجيل الرد')) {
      flash('سُجّل الرد'); setReply((x) => { const y = { ...x }; delete y[a.id]; return y }); await load()
    }
    setBusy('')
  }

  const setSub = async (a: Award, v: boolean) => {
    setBusy(a.id)
    if (await call('/api/admin/awards', 'PATCH', { id: a.id, fields: { is_subcontract: v } }, 'تعديل «مقاول باطن»')) { flash(v ? 'صارت مقاول باطن — القالب العام' : 'أُلغي «مقاول باطن»'); await load() }
    setBusy('')
  }

  // استشارة الفجوة: تُولَّد «جاهزة» ولا يخرج شيء؛ الإرسال بزرّ «اعتمد وأرسل» وحده
  const gapCall = async (a: Award, body: Record<string, unknown>, what: string): Promise<{ url?: string; deepest?: { amount: number; month: string }; warn?: string } | null> => {
    setBusy('gap' + a.id); setErr('')
    try {
      const r = await fetch('/api/admin/awards/gap', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: a.id, ...body }) })
      const d = await r.json().catch(() => ({}))
      setBusy('')
      if (!r.ok) { setErr(what + ' لم يكتمل — ' + (d.error || 'خطأ ' + r.status)); return null }
      if (d.warn) setErr(d.warn)
      return d
    } catch { setBusy(''); setErr('انقطع الاتصال — ' + what + ' لم يكتمل'); return null }
  }
  const makeGap = async (a: Award) => {
    const f = gap[a.id] || {}
    const d = await gapCall(a, { action: 'generate', inputs: { contract_value: f.contract_value || null, months: f.months || null, start_date: f.start_date || null, method: f.method || null, delay_days: f.delay_days || null, monthly_spend: f.monthly_spend || null } }, 'توليد الاستشارة')
    if (!d) return
    setGapOut({ ...gapOut, [a.id]: { url: d.url || null, line: 'جاهزة · أعمق نقطة ' + Math.abs(d.deepest?.amount || 0).toLocaleString('en-US') + ' ريال في ' + (d.deepest?.month || '') } })
    flash('الاستشارة جاهزة — راجِعها ثم «اعتمد وأرسل»'); await load()
  }
  const releaseGap = async (a: Award, channel: 'email' | 'whatsapp') => {
    if (!confirm(channel === 'email' ? 'اعتماد الاستشارة وإرسالها مرفقةً إلى ' + a.contact_email + '؟' : 'اعتماد الاستشارة وتسجيلها مرسَلةً بالواتساب؟ (تنزّلها وترسلها أنت)')) return
    const d = await gapCall(a, { action: 'release', channel }, 'الاعتماد')
    if (!d) return
    if (channel === 'whatsapp' && d.url) window.open(d.url, '_blank')
    flash(channel === 'email' ? 'اعتُمدت وخرجت بالبريد' : 'اعتُمدت — أرسل الملف بالواتساب'); await load()
  }
  const openGap = async (a: Award) => {
    const r = await fetch('/api/admin/awards/gap?id=' + a.id)
    const d = await r.json().catch(() => ({}))
    if (!r.ok || !d.url) { setErr(d.error || 'تعذّر فتح الجدول'); return }
    window.open(d.url, '_blank')
  }

  const saveDm = async (a: Award) => {
    const d = dm[a.id]
    if (!d) return
    setBusy('dm' + a.id)
    if (await call('/api/admin/awards', 'PATCH', { id: a.id, fields: d }, 'حفظ صاحب القرار')) { flash('حُفظ صاحب القرار'); setDm((x) => { const y = { ...x }; delete y[a.id]; return y }); await load() }
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

  // الاستيراد اليومي آلي (٦ صباحاً)؛ وهذا لمن أراده الآن — بنافذة أسبوع
  const runImport = async () => {
    setBusy('import'); setErr('')
    try {
      const r = await fetch('/api/admin/awards/import', { method: 'POST' })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) setErr('لم يقع الاستيراد: ' + (d.error || 'خطأ ' + r.status))
      else {
        flash('وُجد ' + (d.found ?? 0) + ' خبراً · دخل ' + (d.inserted ?? 0) + ' جديداً · تُرك ' + (d.skipped ?? 0) + ' مكرّراً' + (d.blocked ? ' · ' + d.blocked + ' «لا تتواصل»' : ''))
        if (d.errors?.length) setErr('بعض الاستعلامات تعثّرت: ' + d.errors.join(' · '))
        await load()
      }
    } catch { setErr('انقطع الاتصال — لم يقع الاستيراد') }
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
    && (showDropped || fStatus === a.status || (a.status !== 'dropped' && a.status !== 'do_not_contact'))
    && (!onlyNeedPhone || needsPhone(a))
    && (!fTrack || a.track === fTrack)
    && (!fCat || a.category === fCat)
    && (!fStatus || a.status === fStatus)
  ), [awards, fTrack, fCat, fStatus, showSkip, showDropped, onlyNeedPhone])

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
            <button onClick={runImport} disabled={busy === 'import'} style={btn('#fff', G)}>{busy === 'import' ? 'جارٍ الاستيراد…' : 'استورد من الأخبار'}</button>
            <button onClick={() => setCfgOpen((x) => !x)} style={btn('#fff', G)}>{cfgOpen ? 'إغلاق القوالب' : 'القوالب والإعدادات'}</button>
          </div>
        </div>
        <p style={{ color: M, fontSize: 13, margin: '4px 0 14px' }}>شركاتٌ رُسّي عليها عقد — تُخاطَب بسيولة التنفيذ. الرسالة تُركَّب من القوالب والإعدادات، وتُرسل من هنا بريداً، وكل مراسلةٍ تُسجَّل بحرفها.</p>

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
          <label style={{ fontSize: 13, color: M, fontWeight: 700, display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="checkbox" checked={showDropped} onChange={(e) => setShowDropped(e.target.checked)} /> أظهر المُسقطة و«لا تتواصل»
          </label>
          <label style={{ fontSize: 13, color: G, fontWeight: 800, display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="checkbox" checked={onlyNeedPhone} onChange={(e) => setOnlyNeedPhone(e.target.checked)} /> ينقصها رقم ({awards.filter(needsPhone).length.toLocaleString('ar-SA')})
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
                <span style={{ background: a.status === 'do_not_contact' ? '#FBEEEC' : '#EAF4F0', color: a.status === 'do_not_contact' ? '#A5281B' : undefined, borderRadius: 99, padding: '3px 10px', fontSize: 12, fontWeight: 800 }}>{STATUS[a.status] || a.status}</span>
                {a.fit_service && <div style={{ fontSize: 11.5, fontWeight: 800, color: a.fit_service === 'not_fit' ? '#A5281B' : '#1A5C46', marginTop: 4 }}>الخدمة: {FIT[a.fit_service]}{a.qualified_by ? ' — ' + a.qualified_by : ''}</div>}
                {a.status === 'do_not_contact' && <div style={{ color: '#A5281B', fontSize: 11.5, marginTop: 4, maxWidth: 260 }}>{a.dnc_reason}{a.dnc_by ? ' — ' + a.dnc_by : ''}{a.dnc_at ? ' · ' + a.dnc_at.slice(0, 10) : ''}</div>}
                <span title="المراسلات" style={{ background: a.touches.length ? '#FFF6E0' : '#F2F5F4', borderRadius: 99, padding: '3px 10px', fontSize: 12, fontWeight: 800, marginRight: 6 }}>✉︎ {a.touches.length.toLocaleString('ar-SA')}{a.touches.some((t) => t.direction === 'in') ? ' · ردّ' : ''}</span>
                <div style={{ color: M, fontSize: 11, marginTop: 4, direction: 'ltr' }}>{a.src}</div>
                {a.source_ref && /^https?:/.test(a.source_ref) && <a href={a.source_ref} target="_blank" rel="noopener noreferrer" style={{ color: G, fontSize: 12, fontWeight: 800 }}>الخبر ↗</a>}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
              {a.next.map((to) => (
                <button key={to} onClick={() => move(a, to)} disabled={busy === a.id || (to === 'messaged' && !a.addressed)}
                  style={to === 'dropped' || to === 'do_not_contact' ? btn('#fff', '#B4453C') : btn(G)}>{to === 'dropped' ? 'أسقِط' : to === 'do_not_contact' ? '⛔ لا تتواصل' : '← ' + STATUS[to]}</button>
              ))}
              {a.addressed
                ? <button onClick={() => setOpen(open === a.id ? '' : a.id)} style={btn('#fff', G)}>{open === a.id ? 'أغلِق' : 'الرسالة والمراسلات'}</button>
                : <span style={{ background: '#F2F5F4', color: '#7E938C', borderRadius: 99, padding: '6px 12px', fontSize: 12, fontWeight: 800 }}>لا تُخاطَب</span>}
            </div>

            {open === a.id && a.addressed && (
              <div style={{ marginTop: 10, borderTop: '1px dashed ' + LINE, paddingTop: 10 }}>
                <div style={{ background: '#F7FBF9', border: '1px solid ' + LINE, borderRadius: 10, padding: 10, marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 6 }}>صاحب القرار <span style={{ color: M, fontWeight: 700, fontSize: 12 }}>— كل رقمٍ وبريد بمصدره المنشور ورابطه</span>
                    {a.phone_check === 'yes' && <span style={{ color: '#1A5C46', marginRight: 8 }}>✓ الرقم يصل ({a.phone_checked_by})</span>}
                    {a.phone_check === 'no' && <span style={{ color: '#A5281B', marginRight: 8 }}>✗ الرقم لا يصل ({a.phone_checked_by}) — يحتاج رقماً آخر</span>}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 8 }}>
                    {DM_FIELDS.map(([k, l]) => (
                      <label key={k} style={{ fontSize: 11.5, color: M, fontWeight: 700 }}>{l}
                        <input value={dm[a.id]?.[k] ?? String((a as unknown as Record<string, unknown>)[k] ?? '')}
                          onChange={(e) => setDm({ ...dm, [a.id]: { ...(dm[a.id] || {}), [k]: e.target.value } })}
                          style={{ ...input, direction: /url|phone|whatsapp|email/.test(k) && !/source$/.test(k) ? 'ltr' : 'rtl' }} />
                      </label>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 8 }}>
                    <label style={{ fontSize: 11.5, color: M, fontWeight: 700 }}>الخدمة المناسبة{' '}
                      <select value={dm[a.id]?.fit_service ?? (a.fit_service || '')} onChange={(e) => setDm({ ...dm, [a.id]: { ...(dm[a.id] || {}), fit_service: e.target.value } })} style={{ ...input, width: 'auto' }}>
                        <option value="">— لم تُؤهَّل بعد</option>
                        {Object.entries(FIT).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                      </select>
                    </label>
                    {dm[a.id] && <button onClick={() => saveDm(a)} disabled={busy === 'dm' + a.id} style={btn(G)}>احفظ صاحب القرار</button>}
                    {a.phone_source_url && <a href={a.phone_source_url} target="_blank" rel="noopener noreferrer" style={{ color: G, fontSize: 12, fontWeight: 800 }}>مصدر الرقم ↗</a>}
                    {a.email_source_url && <a href={a.email_source_url} target="_blank" rel="noopener noreferrer" style={{ color: G, fontSize: 12, fontWeight: 800 }}>مصدر البريد ↗</a>}
                    {a.contact_email && !a.email_source_url && <span style={{ color: '#A5281B', fontSize: 12, fontWeight: 700 }}>البريد بلا رابط مصدر</span>}
                  </div>
                </div>
                {a.message ? (<>
                  <div style={{ fontSize: 12, color: M, fontWeight: 800 }}>العنوان · {a.message.kind === 'general' ? 'القالب العام (بلا قيمة، أو مقاول باطن، أو من غير اعتماد)' : 'القالب المفصّل — ' + CATEGORY[a.category] + ' / ' + STAGE[a.message.stage]}</div>
                  <div style={{ fontWeight: 800, margin: '2px 0 8px' }}>{a.message.subject}</div>
                  <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.95, fontSize: 14, background: '#F7FBF9', borderRadius: 10, padding: 12 }}>{a.message.body}</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8, alignItems: 'center' }}>
                    {(() => {
                      // لا بريدٌ ثانٍ — يُقال من أرسل ومتى (أنا أو Claude التشغيل)
                      const sent = [...a.touches].reverse().find((t) => t.channel === 'email' && t.direction === 'out')
                      return sent
                        ? <span style={{ background: '#EAF6F1', color: '#1A5C46', borderRadius: 99, padding: '6px 12px', fontSize: 12.5, fontWeight: 800 }}>✓ أُرسل البريد: {sent.actor} · {when(sent.created_at)}</span>
                        : <button onClick={() => send(a)} disabled={!a.contact_email || busy === 'send' + a.id || !['qualified', 'messaged', 'reminder_call', 'replied'].includes(a.status)} style={{ ...btn(G), opacity: a.contact_email ? 1 : 0.5 }}>
                            {busy === 'send' + a.id ? 'جارٍ الإرسال…' : 'أرسل البريد' + (a.contact_email ? ' إلى ' + a.contact_email : '')}
                          </button>
                    })()}
                    <button onClick={() => copy(a)} style={btn('#fff', G)}>{copied === a.id ? '✓ نُسخت' : 'انسخ الرسالة'}</button>
                    {!a.contact_email && <span style={{ color: M, fontSize: 12 }}>لا بريد — أضفه ليُرسل من هنا</span>}
                  </div>
                </>) : <div style={{ color: '#B4453C', fontSize: 13, fontWeight: 700 }}>{a.kind === 'general' ? 'القالب العام ناقص — أكمل general_email_subject وgeneral_email_body من «القوالب والإعدادات».' : 'لا قالب مفعَّل لهذه الفئة والمرحلة — فعّله من «القوالب والإعدادات».'}</div>}
                <div style={{ marginTop: 14, background: '#F7FBF9', border: '1px solid ' + LINE, borderRadius: 10, padding: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 6 }}>استشارة الفجوة المختصرة{a.org_awards > 1 && <span style={{ color: G, fontSize: 12 }}> — للمنشأة {a.org_awards === 2 ? 'عقدان' : a.org_awards.toLocaleString('ar-SA') + (a.org_awards <= 10 ? ' عقود' : ' عقداً')}، تجمعها استشارةٌ واحدة</span>} <span style={{ color: M, fontWeight: 700, fontSize: 12 }}>— الفارغ يُملأ بمعيار القطاع ويُكتب «تقديري»</span></div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
                    {([['contract_value', 'قيمة العقد', a.contract_value != null ? String(a.contract_value) : ''], ['months', 'المدة بالأشهر', ''], ['start_date', 'بدء التنفيذ YYYY-MM-DD', a.awarded_at || ''],
                      ['delay_days', 'مدة الصرف بالأيام', ''], ['monthly_spend', 'الصرف الشهري', '']] as const).map(([k, l, ph]) => (
                      <label key={k} style={{ fontSize: 11.5, color: M, fontWeight: 700 }}>{l}
                        <input value={gap[a.id]?.[k] || ''} placeholder={ph} onChange={(e) => setGap({ ...gap, [a.id]: { ...(gap[a.id] || {}), [k]: e.target.value } })} style={input} />
                      </label>
                    ))}
                    <label style={{ fontSize: 11.5, color: M, fontWeight: 700 }}>طريقة الصرف
                      <select value={gap[a.id]?.method || ''} onChange={(e) => setGap({ ...gap, [a.id]: { ...(gap[a.id] || {}), method: e.target.value } })} style={input}>
                        <option value="">معيار القطاع</option><option value="monthly">شهري</option><option value="claims">مستخلصات</option>
                      </select>
                    </label>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8, alignItems: 'center' }}>
                    <button onClick={() => makeGap(a)} disabled={busy === 'gap' + a.id} style={btn(a.consult?.status === 'ready' ? '#fff' : G, a.consult?.status === 'ready' ? G : '#fff')}>{busy === 'gap' + a.id ? 'جارٍ… (دقيقة تقريباً)' : a.consult ? 'ولّدها من جديد' : 'ولّد الاستشارة'}</button>
                    {a.gap_pdf_path && <button onClick={() => openGap(a)} style={btn('#fff', G)}>افتح الاستشارة</button>}
                    {a.consult && <span style={{ fontSize: 12, fontWeight: 800, color: a.consult.status === 'ready' ? '#8A6D1F' : a.consult.status === 'released' ? '#1A5C46' : '#A5281B' }}>
                      {a.consult.status === 'ready' ? '● جاهزة — تنتظر اعتمادك' : a.consult.status === 'released' ? '✓ أُرسلت ' + (a.consult.released_at || '').slice(0, 10) : a.consult.status === 'failed' ? 'فشل التوليد' : a.consult.status === 'superseded' ? 'نسخة سابقة' : 'جارٍ…'}
                    </span>}
                    {gapOut[a.id] && <span style={{ fontSize: 12.5, fontWeight: 800 }}>{gapOut[a.id].line}</span>}
                  </div>
                  {a.consult?.status === 'ready' && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                      {settings.gap_email_approved === 'true' && a.contact_email && <button onClick={() => releaseGap(a, 'email')} disabled={busy === 'gap' + a.id} style={btn(G)}>اعتمد وأرسل بالبريد إلى {a.contact_email}</button>}
                      <button onClick={() => releaseGap(a, 'whatsapp')} disabled={busy === 'gap' + a.id} style={btn('#fff', G)}>اعتمد — أرسلها أنا بالواتساب</button>
                    </div>
                  )}
                </div>
                <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, fontWeight: 700, color: M, marginTop: 10 }}>
                  <input type="checkbox" checked={!!a.is_subcontract} disabled={busy === a.id} onChange={(e) => setSub(a, e.target.checked)} /> الفائز مقاول باطن (يُخاطَب بالقالب العام)
                </label>
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 6 }}>المراسلات ({a.touches.length.toLocaleString('ar-SA')})</div>
                  {a.touches.length === 0 && <div style={{ color: M, fontSize: 12.5 }}>لا مراسلة بعد.</div>}
                  {a.touches.map((t) => (
                    <div key={t.id} style={{ background: t.direction === 'in' ? '#FFF9EA' : '#F7FBF9', border: '1px solid ' + (t.direction === 'in' ? '#EAD9A8' : LINE), borderRadius: 10, padding: 10, marginBottom: 6 }}>
                      <div style={{ fontSize: 12, color: M, fontWeight: 800 }}>
                        {t.direction === 'in' ? '← وارد' : '→ صادر'} · {CH[t.channel] || t.channel} · {t.actor} · {when(t.created_at)}{t.to_address ? ' · ' + t.to_address : ''}
                        {t.outcome && <span style={{ color: G }}> · النتيجة: {t.outcome === 'yes' ? 'نعم ✓' : t.outcome}</span>}
                      </div>
                      {t.subject && <div style={{ fontWeight: 800, fontSize: 13.5, marginTop: 4 }}>{t.subject}</div>}
                      {t.body && <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.85, fontSize: 13.5, marginTop: 4 }}>{t.body}</div>}
                    </div>
                  ))}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                    <select value={reply[a.id]?.channel || 'email'} onChange={(e) => setReply({ ...reply, [a.id]: { body: reply[a.id]?.body || '', channel: e.target.value } })} style={{ ...input, width: 'auto' }}>
                      <option value="email">ردّ بالبريد</option><option value="whatsapp">ردّ بالواتساب</option><option value="call">ردّ بمكالمة</option>
                    </select>
                    <textarea rows={2} placeholder="الصق الرد الوارد بحرفه" value={reply[a.id]?.body || ''} onChange={(e) => setReply({ ...reply, [a.id]: { channel: reply[a.id]?.channel || 'email', body: e.target.value } })} style={{ ...input, flex: '1 1 240px', width: 'auto', lineHeight: 1.8 }} />
                    <button onClick={() => logReply(a)} disabled={!reply[a.id]?.body?.trim() || busy === 'reply' + a.id} style={btn(G)}>سجّل الرد</button>
                  </div>
                </div>
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
