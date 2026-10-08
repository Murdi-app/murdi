'use client'

import { useEffect, useState } from 'react'
import { currentLang, setLang, type Lang } from '@/lib/i18n/lang'

// زر اللغة: يُعرض باللغة الأخرى دائماً — «English» في العربي، و«عربي» في الإنجليزي.
// data-no-i18n حتى لا يترجم المترجمُ كلمةَ «عربي» نفسها.
export default function LangToggle({ className, style }: { className?: string; style?: React.CSSProperties }) {
  const [lang, setL] = useState<Lang>('ar')
  useEffect(() => { setL(currentLang()) }, [])
  return (
    <button
      type="button"
      data-no-i18n
      onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
      className={className}
      aria-label={lang === 'en' ? 'التبديل إلى العربية' : 'Switch to English'}
      style={{
        border: '1px solid #D9E5DF', background: '#fff', color: '#1A3D34', borderRadius: 999,
        padding: '6px 14px', fontWeight: 800, fontSize: 13, cursor: 'pointer', lineHeight: 1.2,
        fontFamily: lang === 'en' ? 'Tajawal, Cairo, sans-serif' : 'inherit', direction: lang === 'en' ? 'rtl' : 'ltr', ...style,
      }}
    >
      {lang === 'en' ? 'عربي' : 'English'}
    </button>
  )
}
