'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { DIRECT_ORDER, displayName, commercialFor } from '@/lib/serviceCatalog';
import { fireConversion, LEAD_SUBMITTED } from '@/lib/adsConversion';

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

/** إخفاءٌ لا يمدّ الصفحة — انظر التعليق عند حقل المصيدة */
const HONEYPOT: React.CSSProperties = {
  position: 'absolute', width: 1, height: 1, padding: 0, margin: -1,
  overflow: 'hidden', clipPath: 'inset(50%)', whiteSpace: 'nowrap',
  border: 0, opacity: 0,
};

const inputCls: React.CSSProperties = {
  width: '100%', padding: '12px 15px', borderRadius: 12, border: '1.5px solid #D9E5DF',
  fontFamily: 'Tajawal, Cairo, sans-serif', fontSize: 14.5, fontWeight: 700, color: GREEN,
  background: '#fff', boxSizing: 'border-box',
};

const DIRECT = DIRECT_ORDER;
const FUNDING_SERVICE = 'تجهيز ملف التمويل والتفاوض';

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

  // حارسُ التحويل: يُطلق مرةً واحدة لا غير مهما تكرّر النداء.
  const converted = useRef(false);

  // مصدر الزائر — يُقيَّد مع الطلب. وكان الطلب يُسجَّل دائماً بـ«services»
  // فلا يُعرف أمن الإعلان جاء أم من بحثٍ عاديّ. ومعاملات جوجل (gclid وأخواتها)
  // تُلحق بكل نقرة إعلان تلقائياً، فهي أصدق دليلٍ بلا ضبطٍ منّا.
  const [src, setSrc] = useState('');

  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search);
      const s = q.get('s') || '';
      if (s && DIRECT.includes(s)) setService(s);
      const fromAds = q.get('gclid') || q.get('gbraid') || q.get('wbraid');
      const p = q.get('src') || (fromAds ? 'google-ads' : '') || q.get('utm_source') || '';
      const campaign = q.get('utm_campaign') || '';
      const origin = p && campaign ? `${p}:${campaign}`.slice(0, 40) : p;
      if (origin) { setSrc(origin); try { sessionStorage.setItem('murdi_src', origin); } catch {} }
      else { try { const v = sessionStorage.getItem('murdi_src'); if (v) setSrc(v); } catch {} }
    } catch { /* لا شيء — تبقى الخدمة الأولى */ }
  }, []);

  const c = service ? commercialFor(service) : undefined;
  const isContract = service === 'تمويل العقد';
  const isFunding = service === FUNDING_SERVICE;
  const isStatements = service === 'إعداد القوائم المالية المعتمدة';

  const submit = async () => {
    setErr(''); setBusy(true);
    try {
      const r = await fetch('/api/services/inquiry', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service_title: service, full_name: name, phone, email, company_name: company, note, website, src: src || undefined }),
      });
      const d = await r.json();
      if (!r.ok || d?.error) { setErr(d?.error || 'تعذّر الإرسال'); setBusy(false); return; }
      // هنا — وهنا وحدها — حُفظ الطلب فعلاً في service_inquiries وعاد الخادم
      // بـok بلا خطأ. فيُطلق تحويل «Murdi - Lead Submitted» مرةً واحدة.
      //
      // و`already` استثناءٌ مقصود: الخادم يردّ بنجاحٍ على التكرار خلال ربع
      // ساعة (نفس الجوال ونفس الخدمة) **بلا صفٍّ جديد** حتى لا يظنّ صاحبه
      // أن طلبه ضاع. فهو ok بلا حفظ — ولا يُحتسب تحويلاً، وإلا عدّت النقرةُ
      // المكرّرة عميلاً ثانياً واشترينا حسابنا خطأً.
      if (!converted.current && !d?.already) {
        converted.current = true;
        fireConversion(LEAD_SUBMITTED, { phone, email });
      }
      setDone(true);
    } catch {
      setErr('تعذّر الاتصال — تحقق من الشبكة وأعد المحاولة');
    }
    setBusy(false);
  };

  const valid = service !== '' && name.trim() !== '' && phone.trim() !== '';
  const whatsappText = encodeURIComponent(
    `السلام عليكم، أنا ${name.trim()} من ${company.trim() || 'منشأة'}، أرسلت طلب خدمة «${displayName(service)}» عبر منصة مُرضي وأرغب ببدء التجهيز.`
  );

  if (done) return (
    <div style={{ background: '#fff', border: '1.5px solid #BFE0D3', borderRadius: 18, padding: '34px 28px', textAlign: 'center' }}>
      <div style={{ color: '#1A5C46', fontWeight: 900, fontSize: 21, marginBottom: 10 }}>وصلنا طلبك</div>
      <p style={{ color: MUTED, fontSize: 14, fontWeight: 700, lineHeight: 2, margin: '0 0 20px' }}>
        نتواصل معك على <b style={{ color: GREEN }}>{phone}</b> اليوم أو صباح الغد على أبعد تقدير.
        وإن كان الأمر عاجلاً فاتصل مباشرةً على 0570749196.
      </p>
      <a href={`https://wa.me/966570749196?text=${whatsappText}`} target="_blank" rel="noreferrer"
        style={{ display: 'block', background: GREEN, color: '#fff', padding: '13px 24px', borderRadius: 999, fontWeight: 900, fontSize: 14, textDecoration: 'none', marginBottom: 10 }}>
        ابدأ الآن عبر واتساب — وأرسل المستندات
      </a>
      <Link href="/services" style={{ display: 'inline-block', color: MUTED, padding: '8px 18px', fontWeight: 800, fontSize: 13, textDecoration: 'none' }}>
        العودة إلى الخدمات
      </Link>
    </div>
  );

  return (
    <div style={{ background: '#fff', border: '1.5px solid ' + LINE, borderRadius: 18, padding: '28px 26px' }}>
      {isContract && (
        <div style={{ background: '#F4F8F5', border: '1px solid #D9E5DF', borderRadius: 13, padding: '18px 20px', marginBottom: 22, color: GREEN }}>
          <h2 style={{ margin: '0 0 8px', fontSize: 20 }}>فزت بعقد؟ اعرف سيولة تنفيذه قبل أن تبدأ</h2>
          <p style={{ margin: '0 0 10px', fontSize: 14, lineHeight: 1.9 }}>
            نراجع بنود العقد وتوقيت المستخلصات والضمانات، ونجهز خريطة السيولة وملف مخاطبة الجهات المناسبة لحالتك.
          </p>
          <div style={{ fontSize: 13, fontWeight: 800, lineHeight: 1.9 }}>
            الخدمة تبدأ من ٢٥٬٠٠٠ ريال بحسب قيمة العقد. طلبك الآن بلا دفع، ونراجع ملاءمة الخدمة قبل الاتفاق.
          </div>
        </div>
      )}
      {isFunding && (
        <div style={{ background: '#F4F8F5', border: '1px solid #D9E5DF', borderRadius: 13, padding: '18px 20px', marginBottom: 22, color: GREEN }}>
          <h2 style={{ margin: '0 0 8px', fontSize: 20 }}>تبحث عن تمويل لمنشأتك؟ ابدأ بالملف المناسب</h2>
          <p style={{ margin: '0 0 10px', fontSize: 14, lineHeight: 1.9 }}>
            نراجع قدرة السداد والمتطلبات، ونحدد الجهات المناسبة، ثم نجهز ملف التقديم والمخاطبة بحسب وضع منشأتك.
          </p>
          <div style={{ fontSize: 13, fontWeight: 800, lineHeight: 1.9 }}>
            الفحص الائتماني ٩٩٠ ريال، وتجهيز الملف والمخاطبة ٧٬٩٠٠ ريال. نحدد معك الخيار المناسب قبل أي دفع.
          </div>
        </div>
      )}
      {isStatements && (
        <div style={{ background: '#F4F8F5', border: '1px solid #D9E5DF', borderRadius: 13, padding: '18px 20px', marginBottom: 22, color: GREEN }}>
          <h2 style={{ margin: '0 0 8px', fontSize: 20 }}>جهّز قوائم منشأتك للتقديم على التمويل</h2>
          <p style={{ margin: '0 0 10px', fontSize: 14, lineHeight: 1.9 }}>
            نرتب الحركة المالية ونعد القوائم والإيضاحات، ثم ننسق استكمال اعتمادها عبر محاسب قانوني مرخّص.
          </p>
          <div style={{ fontSize: 13, fontWeight: 800, lineHeight: 1.9 }}>
            السعر ١٠٬٠٠٠ ريال للسنة المالية الواحدة، والمدة المعتادة ٥ إلى ١٠ أيام عمل بحسب عدد السنوات. اطلبها الآن ونتأكد من نطاق العمل قبل أي دفع.
          </div>
        </div>
      )}
      <div style={{ marginBottom: 18 }}>
        <label style={{ display: 'block', color: GREEN, fontWeight: 900, fontSize: 14, marginBottom: 7 }}>الخدمة</label>
        <select value={service} onChange={(e) => setService(e.target.value)} style={inputCls}>
          {DIRECT.map((t) => <option key={t} value={t}>{displayName(t)}</option>)}
        </select>
        {c?.days && <div style={{ color: '#9DB3AB', fontSize: 12.5, fontWeight: 700, marginTop: 6 }}>المدة المعتادة: {c.days}</div>}
        {c?.notForWho && (
          <div style={{ background: '#FBF5E8', border: '1px solid #E8D9A8', borderRadius: 10, padding: '10px 13px', marginTop: 10, color: '#8A6D1F', fontSize: 12.5, fontWeight: 700, lineHeight: 1.85 }}>
            <b>ليست لمن: </b>{c.notForWho}
            {isContract && (
              <button type="button" onClick={() => setService(FUNDING_SERVICE)}
                style={{ display: 'block', marginTop: 10, padding: '9px 14px', border: '1px solid #8A6D1F', borderRadius: 8, color: GREEN, background: '#fff', fontFamily: 'Tajawal, Cairo, sans-serif', fontWeight: 900, cursor: 'pointer' }}>
                لا يوجد عقد؟ اطلب تجهيز ملف تمويل المنشأة
              </button>
            )}
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
        <label style={{ display: 'block', color: GREEN, fontWeight: 900, fontSize: 14, marginBottom: 7 }}>
          {isContract ? 'عن العقد — الجهة، القيمة، مرحلة الترسية واحتياج السيولة'
            : isFunding ? 'عن منشأتك — النشاط، الإيراد التقريبي، مبلغ التمويل والغرض منه'
            : isStatements ? 'عن قوائمك — السنوات المطلوبة وحالة الدفاتر والحركة المالية'
            : 'باختصار — ما الذي تريده؟'}
        </label>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3}
          placeholder={isContract
            ? 'مثال: ترسية عقد توريد بقيمة ٨ ملايين ريال، التوقيع الشهر المقبل، وأحتاج تجهيز الضمان وتمويل المشتريات قبل أول مستخلص.'
            : isFunding
              ? 'مثال: منشأة خدمات قائمة، إيرادها السنوي نحو ٥ ملايين ريال، نحتاج تمويل رأس مال عامل ونريد معرفة الجهات المناسبة وتجهيز ملف التقديم.'
            : isStatements
              ? 'مثال: نحتاج قوائم السنة الماضية للتقديم على تمويل، ولدينا كشوف بنكية وفواتير لكن القوائم لم تُجهّز بعد.'
            : 'مثال: مشروع مطعم جديد في الرياض، رأس المال المتوقع مليون ونصف، وأحتاج دراسة يقبلها البنك.'}
          style={{ ...inputCls, resize: 'vertical', lineHeight: 1.9 }} />
      </div>

      {/* المصيدة — مخفية عن الإنسان، مقروءة للآلة */}
      {/* المصيدة كانت تُخفى بـleft:-9999px، وفي صفحةٍ اتجاهها RTL يصير ذلك
          امتداداً أفقياً حقيقياً: قِستُ الصفحة على عرض جوّال 430 بكسل فوجدتُ
          عرضها 10429 — أي أن الزائر يستطيع سحب الصفحة جانباً إلى فراغ، وهذا
          وحده يكفي ليشكّ في الموقع ويخرج. والإخفاء بالقصّ (clip) يُبقيها في
          الصفحة للآلة ولا يمدّها بكسلاً واحداً. */}
      <input value={website} onChange={(e) => setWebsite(e.target.value)} tabIndex={-1} autoComplete="off"
        aria-hidden="true" style={HONEYPOT} />

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
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <Link href="/services" style={{ color: MUTED, fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>الخدمات</Link>
            <a href="tel:0570749196" style={{ color: MUTED, fontWeight: 800, fontSize: 13.5, textDecoration: 'none' }}>0570749196</a>
          </div>
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
