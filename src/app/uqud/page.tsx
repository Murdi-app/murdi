'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { priceFor } from '@/lib/servicePricing';
import { fireConversion, LEAD_SUBMITTED } from '@/lib/adsConversion';

// مدخل تمويل العقود — الصفحة التي ينزل عليها إعلان «تمويل عقد».
//
// صاحب العقد أعرف الناس بحاجته: ورقةٌ بيده وموعدٌ أمامه وغرامة تأخير خلفه.
// فلا يُسأل عن جاهزيته ولا عن قوائمه، بل عن عقده: هل وُقّع، وبكم، ومن
// الجهة، ومتى يُصرف المستخلص. أربعة أسئلة يعرف إجاباتها بلا أن يفتح ملفاً،
// وهي نفسها أول ما يسأل عنه محلل الائتمان.
//
// ولا يُحسب له رقمٌ هنا. حساب الفجوة النقدية شهراً بشهر هو الخدمة نفسها،
// وادّعاؤه في صفحةٍ بأربع إجابات كذبٌ يُكتشف في أول مكالمة. فالذي يُقال
// له هنا صحيحٌ ومفيد: أين تقع فجوتك ولماذا، لا كم هي.
//
// ومن لا عقد له يُصرف إلى مساره ولا يُباع — الخدمة مبنيّة على عقدٍ بعينه.

const GREEN = '#1A3D34';
const GOLD = '#C9A84C';
const MUTED = '#6B8A80';
const LINE = '#EAF2EE';
const SERVICE = 'تمويل العقد';

type Stage = 'signed' | 'awarded' | 'bidding' | 'none';

const STAGES: { key: Stage; label: string; hint: string }[] = [
  { key: 'signed', label: 'عقد موقّع بيدي', hint: 'ومطلوب مني التنفيذ' },
  { key: 'awarded', label: 'رست عليّ الترسية ولم أوقّع بعد', hint: 'وأمامي مهلة للضمان' },
  { key: 'bidding', label: 'أستعدّ للتقديم على منافسة', hint: 'ولم تُرسَ بعد' },
  { key: 'none', label: 'لا عقد لديّ', hint: 'أبحث عن تمويل لمنشأتي عموماً' },
];

// الخانات اللاتينية كما تُعرض الأسعار في المنصة كلها
const VALUES: { label: string; value: number }[] = [
  { label: 'أقل من مليون ريال', value: 500_000 },
  { label: 'مليون إلى 10 مليون', value: 5_000_000 },
  { label: '10 إلى 50 مليون', value: 25_000_000 },
  { label: 'أكثر من 50 مليون', value: 100_000_000 },
];

type Party = 'gov' | 'semi' | 'big' | 'private';
const PARTIES: { key: Party; label: string }[] = [
  { key: 'gov', label: 'جهة حكومية' },
  { key: 'semi', label: 'شبه حكومية أو شركة مملوكة للدولة' },
  { key: 'big', label: 'شركة كبرى' },
  { key: 'private', label: 'شركة خاصة أو مقاول رئيسي' },
];

type Term = 'd30' | 'd60' | 'd90' | 'unknown';
const TERMS: { key: Term; label: string }[] = [
  { key: 'd30', label: 'خلال 30 يوماً' },
  { key: 'd60', label: 'خلال 60 يوماً' },
  { key: 'd90', label: '90 يوماً فأكثر' },
  { key: 'unknown', label: 'لا أعرف — لم أقرأ البند' },
];

// قراءةٌ أولية صادقة: تصف موضع الفجوة وسببها، ولا تدّعي رقماً.
function reading(party: Party, term: Term): string[] {
  const out: string[] = [];
  if (term === 'd90') {
    out.push('صرفٌ بعد تسعين يوماً فأكثر يعني أنك تموّل التنفيذ من جيبك ثلاثة أشهر على الأقل — وأعمق نقطة في حسابك تقع قبل أول تحصيل لا بعده.');
  } else if (term === 'd60') {
    out.push('صرفٌ خلال ستين يوماً يحتمل شهرين من التشغيل على حسابك، والمحتجز يبقى بعدهما.');
  } else if (term === 'd30') {
    out.push('مدة الصرف في صالحك — والضغط عندك غالباً في الضمانات ودفعة البداية لا في دورة التحصيل.');
  } else {
    out.push('بند مدة الصرف هو أخطر بندٍ لا يُقرأ وقت التوقيع: هو الذي يحدّد كم شهراً ستموّل التنفيذ من جيبك. نقرؤه لك أولاً.');
  }
  if (party === 'gov' || party === 'semi') {
    out.push('والجهة المتعاقدة معك من أقوى ما يُقدَّم لجهة التمويل: سؤال الممول الأول ليس «كم تطلب» بل «من يدفعك» — وجوابك عنه جاهز.');
  } else {
    out.push('وجهة التعاقد هنا تُقرأ بملاءتها وسجل سدادها، وهي أول ما تسأل عنه لجنة الائتمان — فتُعدّ الورقة قبل أن تُطلب.');
  }
  out.push('ويبقى المحتجز: نسبةٌ تبقى محبوسة بعد التسليم، وكثيرون يحسبون العقد رابحاً ثم يكتشفون أن ربحهم كلّه في المحتجز.');
  return out;
}

