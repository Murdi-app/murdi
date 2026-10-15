'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { fireConversion, LEAD_SUBMITTED } from '@/lib/adsConversion';
import { studyWeight } from '@/lib/leadWeight';
import { captureFirstTouch, currentSource } from '@/lib/attribution';
import { tiktokEvent } from '@/lib/tiktokPixel';

// مدخل دراسة الجدوى — الصفحة التي ينزل عليها إعلان «دراسة جدوى».
//
// ★ ١١ أكتوبر (المالك): لا سعر ولا ٩٩٠ في هذه الصفحة. «أبي العميل يدخل وهو يشوف
//   الملايين، ويدفع لو أقول له ٣٠ ألف». فالصفحة تسأل أربعة أسئلة، وتُريه الأبواب
//   التي تموّل مشروعاً مثل مشروعه، وتأخذ اسمه وجواله — والسعر في العرض بعد المكالمة.
//   وسؤال «كم تساهم من جيبك» يكشف الجادّ: الممول يطلب مساهمةً من صاحب المشروع.
//   والملخّص يُكتب سطراً أول في الطلب يبدأ بـ«⭐» فيظهر لضي في صفّها قبل أن تتصل.
//
// (ما تحته تاريخ الصفحة قبل ١١ أكتوبر:)
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
type Need = 'funder' | 'investor' | 'both';
type Sector = 'industry' | 'agri' | 'tourism' | 'tech' | 'health' | 'trade';

const KINDS: { key: Kind; label: string; hint: string }[] = [
  { key: 'new', label: 'فكرة أو مشروع جديد', hint: 'مشروع لم يبدأ بعد أو تحت التأسيس — ما عنده إيرادات حتى الآن' },
  { key: 'expand', label: 'توسعة لمنشأة قائمة', hint: 'منشأة تعمل وتبي تكبر: فرع جديد · خط إنتاج · معدات · موقع إضافي' },
  // ★ ١٣ أكتوبر (المالك): «ما أبي العميل يقيّم — حتى لو منشأته قائمة يدخل يطلب الدراسة». فلا يُحوَّل
  //   صاحب المنشأة القائمة إلى تقييم الجاهزية بعد اليوم؛ يكمل الأسئلة ويُرسل طلبه كغيره.
  { key: 'working', label: 'منشأة قائمة تحتاج سيولة أو تمويل', hint: 'تشغيل · مشتريات · رواتب · جدولة التزامات' },
];

const SIZES: { label: string; short: string; value: number }[] = [
  { label: 'أقل من 2 مليون ريال', short: 'أقل من 2 مليون', value: 1_000_000 },
  { label: '2 إلى 10 مليون', short: '2–10 مليون', value: 5_000_000 },
  { label: '10 إلى 50 مليون', short: '10–50 مليون', value: 25_000_000 },
  { label: 'أكثر من 50 مليون', short: 'أكثر من 50 مليون', value: 100_000_000 },
];

const SECTORS: { key: Sector; label: string }[] = [
  { key: 'industry', label: 'صناعي أو مصنع' },
  { key: 'agri', label: 'زراعي أو غذائي' },
  { key: 'tourism', label: 'سياحة وضيافة وترفيه' },
  { key: 'tech', label: 'تقنية أو منصة رقمية' },
  { key: 'health', label: 'صحي أو تعليمي' },
  { key: 'trade', label: 'تجاري أو خدمي' },
];

// ★ ١١ أكتوبر (المالك): «أوضح وفيها تعريف» — الفرق بين الممول والمستثمر يُقال للزائر بجملة.
const NEEDS: { key: Need; label: string; hint: string; t: string; th: string }[] = [
  { key: 'funder', label: 'ممول', hint: 'جهة تموّلك وتسدّد لها على أقساط — وتبقى المالك وحدك', t: 'جهة داعمة', th: 'تدعمك بمبلغ يُسدَّد على أقساط — وتبقى المالك وحدك' },
  { key: 'investor', label: 'مستثمر', hint: 'شريك يدفع مقابل حصة من المشروع — بلا أقساط، ويشاركك الربح', t: 'شريك يدخل معك', th: 'يدفع مقابل حصة من المشروع — بلا أقساط، ويشاركك الربح' },
  { key: 'both', label: 'الاثنين', hint: 'ما أدري أيهما أنسب — رتّبوها لي', t: 'الاثنين', th: 'ما أدري أيهما أنسب — رتّبوها لي' },
];

