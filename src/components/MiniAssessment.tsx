'use client'

import { useState, useEffect, useRef } from 'react'
import { isSaudiMobile } from '@/lib/phone'
import { useRouter } from 'next/navigation'
import { fireConversion, LEAD_SUBMITTED } from '@/lib/adsConversion'

// لا عميل Supabase هنا بعد الآن: الحفظ كلّه عبر `/api/mini-save`.

type Q = { q: string; opts: { t: string; v: number }[] }

// ★ ٢٠ سبتمبر — أُعيد ترتيب الأسئلة وأُضيف أوّلها.
//
//   كان التقييم **لا يسأل عن الإيراد إطلاقاً**: يسأل عن نموّه وعن انتظام
//   الربح، ولا يسأل عن حجمه. فمنشأةٌ إيرادها خمسون ألفاً تمرّ بالأسئلة
//   الثمانية وتخرج بدرجةٍ محترمة وتترك رقمها، وتُحتسب إحالةً ناجحة.
//   وسجلٌّ تجاري عمره عشرة أشهر يمرّ كذلك — وأغلب الجهات لا تفتح ملفاً
//   دون سنتين.
//
//   فصار الإيراد والعمر **أول سؤالين**، وهما البوّابة: من لم يبلغ الحدّ
//   الأدنى لا يُكمل ولا يُطلب رقمه ولا تُطلق له إحالة. وهذا يبدو خسارةً
//   في العدد وهو ربحٌ في الأمر كلّه: العدد الذي نبلّغ به جوجل هو ما
//   تتعلّم عليه، فكل ليدٍ صغير نُبلّغ به يشتري لنا عشرةً مثله.
const QUESTIONS: Q[] = [
  { q: 'كم إيراد منشأتك السنوي تقريباً؟', opts: [
    { t: 'أقل من مليون ريال', v: 2 }, { t: '1–3 مليون', v: 7 },
    { t: '3–10 مليون', v: 11 }, { t: 'أكثر من 10 مليون', v: 13 } ] },
  { q: 'منشأتك تعمل منذ كم؟', opts: [
    { t: 'أقل من سنة', v: 2 }, { t: '1–2 سنة', v: 7 },
    { t: '2–5 سنوات', v: 11 }, { t: 'أكثر من 5 سنوات', v: 13 } ] },
  { q: 'هل لديك قوائم مالية حديثة؟', opts: [
    { t: 'لا يوجد', v: 2 }, { t: 'تقريبية/داخلية', v: 7 },
    { t: 'مدققة لسنة', v: 11 }, { t: 'مدققة 3 سنوات', v: 13 } ] },
  { q: 'كيف هو نمو إيراداتك؟', opts: [
    { t: 'متذبذب/متراجع', v: 3 }, { t: 'مستقر', v: 8 },
    { t: 'نمو جيد', v: 11 }, { t: 'نمو قوي ومستمر', v: 13 } ] },
  { q: 'هل أرباحك منتظمة؟', opts: [
    { t: 'خسارة حالياً', v: 2 }, { t: 'تعادل تقريباً', v: 7 },
    { t: 'ربح بسيط', v: 10 }, { t: 'ربح جيد ومستقر', v: 12 } ] },
  { q: 'وضوح فصل الشركة عن مالكها مالياً؟', opts: [
    { t: 'مختلط تماماً', v: 2 }, { t: 'جزئي', v: 6 },
    { t: 'منفصل غالباً', v: 9 }, { t: 'منفصل تماماً', v: 12 } ] },
  { q: 'مستوى الديون مقارنة بحجم نشاطك؟', opts: [
    { t: 'مرتفع جداً', v: 3 }, { t: 'متوسط', v: 7 },
    { t: 'منخفض', v: 10 }, { t: 'شبه معدوم', v: 12 } ] },
  { q: 'ما هدفك الأساسي الآن؟', opts: [
    { t: 'تمويل', v: 8 }, { t: 'استثمار/شريك', v: 8 },
    { t: 'طرح مستقبلي', v: 8 }, { t: 'ما زلت أستكشف', v: 6 } ] },
]