// إخفاء المصيدة بالقصّ لا بـleft:-9999px — انظر التعليق نفسه في /jadwa
const HONEYPOT: React.CSSProperties = {
  position: 'absolute', width: 1, height: 1, padding: 0, margin: -1,
  overflow: 'hidden', clipPath: 'inset(50%)', whiteSpace: 'nowrap',
  border: 0, opacity: 0,
};

const inputCls: React.CSSProperties = {
  width: '100%', padding: '12px 15px', borderRadius: 12, border: '1.5px solid #D9E5DF',
  fontFamily: 'Tajawal, Cairo, sans-serif', fontSize: 14.5, fontWeight: 700, color: GREEN,
  background: '#fff', boxSizing: 'border-box',
};

function choiceStyle(active: boolean): React.CSSProperties {
  return {
    width: '100%', textAlign: 'right', cursor: 'pointer',
    background: active ? '#F2F8F5' : '#fff',
    border: '1.5px solid ' + (active ? GREEN : '#D9E5DF'),
    borderRadius: 13, padding: '13px 16px', marginBottom: 10,
    fontFamily: 'Tajawal, Cairo, sans-serif',
  };
}

function Section({ n, title, hint, children }: { n: string; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <label style={{ display: 'block', color: GREEN, fontWeight: 900, fontSize: 15, marginBottom: hint ? 4 : 10 }}>
        {n} · {title}
      </label>
      {hint && <div style={{ color: '#9DB3AB', fontWeight: 700, fontSize: 12.5, marginBottom: 10 }}>{hint}</div>}
      {children}
    </div>
  );
}

