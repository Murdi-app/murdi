'use client'

import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()
  const go = () => router.push('/auth/signup')

  const paths = [
    { icon: '🏦', title: 'تمويل', desc: 'رأس مال عامل، فواتير ومستخلصات، أصول، عقاري — نقيس جاهزيتك ونطابقك مع المنتج الصحيح', tag: 'الأكثر طلباً' },
    { icon: '📈', title: 'استثمار', desc: 'صناديق ومحافظ وملكية خاصة — نجهّز ملفك ونعرضك على الجهة المناسبة لمرحلتك', tag: '' },
    { icon: '🏛️', title: 'طرح', desc: 'السوق الرئيسية أو نمو — IPO Readiness Score وخارطة طريق كاملة حتى الإدراج', tag: '' },
  ]

  const steps = [
    { n: '1', t: 'افتح ملفك', d: 'سجّل بيانات شركتك وادفع رسوم فتح الملف' },
    { n: '2', t: 'حدّد هدفك', d: 'تمويل، استثمار، أو طرح — أسئلة دقيقة مصممة لهدفك' },
    { n: '3', t: 'اعرف جاهزيتك', d: 'درجة جاهزية، العوائق، وخطة تحسين واضحة' },
    { n: '4', t: 'نفتح لك الطريق', d: 'نطابقك مع الجهات المناسبة وفريقنا يتولى التواصل' },
  ]

  const reasons = [
    { t: 'وضوح قبل أي خطوة', d: 'تعرف أين تقف شركتك بالضبط قبل أن تطرق أي باب' },
    { t: 'منهجية د. عبدالحكيم المرضي', d: '15 سنة خبرة مالية وعضوية البورد الأمريكي مبنية داخل كل تقييم' },
    { t: 'شبكة جهات حقيقية', d: 'علاقات مباشرة مع جهات تمويل واستثمار سعودية معتمدة' },
    { t: 'لا وعود فارغة', d: 'لا نمنحك تمويلاً ولا نعدك باستثمار — نريك الطريق ونفتحه معك' },
  ]

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Cairo:wght@300;400;600;700;900&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; }
        body { background:#FBFCFB; }
        .lp { font-family:'Cairo',sans-serif; direction:rtl; color:#1A3D34; background:#FBFCFB; min-height:100vh; }
        .lp-nav { display:flex; justify-content:space-between; align-items:center; padding:20px 24px; max-width:1100px; margin:0 auto; }
        .lp-logo { font-family:'Amiri',serif; font-size:26px; font-weight:700; color:#1A3D34; }
        .lp-login { background:transparent; border:1.5px solid #2E9E7B; color:#2E9E7B; padding:9px 26px; border-radius:30px; font-family:'Cairo',sans-serif; font-size:14px; font-weight:700; cursor:pointer; }
        .lp-hero { text-align:center; padding:70px 20px 50px; max-width:820px; margin:0 auto; }
        .lp-badge { display:inline-block; background:#E8F5EF; color:#2E9E7B; font-size:13px; font-weight:700; padding:7px 20px; border-radius:30px; margin-bottom:22px; }
        .lp-h1 { font-family:'Amiri',serif; font-size:clamp(30px,5.5vw,48px); font-weight:700; line-height:1.45; margin-bottom:18px; }
        .lp-h1 em { color:#2E9E7B; font-style:normal; }
        .lp-sub { color:#6B8A80; font-size:clamp(15px,2.4vw,18px); line-height:1.9; margin-bottom:34px; }
        .lp-cta { background:linear-gradient(135deg,#2E9E7B,#7DD3B0); color:#fff; border:none; padding:17px 52px; border-radius:40px; font-family:'Cairo',sans-serif; font-size:17px; font-weight:900; cursor:pointer; box-shadow:0 10px 28px rgba(46,158,123,0.32); transition:transform .15s; }
        .lp-cta:hover { transform:translateY(-2px); }
        .lp-cta-sub { color:#A3BAB2; font-size:12.5px; margin-top:12px; }
        .lp-section { max-width:1100px; margin:0 auto; padding:55px 20px; }
        .lp-sec-title { font-family:'Amiri',serif; font-size:clamp(24px,4vw,32px); font-weight:700; text-align:center; margin-bottom:10px; }
        .lp-sec-sub { color:#6B8A80; font-size:15px; text-align:center; margin-bottom:40px; }
        .lp-paths { display:grid; grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); gap:20px; }
        .lp-path { background:#fff; border:1.5px solid #EAF1EE; border-radius:22px; padding:32px 26px; position:relative; box-shadow:0 4px 18px rgba(26,61,52,0.05); transition:transform .15s, border-color .15s; cursor:pointer; }
        .lp-path:hover { transform:translateY(-4px); border-color:#2E9E7B; }
        .lp-path-tag { position:absolute; top:-12px; right:22px; background:#C9A84C; color:#fff; font-size:11px; font-weight:700; padding:4px 14px; border-radius:20px; }
        .lp-path-icon { font-size:38px; margin-bottom:14px; }
        .lp-path-title { font-family:'Amiri',serif; font-size:23px; font-weight:700; margin-bottom:10px; }
        .lp-path-desc { color:#6B8A80; font-size:14px; line-height:1.85; }
        .lp-steps { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:18px; }
        .lp-step { background:#fff; border:1.5px solid #EAF1EE; border-radius:18px; padding:26px 22px; text-align:center; }
        .lp-step-n { width:44px; height:44px; border-radius:50%; background:linear-gradient(135deg,#2E9E7B,#7DD3B0); color:#fff; font-size:19px; font-weight:900; display:flex; align-items:center; justify-content:center; margin:0 auto 14px; }
        .lp-step-t { font-size:16px; font-weight:900; margin-bottom:8px; }
        .lp-step-d { color:#6B8A80; font-size:13.5px; line-height:1.8; }
        .lp-why { display:grid; grid-template-columns:repeat(auto-fit,minmax(240px,1fr)); gap:18px; }
        .lp-why-item { background:#E8F5EF; border-radius:18px; padding:26px 24px; }
        .lp-why-t { font-size:16px; font-weight:900; margin-bottom:8px; color:#1A3D34; }
        .lp-why-d { color:#41695D; font-size:14px; line-height:1.85; }
        .lp-consult { background:linear-gradient(135deg,#1A3D34,#2E5D4E); border-radius:28px; padding:48px 38px; max-width:920px; margin:0 auto; text-align:center; box-shadow:0 18px 50px rgba(26,61,52,0.22); }
        .lp-consult-badge { display:inline-block; background:rgba(201,168,76,0.18); color:#C9A84C; font-size:13px; font-weight:700; padding:7px 20px; border-radius:30px; margin-bottom:20px; }
        .lp-consult-t { font-family:'Amiri',serif; font-size:clamp(24px,4vw,34px); font-weight:700; color:#fff; line-height:1.5; margin-bottom:16px; }
        .lp-consult-d { color:#D8E8E0; font-size:clamp(14px,2.2vw,16.5px); line-height:2; margin-bottom:28px; }
        .lp-consult-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:16px; margin-bottom:30px; text-align:right; }
        .lp-consult-item { background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1); border-radius:16px; padding:20px; }
        .lp-consult-item-t { color:#C9A84C; font-size:15px; font-weight:900; margin-bottom:6px; }
        .lp-consult-item-d { color:#B8CEC5; font-size:13.5px; line-height:1.8; }
        .lp-consult-cta { background:#C9A84C; color:#1A3D34; border:none; padding:16px 48px; border-radius:40px; font-family:'Cairo',sans-serif; font-size:16px; font-weight:900; cursor:pointer; transition:transform .15s; }
        .lp-consult-cta:hover { transform:translateY(-2px); }
        .lp-price-card { background:#fff; border:2px solid #2E9E7B; border-radius:26px; padding:46px 34px; max-width:520px; margin:0 auto; text-align:center; box-shadow:0 14px 40px rgba(46,158,123,0.13); }
        .lp-price-label { color:#6B8A80; font-size:14px; font-weight:700; margin-bottom:8px; }
        .lp-price { font-family:'Amiri',serif; font-size:54px; font-weight:700; color:#2E9E7B; line-height:1; }
        .lp-price-unit { font-size:17px; color:#6B8A80; font-weight:600; }
        .lp-price-once { display:inline-block; background:#FBF5E8; color:#9A7B2E; font-size:12.5px; font-weight:700; padding:5px 16px; border-radius:20px; margin:14px 0 22px; }
        .lp-includes { text-align:right; margin-bottom:28px; }
        .lp-inc { display:flex; gap:10px; align-items:flex-start; padding:9px 0; color:#1A3D34; font-size:14.5px; font-weight:600; border-bottom:1px solid #F0F5F3; }
        .lp-inc:last-child { border-bottom:none; }
        .lp-inc-check { color:#2E9E7B; font-weight:900; }
        .lp-final { text-align:center; padding:70px 20px 90px; background:linear-gradient(180deg,#FBFCFB,#E8F5EF); }
        .lp-final-t { font-family:'Amiri',serif; font-size:clamp(24px,4vw,34px); font-weight:700; margin-bottom:14px; }
        .lp-final-d { color:#6B8A80; font-size:16px; margin-bottom:30px; }
        .lp-footer { text-align:center; padding:28px; color:#A3BAB2; font-size:12.5px; background:#E8F5EF; }
      `}</style>
      <div className="lp">

        <nav className="lp-nav">
          <div className="lp-logo">مُرضي Murdi</div>
          <button className="lp-login" onClick={() => router.push('/auth/login')}>تسجيل الدخول</button>
        </nav>

        <section className="lp-hero">
          <div className="lp-badge">منصة جاهزية رأس المال الأولى في السعودية</div>
          <h1 className="lp-h1">شركتك تستحق <em>تمويلاً، استثماراً، أو طرحاً</em><br/>لكن هل هي جاهزة؟</h1>
          <p className="lp-sub">
            لا نمنحك تمويلاً ولا نعدك باستثمار — نخبرك أين تقف شركتك بالضبط، وما الذي يمنعها،
            والطريق لتصبح جاهزة. ثم نطابقك مع الجهات المناسبة وفريقنا يفتح لك الباب.
          </p>
          <button className="lp-cta" onClick={go}>افتح ملف شركتك الآن</button>
          <div className="lp-cta-sub">رسوم فتح الملف 1,900 ر.س — مرة واحدة، تشمل التقييم الكامل</div>
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

        <section className="lp-section">
          <h2 className="lp-sec-title">استثمار واحد يفتح كل الأبواب</h2>
          <p className="lp-sec-sub">بدون اشتراكات شهرية — رسوم فتح ملف واحدة ورسوم نجاح عند إتمام الصفقة فقط</p>
          <div className="lp-price-card">
            <div className="lp-price-label">رسوم فتح الملف</div>
            <div className="lp-price">1,900 <span className="lp-price-unit">ر.س</span></div>
            <div className="lp-price-once">مرة واحدة فقط</div>
            <div className="lp-includes">
              <div className="lp-inc"><span className="lp-inc-check">✓</span> فتح ملف شركتك واختيار الهدف</div>
              <div className="lp-inc"><span className="lp-inc-check">✓</span> تقييم جاهزية كامل بمحرك متخصص لهدفك</div>
              <div className="lp-inc"><span className="lp-inc-check">✓</span> درجة الجاهزية والعوائق وخطة التحسين</div>
              <div className="lp-inc"><span className="lp-inc-check">✓</span> المطابقة مع الجهات المناسبة لملفك</div>
              <div className="lp-inc"><span className="lp-inc-check">✓</span> مراجعة أولية من فريق مُرضي</div>
            </div>
            <button className="lp-cta" style={{ width:'100%' }} onClick={go}>ابدأ الآن — افتح ملفك</button>
          </div>
        </section>

        <section className="lp-final">
          <h2 className="lp-final-t">كل يوم تأجيل، فرصة تفوتك</h2>
          <p className="lp-final-d">الجهات تمنح من هو جاهز — اعرف جاهزيتك اليوم</p>
          <button className="lp-cta" onClick={go}>افتح ملف شركتك الآن</button>
        </section>

        <footer className="lp-footer">
          مُرضي Murdi — منصة جاهزية رأس المال · شركة حلول المرضي للاستشارات المالية ©️ 2026
        </footer>

      </div>
    </>
  )
}
