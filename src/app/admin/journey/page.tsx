'use client'
import AdminNav from '@/components/AdminNav'
import CallIntake, { sizeFromText } from '@/components/CallIntake'
import StaffBrief from '@/components/StaffBrief'
import { OUTCOMES } from '@/lib/outcomes'
import { waNumber } from '@/lib/phone'
import { useCallback, useEffect, useMemo, useState } from 'react'

// شاشة الموظفة الواحدة (١١ أكتوبر، المالك).
//
// «الموظفة عندك كذا تبويب ولخبطة وفوقها إيميلات، ما تعرف تلحق مين وتخلّي مين،
//  وضي تسلّم رغد عميلاً ثم تسأل وينه وش صار عليه» — فصارت لكل واحدةٍ صفحةٌ
// واحدة مرتّبةٌ بمراحل عملها، من أول خطوةٍ إلى آخرها:
//   · ضي: جديد لم يُكلَّم ← تحت المتابعة ← طلب ولم يدفع ← حوّل وينتظر التأكيد ← دفع وعند رغد
//   · رغد: استلام ← جمع المستندات ← عند الجهات ← وافقت جهة ← نزل التمويل
// والقسم الأخير عند ضي («عملائي عند رغد») قراءةٌ فقط: ترى أين وصل كل عميلٍ سلّمته،
// ولا تملك فيه زرّاً. والكتابة كلها تمرّ بالمسارات القائمة نفسها وحرّاسها.

const C = { ink: '#1A3D34', soft: '#5E7C73', line: '#E4EFEA', bg: '#F7FBF9', gold: '#C9A84C', red: '#B4622A', green: '#1A6B55', pale: '#EEF6F2' }

type Hot = {
  source: string; ref_id: string; name: string | null; person: string | null; phone: string | null
  email: string | null; company_id: string | null; tier: number; reason: string; at: string | null
  next_step: string; opener: string | null; touches: number; last_outcome: string | null; last_note: string | null
  last_at: string | null; next_action_at: string | null; state: string; follow?: boolean; last_actor?: string | null
  owner?: string | null; owner_name?: string | null; mine?: boolean
  ask?: { id: string; ask_message: string; ask_sent_at: string | null; ask_reply: string | null; ask_reply_at: string | null; consult_status: string | null; consult_code: string | null; consult_sent_at: string | null; consult_opened_at: string | null } | null
}
type File = {
  request_id: string; company_id: string; name: string; owner: string; phone: string; service: string
  outreach: boolean; stage: string; stage_label: string; paid_at: string | null
  counts: { sent: number; replied: number; presented: number }; funder: string | null; expected: string | null
  last_update: string; missing: string; next: string; last_by: string; last_at: string | null
  idle_days: number; handled_by: string[]; paused: boolean; done: boolean
}

const days = (d: string | null) => (d ? Math.floor((Date.now() - new Date(d).getTime()) / 86400000) : null)
const ago = (d: string | null) => { const n = days(d); return n == null ? '' : n <= 0 ? 'اليوم' : n === 1 ? 'أمس' : 'قبل ' + n + ' يوم' }
const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString('ar-SA-u-ca-gregory', { day: 'numeric', month: 'long' }) : '')

// مراحل ضي — كل صفٍّ من «الفرص الساخنة» يقع في مرحلةٍ واحدة
const DHAI_STEPS = [
  { key: 'new', short: 'جديد', label: 'جديد — ما انكلّم', hint: 'رفع يده وما أحد كلّمه. ابدئي بهم.' },
  { key: 'follow', short: 'متابعة', label: 'تحت المتابعة', hint: 'كلّمتِه وينتظر خطوة — المعاودة في موعدها.' },
  { key: 'ordered', short: 'طلب ولم يدفع', label: 'طلب ولم يدفع', hint: 'اقتنع وطلب — باقي التحويل.' },
  { key: 'transfer', short: 'حوّل', label: 'حوّل — أكّدي الاستلام', hint: 'العميل دفع، والانتظار علينا لا عليه.' },
  { key: 'paid', short: 'عند رغد', label: 'دفع — عند رغد', hint: 'سلّمتِه. هنا ترين أين وصل.' },
] as const

const RAGHAD_STEPS = [
  { key: 'received', short: 'استلام', label: 'استلام جديد', hint: 'دفع وما بدأ عليه شي — اتصلي بالعميل اليوم.' },
  { key: 'docs', short: 'المستندات', label: 'جمع المستندات', hint: 'اجمعي الناقص وجهّزي الملف.' },
  { key: 'funders', short: 'عند الجهات', label: 'عند الجهات', hint: 'الملف عند جهات التمويل — تابعي بالاتصال.' },
  { key: 'approved', short: 'وافقت جهة', label: 'وافقت جهة', hint: 'باقي الصرف — تابعي موعده.' },
  { key: 'funded', short: 'نزل التمويل', label: 'نزل التمويل', hint: 'اكتمل ✓' },
] as const
// خدمات لا مخاطبة فيها (الجدوى، الحكم الائتماني…) مرحلتها أقصر
const RAGHAD_OTHER = [
  { key: 'received', label: 'استلام جديد' }, { key: 'working', label: 'قيد التنفيذ' }, { key: 'delivered', label: 'سُلّمت' },
]

function dhaiStep(r: Hot): string {
  if (r.source === 'transfer') return 'transfer'
  if (r.source === 'ordered' || r.source === 'contract') return 'ordered'
  return r.touches > 0 ? 'follow' : 'new'
}

export default function JourneyPage() {
  const [role, setRole] = useState<string>('')
  const [job, setJob] = useState<string>('')
  const [view, setView] = useState<'dhai' | 'raghad'>('dhai')
  const [files, setFiles] = useState<File[]>([])
  const [hot, setHot] = useState<Hot[]>([])
  const [me, setMe] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setErr('')
    const j = await fetch('/api/staff/journey', { cache: 'no-store' }).then(r => r.json()).catch(() => null)
    if (!j || j.error) { setErr(j?.error || 'تعذّر التحميل — حدّثي الصفحة'); setLoading(false); return }
    setRole(j.role); setJob(j.job); setMe(j.me || ''); setFiles(j.files || [])
    // رغد تقوم مقام ضي أيضاً (١٢ أكتوبر) — فتُحمَّل لها قائمة ما قبل الدفع
    const seesDhai = j.role === 'admin' || j.job === 'followup' || j.job === 'assistant'
    if (seesDhai) {
      const h = await fetch('/api/admin/hot', { cache: 'no-store' }).then(r => r.json()).catch(() => null)
      if (h && !h.error) setHot(h.rows || [])
      else setErr(h?.error || 'تعذّر تحميل قائمة العملاء')
    }
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const isAdmin = role === 'admin'
  const isRaghad = !isAdmin && job === 'assistant'
  const showDhai = isAdmin || isRaghad ? view === 'dhai' : job === 'followup'

  return (
    <div dir="rtl" style={{ fontFamily: 'Cairo,sans-serif', color: C.ink, background: C.bg, minHeight: '100vh' }}>
      <AdminNav />
      <div style={{ maxWidth: 980, margin: '0 auto', padding: '18px 16px 60px' }}>
        {(isAdmin || isRaghad) && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            {(isRaghad
              ? [['dhai', 'عملائي — قبل الدفع'], ['raghad', 'ملفّاتي — بعد الدفع']] as const
              : [['dhai', 'شاشة ضي — حتى الدفع'], ['raghad', 'شاشة رغد — بعد الدفع']] as const).map(([k, t]) => (
              <button key={k} onClick={() => setView(k)} style={pill(view === k)}>{t}</button>
            ))}
          </div>
        )}
        {/* توجيه اليوم — كان في الشاشات القديمة وحدها، فلم تره رغد بعد أن صارت هذه شاشتها (١٣ أكتوبر) */}
        {!isAdmin && !loading && <StaffBrief />}
        {err && <div style={{ background: '#FDF1EC', border: '1.5px solid #F0D6D2', color: '#B4453C', borderRadius: 12, padding: '11px 15px', marginBottom: 14, fontSize: 13, fontWeight: 800 }}>{err}</div>}
        {loading ? <p style={{ color: C.soft }}>جارٍ التحميل…</p>
          : showDhai ? <DhaiBoard hot={hot} files={files} me={me} isAdmin={isAdmin} reload={load} />
          : <RaghadBoard files={files} reload={load} />}
      </div>
    </div>
  )
}

