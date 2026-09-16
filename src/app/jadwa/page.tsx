'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { priceFor } from '@/lib/servicePricing';
import { fireConversion, LEAD_SUBMITTED } from '@/lib/adsConversion';

// مدخل دراسة الجدوى — الصفحة التي ينزل عليها إعلان «دراسة جدوى».
//
// كان الإعلان ينزل على صفحة الأسعار: صاحب فكرةٍ يُقابَل بقائمةٍ فيها ٩٩٠
// و٦٬٥٠٠ و١٢٬٠٠٠ و٢٢٬٠٠٠ ولا يعرف أيُّها رقمُه. سعرٌ قبل تشخيص، فينصرف.
// وهذه الصفحة تسأل سؤالين يقدر عليهما صاحب الفكرة — ولا تسأله عن قوائم
// مالية ولا حوكمة ولا نسبة ديون، فهو لا يملك منها شيئاً بعد — ثم تُظهر
// رقمه هو.
//
// والسؤال الأول ليس تمهيداً للسعر، بل حارسٌ عليه: من يطلب رأس مالٍ عامل
// أو سداد التزام لا مشروع فيه يُدرس، وبيعُه دراسةً يأخذ ماله ويؤخّره شهراً
// وكان أقرب للتمويل بدونها. فيُصرف إلى مساره ولا يُباع.
//
// الإجابتان تنزلان في نصّ الطلب كما هما، فيقرأ من يتصل به ما قاله قبل أن
// يرفع السماعة. والإحالة الناجحة تُطلق بعد نجاح الحفظ لا عند الضغط، ولا
// تُحتسب على ردّ `already` — وهو نجاحٌ بلا صفٍّ جديد، فعدُّه إحالةً يشتري
// النقرة المكرّرة عميلاً ثانياً.

const GREEN = '#1A3D34';
const GOLD = '#C9A84C';
const MUTED = '#6B8A80';
const LINE = '#EAF2EE';
const SERVICE = 'دراسة الجدوى الاقتصادية';   // المفتاح المخزَّن — المعروض «الاقتصادية والائتمانية»

type Kind = 'new' | 'expand' | 'working';

const KINDS: { key: Kind; label: string; hint: string }[] = [
  { key: 'new', label: 'مشروع جديد لم يبدأ', hint: 'فكرة أو مشروع تحت التأسيس' },
  { key: 'expand', label: 'توسعة لمنشأة قائمة', hint: 'فرع · خط إنتاج · معدات · موقع جديد' },
  { key: 'working', label: 'رأس مال عامل أو سداد التزام', hint: 'تشغيل · مشتريات · رواتب · جدولة' },
];

// الشرائح هي شرائح التسعير نفسها. والقيمة الممثِّلة تقع داخل شريحتها
// فتُرجع priceFor سعرها بلا أن يكتب الزائر رقماً دقيقاً لا يعرفه بعد.
// الأرقام بالخانات اللاتينية كما تُعرض الأسعار في المنصة كلها — ولا يصحّ أن
// يقرأ الزائر «٢ مليون» ثم يرى تحتها «6,500 ريال» بخطٍّ آخر.
const SIZES: { label: string; value: number }[] = [
  { label: 'أقل من 2 مليون ريال', value: 1_000_000 },
  { label: '2 إلى 10 مليون', value: 5_000_000 },
  { label: '10 إلى 50 مليون', value: 25_000_000 },
  { label: 'أكثر من 50 مليون', value: 100_000_000 },
];

// إخفاء المصيدة بالقصّ لا بـleft:-9999px: الثانية في صفحةٍ RTL تمدّ عرض
// الصفحة آلاف البكسلات فتُسحب جانباً إلى فراغ على الجوّال.
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

