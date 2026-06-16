'use client'

import { useState } from 'react'
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

  async function handleUpdate() {
    if (!password) { setError('أدخل كلمة المرور'); return }
    if (password.length < 6) { setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل'); return }
    if (password !== confirm) { setError('كلمتا المرور غير متطابقتين'); return }

    setLoading(true)
    setError('')

    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setError('تعذر تحديث كلمة المرور. حاول مرة أخرى.')
    } else {
      setDone(true)
      setTimeout(() => router.push('/goal'), 2000)
    }
    setLoading(false)
  }

  return (
    <div style={{ minHeight:'100vh', background:'#0B1C3D', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Cairo,sans-serif', direction:'rtl' }}>
      <div style={{ background:'#112244', borderRadius:16, padding:'48px 40px', width:'100%', maxWidth:420, boxShadow:'0 8px 40px rgba(0,0,0,0.4)' }}>

        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{ fontSize:28, fontWeight:900, color:'#F5C842', letterSpacing:2, marginBottom:8 }}>MURDI</div>
          <div style={{ color:'#8899BB', fontSize:14 }}>تعيين كلمة مرور جديدة</div>
        </div>

        {done ? (
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:48, marginBottom:16 }}>✅</div>
            <div style={{ color:'#4ade80', fontSize:18, fontWeight:700 }}>تم التحديث بنجاح!</div>
            <div style={{ color:'#8899BB', fontSize:13, marginTop:8 }}>جاري تحويلك للداشبورد...</div>
          </div>
        ) : (
          <>
            <div style={{ marginBottom:16 }}>
              <div style={{ color:'#8899BB', fontSize:13, marginBottom:8 }}>كلمة المرور الجديدة</div>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{ width:'100%', background:'#1a3060', border:'1px solid #1E3A6E', borderRadius:8, padding:'12px 16px', color:'white', fontFamily:'Cairo,sans-serif', fontSize:14, outline:'none' }}
              />
            </div>

            <div style={{ marginBottom:20 }}>
              <div style={{ color:'#8899BB', fontSize:13, marginBottom:8 }}>تأكيد كلمة المرور</div>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleUpdate()}
                placeholder="••••••••"
                style={{ width:'100%', background:'#1a3060', border:'1px solid #1E3A6E', borderRadius:8, padding:'12px 16px', color:'white', fontFamily:'Cairo,sans-serif', fontSize:14, outline:'none' }}
              />
            </div>

            {error && <div style={{ color:'#f87171', fontSize:13, marginBottom:16, textAlign:'center' }}>{error}</div>}

            <button
              onClick={handleUpdate}
              disabled={loading}
              style={{ width:'100%', background:'linear-gradient(135deg,#B8963E,#F5C842)', color:'#0B1C3D', border:'none', padding:'14px', borderRadius:40, fontFamily:'Cairo,sans-serif', fontSize:15, fontWeight:700, cursor:'pointer', opacity: loading ? 0.7 : 1 }}
            >
              {loading ? 'جاري التحديث...' : 'تحديث كلمة المرور'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