/** مواضع السؤالين البوّابيّين وخياراتهما المُسقِطة */
const Q_REVENUE = 0
const Q_YEARS = 1

/**
 * وزن الإحالة عند جوجل — مشتقٌّ من الإيراد والعمر.
 * صفرٌ يعني: لا تُطلق إحالة أصلاً، فلا نُعلّم الحملة على هذا النوع.
 */
export function leadWeight(revIdx: number, yearIdx: number): number {
  if (revIdx <= 0 || yearIdx <= 0) return 0          // دون الحدّ الأدنى
  if (revIdx >= 3 && yearIdx >= 2) return 100        // عشرة ملايين فأكثر، سنتان فأكثر
  if (revIdx >= 2 && yearIdx >= 2) return 60         // ثلاثة إلى عشرة
  if (revIdx >= 2) return 30
  return 15                                          // مليون إلى ثلاثة — يُقبل بوزنٍ خفيف
}

const MAX = QUESTIONS.reduce((s, q) => s + Math.max(...q.opts.map(o => o.v)), 0)

function verdict(pct: number) {
  if (pct >= 75) return { label: 'جاهزية عالية', color: '#2E9E7B',
    text: 'مؤشراتك قوية. شركتك قريبة من الجاهزية — الخطوة التالية تجهيز ملفك بشكل احترافي لرفع فرص القبول.' }
  if (pct >= 50) return { label: 'جاهزية متوسطة', color: '#C9A84C',
    text: 'لديك أساس جيد، لكن توجد فجوات تحتاج معالجة قبل التقدّم للجهات المناسبة. التجهيز الصحيح يصنع الفرق.' }
  return { label: 'تحتاج تجهيزاً', color: '#d9772e',
    text: 'هناك عوائق تقلّل فرص قبولك حالياً. الخبر الجيد: كلها قابلة للمعالجة بخطة واضحة، وهذا ما يفعله فريق مُرضي.' }
}

