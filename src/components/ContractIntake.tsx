'use client'
import { useMemo, useState } from 'react'
import { computeContract, contractScenarios, money, pct, arMonths, type AwarderKind } from '@/lib/contractCompute'
import { verdictOfContract } from '@/lib/contractGenerate'

// لوحة «تمويل العقد» — ثمانية أرقام يقرؤها صاحب العقد من ورقته.
//
// ولا واحد منها يحتاج محاسباً: القيمة والمدة والدفعة والمحتجز ونسبة التكلفة
// ومدة صرف المستخلص والاسترداد وضمان الأداء. كلها مكتوبة في العقد نفسه،
// وأكثرها في الصفحة الأولى منه.
//
// والنسب تُدخَل بالمئة كما ينطقها صاحبها — «عشرة» لا «صفر فاصلة واحد» —
// وتُقسَم هنا. فالخانة التي تطلب كسراً عشرياً تُملأ خطأً في نصف الحالات.
//
// والحكم يظهر قبل التوليد بالمعادلات نفسها المستوردة من contractCompute،
// لا بنسخةٍ ثانية منها — فما يراه المكتب هو ما ستقوله الوثيقة حرفاً بحرف.

const C = {
  ink: '#1A3D34', gold: '#9A7B2E', goldBg: '#FBF5E8', goldLine: '#E8D9A8',
  soft: '#6B8A80', red: '#B4622A', green: '#1A6B52',
}

const IN: React.CSSProperties = {
  width: '100%', padding: '9px 11px', borderRadius: 8, border: '1.5px solid ' + C.goldLine,
  fontFamily: 'Cairo, sans-serif', fontSize: 12.5, color: C.ink, background: '#fff', boxSizing: 'border-box',
}
const LB: React.CSSProperties = { fontSize: 11, color: C.gold, fontWeight: 900, marginBottom: 3, lineHeight: 1.7 }
const BTN = (bg: string): React.CSSProperties => ({
  background: bg, color: '#fff', border: 'none', padding: '8px 18px', borderRadius: 24,
  fontFamily: 'Cairo', fontWeight: 900, fontSize: 12.5, cursor: 'pointer',
})

// القائمة تُخرج نصّاً، والنواة تنتظر أحد أربعة. فيُضيَّق هنا لا بحرفٍ
// يُلقى على النوع: خانة فارغة أو قيمة غريبة تصير undefined لا 'gov'.
const KINDS: AwarderKind[] = ['gov', 'semi', 'large', 'private']
const kindOf = (v: string): AwarderKind | undefined => KINDS.find((k: AwarderKind) => k === v)

const num = (v: string): number => {
  const x = Number(String(v).replace(/[^\d.-]/g, ''))
  return Number.isFinite(x) ? x : 0
}

export const CONTRACT_MESSAGE =
  'عشان نبني لك ملف تمويل العقد، نحتاج ثمانية أرقام كلها موجودة في عقدك — انسخها من الورقة اللي بيدك:\n\n'
  + '١) كم قيمة العقد؟ وكم مدة التنفيذ بالشهور؟\n'
  + '٢) كم الدفعة المقدمة؟ (بالنسبة — وإذا ما فيه دفعة قل: ما فيه)\n'
  + '٣) كم نسبة المحتجز من كل مستخلص؟\n'
  + '٤) من كل ١٠٠ ريال من قيمة العقد، كم يروح تكلفة مباشرة؟ (عمالة ومواد ومقاولين باطن)\n'
  + '٥) المستخلص يُصرف لك بعد كم شهر من تقديمه تقريباً؟\n'
  + '٦) كم يُقتطع من كل مستخلص لاسترداد الدفعة المقدمة؟\n'
  + '٧) كم نسبة ضمان حسن الأداء المطلوب منك؟\n'
  + '٨) مين الجهة اللي أرست عليك العقد؟ وهل هي حكومية أو شبه حكومية أو شركة خاصة؟\n\n'
  + 'وإذا ما رسا عليك بعد وأنت بتقدّم، قل لنا — القراءة قبل التوقيع أنفع لك من القراءة بعده،\n'
  + 'لأن بعض البنود اللي تصنع فجوتك النقدية تنفع تُغيَّر قبل ما تلتزم فيها.\n\n'
  + 'وما نحتاج أرقام دقيقة — اكتب اللي في عقدك وتقديرك للباقي.'

type Props = { requestId: string; companyId: string }

