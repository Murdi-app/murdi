'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const NAVY = '#13302A'
const GOLD = '#C9A24B'
const LIGHT = '#9DB3AB'

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
const TRACK = ['تمويل', 'استثمار', 'طرح', 'استكشاف']

function verdict(pct: number) {
  if (pct >= 75) return { label: 'جاهزية عالية', color: '#2E9E7B' }
  if (pct >= 50) return { label: 'جاهزية متوسطة', color: GOLD }
  return { label: 'تحتاج تجهيزاً', color: '#C0564B' }
}

// النقاط الثلاث تُبنى من أضعف وأقوى إجابة فعلياً
function insights(ans: number[]) {
  const labels = ['عمر النشاط', 'القوائم المالية', 'نمو الإيرادات', 'انتظام الأرباح', 'الفصل المالي', 'الحوكمة', 'مستوى الديون', 'الهدف']
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

export default function TestPage() {
  const [stage, setStage] = useState<'welcome' | 'name' | 'phone' | 'q' | 'analyzing' | 'result'>('welcome')
  const [qIndex, setQIndex] = useState(0)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [ans, setAns] = useState<number[]>([])
  const [rowId, setRowId] = useState<string | null>(null)
  const [adSrc, setAdSrc] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search).get('src')
      if (p) { sessionStorage.setItem('murdi_src', p); setAdSrc(p) }
      else { const stored = sessionStorage.getItem('murdi_src'); if (stored) setAdSrc(stored) }
    } catch { /* تجاهل */ }
  }, [])

  const score = ans.reduce((s, v) => s + v, 0)
  const pct = ans.length === QUESTIONS.length ? Math.round((score / MAX) * 100) : 0

  // شريط التقدم: اسم + جوال + 8 أسئلة = 10 خطوات
  const totalSteps = 2 + QUESTIONS.length
  let stepDone = 0
  if (stage === 'phone') stepDone = 1
  else if (stage === 'q') stepDone = 2 + qIndex
  else if (stage === 'analyzing' || stage === 'result') stepDone = totalSteps
  const progress = Math.round((stepDone / totalSteps) * 100)

  // حفظ فوري بعد الجوال — يرجع id
  const saveInitial = async () => {
    setErr('')
    if (phone.trim().length < 9) { setErr('فضلاً اكتب رقم جوال صحيح'); return }
    setBusy(true)
    try {
      const { data, error } = await sb.from('mini_assessments').insert({
        full_name: name.trim(), phone: phone.trim(),
        answers: [], score: 0, src: adSrc || null, completed: false,
      }).select('id').single()
      if (error) throw error
      setRowId(data.id)
      setStage('q')
    } catch {
      // حتى لو فشل الحفظ، نكمل التجربة حتى لا نخسر العميل
      setStage('q')
    } finally { setBusy(false) }
  }

  // تحديث الصف مع كل إجابة
  const pick = async (v: number) => {
    const nextAns = [...ans, v]
    setAns(nextAns)
    if (rowId) {
      const done = nextAns.length === QUESTIONS.length
      const t = done ? (TRACK[[8, 8, 8, 6].indexOf(nextAns[7])] || '') : ''
      const p = done ? Math.round((nextAns.reduce((s, x) => s + x, 0) / MAX) * 100) : 0
      sb.from('mini_assessments').update({ answers: nextAns, score: p, track: t, completed: done }).eq('id', rowId).then(() => {})
    }
    if (nextAns.length < QUESTIONS.length) {
      setQIndex(qIndex + 1)
    } else {
      setStage('analyzing')
      setTimeout(() => setStage('result'), 2200)
    }
  }

  const v = verdict(pct)
  const ins = ans.length === QUESTIONS.length ? insights(ans) : null

  return (
    <div style={{ minHeight: '100vh', background: NAVY, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 18px', fontFamily: 'system-ui, -apple-system, Arial', direction: 'rtl' }}>
      <div style={{ width: '100%', maxWidth: 460 }}>

        {/* الشعار */}
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <span style={{ color: GOLD, fontSize: 22, fontWeight: 900, letterSpacing: 1 }}>مُرضي</span>
        </div>

        {/* شريط التقدم */}
        {stage !== 'welcome' && (
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
            <h1 style={{ color: '#fff', fontSize: 27, fontWeight: 900, lineHeight: 1.5, margin: '0 0 14px' }}>اختبار جاهزية رأس المال</h1>
            <p style={{ color: LIGHT, fontSize: 16, lineHeight: 1.8, margin: '0 0 8px' }}>هل شركتك جاهزة للحصول على تمويل أو استثمار؟</p>
            <p style={{ color: GOLD, fontSize: 14, fontWeight: 700, margin: '0 0 30px' }}>اختبار مجاني — 60 ثانية، بلا تسجيل</p>
            <button onClick={() => setStage('name')} style={{ background: GOLD, color: NAVY, border: 'none', borderRadius: 99, padding: '16px 46px', fontSize: 18, fontWeight: 900, cursor: 'pointer', boxShadow: '0 8px 24px rgba(201,162,75,0.3)' }}>ابدأ الآن ←</button>
          </div>
        )}

        {/* السؤال: اسم الشركة */}
        {stage === 'name' && (
          <div>
            <h2 style={{ color: '#fff', fontSize: 22, fontWeight: 800, margin: '0 0 22px', textAlign: 'center' }}>ما اسم شركتك؟</h2>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="اسم المنشأة"
              style={{ width: '100%', boxSizing: 'border-box', padding: '15px 18px', fontSize: 16, borderRadius: 14, border: '2px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: '#fff', outline: 'none', textAlign: 'right' }} />
            <button onClick={() => { if (name.trim().length < 2) { setErr('فضلاً اكتب اسم شركتك'); return } setErr(''); setStage('phone') }}
              style={{ width: '100%', marginTop: 16, background: GOLD, color: NAVY, border: 'none', borderRadius: 99, padding: '15px', fontSize: 17, fontWeight: 900, cursor: 'pointer' }}>التالي ←</button>
            {err && <div style={{ color: '#F3B0A8', fontSize: 14, marginTop: 12, textAlign: 'center' }}>{err}</div>}
          </div>
        )}

        {/* السؤال: الجوال */}
        {stage === 'phone' && (
          <div>
            <h2 style={{ color: '#fff', fontSize: 22, fontWeight: 800, margin: '0 0 10px', textAlign: 'center' }}>رقم جوالك</h2>
            <p style={{ color: LIGHT, fontSize: 13, textAlign: 'center', margin: '0 0 22px' }}>ليصلك تحليل جاهزيتك ويتواصل معك مستشار مُرضي</p>
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="05xxxxxxxx" inputMode="tel"
              style={{ width: '100%', boxSizing: 'border-box', padding: '15px 18px', fontSize: 16, borderRadius: 14, border: '2px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: '#fff', outline: 'none', textAlign: 'right' }} />
            <button onClick={saveInitial} disabled={busy}
              style={{ width: '100%', marginTop: 16, background: GOLD, color: NAVY, border: 'none', borderRadius: 99, padding: '15px', fontSize: 17, fontWeight: 900, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>{busy ? 'لحظة…' : 'ابدأ الاختبار ←'}</button>
            {err && <div style={{ color: '#F3B0A8', fontSize: 14, marginTop: 12, textAlign: 'center' }}>{err}</div>}
          </div>
        )}

        {/* الأسئلة التشخيصية */}
        {stage === 'q' && (
          <div>
            <div style={{ color: GOLD, fontSize: 13, fontWeight: 700, marginBottom: 10, textAlign: 'center' }}>سؤال {qIndex + 1} من {QUESTIONS.length}</div>
            <h2 style={{ color: '#fff', fontSize: 21, fontWeight: 800, margin: '0 0 24px', textAlign: 'center', lineHeight: 1.5 }}>{QUESTIONS[qIndex].q}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {QUESTIONS[qIndex].opts.map((o, i) => (
                <button key={i} onClick={() => pick(o.v)}
                  style={{ background: 'rgba(255,255,255,0.06)', color: '#fff', border: '2px solid rgba(255,255,255,0.12)', borderRadius: 14, padding: '15px 18px', fontSize: 16, fontWeight: 600, cursor: 'pointer', textAlign: 'right', transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = GOLD; e.currentTarget.style.background = 'rgba(201,162,75,0.12)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}>
                  {o.t}
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
            <p style={{ color: '#fff', fontSize: 16, fontWeight: 700, margin: '0 0 18px' }}>{name}</p>
            <div style={{ fontSize: 64, fontWeight: 900, color: v.color, lineHeight: 1 }}>{pct}<span style={{ fontSize: 24, color: LIGHT }}> / 100</span></div>
            <div style={{ display: 'inline-block', background: v.color, color: '#fff', borderRadius: 99, padding: '7px 22px', fontSize: 15, fontWeight: 800, margin: '16px 0 26px' }}>{v.label}</div>

            <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 26 }}>
              <div style={{ background: 'rgba(46,158,123,0.12)', border: '1px solid rgba(46,158,123,0.3)', borderRadius: 12, padding: '13px 16px', color: '#fff', fontSize: 15 }}>✔️ <b>نقطة قوة:</b> {ins.strength}</div>
              <div style={{ background: 'rgba(201,162,75,0.12)', border: '1px solid rgba(201,162,75,0.3)', borderRadius: 12, padding: '13px 16px', color: '#fff', fontSize: 15 }}>⚠️ <b>تحتاج تحسين:</b> {ins.weak}</div>
              <div style={{ background: 'rgba(157,179,171,0.12)', border: '1px solid rgba(157,179,171,0.3)', borderRadius: 12, padding: '13px 16px', color: '#fff', fontSize: 15 }}>🚀 <b>فرصة للاستغلال:</b> {ins.opportunity}</div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: '18px', color: LIGHT, fontSize: 14, lineHeight: 1.8 }}>
              هذه لمحة أولية. سيقوم مستشار مُرضي بمراجعة نتيجتك وإرسال التوصيات المناسبة لرفع جاهزية شركتك نحو رأس المال.
            </div>
            <p style={{ color: GOLD, fontSize: 13, fontWeight: 700, marginTop: 20 }}>مُرضي — منصة جاهزية رأس المال</p>
          </div>
        )}

      </div>
    </div>
  )
}