// ═══════════════════════════ ضي ═══════════════════════════
function DhaiBoard({ hot: allHot, files, me, isAdmin, reload }: { hot: Hot[]; files: File[]; me: string; isAdmin: boolean; reload: () => void }) {
  const [step, setStep] = useState<string>('')
  // ★ ١٣ أكتوبر (المالك): العملاء كلهم هنا — لضي — ورغد تدخل وتكلّم وتكتب النتيجة،
  //   ومن كتب آخر نتيجة يظهر على البطاقة. والبحث يمرّ على الجميع.
  // ★ ١٤ أكتوبر (المالك): العملاء مقسومون بالمناصفة — كلٌّ تمسك عملاءها من الاتصال إلى فتح الملف،
  //   وترى عملاء زميلتها اسماً فقط (الخادم يحذف بياناتهم أصلاً). والمالك يرى الجميع ويصفّي بالموظفة.
  const [ownerF, setOwnerF] = useState<string>('')
  const hot = allHot.filter(r => r.mine !== false && (!ownerF || r.owner === ownerF))
  const others = allHot.filter(r => r.mine === false && r.source !== 'account')
  const [showOthers, setShowOthers] = useState(false)
  const [focus, setFocus] = useState<string>('')
  const [showAcc, setShowAcc] = useState(false)
  const accRows = allHot.filter(r => r.source === 'account' && r.state !== 'closed').sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')))
  const [q, setQ] = useState('')
  const [adding, setAdding] = useState(false)
  const norm = (s: string) => String(s || '').replace(/\D/g, '').slice(-9)
  const hit = (r: Hot) => {
    const t = q.trim()
    return [r.name, r.person, r.email].some(x => String(x || '').includes(t)) || (norm(t).length >= 4 && norm(String(r.phone || '')).includes(norm(t)))
  }
  const found = q.trim().length < 2 ? [] : hot.filter(hit).slice(0, 20)
  const foundOthers = q.trim().length < 2 ? [] : others.filter(hit).slice(0, 10)
  // حسابات بلا جوال (بريدٌ فقط) تبقى في القائمة الكاملة — لا تُزاحم من يُتّصل به
  const accounts = hot.filter(r => r.state !== 'closed' && r.source === 'account').length
  const live = hot.filter(r => r.state !== 'closed' && r.source !== 'account')
  const mine = (f: File) => (me ? f.handled_by.includes(me) : f.handled_by.length > 0)
  const by = useMemo(() => {
    const m: Record<string, Hot[]> = { new: [], follow: [], ordered: [], transfer: [] }
    for (const r of live) m[dhaiStep(r)].push(r)
    // اليوم أولاً، ثم ما موعده لاحق
    for (const k of Object.keys(m)) m[k].sort((a, b) => (Number(a.state === 'waiting') - Number(b.state === 'waiting')) || (a.tier - b.tier) || String(b.at || '').localeCompare(String(a.at || '')))
    return m
  }, [live])
  // عملاؤها أولاً — من لمسته هي (أو أي أحدٍ قبل الدفع)، ثم الباقي
  // منشأةٌ لها خدمتان (ملف تمويل + قوائم) تُعرض مرةً واحدة عند ضي — بخدمة التمويل
  const oneEach = Array.from(files.reduce((m, f) => { const o = m.get(f.company_id); if (!o || (!o.outreach && f.outreach)) m.set(f.company_id, f); return m }, new Map<string, File>()).values())
  const paid = [...oneEach].sort((a, b) => (Number(mine(b)) - Number(mine(a))) || (Number(a.done) - Number(b.done)) || String(b.paid_at || '').localeCompare(String(a.paid_at || '')))
  // ★ «جديد» يُقسم بالعمر: من وصل في آخر ٧ أيام يُكلَّم اليوم وأحدثُه أولاً (أدفأ ما
  //   يكون في ساعته الأولى)؛ والأقدم يُطوى تحت زرّ — كان يملأ الشاشة بمئة اسمٍ من يونيو.
  const FRESH = 7
  // ★ وداخل الجديد: من لم يُكلَّم أصلاً أولاً، ثم الأعلى درجةً — فقد بقي «turki» بدرجة ٩٨
  //   يومين بلا اتصال وكُلِّم من تحته. والدرجة تُقرأ من سطر السبب «بدرجة N».
  const score = (r: Hot) => Number((r.reason.match(/بدرجة\s*(\d+)/) || [])[1] || 0)
  const fresh = by.new.filter(r => (days(r.at) ?? 99) <= FRESH).sort((a, b) => (Number(a.touches > 0) - Number(b.touches > 0)) || (score(b) - score(a)) || String(b.at || '').localeCompare(String(a.at || '')))
  const old = by.new.filter(r => (days(r.at) ?? 99) > FRESH)
  const followDue = by.follow.filter(r => r.state !== 'waiting')
  const followLater = by.follow.filter(r => r.state === 'waiting').sort((a, b) => String(a.next_action_at || '').localeCompare(String(b.next_action_at || '')))
  const counts: Record<string, number> = {
    new: by.new.length, follow: by.follow.length,
    ordered: by.ordered.length, transfer: by.transfer.length, paid: oneEach.filter(f => !f.done).length,
  }
  const today = by.transfer.length + by.ordered.filter(r => r.state !== 'waiting').length + followDue.length + fresh.length
  const [showOld, setShowOld] = useState(false)
  const [showLater, setShowLater] = useState(false)
  const list = (l: Hot[]) => l.length === 0 ? <Empty /> : <div style={{ display: 'grid', gap: 9 }}>{l.map(r => <LeadCard key={r.source + r.ref_id} r={r} reload={reload} showOwner={isAdmin} />)}</div>
  // ═══ لا عميل معلّق (١٤ أكتوبر): كل ما ينتظر منها خطوة، بعدده — وبضغطة يُعرض وحده ═══
  const mineLive = live
  const PEND: { key: string; label: string; rows: Hot[] }[] = [
    { key: 'call', label: '📞 لم يُكلَّموا', rows: mineLive.filter(r => r.touches === 0 && r.source !== 'ordered' && r.source !== 'transfer' && r.source !== 'contract' && (days(r.at) ?? 99) <= 7) },
    { key: 'ask', label: '📝 أسئلة لم تُرسل', rows: mineLive.filter(r => r.ask && !r.ask.ask_sent_at && !r.ask.ask_reply) },
    { key: 'consult', label: '✨ استشارات جاهزة لم تُرسل', rows: mineLive.filter(r => r.ask && r.ask.consult_status === 'ready' && !r.ask.consult_sent_at) },
    { key: 'reply', label: '⏳ ننتظر ردّهم على الأسئلة', rows: mineLive.filter(r => r.ask && r.ask.ask_sent_at && !r.ask.ask_reply) },
    { key: 'invoice', label: '🧾 فواتير لم تُدفع', rows: mineLive.filter(r => r.source === 'ordered' || r.source === 'contract') },
    { key: 'transfer', label: '💰 حوّل — أكّدي الاستلام', rows: mineLive.filter(r => r.source === 'transfer') },
  ]
  const focused = PEND.find(x => x.key === focus)
  const todayKey = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' })
  const isToday = (d: string | null) => !!d && new Date(d).toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' }) === todayKey
  const allLive = allHot.filter(r => r.source !== 'account')
  const arrivedToday = allLive.filter(r => isToday(r.at) && r.source !== 'ordered' && r.source !== 'transfer')
  const team = Array.from(new Set(allLive.map(r => r.owner_name).filter(Boolean))) as string[]
  // الأقسام تُعرض بترتيب الأولوية — الأقرب للمال أولاً — والشريط فوقها بترتيب الرحلة
  const ORDER = ['transfer', 'ordered', 'follow', 'new', 'paid']
  const shown = (step ? DHAI_STEPS.filter(s => s.key === step) : [...DHAI_STEPS]).sort((a, b) => ORDER.indexOf(a.key) - ORDER.indexOf(b.key))

  return (
    <>
      <h1 style={{ fontSize: 21, fontWeight: 900, margin: '0 0 4px' }}>عملائي — من الباب إلى الدفع</h1>
      <p style={{ fontSize: 13, color: C.soft, margin: '0 0 14px', lineHeight: 1.8 }}>
        عندك اليوم <b style={{ color: C.ink }}>{today}</b> عميل يحتاج منك خطوة — رتّبتهم لك من الأقرب للدفع، فابدئي من الأعلى.
      </p>
      <div style={{ ...card, marginBottom: 12, padding: '10px 14px' }}>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 13, fontWeight: 800 }}>
          <span>وصل المنصة اليوم: <b style={{ color: C.green }}>{arrivedToday.length}</b></span>
          {team.map(n => <span key={n} style={{ color: C.soft }}>{n}: <b style={{ color: C.ink }}>{arrivedToday.filter(r => r.owner_name === n).length}</b></span>)}
        </div>
        {isAdmin && team.length > 0 && (
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            <button onClick={() => setOwnerF('')} style={pill(!ownerF)}>الكل</button>
            {Array.from(new Map(allLive.filter(r => r.owner).map(r => [r.owner as string, r.owner_name || ''])).entries()).map(([id, n]) => <button key={id} onClick={() => setOwnerF(id)} style={pill(ownerF === id)}>{n}</button>)}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {PEND.filter(x => x.rows.length > 0).map(x => (
          <button key={x.key} onClick={() => setFocus(focus === x.key ? '' : x.key)} style={{ ...pill(focus === x.key), fontSize: 12.5 }}>{x.label} <b>({x.rows.length})</b></button>
        ))}
        {PEND.every(x => x.rows.length === 0) && <span style={{ fontSize: 12.5, color: C.green, fontWeight: 800 }}>✓ لا عميل معلّق عندك</span>}
      </div>
      {focused && (
        <section style={{ marginBottom: 18 }}>
          <SectionHead label={focused.label} hint="اضغطي الزر مرة ثانية للرجوع للقائمة كاملة." n={focused.rows.length} />
          {list(focused.rows)}
        </section>
      )}
      {!focused && <Pipeline steps={DHAI_STEPS.map(s => ({ key: s.key, label: s.short, n: counts[s.key] }))} active={step} onPick={setStep} />}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14, alignItems: 'center' }}>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="🔎 ابحثي عن عميل — بالاسم أو المنشأة أو الجوال" style={{ ...input, flex: '1 1 260px', width: 'auto' }} />
        <button onClick={() => setAdding(!adding)} style={{ ...btn(false), borderStyle: 'dashed' }}>{adding ? 'إغلاق' : '➕ عميل ليس في القائمة (إيميل أو مكالمة)'}</button>
      </div>
      {adding && <div style={{ ...card, marginTop: 10, borderColor: C.gold }}><CallIntake onDone={() => { setAdding(false); reload() }} /></div>}
      {q.trim().length >= 2 && (
        <section style={{ marginTop: 12 }}>
          <div style={{ fontSize: 12.5, fontWeight: 900, color: C.soft, marginBottom: 7 }}>نتائج البحث ({found.length}){found.length === 0 ? ' — غير موجود في المنصة؟ أضيفيه من «عميل ليس في القائمة»' : ''}</div>
          <div style={{ display: 'grid', gap: 9 }}>{found.map(r => <LeadCard key={'s' + r.source + r.ref_id} r={r} reload={reload} showOwner={isAdmin} />)}</div>
          {foundOthers.length > 0 && <div style={{ fontSize: 12.5, color: C.soft, marginTop: 8 }}>{foundOthers.map(r => (r.name || '—') + ' — عند ' + (r.owner_name || 'زميلتك')).join(' · ')}</div>}
        </section>
      )}

      {!focused && shown.filter(s => step || counts[s.key] > 0 || s.key === 'new').map(s => (
        <section key={s.key} style={{ marginTop: 22 }}>
          <SectionHead label={s.label} hint={s.hint} n={counts[s.key]} />
          {s.key === 'paid' ? (
            paid.length === 0 ? <Empty /> : <div style={{ display: 'grid', gap: 9 }}>{paid.map(f => <PaidCard key={f.request_id} f={f} readOnly mine={mine(f)} />)}</div>
          ) : s.key === 'new' ? (
            <>
              {fresh.length > 0 ? list(fresh) : <p style={{ fontSize: 12.5, color: C.soft, margin: 0 }}>ما وصل أحد جديد في آخر أسبوع.</p>}
              {old.length > 0 && <Toggle open={showOld} onClick={() => setShowOld(!showOld)} label={'أقدم من أسبوع ولم يُكلَّموا (' + old.length + ')'} />}
              {showOld && list(old.slice(0, 80))}
              {/* ★ ١٣ أكتوبر: «في ناس بالإيميل ما يطلعون لي» — من سجّل حساباً ببريده ولم يُكمل
                  منشأته لا جوال له، فكان يُعدّ هنا رقماً فقط ويُحال إلى صفحةٍ أخرى. فصار هنا بأسمائه وبريده. */}
              {isAdmin && accounts > 0 && <Toggle open={showAcc} onClick={() => setShowAcc(!showAcc)} label={'📧 سجّلوا بالبريد فقط ولم يُكملوا (' + accounts + ')'} />}
              {isAdmin && showAcc && list(accRows.slice(0, 80))}
            </>
          ) : s.key === 'follow' ? (
            <>
              {followDue.length > 0 ? list(followDue) : <p style={{ fontSize: 12.5, color: C.soft, margin: 0 }}>لا معاودة مستحقة اليوم.</p>}
              {followLater.length > 0 && <Toggle open={showLater} onClick={() => setShowLater(!showLater)} label={'مواعيد قادمة (' + followLater.length + ')'} />}
              {showLater && list(followLater)}
            </>
          ) : list(by[s.key] || [])}
        </section>
      ))}

      {!isAdmin && others.length > 0 && (
        <section style={{ marginTop: 22 }}>
          <Toggle open={showOthers} onClick={() => setShowOthers(!showOthers)} label={'عملاء زميلتك (' + others.filter(r => r.state !== 'closed').length + ') — للعلم فقط'} />
          {showOthers && <div style={{ ...card, fontSize: 12.5, lineHeight: 2, color: C.soft }}>
            {others.filter(r => r.state !== 'closed').sort((a, b) => String(b.at || '').localeCompare(String(a.at || ''))).slice(0, 150).map(r => <span key={r.source + r.ref_id} style={{ display: 'inline-block', marginLeft: 14 }}>{r.name || '—'} <span style={{ fontSize: 11 }}>· {ago(r.at)}</span></span>)}
          </div>}
        </section>
      )}
      <MoreLinks links={[['/admin/hot', '🔥 القائمة الكاملة — ومنها «عميل اتصل وليس في القائمة»'], ['/admin/desk', '📑 مكتب الطلبات — تأكيد التحويل والاعتماد'], ['/admin/message', '💬 مراسلة العملاء']]} />
    </>
  )
}

