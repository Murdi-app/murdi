'use client'
import { useCallback, useEffect, useState } from 'react'
import AdminNav from '@/components/AdminNav'

// قناة الفائزين بالعقود — لوحة المالك. «ما يحتاج قراري» وحده في أعلاها، ثم صندوق توصيات
// Codex، والصادر وزرّ إيقافه، ومفتاح Codex، وخريطة الفرص بمسؤولها وموعدها ودرجتها.
// النصوص والحدود من القاعدة (المستودع عام) — هذه الصفحة تعرضها وتعتمدها فقط.

type Row = Record<string, unknown>
type Data = {
  decisions: {
    yes: Row[]; consults: Row[]; templates: Row[]; hypotheses: Row[]; texts: string[]; template_recs: Row[]
    objections: Row[]; high_value: Row[]; flagged: Row[]; overdue: Row[]
  }
  metric: { offered: number; offered_auto: number; paid: number; referrals: number; open: number; by_state: Record<string, number> }
  recommendations: Row[]
  outbox: { items: Row[]; enabled: boolean; cap: number; hours: string; sent_today: number; window: { ok: boolean; why: string } }
  keys: Row[]; calls: Row[]; cursor: Row | null; pipeline: Row[]
  mcp: { linked: boolean; last_used_at: string | null; linked_at: string | null }
  whatsapp: { active: boolean; switch_on: boolean; has_token: boolean; phone_number_id: string; template: string; lang: string; backup_hours: string }
}

const G = '#1A3D34', M = '#6B8A80', LINE = '#E1EDE8', RED = '#A5281B'
const btn = (bg: string, fg = '#fff'): React.CSSProperties => ({ background: bg, color: fg, border: bg === '#fff' ? '1px solid ' + LINE : 'none', padding: '7px 14px', borderRadius: 999, fontFamily: 'inherit', fontWeight: 800, fontSize: 12.5, cursor: 'pointer' })
const card: React.CSSProperties = { background: '#fff', border: '1px solid ' + LINE, borderRadius: 14, padding: 14, marginBottom: 12 }
const when = (t: unknown) => t ? new Date(String(t)).toLocaleString('ar-SA', { dateStyle: 'medium', timeStyle: 'short' }) : '—'
const TEXT_KEYS: Record<string, string> = { general_email_approved: 'البريد العام', whatsapp_template_approved: 'قالب الواتساب', gap_email_approved: 'بريد الاستشارة' }
const REC_KIND: Record<string, string> = { decision_maker: 'صاحب قرار', contact: 'وسيلة تواصل', hypothesis: 'فرضية وسؤال', service: 'خدمة مقترحة', next_reply: 'رد تالٍ', drop: 'إسقاط', subcontractor: 'مقاول باطن/مورّد', template: 'تحسين قالب/فرضية' }
const name = (r: Row) => String((r.award as Row | null)?.company_name || r.company_name || '')

