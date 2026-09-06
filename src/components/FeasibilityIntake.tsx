'use client'
import { useMemo, useState } from 'react'
import { computeFeasibility, computeCredit } from '@/lib/feasibilityCompute'

// ستة أسئلة من العميل ← مدخلات دراسة الجدوى كاملةً.
//
// كانت لوحة المدخلات أربعاً وعشرين خانة بلغة محاسب: «سعر الوحدة» و«عدد
// الوحدات» و«التكلفة المتغيرة كنسبة» و«المصاريف الثابتة سنوياً». وصاحب
// المشروع لا يعرف نفسه بهذه اللغة، فكان المستشار يترجم له في كل مكالمة.
//
// والحيلة التي أنقصت الأسئلة أن المحرّك لا يحتاج «السعر» و«الكمية» منفصلين
// — يحتاج حاصلَ ضربهما. فصار السؤال «كم مبيعاتك في الشهر؟» وهو سؤالٌ يعرف
// جوابه كل صاحب مشروع، ومنه تُشتقّ الكمية بقسمتها على سعر الطلب الواحد.
// والمصاريف تُسأل بالشهر لا بالسنة لأن أحداً لا يفكّر بالسنة.
//
// وتُحسب النتيجة هنا بمعادلات المنصة نفسها المستوردة من feasibilityCompute —
// لا بنسخةٍ ثانية منها — فما يراه المستشار قبل التوليد هو ما ستقوله الدراسة.

export type FzMap = Record<string, string>

const C = {
  ink: '#1A3D34', gold: '#9A7B2E', goldBg: '#FBF5E8', goldLine: '#E8D9A8',
  line: '#EAF2EE', soft: '#6B8A80', red: '#B4622A', green: '#1A6B52',
}

const IN: React.CSSProperties = {
  width: '100%', padding: '9px 11px', borderRadius: 8, border: '1.5px solid ' + C.goldLine,
  fontFamily: 'Cairo, sans-serif', fontSize: 12.5, color: C.ink, background: '#fff', boxSizing: 'border-box',
}
const LB: React.CSSProperties = { fontSize: 11, color: C.gold, fontWeight: 900, marginBottom: 3, lineHeight: 1.7 }

const num = (v: string) => { const x = Number(String(v).replace(/[^\d.-]/g, '')); return Number.isFinite(x) ? x : 0 }
const money = (v: number) => Math.round(v).toLocaleString('en-US')

export const CLIENT_MESSAGE =
  'عشان نبدأ دراسة الجدوى لمشروعك، نحتاج ستة أشياء فقط — اكتبها كما تجيك ولا نحتاج أي مستند:\n\n'
  + '١) وش مشروعك ووين موقعه؟ (سطرين)\n'
  + '٢) كم تكلفة تجهيزه قبل ما يفتح؟ (معدات وتشطيب وترخيص)\n'
  + '٣) وكم تحتاج سيولة تشغيل لأول ثلاثة شهور؟ (رواتب وإيجار ومواد)\n'
  + '٤) كم تتوقع مبيعاتك في الشهر؟ وبكم تبيع الطلب الواحد تقريباً؟\n'
  + '٥) من كل ١٠٠ ريال مبيعات، كم يروح تكلفة مباشرة؟ (مواد وعمالة تشتغل مع البيع)\n'
  + '٦) كم بتحط من مالك؟ وكم تبي تمويل؟\n\n'
  + 'وإذا عندك واحد من هذي قوله لنا — كل وحدة تفتح جهات تمويل ما تنفتح بدونها:\n'
  + '• بتستورد من الخارج؟ ومن أي دولة؟\n'
  + '• عندك عملاء كبار بالاسم أو عقود قائمة؟\n'
  + '• تملك أصول تنفع رهن؟ (عقار أو معدات أو مركبات)\n\n'
  + 'وما نبي أرقام دقيقة — اكتب اللي تعرفه وتقديرك للباقي، ونوضّح بالدراسة إنه تقدير.'