// مساهمة صاحب المشروع — أصدق سؤال عن الجدّية
// ★ ١١ أكتوبر (المالك): من لا يساهم في المشروع قد يقدر على ثمن الدراسة — فلا يُعامَل
//   كغير جادّ، بل يُقال له إن طريقه المستثمر. والجدّية تُقرأ من الحجم لا من المساهمة وحدها.
const SHARES: { label: string; hint: string; score: number }[] = [
  { label: 'لن أساهم في المشروع', hint: 'أبحث عمّن يغطّي كلفته كاملة', score: 0 },
  { label: 'أقل من 20٪', hint: 'من كلفة المشروع', score: 1 },
  { label: 'من 20٪ إلى 30٪', hint: 'من كلفة المشروع', score: 2 },
  { label: 'أكثر من 30٪', hint: 'من كلفة المشروع', score: 3 },
];

// الأبواب التي تموّل مشروعاً مثل مشروعه — جهاتٌ حكومية وخاصة معروفة بالاسم.
// لا أرقام ولا وعود: الاسم وما يموّله، والقرار لها.
const DOORS: Record<Sector, string[]> = {
  industry: ['صندوق التنمية الصناعية السعودي', 'برنامج كفالة لتمويل المنشآت', 'شركات التمويل المرخّصة والبنوك'],
  agri: ['صندوق التنمية الزراعية', 'برنامج كفالة لتمويل المنشآت', 'شركات التمويل المرخّصة والبنوك'],
  tourism: ['صندوق التنمية السياحي', 'برنامج كفالة لتمويل المنشآت', 'شركات التمويل المرخّصة والبنوك'],
  tech: ['برامج منشآت للمنشآت الناشئة', 'المستثمرون الجريئون وصناديق رأس المال الجريء', 'شركات التمويل المرخّصة'],
  health: ['بنك التنمية الاجتماعية', 'برنامج كفالة لتمويل المنشآت', 'شركات التمويل المرخّصة والبنوك'],
  trade: ['بنك التنمية الاجتماعية', 'برنامج كفالة لتمويل المنشآت', 'شركات التمويل المرخّصة والبنوك'],
};

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

function choiceStyle(active: boolean, compact = false): React.CSSProperties {
  return {
    width: '100%', textAlign: 'right', cursor: 'pointer',
    background: active ? '#F2F8F5' : '#fff',
    border: '1.5px solid ' + (active ? GREEN : '#D9E5DF'),
    borderRadius: 13, padding: compact ? '11px 14px' : '13px 16px', marginBottom: compact ? 0 : 10,
    fontFamily: 'Tajawal, Cairo, sans-serif',
  };
}

const grid2: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(128px,1fr))', gap: 8 };

// ★ نسخة تيك توك (`/t/jadwa`): رفضت المنصة الصفحة «فرصةً مالية مضلّلة»، فالنصّ
//   المرئي بإطار «استشارات أعمال — دراسة جدوى احترافية» وبلا مفردات المال
//   الممنوعة، ولا رقم ولا رابط يخرج من الصفحة. والنموذج والحفظ واحد.
export const TIKTOK_H1 = 'دراسة جدوى ائتمانية واقتصادية لمشروعك';
const TIKTOK_LEAD = 'مكتب استشارات أعمال. خمسة أسئلة سريعة عن مشروعك، ويتصل بك فريقنا اليوم.';
export const TIKTOK_FOOTER = 'مكتب استشارات أعمال؛ لا نقدّم تمويلاً ولا نعد بنتيجة';
const T_KIND: Record<string, { label: string; hint: string }> = {
  working: { label: 'منشأة قائمة تحتاج سيولة', hint: 'تشغيل · مشتريات · رواتب · جدولة التزامات' },
};

function Q({ n, title, hint, children }: { n: string; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <label style={{ display: 'block', color: GREEN, fontWeight: 900, fontSize: 15, marginBottom: hint ? 4 : 10 }}>{n} · {title}</label>
      {hint && <div style={{ color: '#9DB3AB', fontWeight: 700, fontSize: 12.5, marginBottom: 10 }}>{hint}</div>}
      {children}
    </div>
  );
}

