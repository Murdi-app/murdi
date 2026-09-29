'use client'
import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'

// موافقة المالك على ربط Codex (ChatGPT) بمُرضي — صفحةٌ واحدة بزرّين. الصلاحيات محدودة ومسمّاة:
// قراءة فرص القناة، وإرسال توصياتٍ تُحفظ في الصندوق، وأولوية/تعليم الفرصة. لا إرسال ولا تعديل غيرها.
const G = '#1A3D34', M = '#6B8A80'

function Consent() {
  const q = useSearchParams()
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [login, setLogin] = useState(false)
  const decide = async (deny: boolean) => {
    setBusy(true); setErr('')
    const r = await fetch('/api/oauth/authorize', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      client_id: q.get('client_id'), redirect_uri: q.get('redirect_uri'), code_challenge: q.get('code_challenge'),
      code_challenge_method: q.get('code_challenge_method') || 'S256', state: q.get('state'), deny,
    }) })
    const j = await r.json().catch(() => ({}))
    setBusy(false)
    if (r.status === 401) { setLogin(true); return }
    if (!r.ok || !j.redirect) { setErr(j.error || 'تعذّر الربط'); return }
    window.location.href = j.redirect
  }
  const here = typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/oauth/authorize'
  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: '#F7FBF9', fontFamily: 'Tajawal, Cairo, sans-serif', color: G, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', border: '1px solid #E1EDE8', borderRadius: 16, padding: 24, maxWidth: 440, width: '100%' }}>
        <div style={{ fontWeight: 900, fontSize: 20, marginBottom: 6 }}>ربط Codex بمُرضي</div>
        <div style={{ color: M, fontSize: 14, lineHeight: 1.9, marginBottom: 14 }}>
          يطلب ChatGPT (Codex) الصلاحيات التالية على <b>قناة الفائزين وحدها</b>:
          <br />• قراءة الفرص وما تغيّر فيها
          <br />• إرسال توصياتٍ تُحفظ في الصندوق حتى تُقبل أو تُرفض
          <br />• أولوية الفرصة وتعليمها («مهمة لضي» · «تحتاج قرارك»)
          <br />لا يرسل لأحد، ولا يرى عملاء المنصة الآخرين، وتلغيه متى شئت من «قناة الفائزين».
        </div>
        {login ? (
          <a href={'/auth/login?next=' + encodeURIComponent(here)} style={{ display: 'block', textAlign: 'center', background: G, color: '#fff', padding: 12, borderRadius: 999, fontWeight: 900, textDecoration: 'none' }}>سجّل الدخول أولاً ثم ارجع هنا</a>
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <button disabled={busy} onClick={() => decide(false)} style={{ flex: 1, background: G, color: '#fff', border: 'none', padding: 12, borderRadius: 999, fontWeight: 900, fontSize: 15, fontFamily: 'inherit', cursor: 'pointer' }}>{busy ? '…' : 'اسمح'}</button>
            <button disabled={busy} onClick={() => decide(true)} style={{ flex: 1, background: '#fff', color: G, border: '1px solid #E1EDE8', padding: 12, borderRadius: 999, fontWeight: 900, fontSize: 15, fontFamily: 'inherit', cursor: 'pointer' }}>ارفض</button>
          </div>
        )}
        {err && <div style={{ color: '#A5281B', fontSize: 13, fontWeight: 800, marginTop: 10 }}>{err}</div>}
      </div>
    </div>
  )
}

export default function AuthorizePage() {
  return <Suspense fallback={null}><Consent /></Suspense>
}