// ═══ أسئلة الاستشارة المختصرة (١٢ أكتوبر، المالك) ═══
// لكل من سجّل رسالةُ أسئلةٍ على وضعه: ترسلها ضي واتساب بضغطة، ثم تلصق ردّ العميل
// فتُبنى عليه استشارته. ولا يُعدَّل نصّ الأسئلة من هنا.
type Ask = { id: string; full_name: string | null; company_name: string | null; phone: string | null; ask_message: string; ask_sent_at: string | null; ask_reply: string | null; ask_reply_at: string | null; consult_status: string | null; consult_code: string | null; consult_sent_at: string | null; consult_opened_at: string | null; owner?: string; call?: { outcome: string | null; note: string | null; actor: string | null; at: string } | null }

function AskCard({ a, reload, inline }: { a: Ask; reload: () => void; inline?: boolean }) {
  const [open, setOpen] = useState(false)
  // داخل بطاقة العميل تُطوى في سطرٍ واحد (١٣ أكتوبر، المالك) — والاستشارة الجاهزة تُنبَّه في السطر نفسه
  const [expanded, setExpanded] = useState(false)
  const [reply, setReply] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const wa = waNumber(a.phone)
  const patch = async (body: Record<string, unknown>) => {
    setBusy(true); setMsg('')
    const res = await fetch('/api/staff/asks', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: a.id, ...body }) })
    const j = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setMsg(j.error || 'لم يُحفظ'); return false }
    reload(); return true
  }
  const send = () => {
    if (wa) window.open('https://wa.me/' + wa + '?text=' + encodeURIComponent(a.ask_message), '_blank', 'noopener')
    if (!a.ask_sent_at) patch({ sent: true })
  }
  const sendConsult = (code: string) => {
    const first = String(a.full_name || '').trim().split(/\s+/)[0]
    const text = 'السلام عليكم' + (first && a.company_name !== a.full_name ? ' أ. ' + first : '') + '\n'
      + 'شكراً على إجاباتك. هذه استشارتك المبدئية من الدكتور عبدالحكيم، مكتوبة على وضعك:\n'
      + 'https://murdi.sa/r/' + code + '\n\n'
      + 'وإذا حاب نبدأ، أنا معك هنا 🌿'
    if (wa) window.open('https://wa.me/' + wa + '?text=' + encodeURIComponent(text), '_blank', 'noopener')
    if (!a.consult_sent_at) patch({ consultSent: true })
  }
  const copy = async () => { try { await navigator.clipboard.writeText(a.ask_message); setMsg('نُسخت ✓') } catch { setMsg('انسخيها يدوياً') } }
  const status = a.consult_status === 'ready' && !a.consult_sent_at ? '✨ استشارته جاهزة — أرسليها'
    : a.consult_sent_at ? '✓ أُرسلت استشارته' + (a.consult_opened_at ? ' وفتحها' : '')
    : a.ask_reply ? '⏳ ردّ — الاستشارة تُجهَّز' : a.ask_sent_at ? 'أُرسلت — ننتظر رده' : 'لم تُرسل بعد'
  if (inline && !expanded) return (
    <button onClick={() => setExpanded(true)} style={{ marginTop: 9, width: '100%', textAlign: 'right', background: a.consult_status === 'ready' && !a.consult_sent_at ? '#EFF9F4' : '#FFFBEF', border: '1px solid ' + (a.consult_status === 'ready' && !a.consult_sent_at ? '#BFE3D3' : '#F1E3B5'), borderRadius: 10, padding: '7px 12px', fontFamily: 'Cairo', fontSize: 12.5, fontWeight: 800, color: C.ink, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
      <span>📝 أسئلة الاستشارة · <span style={{ color: C.soft }}>{status}</span></span><span style={{ color: C.green }}>فتح ▾</span>
    </button>
  )
  return (
    <div style={inline ? { marginTop: 9, background: '#FFFBEF', border: '1px solid #F1E3B5', borderRadius: 10, padding: '9px 12px' } : card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'baseline' }}>
        <b style={{ fontSize: inline ? 13 : 14.5, fontWeight: 900 }}>{inline ? '📝 أسئلة الاستشارة' : (a.company_name || a.full_name || '—')}{!inline && a.company_name && a.full_name ? <span style={{ fontWeight: 700, color: C.soft, fontSize: 12.5 }}> · {a.full_name}</span> : null}</b>
        {inline && <button onClick={() => setExpanded(false)} style={{ background: 'none', border: 'none', color: C.green, fontFamily: 'Cairo', fontWeight: 800, fontSize: 12, cursor: 'pointer', padding: 0 }}>طيّ ▴</button>}
        <span style={{ fontSize: 11.5, color: C.soft }}>{a.ask_reply ? '✓ ردّ ' + ago(a.ask_reply_at) : a.ask_sent_at ? 'أُرسلت ' + ago(a.ask_sent_at) : 'لم تُرسل بعد'}</span>
      </div>
      {!inline && <div style={{ fontSize: 12, marginTop: 4, fontWeight: 800, color: a.call ? C.green : '#8A6D1F' }}>
        {a.call ? '📞 ' + (a.call.actor || 'الفريق') + ': ' + (a.call.outcome || '') + (a.call.note ? ' — ' + a.call.note : '') + ' · ' + ago(a.call.at) : '📞 لم يُكلَّم بعد'}
      </div>}
      <button onClick={() => setOpen(!open)} style={{ background: 'none', border: 'none', padding: 0, marginTop: 4, color: C.green, fontFamily: 'Cairo', fontWeight: 800, fontSize: 12.5, cursor: 'pointer' }}>{open ? 'إخفاء الرسالة' : 'عرض الرسالة'}</button>
      {open && <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.9, background: C.bg, borderRadius: 8, padding: '8px 12px', marginTop: 6 }}>{a.ask_message}</div>}
      {a.ask_reply && <div style={{ whiteSpace: 'pre-wrap', fontSize: 12.5, marginTop: 7, background: C.pale, borderRadius: 8, padding: '7px 11px' }}><b>رده:</b> {a.ask_reply}</div>}
      {a.ask_reply && a.consult_status !== 'ready' && a.consult_status !== 'held' && <div style={{ fontSize: 12, color: C.soft, marginTop: 6 }}>⏳ الاستشارة تُجهَّز — تظهر هنا خلال ساعة من لصق الرد</div>}
      {a.consult_status === 'held' && <div style={{ fontSize: 12, color: '#8A6D1F', marginTop: 6, fontWeight: 800 }}>⏳ الاستشارة عند الدكتور للمراجعة — تظهر هنا بعد اعتمادها</div>}
      {a.consult_status === 'ready' && a.consult_code && (
        <div style={{ marginTop: 8, background: '#EFF9F4', border: '1px solid #BFE3D3', borderRadius: 10, padding: '9px 12px' }}>
          <div style={{ fontSize: 13, fontWeight: 900, color: C.ink }}>✨ استشارته جاهزة{a.consult_sent_at ? ' · أُرسلت ' + ago(a.consult_sent_at) : ''}{a.consult_opened_at ? ' · فتحها ✓' : ''}</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 7 }}>
            {wa && <button disabled={busy} onClick={() => sendConsult(a.consult_code as string)} style={btn(true)}>{a.consult_sent_at ? 'أعيدي إرسالها' : 'أرسلي الاستشارة واتساب'}</button>}
            <a href={'/r/' + a.consult_code} target="_blank" rel="noreferrer" style={btn(false)}>اطّلعي عليها</a>
          </div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 9 }}>
        {!a.ask_reply && wa && <button disabled={busy} onClick={send} style={btn(true)}>{a.ask_sent_at ? 'أعيدي فتحها في واتساب' : 'أرسلي واتساب'}</button>}
        <button onClick={copy} style={btn(false)}>نسخ الرسالة</button>
        {a.ask_sent_at && !a.ask_reply && <span style={{ fontSize: 12, color: C.soft, alignSelf: 'center' }}>لما يرد الصقي رده تحت ↓</span>}
      </div>
      {a.ask_sent_at && !a.ask_reply && (
        <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
          <textarea value={reply} onChange={e => setReply(e.target.value)} placeholder="الصقي رد العميل كما هو" rows={3} style={{ ...input, resize: 'vertical' }} />
          <div><button disabled={busy || !reply.trim()} onClick={async () => { if (await patch({ reply })) setReply('') }} style={btn(true)}>{busy ? '…' : 'حفظ الرد'}</button></div>
        </div>
      )}
      {msg && <div style={{ fontSize: 12, fontWeight: 800, marginTop: 6, color: msg.includes('✓') ? C.green : '#B4453C' }}>{msg}</div>}
    </div>
  )
}

