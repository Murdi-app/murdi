'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function UpdatePasswordPage() {
  const supabase = createClient()
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    const h = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const c = q.get('error_code') || h.get('error_code') || q.get('e')
    if (!c) return
    setError(c === 'otp_expired' || c === 'nocode'
      ? '\u0627\u0646\u062a\u0647\u062a \u0635\u0644\u0627\u062d\u064a\u0629 \u0627\u0644\u0631\u0627\u0628\u0637 \u0623\u0648 \u0627\u0633\u062a\u064f\u062e\u062f\u0645 \u0645\u0646 \u0642\u0628\u0644 \u2014 \u0627\u0637\u0644\u0628 \u0631\u0627\u0628\u0637\u0627\u064b \u062c\u062f\u064a\u062f\u0627\u064b.'
      : '\u062a\u0639\u0630\u0631 \u0627\u0644\u062a\u062d\u0642\u0642 \u0645\u0646 \u0627\u0644\u0631\u0627\u0628\u0637 \u2014 \u0627\u0637\u0644\u0628 \u0631\u0627\u0628\u0637\u0627\u064b \u062c\u062f\u064a\u062f\u0627\u064b.')
  }, [])


  async function handleUpdate() {
    if (!password) { setError('أدخل كلمة المرور'); return }
    if (password.length < 6) { setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل'); return }
    if (password !== confirm) { setError('كلمتا المرور غير متطابقتين'); return }

    setLoading(true)
    setError('')

    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setError('تعذر التحديث: ' + error.message)
    } else {
      setDone(true)
      setTimeout(() => router.push('/goal'), 2000)
    }
    setLoading(false)
  }

  return (
    <div style={{ minHeight:'100vh', background:'#1A3D34', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Cairo,sans-serif', direction:'rtl' }}>
      <div style={{ background:'#13302A', borderRadius:16, padding:'48px 40px', width:'100%', maxWidth:420, boxShadow:'0 8px 40px rgba(0,0,0,0.4)' }}>

        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{ fontSize:28, fontWeight:900, color:'#C9A84C', letterSpacing:2, marginBottom:8 }}>MURDI</div>
          <div style={{ color:'#9DB3AB', fontSize:14 }}>تعيين كلمة مرور جديدة</div>
        </div>

        {done ? (
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:48, marginBottom:16 }}>✅</div>
            <div style={{ color:'#4ade80', fontSize:18, fontWeight:700 }}>تم التحديث بنجاح!</div>
            <div style={{ color:'#9DB3AB', fontSize:13, marginTop:8 }}>جاري تحويلك للداشبورد...</div>
          </div>
        ) : (
          <>
            <div style={{ marginBottom:16 }}>
              <div style={{ color:'#9DB3AB', fontSize:13, marginBottom:8 }}>كلمة المرور الجديدة</div>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{ width:'100%', background:'#22493F', border:'1px solid #2A5A4E', borderRadius:8, padding:'12px 16px', color:'white', fontFamily:'Cairo,sans-serif', fontSize:14, outline:'none' }}
              />
            </div>

            <div style={{ marginBottom:20 }}>
              <div style={{ color:'#9DB3AB', fontSize:13, marginBottom:8 }}>تأكيد كلمة المرور</div>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleUpdate()}
                placeholder="••••••••"
                style={{ width:'100%', background:'#22493F', border:'1px solid #2A5A4E', borderRadius:8, padding:'12px 16px', color:'white', fontFamily:'Cairo,sans-serif', fontSize:14, outline:'none' }}
              />
            </div>

            {error && <div style={{ color:'#f87171', fontSize:13, marginBottom:16, textAlign:'center' }}>{error}</div>}

            <button
              onClick={handleUpdate}
              disabled={loading}
              style={{ width:'100%', background:'linear-gradient(135deg,#B8963E,#C9A84C)', color:'#1A3D34', border:'none', padding:'14px', borderRadius:40, fontFamily:'Cairo,sans-serif', fontSize:15, fontWeight:700, cursor:'pointer', opacity: loading ? 0.7 : 1 }}
            >
              {loading ? 'جاري التحديث...' : 'تحديث كلمة المرور'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