export default function JadwaEntryPage() {
  const [kind, setKind] = useState<Kind | null>(null);
  const [sizeIdx, setSizeIdx] = useState<number | null>(null);
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

  const size = sizeIdx === null ? null : SIZES[sizeIdx];
  const full = size ? priceFor(SERVICE, size.value) : null;
  const priced = kind !== null && kind !== 'working' && size !== null;

  const submit = async () => {
    if (sent.current) return;
    setErr(''); setBusy(true);
    const kindLabel = KINDS.find(k => k.key === kind)?.label || '';
    const note =
      'من مدخل دراسة الجدوى.\n'
      + 'نوع المشروع: ' + kindLabel + '\n'
      + 'حجم الاستثمار التقريبي: ' + (size?.label || '') + '\n'
      + 'الشريحة المعروضة له: ' + (full?.label || '');
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
            دراسة جدوى تُقرأ عند جهة التمويل
          </h1>
          <p style={{ color: MUTED, fontSize: 14, fontWeight: 700, lineHeight: 1.95, margin: 0 }}>
            سؤالان، ويظهر سعرك أنت — لا قائمة أسعار.
          </p>
        </div>

        {done ? (
          <div style={{ background: '#fff', border: '1.5px solid #BFE0D3', borderRadius: 18, padding: '34px 28px', textAlign: 'center' }}>
            <div style={{ color: '#1A5C46', fontWeight: 900, fontSize: 21, marginBottom: 10 }}>وصلنا طلبك</div>
            <p style={{ color: MUTED, fontSize: 14, fontWeight: 700, lineHeight: 2, margin: '0 0 20px' }}>
              نتواصل معك على <b style={{ color: GREEN }}>{phone}</b> اليوم أو صباح الغد على أبعد تقدير،
              ومعنا قراءةٌ أولية لمشروعك. وإن كان الأمر عاجلاً فاتصل على 0570749196.
            </p>
            <Link href="/services" style={{ display: 'inline-block', background: GREEN, color: '#fff', padding: '12px 30px', borderRadius: 999, fontWeight: 900, fontSize: 14, textDecoration: 'none' }}>
              اطّلع على بقية الخدمات
            </Link>
          </div>
        ) : (
          <div style={{ background: '#fff', border: '1.5px solid ' + LINE, borderRadius: 18, padding: '26px 24px' }}>

            {/* ١ — نوع المشروع */}
            <div style={{ marginBottom: 22 }}>
              <label style={{ display: 'block', color: GREEN, fontWeight: 900, fontSize: 15, marginBottom: 10 }}>
                ١ · مشروعك أيّ هذه؟
              </label>
              {KINDS.map((k) => (
                <button key={k.key} type="button" onClick={() => setKind(k.key)} style={choiceStyle(kind === k.key)}>
                  <div style={{ color: GREEN, fontWeight: 900, fontSize: 14.5 }}>{k.label}</div>
                  <div style={{ color: '#9DB3AB', fontWeight: 700, fontSize: 12.5, marginTop: 3 }}>{k.hint}</div>
                </button>
              ))}
            </div>

            {/* الصرف الصادق: من لا مشروع له لا يُباع دراسة */}
            {kind === 'working' && (
              <div style={{ background: '#FBF5E8', border: '1px solid #E8D9A8', borderRadius: 12, padding: '16px 18px', color: '#8A6D1F', fontSize: 13.5, fontWeight: 700, lineHeight: 1.95 }}>
                هنا نقول لك الحقيقة بدل أن نبيعك: <b>دراسة الجدوى ليست مسارك.</b> رأس المال العامل
                وسداد الالتزامات لا مشروع فيهما يُدرس — والدراسة هنا تأخذ من وقتك شهراً ومن مالك
                مبلغاً، وأنت أقرب إلى التمويل بدونها.
                <div style={{ marginTop: 14 }}>
                  <Link href="/test" style={{ display: 'inline-block', background: GREEN, color: '#fff', padding: '11px 24px', borderRadius: 999, fontWeight: 900, fontSize: 13.5, textDecoration: 'none' }}>
                    ابدأ بالتقييم المجاني — 60 ثانية
                  </Link>
                </div>
              </div>
            )}

            {/* ٢ — حجم الاستثمار */}
            {kind !== null && kind !== 'working' && (
              <div style={{ marginBottom: 22 }}>
                <label style={{ display: 'block', color: GREEN, fontWeight: 900, fontSize: 15, marginBottom: 4 }}>
                  ٢ · حجم الاستثمار التقريبي
                </label>
                <div style={{ color: '#9DB3AB', fontWeight: 700, fontSize: 12.5, marginBottom: 10 }}>
                  تقديرٌ يكفي — كامل ما سيُصرف على المشروع، لا المبلغ المطلوب تمويله وحده.
                </div>
                {SIZES.map((s, i) => (
                  <button key={s.label} type="button" onClick={() => setSizeIdx(i)} style={choiceStyle(sizeIdx === i)}>
                    <div style={{ color: GREEN, fontWeight: 900, fontSize: 14.5 }}>{s.label}</div>
                  </button>
                ))}
              </div>
            )}

            {/* السعر — يظهر فور الإجابتين */}
            {priced && (
              <div style={{ border: '1.5px solid #BFE0D3', background: '#F4FAF7', borderRadius: 14, padding: '18px 20px', marginBottom: 22 }}>
                <div style={{ color: GREEN, fontWeight: 900, fontSize: 15, marginBottom: 12 }}>سعرك أنت</div>

                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline', marginBottom: 6 }}>
                  <div style={{ color: GREEN, fontWeight: 900, fontSize: 14.5 }}>الفحص الائتماني للمشروع</div>
                  <div style={{ color: GOLD, fontWeight: 900, fontSize: 16, whiteSpace: 'nowrap' }}>990 ريال</div>
                </div>
                <div style={{ color: MUTED, fontWeight: 700, fontSize: 12.8, lineHeight: 1.9, marginBottom: 14 }}>
                  خلال ساعات: صفحة القرار والمؤشرات، قائمة الدخل والتدفق لخمس سنوات، تغطية خدمة الدين،
                  سيناريوهات الضغط، وحدود الأمان. اعرف هل مشروعك قابل للتمويل قبل أن تدفع ثمن دراسة كاملة —
                  <b style={{ color: GREEN }}> وقيمته تُخصم منها بالكامل خلال شهر.</b>
                </div>

                <div style={{ borderTop: '1px solid #DCEDE5', paddingTop: 13 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline', marginBottom: 6 }}>
                    <div style={{ color: GREEN, fontWeight: 900, fontSize: 14.5 }}>الدراسة الاقتصادية والائتمانية الكاملة</div>
                    <div style={{ color: GREEN, fontWeight: 900, fontSize: 16, whiteSpace: 'nowrap' }}>{full?.label}</div>
                  </div>
                  <div style={{ color: MUTED, fontWeight: 700, fontSize: 12.8, lineHeight: 1.9 }}>
                    ٣ إلى ٧ أيام عمل: كل ما في الفحص، ومعه دراسة السوق والمنافسة بمصادرها، والدراسة الفنية
                    والمخاطر، وجدول الجهات المرشّحة بفجواتها وطرق التقديم، وأسئلة لجنة الائتمان بإجاباتها.
                  </div>
                </div>

                {/* من تجاوز خمسين مليوناً لا رقم معلن له — والصدق أولى من رقمٍ مخترع */}
                {full?.amount === null && (
                  <div style={{ color: '#8A6D1F', fontWeight: 700, fontSize: 12.5, lineHeight: 1.9, marginTop: 12 }}>
                    مشروعٌ بهذا الحجم يُسعَّر بعد جلسة تحديد نطاق مجانية — لأن الفرق بين مشروعٍ بستين
                    مليوناً وآخر بثلاثمئة ليس فرق صفحات.
                  </div>
                )}
              </div>
            )}

            {/* ٣ — الاسم والجوال */}
            {priced && (
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
                    اسم المنشأة أو المشروع <span style={{ color: '#9DB3AB', fontWeight: 700 }}>(اختياري)</span>
                  </label>
                  <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="إن وُجد" style={inputCls} />
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
                  type="button" onClick={submit}
                  disabled={busy || name.trim().length < 2 || phone.trim().length < 9}
                  style={{
                    width: '100%', background: GREEN, color: '#fff', border: 'none', borderRadius: 999,
                    padding: '15px', fontSize: 16, fontWeight: 900, cursor: 'pointer',
                    fontFamily: 'Tajawal, Cairo, sans-serif',
                    opacity: (busy || name.trim().length < 2 || phone.trim().length < 9) ? 0.5 : 1,
                  }}>
                  {busy ? 'لحظة…' : 'اطلب الفحص الائتماني للمشروع'}
                </button>

                <p style={{ color: '#9DB3AB', fontSize: 11.8, fontWeight: 700, lineHeight: 1.9, textAlign: 'center', margin: '14px 0 0' }}>
                  لا نطلب منك ريالاً قبل أن نتكلّم معك ونتأكد أن الخدمة تخصّك — وإن لم تكن تخصّك
                  قلنا لك ذلك ولم نبعك إياها.
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
