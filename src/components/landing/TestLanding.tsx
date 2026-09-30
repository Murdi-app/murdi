'use client'

import { useState, useEffect, useRef } from 'react'
import { fireConversion, LEAD_SUBMITTED } from '@/lib/adsConversion'
import { REVENUE_Q, YEARS_Q, leadWeight } from '@/lib/leadWeight'
import { captureFirstTouch, currentSource } from '@/lib/attribution'
import { tiktokEvent } from '@/lib/tiktokPixel'

// لا عميل Supabase هنا: كل الحفظ يمرّ بـ`/api/mini-save` — فهو وحده الذي
// يُطبّع الجوال ويُخطر المكتب. وكان عميلٌ مباشرٌ مُعرَّفاً بلا استعمال.

const NAVY = '#13302A'
const FONT = 'Tajawal, Cairo, sans-serif'
const GOLD = '#C9A84C'
const LIGHT = '#9DB3AB'

type Q = { q: string; opts: { t: string; v: number }[] }

const QUESTIONS: Q[] = [
  // ★ ٢٧ سبتمبر — الإيراد والعمر أولاً، بالسؤالين نفسيهما في الصفحة الرئيسية.
  //   كانت الترحيبية تقول «للمنشآت من سنتين بإيراد يتجاوز المليون» ولا تسأل
  //   عن الإيراد أصلاً، فتُبلغ جوجل عن كل من ترك رقمه بوزنٍ واحد.
  REVENUE_Q,
  YEARS_Q,
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
  { q: 'هل لديك حوكمة أو هيكل إداري واضح؟', opts: [
    { t: 'لا', v: 2 }, { t: 'بدائي', v: 6 },
    { t: 'منظّم', v: 9 }, { t: 'حوكمة كاملة', v: 11 } ] },
  { q: 'مستوى الديون مقارنة بحجم نشاطك؟', opts: [
    { t: 'مرتفع جداً', v: 3 }, { t: 'متوسط', v: 7 },
    { t: 'منخفض', v: 10 }, { t: 'شبه معدوم', v: 12 } ] },
  { q: 'ما هدفك الأساسي الآن؟', opts: [
    { t: 'تمويل', v: 8 }, { t: 'استثمار/شريك', v: 8 },
    { t: 'طرح مستقبلي', v: 8 }, { t: 'ما زلت أستكشف', v: 6 } ] },
]

// ★ نسخة تيك توك (`/t/test`): رفضت المنصة الصفحة «فرصةً مالية مضلّلة»، فالنصّ
//   المرئي فيها بإطار «استشارات أعمال» وبلا مفردات المال الممنوعة. والقيم والترتيب
//   كما هي — فالدرجة والوزن والمسار المحفوظ واحدٌ في النسختين؛ النصّ وحده يتغيّر.
const TIKTOK_TEXT: Record<string, string> = {
  'ربح بسيط': 'هامش بسيط',
  'ربح جيد ومستقر': 'هامش جيد ومستقر',
  'تمويل': 'توسعة النشاط أو سيولة التشغيل',
  'استثمار/شريك': 'دخول شريك',
  'طرح مستقبلي': 'إدراج مستقبلي',
  'ما هدفك الأساسي الآن؟': 'ما أولويتك الآن؟',
}
export const TIKTOK_H1 = 'قيّم جاهزية منشأتك وملفها في دقيقة'
const TIKTOK_LEAD = 'تقييم مجاني من مكتب استشارات أعمال للمنشآت القائمة من سنتين فأكثر بإيراد يتجاوز المليون: أين تقف منشأتك اليوم، وما الذي ينقص ملفها، ومن أين تبدأ ترتيبه.'
export const TIKTOK_FOOTER = 'مكتب استشارات أعمال؛ لا نقدّم تمويلاً ولا نعد بنتيجة'
const tt = (t: string, tiktok: boolean) => (tiktok && TIKTOK_TEXT[t]) || t