export default function UqudEntryPage() {
  const [stage, setStage] = useState<Stage | null>(null);
  const [valIdx, setValIdx] = useState<number | null>(null);
  const [party, setParty] = useState<Party | null>(null);
  const [term, setTerm] = useState<Term | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [website, setWebsite] = useState('');   // المصيدة
  const [src, setSrc] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');
  const sent = useRef(false);

  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search);
      const fromAds = q.get('gclid') || q.get('gbraid') || q.get('wbraid');
      const p = q.get('src') || (fromAds ? 'google-ads' : '') || q.get('utm_source') || '';
      if (p) { setSrc(p); try { sessionStorage.setItem('murdi_src', p); } catch {} }
      else { try { const v = sessionStorage.getItem('murdi_src'); if (v) setSrc(v); } catch {} }
    } catch { /* لا شيء */ }
  }, []);

  const hasContract = stage !== null && stage !== 'none';
  const val = valIdx === null ? null : VALUES[valIdx];
  const ready = hasContract && val !== null && party !== null && term !== null;
  const price = val ? priceFor(SERVICE, val.value) : null;

  const submit = async () => {
    setErr(''); setBusy(true);
    const note =
      'من مدخل تمويل العقود.\n'
      + 'وضع العقد: ' + (STAGES.find(s => s.key === stage)?.label || '') + '\n'
      + 'قيمة العقد: ' + (val?.label || '') + '\n'
      + 'جهة التعاقد: ' + (PARTIES.find(p => p.key === party)?.label || '') + '\n'
      + 'مدة صرف المستخلص: ' + (TERMS.find(t => t.key === term)?.label || '');
    try {
      const r = await fetch('/api/services/inquiry', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_title: SERVICE, full_name: name, phone,
          company_name: company, note, website, src: src || undefined,
        }),
      });
      const d = await r.json();
      if (!r.ok || d?.error) { setErr(d?.error || 'تعذّر الإرسال'); setBusy(false); return; }
      if (!sent.current && !d?.already) { sent.current = true; fireConversion(LEAD_SUBMITTED); }
      setDone(true);
    } catch {
      setErr('تعذّر الاتصال — تحقق من الشبكة وأعد المحاولة');
    }
    setBusy(false);
  };

  const canSend = ready && name.trim().length >= 2 && phone.trim().length >= 9 && !busy;

  return (
    <div dir="rtl" style={{ background: '#FBFCFB', minHeight: '100vh', fontFamily: 'Tajawal, Cairo, sans-serif' }}>
      <nav style={{ background: '#fff', borderBottom: '1px solid ' + LINE, padding: '16px 20px' }}>
        <div style={{ maxWidth: 680, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/" style={{ color: GREEN, fontWeight: 900, fontSize: 22, textDecoration: 'none' }}>
            مُرضي <span style={{ fontSize: 11, color: '#9DB3AB', letterSpacing: '.14em', fontWeight: 500 }}>MURDI</span>
          </Link>
          <a href="tel:0570749196" style={{ color: MUTED, fontWeight: 800, fontSize: 13.5, textDecoration: 'none' }}>0570749196</a>
        </div>
      </nav>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '38px 20px 70px' }}>

        <div style={{ textAlign: 'center', marginBottom: 26 }}>
          <div style={{ color: GOLD, fontWeight: 900, fontSize: 12, letterSpacing: '.12em', marginBottom: 8 }}>
            حلول المرضي للاستشارات المالية · ترخيص FL-457927015
          </div>
          <h1 style={{ color: GREEN, fontSize: 27, fontWeight: 900, margin: '0 0 8px', fontFamily: 'Amiri, serif' }}>
            عندك عقد؟ الفوز شيء والتنفيذ شيء آخر
          </h1>
          <p style={{ color: MUTED, fontSize: 14, fontWeight: 700, lineHeight: 1.95, margin: 0 }}>
            أربعة أسئلة عن عقدك — لا عن منشأتك — وتخرج بقراءة أولية.
          </p>
        </div>

        {done ? (
          <div style={{ background: '#fff', border: '1.5px solid #BFE0D3', borderRadius: 18, padding: '34px 28px', textAlign: 'center' }}>
            <div style={{ color: '#1A5C46', fontWeight: 900, fontSize: 21, marginBottom: 10 }}>وصلنا طلبك</div>
            <p style={{ color: MUTED, fontSize: 14, fontWeight: 700, lineHeight: 2, margin: '0 0 20px' }}>
              نتواصل معك على <b style={{ color: GREEN }}>{phone}</b> اليوم أو صباح الغد على أبعد تقدير.
              وإن كان أمامك موعد ضمانٍ قريب فاتصل الآن على 0570749196 ولا تنتظرنا.
            </p>
            <Link href="/services" style={{ display: 'inline-block', background: GREEN, color: '#fff', padding: '12px 30px', borderRadius: 999, fontWeight: 900, fontSize: 14, textDecoration: 'none' }}>
              اطّلع على بقية الخدمات
            </Link>
          </div>
        ) : (
          <div style={{ background: '#fff', border: '1.5px solid ' + LINE, borderRadius: 18, padding: '26px 24px' }}>

            <Section n="١" title="وضع عقدك الآن">
              {STAGES.map((s) => (
                <button key={s.key} type="button" onClick={() => setStage(s.key)} style={choiceStyle(stage === s.key)}>
                  <div style={{ color: GREEN, fontWeight: 900, fontSize: 14.5 }}>{s.label}</div>
                  <div style={{ color: '#9DB3AB', fontWeight: 700, fontSize: 12.5, marginTop: 3 }}>{s.hint}</div>
                </button>
              ))}
            </Section>

            {stage === 'none' && (
              <div style={{ background: '#FBF5E8', border: '1px solid #E8D9A8', borderRadius: 12, padding: '16px 18px', color: '#8A6D1F', fontSize: 13.5, fontWeight: 700, lineHeight: 1.95 }}>
                <b>هذه الخدمة مبنيّة على عقدٍ بعينه، لا على حال المنشأة.</b> فمن يريد تمويلاً لمنشأته
                لا لعقدٍ منها، مسارُه غير هذا — ونقولها لك بدل أن نبيعك ما لا ينفعك.
                <div style={{ marginTop: 14 }}>
                  <Link href="/test" style={{ display: 'inline-block', background: GREEN, color: '#fff', padding: '11px 24px', borderRadius: 999, fontWeight: 900, fontSize: 13.5, textDecoration: 'none' }}>
                    ابدأ بالتقييم المجاني — 60 ثانية
                  </Link>
                </div>
              </div>
            )}

            {hasContract && (
              <>
                <Section n="٢" title="قيمة العقد التقريبية">
                  {VALUES.map((v, i) => (
                    <button key={v.label} type="button" onClick={() => setValIdx(i)} style={choiceStyle(valIdx === i)}>
                      <div style={{ color: GREEN, fontWeight: 900, fontSize: 14.5 }}>{v.label}</div>
                    </button>
                  ))}
                </Section>

                <Section n="٣" title="من الجهة المتعاقدة معك؟">
                  {PARTIES.map((p) => (
                    <button key={p.key} type="button" onClick={() => setParty(p.key)} style={choiceStyle(party === p.key)}>
                      <div style={{ color: GREEN, fontWeight: 900, fontSize: 14.5 }}>{p.label}</div>
                    </button>
                  ))}
                </Section>

                <Section n="٤" title="متى يُصرف مستخلصك؟" hint="بحسب بند الدفع في عقدك — وإن لم تقرأه فقل ذلك، وهو في نفسه جواب.">
                  {TERMS.map((t) => (
                    <button key={t.key} type="button" onClick={() => setTerm(t.key)} style={choiceStyle(term === t.key)}>
                      <div style={{ color: GREEN, fontWeight: 900, fontSize: 14.5 }}>{t.label}</div>
                    </button>
                  ))}
                </Section>
              </>
            )}

            {ready && party && term && (
              <div style={{ border: '1.5px solid #BFE0D3', background: '#F4FAF7', borderRadius: 14, padding: '18px 20px', marginBottom: 22 }}>
                <div style={{ color: GREEN, fontWeight: 900, fontSize: 15, marginBottom: 10 }}>قراءة أولية لعقدك</div>
                {reading(party, term).map((line, i) => (
                  <div key={i} style={{ color: MUTED, fontWeight: 700, fontSize: 13.2, lineHeight: 2, marginBottom: 8 }}>
                    <span style={{ color: GOLD, fontWeight: 900 }}>— </span>{line}
                  </div>
                ))}
                <div style={{ borderTop: '1px solid #DCEDE5', marginTop: 12, paddingTop: 13 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline', marginBottom: 6 }}>
                    <div style={{ color: GREEN, fontWeight: 900, fontSize: 14.5 }}>خدمة تمويل العقد</div>
                    <div style={{ color: GREEN, fontWeight: 900, fontSize: 16, whiteSpace: 'nowrap' }}>{price?.label}</div>
                  </div>
                  <div style={{ color: MUTED, fontWeight: 700, fontSize: 12.8, lineHeight: 1.9 }}>
                    ٥ أيام عمل للملف، والمخاطبة مستمرة حتى الرد: خريطة عقدك النقدية شهراً بشهر وأعمق
                    نقطة فيها، وحزمة الضمانات بمبالغها ومواعيدها، وهيكل التمويل مركَّباً من أكثر من جهة،
                    وقراءة بنودك مع ما يُطلب تعديله. <b style={{ color: GREEN }}>رسمٌ ثابت واحد — ولا نأخذ
                    نسبةً من تمويلك.</b>
                  </div>
                </div>
              </div>
            )}

            {ready && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 14, marginBottom: 14 }}>
                  <div>
                    <label style={{ display: 'block', color: GREEN, fontWeight: 900, fontSize: 14, marginBottom: 7 }}>الاسم</label>
                    <input value={name} onChange={(e) => setName(e.target.value)} placeholder="الاسم الثلاثي" style={inputCls} />
                  </div>
                  <div>
                    <label style={{ display: 'block', color: GREEN, fontWeight: 900, fontSize: 14, marginBottom: 7 }}>الجوال</label>
                    <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="05xxxxxxxx" style={inputCls} />
                  </div>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', color: GREEN, fontWeight: 900, fontSize: 14, marginBottom: 7 }}>
                    اسم المنشأة <span style={{ color: '#9DB3AB', fontWeight: 700 }}>(اختياري)</span>
                  </label>
                  <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="كما في السجل التجاري" style={inputCls} />
                </div>

                <input
                  value={website} onChange={(e) => setWebsite(e.target.value)}
                  tabIndex={-1} autoComplete="off" aria-hidden="true" style={HONEYPOT}
                />

                {err && (
                  <div style={{ background: '#FDECEA', border: '1px solid #F3C4BE', borderRadius: 10, padding: '10px 13px', marginBottom: 12, color: '#A8342A', fontSize: 13, fontWeight: 800 }}>
                    {err}
                  </div>
                )}

                <button
                  type="button" onClick={submit} disabled={!canSend}
                  style={{
                    width: '100%', background: GREEN, color: '#fff', border: 'none', borderRadius: 999,
                    padding: '15px', fontSize: 16, fontWeight: 900, cursor: 'pointer',
                    fontFamily: 'Tajawal, Cairo, sans-serif', opacity: canSend ? 1 : 0.5,
                  }}>
                  {busy ? 'لحظة…' : 'اطلب قراءة عقدك'}
                </button>

                <p style={{ color: '#9DB3AB', fontSize: 11.8, fontWeight: 700, lineHeight: 1.9, textAlign: 'center', margin: '14px 0 0' }}>
                  وإن كان عقدك خاسراً في أصله — تكلفته أعلى من قيمته — قلنا لك ذلك ولم نطرق لك باباً
                  واحداً. فجلب تمويلٍ لعقدٍ خاسر يضيف كلفةً إلى خسارة.
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
