'use client'
import { useRouter } from 'next/navigation'

const WA = 'https://wa.me/966570314005'

const included = [
  'تقييم جاهزية كامل في المسارات الثلاثة: التمويل، الاستثمار، الطرح',
  'ملف جاهزية رأس المال — يتطوّر معك ويقيس تقدّمك',
  'بطاقة عرض احترافية جاهزة تقدّمها لأي جهة تمويل أو مستثمر',
  'استشارة شهرية مع فريق د. عبدالحكيم المرضي طوال الاشتراك',
  'الرد على أسئلتك المالية عبر المنصة طوال المدة',
  'مقارنة شركتك بالسوق السعودي ومعايير القطاع',
  'خارطة تحسين عملية بخطوات وأولويات واضحة',
  'شهادة جاهزية رقمية تعزّز موقفك أمام الممولين',
]

const services = [
  { icon: '🏦', title: 'تجهيز ملف التمويل', desc: 'نُعد ملفك التمويلي الكامل بصورة تُقنع البنوك وجهات التمويل، ونرافقك حتى الحصول على التمويل المناسب.', fee: 'رسم تجهيز ثابت' },
  { icon: '📈', title: 'تجهيز ملف الاستثمار', desc: 'نبني ملف عرض المستثمر، نهيّئ الحوكمة والقوائم، ونوصلك بالجهات الاستثمارية المناسبة لشركتك.', fee: 'رسم تجهيز ثابت' },
  { icon: '🏛️', title: 'خدمات الطرح والإدراج', desc: 'خطة طرح تنفيذية كاملة، تجهيز ملف الهيئة، اختيار السوق الأنسب، بمرافقة حتى الإدراج.', fee: 'باقات بأسعار معلنة' },
]