const MAX = QUESTIONS.reduce((s, q) => s + Math.max(...q.opts.map(o => o.v)), 0)
const TRACK = ['تمويل', 'استثمار', 'طرح', 'استكشاف']
const Q_REVENUE = 0
const Q_YEARS = 1
const Q_GOAL = QUESTIONS.length - 1

function verdict(pct: number) {
  if (pct >= 75) return { label: 'جاهزية عالية', color: '#2E9E7B' }
  if (pct >= 50) return { label: 'جاهزية متوسطة', color: GOLD }
  return { label: 'تحتاج تجهيزاً', color: '#C0564B' }
}

// النقاط الثلاث تُبنى من أضعف وأقوى إجابة فعلياً
function insights(ans: number[]) {
  const labels = ['حجم الإيراد', 'عمر النشاط', 'القوائم المالية', 'نمو الإيرادات', 'انتظام الأرباح', 'الفصل المالي', 'الحوكمة', 'مستوى الديون', 'الهدف']
  const ratios = ans.map((v, i) => ({ i, r: v / Math.max(...QUESTIONS[i].opts.map(o => o.v)) }))
  const sorted = [...ratios].sort((a, b) => a.r - b.r)
  const weakest = sorted[0]
  const strongest = sorted[sorted.length - 1]
  const second = sorted[1]
  return {
    strength: labels[strongest.i],
    weak: labels[weakest.i],
    opportunity: labels[second.i],
  }
}

