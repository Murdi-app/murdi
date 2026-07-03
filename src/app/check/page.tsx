import MiniAssessment from '@/components/MiniAssessment';

export const metadata = {
  title: 'قِس جاهزية شركتك — منصة مُرضي',
  description: 'اعرف جاهزية شركتك للحصول على رأس المال خلال دقيقتين — مجاناً وبلا تسجيل.',
};

const NAVY = '#13302A';
const GOLD = '#C9A24B';

const sectors = [
  { name: 'التجزئة والتجارة', score: 38 },
  { name: 'المقاولات والإنشاءات', score: 34 },
  { name: 'الصناعة والتصنيع', score: 47 },
  { name: 'التقنية والمنصات', score: 52 },
  { name: 'الأغذية والمشروبات', score: 41 },
  { name: 'الخدمات المهنية', score: 44 },
];

export default function CheckPage() {
  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: '#f7f7f4' }}>

      {/* المقطع الأول: الصدمة والرقم */}
      <section style={{ background: NAVY, padding: '52px 20px 46px', textAlign: 'center' }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <span style={{ color: GOLD, fontWeight: 800, fontSize: 17, letterSpacing: 1 }}>مُرضي</span>
          <h1 style={{ color: '#fff', fontSize: 30, lineHeight: 1.6, margin: '18px 0 12px' }}>
            جهة التمويل ما ترفض شركتك، والمستثمر ما يعتذر،<br />لأن نشاطك ضعيف — بل لأنها <span style={{ color: GOLD }}>غير جاهزة</span>
          </h1>
          <p style={{ color: '#cfd6e4', fontSize: 16.5, lineHeight: 1.9, margin: '0 0 26px' }}>
            وفق مؤشر مُرضي لجاهزية رأس المال، متوسط جاهزية الشركات السعودية:
          </p>
          <div style={{ color: GOLD, fontSize: 66, fontWeight: 800, lineHeight: 1 }}>43<span style={{ fontSize: 26, color: '#cfd6e4' }}> / 100</span></div>
          <p style={{ color: '#cfd6e4', fontSize: 15, marginTop: 10 }}>أي أن أكثر من نصف الشركات لو تقدّمت اليوم للتمويل أو الاستثمار… تُرفض.</p>
          <a href="/#mini-assessment" style={{ display: 'inline-block', marginTop: 26, background: GOLD, color: NAVY, fontWeight: 800, fontSize: 17, padding: '15px 40px', borderRadius: 99, textDecoration: 'none' }}>قِس جاهزية شركتك الآن — مجاناً ←</a>
          <p style={{ color: '#8fa39a', fontSize: 13, marginTop: 12 }}>دقيقتان · ثماني أسئلة · بلا تسجيل</p>
        </div>
      </section>

      {/* المقطع الثالث: التقييم نفسه */}
      <section id="assess" style={{ padding: '10px 16px 30px', maxWidth: 760, margin: '0 auto' }}>
        <h2 style={{ color: NAVY, fontSize: 24, textAlign: 'center', marginBottom: 6 }}>حان دورك — قِس جاهزية شركتك</h2>
        <p style={{ color: '#666', fontSize: 15, textAlign: 'center', marginBottom: 18 }}>نتيجتك فورية: سكور من 100 + تصنيف وضعك الحالي</p>
        <MiniAssessment />
      </section>

      {/* المقطع الثاني: القطاعات — البرهان */}
      <section style={{ padding: '44px 20px', maxWidth: 760, margin: '0 auto' }}>
        <h2 style={{ color: NAVY, fontSize: 22, textAlign: 'center', marginBottom: 22 }}>الجاهزية حسب القطاع — وين شركتك من هذي الأرقام؟</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {sectors.map((s) => (
            <div key={s.name} style={{ background: '#fff', borderRadius: 10, padding: '13px 18px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
                <strong style={{ color: NAVY, fontSize: 15 }}>{s.name}</strong>
                <strong style={{ color: GOLD, fontSize: 15 }}>{s.score} / 100</strong>
              </div>
              <div style={{ background: '#e8e6df', borderRadius: 99, height: 8, overflow: 'hidden' }}>
                <div style={{ width: `${s.score}%`, background: `linear-gradient(90deg, ${NAVY}, ${GOLD})`, height: '100%' }} />
              </div>
            </div>
          ))}
        </div>
        <p style={{ textAlign: 'center', fontSize: 13.5, marginTop: 14 }}>
          <a href="/readiness-index" style={{ color: '#888' }}>المصدر: مؤشر مُرضي لجاهزية رأس المال — اقرأ التقرير الكامل</a>
        </p>
      </section>

      {/* المقطع الرابع: الخطوة التالية */}
      <section style={{ background: NAVY, padding: '42px 20px', textAlign: 'center' }}>
        <div style={{ maxWidth: 700, margin: '0 auto' }}>
          <h2 style={{ color: '#fff', fontSize: 23, lineHeight: 1.6, marginBottom: 12 }}>سكورك مجرد البداية — الجاهزية الكاملة رحلة نرافقك فيها</h2>
          <p style={{ color: '#cfd6e4', fontSize: 15.5, lineHeight: 1.9, marginBottom: 24 }}>
            في منصة مُرضي: تقييم شامل لمسارك (تمويل، استثمار، أو طرح)، خطة تحسين عملية،
            ملف احترافي بلغتين، ومخاطبة الجهات المناسبة — بمنهجية د. عبدالحكيم المرضي وخبرة 15 عاماً في السوق السعودي.
          </p>
          <a href="/" style={{ display: 'inline-block', background: GOLD, color: NAVY, fontWeight: 800, fontSize: 17, padding: '15px 42px', borderRadius: 99, textDecoration: 'none' }}>افتح ملف شركتك في مُرضي ←</a>
          <p style={{ color: '#8fa39a', fontSize: 13.5, marginTop: 14 }}>حلول المرضي للاستشارات المالية — شركة سعودية مرخّصة</p>
        </div>
      </section>

    </div>
  );
}