// «طلب «…» من الموقع — ⭐ جادّ · توسعة · 10–50 مليون · …» ← سطرٌ رئيسي ورقائق تُقرأ بنظرة
function splitReason(reason: string): { main: string; chips: string[] } {
  const i = reason.indexOf('⭐')
  if (i < 0) return { main: reason, chips: [] }
  const main = reason.slice(0, i).replace(/[\s—-]+$/, '')
  const chips = reason.slice(i + 1).split('·').map(x => x.trim()).filter(Boolean)
  return { main, chips }
}

function LeadCard({ r, reload, showOwner }: { r: Hot; reload: () => void; showOwner?: boolean }) {
  const [open, setOpen] = useState(false)
  // «العميل وافق — وش نقول له؟» (١٣ أكتوبر): يُفتح ملفه من البطاقة نفسها، فيظهر السعر ويصدر السند ورابط الدفع
  const [intake, setIntake] = useState(false)
  const [showOpener, setShowOpener] = useState(false)
  const [outcome, setOutcome] = useState<string>(OUTCOMES[1])
  const [note, setNote] = useState('')
  const [when, setWhen] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const wa = waNumber(r.phone)
  const waiting = r.state === 'waiting'

  const save = async () => {
    setBusy(true); setMsg('')
    const res = await fetch('/api/admin/hot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source: r.source, ref_id: r.ref_id, outcome, note: note || null, next_action_at: when || null }) })
    const j = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setMsg(j.error || 'لم تُسجَّل — حاولي مرة ثانية'); return }
    setOpen(false); setNote(''); setWhen(''); reload()
  }

  return (
    <div style={{ ...card, opacity: waiting ? 0.7 : 1, borderColor: r.source === 'transfer' ? '#E8C4B2' : C.line }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'baseline' }}>
        <b style={{ fontSize: 15, fontWeight: 900 }}>{r.name || r.person || '—'}{r.person && r.name && r.person !== r.name ? <span style={{ fontWeight: 700, color: C.soft, fontSize: 12.5 }}> · {r.person}</span> : null}</b>
        <span style={{ fontSize: 11.5, color: C.soft }}>{showOwner && r.owner_name ? <span style={tag(r.owner_name.includes('رغد') ? '#6B5BA8' : C.green)}>{r.owner_name}</span> : null}{waiting ? '⏳ موعده ' + fmtDate(r.next_action_at) : r.at ? 'وصل ' + ago(r.at) : ''}</span>
      </div>
      <div style={{ fontSize: 12.5, color: C.soft, marginTop: 3 }}>{splitReason(r.reason).main}{Number((r.reason.match(/بدرجة\s*(\d+)/) || [])[1] || 0) >= 85 && r.touches === 0 ? <span style={tag(C.red)}>🔥 درجة عالية — كلّميه أولاً</span> : null}</div>
      {r.last_outcome && (
        <div style={{ fontSize: 12, marginTop: 6, background: C.pale, borderRadius: 8, padding: '6px 10px' }}>
          آخر مكالمة ({r.touches}): <b>{r.last_outcome}</b>{r.last_note ? ' — ' + r.last_note : ''} <span style={{ color: C.soft }}>· {ago(r.last_at)}</span>
          {r.last_actor ? <span style={{ ...tag(r.last_actor.includes('رغد') ? '#6B5BA8' : r.last_actor.includes('عبدالحكيم') ? C.gold : C.green) }}>{r.last_actor.includes('عبدالحكيم') ? 'الدكتور' : r.last_actor}</span> : null}
        </div>
      )}
      {splitReason(r.reason).chips.length > 0 && (
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 6 }}>
          {splitReason(r.reason).chips.map(c => <span key={c} style={{ fontSize: 11.5, fontWeight: 800, color: c === 'جادّ' ? '#fff' : C.ink, background: c === 'جادّ' ? C.red : C.pale, borderRadius: 999, padding: '2px 10px' }}>{c}</span>)}
        </div>
      )}
      <div style={{ fontSize: 12.5, marginTop: 6, color: C.green, fontWeight: 700 }}>← {r.next_step}</div>
      {r.ask && <AskCard inline reload={reload} a={{ ...r.ask, full_name: r.person, company_name: r.name, phone: r.phone }} />}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 9 }}>
        {r.phone && <a href={'tel:' + r.phone} style={btn(true)}>📞 {r.phone}</a>}
        {wa && <a href={'https://wa.me/' + wa} target="_blank" rel="noreferrer" style={btn(false)}>واتساب</a>}
        {!r.phone && r.email && <a href={'mailto:' + r.email} style={btn(false)}>✉️ {r.email}</a>}
        {r.opener && <button onClick={() => setShowOpener(!showOpener)} style={btn(false)}>وش أقول؟</button>}
        {r.source === 'transfer'
          ? <a href="/admin/desk" style={btn(true)}>أكّدي الاستلام من مكتب الطلبات ←</a>
          : <button onClick={() => setOpen(!open)} style={btn(true)}>سجّلي نتيجة المكالمة</button>}
        {r.source !== 'transfer' && r.source !== 'ordered' && r.source !== 'contract' && <button onClick={() => setIntake(!intake)} style={{ ...btn(false), borderColor: C.gold, color: '#8A6D1F' }}>{intake ? 'إغلاق' : '✅ وافق على الخدمة — افتحي ملفه'}</button>}
      </div>
      {intake && (
        <div style={{ marginTop: 10, border: '1.5px solid ' + C.gold, borderRadius: 12, padding: 12, background: '#fff' }}>
          <CallIntake
            service={(r.reason || '').match(/طلب «(.+?)»/)?.[1] || (/جدوى/.test(r.reason || '') ? 'feasibility' : 'funding')}
            seed={{ full_name: r.person || r.name || '', phone: r.phone || '', email: r.email || '', company_name: r.name && r.name !== r.person ? r.name : '' }}
            from={{ source: r.source, ref_id: r.ref_id }}
            quick size={sizeFromText(r.reason || '')}
            onDone={() => { setIntake(false); reload() }}
          />
        </div>
      )}
      {showOpener && r.opener && <div style={{ fontSize: 13, marginTop: 8, lineHeight: 1.9, background: '#FFFBEF', border: '1px solid #F1E3B5', borderRadius: 8, padding: '8px 12px' }}>{r.opener}</div>}
      {open && (
        <div style={{ marginTop: 10, display: 'grid', gap: 7, background: C.bg, borderRadius: 10, padding: 10 }}>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {OUTCOMES.map(o => <button key={o} onClick={() => setOutcome(o)} style={pill(outcome === o)}>{o}</button>)}
          </div>
          <input value={note} onChange={e => setNote(e.target.value)} placeholder="وش قال؟ (سطر واحد يكفي)" style={input} />
          <label style={{ fontSize: 12, color: C.soft }}>موعد المعاودة (اختياري): <input type="date" value={when} onChange={e => setWhen(e.target.value)} style={{ ...input, width: 'auto', display: 'inline-block' }} /></label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button disabled={busy} onClick={save} style={btn(true)}>{busy ? '…' : 'حفظ'}</button>
            {msg && <span style={{ color: '#B4453C', fontSize: 12, fontWeight: 800 }}>{msg}</span>}
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════ رغد ═══════════════════════════
function RaghadBoard({ files, reload }: { files: File[]; reload: () => void }) {
  const [step, setStep] = useState('')
  const fin = files.filter(f => f.outreach)
  const other = files.filter(f => !f.outreach)
  const sortIdle = (l: File[]) => [...l].sort((a, b) => b.idle_days - a.idle_days)
  const counts: Record<string, number> = Object.fromEntries(RAGHAD_STEPS.map(s => [s.key, fin.filter(f => f.stage === s.key).length]))
  const needToday = files.filter(f => !f.done && !f.paused && (f.stage === 'received' || f.idle_days >= 2)).length
  const shown = step ? RAGHAD_STEPS.filter(s => s.key === step) : RAGHAD_STEPS

  return (
    <>
      <h1 style={{ fontSize: 21, fontWeight: 900, margin: '0 0 4px' }}>ملفّاتي — من الاستلام إلى التمويل</h1>
      <p style={{ fontSize: 13, color: C.soft, margin: '0 0 14px', lineHeight: 1.8 }}>
        عندك <b style={{ color: C.ink }}>{files.filter(f => !f.done).length}</b> ملف مفتوح، منها <b style={{ color: C.red }}>{needToday}</b> يحتاج منك خطوة اليوم (جديد، أو واقف يومين فأكثر).
      </p>
      <Pipeline steps={RAGHAD_STEPS.map(s => ({ key: s.key, label: s.short, n: counts[s.key] }))} active={step} onPick={setStep} />

      {shown.map(s => {
        const list = sortIdle(fin.filter(f => f.stage === s.key))
        if (!step && list.length === 0) return null
        return (
          <section key={s.key} style={{ marginTop: 22 }}>
            <SectionHead label={s.label} hint={s.hint} n={list.length} />
            {list.length === 0 ? <Empty /> : <div style={{ display: 'grid', gap: 9 }}>{list.map(f => <PaidCard key={f.request_id} f={f} reload={reload} />)}</div>}
          </section>
        )
      })}

      {!step && other.length > 0 && (
        <section style={{ marginTop: 26 }}>
          <SectionHead label="خدمات بلا مخاطبة جهات" hint="الجدوى والحكم الائتماني وما شابهها — استلام ثم تنفيذ ثم تسليم." n={other.filter(f => !f.done).length} />
          <div style={{ display: 'grid', gap: 9 }}>{sortIdle(other).map(f => <PaidCard key={f.request_id} f={f} reload={reload} />)}</div>
        </section>
      )}

      <MoreLinks links={[['/admin/followup', '📞 مكالمات الجهات — تسجيل اسم المسؤول ورقمه'], ['/admin/desk', '📑 مكتب الطلبات — «وافقت الجهة» و«نزل التمويل»']]} />
    </>
  )
}

function PaidCard({ f, readOnly, mine, reload }: { f: File; readOnly?: boolean; mine?: boolean; reload?: () => void }) {
  const [open, setOpen] = useState(false)
  const [done, setDone] = useState('')
  const [missing, setMissing] = useState('')
  const [next, setNext] = useState('')
  const [presented, setPresented] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const steps = f.outreach ? RAGHAD_STEPS.map(s => ({ key: s.key, label: s.short })) : RAGHAD_OTHER
  const at = Math.max(0, steps.findIndex(s => s.key === f.stage))
  const late = !f.done && !f.paused && f.idle_days >= 3
  // ★ «وافقت جهة» و«نزل التمويل» من البطاقة نفسها — كانا في مكتب الطلبات وحده، فبقي
  //   ملفٌّ وافق عليه الأهلي في خانة «عند الجهات» لأن الموافقة كُتبت ملاحظةً لا مرحلة.
  const [ms, setMs] = useState<'' | 'approved' | 'booked'>('')
  const [funder, setFunder] = useState('')
  const [amount, setAmount] = useState('')
  // ★ ١٣ أكتوبر: كتبت رغد «300» تقصد ٣٠٠ ألف، وعلق معها حقل التاريخ فخرجت السنة 0006.
  //   فالمبلغ رقمٌ ووحدة (ريال · ألف · مليون) ومعه ترجمته بالريال، والتاريخ يوم وشهر وسنة من قوائم.
  const [unit, setUnit] = useState(1000)
  const now = new Date()
  const [dd, setDd] = useState(''); const [mm, setMm] = useState(''); const [yy, setYy] = useState(String(now.getFullYear()))
  const expected = dd && mm && yy ? yy + '-' + mm.padStart(2, '0') + '-' + dd.padStart(2, '0') : ''
  const setExpected = (_: string) => { setDd(''); setMm('') }
  const toLatin = (v: string) => v.replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[٫,]/g, m => (m === '٫' ? '.' : '')).replace(/[^\d.]/g, '')
  const riyal = Math.round(Number(toLatin(amount) || 0) * unit)
  const saveMilestone = async () => {
    setBusy(true); setMsg('')
    const body = ms === 'approved'
      ? { kind: 'log', id: f.request_id, milestone: 'approved', funder, amount: String(riyal), expected, done: 'وافقت ' + funder, status: 'in_follow_up' }
      : { kind: 'log', id: f.request_id, milestone: 'booked', amount: amount ? String(riyal) : undefined, done: 'نزل التمويل', status: 'in_follow_up' }
    const res = await fetch('/api/staff/desk', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const j = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setMsg(j.error || 'لم يُسجَّل'); return }
    setMs(''); setFunder(''); setAmount(''); setExpected(''); reload?.()
  }

  const save = async () => {
    setBusy(true); setMsg('')
    const res = await fetch('/api/staff/desk', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'log', id: f.request_id, done, missing, next, presented_to: presented || undefined, status: f.outreach && (presented || f.stage === 'funders') ? 'in_follow_up' : 'in_progress' }) })
    const j = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setMsg(j.error || 'لم يُسجَّل'); return }
    setOpen(false); setDone(''); setMissing(''); setNext(''); setPresented(''); reload?.()
  }

  return (
    <div style={{ ...card, borderColor: late ? '#E8C4B2' : C.line, background: f.done ? '#F4FAF7' : '#fff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'baseline' }}>
        <b style={{ fontSize: 15, fontWeight: 900 }}>
          {f.name}
          {readOnly && mine && <span style={tag(C.gold)}>عميلك</span>}
          {f.paused && <span style={tag(C.soft)}>موقوف بأمر الدكتور</span>}
        </b>
        <span style={{ fontSize: 11.5, color: late ? C.red : C.soft, fontWeight: late ? 900 : 400 }}>
          {f.done ? 'اكتمل' : f.idle_days >= 1 ? 'آخر حركة قبل ' + f.idle_days + ' يوم' : 'تحرّك اليوم'}
        </span>
      </div>
      <div style={{ fontSize: 12.5, color: C.soft, marginTop: 2 }}>{f.service}{f.paid_at ? ' · دفع ' + fmtDate(f.paid_at) : ''}{f.handled_by.length ? ' · تواصل معه قبل الدفع: ' + f.handled_by.join('، ') : ''}</div>

      {/* شريط المرحلة: أين هو الآن */}
      <div style={{ display: 'flex', gap: 4, marginTop: 10 }}>
        {steps.map((s, i) => (
          <div key={s.key} style={{ flex: 1 }}>
            <div style={{ height: 6, borderRadius: 3, background: i <= at ? (f.done ? C.green : C.gold) : C.line }} />
            <div style={{ fontSize: 10.5, marginTop: 3, color: i === at ? C.ink : C.soft, fontWeight: i === at ? 900 : 500 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 12.5, marginTop: 9, lineHeight: 1.9 }}>
        {f.outreach && (f.counts.sent > 0 || f.counts.presented > 0) && (
          <div>🏦 خوطبت <b>{f.counts.sent}</b> جهة · ردّت <b>{f.counts.replied}</b>{f.counts.presented ? <> · عُرض الملف على <b>{f.counts.presented}</b></> : null}</div>
        )}
        {f.funder && <div>✅ وافقت <b>{f.funder}</b>{f.expected ? ' — الصرف المتوقع ' + fmtDate(f.expected) : ''}</div>}
        {f.last_update && <div>📝 آخر تحديث: {f.last_update} <span style={{ color: C.soft }}>({f.last_by || '—'} · {ago(f.last_at)})</span></div>}
        {f.missing && <div style={{ color: C.red }}>⏳ ينقصه: {f.missing}</div>}
        {f.next && <div style={{ color: C.green, fontWeight: 700 }}>← الخطوة التالية: {f.next}</div>}
        {!f.last_update && !f.done && <div style={{ color: C.red, fontWeight: 700 }}>ما سُجّل عليه شي بعد{readOnly ? '' : ' — اتصلي بالعميل وسجّلي ما تم'}</div>}
      </div>

      {!readOnly && !f.done && (
        <>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 9 }}>
            {f.phone && <a href={'tel:' + f.phone} style={btn(false)}>📞 {f.owner || 'العميل'} — {f.phone}</a>}
            <button onClick={() => { setOpen(!open); setMs('') }} style={btn(true)}>سجّلي ما تم</button>
            {f.outreach && (f.stage === 'funders' || f.stage === 'docs' || f.stage === 'approved') && <button onClick={() => { setMs(ms === 'approved' ? '' : 'approved'); setOpen(false); if (f.funder) setFunder(f.funder) }} style={btn(false)}>{f.stage === 'approved' ? '✏️ تعديل الموافقة' : '✅ وافقت جهة'}</button>}
            {f.outreach && f.stage === 'approved' && <button onClick={() => { setMs(ms === 'booked' ? '' : 'booked'); setOpen(false) }} style={btn(false)}>🎉 نزل التمويل</button>}
          </div>
          {ms && (
            <div style={{ marginTop: 10, display: 'grid', gap: 7, background: '#F1F8F4', border: '1px solid #CFE6DA', borderRadius: 10, padding: 10 }}>
              {ms === 'approved' ? (
                <>
                  <input value={funder} onChange={e => setFunder(e.target.value)} placeholder="اسم الجهة اللي وافقت" style={input} />
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <input value={amount} onChange={e => setAmount(e.target.value)} inputMode="decimal" placeholder="المبلغ المعتمد — مثلاً 300" style={{ ...input, flex: '1 1 140px', width: 'auto' }} />
                    <select value={unit} onChange={e => setUnit(Number(e.target.value))} style={{ ...input, width: 'auto' }}>
                      <option value={1}>ريال</option><option value={1000}>ألف ريال</option><option value={1000000}>مليون ريال</option>
                    </select>
                    {riyal > 0 && <span style={{ fontSize: 12.5, fontWeight: 900, color: C.green }}>= {riyal.toLocaleString('en-US')} ريال</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', fontSize: 12, color: C.soft }}>
                    موعد الصرف المتوقع:
                    <select value={dd} onChange={e => setDd(e.target.value)} style={{ ...input, width: 'auto' }}><option value="">اليوم</option>{Array.from({ length: mm ? new Date(Number(yy), Number(mm), 0).getDate() : 31 }, (_, i) => <option key={i} value={String(i + 1)}>{i + 1}</option>)}</select>
                    <select value={mm} onChange={e => setMm(e.target.value)} style={{ ...input, width: 'auto' }}><option value="">الشهر</option>{['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'].map((m, i) => <option key={m} value={String(i + 1)}>{m}</option>)}</select>
                    <select value={yy} onChange={e => setYy(e.target.value)} style={{ ...input, width: 'auto' }}>{[now.getFullYear(), now.getFullYear() + 1].map(y => <option key={y} value={String(y)}>{y}</option>)}</select>
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <input value={amount} onChange={e => setAmount(e.target.value)} inputMode="decimal" placeholder="المبلغ اللي نزل (اتركيه فاضي إذا نفس المعتمد)" style={{ ...input, flex: '1 1 160px', width: 'auto' }} />
                  <select value={unit} onChange={e => setUnit(Number(e.target.value))} style={{ ...input, width: 'auto' }}>
                    <option value={1}>ريال</option><option value={1000}>ألف ريال</option><option value={1000000}>مليون ريال</option>
                  </select>
                  {amount && riyal > 0 && <span style={{ fontSize: 12.5, fontWeight: 900, color: C.green }}>= {riyal.toLocaleString('en-US')} ريال</span>}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button disabled={busy || (ms === 'approved' && (!funder.trim() || !amount.trim() || !expected))} onClick={saveMilestone} style={btn(true)}>{busy ? '…' : 'تأكيد'}</button>
                {msg && <span style={{ color: '#B4453C', fontSize: 12, fontWeight: 800 }}>{msg}</span>}
              </div>
            </div>
          )}
          {open && (
            <div style={{ marginTop: 10, display: 'grid', gap: 7, background: C.bg, borderRadius: 10, padding: 10 }}>
              <input value={done} onChange={e => setDone(e.target.value)} placeholder="وش صار اليوم؟ (مثال: استلمت كشف الحساب)" style={input} />
              <input value={missing} onChange={e => setMissing(e.target.value)} placeholder="وش ينقص الملف؟ (اتركيه فاضي إذا ما ينقصه شي)" style={input} />
              <input value={next} onChange={e => setNext(e.target.value)} placeholder="الخطوة التالية" style={input} />
              {f.outreach && <input value={presented} onChange={e => setPresented(e.target.value)} placeholder="اسم الجهة فقط إذا قدّمتِ لها الملف اليوم (مثال: منشآت) — التحديث يُكتب في الخانة الأولى" style={input} />}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button disabled={busy || (!done.trim() && !presented.trim())} onClick={save} style={btn(true)}>{busy ? '…' : 'حفظ'}</button>
                {msg && <span style={{ color: '#B4453C', fontSize: 12, fontWeight: 800 }}>{msg}</span>}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ═══════════════════════════ مشترك ═══════════════════════════
function Pipeline({ steps, active, onPick }: { steps: { key: string; label: string; n: number }[]; active: string; onPick: (k: string) => void }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 6 }}>
      {steps.map((s, i) => {
        const on = active === s.key
        return (
          <button key={s.key} onClick={() => onPick(on ? '' : s.key)}
            style={{ textAlign: 'right', border: '1.5px solid ' + (on ? C.ink : C.line), background: on ? C.ink : '#fff', color: on ? '#fff' : C.ink, borderRadius: 12, padding: '9px 8px', cursor: 'pointer', fontFamily: 'Cairo', minWidth: 0 }}>
            <div style={{ fontSize: 10, opacity: 0.6, fontWeight: 700 }}>{i + 1}</div>
            <div style={{ fontSize: 21, fontWeight: 900, lineHeight: 1.2 }}>{s.n}</div>
            <div style={{ fontSize: 11, fontWeight: 800, lineHeight: 1.4 }}>{s.label}</div>
          </button>
        )
      })}
    </div>
  )
}
function SectionHead({ label, hint, n }: { label: string; hint: string; n: number }) {
  return (
    <div style={{ marginBottom: 9 }}>
      <h2 style={{ fontSize: 16, fontWeight: 900, margin: 0 }}>{label} <span style={{ color: C.soft, fontWeight: 700 }}>({n})</span></h2>
      <div style={{ fontSize: 12, color: C.soft }}>{hint}</div>
    </div>
  )
}
function Toggle({ open, onClick, label }: { open: boolean; onClick: () => void; label: string }) {
  return <button onClick={onClick} style={{ marginTop: 10, background: 'transparent', border: '1px dashed ' + C.line, color: C.soft, borderRadius: 999, padding: '7px 16px', fontFamily: 'Cairo', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>{open ? '▲ إخفاء' : '▼'} {label}</button>
}
const Empty = () => <p style={{ fontSize: 12.5, color: C.soft, margin: 0 }}>لا أحد هنا الآن.</p>
function MoreLinks({ links }: { links: [string, string][] }) {
  return (
    <div style={{ marginTop: 30, borderTop: '1px solid ' + C.line, paddingTop: 14 }}>
      <div style={{ fontSize: 12, color: C.soft, fontWeight: 800, marginBottom: 6 }}>شاشات تفصيلية عند الحاجة</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {links.map(([h, t]) => <a key={h} href={h} style={{ ...btn(false), fontSize: 12 }}>{t}</a>)}
      </div>
    </div>
  )
}

const card: React.CSSProperties = { border: '1px solid ' + C.line, borderRadius: 12, padding: '13px 15px', background: '#fff' }
const input: React.CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1px solid ' + C.line, borderRadius: 8, padding: '8px 10px', fontFamily: 'Cairo', fontSize: 13 }
const btn = (primary: boolean): React.CSSProperties => ({ background: primary ? C.ink : '#fff', color: primary ? '#fff' : C.ink, border: '1px solid ' + (primary ? C.ink : C.line), borderRadius: 999, padding: '7px 14px', fontFamily: 'Cairo', fontWeight: 800, fontSize: 12.5, cursor: 'pointer', textDecoration: 'none', display: 'inline-block' })
const pill = (on: boolean): React.CSSProperties => ({ background: on ? C.ink : '#fff', color: on ? '#fff' : C.ink, border: '1px solid ' + (on ? C.ink : C.line), borderRadius: 999, padding: '6px 13px', fontFamily: 'Cairo', fontWeight: 800, fontSize: 12, cursor: 'pointer' })
const tag = (c: string): React.CSSProperties => ({ fontSize: 10.5, fontWeight: 900, color: '#fff', background: c, borderRadius: 999, padding: '2px 9px', marginInlineStart: 8, verticalAlign: 'middle' })
