'use client'
import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { waNumber } from '@/lib/phone'

// كان التسجيل على شاشتين: شاشةٌ تأخذ اسم الشركة والبريد وكلمة المرور، ثم
// شاشةٌ ثانية تأخذ بيانات المنشأة — وتسأل عن اسم الشركة مرة أخرى.
//
// والحدّ بينهما كان يبتلع الناس: `barq.plus@gmail.com` أنشأ حسابه الساعة
// ٣:٠٠ عصراً وتوقف عند الشاشة الثانية ولم يعد. فبقي في القاعدة بريداً بلا
// منشأة ولا جوال — لا نعرف من هو ولا كيف نصل إليه.
//
// فصارت شاشةً واحدة: يدخل بياناته مرة واحدة، ويخرج منها إلى تقييمه مباشرة.
// ورقم الهوية أُخرج من هنا إلى وقت العقد — لأنه لا يلزم لتقييمٍ مجاني،
// وطلبه على الباب يوقف من لا يحمله معه الآن.
export default function SignUp() {
  const [company, setCompany] = useState('')
  const [cr, setCr] = useState('')
  const [owner, setOwner] = useState('')
  const [phone, setPhone] = useState('')
  const [city, setCity] = useState('')
  const [sector, setSector] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()
  // ★ الرسالة كانت تُطبع **تحت** الزر، وفقاعة واتساب العائمة تجلس فوق ذلك
  //   الموضع على الجوّال. فيضغط العميل، ويظهر السبب حيث لا يراه، فيقرأ
  //   الضغطة «لا شيء» — «الخانة جامدة ولا تحوّله إلى أي باب». فصارت
  //   الرسالة فوق الزر، وتُمرَّر الشاشة إليها فور ظهورها.
  const errRef = useRef<HTMLParagraphElement | null>(null)
  const fail = (m: string) => {
    setMessage(m)
    setTimeout(() => errRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60)
  }

  const translateError = (msg: string) => {
    const m = msg.toLowerCase()
    if (m.includes('already registered') || m.includes('already been registered')) return 'هذا البريد مسجل مسبقاً — جرّب تسجيل الدخول'
    if (m.includes('valid email') || m.includes('invalid')) return 'صيغة البريد الإلكتروني غير صحيحة'
    if (m.includes('password') && m.includes('6')) return 'كلمة المرور قصيرة — يجب ألا تقل عن 6 أحرف'
    if (m.includes('password')) return 'كلمة المرور غير مقبولة — اختر كلمة أقوى'
    if (m.includes('network') || m.includes('fetch')) return 'تعذر الاتصال — تحقّق من الإنترنت وحاول مجدداً'
    return 'تعذّر إنشاء الحساب — حاول مرة أخرى أو تواصل معنا'
  }

  const handleSignUp = async () => {
    setMessage('')
    if (!company.trim()) { fail('اكتب اسم المنشأة كما في السجل التجاري'); return }
    // ═══ السجل التجاري اختياري عمداً ═══
    // كان إلزامياً، وهو يمنع أكثر من يشتري خدماتنا المباشرة: صاحب المشروع
    // الذي لم يبدأ بعد لا سجلَ له أصلاً. وصفحة الخدمات تقول ذلك بنفسها عن
    // دراسة الجدوى: «من يبدأ مشروعاً جديداً لا منشأة عنده تُقيَّم». فكانت
    // المنصة تبيعه خدمةً ثم تمنعه من فتح الحساب الذي يشتريها به.
    // ويبقى مطلوباً حين يُقيَّم مسار التمويل لمنشأة قائمة — هناك موضعه.
    if (!owner.trim()) { fail('اكتب اسم المالك'); return }
    if (!waNumber(phone)) { fail('اكتب رقم جوال سعودي صحيح — مثال 05xxxxxxxx'); return }
    if (!city.trim()) { fail('اكتب المدينة'); return }
    if (!sector.trim()) { fail('اكتب القطاع أو النشاط'); return }
    if (!email.trim() || !email.includes('@')) { fail('اكتب بريدا إلكترونياً صحيحاً'); return }
    if (password.length < 6) { fail('كلمة المرور يجب ألا تقل عن 6 أحرف'); return }

    setLoading(true)
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) { fail(translateError(error.message)); setLoading(false); return }
    const user = data.user
    if (!user) { fail('تعذّر إنشاء الحساب — حاول مرة أخرى'); setLoading(false); return }

    await supabase.from('profiles').insert({ id: user.id, email, company_name: company.trim() })

    // الرقم يُطبَّع قبل الحفظ: من كتبه بلا صفر يُحفظ ٠٥xxxxxxxx، فلا يخرج
    // زرّ واتساب في اللوحة إلى رقم لا وجود له.
    const norm = waNumber(phone)
    const { error: cErr } = await supabase.from('companies').insert({
      user_id: user.id,
      company_name: company.trim(),
      // الفراغ يُحفظ null لا نصّاً فارغاً: «لم يُذكر» ليست «مذكورٌ وفارغ»،
      // وقارئو هذا العمود يفحصون وجوده لا طوله.
      cr_number: cr.trim() || null,
      owner_name: owner.trim(),
      phone: norm ? '0' + norm.slice(3) : phone.trim(),
      city: city.trim(),
      sector: sector.trim(),
      account_status: 'active',
    })
    setLoading(false)

    // ★ كان تعثّر حفظ المنشأة يدفعه إلى /register، وتلك تطلب جلسةً فإن لم
    //   تجدها دفعته إلى /auth/login — فيخرج العميل من زرٍّ ضغطه إلى شاشة
    //   دخول بلا كلمةٍ واحدة تشرح. حسابه أُنشئ فعلاً، فيُقال له ذلك ويُعطى
    //   الباب الصحيح بدل أن يُقذف في دائرة.
    if (cErr) {
      fail('أُنشئ حسابك، لكن تعذّر حفظ بيانات المنشأة: ' + cErr.message
        + ' — اضغط «تسجيل الدخول» ثم أكمل بياناتك، أو راسلنا على 0570749196')
      return
    }
    router.push('/goal')
  }

  const onKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !loading) handleSignUp() }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;900&family=IBM+Plex+Sans+Arabic:wght@300;400;500;600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        .au{min-height:100vh;background:#FFFFFF;font-family:'IBM Plex Sans Arabic',sans-serif;direction:rtl;color:#1A3D34;display:flex;flex-direction:column}
        .au-top{background:#122C26;color:#9FB6AE;font-size:11.5px;text-align:center;padding:8px 16px}
        .au-top b{color:#fff;font-weight:600}
        .au-mid{flex:1;display:flex;align-items:center;justify-content:center;padding:32px 18px}
        .au-card{width:100%;max-width:420px}
        .au-brand{font-family:'Tajawal';font-size:30px;font-weight:900;color:#1A3D34;text-align:center;letter-spacing:-.01em}
        .au-brand i{font-style:normal;font-size:12px;font-weight:500;color:#6B8A80;letter-spacing:.16em;display:block;margin-top:6px}
        .au-rule{width:34px;height:2px;background:#C9A84C;margin:18px auto 0}
        .au-title{font-family:'Tajawal';margin-top:26px;font-size:21px;font-weight:900;text-align:center;margin-bottom:6px}
        .au-lead{color:#6B8A80;font-size:13.5px;text-align:center;line-height:1.9;margin-bottom:24px}
        .au-label{font-size:12.5px;font-weight:600;color:#6B8A80;margin-bottom:6px}
        .au-opt{color:#9A7B2E;font-weight:500;font-size:11.5px;margin-inline-start:5px}
        .au-input{width:100%;padding:14px 15px;margin-bottom:16px;border-radius:2px;border:1px solid #E3EAE7;background:#fff;color:#1A3D34;font-size:15px;font-family:'IBM Plex Sans Arabic';outline:none;text-align:right}
        .au-input:focus{border-color:#1A3D34}
        .au-btn{width:100%;padding:15px;border-radius:2px;border:none;background:#C9A84C;color:#122C26;font-size:16px;font-weight:900;font-family:'Tajawal';cursor:pointer;margin-top:4px;transition:.18s}
        .au-btn:hover{background:#D9BA63}
        .au-btn:disabled{opacity:.55;cursor:default}
        .au-err{color:#8E2F27;background:#FDECEA;border:1px solid #F3C4BE;border-radius:4px;padding:12px 14px;text-align:center;margin:6px 0 14px;font-size:13.5px;line-height:1.75;font-weight:700}
        .au-links{text-align:center;margin-top:20px;color:#6B8A80;font-size:13.5px;line-height:2.2}
        .au-links b{color:#1A3D34;cursor:pointer;font-weight:600;border-bottom:1px solid #C9A84C;padding-bottom:1px}
        .au-back{display:block;margin-top:8px;color:#9DB3AB;font-size:12.5px;text-decoration:none}
        .au-ft{text-align:center;color:#9DB3AB;font-size:11.5px;padding:18px;line-height:1.9}
        @media (max-width:620px){.au-mid{align-items:flex-start;padding:26px 16px 12px}.au-brand{font-size:26px}.au-title{margin-top:20px;font-size:19px}}
        @media (prefers-reduced-motion:reduce){*{transition:none!important}}
      `}</style>
      <div className="au">
        <div className="au-top"><b>حلول المرضي للاستشارات المالية</b> · رخصة استشارة FL-457927015</div>
        <div className="au-mid">
          <div className="au-card">
            <div className="au-brand">مُرضي<i>MURDI</i></div>
            <div className="au-rule" />
            <div className="au-title">افتح ملف شركتك</div>
            <div className="au-lead">التقييم مجاني — تعرف درجتك وعوائقك قبل أن تدفع ريالاً.<br />ومشروعك الجديد لا يحتاج سجلاً تجارياً ليُفتح له ملف.</div>

            <div className="au-label">اسم المنشأة أو المشروع</div>
            <input className="au-input" placeholder="كما في السجل — أو اسم مشروعك إن لم يُسجَّل بعد" value={company} onChange={e=>setCompany(e.target.value)} onKeyDown={onKeyDown} />
            <div className="au-label">رقم السجل التجاري <span className="au-opt">اختياري</span></div>
            <input className="au-input" placeholder="10xxxxxxxx — اتركه فارغاً إن كان مشروعاً لم يبدأ" value={cr} onChange={e=>setCr(e.target.value)} onKeyDown={onKeyDown} inputMode="numeric" />
            <div className="au-label">اسم المالك</div>
            <input className="au-input" placeholder="الاسم كما في الهوية" value={owner} onChange={e=>setOwner(e.target.value)} onKeyDown={onKeyDown} />
            <div className="au-label">رقم الجوال</div>
            <input className="au-input" placeholder="05xxxxxxxx" value={phone} onChange={e=>setPhone(e.target.value)} onKeyDown={onKeyDown} inputMode="tel" />
            <div className="au-label">المدينة</div>
            <input className="au-input" placeholder="الرياض" value={city} onChange={e=>setCity(e.target.value)} onKeyDown={onKeyDown} />
            <div className="au-label">القطاع أو النشاط</div>
            <input className="au-input" placeholder="مقاولات · تجارة · مطاعم · تقنية" value={sector} onChange={e=>setSector(e.target.value)} onKeyDown={onKeyDown} />
            <div className="au-label">البريد الإلكتروني</div>
            <input className="au-input" placeholder="name@company.com" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={onKeyDown} type="email" />
            <div className="au-label">كلمة المرور</div>
            <input className="au-input" placeholder="6 أحرف على الأقل" type="password" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={onKeyDown} />

            {message && <p className="au-err" ref={errRef}>{message}</p>}

            <button className="au-btn" onClick={handleSignUp} disabled={loading}>
              {loading ? 'جارٍ فتح ملفك…' : 'افتح ملفك وابدأ التقييم ←'}
            </button>

            <p className="au-links">
              عندك حساب؟ <b onClick={()=>router.push('/auth/login')}>تسجيل الدخول</b>
              <a className="au-back" href="/">الرجوع للصفحة الرئيسية</a>
            </p>
          </div>
        </div>
        <div className="au-ft">منصة استشارية لقياس وتجهيز الجاهزية — لا نمنح تمويلاً ولا نضمن نتيجة</div>
      </div>
    </>
  )
}
