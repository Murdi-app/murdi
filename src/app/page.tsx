'use client'

import { useRouter } from 'next/navigation'
import MiniAssessment from '@/components/MiniAssessment'
import ServicesBand from '@/components/ServicesBand'

export default function Home() {
  const router = useRouter()
  const go = () => router.push('/auth/signup')
  const PHONE = '0570314005'
  const WHATSAPP = '966570314005'

  const paths = [
    { k: 'تمويل', d: 'نقيس جاهزيتك، نكشف ما يمنع قبولك، ونفتح الباب المناسب من بين جهات تمويل محلية وخليجية ودولية — بالمنتج الذي يناسب حالتك لا بالجهة وحدها.' },
    { k: 'استثمار', d: 'نجهّز ملفك، ونُبرز جاذبية شركتك، ونصلك بالشريك أو المستثمر المناسب لمرحلتك — من داخل المملكة وخارجها.' },
    { k: 'طرح', d: 'نقيس جاهزيتك للإدراج، ونرسم خارطة طريق من وضعك الحالي حتى السوق المناسبة، مع مرافقة كاملة.' },
  ]

  const steps = [
    { n: '01', t: 'افتح ملفك', d: 'سجّل بيانات منشأتك في دقائق.' },
    { n: '02', t: 'حدّد هدفك', d: 'تمويل أو استثمار أو طرح — لكل هدف أسئلته.' },
    { n: '03', t: 'اعرف جاهزيتك', d: 'درجة دقيقة، والعوائق، وخطة رفعها.' },
    { n: '04', t: 'نفتح لك الطريق', d: 'نطابقك بالجهات، ونجهّز ملفك ونرفعه إليها، ونتابع الرد.' },
  ]

  const opens = [
    { t: 'مطابقة على مستوى المنتج', d: 'البنك الواحد يطرح منتجات مختلفة، وقد تُرفض في واحد وتُقبل في آخر. نطابقك بالمنتج الصحيح لا بالاسم.' },
    { t: 'ملف مكتوب لكل جهة', d: 'نجهّز ملفك بمعايير كل جهة — المبلغ والغرض ومصدر السداد — ونرفعه إليها ونتابع الرد.' },
    { t: 'مرافقة حتى الرد', d: 'نبقى معك في كل خطوة حتى تصلك إجابة الجهة، وندعمك في استكمال ما تطلبه منك.' },
    { t: 'لا تدفع قبل أن تعرف', d: 'التقييم والمطابقة مجاناً. تعرف أين تقف وكم جهة تنطبق شروطها عليك قبل أن يُطلب منك ريال واحد.' },
  ]

  const score = [
    { t: 'تحليل أرقامك الفعلية', d: 'كل جانب مالي وتشغيلي يُقاس ويُوزن وفق منهجية مدروسة، لا انطباعات.' },
    { t: 'مقارنة بمعايير قطاعك', d: 'نضع وضعك مقابل معايير السوق السعودي لتعرف فجوتك بدقة.' },
    { t: 'العوائق ثم الطريق', d: 'الدرجة بداية لا نهاية — يتبعها ما يمنعك، وكيف يُغلق كل عائق.' },
  ]

  const testimonials = [
    { name: 'أبو سلطان', role: 'صاحب منشأة مقاولات — الرياض', quote: 'وصلت لمُرضي وأنا تائه بين البنوك. خلال أسابيع عرفت بالضبط وين الخلل في ملفي، وصلّحته، وحصلت على التمويل. شغل احترافي ومنهجية واضحة.' },
    { name: 'م. ريم', role: 'مديرة شركة تقنية ناشئة', quote: 'الفرق إنهم ما يبيعونك وهم. قالوا لي بصراحة وين أقف، وش ينقصني للمستثمر، ورافقوني خطوة بخطوة حتى جهّزنا الملف. أنصح بهم بقوة.' },
    { name: 'أبو فيصل', role: 'صاحب مصنع أغذية — المنطقة الشرقية', quote: 'التقييم دقيق جداً وكشف لي أشياء ما كنت منتبه لها في وضعي المالي. د. عبدالحكيم وفريقه على مستوى عالٍ من المهنية والصدق.' },
  ]

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700&display=swap');
        :root{
          --ink:#1A3D34; --deep:#122C26; --gold:#C9A84C; --gold-soft:#E4CE93;
          --paper:#FFFFFF; --mist:#F4F7F6; --line:#E3EAE7; --muted:#6B8A80;
        }
        *{box-sizing:border-box;margin:0;padding:0}
        .lp{font-family:'IBM Plex Sans Arabic',sans-serif;background:var(--paper);color:var(--ink);direction:rtl;overflow-x:hidden;-webkit-font-smoothing:antialiased}
        .lp h1,.lp h2,.lp h3,.lp .disp{font-family:'Tajawal',sans-serif;font-weight:900;letter-spacing:-.01em}
        .lp a{color:inherit}
        .eyebrow{font-size:11.5px;font-weight:600;letter-spacing:.16em;color:var(--gold);text-transform:uppercase}

        .bar{background:var(--deep);color:#9FB6AE;font-size:12px;text-align:center;padding:8px 16px;letter-spacing:.02em}
        .bar b{color:#fff;font-weight:600}
        .nav{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:14px 28px;background:#fff;border-bottom:1px solid var(--line);position:sticky;top:0;z-index:90}
        .logo{font-family:'Tajawal';font-size:24px;font-weight:900;color:var(--ink)}
        .logo i{font-style:normal;font-size:12px;font-weight:500;color:var(--muted);letter-spacing:.14em;margin-inline-start:7px}
        .nav-r{display:flex;align-items:center;gap:14px}
        .nav-tel{font-size:14px;font-weight:600;text-decoration:none;color:var(--ink);white-space:nowrap}
        .nav-btn{background:none;border:1.5px solid var(--line);color:var(--ink);padding:9px 20px;border-radius:2px;font-family:'IBM Plex Sans Arabic';font-weight:600;font-size:13.5px;cursor:pointer;transition:.18s}
        .nav-btn:hover{border-color:var(--ink)}

        .hero{background:var(--ink);color:#fff;padding:clamp(44px,7vw,80px) 20px clamp(48px,7vw,76px)}
        .hero-in{max-width:960px;margin:0 auto;text-align:center;display:flex;flex-direction:column}
        .idx{max-width:440px;margin:0 auto clamp(30px,5vw,44px)}
        .idx-num{font-family:'Tajawal';font-weight:900;color:var(--gold);font-size:clamp(64px,14vw,104px);line-height:.95;margin:12px 0 4px}
        .idx-num span{font-size:clamp(18px,3.5vw,26px);color:var(--gold-soft);font-weight:500}
        .idx-track{position:relative;height:2px;background:rgba(255,255,255,.16);margin:20px 0 8px}
        .idx-fill{position:absolute;right:0;top:0;height:100%;width:43%;background:var(--gold)}
        .idx-dot{position:absolute;right:43%;top:50%;transform:translate(50%,-50%);width:9px;height:9px;border-radius:50%;background:var(--gold);box-shadow:0 0 0 5px rgba(201,168,76,.22)}
        .idx-sc{display:flex;justify-content:space-between;font-size:11px;color:#7E9A92;letter-spacing:.08em}
        .idx-cap{color:#B9CDC6;font-size:13.5px;line-height:1.9;margin-top:14px}
        .idx-link{display:inline-block;margin-top:8px;color:var(--gold);font-size:13px;font-weight:600;text-decoration:none;border-bottom:1px solid rgba(201,168,76,.35);padding-bottom:2px}

        .hero h1{font-size:clamp(27px,5.4vw,46px);line-height:1.35;margin-bottom:16px}
        .hero h1 em{font-style:normal;color:var(--gold)}
        .hero-sub{color:#C2D5CE;font-size:clamp(14.5px,2.2vw,17px);line-height:2;max-width:620px;margin:0 auto 26px}
        .cta{background:var(--gold);color:var(--deep);border:none;padding:16px 40px;border-radius:2px;font-family:'Tajawal';font-size:16px;font-weight:900;cursor:pointer;transition:.18s}
        .cta:hover{background:#D9BA63}
        .cta-note{color:#8FA9A1;font-size:12.5px;line-height:1.9;margin-top:14px;max-width:520px;margin-inline:auto}
        .chip{order:1;align-self:center;border:1px solid rgba(255,255,255,.18);color:#8FA9A1;font-size:11.5px;padding:6px 14px;border-radius:2px;margin:20px auto 0}

        .sec{max-width:1080px;margin:0 auto;padding:clamp(48px,7vw,80px) 20px}
        .sec-head{max-width:640px;margin:0 auto clamp(28px,4vw,44px);text-align:center}
        .sec-head h2{font-size:clamp(23px,4vw,34px);line-height:1.4;margin:10px 0 10px}
        .sec-head p{color:var(--muted);font-size:15px;line-height:1.95}
        .rule{width:38px;height:2px;background:var(--gold);margin:0 auto}

        .grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--line);border:1px solid var(--line)}
        .cell{background:#fff;padding:30px 26px}
        .cell h3{font-size:19px;margin-bottom:10px}
        .cell p{color:var(--muted);font-size:14px;line-height:1.95}
        .cell-k{font-family:'Tajawal';font-weight:900;font-size:22px;color:var(--ink);margin-bottom:12px;padding-bottom:12px;border-bottom:2px solid var(--gold);display:inline-block}

        .steps{display:grid;grid-template-columns:repeat(4,1fr);gap:26px}
        .step{border-top:1px solid var(--line);padding-top:14px}
        .step-n{font-family:'Tajawal';font-weight:900;font-size:15px;color:var(--gold);letter-spacing:.1em;margin-bottom:8px}
        .step h3{font-size:17px;margin-bottom:7px}
        .step p{color:var(--muted);font-size:13.5px;line-height:1.9}

        .mist{background:var(--mist)}
        .grid2{display:grid;grid-template-columns:repeat(2,1fr);gap:22px}
        .card{background:#fff;border:1px solid var(--line);padding:26px 24px}
        .card h3{font-size:17px;margin-bottom:9px}
        .card p{color:var(--muted);font-size:14px;line-height:1.95}

        .adv{background:var(--deep);color:#fff}
        .adv-in{max-width:820px;margin:0 auto;padding:clamp(46px,7vw,72px) 20px;text-align:center}
        .adv-name{font-family:'Tajawal';font-weight:900;font-size:clamp(21px,3.6vw,29px);margin:14px 0 8px}
        .adv-role{color:var(--gold);font-size:14px;font-weight:600;margin-bottom:20px}
        .adv-txt{color:#BDD1CA;font-size:15px;line-height:2.1;max-width:640px;margin:0 auto 22px}
        .adv-lic{display:inline-block;border:1px solid rgba(255,255,255,.18);padding:9px 18px;font-size:12.5px;color:#DCE8E4;border-radius:2px}

        .tst{display:grid;grid-template-columns:repeat(3,1fr);gap:22px}
        .tst-c{background:#fff;border:1px solid var(--line);border-top:3px solid var(--gold);padding:28px 24px}
        .tst-q{color:#33473F;font-size:14.5px;line-height:2.05;margin-bottom:20px}
        .tst-n{font-family:'Tajawal';font-weight:900;font-size:15.5px}
        .tst-r{color:var(--muted);font-size:12.5px;margin-top:3px}

        .legal{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--line);border:1px solid var(--line)}
        .legal-c{background:#fff;padding:24px}
        .legal-l{font-size:11.5px;color:var(--muted);letter-spacing:.1em;margin-bottom:6px}
        .legal-v{font-family:'Tajawal';font-weight:700;font-size:15px;line-height:1.7}

        .final{background:var(--ink);text-align:center;padding:clamp(50px,7vw,76px) 20px}
        .final h2{color:#fff;font-size:clamp(23px,4vw,33px);margin-bottom:12px}
        .final p{color:#B9CDC6;font-size:15px;margin-bottom:26px}

        .ft{background:var(--deep);color:#8FA9A1;padding:44px 20px 24px;font-size:13px}
        .ft-in{max-width:1000px;margin:0 auto;display:grid;grid-template-columns:repeat(4,1fr);gap:26px}
        .ft h4{color:#fff;font-family:'Tajawal';font-size:14px;margin-bottom:12px}
        .ft p,.ft a{line-height:2.1;text-decoration:none;color:#8FA9A1}
        .ft a:hover{color:var(--gold)}
        .ft-logo{font-family:'Tajawal';font-weight:900;font-size:20px;color:#fff;margin-bottom:10px}
        .ft-b{max-width:1000px;margin:26px auto 0;padding-top:18px;border-top:1px solid rgba(255,255,255,.08);text-align:center;font-size:11.5px;color:#65837B}
        .ft-cta{display:inline-block;border:1px solid rgba(201,168,76,.4);color:var(--gold);padding:9px 18px;border-radius:2px;margin-top:6px;font-weight:600}

        .lp-mini{background:var(--mist);padding:clamp(44px,6vw,66px) 20px}
        .lp-mini-inner{max-width:620px;margin:0 auto;text-align:center}
        .lp-mini-badge{display:inline-block;border:1px solid var(--gold);color:var(--gold);font-weight:600;font-size:11.5px;letter-spacing:.14em;padding:6px 14px;border-radius:2px;margin-bottom:16px}
        .lp-mini h2{font-family:'Tajawal';font-size:clamp(23px,4vw,32px);font-weight:900;color:var(--ink);margin:0 0 10px}
        .lp-mini-sub{color:var(--muted);font-size:15px;margin:0 0 26px;line-height:1.9}
        .lp-mini-card{background:#fff;border:1px solid var(--line);border-radius:2px;padding:30px 24px;text-align:right}
        .lp-mini-progress{height:2px;background:var(--line);overflow:hidden;margin-bottom:20px}
        .lp-mini-bar{height:100%;background:var(--gold);transition:width .3s ease}
        .lp-mini-qnum{color:var(--gold);font-weight:600;font-size:12px;letter-spacing:.1em;margin-bottom:8px}
        .lp-mini-q{font-family:'Tajawal';font-size:20px;font-weight:900;color:var(--ink);margin:0 0 20px;line-height:1.6}
        .lp-mini-opts{display:grid;gap:10px}
        .lp-mini-opt{background:#fff;border:1px solid var(--line);color:var(--ink);padding:14px 18px;border-radius:2px;font-family:'IBM Plex Sans Arabic';font-weight:500;font-size:15px;cursor:pointer;text-align:right;transition:.15s}
        .lp-mini-opt:hover{border-color:var(--ink);background:var(--mist)}
        .lp-mini-score{font-family:'Tajawal';font-size:60px;font-weight:900;text-align:center;line-height:1;color:var(--ink)}
        .lp-mini-score span{font-size:22px;color:var(--muted)}
        .lp-mini-verdict{display:block;width:fit-content;margin:14px auto 18px;color:#fff;font-weight:600;font-size:14px;padding:7px 20px;border-radius:2px}
        .lp-mini-text{color:#3d524b;font-size:15px;line-height:1.9;text-align:center;margin:0 0 24px}
        .lp-mini-gate{border-top:1px solid var(--line);padding-top:22px}
        .lp-mini-gate-t{font-family:'Tajawal';font-weight:900;color:var(--ink);font-size:15px;margin:0 0 14px;text-align:center}
        .lp-mini-input{width:100%;border:1px solid var(--line);border-radius:2px;padding:13px 15px;font-family:'IBM Plex Sans Arabic';font-size:15px;margin-bottom:10px;text-align:right}
        .lp-mini-input:focus{outline:none;border-color:var(--ink)}
        .lp-mini-err{color:#B4453C;font-size:13.5px;font-weight:600;margin-bottom:10px;text-align:center}
        .lp-mini-submit{width:100%;background:var(--ink);color:#fff;border:none;padding:15px;border-radius:2px;font-family:'Tajawal';font-weight:900;font-size:16px;cursor:pointer}
        .lp-mini-submit:hover{background:var(--deep)}
        .lp-mini-submit:disabled{opacity:.55;cursor:default}
        .lp-mini-thanks{text-align:center}
        .lp-mini-check{width:54px;height:54px;line-height:54px;margin:0 auto 14px;background:var(--ink);color:#fff;font-size:26px;border-radius:50%}
        .lp-mini-thanks h3{font-family:'Tajawal';font-size:22px;color:var(--ink);margin:0 0 8px}
        .lp-mini-thanks-sub{color:var(--muted);font-size:15px;line-height:1.8;margin:0 0 24px}
        .lp-mini-benefits{display:grid;gap:12px;text-align:right;margin-bottom:24px}
        .lp-mini-benefit{display:flex;gap:14px;align-items:flex-start;background:var(--mist);border-radius:2px;padding:16px}
        .lp-mini-b-icon{font-size:22px;flex-shrink:0;color:var(--gold)}
        .lp-mini-benefit b{font-family:'Tajawal';color:var(--ink);font-size:15.5px;display:block;margin-bottom:4px}
        .lp-mini-benefit p{color:var(--muted);font-size:14px;line-height:1.8;margin:0}
        .lp-mini-register{width:100%;background:var(--gold);color:var(--deep);border:none;padding:16px;border-radius:2px;font-family:'Tajawal';font-weight:900;font-size:16.5px;cursor:pointer}
        .lp-mini-register:hover{background:#D9BA63}
        .lp-mini-note{color:var(--muted);font-size:12.5px;margin:12px 0 0}

        @media (max-width:900px){
          .grid3,.tst,.legal{grid-template-columns:1fr}
          .steps{grid-template-columns:repeat(2,1fr)}
          .ft-in{grid-template-columns:repeat(2,1fr)}
        }
        @media (max-width:620px){
          .nav{padding:12px 16px}
          .logo{font-size:20px}
          .nav-tel{display:none}
          .grid2,.steps,.ft-in{grid-template-columns:1fr}
          .sec{padding:40px 16px}
          .cell{padding:24px 20px}
          .cta{width:100%;padding:16px 20px}
          .bar{font-size:10.5px;padding:6px 10px;letter-spacing:0;line-height:1.5}
          .hero{padding:26px 16px 40px}
          .idx{margin-bottom:20px}
          .idx-num{font-size:56px;margin:6px 0 2px}
          .idx-num span{font-size:18px}
          .idx-track{margin:16px 0 6px}
          .idx-cap{font-size:12.5px;line-height:1.7;margin-top:10px}
          .hero h1{font-size:25px;line-height:1.42;margin-bottom:12px}
          .hero-sub{font-size:14px;line-height:1.85;margin-bottom:18px}
          .cta-note{font-size:11.5px;line-height:1.8;margin-top:10px}
        }
        @media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
      `}</style>

      <div className="lp">

        <div className="bar"><b>حلول المرضي للاستشارات المالية</b> · رخصة استشارة FL-457927015 · سجل تجاري 7039663724</div>

        <nav className="nav">
          <div className="logo">مُرضي <i>MURDI</i></div>
          <div className="nav-r">
            <a className="nav-tel" href={`tel:${PHONE}`}>{PHONE}</a>
            <button className="nav-btn" onClick={() => router.push('/auth/login')}>تسجيل الدخول</button>
          </div>
        </nav>

        <section className="hero">
          <div className="hero-in">
            <div className="idx">
              <div className="eyebrow">مؤشر مُرضي لجاهزية رأس المال</div>
              <div className="idx-num">43<span>/100</span></div>
              <div className="idx-track"><div className="idx-fill" /><div className="idx-dot" /></div>
              <div className="idx-sc"><span>0</span><span>100</span></div>
              <div className="idx-cap">متوسط جاهزية المنشآت السعودية التي قاستها مُرضي. أين تقف أنت؟</div>
              <a className="idx-link" href="/readiness-index">اقرأ التقرير الكامل ←</a>
            </div>

            <h1>ما يمنع الشركات عن رأس المال ليس نقص الفرص —<br /><em>بل نقص الجاهزية.</em></h1>
            <p className="hero-sub">نقيس أين تقف منشأتك بالضبط، ونكشف ما يمنع قبولها، ونجهّز ملفها — ثم نطابقها بالجهات الأقرب لقبولها ونرفع ملفها إليها ونتابع الرد.</p>
            <div className="chip">منصة استشارية لقياس وتجهيز الجاهزية — لا نمنح تمويلاً ولا نضمن نتيجة</div>
            <div><button className="cta" onClick={go}>افتح ملف شركتك — التقييم مجاني</button></div>
            <div className="cta-note">التقييم والمطابقة مجاناً. وبعدهما تختار: الفحص الائتماني السريع بـ 990 ر.س تعرف به جهاتك بأسمائها وما ينقصك عند كل واحدة، أو تجهيز الملف والمخاطبة والتفاوض بـ 7,900 ر.س ويُخصم منها الفحص. وأتعاب النجاح لا تُدفع إلا بعد صرف التمويل إلى حسابك.</div>
          </div>
        </section>

        <div id="mini-assessment"><MiniAssessment /></div>

        <section className="sec">
          <div className="sec-head">
            <div className="rule" />
            <h2>ثلاثة مسارات — اختر هدفك</h2>
            <p>لكل مسار محرك تقييم خاص، ومطابقة مع الجهات التي تناسب حالتك تحديداً.</p>
          </div>
          <div className="grid3">
            {paths.map(p => (
              <div className="cell" key={p.k} onClick={go} style={{ cursor: 'pointer' }}>
                <div className="cell-k">{p.k}</div>
                <p>{p.d}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="mist">
          <section className="sec">
            <div className="sec-head">
              <div className="rule" />
              <h2>كيف تعمل المنصة</h2>
              <p>أربع خطوات من التسجيل حتى فتح الأبواب.</p>
            </div>
            <div className="steps">
              {steps.map(s => (
                <div className="step" key={s.n}>
                  <div className="step-n">{s.n}</div>
                  <h3>{s.t}</h3>
                  <p>{s.d}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="sec">
          <div className="sec-head">
            <div className="rule" />
            <h2>ما تحصل عليه</h2>
            <p>تعرف كل خطوة وسعرها قبل أن تدفع ريالاً — وتختار ما يناسبك.</p>
          </div>
          <div className="grid2">
            {opens.map(o => (
              <div className="card" key={o.t}>
                <h3>{o.t}</h3>
                <p>{o.d}</p>
              </div>
            ))}
          </div>
        </section>

        <ServicesBand onStart={go} />

        <div className="mist">
          <section className="sec">
            <div className="sec-head">
              <div className="rule" />
              <h2>مُرضي سكور — رقم واحد يكشف أين تقف</h2>
              <p>ليس رقماً عشوائياً، بل خلاصة منهجية المستشار الدكتور عبدالحكيم المرضي، تقرأ أرقامك الفعلية وتقارنها بمعايير السوق السعودي.</p>
            </div>
            <div className="grid3">
              {score.map(s => (
                <div className="cell" key={s.t}>
                  <h3>{s.t}</h3>
                  <p>{s.d}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="adv">
          <div className="adv-in">
            <div className="eyebrow">المؤسس</div>
            <div className="adv-name">المستشار الدكتور عبدالحكيم المرضي</div>
            <div className="adv-role">مستشار مالي معتمد · دكتوراه في إدارة الأعمال · عضوية البورد الأمريكي</div>
            <p className="adv-txt">خمسة عشر عاماً في القطاع المالي، وشبكة علاقات محلية ودولية في التمويل والاستثمار — مبنية داخل كل تقييم تقدّمه المنصة. بنيتُ مُرضي لأضع هذه الخبرة بين يديك مباشرة: لا وعوداً، بل وضوحاً وطريقاً ومرافقة حتى تصل.</p>
            <div className="adv-lic">رخصة استشارة رقم FL-457927015</div>
          </div>
        </div>

        <section className="sec">
          <div className="sec-head">
            <div className="rule" />
            <h2>ماذا يقول عملاؤنا</h2>
            <p>منشآت اختارت أن تعرف أين تقف قبل أن تطرق الأبواب.</p>
          </div>
          <div className="tst">
            {testimonials.map(t => (
              <div className="tst-c" key={t.name}>
                <p className="tst-q">«{t.quote}»</p>
                <div className="tst-n">{t.name}</div>
                <div className="tst-r">{t.role}</div>
              </div>
            ))}
          </div>
        </section>

        <div className="mist">
          <section className="sec">
            <div className="sec-head">
              <div className="rule" />
              <h2>شركة سعودية موثّقة</h2>
              <p>تعرف مع من تتعامل، بالأرقام النظامية.</p>
            </div>
            <div className="legal">
              <div className="legal-c"><div className="legal-l">السجل التجاري</div><div className="legal-v">7039663724</div></div>
              <div className="legal-c"><div className="legal-l">رخصة الاستشارة المالية</div><div className="legal-v">FL-457927015</div></div>
              <div className="legal-c"><div className="legal-l">مقر الشركة</div><div className="legal-v">الرياض — حي الربيع، طريق الملك عبدالعزيز</div></div>
            </div>
          </section>
        </div>

        <div className="final">
          <h2>جاهز تعرف أين تقف شركتك؟</h2>
          <p>ابدأ التقييم المجاني الآن — تعرف درجتك وعوائقك قبل أن تدفع ريالاً.</p>
          <button className="cta" onClick={go}>افتح ملف شركتك</button>
        </div>

        <footer className="ft">
          <div className="ft-in">
            <div>
              <div className="ft-logo">مُرضي</div>
              <p>منصة جاهزية رأس المال<br />للمنشآت السعودية</p>
            </div>
            <div>
              <h4>تواصل معنا</h4>
              <p><a href={`tel:${PHONE}`}>{PHONE}</a><br />الرياض — حي الربيع<br />طريق الملك عبدالعزيز</p>
              <a className="ft-cta" href={`https://wa.me/${WHATSAPP}`} target="_blank" rel="noopener noreferrer">راسلنا على واتساب</a>
            </div>
            <div>
              <h4>بيانات نظامية</h4>
              <p>السجل التجاري 7039663724<br />رخصة الاستشارة FL-457927015</p>
            </div>
            <div>
              <h4>روابط</h4>
              <p><a href="/terms">الشروط والأحكام</a><br /><a href="/privacy">سياسة الخصوصية</a><br /><a href="/refund">سياسة الاسترجاع والإلغاء</a><br /><a href="/disclaimer">إخلاء المسؤولية</a><br /><a href="/readiness-index">مؤشر جاهزية رأس المال</a></p>
            </div>
          </div>
          <div className="ft-b">©️ 2026 مُرضي · حلول المرضي للاستشارات المالية · جميع الحقوق محفوظة</div>
        </footer>

      </div>
    </>
  )
}