export default function ChannelPage() {
  const [d, setD] = useState<Data | null>(null)
  const [err, setErr] = useState('')
  const [ok, setOk] = useState('')
  const [busy, setBusy] = useState('')
  const [newKey, setNewKey] = useState('')
  const [reason, setReason] = useState<Record<string, string>>({})
  const [wa, setWa] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/channel')
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setErr(j.error || 'تعذّر التحميل'); return }
      setD(j); setErr('')
    } catch { setErr('تعذّر الاتصال بالخادم') }
  }, [])
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load() }, [load])

  const act = async (body: Record<string, unknown>, what: string, url = '/api/admin/channel'): Promise<Row | null> => {
    setBusy(what); setErr('')
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const j = await r.json().catch(() => ({}))
      setBusy('')
      if (!r.ok) { setErr(what + ' — ' + (j.error || 'خطأ ' + r.status)); return null }
      if (j.warn) setErr(j.warn)
      setOk(what + ' ✓'); setTimeout(() => setOk(''), 2500)
      await load()
      return j
    } catch { setBusy(''); setErr('انقطع الاتصال — ' + what + ' لم يُنفَّذ'); return null }
  }
  const openPdf = async (id: string) => {
    const r = await fetch('/api/admin/awards/gap?id=' + id)
    const j = await r.json().catch(() => ({}))
    if (!r.ok || !j.url) { setErr(j.error || 'تعذّر فتح الملف'); return }
    window.open(j.url, '_blank')
  }

  if (!d) return (<div dir="rtl" style={{ minHeight: '100vh', background: '#F7FBF9', fontFamily: 'Tajawal, Cairo, sans-serif' }}><AdminNav /><div style={{ padding: 20, color: err ? RED : M }}>{err || 'جارٍ التحميل…'}</div></div>)
  const dc = d.decisions
  const count = dc.yes.length + dc.consults.length + dc.templates.length + dc.hypotheses.length + dc.texts.length + dc.template_recs.length + dc.objections.length + dc.flagged.length + dc.overdue.length
  const pct = d.metric.offered ? Math.round((d.metric.offered_auto / d.metric.offered) * 100) : null
  const H = ({ t, n }: { t: string; n: number }) => n ? <div style={{ fontWeight: 900, fontSize: 14, margin: '12px 0 6px' }}>{t} <span style={{ color: M }}>({n.toLocaleString('ar-SA')})</span></div> : null

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: '#F7FBF9', fontFamily: 'Tajawal, Cairo, sans-serif', color: G }}>
      <AdminNav />
      <div style={{ maxWidth: 980, margin: '0 auto', padding: '18px 14px 60px' }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>قناة الفائزين بالعقود</h1>
        <p style={{ color: M, fontSize: 13, margin: '4px 0 12px' }}>
          الأتمتة: {pct === null ? 'لم تبلغ فرصةٌ العرض بعد' : pct + '٪ من الفرص بلغت العرض بلا إدخالٍ أو توجيهٍ منك'} ({d.metric.offered_auto}/{d.metric.offered}) · مدفوع {d.metric.paid} · إحالات {d.metric.referrals} · فرصٌ مفتوحة {d.metric.open}
        </p>
        {err && <div style={{ background: '#FBEEEC', color: RED, borderRadius: 10, padding: '10px 14px', fontSize: 13.5, fontWeight: 700, marginBottom: 12 }}>{err}</div>}
        {ok && <div style={{ background: '#EAF6F1', color: '#1A5C46', borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 800, marginBottom: 12 }}>{ok}</div>}

        {/* ═══ ما يحتاج قراري — وحده ═══ */}
        <div style={{ ...card, borderColor: count ? '#EAD9A8' : LINE, background: count ? '#FFFDF6' : '#fff' }}>
          <div style={{ fontWeight: 900, fontSize: 17 }}>ما يحتاج قرارك {count ? '(' + count.toLocaleString('ar-SA') + ')' : '— لا شيء الآن'}</div>

          <H t="«نعم» جديدة" n={dc.yes.length} />
          {dc.yes.map((p) => <div key={String(p.id)} style={{ fontSize: 13.5, padding: '4px 0' }}>🟢 {name(p)} — {String(p.next_step || '')}</div>)}

          <H t="استشاراتٌ جاهزة تنتظر اعتمادك" n={dc.consults.length} />
          {dc.consults.map((p) => {
            const a = p.award as Row | null
            return (
              <div key={String(p.id)} style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', padding: '6px 0', borderBottom: '1px dashed ' + LINE }}>
                <b style={{ fontSize: 13.5 }}>{name(p)}</b>
                <button onClick={() => openPdf(String(p.id))} style={btn('#fff', G)}>افتحها</button>
                {a?.contact_email ? <button disabled={!!busy} onClick={() => confirm('اعتماد الاستشارة وإرسالها إلى ' + a.contact_email + '؟') && act({ id: p.id, action: 'release', channel: 'email' }, 'اعتماد الاستشارة وإرسالها', '/api/admin/awards/gap')} style={btn(G)}>اعتمد وأرسل بالبريد</button> : null}
                <button disabled={!!busy} onClick={() => confirm('اعتمادها وتسجيلها مرسَلةً بالواتساب؟') && act({ id: p.id, action: 'release', channel: 'whatsapp' }, 'اعتماد الاستشارة (واتساب)', '/api/admin/awards/gap').then((j) => { if (j?.url) window.open(String(j.url), '_blank') })} style={btn('#fff', G)}>اعتمد — واتساب</button>
              </div>
            )
          })}

          <H t="نصوصٌ جديدة أو معدَّلة تنتظر اعتمادك" n={dc.templates.length + dc.texts.length + dc.hypotheses.length + dc.template_recs.length} />
          {dc.texts.map((k) => <div key={k} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '4px 0' }}><span style={{ fontSize: 13.5 }}>{TEXT_KEYS[k] || k} عُدّل ولم يُعتمد (راجعه في «الترسيات ← القوالب والإعدادات»)</span><button disabled={!!busy} onClick={() => act({ action: 'text_approve', key: k }, 'اعتماد ' + (TEXT_KEYS[k] || k))} style={btn(G)}>اعتمد</button></div>)}
          {dc.templates.map((t) => (
            <div key={String(t.id)} style={{ padding: '6px 0', borderBottom: '1px dashed ' + LINE }}>
              <div style={{ fontSize: 12, color: M, fontWeight: 800 }}>قالب {String(t.category)} / {String(t.stage)}</div>
              <div style={{ fontWeight: 800, fontSize: 13.5 }}>{String(t.subject)}</div>
              <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.8 }}>{String(t.context_paragraph)}</div>
              <button disabled={!!busy} onClick={() => act({ action: 'template_approve', id: t.id }, 'اعتماد القالب')} style={{ ...btn(G), marginTop: 4 }}>اعتمد القالب</button>
            </div>
          ))}
          {dc.hypotheses.map((h) => (
            <div key={String(h.id)} style={{ padding: '6px 0', borderBottom: '1px dashed ' + LINE }}>
              <div style={{ fontSize: 12, color: M, fontWeight: 800 }}>فرضية {String(h.category)} / {String(h.stage)}</div>
              <div style={{ fontSize: 13.5 }}><b>الفرضية:</b> {String(h.hypothesis)}</div>
              <div style={{ fontSize: 13.5 }}><b>السؤال:</b> {String(h.question)}</div>
              <button disabled={!!busy} onClick={() => act({ action: 'hypothesis_approve', id: h.id }, 'اعتماد الفرضية')} style={{ ...btn(G), marginTop: 4 }}>اعتمد</button>
            </div>
          ))}
          {dc.template_recs.map((r) => <RecLine key={String(r.id)} r={r} busy={busy} reason={reason} setReason={setReason} act={act} />)}

          <H t="اعتراضاتٌ مهمة" n={dc.objections.length} />
          {dc.objections.map((t) => <div key={String(t.id)} style={{ fontSize: 13.5, padding: '4px 0' }}>⚠️ {name(t)} — «{String(t.objection)}»{t.said ? ' · قال: «' + String(t.said) + '»' : ''} ({String(t.actor)}، {when(t.created_at)})</div>)}

          <H t="علّمها Codex: تحتاج قرارك" n={dc.flagged.length} />
          {dc.flagged.map((p) => (
            <div key={String(p.id)} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', padding: '4px 0' }}>
              <span style={{ fontSize: 13.5 }}>🔷 {name(p)} — {String((p.award as Row | null)?.codex_reason || '')}</span>
              <button disabled={!!busy} onClick={() => { const n = prompt('قرارك (يُسجَّل):'); if (n) void act({ action: 'flag_done', id: p.id, note: n }, 'حسم التعليم') }} style={btn('#fff', G)}>حُسم</button>
            </div>
          ))}

          <H t="فرصٌ عالية القيمة مفتوحة" n={dc.high_value.length} />
          {dc.high_value.map((p) => <div key={String(p.id)} style={{ fontSize: 13.5, padding: '3px 0' }}>💠 {name(p)} — {String(p.state)} · {String(p.responsible || '')}: {String(p.next_step || '')}</div>)}

          <H t="متأخرةٌ عن موعدها" n={dc.overdue.length} />
          {dc.overdue.map((p) => <div key={String(p.id)} style={{ fontSize: 13.5, padding: '3px 0', color: RED }}>⏰ {name(p)} — {String(p.responsible)}: {String(p.next_step)} (موعدها {when(p.next_at)})</div>)}
        </div>

        {/* ═══ صندوق التوصيات ═══ */}
        <div style={card}>
          <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 6 }}>صندوق توصيات Codex ({d.recommendations.filter((r) => r.kind !== 'template').length.toLocaleString('ar-SA')})</div>
          <div style={{ color: M, fontSize: 12.5, marginBottom: 8 }}>التوصية لا تعدّل شيئاً حتى تُقبل. القبول يكتب عبر القيود القائمة (المصدر إلزامي)، والرفض بسببٍ يصل Codex في قراءته التالية.</div>
          {d.recommendations.filter((r) => r.kind !== 'template').map((r) => <RecLine key={String(r.id)} r={r} busy={busy} reason={reason} setReason={setReason} act={act} />)}
        </div>

        {/* ═══ الصادر ═══ */}
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ fontWeight: 900, fontSize: 16 }}>الصادر — البريد الآلي</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button disabled={!!busy} onClick={() => confirm(d.outbox.enabled ? 'إيقاف كل إرسالٍ آلي فوراً؟' : 'تشغيل الإرسال الآلي؟') && act({ action: 'outbox', enabled: !d.outbox.enabled }, d.outbox.enabled ? 'الإيقاف الكلي' : 'التشغيل')}
                style={btn(d.outbox.enabled ? RED : G)}>{d.outbox.enabled ? '⏹ أوقف كل الإرسال' : '▶ شغّل الإرسال'}</button>
              <button disabled={!!busy || !d.outbox.enabled} onClick={() => act({ action: 'outbox_run' }, 'دورة الصادر')} style={btn('#fff', G)}>شغّل الدورة الآن</button>
            </div>
          </div>
          <div style={{ color: M, fontSize: 13, margin: '6px 0' }}>
            {d.outbox.enabled ? 'يعمل' : 'موقوف'} · السقف {d.outbox.cap} يومياً (أُرسل اليوم {d.outbox.sent_today}) · أحد–خميس {d.outbox.hours} بتوقيت الرياض · {d.outbox.window.ok ? 'داخل النافذة الآن' : d.outbox.window.why}
          </div>
          {d.outbox.items.slice(0, 15).map((o) => (
            <div key={String(o.id)} style={{ fontSize: 12.5, padding: '3px 0', borderTop: '1px dashed ' + LINE }}>
              <b style={{ color: o.status === 'sent' ? '#1A5C46' : o.status === 'failed' || o.status === 'cancelled' ? RED : '#8A6D1F' }}>{({ pending: 'بانتظار', sending: 'يُرسل', sent: 'أُرسل', failed: 'فشل ويُعاد', cancelled: 'أُلغي' } as Record<string, string>)[String(o.status)]}</b>
              {' '}{String(o.to_address)} — {String(o.subject)} · محاولات {String(o.attempts)}{o.last_error ? ' · ' + String(o.last_error) : ''}{o.sent_at ? ' · ' + when(o.sent_at) : ''}
            </div>
          ))}
        </div>

        {/* ═══ واتساب المنصة (بدل ضي عند غيابها) ═══
            ★ ١ أكتوبر (بأمر المالك): موقوف ومخفيّ — الواتساب بيد ضي وحدها. يُظهره ويشغّله
              إعداد whatsapp_api_enabled وحده (لا يُحذف الكود). */}
        {!d.whatsapp.switch_on ? (
          <div style={{ ...card, color: M, fontSize: 12.5, fontWeight: 700 }}>واتساب المنصة موقوف بأمر الدكتور — الواتساب بيد ضي وحدها.</div>
        ) : (
        <div style={card}>
          <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 4 }}>واتساب المنصة — بدل ضي عند غيابها</div>
          <div style={{ color: M, fontSize: 12.5, marginBottom: 8 }}>
            {d.whatsapp.active ? '✅ يعمل: فرصةٌ برقمٍ موثّق لم تتواصل معها ضي خلال ' + d.whatsapp.backup_hours + ' ساعة تُرسل لها المنصة الواتساب باسم المكتب، وتُسجَّل «بدل ضي».'
              : 'غير مفعَّل بعد. يحتاج حساب WhatsApp Business (Meta): رقم الهاتف (Phone number ID)، والرمز الدائم، واسم قالبٍ معتمد من Meta بمتغيّرين: {{1}} اسم العقد و{{2}} الجهة.'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 8 }}>
            {([['phone_number_id', 'Phone number ID', d.whatsapp.phone_number_id], ['template', 'اسم القالب المعتمد', d.whatsapp.template], ['lang', 'لغة القالب', d.whatsapp.lang], ['backup_hours', 'بدل ضي بعد (ساعات)', d.whatsapp.backup_hours]] as const).map(([k, l, v]) => (
              <label key={k} style={{ fontSize: 11.5, color: M, fontWeight: 700 }}>{l}
                <input value={wa[k] ?? v} onChange={(e) => setWa({ ...wa, [k]: e.target.value })} style={{ width: '100%', border: '1px solid ' + LINE, borderRadius: 8, padding: '7px 10px', fontFamily: 'inherit', fontSize: 13.5, direction: 'ltr', boxSizing: 'border-box' }} />
              </label>
            ))}
            <label style={{ fontSize: 11.5, color: M, fontWeight: 700 }}>الرمز الدائم {d.whatsapp.has_token ? '(محفوظ — اتركه فارغاً)' : ''}
              <input type="password" autoComplete="off" value={wa.token || ''} onChange={(e) => setWa({ ...wa, token: e.target.value })} placeholder={d.whatsapp.has_token ? '••••••••' : 'يُلصق هنا ولا يظهر بعدها'} style={{ width: '100%', border: '1px solid ' + LINE, borderRadius: 8, padding: '7px 10px', fontFamily: 'inherit', fontSize: 13.5, direction: 'ltr', boxSizing: 'border-box' }} />
            </label>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8, alignItems: 'center' }}>
            <button disabled={!!busy} onClick={async () => { await act({ action: 'wa_config', ...wa }, 'حفظ إعداد الواتساب'); setWa({}) }} style={btn(G)}>احفظ</button>
            <button disabled={!!busy} onClick={() => act({ action: 'wa_config', enabled: !d.whatsapp.switch_on }, d.whatsapp.switch_on ? 'إيقاف واتساب المنصة' : 'تشغيل واتساب المنصة')} style={btn(d.whatsapp.switch_on ? RED : G)}>{d.whatsapp.switch_on ? '⏹ أوقفه' : '▶ شغّله'}</button>
            <button disabled={!!busy} onClick={() => { const to = prompt('رقم تصله رسالة الاختبار (05…):'); if (to) void act({ action: 'wa_test', to }, 'رسالة واتساب تجريبية') }} style={btn('#fff', G)}>أرسل تجربة</button>
          </div>
        </div>
        )}

        {/* ═══ مفتاح Codex ═══ */}
        <div style={card}>
          <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 6 }}>ربط Codex</div>
          <div style={{ background: '#FBF5E8', color: '#8A6D1F', borderRadius: 8, padding: '8px 12px', fontSize: 12.5, fontWeight: 800, marginBottom: 8 }}>Codex موقوف بأمر الدكتور (codex_enabled) — المفتاح والجسر نائمان بلا حذف، وكل طلبٍ منه يُرَدّ.</div>
          <div style={{ background: d.mcp.linked ? '#EAF6F1' : '#F2F5F4', borderRadius: 10, padding: '8px 12px', fontSize: 13, marginBottom: 10, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <b>إضافة ChatGPT:</b> {d.mcp.linked ? 'مربوطة (بموافقتك) · آخر استعمال ' + when(d.mcp.last_used_at) : 'غير مربوطة — تُضاف في ChatGPT بعنوان https://murdi.sa/api/mcp'}
            {d.mcp.linked && <button disabled={!!busy} onClick={() => confirm('إلغاء ربط ChatGPT كله؟') && act({ action: 'mcp_revoke' }, 'إلغاء الربط')} style={btn('#fff', RED)}>ألغِ الربط</button>}
          </div>
          <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 4 }}>مفتاح يدوي (بديل للإضافة)</div>
          <div style={{ color: M, fontSize: 12.5, marginBottom: 8 }}>يُعرض المفتاح مرةً واحدة هنا عند إنشائه — ضعه سرّاً في بيئة Codex (Authorization: Bearer …). الإنشاء يُلغي السابق (تدوير).</div>
          {newKey && (
            <div style={{ background: '#FFF6E0', border: '1px solid #EAD9A8', borderRadius: 10, padding: 10, marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#8A6D1F' }}>انسخه الآن — لن يظهر ثانية:</div>
              <code style={{ direction: 'ltr', display: 'block', wordBreak: 'break-all', fontSize: 13, margin: '6px 0' }}>{newKey}</code>
              <button onClick={() => { void navigator.clipboard.writeText(newKey); setOk('نُسخ') }} style={btn(G)}>انسخ</button>
              <button onClick={() => setNewKey('')} style={{ ...btn('#fff', G), marginRight: 6 }}>أخفِه</button>
            </div>
          )}
          <button disabled={!!busy} onClick={async () => { if (!confirm('إنشاء مفتاحٍ جديد لـ Codex؟ (يُلغى السابق)')) return; const j = await act({ action: 'key_create' }, 'إنشاء المفتاح'); if (j?.key) setNewKey(String(j.key)) }} style={btn(G)}>أنشئ مفتاحاً جديداً</button>
          {d.keys.map((k) => (
            <div key={String(k.id)} style={{ fontSize: 12.5, padding: '4px 0', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <code style={{ direction: 'ltr' }}>{String(k.key_prefix)}…</code>
              <span style={{ color: k.revoked_at ? RED : '#1A5C46', fontWeight: 800 }}>{k.revoked_at ? 'ملغى ' + when(k.revoked_at) : 'فعّال'}</span>
              <span style={{ color: M }}>أُنشئ {when(k.created_at)} · آخر استعمال {when(k.last_used_at)}</span>
              {!k.revoked_at && <button disabled={!!busy} onClick={() => confirm('إلغاء المفتاح؟ يتوقف Codex فوراً.') && act({ action: 'key_revoke', id: k.id }, 'إلغاء المفتاح')} style={btn('#fff', RED)}>ألغِه</button>}
            </div>
          ))}
          {d.cursor && <div style={{ fontSize: 12, color: M, marginTop: 6 }}>مؤشر القراءة: آخر ما أكّده Codex {String(d.cursor.acked || '—').split('|')[0].slice(0, 19)} · آخر ما سُلِّم {String(d.cursor.served || '—').split('|')[0].slice(0, 19)}</div>}
          {d.calls.length > 0 && <div style={{ fontSize: 12, color: M, marginTop: 6 }}>آخر الاستدعاءات: {d.calls.slice(0, 6).map((c) => String(c.method) + ' ' + String(c.path) + ' ' + String(c.status)).join(' · ')}</div>}
        </div>

        {/* ═══ خريطة الفرص ═══ */}
        <div style={card}>
          <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 6 }}>الفرص — الحالة والمسؤول والخطوة التالية</div>
          <div style={{ color: M, fontSize: 12.5, marginBottom: 8 }}>{Object.entries(d.metric.by_state).map(([k, v]) => k + ' ' + v).join(' · ')}</div>
          {[...d.pipeline].filter((p) => p.responsible).sort((x, y) => Number(y.score) - Number(x.score)).map((p) => (
            <div key={String(p.id)} style={{ padding: '6px 0', borderTop: '1px dashed ' + LINE, fontSize: 13 }}>
              <b>{name(p)}</b> — <span style={{ fontWeight: 800 }}>{String(p.state)}</span> · {String(p.responsible)}: {String(p.next_step)} · {p.overdue ? <span style={{ color: RED, fontWeight: 800 }}>متأخرة ({when(p.next_at)})</span> : when(p.next_at)}
              <div style={{ color: M, fontSize: 12 }}>الدرجة {String(p.score)} — {String(p.score_why)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function RecLine({ r, busy, reason, setReason, act }: { r: Row; busy: string; reason: Record<string, string>; setReason: (x: Record<string, string>) => void; act: (b: Record<string, unknown>, w: string) => Promise<Row | null> }) {
  const id = String(r.id)
  return (
    <div style={{ padding: '8px 0', borderTop: '1px dashed ' + LINE }}>
      <div style={{ fontSize: 12, color: M, fontWeight: 800 }}>{REC_KIND[String(r.kind)] || String(r.kind)} · {name(r)} · ثقة {r.confidence === null || r.confidence === undefined ? '—' : Math.round(Number(r.confidence) * 100) + '٪'} · {when(r.created_at)}</div>
      <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 13, margin: '4px 0', direction: 'rtl' }}>{JSON.stringify(r.value, null, 1)}</pre>
      {Array.isArray(r.evidence) && r.evidence.length > 0 && <div style={{ fontSize: 12 }}>{(r.evidence as string[]).map((u) => <a key={u} href={u} target="_blank" rel="noopener noreferrer" style={{ color: G, marginLeft: 8 }}>دليل ↗</a>)}</div>}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
        <input value={reason[id] || ''} onChange={(e) => setReason({ ...reason, [id]: e.target.value })} placeholder="السبب (لازمٌ للرفض)" style={{ flex: '1 1 200px', border: '1px solid ' + LINE, borderRadius: 8, padding: '6px 10px', fontFamily: 'inherit', fontSize: 13 }} />
        <button disabled={!!busy} onClick={() => act({ action: 'decide', id, accept: true, reason: reason[id] || '' }, 'قبول التوصية')} style={btn(G)}>اقبل</button>
        <button disabled={!!busy || !reason[id]} onClick={() => act({ action: 'decide', id, accept: false, reason: reason[id] || '' }, 'رفض التوصية')} style={{ ...btn('#fff', RED), opacity: reason[id] ? 1 : 0.5 }}>ارفض</button>
      </div>
    </div>
  )
}
