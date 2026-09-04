'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { CATALOG, displayName, commercialFor, needsDiagnosis } from '@/lib/serviceCatalog';

// شاشة واحدة يطلب بها الزائر خدمةً يعرف حاجته إليها — بلا حساب ولا تقييم.
// أربعة حقول: الاسم والجوال والمنشأة وسطرٌ عمّا يريد. وما زاد يُسأل في المكالمة.
//
// و«الخدمة» تُقرأ من الرابط بـwindow لا بـuseSearchParams عمداً: الثانية
// تُبطل التصيير المسبق للصفحة كلها (BAILOUT_TO_CLIENT_SIDE_RENDERING)،
// فيصل الزائر صفحةً فيها عنوانٌ وفراغ حتى تُحمَّل السكربتات وتُنفَّذ.
// قِستُه على الإنتاج فوجدتُ النموذج غائباً من أول استجابة. وبهذه القراءة
// يخرج النموذج كاملاً في أول بايت، والرابط يُقرأ بعد الترطيب.

const GREEN = '#1A3D34';
const GOLD = '#C9A84C';
const MUTED = '#6B8A80';
const LINE = '#EAF2EE';

const inputCls: React.CSSProperties = {
  width: '100%', padding: '12px 15px', borderRadius: 12, border: '1.5px solid #D9E5DF',
  fontFamily: 'Tajawal, Cairo, sans-serif', fontSize: 14.5, fontWeight: 700, color: GREEN,
  background: '#fff', boxSizing: 'border-box',
};

const DIRECT = CATALOG.flatMap((c) => c.items).filter((t) => !needsDiagnosis(t));

function RequestForm() {
  // القيمة الأولى تُختار من الفهرس لا من الرابط، فيُصيَّر النموذج مسبقاً
  // بخدمة صالحة، ثم يصحّحها الرابط إن حمل غيرها.
  const [service, setService] = useState(DIRECT[0] || '');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [note, setNote] = useState('');
  const [website, setWebsite] = useState('');   // المصيدة
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    try {
      const s = new URLSearchParams(window.location.search).get('s') || '';
      if (s && DIRECT.includes(s)) setService(s);
    } catch { /* لا شيء — تبقى الخدمة الأولى */ }
  }, []);

  const c = service ? commercialFor(service) : undefined;

  const submit = async () => {
    setErr(''); setBusy(true);
    try {
      const r = await fetch('/api/services/inquiry', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service_title: service, full_name: name, phone, email, company_name: company, note, website }),
      });
      const d = await r.json();
      if (!r.ok || d?.error) { setErr(d?.error || 'تعذّر الإرسال'); setBusy(false); return; }
      setDone(true);
    } catch {
      setErr('تعذّر الاتصال — تحقق من الشبكة وأعد المحاولة');
    }
    setBusy(false);
  };

  const valid = service !== '' && name.trim() !== '' && phone.trim() !== '';

  if (done) return (
    <div style={{ background: '#fff', border: '1.5px solid #BFE0D3', borderRadius: 18, padding: '34px 28px', textAlign: 'center' }}>
      <div style={{ color: '#1A5C46', fontWeight: 900, fontSize: 21, marginBottom: 10 }}>وصلنا طلبك</div>
      <p style={{ color: MUTED, fontSize: 14, fontWeight: 700, lineHeight: 2, margin: '0 0 20px' }}>
        نتواصل معك على <b style={{ color: GREEN }}>{phone}</b> اليوم أو صباح الغد على أبعد تقدير.
        وإن كان الأمر عاجلاً فاتصل مباشرةً على 0570314005.
      </p>
      <Link href="/services" style={{ display: 'inline-block', background: GREEN, color: '#fff', padding: '12px 30px', borderRadius: 999, fontWeight: 900, fontSize: 14, textDecoration: 'none' }}>
        عد إلى الخدمات
      </Link>
    </div>
  );

  return (
    <div style={{ background: '#fff', border: '1.5px solid ' + LINE, borderRadius: 18, padding: '28px 26px' }}>
      <div style={{ marginBottom: 18 }}>
        <label style={{ display: 'block', color: GREEN, fontWeight: 900, fontSize: 14, marginBottom: 7 }}>الخدمة</label>
        <select value={service} onChange={(e) => setService(e.target.value)} style={inputCls}>
          {DIRECT.map((t) => <option key={t} value={t}>{displayName(t)}</option>)}
        </select>
        {c?.days && <div style={{ color: '#9DB3AB', fontSize: 12.5, fontWeight: 700, marginTop: 6 }}>المدة المعتادة: {c.days}</div>}
        {c?.notForWho && (
          <div style={{ background: '#FBF5E8', border: '1px solid #E8D9A8', borderRadius: 10, padding: '10px 13px', marginTop: 10, color: '#8A6D1F', fontSize: 12.5, fontWeight: 700, lineHeight: 1.85 }}>
            <b>ليست لمن: </b>{c.notForWho}
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14, marginBottom: 14 }}>
        <div>
          <label style={{ display: 'block', color: GREEN, fontWeight: 900, fontSize: 14, marginBottom: 7 }}>الاسم</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="الاسم الثلاثي" style={inputCls} />
        </div>
        <div>
          <label style={{ display: 'block', color: GREEN, fontWeight: 900, fontSize: 14, marginBottom: 7 }}>الجوال</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="05xxxxxxxx" style={inputCls} />
        </div>
        <div>
          <label style={{ display: 'block', color: GREEN, fontWeight: 900, fontSize: 14, marginBottom: 7 }}>اسم المنشأة <span style={{ color: '#9DB3AB', fontWeight: 700 }}>(اختياري)</span></label>
          <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="إن وُجدت" style={inputCls} />
        </div>
        <div>
          <label style={{ display: 'block', color: GREEN, fontWeight: 900, fontSize: 14, marginBottom: 7 }}>البريد <span style={{ color: '#9DB3AB', fontWeight: 700 }}>(اختياري)</span></label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} inputMode="email" placeholder="name@example.com" style={inputCls} />
        </div>
      </div>

      <div style={{ marginBottom: 18 }}>
        <label style={{ display: 'block', color: GREEN, fontWeight: 900, fontSize: 14, marginBottom: 7 }}>باختصار — ما الذي تريده؟</label>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3}
          placeholder="مثال: مشروع مطعم جديد في الرياض، رأس المال المتوقع مليون ونصف، وأحتاج دراسة يقبلها البنك."
          style={{ ...inputCls, resize: 'vertical', lineHeight: 1.9 }} />
      </div>

      {/* المصيدة — مخفية عن الإنسان، مقروءة للآلة */}
      <input value={website} onChange={(e) => setWebsite(e.target.value)} tabIndex={-1} autoComplete="off"
        aria-hidden="true" style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }} />

      {err && <div style={{ color: '#B4453C', fontWeight: 800, fontSize: 13, marginBottom: 12, lineHeight: 1.85 }}>{err}</div>}

      <button onClick={submit} disabled={!valid || busy}
        style={{ width: '100%', background: valid && !busy ? GREEN : '#9DB3AB', color: '#fff', border: 'none', padding: '14px', borderRadius: 999, fontFamily: 'Tajawal, Cairo, sans-serif', fontWeight: 900, fontSize: 15, cursor: valid && !busy ? 'pointer' : 'default' }}>
        {busy ? 'جارٍ الإرسال…' : 'أرسل الطلب'}
      </button>

      <p style={{ color: '#9DB3AB', fontSize: 11.8, fontWeight: 700, lineHeight: 1.9, textAlign: 'center', margin: '14px 0 0' }}>
        {/* «لا نطلب منك دفعاً الآن» وحدها تُقرأ مجانيةً. فالسعر يُذكر أولاً،
            ثم يُقال إن الدفع لاحقٌ لا معدوم. */}
        الخدمة مدفوعة بسعرها المعلن. ولا نطلب منك ريالاً قبل أن نتكلّم معك ونتأكد أنها تخصّك —
        وإن لم تكن تخصّك قلنا لك ذلك ولم نبعك إياها.
      </p>
    </div>
  );
}

