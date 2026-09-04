import type { Metadata } from 'next';
import Link from 'next/link';
import { CATALOG, SERVICE_COUNT, displayName, commercialFor, needsDiagnosis } from '@/lib/serviceCatalog';
import type { ServiceCommercial } from '@/lib/servicePricing';

// السعر كما يُقال لزائر لا حقلَ أمامه.
//
// priceFor تُعيد للخدمات ذات الشرائح نصّاً موجّهاً للواجهة الداخلية:
// «أدخل حجم استثمارك ليظهر سعرك» — وهو أمرٌ لا معنى له في صفحة عامة.
// فالمعروض هنا: أدنى شريحة مسبوقة بـ«من»، وأرخص خيارٍ إن وُجد.
function publicPrice(c: ServiceCommercial | undefined): { main: string; hint?: string } {
  if (!c) return { main: 'بعرض خاص' };
  const cheapest = (c.options || []).reduce<number | null>(
    (m, o) => (typeof o.price === 'number' && (m === null || o.price < m) ? o.price : m), null);
  const hint = cheapest !== null ? 'ويبدأ بـ ' + cheapest.toLocaleString('en-US') + ' ر.س — ويُخصم منها بالكامل' : undefined;
  if (c.tiers && c.tiers.length) return { main: 'من ' + c.tiers[0].price.toLocaleString('en-US') + ' ر.س', hint };
  if (typeof c.price === 'number') return { main: c.price.toLocaleString('en-US') + ' ر.س', hint };
  return { main: 'بعرض خاص', hint: c.quoteBasis ? undefined : hint };
}

// واجهة الخدمات العامة — بلا تسجيل دخول.
//
// كانت الخدمات السبع عشرة تُذكر بأسمائها في الصفحة الرئيسية ولا شيء غير
// الأسماء: بلا سعر ولا مدة ولا وصف ولا طريقة طلب، وزرُّها الوحيد يعيد
// الزائر إلى التقييم. فمن يبحث عن «دراسة جدوى» أو «إعداد قوائم مالية» —
// وعنده نية ومال — لا يجد في مُرضي صفحةً تستقبله.
//
// وهذه الصفحة لا تكشف جديداً: هي نفسها ما يراه العميل بعد أربع بوابات.
// نقلناها إلى حيث تُقرأ قبلها.

export const metadata: Metadata = {
  title: 'خدمات مُرضي | تأهيل المنشآت لرأس المال — بأسعار معلنة',
  description:
    'دراسة الجدوى الائتمانية · إعداد القوائم المالية · تجهيز ملف التمويل والمخاطبة · لوائح الحوكمة · التقييم العادل · الاعتمادات المستندية وتمويل الذمم. أسعار ومدد معلنة، عبر حلول المرضي للاستشارات المالية — ترخيص FL-457927015.',
  alternates: { canonical: 'https://murdi.sa/services' },
  openGraph: {
    title: 'خدمات مُرضي | تأهيل المنشآت لرأس المال',
    description: 'سبع عشرة خدمة بسعر معلن ومدة معلومة — كل واحدة تُزيل عائقاً بعينه بين ملفك وبين من يموّلك.',
    url: 'https://murdi.sa/services',
    locale: 'ar_SA',
    type: 'website',
  },
};

const GREEN = '#1A3D34';
const GOLD = '#C9A84C';
const MUTED = '#6B8A80';
const LINE = '#EAF2EE';

