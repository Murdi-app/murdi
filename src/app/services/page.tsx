'use client'
import { useRouter } from 'next/navigation'

const WA = 'https://wa.me/966570314005'

function waLink(service: string) {
  const msg = 'السلام عليكم، أنهيت تقييمي في منصة مُرضي وأرغب بمعرفة تفاصيل خدمة: ' + service
  return WA + '?text=' + encodeURIComponent(msg)
}

const categories = [
  {
    label: 'خدمات أساسية',
    note: 'تخدم المسارات الثلاثة — أساس أي جاهزية مالية',
    items: [
      { icon: '📊', title: 'إعداد القوائم المالية المعتمدة', desc: 'نُعدّ قوائمك المالية وفق المعايير المحاسبية المعتمدة، جاهزةً للعرض على الممولين والمستثمرين والجهات الرقابية.' },
      { icon: '🏛️', title: 'بناء الحوكمة المؤسسية', desc: 'نؤسس لوائح الحوكمة ومجلس الإدارة واللجان، ونفصل الملكية عن الإدارة لترتقي شركتك لمستوى مؤسسي.' },
      { icon: '💎', title: 'التقييم العادل المعمق', desc: 'نقدّر قيمة شركتك بمنهجية تقييم متكاملة تعتمد على أرقامك وقطاعك، لتتفاوض من موقع قوة.' },
      { icon: '🔧', title: 'إعادة الهيكلة المالية ومعالجة التعثّر', desc: 'نعيد جدولة الديون، نوقف النزيف النقدي، ونستعيد انتظام السداد لنمهّد لتعافٍ حقيقي.' },
    ],
  },
  {
    label: 'مسار التمويل',
    note: 'للوصول إلى التمويل المناسب بأفضل الشروط',
    items: [
      { icon: '🏦', title: 'تجهيز ملف التمويل والتفاوض مع الجهات', desc: 'نُعدّ ملفك التمويلي بصورة تُقنع البنوك وجهات التمويل، ونرافقك في التفاوض حتى الحصول على التمويل.' },
      { icon: '🗓️', title: 'إعادة جدولة الديون', desc: 'نُعيد ترتيب التزاماتك القائمة بما يخفّف الضغط النقدي ويحسّن قدرتك على السداد.' },
    ],
  },
  {
    label: 'مسار الاستثمار',
    note: 'لجعل شركتك جاذبة للمستثمر المناسب',
    items: [
      { icon: '📈', title: 'تجهيز ملف عرض المستثمر', desc: 'نبني ملف العرض (Pitch) الذي يُبرز قيمة شركتك ويطمئن المستثمر المؤسسي.' },
      { icon: '🎯', title: 'بناء خطة جذب المستثمر', desc: 'نضع خطة عملية ترفع جاذبية شركتك وتجهّزها للعرض على الجهات الاستثمارية المناسبة.' },
    ],
  },
  {
    label: 'مسار الطرح والإدراج',
    note: 'الطريق المؤسسي نحو السوق المالية',
    items: [
      { icon: '📁', title: 'تجهيز ملف هيئة السوق المالية', desc: 'نُعدّ ملف الطرح الكامل وفق متطلبات الهيئة، خطوةً بخطوة، بمرافقة المستشار المالي المرخّص.' },
      { icon: '⚖️', title: 'تشكيل لجنة المراجعة والحوكمة', desc: 'نؤسس اللجان والهياكل التي يتطلبها الإدراج، ونضمن توافقها مع لوائح الهيئة.' },
      { icon: '🗺️', title: 'خارطة طريق الإدراج', desc: 'خطة تنفيذية مرحلية بالمدد والمتطلبات، تقودك من وضعك الحالي حتى لحظة الإدراج.' },
    ],
  },
]

