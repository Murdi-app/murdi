'use client'

import { useState, useMemo } from 'react'
import { computeFeasibility, computeCredit, computeBreakPoints, type FeasibilityInputs } from '@/lib/feasibilityCompute'
import { priceFor, COMMERCIAL } from '@/lib/servicePricing'

// عميل من مكالمة — من البيع إلى الملف بلا أن يُغلق الخط.
//
// كانت الفجوة هنا: رغد تُقفل البيعة بالهاتف، ثم لا تجد صفّاً تضغط عليه —
// لأن الصفّ لا يوجد إلا لمنشأة، والمنشأة لا توجد إلا لحساب، والحساب لا
// يفتحه إلا العميل بنفسه. فتقول له «سجّل ثم اطلب ثم ندفع» — وهي البوابات
// الأربع التي هدمناها في الواجهة العامة، فتعود من الباب الخلفي.
//
// وقاعدتان تحكمان هذه الشاشة:
//
// ١) الحساب يجري في متصفحها لحظةً بلحظة — الأرقام كود لا نموذج لغوي، فلا
//    كلفة ولا انتظار. تقرأ الثلاثة على شاشتها وتقولها له في السماعة.
//
// ٢) **لا يخرج منها للعميل حرف مكتوب.** الوثيقة تُجهَّز وتُحبس حتى يُؤكَّد
//    تحويله. فما يُقال شفاهاً يُقنع، وما يُكتب يُؤخذ ويُمشى به.

const GREEN = '#1A3D34'
const GOLD = '#C9A84C'
const MUTED = '#6B8A80'

export type Who = { full_name: string; phone: string; email: string; company_name: string; city: string; sector: string }

const IN: React.CSSProperties = {
  width: '100%', padding: '10px 13px', borderRadius: 10, border: '1.5px solid #D9E5DF',
  fontFamily: 'Cairo, sans-serif', fontSize: 13.5, fontWeight: 700, color: GREEN,
  background: '#fff', boxSizing: 'border-box',
}

const num = (v: string) => { const x = Number(String(v).replace(/,/g, '')); return Number.isFinite(x) ? x : 0 }
const money = (v: number | null | undefined) =>
  v === null || v === undefined || !Number.isFinite(v) ? '—' : Math.round(v).toLocaleString('en-US')

type NumField = { k: keyof FeasibilityInputs; t: string; hint?: string; def?: string }

// السبعة التي يعرفها صاحب المشروع عن ظهر قلب، ثم الافتراضات التي لا تُسأل
const ASK: NumField[] = [
  { k: 'capex', t: 'تجهيز المشروع (ر.س)', hint: 'المعدات والديكور والتأسيس' },
  { k: 'workingCapital', t: 'رأس المال العامل (ر.س)', hint: 'مصاريف أول شهور قبل أن يدور' },
  { k: 'unitPrice', t: 'سعر الوحدة أو الخدمة (ر.س)' },
  { k: 'unitsYear1', t: 'عدد الوحدات في السنة الأولى' },
  { k: 'variableCostPct', t: 'تكلفة الوحدة % من سعرها', hint: 'المواد والتشغيل المباشر', def: '40' },
  { k: 'fixedCostsAnnual', t: 'المصاريف الثابتة سنوياً (ر.س)', hint: 'إيجار ورواتب وما لا يتغيّر' },
  { k: 'financingAmount', t: 'التمويل المطلوب (ر.س)' },
]

const DEFAULTS: NumField[] = [
  { k: 'financingYears', t: 'مدة السداد (سنوات)', def: '4' },
  { k: 'financingRate', t: 'كلفة التمويل % سنوياً', def: '8' },
  { k: 'growthRate', t: 'نمو المبيعات % سنوياً', def: '10' },
  { k: 'inflationRate', t: 'نمو المصاريف % سنوياً', def: '3' },
]