function Card({ title }: { title: string }) {
  const c = commercialFor(title);
  const pr = publicPrice(c);
  const direct = !needsDiagnosis(title);
  const label = displayName(title);

  return (
    <div style={{ background: '#fff', border: '1.5px solid ' + LINE, borderRadius: 16, padding: '22px 22px 20px', display: 'flex', flexDirection: 'column' }}>
      <h3 style={{ color: GREEN, fontWeight: 900, fontSize: 17, lineHeight: 1.55, margin: '0 0 8px' }}>{label}</h3>

      {c?.pain && <p style={{ color: MUTED, fontSize: 13.5, fontWeight: 700, lineHeight: 1.95, margin: '0 0 14px' }}>{c.pain}</p>}

      <div style={{ paddingBottom: 12, borderBottom: '1px dashed ' + LINE, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
          <span style={{ color: GREEN, fontWeight: 900, fontSize: 19 }}>{pr.main}</span>
          <span style={{ color: '#9DB3AB', fontSize: 12, fontWeight: 700 }}>{c?.days || ''}</span>
        </div>
        {pr.hint && <div style={{ color: '#8A6D1F', fontSize: 12, fontWeight: 800, marginTop: 4 }}>{pr.hint}</div>}
      </div>

      {c?.deliverables?.length ? (
        <>
          <div style={{ color: GREEN, fontSize: 12.5, fontWeight: 900, marginBottom: 6 }}>ما تستلمه</div>
          <ul style={{ margin: '0 0 12px', paddingInlineStart: 18 }}>
            {c.deliverables.slice(0, 4).map((d, i) => (
              <li key={i} style={{ color: '#4A6A60', fontSize: 12.8, fontWeight: 700, lineHeight: 1.85, marginBottom: 4 }}>{d}</li>
            ))}
          </ul>
        </>
      ) : null}

      {c?.forWho && (
        <div style={{ color: '#4A6A60', fontSize: 12.5, fontWeight: 700, lineHeight: 1.85, marginBottom: 4 }}>
          <b style={{ color: GREEN }}>لمن: </b>{c.forWho}
        </div>
      )}
      {/* «ليست لمن» تُعرض في الواجهة العامة كما تُعرض في الداخل. والصدق هنا
          يمنع بيعاً خاطئاً يكلّف السمعة أكثر مما يكسب الرسم. */}
      {c?.notForWho && (
        <div style={{ color: '#8A6D1F', fontSize: 12.5, fontWeight: 700, lineHeight: 1.85, marginBottom: 4 }}>
          <b>ليست لمن: </b>{c.notForWho}
        </div>
      )}
      {c?.successFee && (
        <div style={{ color: '#9A7B2E', fontSize: 12, fontWeight: 700, lineHeight: 1.8, marginTop: 6 }}>{c.successFee.replace(/\*\*/g, '')}</div>
      )}

      <div style={{ flex: 1 }} />

      <div style={{ marginTop: 16 }}>
        {direct ? (
          <Link href={'/services/request?s=' + encodeURIComponent(title)}
            style={{ display: 'block', textAlign: 'center', background: GREEN, color: '#fff', padding: '12px', borderRadius: 999, fontWeight: 900, fontSize: 14, textDecoration: 'none' }}>
            اطلبها — بلا حساب
          </Link>
        ) : (
          <>
            <Link href="/test"
              style={{ display: 'block', textAlign: 'center', background: '#fff', color: GREEN, border: '1.5px solid ' + GREEN, padding: '11px', borderRadius: 999, fontWeight: 900, fontSize: 13.5, textDecoration: 'none' }}>
              ابدأ بالتقييم المجاني
            </Link>
            <p style={{ color: '#9DB3AB', fontSize: 11.5, fontWeight: 700, lineHeight: 1.8, margin: '8px 0 0', textAlign: 'center' }}>
              هذه تُبنى على تشخيص ملفك — لا نبيعها قبل أن نعرف أنها تخصّك
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default function ServicesPage() {
  const all = CATALOG.flatMap((c) => c.items);
  const direct = all.filter((t) => !needsDiagnosis(t));
  const diagnosed = CATALOG.map((c) => ({ ...c, items: c.items.filter((t) => needsDiagnosis(t)) })).filter((c) => c.items.length > 0);

  return (
    <div dir="rtl" style={{ background: '#FBFCFB', minHeight: '100vh', fontFamily: 'Tajawal, Cairo, sans-serif' }}>
      {/* شريط علوي بسيط — الزائر يعرف أين هو ويجد الدخول والهاتف */}
      <nav style={{ background: '#fff', borderBottom: '1px solid ' + LINE, padding: '16px 20px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <Link href="/" style={{ color: GREEN, fontWeight: 900, fontSize: 22, textDecoration: 'none' }}>
            مُرضي <span style={{ fontSize: 11, color: '#9DB3AB', letterSpacing: '.14em', fontWeight: 500 }}>MURDI</span>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <a href="tel:0570314005" style={{ color: MUTED, fontWeight: 800, fontSize: 13.5, textDecoration: 'none' }}>0570314005</a>
            <Link href="/auth/login" style={{ background: GREEN, color: '#fff', padding: '9px 20px', borderRadius: 999, fontWeight: 900, fontSize: 13, textDecoration: 'none' }}>تسجيل الدخول</Link>
          </div>
        </div>
      </nav>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '48px 20px 70px' }}>
        <header style={{ textAlign: 'center', marginBottom: 42 }}>
          <div style={{ color: GOLD, fontWeight: 900, fontSize: 12, letterSpacing: '.12em', marginBottom: 10 }}>
            حلول المرضي للاستشارات المالية · ترخيص FL-457927015
          </div>
          <h1 style={{ color: GREEN, fontSize: 32, fontWeight: 900, lineHeight: 1.5, margin: '0 0 12px', fontFamily: 'Amiri, serif' }}>
            {SERVICE_COUNT} خدمة تؤهّل منشأتك لرأس المال
          </h1>
          <p style={{ color: MUTED, fontSize: 15, fontWeight: 700, lineHeight: 2, maxWidth: 720, margin: '0 auto' }}>
            كل واحدة منها تُزيل عائقاً بعينه بين ملفك وبين الجهة التي تموّلك — بسعر معلن ومدة معلومة،
            بلا مكالمة ولا مساومة. وتُنفَّذ تحت إشراف الدكتور عبدالحكيم المرضي.
          </p>
        </header>

        {/* ما يُطلب مباشرة */}
        <section style={{ marginBottom: 52 }}>
          <div style={{ borderBottom: '2px solid ' + LINE, paddingBottom: 10, marginBottom: 8 }}>
            <h2 style={{ color: GREEN, fontSize: 21, fontWeight: 900, margin: 0 }}>تُطلب مباشرة</h2>
          </div>
          <p style={{ color: MUTED, fontSize: 13.5, fontWeight: 700, lineHeight: 1.95, margin: '0 0 20px' }}>
            هذه تعرف حاجتك إليها بنفسك، فلا نطلب منك تقييماً قبلها ولا حساباً. اطلبها ونتواصل معك في نفس اليوم.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 18 }}>
            {direct.map((t) => <Card key={t} title={t} />)}
          </div>
        </section>

        {/* ما يحتاج تشخيصاً */}
        <section>
          <div style={{ borderBottom: '2px solid ' + LINE, paddingBottom: 10, marginBottom: 8 }}>
            <h2 style={{ color: GREEN, fontSize: 21, fontWeight: 900, margin: 0 }}>تُبنى على تشخيص ملفك</h2>
          </div>
          <p style={{ color: MUTED, fontSize: 13.5, fontWeight: 700, lineHeight: 1.95, margin: '0 0 20px' }}>
            هذه لا تُباع بالوصف بل بالدليل. التقييم والمطابقة مجاناً، وبعدهما نقول لك بالأرقام أيّها يخصّك —
            كم جهة من جهاتك تطلب هذا بالضبط — وأيّها لا يعنيك فلا نعرضه عليك.
          </p>
          {diagnosed.map((cat) => (
            <div key={cat.label} style={{ marginBottom: 30 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 14 }}>
                <span style={{ color: GREEN, fontWeight: 900, fontSize: 16 }}>{cat.label}</span>
                <span style={{ color: '#9DB3AB', fontSize: 12, fontWeight: 700 }}>{cat.note}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 18 }}>
                {cat.items.map((t) => <Card key={t} title={t} />)}
              </div>
            </div>
          ))}
        </section>

        <div style={{ background: GREEN, borderRadius: 18, padding: '30px 26px', textAlign: 'center', marginTop: 44 }}>
          <div style={{ color: '#fff', fontWeight: 900, fontSize: 19, marginBottom: 8, fontFamily: 'Amiri, serif' }}>
            ولا تحتاجها كلها
          </div>
          <p style={{ color: '#CFE0DA', fontSize: 14, fontWeight: 700, lineHeight: 2, maxWidth: 620, margin: '0 auto 18px' }}>
            التقييم مجاني ويأخذ دقائق، ويعطيك درجتك وما يمنع قبولك بالضبط. وبعده تعرف أيّ خدمة تخصّك —
            ولا نبيعك ما لا ينفعك.
          </p>
          <Link href="/test" style={{ display: 'inline-block', background: GOLD, color: GREEN, padding: '13px 34px', borderRadius: 999, fontWeight: 900, fontSize: 14.5, textDecoration: 'none' }}>
            ابدأ التقييم المجاني
          </Link>
        </div>

        <p style={{ color: '#9DB3AB', fontSize: 11.5, fontWeight: 700, textAlign: 'center', lineHeight: 1.9, marginTop: 30 }}>
          الأسعار أعلاه لا تشمل ضريبة القيمة المضافة. وأتعاب النجاح — حيث ذُكرت — لا تُدفع إلا بعد وصول التمويل إلى حسابك.
          <br />شركة حلول المرضي للاستشارات المالية · سجل تجاري 7039663724 · الرياض
        </p>
      </div>
    </div>
  );
}