export default function MiniAssessment() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [ans, setAns] = useState<number[]>([])
  const [name, setName] = useState('')
  const [biz, setBiz] = useState('')
  const [phone, setPhone] = useState('')
  const [done, setDone] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  /** حارس الإحالة الناجحة — لا تُطلق مرتين لو ضُغط الزرّ مرّتين */
  const converted = useRef(false)
  /** دون الحدّ الأدنى — يُوقَف قبل طلب الرقم ولا تُطلق له إحالة */
  const [blocked, setBlocked] = useState(false)

  // ═══ الموقع يُحفظ إلى جانب القيمة ═══
  // خيارات السؤال الأخير الثلاثة الأولى قيمتها 8 جميعاً — تمويل واستثمار
  // وطرح. فأي استنتاج للهدف من القيمة يُرجع الأول دائماً، سواءٌ كُتب
  // بـindexOf أو بـfindIndex. وقيس ذلك في القاعدة: 62 تقييماً تامّاً قيمة
  // إجابته الأخيرة 8، و62 منها سُجِّلت «تمويل» وصفرٌ «استثمار» أو «طرح».
  // أي أن طالبي الشريك والإدراج كانوا يُنادَون بعرض تمويل طوال الوقت.
  // فالموقع يُحفظ عند الضغط، ولا يُستنتج بعده.
  const [picks, setPicks] = useState<number[]>([])

  const pick = (val: number, idx: number) => {
    const next = [...ans, val]
    const nextPicks = [...picks, idx]
    setAns(next)
    setPicks(nextPicks)
    // البوّابة: بعد سؤالَي الإيراد والعمر، من لم يبلغ الحدّ الأدنى يُوقَف
    // هنا — قبل أن يُطلب رقمه وقبل أن تُطلق إحالة. ولا يُحفظ صفّاً في
    // القاعدة، فلا يظهر في قائمة مكالمات المكتب ولا يُشغل وقت أحد.
    if (step === Q_YEARS && leadWeight(nextPicks[Q_REVENUE] ?? -1, idx) === 0) {
      setBlocked(true)
      return
    }
    if (step + 1 < QUESTIONS.length) setStep(step + 1)
    else setStep(QUESTIONS.length)
  }

  const weight = leadWeight(picks[Q_REVENUE] ?? -1, picks[Q_YEARS] ?? -1)

  const score = ans.reduce((s, val) => s + val, 0)
  const pct = Math.round((score / MAX) * 100)
  const v = verdict(pct)

  // مصدر الزائر — يُقيَّد مع التقييم ليُعرف من أين جاء.
  //
  // ★ وكان `src` لا يُملأ إلا إذا حمل الرابط `?src=` بيدنا. فجاء أول تقييمٍ
  //   بعد إطلاق حملة جوجل بمصدرٍ فارغ، ولم نستطع أن نقول: أمن الإعلان هو
  //   أم من بحثٍ عاديّ؟ وحملةٌ لا يُعرف عائدها تُصرَف بلا حساب.
  //
  // ★ فصار الرابط يُقرأ على ثلاث مراتب: `src` الصريح أولاً، ثم **معاملات
  //   جوجل نفسها** (gclid · gbraid · wbraid) وهي تُلحق بكل نقرة إعلان
  //   تلقائياً فلا تحتاج منّا ضبطاً، ثم `utm_source`. ويُحفظ في الجلسة فلا
  //   يضيع حين ينتقل الزائر بين الصفحات.
  const [adSrc, setAdSrc] = useState('')
  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search)
      const fromAds = q.get('gclid') || q.get('gbraid') || q.get('wbraid')
      const p = q.get('src') || (fromAds ? 'google-ads' : '') || q.get('utm_source') || ''
      if (p) { sessionStorage.setItem('murdi_src', p); setAdSrc(p) }
      else { const s = sessionStorage.getItem('murdi_src'); if (s) setAdSrc(s) }
    } catch { /* تجاهل */ }
  }, [])

  const submit = async () => {
    setErr('')
    if (name.trim().length < 2) { setErr('فضلاً اكتب اسمك'); return }
    // اسم المنشأة كان لا يُسأل عنه إطلاقاً، فتصل الموظفة قائمةً من الأسماء
    // بلا منشآت — وتفتح المكالمة بسؤالٍ ضعيف: «عن أي شركة نتحدث؟»
    if (biz.trim().length < 2) { setErr('فضلاً اكتب اسم منشأتك'); return }
    // التحقّق من الشكل لا من الطول: «١٢٣٤٥٦٧٨٩» تسع خانات وليس جوالاً
    if (!isSaudiMobile(phone)) { setErr('رقم الجوال غير صحيح — اكتبه بصيغة 05xxxxxxxx'); return }
    setSaving(true)
    try {
      // الهدف يُقرأ بموقع الخيار لا بقيمته: الخيارات الثلاثة الأولى قيمتها 8 جميعاً،
      // فكان indexOf يعيد صفراً دائماً ويُسجَّل كل ليد «تمويل» — بمن فيهم طالبو الاستثمار والطرح.
      const goalIdx = picks[QUESTIONS.length - 1] ?? -1
      const track = ['تمويل', 'استثمار', 'طرح', 'استكشاف'][goalIdx] || ''
      // ★ يمرّ بـ`/api/mini-save` لا بالكتابة المباشرة في القاعدة — ١٨ سبتمبر.
      //   كان الإدراج هنا مباشراً بمفتاح المتصفح، فيتخطّى المسار الذي يُطبّع
      //   الجوال ويُخطر المكتب. ونتيجته أن العميل يدخل من الصفحة الرئيسية
      //   فلا يعلم به أحد — وهو العطب نفسه الذي أوقف ثمانيةَ عملاءَ يوماً
      //   كاملاً، لكنه بقي حيّاً في هذا المسار وحده بعد إصلاح الآخر.
      const res = await fetch('/api/mini-save', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(), company_name: biz.trim(), phone: phone.trim(),
          track, score: pct, answers: ans, src: adSrc || null,
          completed: ans.length >= QUESTIONS.length,
        }),
      })
      if (!res.ok) { setErr('تعذّر إرسال بياناتك، حاول مرة أخرى أو راسلنا واتساب'); return }
      // ★ الإحالة الناجحة تُطلق هنا أيضاً لا في طلب الخدمة وحده.
      //   والسبب أن الحملة تجلب **تقييمات** لا طلبات خدمة: وصلت ثلاثة
      //   تسجيلات في يومين وبقي عدّاد جوجل صفراً، فلا تتعلّم الحملة على
      //   شيء وتُنفق بلا إشارة. والليد هو الليد — اسمٌ وجوالٌ ومنشأة.
      // ★ وبعد الحفظ لا قبله: لا تُعدّ إحالةً ناجحة إلا ما دخل القاعدة فعلاً.
      // ★ الإحالة تحمل وزنها. ومن كان وزنه صفراً لا يصل إلى هنا أصلاً
      //   (أُوقف عند البوّابة)، والحارس في fireConversion طبقةٌ ثانية.
      if (!converted.current) {
        converted.current = true
        fireConversion(LEAD_SUBMITTED, { phone }, { value: weight })
      }
      setDone(true)
    } catch {
      setErr('حدث خطأ، حاول مرة أخرى')
    } finally { setSaving(false) }
  }

  return (
    <section className="lp-mini">
      <div className="lp-mini-inner">
        <div className="lp-mini-badge">اعرف مؤشرك المبدئي · دقيقة واحدة</div>
        <h2>كم شركتك جاهزة لرأس المال؟</h2>
        <p className="lp-mini-sub">أجب عن أسئلة سريعة واعرف مؤشرك المبدئي فوراً، ثم سجّل للتقييم الكامل ومطابقة الجهات.</p>

        {blocked && (
          <div className="lp-mini-done" style={{ textAlign: 'right' }}>
            <h3 style={{ color: '#1A3D34', fontWeight: 900, fontSize: 19, marginBottom: 10 }}>
              منشأتك لم تبلغ بعدُ حدَّ ما تفتح له جهاتُ التمويل ملفاً
            </h3>
            <p style={{ color: '#5E7C73', fontSize: 14, lineHeight: 2, marginBottom: 12 }}>
              ونقولها لك صراحةً بدل أن نأخذ وقتك: أغلب جهات التمويل في السعودية تشترط
              <b> سنتين تشغيلاً </b> و<b> إيراداً سنوياً يتجاوز المليون</b> قبل أن تبدأ الدراسة.
              وأي مكتبٍ يَعِدك اليوم بغير ذلك يبيعك أملاً لا ملفاً.
            </p>
            <div style={{ background: '#F4FAF7', borderRight: '4px solid #2E9E7B', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
              <div style={{ color: '#1A3D34', fontWeight: 900, fontSize: 13.5, marginBottom: 6 }}>ما يرفع ملفك من اليوم</div>
              <div style={{ color: '#5E7C73', fontSize: 13, lineHeight: 2 }}>
                افصل حساب المنشأة عن حسابك الشخصي تماماً · أصدر فواتيرك نظامياً عبر نظامٍ معتمد ·
                جهّز قوائم مالية ولو داخلية لكل سنة · واحتفظ بكشف حسابٍ بنكي لنشاطك وحده.
                <br />هذه الأربعة هي التي تُقرأ في ملفك بعد سنة، وتصنع فرقاً أكبر من أي شيء آخر.
              </div>
            </div>
            <p style={{ color: '#8AA49B', fontSize: 12.5, lineHeight: 1.9 }}>
              ومتى بلغت المنشأة سنتين وإيراداً فوق المليون — ارجع إلينا وملفك يكون قد صار جاهزاً للقراءة.
            </p>
          </div>
        )}

        {!blocked && step < QUESTIONS.length && (
          <div className="lp-mini-card">
            <div className="lp-mini-progress">
              <div className="lp-mini-bar" style={{ width: `${(step / QUESTIONS.length) * 100}%` }} />
            </div>
            <div className="lp-mini-qnum">سؤال {step + 1} من {QUESTIONS.length}</div>
            <h3 className="lp-mini-q">{QUESTIONS[step].q}</h3>
            <div className="lp-mini-opts">
              {QUESTIONS[step].opts.map((o, i) => (
                <button key={i} className="lp-mini-opt" onClick={() => pick(o.v, i)}>{o.t}</button>
              ))}
            </div>
          </div>
        )}

        {!blocked && step === QUESTIONS.length && !done && (
          <div className="lp-mini-card">
            <div className="lp-mini-score" style={{ color: v.color }}>{pct}<span>/100</span></div>
            <div className="lp-mini-verdict" style={{ background: v.color }}>{v.label}</div>
            <p className="lp-mini-text">{v.text}</p>
            <div className="lp-mini-gate">
              <p className="lp-mini-gate-t">اكتب اسمك وجوالك ليتواصل معك مستشار مُرضي، ويطلعك على نتيجتك التفصيلية وخطوتك التالية نحو رأس المال.</p>
              <input className="lp-mini-input" placeholder="الاسم" value={name} onChange={e => setName(e.target.value)} />
              <input className="lp-mini-input" placeholder="اسم المنشأة" value={biz} onChange={e => setBiz(e.target.value)} />
              <input className="lp-mini-input" placeholder="رقم الجوال 05xxxxxxxx" inputMode="tel" maxLength={14} value={phone} onChange={e => setPhone(e.target.value)} />
              {err && <div className="lp-mini-err">{err}</div>}
              <button className="lp-mini-submit" onClick={submit} disabled={saving}>
                {saving ? 'جارٍ الإرسال…' : 'أبدأ — ليتواصل معي مستشار مُرضي'}
              </button>
            </div>
          </div>
        )}

        {done && (
          <div className="lp-mini-card lp-mini-thanks">
            <div className="lp-mini-check">✓</div>
            <h3>هذه بدايتك يا {name}</h3>
            <p className="lp-mini-thanks-sub">درجتك {pct}/100 — وصلَنا طلبك وسيتواصل معك مستشار مُرضي قريباً. وهذا ما يفتحه لك مرضي:</p>

            <div className="lp-mini-benefits">
              <div className="lp-mini-benefit">
                <span className="lp-mini-b-icon">🧭</span>
                <div><b>منهجية قوية مجرّبة</b><p>تقييم دقيق ← كشف العوائق ← خارطة طريق ← مطابقة مع الجهات المناسبة ← مرافقة كاملة.</p></div>
              </div>
              <div className="lp-mini-benefit">
                <span className="lp-mini-b-icon">🚪</span>
                <div><b>ثلاثة مسارات مفتوحة</b><p>تمويل، استثمار، وطرح — كلها مفتوحة لك بعد التقييم المجاني</p></div>
              </div>
              <div className="lp-mini-benefit">
                <span className="lp-mini-b-icon">🎯</span>
                <div><b>خدمات تُجهّزك فعلاً</b><p>تجهيز ملفك المالي، إبراز جاذبية شركتك، وربطك بالجهات الأقرب لقبولك محلياً وعالمياً.</p></div>
              </div>
              <div className="lp-mini-benefit">
                <span className="lp-mini-b-icon">🌅</span>
                <div><b>آفاق أوسع لشركتك</b><p>من مكانك الحالي إلى أبواب رأس المال — بإشراف د. عبدالحكيم وفريق مُرضي في كل خطوة.</p></div>
              </div>
            </div>

            <button className="lp-mini-register" onClick={() => router.push('/auth/signup')}>سجّل وافتح ملف شركتك الآن</button>
            <p className="lp-mini-note">سيتواصل معك فريق مُرضي أيضاً بنتيجتك التفصيلية.</p>
          </div>
        )}
      </div>
    </section>
  )
}