export default function TestLanding({ tiktok = false }: { tiktok?: boolean }) {
  // ★ ٢٧ سبتمبر ٢٠٢٦ — الأسئلة أولاً، والاسم والجوال بوّابةُ النتيجة.
  //   كانت الترحيبية تَعِد «بلا تسجيل · ٦٠ ثانية» ثم تطلب ثلاثة حقول قبل
  //   أول سؤال، فينقض الوعدُ نفسَه في الخطوة الأولى لزائرٍ دُفع ثمنُ نقرته.
  //   والآن يُجيب أولاً، ثم يُطلب منه ما يكشف نتيجته — وقد استثمر فيها.
  const [stage, setStage] = useState<'welcome' | 'q' | 'blocked' | 'gate' | 'analyzing' | 'result'>('welcome')
  const [qIndex, setQIndex] = useState(0)
  const [name, setName] = useState('')
  // ★ اسم المنشأة واسم صاحبها حقلان لا حقل.
  //   كانت الصفحة تسأل «ما اسم شركتك؟» وتحفظ الجواب في خانة الاسم، فتفتح
  //   الموظفة المكالمة فتنادي صاحبَ المنشأة باسم منشأته — ولا يبقى في الصف
  //   اسمُ إنسانٍ أصلاً.
  const [company, setCompany] = useState('')
  const [phone, setPhone] = useState('')
  const [ans, setAns] = useState<number[]>([])
  // ★ المسار كان يُحسب بـ`[8,8,8,6].indexOf(v)` — والثلاثة الأُوَل قيمتها ٨،
  //   فيُرجع الفهرس صفراً دائماً ويُسجَّل كلُّ عميلٍ «تمويل» ولو اختار
  //   «استثمار» أو «طرح». فصار الاختيار يُحفظ بفهرسه لا بقيمته.
  const [picks, setPicks] = useState<number[]>([])
  const [adSrc, setAdSrc] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const converted = useRef(false)

  useEffect(() => {
    // ★ المصدر من الرابط (src · gclid · ttclid · fbclid · utm_source)، وإلا من
    //   كوكي أول لمسة — التعريف في `@/lib/attribution`. كان تيك توك يصل بـ`ttclid`
    //   فلا يُقرأ، و٩١٩ نقرة في يومين دخلت بلا مصدر.
    captureFirstTouch()
    setAdSrc(currentSource())
  }, [])

  const score = ans.reduce((s, v) => s + v, 0)
  const pct = ans.length === QUESTIONS.length ? Math.round((score / MAX) * 100) : 0

  // شريط التقدم: 8 أسئلة + بوّابة النتيجة = 9 خطوات
  const totalSteps = QUESTIONS.length + 1
  let stepDone = 0
  if (stage === 'q') stepDone = qIndex
  else if (stage === 'gate') stepDone = QUESTIONS.length
  else if (stage === 'analyzing' || stage === 'result') stepDone = totalSteps
  const progress = Math.round((stepDone / totalSteps) * 100)

  const weight = leadWeight(picks[Q_REVENUE] ?? -1, picks[Q_YEARS] ?? -1)

  const pick = (v: number, idx: number) => {
    setAns([...ans, v])
    setPicks([...picks, idx])
    // البوّابة: من لم يبلغ الحدّ الأدنى يُصارَح هنا — قبل أن يُطلب رقمه وقبل
    // أن تُطلق إحالة تعلّم الحملة على أمثاله. والمنطق نفسه في الصفحة الرئيسية.
    if (qIndex === Q_YEARS && leadWeight(picks[Q_REVENUE] ?? -1, idx) === 0) { setStage('blocked'); return }
    if (ans.length + 1 < QUESTIONS.length) setQIndex(qIndex + 1)
    else setStage('gate')
  }

  // حفظٌ واحد بعد الأسئلة كلّها — والنتيجة لا تنكشف إلا بعد نجاحه.
  // والفشل يُقال ويبقى الزائر على البوّابة ليصحّح (غالباً رقمٌ خاطئ يردّه
  // الخادم برسالته)؛ فلو مضى إلى النتيجة وقد فشل الحفظ، خسرنا عميلاً دُفع
  // ثمنُ نقرته ولم يعلم به أحد.
  const reveal = async () => {
    setErr('')
    if (company.trim().length < 2) { setErr('فضلاً اكتب اسم منشأتك'); return }
    if (name.trim().length < 2) { setErr('فضلاً اكتب اسمك'); return }
    if (phone.trim().length < 9) { setErr('فضلاً اكتب رقم جوال صحيح'); return }
    setBusy(true)
    try {
      // المسار من فهرس الخيار المختار في السؤال الثامن، لا من قيمته
      const track = TRACK[picks[Q_GOAL]] || ''
      const res = await fetch('/api/mini-save', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), company_name: company.trim(), phone: phone.trim(), answers: ans, score: pct, track, src: adSrc || null, completed: true }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok || !j.id) { setErr(j.error || 'تعذّر الحفظ — أعد المحاولة'); return }
      // بعد نجاح الحفظ في mini_assessments وحده — تحويل جوجل وحدث تيك توك (بلا بيانات شخصية)
      if (!converted.current) { converted.current = true; fireConversion(LEAD_SUBMITTED, { phone }, { value: weight }); tiktokEvent('SubmitForm') }
      setStage('analyzing')
      setTimeout(() => setStage('result'), 2200)
    } catch {
      setErr('تعذّر الاتصال — تحقق من الشبكة وأعد المحاولة')
    } finally { setBusy(false) }
  }

  const v = verdict(pct)
  const ins = ans.length === QUESTIONS.length ? insights(ans) : null

  return (
    <div style={{ minHeight: '100vh', background: NAVY, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 18px', fontFamily: FONT, direction: 'rtl' }}>
      <div style={{ width: '100%', maxWidth: 460 }}>

        {/* ★ الشعار والرقم والترخيص — كانت الصفحة تطلب جوال الزائر وليس فيها
            ما يقول له مع مَن يتعامل. وهي وحدها بين صفحات الإعلان بلا ذلك. */}
        {tiktok ? (
          // تيك توك: لا رقم ظاهر ولا رابط يخرج من الصفحة
          <div style={{ textAlign: 'center', marginBottom: 22, paddingBottom: 10, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ color: GOLD, fontSize: 22, fontWeight: 900, letterSpacing: 1 }}>مُرضي</div>
            <div style={{ color: LIGHT, fontSize: 12, fontWeight: 700, marginTop: 2 }}>استشارات أعمال · الدكتور عبدالحكيم المرضي</div>
          </div>
        ) : (<>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <a href="/" style={{ color: GOLD, fontSize: 22, fontWeight: 900, letterSpacing: 1, textDecoration: 'none' }}>مُرضي</a>
          <a href="tel:0570749196" style={{ color: '#fff', fontSize: 14, fontWeight: 800, textDecoration: 'none', direction: 'ltr' }}>0570749196</a>
        </div>
        <div style={{ color: LIGHT, fontSize: 11.5, fontWeight: 700, textAlign: 'center', marginBottom: 22, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          الدكتور عبدالحكيم المرضي · مستشار مالي معتمد — <span style={{ whiteSpace: 'nowrap' }}>ترخيص رقم FL-457927015</span>
        </div>
        </>)}

        {/* شريط التقدم */}
        {stage !== 'welcome' && stage !== 'blocked' && (
          <div style={{ marginBottom: 26 }}>
            <div style={{ height: 8, background: 'rgba(255,255,255,0.12)', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: progress + '%', background: GOLD, borderRadius: 99, transition: 'width 0.4s ease' }} />
            </div>
            <div style={{ textAlign: 'left', color: LIGHT, fontSize: 12, marginTop: 6 }}>{progress}%</div>
          </div>
        )}

        {/* شاشة الترحيب */}
        {stage === 'welcome' && (
          <div style={{ textAlign: 'center' }}>
            {tiktok ? (<>
            <h1 style={{ color: '#fff', fontSize: 27, fontWeight: 900, lineHeight: 1.5, margin: '0 0 14px' }}>{TIKTOK_H1}</h1>
            <p style={{ color: LIGHT, fontSize: 16, lineHeight: 1.8, margin: '0 0 8px' }}>{TIKTOK_LEAD}</p>
            <p style={{ color: GOLD, fontSize: 14, fontWeight: 700, margin: '0 0 30px' }}>مجاناً · ٩ أسئلة · بلا تسجيل</p>
            </>) : (<>
            <h1 style={{ color: '#fff', fontSize: 27, fontWeight: 900, lineHeight: 1.5, margin: '0 0 14px' }}>تمويل منشأتك — ابدأ من جاهزيتك</h1>
            <p style={{ color: LIGHT, fontSize: 16, lineHeight: 1.8, margin: '0 0 8px' }}>للمنشآت القائمة من سنتين فأكثر بإيراد يتجاوز المليون. جهات التمويل لا ترفض منشأتك — ترفض ملفاً ناقصاً. اعرف في دقيقة أين تقف، وما الذي ينقصك، وأي الجهات تنطبق عليك شروطها.</p>
            <p style={{ color: GOLD, fontSize: 14, fontWeight: 700, margin: '0 0 30px' }}>مجاناً · ٩ أسئلة · بلا تسجيل · تمويل من ٥٠٠ ألف إلى ١٠ ملايين</p>
            </>)}
            <button onClick={() => setStage('q')} style={{ background: GOLD, color: NAVY, border: 'none', borderRadius: 99, padding: '16px 46px', fontSize: 18, fontWeight: 900, cursor: 'pointer', fontFamily: FONT, boxShadow: '0 8px 24px rgba(201,162,75,0.3)' }}>ابدأ الآن ←</button>
          </div>
        )}

        {/* دون الحدّ الأدنى — صراحةٌ بدل أن يُؤخذ رقمه ووقته */}
        {stage === 'blocked' && tiktok && (
          <div style={{ textAlign: 'right' }}>
            <h2 style={{ color: '#fff', fontSize: 21, fontWeight: 800, lineHeight: 1.6, margin: '0 0 14px' }}>هذا التقييم مصمَّم لمنشأةٍ أكبر قليلاً من منشأتك اليوم</h2>
            <p style={{ color: LIGHT, fontSize: 15, lineHeight: 1.9, margin: '0 0 16px' }}>ونقولها لك صراحةً بدل أن نأخذ وقتك: التقييم يقرأ منشأةً تعمل منذ <b style={{ color: '#fff' }}>سنتين</b> فأكثر، و<b style={{ color: '#fff' }}>إيرادها السنوي يتجاوز المليون</b>.</p>
            <div style={{ background: 'rgba(46,158,123,0.12)', borderRight: '4px solid #2E9E7B', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
              <div style={{ color: '#fff', fontWeight: 800, fontSize: 14.5, marginBottom: 6 }}>ما يرتّب منشأتك من اليوم</div>
              <div style={{ color: LIGHT, fontSize: 14, lineHeight: 1.9 }}>افصل حساب المنشأة عن حسابك الشخصي · أصدر فواتيرك نظامياً · جهّز قوائم مالية ولو داخلية لكل سنة · واحتفظ بكشف حسابٍ بنكي لنشاطك وحده.</div>
            </div>
            <p style={{ color: LIGHT, fontSize: 13, lineHeight: 1.9, margin: 0 }}>ومتى بلغت المنشأة سنتين وإيراداً فوق المليون — ارجع إلينا.</p>
          </div>
        )}
        {stage === 'blocked' && !tiktok && (
          <div style={{ textAlign: 'right' }}>
            <h2 style={{ color: '#fff', fontSize: 21, fontWeight: 800, lineHeight: 1.6, margin: '0 0 14px' }}>منشأتك لم تبلغ بعدُ حدَّ ما تفتح له جهاتُ التمويل ملفاً</h2>
            <p style={{ color: LIGHT, fontSize: 15, lineHeight: 1.9, margin: '0 0 16px' }}>ونقولها لك صراحةً بدل أن نأخذ وقتك: أغلب جهات التمويل في السعودية تشترط <b style={{ color: '#fff' }}>سنتين تشغيلاً</b> و<b style={{ color: '#fff' }}>إيراداً سنوياً يتجاوز المليون</b> قبل أن تبدأ الدراسة.</p>
            <div style={{ background: 'rgba(46,158,123,0.12)', borderRight: '4px solid #2E9E7B', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
              <div style={{ color: '#fff', fontWeight: 800, fontSize: 14.5, marginBottom: 6 }}>ما يرفع ملفك من اليوم</div>
              <div style={{ color: LIGHT, fontSize: 14, lineHeight: 1.9 }}>افصل حساب المنشأة عن حسابك الشخصي · أصدر فواتيرك نظامياً · جهّز قوائم مالية ولو داخلية لكل سنة · واحتفظ بكشف حسابٍ بنكي لنشاطك وحده.</div>
            </div>
            <p style={{ color: LIGHT, fontSize: 13, lineHeight: 1.9, margin: 0 }}>ومتى بلغت المنشأة سنتين وإيراداً فوق المليون — ارجع إلينا وملفك يكون قد صار جاهزاً للقراءة.</p>
          </div>
        )}

        {/* بوّابة النتيجة */}
        {stage === 'gate' && (
          <div>
            <h2 style={{ color: '#fff', fontSize: 22, fontWeight: 800, margin: '0 0 10px', textAlign: 'center' }}>نتيجتك جاهزة ✓</h2>
            <p style={{ color: LIGHT, fontSize: 14, lineHeight: 1.8, textAlign: 'center', margin: '0 0 22px' }}>{tiktok ? 'اكتب بياناتك لتظهر درجتك الآن، ويراجعها مستشار مُرضي ويتواصل معك بما يرتّب ملف منشأتك.' : 'اكتب بياناتك لتظهر درجتك الآن، ويراجعها مستشار مُرضي ويتواصل معك بالجهات التي تنطبق عليك شروطها.'}</p>
            <input value={company} onChange={e => setCompany(e.target.value)} placeholder="اسم المنشأة" style={{ width: '100%', boxSizing: 'border-box', padding: '15px 18px', fontSize: 16, borderRadius: 14, border: '2px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: '#fff', outline: 'none', textAlign: 'right', fontFamily: FONT, marginBottom: 12 }} />
            <input value={name} onChange={e => setName(e.target.value)} placeholder="اسمك" style={{ width: '100%', boxSizing: 'border-box', padding: '15px 18px', fontSize: 16, borderRadius: 14, border: '2px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: '#fff', outline: 'none', textAlign: 'right', fontFamily: FONT, marginBottom: 12 }} />
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="05xxxxxxxx" inputMode="tel" autoComplete="tel" style={{ width: '100%', boxSizing: 'border-box', padding: '15px 18px', fontSize: 16, borderRadius: 14, border: '2px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: '#fff', outline: 'none', textAlign: 'right', fontFamily: FONT, marginBottom: 12 }} />
            <button onClick={reveal} disabled={busy}
              style={{ width: '100%', marginTop: 4, background: GOLD, color: NAVY, border: 'none', borderRadius: 99, padding: '15px', fontSize: 17, fontWeight: 900, cursor: 'pointer', fontFamily: FONT, opacity: busy ? 0.6 : 1 }}>{busy ? 'لحظة…' : 'اعرض نتيجتي ←'}</button>
            {err && <div style={{ color: '#F3B0A8', fontSize: 14, marginTop: 12, textAlign: 'center' }}>{err}</div>}
            <p style={{ color: LIGHT, fontSize: 12, textAlign: 'center', margin: '14px 0 0' }}>{tiktok ? 'بياناتك لا تُشارك مع أي طرف إلا بتكليفٍ خطّي منك.' : 'بياناتك لا تُشارك مع أي جهة إلا بتكليفٍ خطّي منك.'}</p>
          </div>
        )}

        {/* الأسئلة التشخيصية */}
        {stage === 'q' && (
          <div>
            <div style={{ color: GOLD, fontSize: 13, fontWeight: 700, marginBottom: 10, textAlign: 'center' }}>سؤال {qIndex + 1} من {QUESTIONS.length}</div>
            <h2 style={{ color: '#fff', fontSize: 21, fontWeight: 800, margin: '0 0 24px', textAlign: 'center', lineHeight: 1.5 }}>{tt(QUESTIONS[qIndex].q, tiktok)}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {QUESTIONS[qIndex].opts.map((o, i) => (
                <button key={i} onClick={() => pick(o.v, i)}
                  style={{ background: 'rgba(255,255,255,0.06)', color: '#fff', border: '2px solid rgba(255,255,255,0.12)', borderRadius: 14, padding: '15px 18px', fontSize: 16, fontWeight: 600, cursor: 'pointer', textAlign: 'right', fontFamily: FONT, transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = GOLD; e.currentTarget.style.background = 'rgba(201,162,75,0.12)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}>
                  {tt(o.t, tiktok)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* شاشة التحليل */}
        {stage === 'analyzing' && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div style={{ width: 54, height: 54, border: '4px solid rgba(201,162,75,0.25)', borderTopColor: GOLD, borderRadius: '50%', margin: '0 auto 24px', animation: 'murdispin 0.8s linear infinite' }} />
            <p style={{ color: '#fff', fontSize: 18, fontWeight: 700 }}>جارٍ تحليل بيانات شركتك…</p>
            <style>{'@keyframes murdispin{to{transform:rotate(360deg)}}'}</style>
          </div>
        )}

        {/* النتيجة */}
        {stage === 'result' && ins && (
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: LIGHT, fontSize: 14, margin: '0 0 6px' }}>النتيجة الأولية لجاهزية</p>
            <p style={{ color: '#fff', fontSize: 16, fontWeight: 700, margin: '0 0 18px' }}>{company || name}</p>
            <div style={{ fontSize: 64, fontWeight: 900, color: v.color, lineHeight: 1 }}>{pct}<span style={{ fontSize: 24, color: LIGHT }}> / 100</span></div>
            <div style={{ display: 'inline-block', background: v.color, color: '#fff', borderRadius: 99, padding: '7px 22px', fontSize: 15, fontWeight: 800, margin: '16px 0 26px' }}>{v.label}</div>

            <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 26 }}>
              <div style={{ background: 'rgba(46,158,123,0.12)', border: '1px solid rgba(46,158,123,0.3)', borderRadius: 12, padding: '13px 16px', color: '#fff', fontSize: 15 }}>✔️ <b>نقطة قوة:</b> {ins.strength}</div>
              <div style={{ background: 'rgba(201,162,75,0.12)', border: '1px solid rgba(201,162,75,0.3)', borderRadius: 12, padding: '13px 16px', color: '#fff', fontSize: 15 }}>⚠️ <b>تحتاج تحسين:</b> {ins.weak}</div>
              <div style={{ background: 'rgba(157,179,171,0.12)', border: '1px solid rgba(157,179,171,0.3)', borderRadius: 12, padding: '13px 16px', color: '#fff', fontSize: 15 }}>🚀 <b>{tiktok ? 'مجال للتطوير:' : 'فرصة للاستغلال:'}</b> {ins.opportunity}</div>
            </div>

            {tiktok ? (
              <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: '18px', color: LIGHT, fontSize: 14, lineHeight: 1.8 }}>
                هذه لمحة أولية. يراجع مستشار مُرضي نتيجتك ويتواصل معك على رقمك خلال يوم عمل، ومعه قراءةٌ لملف منشأتك وما يرتّبه.
              </div>
            ) : (<>
            <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: '18px', color: LIGHT, fontSize: 14, lineHeight: 1.8 }}>
              هذه لمحة أولية. سيقوم مستشار مُرضي بمراجعة نتيجتك والتواصل معك — وإن أردت أن تسبق الدور، افتح ملف منشأتك الآن فيصلك التقرير الكامل والجهات التي تنطبق شروطها عليك.
            </div>

            {/* ★ كانت هذه الشاشة نهايةَ الطريق: لا زرّ ولا رابط ولا واتساب.
                وكلُّ نقرةٍ مدفوعةٍ من الإعلان تصل إلى هنا ثم تقف. فصار لها
                مخرجان: التسجيل لمن أراد المضيّ، والواتساب لمن أراد إنساناً. */}
            <a href="/auth/signup" style={{ display: 'block', textDecoration: 'none', background: GOLD, color: NAVY, borderRadius: 99, padding: '16px', fontSize: 17, fontWeight: 900, marginTop: 20, boxShadow: '0 8px 24px rgba(201,162,75,0.3)' }}>
              افتح ملف منشأتك الآن ←
            </a>
            <a href="https://wa.me/966570749196" target="_blank" rel="noopener noreferrer"
              style={{ display: 'block', textDecoration: 'none', border: '1.5px solid rgba(255,255,255,0.2)', color: '#fff', borderRadius: 99, padding: '13px', fontSize: 15, fontWeight: 800, marginTop: 12 }}>
              أو تحدّث مع مستشار واتساب
            </a>

            <p style={{ color: GOLD, fontSize: 13, fontWeight: 700, marginTop: 20 }}>مُرضي — جاهزية التمويل للمنشآت</p>
            </>)}
          </div>
        )}

        {tiktok && <p style={{ color: LIGHT, fontSize: 12, fontWeight: 700, textAlign: 'center', margin: '34px 0 0', lineHeight: 1.8 }}>{TIKTOK_FOOTER}</p>}
      </div>
    </div>
  )
}