export default function FeasibilityIntake({ onFill }: { onFill: (patch: FzMap) => void }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [a, setA] = useState({
    desc: '', capex: '', wc: '', rev: '', price: '', vcost: '', fixed: '', own: '', loan: '',
    years: '5', rate: '8', growth: '10', infl: '4',
  })
  const set = (k: keyof typeof a) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setA((p) => ({ ...p, [k]: e.target.value }))

  // سعر الطلب الواحد اختياري: من لا يبيع بالوحدة يُقاس عليه الريال نفسه
  const price = num(a.price) || 1
  const unitsYear1 = price > 0 ? (num(a.rev) * 12) / price : 0

  const calc = useMemo(() => {
    const i = {
      capex: num(a.capex), workingCapital: num(a.wc), unitPrice: price, unitsYear1,
      growthRate: num(a.growth), variableCostPct: num(a.vcost), fixedCostsAnnual: num(a.fixed) * 12,
      inflationRate: num(a.infl), ownFunds: num(a.own), financingAmount: num(a.loan),
      financingYears: num(a.years) || 5, financingRate: num(a.rate),
    }
    if (!unitsYear1 || !(i.capex + i.workingCapital) || !i.fixedCostsAnnual) return null
    const r = computeFeasibility(i)
    const c = computeCredit(i, r)
    return { i, r, c }
  }, [a, price, unitsYear1])

  const fill = () => {
    if (!calc) { alert('أدخل المبيعات والتكلفة والمصاريف الثابتة على الأقل.'); return }
    const { i } = calc
    onFill({
      projectDescription: a.desc.trim(),
      capex: String(i.capex),
      workingCapital: String(i.workingCapital),
      unitPrice: String(price),
      unitsYear1: String(Math.round(unitsYear1)),
      growthRate: String(i.growthRate),
      variableCostPct: String(i.variableCostPct),
      fixedCostsAnnual: String(i.fixedCostsAnnual),
      inflationRate: String(i.inflationRate),
      ownFunds: String(i.ownFunds),
      financingAmount: String(i.financingAmount),
      financingYears: String(i.financingYears),
      financingRate: String(i.financingRate),
    })
  }

  const F = (k: keyof typeof a, label: string, hint?: string, ph?: string) => (
    <div>
      <div style={LB}>{label}{hint ? <span style={{ color: '#B39B62', fontWeight: 700 }}> — {hint}</span> : null}</div>
      <input value={a[k]} onChange={set(k)} placeholder={ph} inputMode="numeric" style={IN} />
    </div>
  )

  if (!open) return (
    <button type="button" onClick={() => setOpen(true)}
      style={{ background: '#fff', border: '1.5px dashed ' + C.gold, color: C.gold, borderRadius: 999,
        padding: '9px 20px', fontFamily: 'Cairo', fontWeight: 900, fontSize: 12.5, cursor: 'pointer', marginBottom: 10 }}>
      ⚡ املأ من جواب العميل — ٦ أسئلة
    </button>
  )

  return (
    <div style={{ background: '#fff', border: '2px solid ' + C.gold, borderRadius: 12, padding: '14px 16px', marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
        <b style={{ fontSize: 13.5, fontWeight: 900, color: C.ink }}>⚡ من جواب العميل — ٦ أسئلة</b>
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button"
            onClick={() => { try { navigator.clipboard?.writeText(CLIENT_MESSAGE) } catch { /* متصفح يمنع الحافظة */ }
              setCopied(true); setTimeout(() => setCopied(false), 1600) }}
            style={{ background: copied ? C.green : '#fff', color: copied ? '#fff' : C.soft,
              border: '1px solid ' + (copied ? C.green : C.line), borderRadius: 999, padding: '5px 13px',
              fontFamily: 'Cairo', fontWeight: 800, fontSize: 11.5, cursor: 'pointer' }}>
            {copied ? '✓ نُسخت' : '📋 انسخ الأسئلة للعميل'}
          </button>
          <button type="button" onClick={() => setOpen(false)}
            style={{ background: 'transparent', border: '1px solid ' + C.line, color: C.soft, borderRadius: 999,
              padding: '5px 13px', fontFamily: 'Cairo', fontWeight: 800, fontSize: 11.5, cursor: 'pointer' }}>إغلاق</button>
        </div>
      </div>
      <div style={{ fontSize: 11.5, color: C.soft, fontWeight: 700, lineHeight: 1.85, marginBottom: 11 }}>
        انسخ الأسئلة وأرسلها له، ثم اكتب جوابه هنا — والخانات تحت تُملأ وحدها.
      </div>

      <div style={{ marginBottom: 9 }}>
        <div style={LB}>١ · المشروع وموقعه</div>
        <textarea value={a.desc} onChange={set('desc')} rows={2}
          placeholder="مصنع ألواح معزولة للمقاولين — المدينة الصناعية الثانية بالرياض، أرض مستأجرة"
          style={{ ...IN, resize: 'vertical', lineHeight: 1.85 }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(175px,1fr))', gap: 9, marginBottom: 11 }}>
        {F('capex', '٢ · تكلفة التجهيز', 'قبل الافتتاح', '13500000')}
        {F('wc', '٣ · سيولة أول ٣ شهور', '', '3200000')}
        {F('rev', '٤ · مبيعات الشهر', '', '1267500')}
        {F('price', '· سعر الطلب الواحد', 'اتركه فارغاً إن لم يبع بالوحدة', '195')}
        {F('vcost', '٥ · التكلفة المباشرة %', 'من كل ١٠٠ ريال', '55')}
        {F('fixed', '٦ · المصاريف الثابتة/شهر', '', '216667')}
        {F('own', '· من ماله', '', '6700000')}
        {F('loan', '· التمويل المطلوب', '', '10000000')}
      </div>

      <div style={{ fontSize: 10.5, color: C.soft, fontWeight: 900, marginBottom: 5 }}>افتراضات تضبطها أنت — تُذكر في الدراسة</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 9, marginBottom: 12 }}>
        {F('years', 'مدة السداد (سنة)')}
        {F('rate', 'كلفة التمويل %')}
        {F('growth', 'نمو المبيعات %')}
        {F('infl', 'نمو المصاريف %')}
      </div>

      {calc && (() => {
        const { i, r, c } = calc
        const y1 = r.years[0]
        const gap = r.fundingGap
        const stress = c.scenarios[0]?.dscrY1 ?? null
        const tone = c.minDscr === null ? C.soft : c.minDscr >= 1.25 ? C.green : c.minDscr >= 1 ? C.gold : C.red
        const box = (n: string, t: string, col?: string) => (
          <div style={{ flex: '1 1 105px', border: '1px solid ' + C.line, borderRadius: 8, padding: '9px 11px', background: '#fff' }}>
            <div style={{ fontSize: 16.5, fontWeight: 900, color: col || C.ink, lineHeight: 1.25 }}>{n}</div>
            <div style={{ fontSize: 10, color: C.soft, fontWeight: 700, marginTop: 2, lineHeight: 1.6 }}>{t}</div>
          </div>
        )
        return (
          <div style={{ borderTop: '1px solid ' + C.line, paddingTop: 11, marginBottom: 11 }}>
            <div style={{ fontSize: 12.5, fontWeight: 900, color: tone, marginBottom: 8, lineHeight: 1.75 }}>{c.verdict}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {box(c.minDscr === null ? '—' : c.minDscr.toFixed(2) + '×', 'أدنى تغطية دين', tone)}
              {box(y1.revenue > 0 ? (r.breakEvenRevenue / y1.revenue * 100).toFixed(0) + '%' : '—', 'التعادل من مبيعات س١')}
              {box(r.paybackYears === null ? '+5' : r.paybackYears.toFixed(1), 'سنة للاسترداد')}
              {box(money(c.deepestMonth.cumulative), 'أعمق نقطة — شهر ' + c.deepestMonth.month,
                c.deepestMonth.cumulative < 0 ? C.red : C.ink)}
              {box(money(r.annualInstalment), 'القسط السنوي')}
              {box(money(y1.revenue), 'إيراد السنة الأولى')}
            </div>
            {Math.abs(gap) > 1 && (
              <div style={{ background: '#FDF1EC', borderRight: '3px solid ' + C.red, padding: '9px 12px', marginTop: 9, fontSize: 11.8, lineHeight: 1.9, color: '#7A3B2A' }}>
                <b>الأرقام لا تُغلق:</b> مساهمته وتمويله {money(i.ownFunds + i.financingAmount)} والاحتياج {money(r.totalInvestment)} —
                الفرق <b>{money(Math.abs(gap))} ريال</b> {gap > 0 ? 'ناقص. اسأله من أين يأتي.' : 'زائد. راجع الأرقام معه.'}
              </div>
            )}
            {stress !== null && stress < 1 && (
              <div style={{ background: '#FDF1EC', borderRight: '3px solid ' + C.red, padding: '9px 12px', marginTop: 7, fontSize: 11.8, lineHeight: 1.9, color: '#7A3B2A' }}>
                <b>ينكسر تحت الضغط:</b> عند تراجع المبيعات ٢٠٪ وارتفاع التكاليف ١٠٪ تنزل التغطية إلى <b>{stress.toFixed(2)}×</b> —
                اذكرها في الدراسة ومعها مخرج، فاللجنة ستحسبها بنفسها.
              </div>
            )}
          </div>
        )
      })()}

      <button type="button" onClick={fill} disabled={!calc}
        style={{ width: '100%', background: calc ? C.ink : '#C7D8D2', color: '#fff', border: 'none',
          padding: '11px', borderRadius: 999, fontFamily: 'Cairo', fontWeight: 900, fontSize: 13.5,
          cursor: calc ? 'pointer' : 'default' }}>
        ⬇︎ املأ المدخلات تحت
      </button>
      <div style={{ fontSize: 10.8, color: C.soft, fontWeight: 700, textAlign: 'center', marginTop: 7, lineHeight: 1.8 }}>
        يملأ الخانات ولا يحفظ — راجعها، وأكمل ما يخصّ ملفه، ثم اضغط «احفظ المدخلات».
      </div>
    </div>
  )
}
