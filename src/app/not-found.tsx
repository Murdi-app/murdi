// صفحة «غير موجودة» بالعربية — كانت صفحة Next الافتراضية بالإنجليزية (شكوى عميل، ٥ أكتوبر)
export default function NotFound() {
  return (
    <main dir="rtl" style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 16px', fontFamily: "'IBM Plex Sans Arabic', Tajawal, sans-serif", color: '#1A3D34', textAlign: 'center' }}>
      <div>
        <div style={{ fontSize: 44, fontWeight: 900, color: '#C9A84C' }}>٤٠٤</div>
        <h1 style={{ fontSize: 20, fontWeight: 900, margin: '8px 0' }}>الصفحة غير موجودة</h1>
        <p style={{ color: '#6B8A80', fontSize: 14, lineHeight: 1.9, margin: '0 0 18px' }}>ربما تغيّر الرابط أو كُتب خطأً.</p>
        <a href="/" style={{ background: '#1A3D34', color: '#fff', padding: '11px 26px', borderRadius: 10, textDecoration: 'none', fontWeight: 700 }}>العودة إلى الرئيسية</a>
      </div>
    </main>
  )
}