export default function ServicesPage() {
  const router = useRouter()
  return (
    <div className="sv">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&family=Amiri:wght@700&display=swap');
        .sv { font-family:'Cairo',sans-serif; direction:rtl; color:#1A3D34; background:#FBFCFB; min-height:100vh; }
        .sv-nav { display:flex; justify-content:space-between; align-items:center; padding:18px 32px; border-bottom:1px solid #EAF2EE; background:#fff; position:sticky; top:0; z-index:10; }
        .sv-brand { font-family:'Amiri',serif; font-size:26px; font-weight:700; color:#1A3D34; cursor:pointer; }
        .sv-nav-btns { display:flex; gap:10px; }
        .sv-btn-ghost { padding:9px 20px; border-radius:30px; border:1.5px solid #E8F5EF; background:transparent; color:#6B8A80; cursor:pointer; font-family:'Cairo'; font-weight:700; font-size:13px; }
        .sv-btn-gold { padding:9px 20px; border-radius:30px; border:none; background:#C9A84C; color:#1A3D34; cursor:pointer; font-family:'Cairo'; font-weight:900; font-size:13px; }
        .sv-wrap { max-width:980px; margin:0 auto; padding:56px 22px 80px; }
        .sv-head { text-align:center; margin-bottom:50px; }
        .sv-tag { display:inline-block; background:#F3F8F5; border:1px solid #DCEAE3; border-radius:30px; padding:7px 22px; color:#2E5D4E; font-size:13px; font-weight:700; margin-bottom:22px; }
        .sv-h1 { font-size:34px; font-weight:900; line-height:1.3; margin-bottom:14px; }
        .sv-h1 span { color:#C9A84C; }
        .sv-sub { color:#6B8A80; font-size:16px; font-weight:600; line-height:1.7; max-width:600px; margin:0 auto; }
        .sv-cat { margin-bottom:46px; }
        .sv-cat-head { display:flex; align-items:baseline; gap:12px; margin-bottom:6px; border-bottom:2px solid #EAF2EE; padding-bottom:12px; }
        .sv-cat-label { font-size:22px; font-weight:900; color:#1A3D34; }
        .sv-cat-note { color:#9DB3AB; font-size:13.5px; font-weight:600; }
        .sv-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-top:20px; }
        .sv-item { background:#fff; border-radius:22px; padding:26px 24px; border:2px solid #EAF2EE; box-shadow:0 10px 30px rgba(26,61,52,0.05); display:flex; flex-direction:column; }
        .sv-item-icon { font-size:30px; margin-bottom:12px; }
        .sv-item-title { font-size:17px; font-weight:900; color:#1A3D34; margin-bottom:8px; line-height:1.4; }
        .sv-item-desc { color:#6B8A80; font-size:14px; font-weight:600; line-height:1.7; flex:1; margin-bottom:18px; }
        .sv-item-cta { display:inline-block; text-align:center; padding:11px 18px; border-radius:30px; background:#1A3D34; color:#fff; font-family:'Cairo'; font-weight:900; font-size:13.5px; text-decoration:none; transition:opacity .15s; }
        .sv-item-cta:hover { opacity:.9; }
        .sv-foot { background:linear-gradient(135deg,#1A3D34,#2E5D4E); border-radius:28px; padding:42px 34px; text-align:center; margin-top:20px; }
        .sv-foot-h { font-size:23px; font-weight:900; color:#fff; margin-bottom:10px; }
        .sv-foot-p { color:#D8E8E0; font-size:15px; font-weight:600; line-height:1.8; max-width:520px; margin:0 auto 24px; }
        .sv-foot-cta { display:inline-block; padding:15px 38px; border-radius:40px; background:#C9A84C; color:#1A3D34; font-family:'Cairo'; font-weight:900; font-size:16px; text-decoration:none; }
        @media(max-width:680px){ .sv-grid{grid-template-columns:1fr;} .sv-nav{padding:14px 18px;} .sv-h1{font-size:27px;} }
      `}</style>

      <nav className="sv-nav">
        <div className="sv-brand" onClick={() => router.push('/')}>مُرضي</div>
        <div className="sv-nav-btns">
          <button className="sv-btn-ghost" onClick={() => router.push('/goal')}>مركزي</button>
          <button className="sv-btn-gold" onClick={() => router.push('/pricing')}>الاشتراك</button>
        </div>
      </nav>

      <div className="sv-wrap">
        <div className="sv-head">
          <div className="sv-tag">خدمات حلول المرضي للاستشارات المالية</div>
          <h1 className="sv-h1">من التوصية إلى <span>التنفيذ</span></h1>
          <p className="sv-sub">منصة مُرضي تكشف لك ما تحتاجه شركتك. وفريق د. عبدالحكيم المرضي ينفّذه معك — خطوةً بخطوة، بخبرة ميدانية في التمويل والاستثمار والطرح.</p>
        </div>

        {categories.map((cat, ci) => (
          <div className="sv-cat" key={ci}>
            <div className="sv-cat-head">
              <span className="sv-cat-label">{cat.label}</span>
              <span className="sv-cat-note">{cat.note}</span>
            </div>
            <div className="sv-grid">
              {cat.items.map((it, ii) => (
                <div className="sv-item" key={ii}>
                  <div className="sv-item-icon">{it.icon}</div>
                  <div className="sv-item-title">{it.title}</div>
                  <div className="sv-item-desc">{it.desc}</div>
                  <a className="sv-item-cta" href={waLink(it.title)} target="_blank" rel="noopener noreferrer">تواصل لمعرفة التفاصيل ←</a>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="sv-foot">
          <div className="sv-foot-h">لست متأكداً من أين تبدأ؟</div>
          <div className="sv-foot-p">ابدأ بتقييم جاهزيتك في المنصة، ثم احجز استشارتك المجانية مع فريق مُرضي — نحدّد معك الأولوية والخطوة الأنسب لشركتك.</div>
          <a className="sv-foot-cta" href={WA} target="_blank" rel="noopener noreferrer">احجز استشارتك المجانية ←</a>
        </div>
      </div>
    </div>
  )
}
