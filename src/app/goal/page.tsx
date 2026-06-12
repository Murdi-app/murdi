'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const TRACKS = [
  { id: 'funding', icon: '💰', title: 'أريد تمويلاً', en: 'FUNDING READINESS', desc: 'اعرف مدى جاهزية شركتك للحصول على تمويل، وما الذي يمنعها، وكيف تتأهل.', href: '/assessment/funding' },
  { id: 'investment', icon: '📈', title: 'أريد مستثمراً', en: 'INVESTMENT READINESS', desc: 'اعرف مدى جاذبية شركتك للمستثمرين، ونقاط القوة والضعف قبل العرض.', href: '/assessment/investment' },
  { id: 'ipo', icon: '🏛️', title: 'أريد تجهيز الشركة للطرح', en: 'IPO READINESS', desc: 'اعرف موقع شركتك على طريق الطرح، وخارطة الطريق للوصول للجاهزية.', href: '/assessment/ipo' },
];

export default function GoalPage() {
  const router = useRouter();
  const [selected, setSelected] = useState('funding');

  const go = () => {
    const t = TRACKS.find((x) => x.id === selected);
    if (t) router.push(t.href);
  };

  return (
    <div dir="rtl" className="min-h-screen bg-[#FBFCFB]" style={{ fontFamily: 'Cairo, sans-serif' }}>

      {/* الشريط العلوي */}
      <nav className="bg-white border-b border-[#F0F5F3] px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-[#2E9E7B] flex items-center justify-center">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M3 17L9 11L13 15L21 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M15 7H21V13" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <div>
              <span className="font-black text-[#1A3D34] text-lg block leading-tight">مُرضي</span>
              <span className="text-[10px] tracking-widest text-[#A3BAB2] font-black">MURDI</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a href="/dashboard/consultation" className="px-5 py-2 rounded-full bg-[#C9A84C] text-white font-black text-sm">🎓 استشارتي</a>
            <a href="/auth/login" className="px-4 py-2 rounded-full border border-[#E8F5EF] text-[#6B8A80] font-bold text-sm">خروج</a>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 py-12">

        {/* الترحيب والمسارات */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-black text-[#1A3D34] mb-2" style={{ fontFamily: 'Amiri, serif' }}>ما هدف شركتك القادم؟</h1>
          <p className="text-[#6B8A80] font-bold">اختر هدفك، وسنوجّه التحليل والتقييم بناءً عليه</p>
        </div>

        <div className="grid md:grid-cols-3 gap-5 mb-8">
          {TRACKS.map((t) => (
            <button key={t.id} onClick={() => setSelected(t.id)}
              className={'text-right bg-white rounded-3xl p-7 border-2 transition relative ' + (selected === t.id ? 'border-[#2E9E7B] shadow-md' : 'border-[#F0F5F3]')}>
              {selected === t.id && (
                <span className="absolute top-4 left-4 w-7 h-7 rounded-full bg-[#2E9E7B] text-white flex items-center justify-center text-sm font-black">✓</span>
              )}
              <div className="w-14 h-14 rounded-2xl bg-[#2E9E7B] flex items-center justify-center text-2xl mb-4">{t.icon}</div>
              <h3 className="font-black text-[#1A3D34] text-lg mb-1">{t.title}</h3>
              <p className="text-[10px] tracking-widest text-[#A3BAB2] font-black mb-3">{t.en}</p>
              <p className="text-[#6B8A80] text-sm font-bold leading-relaxed">{t.desc}</p>
            </button>
          ))}
        </div>

        <div className="text-center mb-16">
          <button onClick={go} className="px-14 py-4 rounded-full bg-[#2E9E7B] text-white font-black text-lg shadow-lg shadow-[#2E9E7B]/25">
            ابدأ التقييم
          </button>
        </div>

        {/* بطاقات الخدمات الشهرية */}
        <h2 className="text-xl font-black text-[#1A3D34] mb-5 text-center">خدماتك الشهرية في مُرضي</h2>
        <div className="grid md:grid-cols-2 gap-5 mb-16">
          <a href="/dashboard/consultation" className="block bg-white rounded-3xl p-7 border-2 border-[#C9A84C] hover:shadow-md transition">
            <div className="text-3xl mb-3">🎓</div>
            <h3 className="font-black text-[#1A3D34] text-lg mb-2">استشارتك الخاصة + أسئلتك</h3>
            <p className="text-[#6B8A80] text-sm font-bold leading-relaxed mb-3">استشارة شهرية مخصصة لشركتك وفق منهجية د. عبدالحكيم المرضي: تحليل خاص، خطة نجاح، وتوعية مالية. وضع أسئلتك على مدار الشهر وسيرد عليها الفريق.</p>
            <span className="text-[#C9A84C] font-black text-sm">افتح استشارتك ←</span>
          </a>
          <a href="/dashboard/consultation" className="block bg-white rounded-3xl p-7 border-2 border-[#E8F5EF] hover:shadow-md transition">
            <div className="text-3xl mb-3">🛠️</div>
            <h3 className="font-black text-[#1A3D34] text-lg mb-2">الدعم الخاص</h3>
            <p className="text-[#6B8A80] text-sm font-bold leading-relaxed mb-3">أخطأت في إدخال بياناتك؟ أرسل طلب تعديل وسيراجعه فريق د. عبدالحكيم ويفتح لك الإدخال من جديد، وتُحدَّث استشارتك بناءً على بياناتك الصحيحة.</p>
            <span className="text-[#2E9E7B] font-black text-sm">اطلب الدعم ←</span>
          </a>
        </div>

        {/* منهجية د. عبدالحكيم */}
        <div className="bg-[#1A3D34] rounded-3xl p-10 text-center mb-16">
          <p className="text-[#C9A84C] font-black text-sm tracking-widest mb-3">المنهجية</p>
          <h2 className="text-2xl font-black text-white mb-4" style={{ fontFamily: 'Amiri, serif' }}>مُرضي مبنية على منهجية د. عبدالحكيم المرضي</h2>
          <p className="text-[#A3BAB2] font-bold leading-loose max-w-2xl mx-auto mb-6">
            مستشار سعودي معتمد — دكتوراه في إدارة الأعمال، عضو في البورد الأمريكي لإدارة الأعمال، وخبرة 15 سنة في التمويل وفي مجال المال والأعمال.
            كل تحليل وتقييم واستشارة في المنصة تمر عبر هذه المنهجية: أرقامك الفعلية، معايير السوق السعودي، وكلام مباشر بلا مجاملات.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <span className="px-5 py-2 rounded-full bg-[#C9A84C] text-white font-black text-sm">✓ مستشار معتمد</span>
            <span className="px-5 py-2 rounded-full bg-white/10 text-white font-bold text-sm">تحليل احترافي</span>
            <span className="px-5 py-2 rounded-full bg-white/10 text-white font-bold text-sm">سرية تامة</span>
            <span className="px-5 py-2 rounded-full bg-white/10 text-white font-bold text-sm">لا نعرض كلام سوق</span>
          </div>
        </div>

        <p className="text-center text-[#A3BAB2] text-xs font-bold">
          نتائج مُرضي تمثل مؤشرات جاهزية مبدئية فقط، ولا تعني الموافقة النهائية من أي جهة تمويل أو استثمار.
        </p>

      </div>
    </div>
  );
}
