'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Q = { q: string; opts: { t: string; v: number }[] }

const QUESTIONS: Q[] = [
  { q: 'منشأتك تعمل منذ كم؟', opts: [
    { t: 'أقل من سنة', v: 4 }, { t: '1–3 سنوات', v: 8 },
    { t: '3–7 سنوات', v: 11 }, { t: 'أكثر من 7 سنوات', v: 13 } ] },
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
  const [phone, setPhone] = useState('')
  const [done, setDone] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const pick = (val: number) => {
    const next = [...ans, val]
    setAns(next)
    if (step + 1 < QUESTIONS.length) setStep(step + 1)
    else setStep(QUESTIONS.length)
  }

  const score = ans.reduce((s, val) => s + val, 0)
  const pct = Math.round((score / MAX) * 100)
  const v = verdict(pct)

  const [adSrc, setAdSrc] = useState('')
  useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search).get('src')
      if (p) { sessionStorage.setItem('murdi_src', p); setAdSrc(p) }
      else { const s = sessionStorage.getItem('murdi_src'); if (s) setAdSrc(s) }
    } catch { /* تجاهل */ }
  }, [])

  const submit = async () => {
    setErr('')
    if (name.trim().length < 2) { setErr('فضلاً اكتب اسمك'); return }
    if (phone.trim().length < 9) { setErr('فضلاً اكتب رقم جوال صحيح'); return }
    setSaving(true)
    try {
      const track = ['تمويل','استثمار','طرح','استكشاف'][[8,8,8,6].indexOf(ans[7])] || ''
      await sb.from('mini_assessments').insert({
        full_name: name.trim(), phone: phone.trim(),
        track, score: pct, answers: ans, src: adSrc || null,
      })
      setDone(true)
    } catch {
      setErr('حدث خطأ، حاول مرة أخرى')
    } finally { setSaving(false) }
  }

  return (
    <section className="lp-mini">
      <div className="lp-mini-inner">
        <div className="lp-mini-badge">تقييم مجاني · دقيقة واحدة</div>
        <h2>كم شركتك جاهزة لرأس المال؟</h2>
        <p className="lp-mini-sub">أجب عن أسئلة سريعة واعرف درجتك المبدئية فوراً — مجاناً.</p>

        {step < QUESTIONS.length && (
          <div className="lp-mini-card">
            <div className="lp-mini-progress">
              <div className="lp-mini-bar" style={{ width: `${(step / QUESTIONS.length) * 100}%` }} />
            </div>
            <div className="lp-mini-qnum">سؤال {step + 1} من {QUESTIONS.length}</div>
            <h3 className="lp-mini-q">{QUESTIONS[step].q}</h3>
            <div className="lp-mini-opts">
              {QUESTIONS[step].opts.map((o, i) => (
                <button key={i} className="lp-mini-opt" onClick={() => pick(o.v)}>{o.t}</button>
              ))}
            </div>
          </div>
        )}

        {step === QUESTIONS.length && !done && (
          <div className="lp-mini-card">
            <div className="lp-mini-score" style={{ color: v.color }}>{pct}<span>/100</span></div>
            <div className="lp-mini-verdict" style={{ background: v.color }}>{v.label}</div>
            <p className="lp-mini-text">{v.text}</p>
            <div className="lp-mini-gate">
              <p className="lp-mini-gate-t">احصل على نتيجتك التفصيلية وتوصية فريق مُرضي:</p>
              <input className="lp-mini-input" placeholder="الاسم" value={name} onChange={e => setName(e.target.value)} />
              <input className="lp-mini-input" placeholder="رقم الجوال" value={phone} onChange={e => setPhone(e.target.value)} />
              {err && <div className="lp-mini-err">{err}</div>}
              <button className="lp-mini-submit" onClick={submit} disabled={saving}>
                {saving ? 'جارٍ الإرسال…' : 'أرسل وأكمل طريقي'}
              </button>
            </div>
          </div>
        )}

        {done && (
          <div className="lp-mini-card lp-mini-thanks">
            <div className="lp-mini-check">✓</div>
            <h3>هذه بدايتك يا {name}</h3>
            <p className="lp-mini-thanks-sub">درجتك المبدئية {pct}/100 — وهي مجرد لمحة. عند تسجيلك يفتح لك مُرضي الصورة الكاملة:</p>

            <div className="lp-mini-benefits">
              <div className="lp-mini-benefit">
                <span className="lp-mini-b-icon">🧭</span>
                <div><b>منهجية قوية مجرّبة</b><p>تقييم دقيق ← كشف العوائق ← خارطة طريق ← مطابقة مع الجهات المناسبة ← مرافقة كاملة.</p></div>
              </div>
              <div className="lp-mini-benefit">
                <span className="lp-mini-b-icon">🚪</span>
                <div><b>ثلاثة مسارات مفتوحة</b><p>تمويل، استثمار، وطرح — كلها متاحة لك باشتراك واحد، تنطلق في أيٍّ منها متى شئت.</p></div>
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