export default function JadwaLanding({ tiktok = false }: { tiktok?: boolean }) {
  const [kind, setKind] = useState<Kind | null>(null);
  const [sizeIdx, setSizeIdx] = useState<number | null>(null);
  const [sector, setSector] = useState<Sector | null>(null);
  const [need, setNeed] = useState<Need | null>(null);
  const [shareIdx, setShareIdx] = useState<number | null>(null);
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
    // المصدر من الرابط، وإلا من كوكي أول لمسة — التعريف في `@/lib/attribution`
    captureFirstTouch();
    setSrc(currentSource());
  }, []);

  const project = kind !== null;
  const size = sizeIdx === null ? null : SIZES[sizeIdx];
  const share = shareIdx === null ? null : SHARES[shareIdx];
  const answered = project && size !== null && sector !== null && need !== null && share !== null;
  const doors = sector ? DOORS[sector] : [];
  const showInvestors = need === 'investor' || need === 'both';
  // الجدّية: الحجم والمساهمة — تُكتب في الطلب، ويُرسل وزنها للإعلان فيتعلّم من يجلب
  const serious = (sizeIdx ?? 0) >= 1;

  const submit = async () => {
    if (sent.current) return;
    setErr(''); setBusy(true);
    const kindLabel = KINDS.find(k => k.key === kind)?.label || '';
    const summary = '⭐ ' + (serious ? 'جادّ · ' : '') + kindLabel + ' · ' + (size?.short || '') + ' · '
      + (SECTORS.find(x => x.key === sector)?.label || '') + ' · يبحث عن ' + (NEEDS.find(x => x.key === need)?.label || '')
      + ' · مساهمته: ' + (share?.label || '');
    const note = summary + '\n'
      + 'من مدخل دراسة الجدوى.\n'
      + 'الأبواب المعروضة له: ' + doors.join('، ') + (showInvestors ? '، ومستثمرون في قطاعه' : '');
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
      if (!sent.current && !d?.already) {
        sent.current = true;
        const w = studyWeight(sizeIdx ?? 0) * (share?.score === 3 ? 1.5 : 1);
        fireConversion(LEAD_SUBMITTED, { phone }, { value: Math.round(w) }); tiktokEvent('SubmitForm'); tiktokEvent('Contact');
      }
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
          {tiktok ? (
            <div style={{ color: GREEN, fontWeight: 900, fontSize: 22 }}>
              مُرضي <span style={{ fontSize: 11, color: '#9DB3AB', letterSpacing: '.14em', fontWeight: 500 }}>MURDI</span>
            </div>
          ) : (
          <Link href="/" style={{ color: GREEN, fontWeight: 900, fontSize: 22, textDecoration: 'none' }}>
            مُرضي <span style={{ fontSize: 11, color: '#9DB3AB', letterSpacing: '.14em', fontWeight: 500 }}>MURDI</span>
          </Link>
          )}
          {tiktok
            ? <span style={{ color: MUTED, fontWeight: 800, fontSize: 13.5 }}>استشارات أعمال</span>
            : <a href="tel:0570749196" style={{ color: MUTED, fontWeight: 800, fontSize: 13.5, textDecoration: 'none' }}>0570749196</a>}
        </div>
      </nav>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '34px 20px 70px' }}>

        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ color: GOLD, fontWeight: 900, fontSize: 12, letterSpacing: '.12em', marginBottom: 8 }}>
            {tiktok ? 'الدكتور عبدالحكيم المرضي · استشارات أعمال' : <>الدكتور عبدالحكيم المرضي · مستشار مالي معتمد — <span style={{ whiteSpace: 'nowrap' }}>ترخيص رقم FL-457927015</span></>}
          </div>
          <h1 style={{ color: GREEN, fontSize: 27, fontWeight: 900, margin: '0 0 8px', lineHeight: 1.5 }}>
            {tiktok ? TIKTOK_H1 : 'دراسة جدوى تقنع الممول والمستثمر'}
          </h1>
          <p style={{ color: MUTED, fontSize: 14.5, fontWeight: 700, lineHeight: 1.95, margin: 0 }}>
            {tiktok ? TIKTOK_LEAD : <>عندك فكرة أو توسعة؟ <b style={{ color: GREEN }}>الممول ما يموّل فكرتك… يموّل رقمك.</b> خمسة أسئلة سريعة، ونحدد الجهات المناسبة لمشروعك.</>}
          </p>
        </div>

        {done ? (
          <div style={{ background: '#fff', border: '1.5px solid #BFE0D3', borderRadius: 18, padding: '34px 28px', textAlign: 'center' }}>
            <div style={{ color: '#1A5C46', fontWeight: 900, fontSize: 21, marginBottom: 10 }}>وصلنا مشروعك</div>
            <p style={{ color: MUTED, fontSize: 14, fontWeight: 700, lineHeight: 2, margin: '0 0 20px' }}>
              يتصل بك فريقنا على <b style={{ color: GREEN }}>{phone}</b> اليوم — أو صباح يوم العمل التالي إن وصلنا بعد الدوام —
              ومعنا قراءةٌ أولية لمشروعك والأبواب المناسبة له.{tiktok ? '' : ' وإن كان الأمر عاجلاً فاتصل على 0570749196.'}
            </p>
            {!tiktok && (
            <Link href="/services" style={{ display: 'inline-block', background: GREEN, color: '#fff', padding: '12px 30px', borderRadius: 999, fontWeight: 900, fontSize: 14, textDecoration: 'none' }}>
              اطّلع على بقية الخدمات
            </Link>
            )}
          </div>
        ) : (
          <div style={{ background: '#fff', border: '1.5px solid ' + LINE, borderRadius: 18, padding: '26px 24px' }}>

            <Q n="١" title="مشروعك أيّ هذه؟" hint="لنجهّز لك القراءة المناسبة لوضعك.">
              {KINDS.map((k) => (
                <button key={k.key} type="button" onClick={() => setKind(k.key)} style={choiceStyle(kind === k.key)}>
                  <div style={{ color: GREEN, fontWeight: 900, fontSize: 14.5 }}>{(tiktok && T_KIND[k.key]?.label) || k.label}</div>
                  <div style={{ color: '#9DB3AB', fontWeight: 700, fontSize: 12.5, marginTop: 3 }}>{(tiktok && T_KIND[k.key]?.hint) || k.hint}</div>
                </button>
              ))}
            </Q>

            {project && (
              <Q n="٢" title={tiktok ? 'كلفة المشروع التقريبية' : 'حجم الاستثمار التقريبي'} hint="تقديرٌ يكفي — كامل ما سيُصرف على المشروع: المعدات والتجهيز والموقع ورأس مال التشغيل للسنة الأولى.">
                <div style={grid2}>
                  {SIZES.map((s, i) => (
                    <button key={s.label} type="button" onClick={() => setSizeIdx(i)} style={choiceStyle(sizeIdx === i, true)}>
                      <div style={{ color: GREEN, fontWeight: 900, fontSize: 14 }}>{s.label}</div>
                    </button>
                  ))}
                </div>
              </Q>
            )}

            {project && size && (
              <Q n="٣" title="قطاع المشروع" hint="لكل قطاع جهاتٌ حكومية متخصصة تموّله — نحددها لك.">
                <div style={grid2}>
                  {SECTORS.map((x) => (
                    <button key={x.key} type="button" onClick={() => setSector(x.key)} style={choiceStyle(sector === x.key, true)}>
                      <div style={{ color: GREEN, fontWeight: 900, fontSize: 14 }}>{x.label}</div>
                    </button>
                  ))}
                </div>
              </Q>
            )}

            {project && size && sector && (
              <Q n="٤" title={tiktok ? 'مَن تبحث عنه؟' : 'تبحث عن ممول أو مستثمر أو الاثنين؟'}>
                {NEEDS.map((x) => (
                  <button key={x.key} type="button" onClick={() => setNeed(x.key)} style={choiceStyle(need === x.key)}>
                    <div style={{ color: GREEN, fontWeight: 900, fontSize: 14.5 }}>{tiktok ? x.t : x.label}</div>
                    <div style={{ color: '#9DB3AB', fontWeight: 700, fontSize: 12.5, marginTop: 3 }}>{tiktok ? x.th : x.hint}</div>
                  </button>
                ))}
              </Q>
            )}

            {project && size && sector && need && (
              <Q n="٥" title="كم تقدر تساهم في كلفة المشروع من مالك؟" hint={tiktok ? 'نسبة تقريبية — ولا بأس إن لم تساهم بشيء.' : 'الممول يطلب عادةً مساهمةً من صاحب المشروع، والمستثمر لا يشترطها — فالجواب يحدد طريقك، ولا بأس إن لم تساهم بشيء.'}>
                <div style={grid2}>
                  {SHARES.map((x, i) => (
                    <button key={x.label} type="button" onClick={() => setShareIdx(i)} style={choiceStyle(shareIdx === i, true)}>
                      <div style={{ color: GREEN, fontWeight: 900, fontSize: 14 }}>{x.label}</div>
                      <div style={{ color: '#9DB3AB', fontWeight: 700, fontSize: 11.5, marginTop: 2 }}>{x.hint}</div>
                    </button>
                  ))}
                </div>
              </Q>
            )}

            {/* الطُّعم: الأبواب بأسمائها — يرى الملايين قبل أن يُسأل عن شيء */}
            {answered && (
              <div style={{ border: '1.5px solid ' + GOLD, background: '#FFFCF3', borderRadius: 14, padding: '18px 20px', marginBottom: 22 }}>
                <div style={{ color: GREEN, fontWeight: 900, fontSize: 15.5, marginBottom: 4 }}>
                  {tiktok ? 'جهاتٌ تدعم مشروعاً مثل مشروعك' : 'مشروعٌ بحجم ' + size?.short + ' في قطاعك — هذه أبوابه:'}
                </div>
                <div style={{ marginTop: 10 }}>
                  {doors.map((d) => (
                    <div key={d} style={{ color: GREEN, fontWeight: 800, fontSize: 14, lineHeight: 2.1 }}>✦ {d}</div>
                  ))}
                  {showInvestors && <div style={{ color: GREEN, fontWeight: 800, fontSize: 14, lineHeight: 2.1 }}>✦ مستثمرون وشركاء يدخلون في قطاعك</div>}
                </div>
                <div style={{ color: MUTED, fontWeight: 700, fontSize: 13, lineHeight: 1.95, marginTop: 10, borderTop: '1px solid #EFE6CC', paddingTop: 10 }}>
                  {tiktok
                    ? 'وكلها تسأل السؤال نفسه: هل الأرقام مقنعة؟ دراستك هي الجواب — ونحن نكتبها ونعرضها عليهم.'
                    : <>وكلّها تسأل السؤال نفسه قبل أي شيء: <b style={{ color: GREEN }}>من وين بترجع الفلوس؟ ومتى؟</b> دراسة الجدوى الائتمانية والاقتصادية هي الجواب — نكتبها بلغتهم، ونحدد الأنسب لك منهم، ونعرض مشروعك عليهم.</>}
                </div>
                {share?.score === 0 && (
                  <div style={{ color: '#8A6D1F', fontWeight: 800, fontSize: 12.5, lineHeight: 1.9, marginTop: 10 }}>
                    {tiktok ? 'وبلا مساهمة منك، الشريك الذي يدخل معك هو الطريق الأقرب.' : 'وبلا مساهمة منك، المستثمر أو الشريك هو الطريق الأقرب — والدراسة هي ما يقنعه.'}
                  </div>
                )}
              </div>
            )}

            {answered && (
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
                  {busy ? 'لحظة…' : 'سجّل مشروعك — ونتصل بك اليوم'}
                </button>

                <p style={{ color: '#9DB3AB', fontSize: 11.8, fontWeight: 700, lineHeight: 1.9, textAlign: 'center', margin: '14px 0 0' }}>
                  لا نطلب منك ريالاً قبل أن نتكلّم معك ونتأكد أن الدراسة تخصّك — وإن لم تكن تخصّك
                  قلنا لك ذلك ولم نبعك إياها.
                </p>
              </>
            )}
          </div>
        )}
        {tiktok && <p style={{ color: '#9DB3AB', fontSize: 12, fontWeight: 700, textAlign: 'center', margin: '30px 0 0', lineHeight: 1.8 }}>{TIKTOK_FOOTER}</p>}
      </div>
    </div>
  );
}
