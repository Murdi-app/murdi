'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function ResetPage() {
 const supabase = createClient()
 const router = useRouter()
 const [email, setEmail] = useState('')
 const [loading, setLoading] = useState(false)
 const [sent, setSent] = useState(false)
 const [error, setError] = useState('')

 async function handleReset() {
   if (!email) { setError('أدخل البريد الإلكتروني'); return }
   setLoading(true)
   setError('')

   const { error } = await supabase.auth.resetPasswordForEmail(email, {
     redirectTo: 'https://murdi.vercel.app/auth/update-password'
   })

   if (error) {
     setError('تعذر إرسال البريد. تحقق من الإيميل.')
   } else {
     setSent(true)
   }
   setLoading(false)
 }

 return (
   <div style={{ minHeight:'100vh', background:'#0B1C3D', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Cairo,sans-serif', direction:'rtl' }}>
     <div style={{ background:'#112244', borderRadius:16, padding:'48px 40px', width:'100%', maxWidth:420, boxShadow:'0 8px 40px rgba(0,0,0,0.4)' }}>
       
       <div style={{ textAlign:'center', marginBottom:32 }}>
         <div style={{ fontSize:28, fontWeight:900, color:'#F5C842', letterSpacing:2, marginBottom:8 }}>MURDI</div>
         <div style={{ color:'#8899BB', fontSize:14 }}>استعادة كلمة المرور</div>
       </div>

       {sent ? (
         <div style={{ textAlign:'center' }}>
           <div style={{ fontSize:48, marginBottom:16 }}>📧</div>
           <div style={{ color:'#4ade80', fontSize:18, fontWeight:700, marginBottom:8 }}>تم الإرسال!</div>
           <div style={{ color:'#8899BB', fontSize:14, lineHeight:1.8, marginBottom:24 }}>
             تم إرسال رابط استعادة كلمة المرور إلى<br/>
             <span style={{ color:'#F5C842' }}>{email}</span><br/>
             تحقق من بريدك الوارد
           </div>
           <button
             onClick={() => router.push('/auth/login')}
             style={{ background:'transparent', color:'#F5C842', border:'1px solid #F5C842', padding:'10px 28px', borderRadius:40, fontFamily:'Cairo,sans-serif', fontSize:14, cursor:'pointer' }}
           >
             العودة لتسجيل الدخول
           </button>
         </div>
       ) : (
         <>
           <div style={{ marginBottom:20 }}>
             <div style={{ color:'#8899BB', fontSize:13, marginBottom:8 }}>البريد الإلكتروني</div>
             <input
               type="email"
               value={email}
               onChange={e => setEmail(e.target.value)}
               onKeyDown={e => e.key === 'Enter' && handleReset()}
               placeholder="example@email.com"
               style={{ width:'100%', background:'#1a3060', border:'1px solid #1E3A6E', borderRadius:8, padding:'12px 16px', color:'white', fontFamily:'Cairo,sans-serif', fontSize:14, outline:'none', direction:'ltr' }}
             />
           </div>

           {error && <div style={{ color:'#f87171', fontSize:13, marginBottom:16, textAlign:'center' }}>{error}</div>}

           <button
             onClick={handleReset}
             disabled={loading}
             style={{ width:'100%', background:'linear-gradient(135deg,#B8963E,#F5C842)', color:'#0B1C3D', border:'none', padding:'14px', borderRadius:40, fontFamily:'Cairo,sans-serif', fontSize:15, fontWeight:700, cursor:'pointer', marginBottom:16, opacity: loading ? 0.7 : 1 }}
           >
             {loading ? 'جاري الإرسال...' : 'إرسال رابط الاستعادة'}
           </button>

           <div style={{ textAlign:'center' }}>
             <button
               onClick={() => router.push('/auth/login')}
               style={{ background:'transparent', color:'#8899BB', border:'none', fontFamily:'Cairo,sans-serif', fontSize:13, cursor:'pointer' }}
             >
               العودة لتسجيل الدخول
             </button>
           </div>
         </>
       )}
     </div>
   </div>
 )
}