export default function ServiceRequestPage() {
  return (
    <div dir="rtl" style={{ background: '#FBFCFB', minHeight: '100vh', fontFamily: 'Tajawal, Cairo, sans-serif' }}>
      <nav style={{ background: '#fff', borderBottom: '1px solid ' + LINE, padding: '16px 20px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/" style={{ color: GREEN, fontWeight: 900, fontSize: 22, textDecoration: 'none' }}>
            مُرضي <span style={{ fontSize: 11, color: '#9DB3AB', letterSpacing: '.14em', fontWeight: 500 }}>MURDI</span>
          </Link>
          <a href="tel:0570314005" style={{ color: MUTED, fontWeight: 800, fontSize: 13.5, textDecoration: 'none' }}>0570314005</a>
        </div>
      </nav>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 20px 70px' }}>
        <div style={{ textAlign: 'center', marginBottom: 26 }}>
          <div style={{ color: GOLD, fontWeight: 900, fontSize: 12, letterSpacing: '.12em', marginBottom: 8 }}>
            حلول المرضي للاستشارات المالية · ترخيص FL-457927015
          </div>
          <h1 style={{ color: GREEN, fontSize: 27, fontWeight: 900, margin: '0 0 8px', fontFamily: 'Amiri, serif' }}>اطلب خدمتك</h1>
          <p style={{ color: MUTED, fontSize: 14, fontWeight: 700, lineHeight: 1.95, margin: 0 }}>
            أربعة حقول، ونتواصل معك اليوم. والباقي يُسأل في المكالمة لا في نموذج.
          </p>
        </div>
        <RequestForm />
      </div>
    </div>
  );
}