export default function ContractIntake({ requestId, companyId }: Props) {
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState('')
  const [a, setA] = useState({
    value: '', months: '', advance: '', retention: '', cost: '', delay: '',
    recover: '', perf: '', bid: '', cover: '', awarderName: '', awarderKind: '',
    penalty: '', awarded: 'yes',
  })

  const set = (k: keyof typeof a) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setA((p) => ({ ...p, [k]: e.target.value }))

  // ما يُرسل إلى الخادم — بنفس أسماء حقول ContractInputs، والنِّسب مقسومة
  const payload = useMemo(() => ({
    value: num(a.value),
    months: num(a.months),
    advancePct: num(a.advance) / 100,
    retentionPct: num(a.retention) / 100,
    costPct: num(a.cost) / 100,
    collectDelay: num(a.delay),
    advanceRecoverPct: num(a.recover) / 100,
    perfBondPct: num(a.perf) / 100,
    bidBondPct: num(a.bid) / 100,
    cashCoverPct: num(a.cover) / 100,
    awarderName: a.awarderName.trim(),
    awarderKind: kindOf(a.awarderKind),
    penaltyPct: num(a.penalty) / 100,
    awarded: a.awarded !== 'no',
  }), [a])

  const ready = payload.value > 0 && payload.months > 0

  const calc = useMemo(() => {
    if (!ready) return null
    const p = computeContract(payload)
    return { p, v: verdictOfContract(p), s: contractScenarios(payload) }
  }, [payload, ready])

  const save = async () => {
    setBusy('save'); setMsg('')
    try {
      const r = await fetch('/api/admin/service-inputs', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service_request_id: requestId, company_id: companyId, activity_kind: 'contract', inputs: payload }),
      })
      const d = await r.json()
      setMsg(r.ok && !d?.error ? '✓ حُفظت مدخلات العقد' : 'تعذّر الحفظ: ' + (d?.error || ''))
    } catch { setMsg('تعذّر الاتصال') }
    setBusy('')
  }

  const generate = async () => {
    setBusy('gen'); setMsg('')
    try {
      const r = await fetch('/api/admin/contract-file', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId }),
      })
      const d = await r.json()
      if (!r.ok || d?.error) { setMsg('تعذّر التوليد: ' + (d?.error || '')); setBusy(''); return }
      setMsg('✓ جُهِّزت الوثيقة (' + (d.doors || 0) + ' جهة) — راجعها ثم سلّمها')
      const w = window.open('', '_blank')
      if (w) { w.document.write(String(d.html || '')); w.document.close() }
    } catch { setMsg('تعذّر الاتصال') }
    setBusy('')
  }

  const box = (v: string, l: string, color?: string) => (
    <div style={{ flex: '1 1 130px', background: '#fff', border: '1.5px solid ' + C.goldLine, borderRadius: 10, padding: '9px 11px', textAlign: 'center' }}>
      <div style={{ fontSize: 16, fontWeight: 900, color: color || C.ink, lineHeight: 1.5 }}>{v}</div>
      <div style={{ fontSize: 10.5, color: C.soft, fontWeight: 700 }}>{l}</div>
    </div>
  )

  const F = (k: keyof typeof a, label: string, ph?: string) => (
    <div>
      <div style={LB}>{label}</div>
      <input value={a[k]} onChange={set(k)} placeholder={ph} style={IN} inputMode="decimal" />
    </div>
  )

  return (
    <div style={{ background: C.goldBg, border: '1.5px solid ' + C.goldLine, borderRadius: 10, padding: '12px 14px', marginBottom: 10 }}>
      <div style={{ color: C.gold, fontWeight: 900, fontSize: 12.5, marginBottom: 8 }}>
        📄 مدخلات العقد — ثمانية أرقام من ورقة العميل، والباقي يُحسب
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        <button
          onClick={() => { navigator.clipboard.writeText(CONTRACT_MESSAGE).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2200) }).catch(() => {}) }}
          style={BTN(copied ? C.green : '#5C4A16')}>
          {copied ? '✓ نُسخت — أرسلها في واتساب' : '📋 انسخ أسئلة العميل'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 8, marginBottom: 10 }}>
        {F('value', 'قيمة العقد (ريال)', '8400000')}
        {F('months', 'مدة التنفيذ (شهر)', '14')}
        {F('advance', 'الدفعة المقدمة ٪', '10')}
        {F('retention', 'المحتجز من كل مستخلص ٪', '5')}
        {F('cost', 'التكلفة المباشرة ٪ من قيمة العقد', '78')}
        {F('delay', 'المستخلص يُصرف بعد كم شهر', '3')}
        {F('recover', 'استرداد الدفعة من كل مستخلص ٪', '10')}
        {F('perf', 'ضمان حسن الأداء ٪', '5')}
        {F('bid', 'ضمان العطاء ٪ (اختياري)', '1')}
        {F('cover', 'الغطاء النقدي على الضمان ٪ (اختياري)', '25')}
        {F('penalty', 'غرامة التأخير ٪ (اختياري)', '0.1')}
        <div>
          <div style={LB}>المُسنِد إليه — من يدفع</div>
          <input value={a.awarderName} onChange={set('awarderName')} placeholder="أمانة منطقة الرياض" style={IN} />
        </div>
        <div>
          <div style={LB}>جودته الائتمانية</div>
          <select value={a.awarderKind} onChange={set('awarderKind')} style={IN}>
            <option value="">— غير محدد —</option>
            <option value="gov">جهة حكومية</option>
            <option value="semi">شبه حكومية أو مملوكة للدولة</option>
            <option value="large">شركة خاصة كبيرة</option>
            <option value="private">قطاع خاص</option>
          </select>
        </div>
        <div>
          <div style={LB}>حالة العقد</div>
          <select value={a.awarded} onChange={set('awarded')} style={IN}>
            <option value="yes">مُرسى عليه</option>
            <option value="no">قبل الترسية — يستعدّ للتقديم</option>
          </select>
        </div>
      </div>

      {calc === null ? (
        <div style={{ fontSize: 11.5, color: C.soft, fontWeight: 700, marginBottom: 10 }}>
          أدخل قيمة العقد ومدته ليظهر الحكم قبل التوليد.
        </div>
      ) : (
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 8 }}>
            {box(money(calc.p.profit), 'الربح · ' + pct(calc.p.marginPct), calc.p.profit > 0 ? C.green : C.red)}
            {box(money(calc.p.gap), calc.p.worst !== null ? 'أعمق فجوة · الشهر ' + calc.p.worst.m : 'أعمق فجوة', calc.p.gap > 0 ? C.red : C.green)}
            {box(money(calc.p.bonds.total), 'ضمانات مطلوبة')}
            {box(arMonths(calc.p.horizon), 'حتى آخر ريال')}
          </div>
          <div style={{
            background: '#fff', border: '1.5px solid ' + C.goldLine, borderRadius: 10, padding: '10px 13px',
            fontSize: 12.5, fontWeight: 900, color: calc.v.kind === 'clear' ? C.green : calc.v.kind === 'gap' ? C.gold : C.red, lineHeight: 1.8,
          }}>
            {calc.v.headline}
            <div style={{ fontSize: 11.5, fontWeight: 700, color: C.soft, marginTop: 4 }}>
              {/* أقسى سطر في الجدول يُعرض هنا وحده: هو الذي يبيع الخدمة في المكالمة */}
              {calc.s.length > 1
                ? 'وأقسى حالة في جدول الشروط: ' + calc.s.reduce((w, s) => (s.gap > w.gap ? s : w), calc.s[0]).name
                  + ' → ' + money(calc.s.reduce((w, s) => (s.gap > w.gap ? s : w), calc.s[0]).gap) + ' ريال'
                : 'لا تتغيّر فجوته بتغيّر بنوده.'}
            </div>
          </div>
        </div>
      )}

      <button onClick={save} disabled={busy !== '' || !ready} style={{ ...BTN(C.gold), marginLeft: 8, opacity: ready ? 1 : 0.5 }}>
        {busy === 'save' ? 'جارٍ الحفظ...' : '💾 احفظ مدخلات العقد'}
      </button>
      <button onClick={generate} disabled={busy !== '' || !ready} style={{ ...BTN(C.ink), opacity: ready ? 1 : 0.5 }}>
        {busy === 'gen' ? 'جارٍ التوليد...' : '📄 ولّد ملف العقد الائتماني'}
      </button>
      {msg !== '' && <div style={{ fontSize: 12, color: C.gold, marginTop: 8, fontWeight: 800 }}>{msg}</div>}
      <div style={{ fontSize: 10.5, color: C.soft, fontWeight: 700, marginTop: 6, lineHeight: 1.8 }}>
        احفظ أولاً ثم ولّد: التوليد يقرأ المحفوظ لا ما على الشاشة، فتبقى الوثيقة مطابقةً لما اعتمدتَه.
      </div>
    </div>
  )
}