export default function CallIntake({ seed, onDone }: { seed?: Partial<Who>; onDone?: () => void }) {
  const [who, setWho] = useState<Who>({
    full_name: seed?.full_name || '', phone: seed?.phone || '', email: seed?.email || '',
    company_name: seed?.company_name || '', city: '', sector: '',
  })
  const [f, setF] = useState<Record<string, string>>(() => {
    const o: Record<string, string> = {}
    for (const x of [...ASK, ...DEFAULTS]) o[x.k as string] = x.def || ''
    return o
  })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [out, setOut] = useState<{ link: string; message: string; company: string } | null>(null)

  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }))

  const inputs: FeasibilityInputs = useMemo(() => ({
    capex: num(f.capex), workingCapital: num(f.workingCapital),
    unitPrice: num(f.unitPrice), unitsYear1: num(f.unitsYear1),
    growthRate: num(f.growthRate), variableCostPct: num(f.variableCostPct),
    fixedCostsAnnual: num(f.fixedCostsAnnual), inflationRate: num(f.inflationRate),
    ownFunds: Math.max(0, num(f.capex) + num(f.workingCapital) - num(f.financingAmount)),
    financingAmount: num(f.financingAmount), financingYears: num(f.financingYears) || 4,
    financingRate: num(f.financingRate) || 8,
  }), [f])

  // شرط الحساب: ما لا يُحسب بلا سعرٍ ووحداتٍ وتكلفةٍ لا يُعرض نصفَ محسوب
  const enough = inputs.unitPrice > 0 && inputs.unitsYear1 > 0 && (inputs.capex + inputs.workingCapital) > 0

  const calc = useMemo(() => {
    if (!enough) return null
    try {
      const r = computeFeasibility(inputs)
      const c = computeCredit(inputs, r)
      const b = computeBreakPoints(inputs, r, c)
      return { r, c, b }
    } catch { return null }
  }, [inputs, enough])

  const totalInvestment = num(f.capex) + num(f.workingCapital)
  const tier = totalInvestment > 0 ? priceFor('دراسة الجدوى الاقتصادية', totalInvestment) : null
  const quick = COMMERCIAL['دراسة الجدوى الاقتصادية']?.options?.find((o) => o.key === 'quick')

  const dscr1 = calc?.c.years?.[0]?.dscr ?? null
  const payback = calc?.r.paybackYears ?? null
  const breakEven = calc?.r.breakEvenRevenue ?? null

  // الجملة التي تقولها في السماعة — من أرقامه هو، وبلا تجميل
  const spoken = useMemo(() => {
    if (!calc) return ''

    // التغطية السالبة ليست «رقماً منخفضاً» — هي أن المشروع لا يغطي قسطه
    // أصلاً. وقولها كنسبةٍ صغيرة تُهوّن ما لا يُهوَّن، ويقيسه البنك في دقيقة.
    if (dscr1 !== null && dscr1 <= 0) {
      return 'على أرقامك أنت: مشروعك بهذه الأرقام لا يغطّي قسطه إطلاقاً — '
        + 'أرباح السنة الأولى لا تكفي خدمة الدين، ونقطة تعادلك ' + money(breakEven) + ' ريال في السنة. '
        + 'وأي بنك يقيس هذا في دقيقة. الأمر يحتاج مراجعة قبل أن تطرق باباً.'
    }

    const parts: string[] = []
    if (payback !== null) parts.push('مشروعك يسترد رأس ماله في ' + payback.toFixed(1).replace('.0', '') + ' سنة')
    else parts.push('مشروعك بهذه الأرقام لا يسترد رأس ماله خلال خمس سنوات')
    if (breakEven !== null) parts.push('ونقطة تعادلك ' + money(breakEven) + ' ريال في السنة')
    if (dscr1 !== null) {
      parts.push('وتغطيتك لخدمة الدين ' + dscr1.toFixed(2)
        + (dscr1 >= 1.25 ? ' — وهي فوق الحدّ البنكي ١٫٢٥، فوضعك مريح' : ' — والبنك يبي ١٫٢٥ على الأقل، يعني بوضعك هذا بيتردد'))
    } else if (inputs.financingAmount <= 0) {
      parts.push('وما دام ما فيه تمويل مطلوب فلا تُقاس تغطية خدمة دين')
    }
    return 'على أرقامك أنت: ' + parts.join('، ') + '.'
  }, [calc, payback, breakEven, dscr1, inputs.financingAmount])

  const canOpen = who.full_name.trim() !== '' && who.phone.trim() !== '' && who.email.trim() !== '' && enough

  const openFile = async () => {
    setErr(''); setBusy(true)
    try {
      const res = await fetch('/api/admin/intake', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...who, inputs: { ...inputs }, spoken }),
      })
      const d = await res.json()
      if (!res.ok || d?.error) { setErr(d?.error || 'تعذّر فتح الملف'); setBusy(false); return }
      setOut({ link: d.link, message: d.message, company: d.company_name })
    } catch (e) { setErr('تعذّر الاتصال: ' + String(e).slice(0, 120)) }
    setBusy(false)
  }

  const card = (title: string, children: React.ReactNode) => (
    <div style={{ background: '#fff', border: '1.5px solid #EAF2EE', borderRadius: 14, padding: '18px 20px', marginBottom: 16 }}>
      <div style={{ color: GREEN, fontWeight: 900, fontSize: 14.5, marginBottom: 14 }}>{title}</div>
      {children}
    </div>
  )

  const grid = (cols = '220px') => ({ display: 'grid', gridTemplateColumns: `repeat(auto-fit,minmax(${cols},1fr))`, gap: 12 } as React.CSSProperties)

  const stat = (label: string, value: string, tone?: 'good' | 'bad') => (
    <div style={{
      background: tone === 'good' ? '#EAF7F0' : tone === 'bad' ? '#FBF3EC' : '#F7FBF9',
      border: '1.5px solid ' + (tone === 'good' ? '#BFE0D3' : tone === 'bad' ? '#EBD5C2' : '#E4EFEA'),
      borderRadius: 12, padding: '13px 15px',
    }}>
      <div style={{ fontSize: 21, fontWeight: 900, color: tone === 'bad' ? '#8A5A2E' : GREEN, lineHeight: 1.4 }}>{value}</div>
      <div style={{ fontSize: 11.5, fontWeight: 800, color: MUTED }}>{label}</div>
    </div>
  )

  return (
    <div dir="rtl" style={{ fontFamily: 'Cairo, sans-serif' }}>
      <div>
        <p style={{ color: MUTED, fontSize: 13, fontWeight: 700, lineHeight: 1.9, margin: '0 0 16px' }}>
          خُذي أرقامه وهو على الهاتف. الحساب يظهر لكِ فوراً — تقولينه شفهياً ولا يخرج منه شيء مكتوب.
          ثم افتحي له ملفه وأرسلي الرابط، ويُكمل هو بنفسه.
        </p>

        {out ? (
          <div style={{ background: '#fff', border: '2px solid #BFE0D3', borderRadius: 16, padding: '24px 22px' }}>
            <div style={{ color: '#1A5C46', fontWeight: 900, fontSize: 19, marginBottom: 8 }}>فُتح ملف {out.company}</div>
            <p style={{ color: MUTED, fontSize: 13.5, fontWeight: 700, lineHeight: 1.95, margin: '0 0 16px' }}>
              أُنشئ حسابه ومنشأته وطلب <b style={{ color: GREEN }}>{quick?.label || 'الفحص الائتماني للمشروع'}</b> بـ٩٩٠ ريال بانتظار دفعه.
              أرسلي له الرسالة أدناه — يفتح الرابط، يضع كلمة مروره، ويجد بياناته وزرّ الدفع أمامه.
            </p>
            <textarea readOnly value={out.message} rows={7}
              style={{ ...IN, lineHeight: 1.95, fontSize: 13, resize: 'vertical' }} />
            <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
              <button onClick={() => navigator.clipboard?.writeText(out.message)}
                style={{ background: GREEN, color: '#fff', border: 'none', padding: '11px 22px', borderRadius: 999, fontFamily: 'Cairo', fontWeight: 900, fontSize: 13, cursor: 'pointer' }}>
                انسخي الرسالة
              </button>
              <a href={'https://wa.me/' + who.phone.replace(/\D/g, '').replace(/^0/, '966') + '?text=' + encodeURIComponent(out.message)}
                target="_blank" rel="noopener noreferrer"
                style={{ background: '#25D366', color: '#fff', padding: '11px 22px', borderRadius: 999, fontWeight: 900, fontSize: 13, textDecoration: 'none' }}>
                أرسليها واتساب
              </a>
              <button onClick={() => { setOut(null); if (onDone) onDone(); else setWho({ full_name: '', phone: '', email: '', company_name: '', city: '', sector: '' }) }}
                style={{ background: 'transparent', color: MUTED, border: '1.5px solid #D9E5DF', padding: '11px 22px', borderRadius: 999, fontFamily: 'Cairo', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
                أغلق
              </button>
            </div>
            <div style={{ background: '#FBF3EC', border: '1px solid #EBD5C2', borderRadius: 10, padding: '11px 14px', marginTop: 14, color: '#8A5A2E', fontSize: 12.5, fontWeight: 800, lineHeight: 1.85 }}>
              الوثيقة لا تُجهَّز ولا تُسلَّم قبل تأكيد تحويله. لا ترسلي له شيئاً مكتوباً من الأرقام.
            </div>
          </div>
        ) : (
          <>
            {card('من هو', (
              <div style={grid()}>
                {([
                  ['full_name', 'الاسم الكامل *'], ['phone', 'الجوال *'], ['email', 'البريد الإلكتروني *'],
                  ['company_name', 'اسم المنشأة أو المشروع'], ['city', 'المدينة'], ['sector', 'النشاط'],
                ] as [keyof typeof who, string][]).map(([k, t]) => (
                  <div key={k}>
                    <label style={{ display: 'block', color: GREEN, fontWeight: 800, fontSize: 12.5, marginBottom: 5 }}>{t}</label>
                    <input value={who[k]} onChange={(e) => setWho((p) => ({ ...p, [k]: e.target.value }))} style={IN} />
                  </div>
                ))}
              </div>
            ))}

            {card('أرقام مشروعه — يعرفها كلها', (
              <>
                <div style={grid()}>
                  {ASK.map((x) => (
                    <div key={x.k as string}>
                      <label style={{ display: 'block', color: GREEN, fontWeight: 800, fontSize: 12.5, marginBottom: 5 }}>{x.t}</label>
                      <input inputMode="numeric" value={f[x.k as string] || ''} onChange={(e) => set(x.k as string, e.target.value)} style={IN} />
                      {x.hint && <div style={{ color: '#9DB3AB', fontSize: 11, fontWeight: 700, marginTop: 3 }}>{x.hint}</div>}
                    </div>
                  ))}
                </div>
                <div style={{ borderTop: '1px dashed #E4EFEA', marginTop: 16, paddingTop: 14 }}>
                  <div style={{ color: MUTED, fontSize: 12, fontWeight: 800, marginBottom: 10 }}>
                    افتراضات لا تُسأل عنه — عدّليها فقط إن ذكر غيرها
                  </div>
                  <div style={grid('160px')}>
                    {DEFAULTS.map((x) => (
                      <div key={x.k as string}>
                        <label style={{ display: 'block', color: MUTED, fontWeight: 800, fontSize: 12, marginBottom: 5 }}>{x.t}</label>
                        <input inputMode="numeric" value={f[x.k as string] || ''} onChange={(e) => set(x.k as string, e.target.value)} style={IN} />
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ))}

            {/* الحساب — يظهر لها وحدها، ويتحدّث مع كل رقم تكتبه */}
            <div style={{ background: calc ? '#fff' : '#F2F6F5', border: '1.5px solid ' + (calc ? '#BFE0D3' : '#E4EFEA'), borderRadius: 14, padding: '18px 20px', marginBottom: 16 }}>
              <div style={{ color: GREEN, fontWeight: 900, fontSize: 14.5, marginBottom: 4 }}>الحساب — لكِ أنتِ</div>
              <div style={{ color: '#9DB3AB', fontSize: 11.5, fontWeight: 700, marginBottom: 14 }}>
                لا تُرسلي هذه الأرقام مكتوبةً. تُقال في المكالمة فقط.
              </div>

              {!calc ? (
                <div style={{ color: MUTED, fontSize: 13, fontWeight: 700 }}>
                  أكملي سعر الوحدة وعددها وتكلفة التجهيز ليظهر الحساب.
                </div>
              ) : (
                <>
                  <div style={grid('150px')}>
                    {stat('حجم الاستثمار', money(totalInvestment) + ' ر.س')}
                    {stat('تغطية خدمة الدين — السنة ١', dscr1 === null ? '—' : dscr1.toFixed(2) + '×',
                      dscr1 === null ? undefined : dscr1 >= 1.25 ? 'good' : 'bad')}
                    {stat('فترة الاسترداد', payback === null ? 'لا تسترد' : payback.toFixed(1).replace('.0', '') + ' سنة',
                      payback === null ? 'bad' : payback <= 4 ? 'good' : undefined)}
                    {stat('نقطة التعادل السنوية', money(breakEven) + ' ر.س')}
                  </div>

                  <div style={{ background: '#F2FAF6', borderRight: '4px solid #2E9E7B', borderRadius: 10, padding: '13px 16px', marginTop: 14 }}>
                    <div style={{ color: '#1A6B52', fontWeight: 900, fontSize: 12.5, marginBottom: 5 }}>قوليها له كما هي</div>
                    <div style={{ color: '#33544B', fontSize: 13.8, fontWeight: 700, lineHeight: 2 }}>{spoken}</div>
                  </div>

                  {tier && (
                    <div style={{ background: '#FBF5E8', border: '1px solid #E8D9A8', borderRadius: 10, padding: '12px 15px', marginTop: 12, color: '#8A6D1F', fontSize: 13, fontWeight: 800, lineHeight: 1.9 }}>
                      سعر الدراسة الكاملة على هذا الحجم: <b>{tier.amount != null ? money(tier.amount) + ' ر.س' : 'بعرض خاص — حوّليه للدكتور'}</b>
                      {' · '}و{quick?.label || 'الفحص'} بـ<b>٩٩٠</b> يُخصم منها بالكامل خلال ٣٠ يوماً.
                    </div>
                  )}
                </>
              )}
            </div>

            {err && <div style={{ color: '#B4453C', fontWeight: 800, fontSize: 13, marginBottom: 12 }}>{err}</div>}

            <button onClick={openFile} disabled={!canOpen || busy}
              style={{
                width: '100%', background: canOpen && !busy ? GREEN : '#9DB3AB', color: '#fff', border: 'none',
                padding: '15px', borderRadius: 999, fontFamily: 'Cairo', fontWeight: 900, fontSize: 15,
                cursor: canOpen && !busy ? 'pointer' : 'default',
              }}>
              {busy ? 'جارٍ فتح الملف…' : 'افتح ملفه وجهّز الرابط'}
            </button>
            {!canOpen && (
              <p style={{ color: '#9DB3AB', fontSize: 12, fontWeight: 700, textAlign: 'center', margin: '10px 0 0', lineHeight: 1.85 }}>
                يلزم الاسم والجوال والبريد وأرقام المشروع. والبريد ضروري — بلا بريدٍ لا حساب، وبلا حسابٍ لا رابط.
              </p>
            )}
            <p style={{ color: MUTED, fontSize: 12, fontWeight: 700, textAlign: 'center', margin: '14px 0 0', lineHeight: 1.9 }}>
              لا نطلب منه تحويلاً في هذه المكالمة. يفتح الرابط ويدفع متى ناسبه — والوثيقة تُفرَج له فور تأكيد التحويل.
            </p>
          </>
        )}

        <div style={{ background: '#fff', border: '1.5px solid #EAF2EE', borderRadius: 14, padding: '16px 20px', marginTop: 22 }}>
          <div style={{ color: GREEN, fontWeight: 900, fontSize: 13.5, marginBottom: 8 }}>ثلاثة حدود لا تتجاوزينها</div>
          <ul style={{ margin: 0, paddingInlineStart: 20, color: '#4A6A60', fontSize: 12.8, fontWeight: 700, lineHeight: 2 }}>
            <li><b>لا تفاوضي في السعر.</b> الشرائح معلنة على murdi.sa/services — تُقرأ ولا تُخصم. مستشار مالي يخصم يفقد صفته.</li>
            <li><b>لا تعطي رأياً مالياً.</b> لا «مشروعك ناجح» ولا «راح يتموّل». الجواب: «هذا اللي يجاوبك عليه الدكتور عبدالحكيم بعد ما نحسب أرقامك».</li>
            <li><b>اصرفي من لا تخصّه.</b> من يطلب رأس مال عامل أو تمويل ذمم أو إعادة جدولة لا مشروع فيه يُدرس — مساره التمويل مباشرة.</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
