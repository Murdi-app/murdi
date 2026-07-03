import MiniAssessment from '@/components/MiniAssessment';

export const metadata = {
  title: 'قِس جاهزية شركتك — منصة مُرضي',
  description: 'اعرف جاهزية شركتك للحصول على رأس المال خلال دقيقتين — مجاناً وبلا تسجيل.',
};

const NAVY = '#13302A';
const GOLD = '#C9A24B';

export default function CheckPage() {
  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: '#f7f7f4', padding: '40px 16px 70px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>

        <div style={{ textAlign: 'center', marginBottom: 26 }}>
          <a href="/" style={{ color: GOLD, fontWeight: 800, fontSize: 18, textDecoration: 'none', letterSpacing: 1 }}>مُرضي</a>
          <h1 style={{ color: NAVY, fontSize: 30, lineHeight: 1.5, margin: '14px 0 10px' }}>كم جاهزية شركتك للحصول على رأس المال؟</h1>
          <p style={{ color: '#555', fontSize: 16.5, lineHeight: 1.9, margin: 0 }}>
            متوسط جاهزية الشركات السعودية <strong style={{ color: GOLD }}>43 من 100</strong> —
            اعرف سكورك الآن خلال دقيقتين، مجاناً وبلا تسجيل.
          </p>
        </div>

        <MiniAssessment />

        <div style={{ display: 'flex', justifyContent: 'center', gap: 18, flexWrap: 'wrap', marginTop: 26, fontSize: 13.5, color: '#777' }}>
          <span>✓ ثماني أسئلة فقط</span>
          <span>✓ نتيجة فورية</span>
          <span>✓ وفق منهجية د. عبدالحكيم المرضي</span>
        </div>

        <p style={{ textAlign: 'center', marginTop: 22, fontSize: 13.5 }}>
          <a href="/readiness-index" style={{ color: NAVY, fontWeight: 700 }}>اقرأ مؤشر مُرضي الكامل لجاهزية الشركات السعودية ←</a>
        </p>

      </div>
    </div>
  );
}
