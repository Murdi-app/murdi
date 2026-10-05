'use client'
// خطأ في الهيكل الجذري نفسه — بالعربية (شكوى عميل، ٥ أكتوبر)
export default function GlobalError({ unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  return (
    <html lang="ar" dir="rtl">
      <body style={{ margin: 0, fontFamily: 'Tahoma, Arial, sans-serif', color: '#1A3D34', textAlign: 'center', padding: '80px 16px' }}>
        <h1 style={{ fontSize: 20 }}>حدث خطأ غير متوقع</h1>
        <p style={{ color: '#6B8A80' }}>أعد المحاولة، وإن تكرّر فراسلنا على واتساب 0570749196.</p>
        <button onClick={() => unstable_retry()} style={{ background: '#1A3D34', color: '#fff', padding: '11px 26px', borderRadius: 10, border: 0, cursor: 'pointer' }}>أعد المحاولة</button>
      </body>
    </html>
  )
}
