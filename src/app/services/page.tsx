import type { Metadata } from 'next';
import Link from 'next/link';
import SignedInServicesStrip from '@/components/SignedInServicesStrip';
import { CATALOG, SERVICE_COUNT, displayName, commercialFor, needsDiagnosis, serviceAnchor } from '@/lib/serviceCatalog';
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
//
// ═══ الهوية ═══
// كانت الصفحة بيضاء بزوايا دائرية، وبقية المنصة خضراء غامقة بذهبٍ وزوايا
// حادّة — فيخرج الزائر من الرئيسية إلى صفحةٍ لا تشبهها فيظنّها موقعاً آخر.
// فالمتغيّرات أدناه هي نفسها متغيّرات الرئيسية حرفاً بحرف، والزوايا حادّة
// مثلها، والخطّان نفسهما: تجوّل للعناوين، وIBM Plex للنصّ.

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

function Card({ title }: { title: string }) {
  const c = commercialFor(title);
  const pr = publicPrice(c);
  const direct = !needsDiagnosis(title);
  const label = displayName(title);

  return (
    // id المرساة: من ضغط اسم الخدمة في الواجهة الرئيسية ينزل على بطاقتها هي
    <div className="sv-card" id={serviceAnchor(title)}>
      <h3 className="sv-t">{label}</h3>

      {c?.pain && <p className="sv-pain">{c.pain}</p>}

      <div className="sv-price">
        <div className="sv-price-row">
          <span className="sv-amount">{pr.main}</span>
          <span className="sv-days">{c?.days || ''}</span>
        </div>
        {pr.hint && <div className="sv-hint">{pr.hint}</div>}
      </div>

      {/* ما تستلمه — كاملاً لا مقصوصاً.
          كان يُقصّ عند البند الرابع، وبند المطابقة في دراسة الجدوى هو
          الخامس: «جدول الجهات المرشّحة… وما ينقصك عند كل جهة». فكان أقوى
          ما في الخدمة محجوباً عن صفحة البيع، ويظنّ قارئها أنها دراسة ورقية
          كأي دراسة. والقصّ يوفّر سطرين ويكلّف الخدمة نفسها. */}
      {c?.deliverables?.length ? (
        <>
          <div className="sv-h">ما تستلمه</div>
          <ul className="sv-ul">
            {c.deliverables.map((d, i) => <li key={i}>{d}</li>)}
          </ul>
        </>
      ) : null}

      {c?.forWho && <div className="sv-for"><b>لمن: </b>{c.forWho}</div>}
      {/* «ليست لمن» تُعرض في الواجهة العامة كما تُعرض في الداخل. والصدق هنا
          يمنع بيعاً خاطئاً يكلّف السمعة أكثر مما يكسب الرسم. */}
      {c?.notForWho && <div className="sv-not"><b>ليست لمن: </b>{c.notForWho}</div>}
      {c?.successFee && <div className="sv-fee">{c.successFee.replace(/\*\*/g, '')}</div>}

      <div style={{ flex: 1 }} />

      <div className="sv-cta-wrap">
        {direct ? (
          <>
            {/* كُتب أولاً «اطلبها — بلا حساب»، وقرأها صاحب المنصة نفسه
                «بلا مقابل». وما يلتبس على صاحبه يلتبس على الزائر من باب
                أَولى — فحُذف من الزرّ كل ما يحتمل معنى المجانية، وبقي
                انعدام التسجيل سطراً تحته لا وعداً فيه. */}
            <Link href={'/services/request?s=' + encodeURIComponent(title)} className="sv-cta">اطلبها الآن</Link>
            <p className="sv-note">بلا تسجيل — نتصل بك ونتأكد أنها تخصّك قبل أي دفع</p>
          </>
        ) : (
          <>
            <Link href="/test" className="sv-cta ghost">ابدأ بالتقييم المجاني</Link>
            <p className="sv-note">هذه تُبنى على تشخيص ملفك — لا نبيعها قبل أن نعرف أنها تخصّك</p>
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
    <div className="sv" dir="rtl">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700&family=Amiri:wght@700&display=swap');
        .sv{
          --ink:#1A3D34; --deep:#122C26; --gold:#C9A84C; --gold-soft:#E4CE93;
          --paper:#FFFFFF; --mist:#F4F7F6; --line:#E3EAE7; --muted:#6B8A80;
          font-family:'IBM Plex Sans Arabic',sans-serif;background:var(--paper);
          color:var(--ink);direction:rtl;min-height:100vh;-webkit-font-smoothing:antialiased;
        }
        .sv *{box-sizing:border-box}
        .sv h1,.sv h2,.sv h3{font-family:'Tajawal',sans-serif;font-weight:900;letter-spacing:-.01em;margin:0}
        .sv a{text-decoration:none}

        .sv-bar{background:var(--deep);color:#9FB6AE;font-size:12px;text-align:center;padding:8px 16px;letter-spacing:.02em}
        .sv-bar b{color:#fff;font-weight:600}

        .sv-nav{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:14px 28px;background:#fff;border-bottom:1px solid var(--line);position:sticky;top:0;z-index:90;flex-wrap:wrap}
        .sv-logo{font-family:'Tajawal';font-weight:900;font-size:22px;color:var(--ink)}
        .sv-logo span{font-size:11px;color:#9DB3AB;letter-spacing:.14em;font-weight:500}
        .sv-nav-r{display:flex;align-items:center;gap:16px}
        .sv-link{color:var(--muted);font-weight:600;font-size:14px}
        .sv-link:hover{color:var(--ink)}
        .sv-here{color:var(--ink);font-weight:800;font-size:14.5px;border-bottom:2px solid var(--gold);padding-bottom:3px}
        .sv-login{background:var(--ink);color:#fff;padding:9px 22px;border-radius:2px;font-weight:800;font-size:13px}

        /* ═══ الرأس: أخضر غامق كرأس الرئيسية ═══ */
        .sv-hero{background:var(--ink);color:#fff;padding:clamp(46px,7vw,78px) 20px clamp(42px,6vw,64px);text-align:center}
        .sv-eyebrow{font-size:11.5px;font-weight:600;letter-spacing:.16em;color:var(--gold);margin-bottom:14px}
        .sv-hero h1{font-family:'Amiri',serif;font-size:clamp(26px,4.4vw,38px);line-height:1.55;color:#fff;margin-bottom:14px}
        .sv-hero h1 em{font-style:normal;color:var(--gold)}
        .sv-hero p{color:#BFD4CD;font-size:15px;font-weight:400;line-height:2.05;max-width:720px;margin:0 auto}
        .sv-rule{width:38px;height:2px;background:var(--gold);margin:22px auto 0}

        .sv-wrap{max-width:1120px;margin:0 auto;padding:46px 20px 70px}

        .sv-sec{margin-bottom:54px}
        .sv-sec-h{border-bottom:2px solid var(--line);padding-bottom:11px;margin-bottom:10px;display:flex;align-items:baseline;gap:12px}
        .sv-sec-h h2{font-size:21px;color:var(--ink);position:relative}
        .sv-sec-h h2::after{content:'';position:absolute;right:0;bottom:-13px;width:46px;height:2px;background:var(--gold)}
        .sv-sec-p{color:var(--muted);font-size:13.5px;font-weight:400;line-height:2;margin:0 0 22px}

        .sv-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(330px,1fr));gap:14px}

        /* ═══ البطاقة خضراء غامقة ═══
           كانت بيضاء على أرضية بيضاء، فلا يفصل البطاقةَ عن الصفحة إلا خطٌّ
           رفيع — ولا يعرف الزائر أين تنتهي خدمة وتبدأ أخرى. والخضرة الغامقة
           تفصلها وتُظهر الذهبي عليها، وهي لون المنصة نفسه. والسعر أبرز ما
           فيها فجُعل ذهبياً على الخضرة. */
        .sv-card{background:var(--ink);border-top:3px solid var(--gold);padding:26px 24px 22px;
          display:flex;flex-direction:column;color:#fff;scroll-margin-top:90px;transition:.2s}
        .sv-card:hover{background:var(--deep);box-shadow:0 6px 26px rgba(18,44,38,.20)}
        .sv-t{font-size:17.5px;line-height:1.55;color:#fff;margin-bottom:9px}
        .sv-pain{color:#B6CEC6;font-size:13.5px;font-weight:400;line-height:2;margin:0 0 15px}

        .sv-price{padding:12px 0;border-top:1px solid rgba(255,255,255,.14);border-bottom:1px solid rgba(255,255,255,.14);margin-bottom:14px}
        .sv-price-row{display:flex;align-items:baseline;justify-content:space-between;gap:10px}
        .sv-amount{font-family:'Tajawal';color:var(--gold);font-weight:900;font-size:22px}
        .sv-days{color:#9FB8B0;font-size:12px;font-weight:500}
        .sv-hint{color:var(--gold-soft);font-size:12px;font-weight:700;margin-top:5px}

        .sv-h{font-family:'Tajawal';color:var(--gold);font-size:12.5px;font-weight:900;margin-bottom:7px;letter-spacing:.02em}
        .sv-ul{margin:0 0 14px;padding-inline-start:0;list-style:none}
        .sv-ul li{color:#CFE0DA;font-size:12.9px;font-weight:400;line-height:1.9;margin-bottom:6px;padding-inline-start:15px;position:relative}
        .sv-ul li::before{content:'';position:absolute;right:0;top:9px;width:5px;height:5px;background:var(--gold)}

        .sv-for{color:#CFE0DA;font-size:12.5px;font-weight:400;line-height:1.9;margin-bottom:5px}
        .sv-for b{color:#fff;font-weight:700}
        .sv-not{color:var(--gold-soft);font-size:12.5px;font-weight:400;line-height:1.9;margin-bottom:5px}
        .sv-not b{font-weight:700}
        .sv-fee{color:#B3C9C1;font-size:12px;font-weight:500;line-height:1.85;margin-top:7px}

        /* الزرّ ذهبي على الخضرة — أعلى تباين في البطاقة، فهو المقصود منها */
        .sv-cta-wrap{margin-top:18px}
        .sv-cta{display:block;text-align:center;background:var(--gold);color:var(--deep);padding:13px;border-radius:2px;font-family:'Tajawal';font-weight:900;font-size:14.5px;transition:.18s}
        .sv-cta:hover{background:#D9BA63}
        .sv-cta.ghost{background:transparent;color:var(--gold);border:1.5px solid var(--gold)}
        .sv-cta.ghost:hover{background:rgba(201,168,76,.12)}
        .sv-note{color:#9FB8B0;font-size:11.5px;font-weight:400;line-height:1.85;margin:9px 0 0;text-align:center}

        .sv-cat{margin-bottom:34px}
        .sv-cat-h{display:flex;align-items:baseline;gap:12px;margin-bottom:14px;flex-wrap:wrap}
        .sv-cat-h b{font-family:'Tajawal';color:var(--ink);font-weight:900;font-size:16px}
        .sv-cat-h span{color:#9DB3AB;font-size:12px;font-weight:400}

        /* الخاتمة: فاتحة بإطار ذهبي — البطاقات صارت خضراء، فلو كانت الخاتمة
           خضراء أيضاً لذابت فيها ولم تُقرأ كنداءٍ مستقل */
        .sv-final{background:var(--mist);border:1px solid var(--line);border-top:3px solid var(--gold);padding:38px 26px;text-align:center;margin-top:48px}
        .sv-final h2{font-family:'Amiri',serif;color:var(--ink);font-size:23px;margin-bottom:10px}
        .sv-final p{color:var(--muted);font-size:14px;font-weight:400;line-height:2.05;max-width:640px;margin:0 auto 20px}
        .sv-final a{display:inline-block;background:var(--ink);color:#fff;padding:15px 38px;border-radius:2px;font-family:'Tajawal';font-weight:900;font-size:15px;transition:.18s}
        .sv-final a:hover{background:var(--deep)}

        .sv-foot{color:#9DB3AB;font-size:11.5px;font-weight:400;text-align:center;line-height:2;margin-top:30px}

        @media(max-width:560px){
          .sv-nav{padding:12px 16px}
          .sv-nav-r{gap:11px}
          .sv-link,.sv-here{font-size:13px}
          .sv-grid{grid-template-columns:1fr}
        }
      `}</style>

      <div className="sv-bar">حلول المرضي للاستشارات المالية · ترخيص <b>FL-457927015</b> · سجل تجاري <b>7039663724</b></div>

      <nav className="sv-nav">
        <Link href="/" className="sv-logo">مُرضي <span>MURDI</span></Link>
        {/* نفس عناصر شريط الرئيسية وبنفس ترتيبها — المقرّ واحد، والانتقال
            بينهما لا يُشعر الزائر أنه خرج من الموقع إلى مكان آخر. */}
        <div className="sv-nav-r">
          <Link href="/" className="sv-link">الرئيسية</Link>
          <span className="sv-here">الخدمات</span>
          <a href="tel:0570314005" className="sv-link">0570314005</a>
          <Link href="/auth/login" className="sv-login">تسجيل الدخول</Link>
        </div>
      </nav>

      <header className="sv-hero">
        <div className="sv-eyebrow">خدمات مُرضي</div>
        <h1>{SERVICE_COUNT} خدمة تؤهّل منشأتك <em>لرأس المال</em></h1>
        <p>
          كل واحدة منها تُزيل عائقاً بعينه بين ملفك وبين الجهة التي تموّلك — بسعر معلن ومدة معلومة،
          بلا مكالمة ولا مساومة. وتُنفَّذ تحت إشراف الدكتور عبدالحكيم المرضي.
        </p>
        <div className="sv-rule" />
      </header>

      <div className="sv-wrap">
        <SignedInServicesStrip />

        {/* ما يُطلب مباشرة */}
        <section className="sv-sec">
          <div className="sv-sec-h"><h2>تُطلب مباشرة</h2></div>
          <p className="sv-sec-p">
            هذه تعرف حاجتك إليها بنفسك، فلا نطلب منك تقييماً قبلها ولا حساباً. اطلبها ونتواصل معك في نفس اليوم.
          </p>
          <div className="sv-grid">
            {direct.map((t) => <Card key={t} title={t} />)}
          </div>
        </section>

        {/* ما يحتاج تشخيصاً */}
        <section>
          <div className="sv-sec-h"><h2>تُبنى على تشخيص ملفك</h2></div>
          <p className="sv-sec-p">
            هذه لا تُباع بالوصف بل بالدليل. التقييم والمطابقة مجاناً، وبعدهما نقول لك بالأرقام أيّها يخصّك —
            كم جهة من جهاتك تطلب هذا بالضبط — وأيّها لا يعنيك فلا نعرضه عليك.
          </p>
          {diagnosed.map((cat) => (
            <div key={cat.label} className="sv-cat">
              <div className="sv-cat-h"><b>{cat.label}</b><span>{cat.note}</span></div>
              <div className="sv-grid">
                {cat.items.map((t) => <Card key={t} title={t} />)}
              </div>
            </div>
          ))}
        </section>

        <div className="sv-final">
          <h2>ولا تحتاجها كلها</h2>
          <p>
            التقييم مجاني ويأخذ دقائق، ويعطيك درجتك وما يمنع قبولك بالضبط. وبعده تعرف أيّ خدمة تخصّك —
            ولا نبيعك ما لا ينفعك.
          </p>
          <Link href="/test">ابدأ التقييم المجاني</Link>
        </div>

        <p className="sv-foot">
          الأسعار أعلاه لا تشمل ضريبة القيمة المضافة. وأتعاب النجاح — حيث ذُكرت — لا تُدفع إلا بعد وصول التمويل إلى حسابك.
          <br />شركة حلول المرضي للاستشارات المالية · سجل تجاري 7039663724 · الرياض
        </p>
      </div>
    </div>
  );
}
