'use client'

import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()
  const go = () => router.push('/auth/signup')
  const PHONE = '0570314005'
  const WHATSAPP = '966570314005'

  const paths = [
    {
      icon: '🏦', title: 'تمويل', tag: '',
      desc: 'كل أبواب التمويل المتاحة لمنشأتك.',
      detail: 'نقيس جاهزيتك، نكشف ما يمنع قبولك، ونفتح لك الباب المناسب من بين جهات تمويل محلية وعالمية — أياً كان احتياجك.',
    },
    {
      icon: '📈', title: 'استثمار', tag: '',
      desc: 'من المستثمر الفردي إلى الصناديق المؤسسية.',
      detail: 'نجهّز ملفك، نُبرز جاذبية شركتك، ونصلك بالشريك أو المستثمر المناسب لمرحلتك — من داخل المملكة وخارجها.',
    },
    {
      icon: '🏛️', title: 'طرح', tag: '',
      desc: 'طريقك نحو الإدراج، خطوة بخطوة.',
      detail: 'نقيس جاهزيتك للطرح، ونرسم لك خارطة طريق واضحة من وضعك الحالي حتى الإدراج في السوق المناسبة، مع مرافقة كاملة.',
    },
  ]

  const steps = [
    { n: '1', t: 'افتح ملفك', d: 'سجّل بيانات شركتك واشترك لفتح ملفك المالي الكامل' },
    { n: '2', t: 'حدّد هدفك', d: 'تمويل، استثمار، أو طرح — أسئلة دقيقة مصمّمة لهدفك' },
    { n: '3', t: 'اعرف جاهزيتك', d: 'درجة جاهزية، العوائق، وخطة تحسين واضحة' },
    { n: '4', t: 'نفتح لك الطريق', d: 'نطابقك مع الجهات المناسبة وفريقنا يتولّى التواصل' },
  ]

  const companion = [
    { icon: '⚡', t: 'نجهّز ملفك في أيام', d: 'بدل شهور من المحاولة والرفض، نعدّ ملفك المالي جاهزاً للتقديم بسرعة واحترافية — ونختصر عليك الطريق.' },
    { icon: '🎯', t: 'الجهات الأقرب لك', d: 'لا نضيّع وقتك على أبواب لا تناسبك — نحدّد الجهات الأقرب لقبولك محلياً وعالمياً، ونوجّهك إليها مباشرة.' },
    { icon: '🚪', t: 'ثلاثة مسارات مفتوحة', d: 'تمويل، استثمار، وطرح — كلها متاحة لك طوال اشتراكك. انطلق في أيٍّ منها متى شئت، وفريق مُرضي معك في كل خطوة.' },
    { icon: '🧠', t: 'ذاكرة لا تنساك', d: 'مُرضي يتذكّر كل تفاصيل شركتك وتاريخها — فكل استشارة تبني على ما قبلها، ولا تبدأ من الصفر أبداً.' },
  ]

  const reasons = [
    { t: 'وضوح قبل أي خطوة', d: 'تعرف أين تقف شركتك بالضبط قبل أن تطرق أي باب' },
    { t: 'منهجية د. عبدالحكيم المرضي', d: '15 سنة خبرة مالية وعضوية البورد الأمريكي مبنية داخل كل تقييم' },
    { t: 'شبكة جهات حقيقية', d: 'علاقات مباشرة مع جهات تمويل واستثمار معتمدة محلياً وعالمياً' },
    { t: 'لا وعود فارغة', d: 'لا نمنحك تمويلاً ولا نعدك باستثمار — نريك الطريق ونفتحه معك' },
  ]

  const testimonials = [
    { name: 'أبو سلطان', role: 'صاحب منشأة مقاولات — الرياض', quote: 'وصلت لمُرضي وأنا تائه بين البنوك. خلال أسابيع عرفت بالضبط وين الخلل في ملفي، وصلّحته، وحصلت على التمويل. شغل احترافي ومنهجية واضحة.' },
    { name: 'م. ريم', role: 'مديرة شركة تقنية ناشئة', quote: 'الفرق إنهم ما يبيعونك وهم. قالوا لي بصراحة وين أقف، وش ينقصني للمستثمر، ورافقوني خطوة بخطوة حتى جهّزنا الملف. أنصح بهم بقوة.' },
    { name: 'أبو فيصل', role: 'صاحب مصنع أغذية — المنطقة الشرقية', quote: 'التقييم دقيق جداً وكشف لي أشياء ما كنت منتبه لها في وضعي المالي. د. عبدالحكيم وفريقه على مستوى عالٍ من المهنية والصدق.' },
  ]

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; }
        .lp { font-family:'Cairo',sans-serif; background:#FBFCFB; color:#1A3D34; direction:rtl; overflow-x:hidden; }
        .lp-nav { display:flex; justify-content:space-between; align-items:center; padding:16px 32px; background:#fff; border-bottom:1px solid #EAF2EE; position:sticky; top:0; z-index:100; flex-wrap:wrap; gap:10px; }
        .lp-logo { font-size:26px; font-weight:900; color:#2E9E7B; }
        .lp-logo span { color:#1A3D34; font-size:15px; font-weight:700; }
        .lp-nav-right { display:flex; align-items:center; gap:12px; flex-wrap:wrap; }
        .lp-nav-phone { display:flex; align-items:center; gap:7px; color:#1A3D34; font-weight:800; font-size:14.5px; text-decoration:none; }
        .lp-nav-phone:hover { color:#2E9E7B; }
        .lp-login { background:transparent; color:#1A3D34; border:1.5px solid #E8F5EF; padding:9px 22px; border-radius:30px; font-family:'Cairo'; font-weight:700; font-size:14px; cursor:pointer; }
        .lp-login:hover { border-color:#2E9E7B; color:#2E9E7B; }
        .lp-trust-bar { background:linear-gradient(135deg,#1A3D34,#2E5E50); color:#fff; text-align:center; padding:9px 20px; font-size:13px; font-weight:600; display:flex; justify-content:center; align-items:center; gap:18px; flex-wrap:wrap; }
        .lp-trust-bar span { display:inline-flex; align-items:center; gap:6px; }
        .lp-hero { text-align:center; padding:64px 20px 50px; max-width:880px; margin:0 auto; }
        .lp-badge { display:inline-block; background:#E8F5EF; color:#2E9E7B; padding:8px 20px; border-radius:30px; font-size:13px; font-weight:800; margin-bottom:22px; }
        .lp-h1 { font-size:40px; font-weight:900; line-height:1.4; margin-bottom:20px; color:#1A3D34; }
        .lp-h1 em { color:#2E9E7B; font-style:normal; }
        .lp-pain { color:#C0564B; font-size:17px; font-weight:800; line-height:1.8; max-width:640px; margin:0 auto 14px; }
        .lp-sub { color:#5B7068; font-size:17px; line-height:2; max-width:680px; margin:0 auto 16px; }
        .lp-global { display:inline-flex; align-items:center; gap:8px; background:#FBF3DC; color:#9A7B2E; padding:9px 22px; border-radius:30px; font-size:14px; font-weight:800; margin-bottom:26px; }
        .lp-cta { background:linear-gradient(135deg,#2E9E7B,#7DD3B0); color:#fff; border:none; padding:17px 52px; border-radius:40px; font-family:'Cairo',sans-serif; font-size:17px; font-weight:900; cursor:pointer; box-shadow:0 10px 28px rgba(46,158,123,0.32); transition:transform .15s; display:block; margin:0 auto; }
        .lp-cta:hover { transform:translateY(-2px); }
        .lp-cta-sub { color:#A3BAB2; font-size:12.5px; margin-top:12px; }
        .lp-section { max-width:1100px; margin:0 auto; padding:56px 20px; }
        .lp-sec-title { text-align:center; font-size:30px; font-weight:900; color:#1A3D34; margin-bottom:10px; }
        .lp-sec-sub { text-align:center; color:#5B7068; font-size:16px; margin-bottom:42px; }
        .lp-paths { display:grid; grid-template-columns:repeat(3,1fr); gap:22px; }
        .lp-path { position:relative; background:#fff; border:1.5px solid #EAF2EE; border-radius:20px; padding:32px 26px; cursor:pointer; transition:all .2s; }
        .lp-path:hover { border-color:#2E9E7B; transform:translateY(-4px); box-shadow:0 14px 36px rgba(46,158,123,0.13); }
        .lp-path-tag { position:absolute; top:-11px; right:24px; background:#C9A84C; color:#fff; padding:4px 14px; border-radius:20px; font-size:11.5px; font-weight:900; }
        .lp-path-icon { font-size:42px; margin-bottom:14px; }
        .lp-path-title { font-size:23px; font-weight:900; color:#1A3D34; margin-bottom:10px; }
        .lp-path-desc { color:#1A3D34; font-size:14px; font-weight:700; line-height:1.7; margin-bottom:10px; }
        .lp-path-detail { color:#6B8A80; font-size:13px; line-height:1.85; }
        .lp-steps { display:grid; grid-template-columns:repeat(4,1fr); gap:20px; }
        .lp-step { text-align:center; padding:10px; }
        .lp-step-n { width:52px; height:52px; line-height:52px; border-radius:50%; background:linear-gradient(135deg,#2E9E7B,#7DD3B0); color:#fff; font-size:22px; font-weight:900; margin:0 auto 16px; }
        .lp-step-t { font-size:17px; font-weight:900; color:#1A3D34; margin-bottom:7px; }
        .lp-step-d { color:#6B8A80; font-size:13.5px; line-height:1.75; }
        .lp-companion-wrap { background:linear-gradient(135deg,#F0F7F4,#E8F5EF); }
        .lp-companion { display:grid; grid-template-columns:repeat(4,1fr); gap:20px; }
        .lp-comp-item { background:#fff; border-radius:18px; padding:26px 22px; text-align:center; }
        .lp-comp-icon { font-size:34px; margin-bottom:12px; }
        .lp-comp-t { font-size:16px; font-weight:900; color:#1A3D34; margin-bottom:8px; }
        .lp-comp-d { color:#6B8A80; font-size:13px; line-height:1.8; }
        .lp-why { display:grid; grid-template-columns:repeat(2,1fr); gap:18px; max-width:880px; margin:0 auto; }
        .lp-why-item { background:#fff; border:1.5px solid #EAF2EE; border-radius:16px; padding:24px 26px; }
        .lp-why-t { font-size:17px; font-weight:900; color:#2E9E7B; margin-bottom:8px; }
        .lp-why-d { color:#5B7068; font-size:14px; line-height:1.8; }
        .lp-advisor-wrap { background:#1A3D34; }
        .lp-advisor { max-width:900px; margin:0 auto; padding:56px 20px; display:flex; gap:32px; align-items:center; flex-wrap:wrap; justify-content:center; }
        .lp-advisor-photo { width:130px; height:130px; border-radius:50%; background:linear-gradient(135deg,#2E9E7B,#7DD3B0); display:flex; align-items:center; justify-content:center; font-size:54px; flex-shrink:0; }
        .lp-advisor-body { flex:1; min-width:280px; }
        .lp-advisor-name { color:#fff; font-size:25px; font-weight:900; margin-bottom:6px; }
        .lp-advisor-title { color:#7DD3B0; font-size:15px; font-weight:700; margin-bottom:14px; }
        .lp-advisor-desc { color:#C5D8D1; font-size:14.5px; line-height:2; margin-bottom:14px; }
        .lp-advisor-lic { display:inline-block; background:rgba(255,255,255,0.1); color:#fff; padding:8px 18px; border-radius:30px; font-size:13px; font-weight:700; }
        .lp-tst { display:grid; grid-template-columns:repeat(3,1fr); gap:22px; }
        .lp-tst-card { background:#fff; border:1.5px solid #EAF2EE; border-radius:18px; padding:28px 24px; }
        .lp-tst-stars { color:#C9A84C; font-size:16px; margin-bottom:12px; letter-spacing:2px; }
        .lp-tst-quote { color:#3A4D47; font-size:14px; line-height:2; margin-bottom:18px; }
        .lp-tst-name { font-size:15px; font-weight:900; color:#1A3D34; }
        .lp-tst-role { color:#9DB3AB; font-size:12.5px; margin-top:2px; }
        .lp-cred-wrap { background:#F0F7F4; }
        .lp-cred { max-width:1000px; margin:0 auto; padding:50px 20px; }
        .lp-cred-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:18px; margin-top:8px; }
        .lp-cred-item { background:#fff; border-radius:14px; padding:22px; display:flex; gap:14px; align-items:flex-start; }
        .lp-cred-icon { font-size:26px; flex-shrink:0; }
        .lp-cred-label { font-size:12.5px; color:#9DB3AB; font-weight:700; margin-bottom:3px; }
        .lp-cred-val { font-size:14.5px; color:#1A3D34; font-weight:800; line-height:1.6; }
        .lp-support { max-width:760px; margin:0 auto; padding:50px 20px; text-align:center; }
        .lp-support-icon { font-size:46px; margin-bottom:14px; }
        .lp-support h2 { font-size:27px; font-weight:900; color:#1A3D34; margin-bottom:10px; }
        .lp-support p { color:#5B7068; font-size:15.5px; line-height:1.9; margin-bottom:24px; }
        .lp-support-btns { display:flex; gap:14px; justify-content:center; flex-wrap:wrap; }
        .lp-btn-wa { background:#25D366; color:#fff; text-decoration:none; padding:14px 32px; border-radius:40px; font-weight:900; font-size:15px; display:inline-flex; align-items:center; gap:9px; }
        .lp-btn-call { background:#1A3D34; color:#fff; text-decoration:none; padding:14px 32px; border-radius:40px; font-weight:900; font-size:15px; display:inline-flex; align-items:center; gap:9px; }
        .lp-final { background:linear-gradient(135deg,#2E9E7B,#1A3D34); text-align:center; padding:60px 20px; }
        .lp-final h2 { color:#fff; font-size:30px; font-weight:900; margin-bottom:14px; }
        .lp-final p { color:#D5EBE3; font-size:16px; margin-bottom:28px; }
        .lp-final-cta { background:#fff; color:#1A3D34; border:none; padding:17px 50px; border-radius:40px; font-family:'Cairo'; font-size:17px; font-weight:900; cursor:pointer; }
        .lp-footer { background:#13302A; color:#9DB3AB; padding:40px 20px 28px; }
        .lp-footer-inner { max-width:1000px; margin:0 auto; display:flex; justify-content:space-between; gap:28px; flex-wrap:wrap; }
        .lp-footer-logo { font-size:22px; font-weight:900; color:#2E9E7B; margin-bottom:10px; }
        .lp-footer-col h4 { color:#fff; font-size:14px; margin-bottom:12px; font-weight:800; }
        .lp-footer-col p { font-size:13px; line-height:2; }
        .lp-footer-bottom { max-width:1000px; margin:26px auto 0; padding-top:20px; border-top:1px solid rgba(255,255,255,0.1); text-align:center; font-size:12px; color:#6B8A80; }
        @media (max-width:860px) {
          .lp-h1 { font-size:30px; }
          .lp-paths, .lp-steps, .lp-companion, .lp-why, .lp-tst { grid-template-columns:1fr; }
          .lp-sec-title { font-size:24px; }
          .lp-nav { padding:14px 18px; }
        }
      `}</style>

      <div className="lp">

        <div className="lp-trust-bar">
          <span>🛡️ منصة سعودية مصرّحة</span>
          <span>💳 دفع إلكتروني آمن</span>
          <span>🌍 جهات محلية وعالمية</span>
          <span>📞 دعم ٢٤ ساعة</span>
        </div>

        <nav className="lp-nav">
          <div className="lp-logo">مُرضي <span>Murdi</span></div>
          <div className="lp-nav-right">
            <a className="lp-nav-phone" href={`tel:${PHONE}`}>📞 {PHONE}</a>
            <button className="lp-login" onClick={() => router.push('/auth/login')}>تسجيل الدخول</button>
          </div>
        </nav>

        <section className="lp-hero">
          <div className="lp-badge">منصة جاهزية رأس المال الأولى في السعودية</div>
          <h1 className="lp-h1">شركتك تستحق <em>تمويلاً، استثماراً، أو طرحاً</em><br/>لكن هل هي جاهزة؟</h1>
          <p className="lp-pain">تعِبت من رفض الجهات؟ تائه بين الأبواب؟ لا تعرف أين الخلل في ملفك؟</p>
          <p className="lp-sub">
            مرضي يكشف لك أين تقف شركتك بالضبط، وما الذي يمنعها، ويجهّز ملفك في أيام —
            ثم يوصلك بالجهات الأقرب لقبولك محلياً وعالمياً، ويرافقك حتى تفتح الباب.
          </p>
          <div className="lp-global">🌍 تمويل واستثمار بمعايير نظامية — جهات محلية وعالمية</div>
          <button className="lp-cta" onClick={go}>افتح ملف شركتك الآن</button>
          <div className="lp-cta-sub">اشتراك 2,900 ر.س لكل أربعة أشهر — يشمل التقييم الكامل والمرافقة</div>
        </section>

        <section className="lp-section">
          <h2 className="lp-sec-title">اختر هدفك — والباقي علينا</h2>
          <p className="lp-sec-sub">ثلاثة مسارات، لكل مسار محرك تقييم خاص ومطابقة مع الجهات المناسبة</p>
          <div className="lp-paths">
            {paths.map(p => (
              <div className="lp-path" key={p.title} onClick={go}>
                {p.tag && <span className="lp-path-tag">{p.tag}</span>}
                <div className="lp-path-icon">{p.icon}</div>
                <div className="lp-path-title">{p.title}</div>
                <div className="lp-path-desc">{p.desc}</div>
                <div className="lp-path-detail">{p.detail}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="lp-section">
          <h2 className="lp-sec-title">كيف تعمل المنصة؟</h2>
          <p className="lp-sec-sub">أربع خطوات من التسجيل حتى فتح الأبواب</p>
          <div className="lp-steps">
            {steps.map(s => (
              <div className="lp-step" key={s.n}>
                <div className="lp-step-n">{s.n}</div>
                <div className="lp-step-t">{s.t}</div>
                <div className="lp-step-d">{s.d}</div>
              </div>
            ))}
          </div>
        </section>

        <div className="lp-companion-wrap">
          <section className="lp-section">
            <h2 className="lp-sec-title">اشتراك واحد… يفتح لك كل الأبواب</h2>
            <p className="lp-sec-sub">تدفع مرة، فتحصل على تقييم دقيق وخارطة طريق واستشارة و٣ مسارات شغّالة طوال اشتراكك — وفريق مُرضي يجهّز ملفك ويختصر طريقك</p>
            <div className="lp-companion">
              {companion.map(c => (
                <div className="lp-comp-item" key={c.t}>
                  <div className="lp-comp-icon">{c.icon}</div>
                  <div className="lp-comp-t">{c.t}</div>
                  <div className="lp-comp-d">{c.d}</div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="lp-section">
          <h2 className="lp-sec-title">لماذا مُرضي؟</h2>
          <p className="lp-sec-sub">منصة بُنيت على خبرة حقيقية وعلاقات حقيقية</p>
          <div className="lp-why">
            {reasons.map(r => (
              <div className="lp-why-item" key={r.t}>
                <div className="lp-why-t">{r.t}</div>
                <div className="lp-why-d">{r.d}</div>
              </div>
            ))}
          </div>
        </section>

        <div className="lp-advisor-wrap">
          <div className="lp-advisor">
            <div className="lp-advisor-photo">👨‍💼</div>
            <div className="lp-advisor-body">
              <div className="lp-advisor-name">د. عبدالحكيم المرضي</div>
              <div className="lp-advisor-title">مؤسس مُرضي · مستشار مالي معتمد</div>
              <div className="lp-advisor-desc">
                خمسة عشر عاماً من الخبرة في القطاع المالي، وعضوية البورد الأمريكي، مبنية داخل كل تقييم تقدّمه المنصة.
                بنيتُ مُرضي لأضع خبرتي بين يديك مباشرة — لا وعوداً، بل وضوحاً وطريقاً ومرافقة حتى تصل.
              </div>
              <div className="lp-advisor-lic">🪪 رخصة استشارة رقم: FL-457927015</div>
            </div>
          </div>
        </div>

        <section className="lp-section">
          <h2 className="lp-sec-title">ماذا يقول عملاؤنا؟</h2>
          <p className="lp-sec-sub">نتائج حقيقية لمنشآت اختارت أن تعرف أين تقف</p>
          <div className="lp-tst">
            {testimonials.map(t => (
              <div className="lp-tst-card" key={t.name}>
                <div className="lp-tst-stars">★★★★★</div>
                <div className="lp-tst-quote">"{t.quote}"</div>
                <div className="lp-tst-name">{t.name}</div>
                <div className="lp-tst-role">{t.role}</div>
              </div>
            ))}
          </div>
        </section>

        <div className="lp-cred-wrap">
          <div className="lp-cred">
            <h2 className="lp-sec-title">منصة مصرّحة وموثوقة</h2>
            <p className="lp-sec-sub">شفافية كاملة — تعرف مع من تتعامل</p>
            <div className="lp-cred-grid">
              <div className="lp-cred-item">
                <div className="lp-cred-icon">🏢</div>
                <div><div className="lp-cred-label">السجل التجاري</div><div className="lp-cred-val">7039663724</div></div>
              </div>
              <div className="lp-cred-item">
                <div className="lp-cred-icon">🪪</div>
                <div><div className="lp-cred-label">رخصة الاستشارة المالية</div><div className="lp-cred-val">FL-457927015</div></div>
              </div>
              <div className="lp-cred-item">
                <div className="lp-cred-icon">📍</div>
                <div><div className="lp-cred-label">مقر الشركة</div><div className="lp-cred-val">الرياض — حي الربيع، طريق الملك عبدالعزيز، قرب مدارس المملكة</div></div>
              </div>
              <div className="lp-cred-item">
                <div className="lp-cred-icon">💳</div>
                <div><div className="lp-cred-label">الدفع الإلكتروني</div><div className="lp-cred-val">دفع آمن عبر بوابة ميسر المرخّصة من ساما</div></div>
              </div>
            </div>
          </div>
        </div>

        <section className="lp-support">
          <div className="lp-support-icon">💬</div>
          <h2>خدمة عملاء على مدار الساعة</h2>
          <p>فريق مُرضي جاهز للإجابة على استفساراتك في أي وقت — قبل اشتراكك وبعده. تواصل معنا مباشرة:</p>
          <div className="lp-support-btns">
            <a className="lp-btn-wa" href={`https://wa.me/${WHATSAPP}`} target="_blank" rel="noopener noreferrer">💚 واتساب</a>
            <a className="lp-btn-call" href={`tel:${PHONE}`}>📞 {PHONE}</a>
          </div>
        </section>

        <div className="lp-final">
          <h2>جاهز تعرف أين تقف شركتك؟</h2>
          <p>افتح ملفك اليوم، ودع مُرضي يرافقك حتى تصل</p>
          <button className="lp-final-cta" onClick={go}>افتح ملف شركتك الآن</button>
        </div>

        <footer className="lp-footer">
          <div className="lp-footer-inner">
            <div className="lp-footer-col">
              <div className="lp-footer-logo">مُرضي Murdi</div>
              <p>منصة جاهزية رأس المال<br/>للمنشآت السعودية</p>
            </div>
            <div className="lp-footer-col">
              <h4>تواصل معنا</h4>
              <p>📞 {PHONE}<br/>📍 الرياض — حي الربيع<br/>طريق الملك عبدالعزيز</p>
            </div>
            <div className="lp-footer-col">
              <h4>بيانات نظامية</h4>
              <p>السجل التجاري: 7039663724<br/>رخصة الاستشارة: FL-457927015<br/>💳 دفع إلكتروني مصرّح</p>
            </div>
          </div>
          <div className="lp-footer-bottom">
            ©️ 2026 مُرضي · حلول المرضي للاستشارات المالية · جميع الحقوق محفوظة
          </div>
        </footer>

      </div>
    </>
  )
}