export default function PricingPage() {
  const router = useRouter()
  return (
    <div className="pp">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&family=Amiri:wght@700&display=swap');
        .pp { font-family:'Cairo',sans-serif; direction:rtl; color:#1A3D34; background:#FBFCFB; min-height:100vh; }
        .pp-nav { display:flex; justify-content:space-between; align-items:center; padding:18px 32px; border-bottom:1px solid #EAF2EE; background:#fff; position:sticky; top:0; z-index:10; }
        .pp-brand { font-family:'Amiri',serif; font-size:26px; font-weight:700; color:#1A3D34; cursor:pointer; }
        .pp-nav-btns { display:flex; gap:10px; }
        .pp-btn-ghost { padding:9px 20px; border-radius:30px; border:1.5px solid #E8F5EF; background:transparent; color:#6B8A80; cursor:pointer; font-family:'Cairo'; font-weight:700; font-size:13px; }
        .pp-btn-gold { padding:9px 20px; border-radius:30px; border:none; background:#C9A84C; color:#1A3D34; cursor:pointer; font-family:'Cairo'; font-weight:900; font-size:13px; }
        .pp-wrap { max-width:880px; margin:0 auto; padding:56px 22px 80px; }
        .pp-head { text-align:center; margin-bottom:46px; }
        .pp-tag { display:inline-block; background:#F3F8F5; border:1px solid #DCEAE3; border-radius:30px; padding:7px 22px; color:#2E5D4E; font-size:13px; font-weight:700; margin-bottom:22px; }
        .pp-h1 { font-size:34px; font-weight:900; line-height:1.3; margin-bottom:14px; }
        .pp-h1 span { color:#C9A84C; }
        .pp-sub { color:#6B8A80; font-size:16px; font-weight:600; line-height:1.7; max-width:560px; margin:0 auto; }
        .pp-card { background:#fff; border-radius:28px; padding:42px 38px; border:2px solid #EAF2EE; box-shadow:0 18px 50px rgba(26,61,52,0.07); margin-bottom:46px; position:relative; overflow:hidden; }
        .pp-card-top { position:absolute; top:0; right:0; left:0; height:4px; background:linear-gradient(90deg,#C9A84C,#E0C475); }
        .pp-price-row { display:flex; align-items:baseline; gap:12px; justify-content:center; margin-bottom:6px; }
        .pp-price { font-size:64px; font-weight:900; color:#1A3D34; line-height:1; }
        .pp-price-unit { color:#6B8A80; font-size:15px; font-weight:700; text-align:right; line-height:1.5; }
        .pp-period { text-align:center; color:#9DB3AB; font-size:14px; font-weight:600; margin-bottom:30px; }
        .pp-inc-title { font-weight:900; font-size:16px; margin-bottom:14px; color:#1A3D34; }
        .pp-inc { display:flex; gap:11px; align-items:flex-start; padding:10px 0; font-size:14.5px; font-weight:600; border-bottom:1px solid #F0F5F3; line-height:1.6; }
        .pp-inc:last-child { border-bottom:none; }
        .pp-inc i { color:#C9A84C; font-style:normal; flex-shrink:0; }
        .pp-cta { width:100%; padding:18px; border-radius:40px; border:none; background:#C9A84C; color:#1A3D34; font-family:'Cairo'; font-size:17px; font-weight:900; cursor:pointer; margin-top:28px; transition:transform .15s; }
        .pp-cta-sub { width:100%; padding:14px; border-radius:40px; border:1.5px solid #E8F5EF; background:transparent; color:#6B8A80; font-family:'Cairo'; font-size:14px; font-weight:700; cursor:pointer; margin-top:12px; }
        .pp-note { text-align:center; margin-top:16px; color:#9DB3AB; font-size:12.5px; font-weight:600; line-height:1.7; }
        .pp-sec-head { text-align:center; margin-bottom:30px; }
        .pp-sec-h2 { font-size:26px; font-weight:900; margin-bottom:10px; }
        .pp-sec-sub { color:#6B8A80; font-size:15px; font-weight:600; line-height:1.7; max-width:600px; margin:0 auto; }
        .pp-svc-grid { display:grid; grid-template-columns:1fr; gap:16px; margin-bottom:46px; }
        @media(min-width:720px){ .pp-svc-grid { grid-template-columns:repeat(3,1fr); } .pp-h1 { font-size:42px; } }
        .pp-svc { background:#fff; border-radius:20px; padding:28px 24px; border:1.5px solid #EAF2EE; text-align:center; }
        .pp-svc-icon { font-size:34px; margin-bottom:12px; }
        .pp-svc-title { font-weight:900; font-size:17px; margin-bottom:10px; }
        .pp-svc-desc { color:#6B8A80; font-size:13.5px; font-weight:600; line-height:1.75; margin-bottom:16px; }
        .pp-svc-fee { display:inline-block; background:#FBF5E8; border:1px solid #E8D9B5; border-radius:20px; padding:6px 16px; color:#9A7B2E; font-size:12.5px; font-weight:700; }
        .pp-final { background:linear-gradient(135deg,#1A3D34,#2E5D4E); border-radius:28px; padding:46px 38px; text-align:center; box-shadow:0 18px 50px rgba(26,61,52,0.22); }
        .pp-final-h { color:#fff; font-size:24px; font-weight:900; margin-bottom:10px; }
        .pp-final-sub { color:#C9D8D0; font-size:15px; font-weight:600; margin-bottom:26px; line-height:1.7; }
        .pp-final-cta { background:#C9A84C; color:#1A3D34; border:none; padding:16px 46px; border-radius:40px; font-family:'Cairo'; font-size:16px; font-weight:900; cursor:pointer; }
        .pp-foot { border-top:1px solid #EAF2EE; padding:24px; text-align:center; color:#9DB3AB; font-size:12.5px; font-weight:600; }
      `}</style>

      <div className="pp-nav">
        <div className="pp-brand" onClick={()=>router.push('/')}>مُرضي</div>
        <div className="pp-nav-btns">
          <button className="pp-btn-ghost" onClick={()=>router.push('/auth/login')}>دخول</button>
          <button className="pp-btn-gold" onClick={()=>router.push('/auth/signup')}>ابدأ الآن</button>
        </div>
      </div>

      <div className="pp-wrap">
        <div className="pp-head">
          <div className="pp-tag">اشتراك واحد — جاهزية رأس مالك في المسارات الثلاثة</div>
          <div className="pp-h1">تشخيص دقيق لشركتك.<br/><span>وطريق واضح لرأس المال.</span></div>
          <div className="pp-sub">مُرضي يكشف جاهزية شركتك للتمويل والاستثمار والطرح، ويرسم لك الطريق — ثم يرافقك فريق د. عبدالحكيم المرضي في التنفيذ حين تكون جاهزاً.</div>
        </div>

        <div className="pp-card">
          <div className="pp-card-top"/>
          <div className="pp-price-row">
            <div className="pp-price">2,900</div>
            <div className="pp-price-unit">ريال<br/>كل 4 أشهر</div>
          </div>
          <div className="pp-period">اشتراك ربعي — تقييمك يثبُت على آخر نتيجة طوال المدة</div>

          <div className="pp-inc-title">يشمل اشتراكك:</div>
          {included.map((f,i)=>(
            <div className="pp-inc" key={i}><i>✦</i><div>{f}</div></div>
          ))}

          <button className="pp-cta" onClick={()=>window.open(WA+'?text='+encodeURIComponent('السلام عليكم، أرغب في الاشتراك في مُرضي'),'_blank')}>اشترك الآن عبر واتساب</button>
          <button className="pp-cta-sub" onClick={()=>router.push('/auth/signup')}>جرّب التقييم أولاً — أنشئ حسابك</button>
          <div className="pp-note">يتجدّد الاشتراك كل 4 أشهر • تقييمك وملف جاهزيتك يبقى محفوظاً ويتحدّث مع كل تجديد</div>
        </div>

        <div className="pp-sec-head">
          <div className="pp-sec-h2">حين تكون جاهزاً — ننفّذ معك</div>
          <div className="pp-sec-sub">الاشتراك يكشف جاهزيتك ويجهّزك. وعند الحاجة، يتولّى فريق حلول المرضي تنفيذ خطتك عبر خدمات احترافية:</div>
        </div>

        <div className="pp-svc-grid">
          {services.map((s,i)=>(
            <div className="pp-svc" key={i}>
              <div className="pp-svc-icon">{s.icon}</div>
              <div className="pp-svc-title">{s.title}</div>
              <div className="pp-svc-desc">{s.desc}</div>
              <div className="pp-svc-fee">{s.fee}</div>
            </div>
          ))}
        </div>

        <div className="pp-final">
          <div className="pp-final-h">جاهز تعرف مكان شركتك من رأس المال؟</div>
          <div className="pp-final-sub">ابدأ تقييمك الآن — واكتشف مسارك الأنسب: تمويل، استثمار، أو طرح.</div>
          <button className="pp-final-cta" onClick={()=>router.push('/auth/signup')}>ابدأ التقييم الآن</button>
        </div>
      </div>

      <div className="pp-foot">مُرضي — منصة جاهزية رأس المال للشركات السعودية • د. عبدالحكيم المرضي ©️ 2026</div>
    </div>
  )
}
