export const metadata = { title: 'مؤشر مُرضي لجاهزية رأس المال' };

const NAVY = '#0A1F44';
const GOLD = '#C9A24B';

const sectors = [
  { name: 'التجزئة والتجارة', score: 38, note: 'ضعف فصل الذمة المالية وغياب القوائم المدققة' },
  { name: 'المقاولات والإنشاءات', score: 34, note: 'تعثر التدفق النقدي وغياب حوكمة المشاريع' },
  { name: 'الصناعة والتصنيع', score: 47, note: 'أصول قوية يقابلها ضعف في هيكلة البيانات المالية' },
  { name: 'التقنية والمنصات', score: 52, note: 'نمو جيد مع فجوة في الحوكمة وجاهزية الإفصاح' },
  { name: 'الأغذية والمشروبات', score: 41, note: 'ربحية تشغيلية دون توثيق مالي يؤهل للتمويل' },
  { name: 'الخدمات المهنية', score: 44, note: 'اعتماد مفرط على المؤسس وغياب مجالس استشارية' },
];

const overall = 43;

export default function ReadinessIndex() {
  return (
    <div dir="rtl" style={{ fontFamily: 'inherit', background: '#f7f7f4', minHeight: '100vh', padding: '48px 20px' }}>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>

        <p style={{ color: GOLD, fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>إصدار الربع الثالث ٢٠٢٦</p>
        <h1 style={{ color: NAVY, fontSize: 34, lineHeight: 1.4, marginBottom: 12 }}>مؤشر مُرضي لجاهزية رأس المال في السعودية</h1>
        <p style={{ color: '#444', fontSize: 17, lineHeight: 1.9, marginBottom: 40 }}>
          قراءة ربع سنوية تصدرها منصة مُرضي لقياس مدى جاهزية المنشآت السعودية للوصول إلى رأس المال —
          تمويلاً واستثماراً وإدراجاً — وفق منهجية د. عبدالحكيم المرضي في جاهزية رأس المال.
        </p>

        <div style={{ background: NAVY, borderRadius: 16, padding: '36px 28px', textAlign: 'center', marginBottom: 40 }}>
          <p style={{ color: '#cfd6e4', fontSize: 16, marginBottom: 6 }}>متوسط الجاهزية العام للمنشآت السعودية</p>
          <div style={{ color: GOLD, fontSize: 64, fontWeight: 800 }}>{overall}<span style={{ fontSize: 26, color: '#cfd6e4' }}> / 100</span></div>
          <p style={{ color: '#cfd6e4', fontSize: 15, marginTop: 6 }}>أي أن أغلب المنشآت تقف اليوم خارج دائرة التأهل لرأس المال</p>
        </div>

        <h2 style={{ color: NAVY, fontSize: 24, marginBottom: 20 }}>الجاهزية حسب القطاع</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginBottom: 44 }}>
          {sectors.map((s) => (
            <div key={s.name} style={{ background: '#fff', borderRadius: 12, padding: '18px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <strong style={{ color: NAVY, fontSize: 16 }}>{s.name}</strong>
                <strong style={{ color: GOLD, fontSize: 16 }}>{s.score} / 100</strong>
              </div>
              <div style={{ background: '#e8e6df', borderRadius: 99, height: 10, overflow: 'hidden' }}>
                <div style={{ width: `${s.score}%`, background: `linear-gradient(90deg, ${NAVY}, ${GOLD})`, height: '100%' }} />
              </div>
              <p style={{ color: '#666', fontSize: 14, marginTop: 8, lineHeight: 1.8 }}>{s.note}</p>
            </div>
          ))}
        </div>

        <div style={{ background: '#fff', borderRight: `4px solid ${GOLD}`, borderRadius: 10, padding: '18px 20px', marginBottom: 44 }}>
          <strong style={{ color: NAVY }}>المنهجية:</strong>
          <p style={{ color: '#555', fontSize: 14.5, lineHeight: 1.9, marginTop: 6 }}>
            يعتمد هذا الإصدار على تقديرات تحليلية وفق منهجية مُرضي في قياس جاهزية رأس المال
            (القوائم المالية، الحوكمة، فصل الذمة، هيكل المديونية، قابلية النمو)، مستأنسة بالمؤشرات
            العامة المنشورة عن قطاع المنشآت الصغيرة والمتوسطة في السعودية. وسيتغذى المؤشر في
            إصداراته القادمة من بيانات التقييمات الفعلية على المنصة.
          </p>
        </div>

        <div style={{ textAlign: 'center', background: NAVY, borderRadius: 16, padding: '34px 24px' }}>
          <h3 style={{ color: '#fff', fontSize: 22, marginBottom: 10 }}>وأنت؟ كم جاهزية منشأتك؟</h3>
          <p style={{ color: '#cfd6e4', fontSize: 15, marginBottom: 20 }}>اعرف سكورك الآن في دقيقتين — مجاناً وبلا تسجيل</p>
          <a href="/#mini-assessment" style={{ background: GOLD, color: NAVY, fontWeight: 800, padding: '13px 34px', borderRadius: 99, textDecoration: 'none', fontSize: 16, display: 'inline-block' }}>قِس جاهزيتك الآن</a>
        </div>

      </div>
    </div>
  );
}
