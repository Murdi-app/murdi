'use client'
// خطأ غير متوقع — بالعربية بدل رسالة Next الافتراضية (شكوى عميل، ٥ أكتوبر)
import { useEffect } from 'react'

export default function ErrorPage({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  useEffect(() => { console.error(error) }, [error])
  return (
    <main dir="rtl" style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 16px', fontFamily: "'IBM Plex Sans Arabic', Tajawal, sans-serif", color: '#1A3D34', textAlign: 'center' }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 900, margin: '0 0 8px' }}>حدث خطأ غير متوقع</h1>
        <p style={{ color: '#6B8A80', fontSize: 14, lineHeight: 1.9, margin: '0 0 18px' }}>أعد المحاولة، وإن تكرّر فراسلنا على واتساب 0570749196.</p>
        <button onClick={() => unstable_retry()} style={{ background: '#1A3D34', color: '#fff', padding: '11px 26px', borderRadius: 10, border: 0, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>أعد المحاولة</button>
      </div>
    </main>
  )
}
