'use client';
import { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

// نوع الدفعة يُقرأ مرة واحدة، ورسم العضوية لا يأتي من الرابط
const kindOf = (p: URLSearchParams) => p.get('kind') || 'service';

const BANK = { name: 'البنك الأهلي السعودي SNB', beneficiary: 'شركة حلول المرضي للإستشارات المالية', iban: 'SA3710000026300000961004' };

function TransferInner() {
  const params = useSearchParams();
  const router = useRouter();
  // لم يبقَ رسمُ اشتراك ولا رسمُ تشغيل — كل تحويل هنا مقابل خدمة بمبلغها.
  // والمبلغ يأتي من الرابط الذي أصدره المكتب، ولا افتراضيَّ له.
  const amountSar = Number(params.get('amount') || 0);
  const kind = kindOf(params);
  const companyId = params.get('company_id') || '';
  // رقم طلب الخدمة — كان يُمرَّر في الرابط ويُهمَل هنا، فتضيع صلة الإيصال بالطلب
  const serviceRequestId = params.get('sr') || '';
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState(false);

  const copyIban = () => { navigator.clipboard.writeText(BANK.iban); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setErr('');
    let receiptUrl = '';
    try {
      if (file) {
        const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string);
        // بادئة المسار من الجلسة لا من الرابط — وإلا وضع أحدهم ملفاً في مجلد إيصالات عميل آخر
        const { data: { user } } = await supabase.auth.getUser();
        const { data: own } = await supabase.from('companies').select('id').eq('user_id', user?.id || '').limit(1).maybeSingle();
        const folder = String(own?.id || user?.id || 'unknown').replace(/[^a-zA-Z0-9-]/g, '');
        const path = folder + '/' + Date.now() + '_' + file.name.replace(/[^a-zA-Z0-9._-]/g, '');
        const { error } = await supabase.storage.from('receipts').upload(path, file);
        // دلو الإيصالات خاص — الرابط العام لا يفتح. نحفظ المسار ويُوقَّع عند عرضه للأدمن
        // فشل رفع الإيصال كان يمضي بصمت: يرى العميل «تم الاستلام» وتصلك دفعة بلا إثبات فلا تُفعَّل
        if (error) { setErr('تعذّر رفع الإيصال — حاول مرة أخرى أو أرسله واتساب على 0570749196'); setBusy(false); return; }
        receiptUrl = path;
      }
      const r = await fetch('/api/payments/transfer', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, amountSar, kind, receiptUrl, note, serviceRequestId }),
      });
      if (r.ok) { setDone(true); }
      else {
        const d = await r.json().catch(() => ({}));
        setErr(d?.error || 'تعذّر تسجيل التحويل — حاول مرة أخرى أو راسلنا واتساب على 0570749196');
      }
    } catch {
      setErr('تعذّر الاتصال — تحقق من الشبكة ثم أعد المحاولة');
    }
    setBusy(false);
  };

  if (done) {
    return (
      <div dir="rtl" style={{ fontFamily: 'Cairo', maxWidth: 520, margin: '0 auto', padding: '60px 20px', minHeight: '100vh', background: '#FBFCFB', textAlign: 'center' }}>
        <div style={{ fontSize: 56 }}>✅</div>
        <h1 style={{ color: '#1A3D34', fontSize: 24, fontWeight: 900 }}>تم استلام تحويلك</h1>
        <p style={{ color: '#3A4D47', fontSize: 15, lineHeight: 1.9 }}>شكراً لك. يراجع فريق مُرضي التحويل، وتبدأ خدمتك فور التأكد. <b>لا حاجة للتحويل مرة أخرى</b> — وستجد حالة التحويل في لوحتك.</p>
        <button onClick={() => router.push('/goal')} style={{ marginTop: 20, background: '#1A3D34', color: '#fff', border: 'none', padding: '12px 30px', borderRadius: 999, fontFamily: 'Cairo', fontWeight: 900, fontSize: 14, cursor: 'pointer' }}>العودة للوحة</button>
      </div>
    );
  }

  return (
    <div dir="rtl" style={{ fontFamily: 'Cairo', maxWidth: 560, margin: '0 auto', padding: '40px 20px', minHeight: '100vh', background: '#FBFCFB' }}>
      <h1 style={{ color: '#1A3D34', fontSize: 24, fontWeight: 900, textAlign: 'center', margin: 0 }}>الدفع عبر تحويل بنكي</h1>
      <div style={{ color: '#1A3D34', fontSize: 30, fontWeight: 900, textAlign: 'center', margin: '12px 0' }}>{amountSar.toLocaleString('ar-SA')} ريال</div>

      <div style={{ background: '#fff', border: '1.5px solid #EAF2EE', borderRadius: 14, padding: 20, marginTop: 16 }}>
        <div style={{ color: '#6B8A80', fontSize: 13, fontWeight: 700, marginBottom: 12 }}>حوّل المبلغ إلى الحساب التالي:</div>
        <div style={{ marginBottom: 10 }}><span style={{ color: '#9DB3AB', fontSize: 12 }}>المستفيد</span><div style={{ color: '#1A3D34', fontSize: 15, fontWeight: 800 }}>{BANK.beneficiary}</div></div>
        <div style={{ marginBottom: 10 }}><span style={{ color: '#9DB3AB', fontSize: 12 }}>البنك</span><div style={{ color: '#1A3D34', fontSize: 15, fontWeight: 800 }}>{BANK.name}</div></div>
        <div><span style={{ color: '#9DB3AB', fontSize: 12 }}>رقم الآيبان IBAN</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <code style={{ color: '#1A3D34', fontSize: 15, fontWeight: 800, letterSpacing: 0.5, direction: 'ltr', flex: 1 }}>{BANK.iban}</code>
            <button onClick={copyIban} style={{ background: '#F0F4F2', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 800, color: '#1A3D34', cursor: 'pointer', fontFamily: 'Cairo' }}>{copied ? '✓ نُسخ' : 'نسخ'}</button>
          </div>
        </div>
      </div>

      {/* ★ خانةُ الإيصال تُرى أو لا تكون.
          قال صاحبُ «هرم الإنشاء» في ١٧ سبتمبر: «لا يوجد خانة لرفع الإيصال».
          وكانت موجودةً في الكود — `<input type="file">` خاماً بلا تنسيق.
          وهذا على جوّال العميل سطرٌ إنجليزيٌّ صغير («Choose File») لا يُرى
          وسط بطاقاتٍ عربيةٍ مصمَّمة، ولا يُفهم أنه زرّ. ومعه كان زرُّ
          الإرسال رمادياً معطَّلاً حتى يُرفق ملفاً — فيرى العميل باباً
          مغلقاً ولا يجد مفتاحه، فيتصل أو ينصرف.
          فصارت الخانة مربّعاً كبيراً مكتوباً بالعربية يُضغط كلُّه، ويُظهر
          اسم الملف بعد اختياره، وتحته طريقُ الواتساب لمن تعذّر عليه. */}
      <div style={{ background: '#fff', border: '1.5px solid #EAF2EE', borderRadius: 14, padding: 20, marginTop: 14 }}>
        <div style={{ color: '#1A3D34', fontSize: 14, fontWeight: 800, marginBottom: 10 }}>📎 أرفق إيصال / إشعار الحوالة</div>

        <label htmlFor="receipt-file" style={{
          display: 'block', cursor: 'pointer', textAlign: 'center',
          border: '2px dashed ' + (file ? '#1A7A5A' : '#C9A84C'),
          background: file ? '#F2FAF6' : '#FDF9EF',
          borderRadius: 12, padding: '22px 14px', marginBottom: 12,
        }}>
          <div style={{ fontSize: 30, lineHeight: 1 }}>{file ? '✅' : '📤'}</div>
          <div style={{ color: file ? '#1A7A5A' : '#9A7B2E', fontSize: 15, fontWeight: 900, marginTop: 8 }}>
            {file ? 'تم إرفاق الإيصال' : 'اضغط هنا لإرفاق صورة الإيصال'}
          </div>
          <div style={{ color: file ? '#1A7A5A' : '#B08D3A', fontSize: 12, fontWeight: 700, marginTop: 4, wordBreak: 'break-all' }}>
            {file ? file.name + ' — اضغط لتغييره' : 'صورة من الجوال أو ملف PDF'}
          </div>
        </label>
        <input id="receipt-file" type="file" accept="image/*,application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }} />

        <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="ملاحظة (اختياري) — مثل: اسم المُحوِّل أو تاريخ الحوالة"
          style={{ width: '100%', minHeight: 70, border: '1px solid #EAF2EE', borderRadius: 10, padding: 10, fontFamily: 'Cairo', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }} />
      </div>

      <button onClick={submit} disabled={busy || !file}
        style={{ width: '100%', background: (busy || !file) ? '#9DB3AB' : '#1A3D34', color: '#fff', border: 'none', padding: '15px', borderRadius: 999, fontFamily: 'Cairo', fontWeight: 900, fontSize: 15, cursor: (busy || !file) ? 'default' : 'pointer', marginTop: 16 }}>
        {busy ? 'جارٍ الإرسال…' : file ? 'أرسلت الحوالة — أرسل للمراجعة' : 'أرفق الإيصال أولاً ↑'}
      </button>
      {!file && (
        <p style={{ textAlign: 'center', color: '#9DB3AB', fontSize: 12, marginTop: 8, lineHeight: 1.9 }}>
          اضغط المربّع أعلاه لاختيار صورة الإيصال من جوّالك.<br />
          أو أرسله واتساب على{' '}
          <a href="https://wa.me/966570749196" target="_blank" rel="noopener noreferrer"
            style={{ color: '#1A7A5A', fontWeight: 900, textDecoration: 'none' }}>0570749196</a>
        </p>
      )}
      {err && <p style={{ textAlign: 'center', color: '#B4453C', fontSize: 13, fontWeight: 800, marginTop: 10, lineHeight: 1.8 }}>{err}</p>}
    </div>
  );
}

export default function TransferPage() {
  return (
    <Suspense fallback={<div dir="rtl" style={{ fontFamily: 'Cairo', textAlign: 'center', padding: 60, color: '#9DB3AB' }}>جارٍ التحميل…</div>}>
      <TransferInner />
    </Suspense>
  );
}
