'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

const TRACKS = [
  { id: 'funding', icon: '💰', title: 'أريد تمويلاً', en: 'FUNDING READINESS', desc: 'اعرف مدى جاهزية شركتك للحصول على تمويل، وما الذي يمنعها، وكيف تتأهل.', href: '/assessment/funding' },
  { id: 'investment', icon: '📈', title: 'أريد مستثمراً', en: 'INVESTMENT READINESS', desc: 'اعرف مدى جاذبية شركتك للمستثمرين، ونقاط القوة والضعف قبل العرض.', href: '/assessment/investment' },
  { id: 'ipo', icon: '🏛️', title: 'أريد تجهيز الشركة للطرح', en: 'IPO READINESS', desc: 'اعرف موقع شركتك على طريق الطرح، وخارطة الطريق للوصول للجاهزية.', href: '/assessment/ipo' },
];

export default function GoalPage() {
  const router = useRouter();
  const [selected, setSelected] = useState('funding');
  const [scores, setScores] = useState<Record<string, number>>({});
  const [company, setCompany] = useState<{ name: string; sector: string } | null>(null);
  const [showCard, setShowCard] = useState(false);

  useEffect(() => {
    const load = async () => {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL as string,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
      );
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: comp } = await supabase
        .from('companies').select('id, company_name, sector')
        .eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (!comp) return;
      setCompany({ name: comp.company_name || 'شركتك', sector: comp.sector || '' });
      const out: Record<string, number> = {};
      const { data: rows } = await supabase
        .from('readiness_results')
        .select('readiness_score, result_type, created_at')
        .eq('company_id', comp.id)
        .order('created_at', { ascending: false });
      for (const t of TRACKS) {
        const match = (rows || []).find(
          (r: { result_type?: string }) => (r.result_type || '').toLowerCase() === t.id
        );
        if (match) out[t.id] = match.readiness_score;
      }
      setScores(out);
    };
    load();
  }, []);

  const doneScores = Object.values(scores);
  const overall = doneScores.length ? Math.round(doneScores.reduce((a, b) => a + b, 0) / doneScores.length) : 0;
  const pct = overall >= 75 ? 90 : overall >= 70 ? 82 : overall >= 65 ? 74 : overall >= 55 ? 60 : overall >= 45 ? 45 : overall >= 35 ? 30 : 18;

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

        {/* ملف الجاهزية */}
        {doneScores.length > 0 && (
          <div className="mb-12">
            <div className="rounded-3xl p-8 mb-5 text-center" style={{ background: 'linear-gradient(135deg,#1A3D34,#2E5D4E)' }}>
              <p className="text-[#C9D8D0] text-sm font-bold mb-2">مؤشر جاهزية {company?.name || 'شركتك'}</p>
              <div className="text-6xl font-black text-[#C9A84C] leading-none">{overall}<span className="text-2xl text-[#9DB3AB]"> / 100</span></div>
              <p className="text-white font-bold mt-4">شركتك أفضل من <span className="text-[#C9A84C]">{pct}%</span> من الشركات في مرحلتك</p>
              <p className="text-[#8FA8A0] text-xs font-bold mt-1">يتحدّث مع كل تقييم</p>
            </div>
            <div className="grid grid-cols-3 gap-4 mb-5">
              {TRACKS.map((t) => (
                <div key={t.id} className="bg-white rounded-2xl p-5 border-2 border-[#F0F5F3] text-center">
                  <div className="text-2xl mb-1">{t.icon}</div>
                  <div className="font-black text-[#1A3D34] text-sm mb-2">{t.title.replace('أريد ', '').replace('تجهيز الشركة لل', '')}</div>
                  {scores[t.id] !== undefined ? (
                    <div className={'text-3xl font-black leading-none ' + (scores[t.id] >= 70 ? 'text-[#1A3D34]' : 'text-[#C9A84C]')}>{scores[t.id]}</div>
                  ) : (
                    <div className="text-xs font-bold text-[#A3BAB2] mt-2">لم يُقيَّم</div>
                  )}
                </div>
              ))}
            </div>
            <div className="text-center">
              <button onClick={() => setShowCard(true)} className="px-8 py-3 rounded-full bg-[#C9A84C] text-[#1A3D34] font-black text-sm">📄 بطاقة عرض شركتك</button>
            </div>
          </div>
        )}

        {showCard && company && (
          <div onClick={() => setShowCard(false)} className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(11,28,30,0.55)' }}>
            <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-3xl p-8 max-w-md w-full">
              <div className="border-b-2 border-[#C9A84C] pb-3 mb-4">
                <div className="text-xl font-black text-[#1A3D34]" style={{ fontFamily: 'Amiri, serif' }}>{company.name}</div>
                <div className="text-[#6B8A80] text-xs font-bold">{company.sector ? 'قطاع ' + company.sector + ' • ' : ''}ملف جاهزية رأس المال</div>
              </div>
              <div className="flex justify-between mb-4">
                <div className="text-center">
                  <div className="text-3xl font-black text-[#C9A84C] leading-none">{overall}</div>
                  <div className="text-[10px] text-[#9DB3AB] font-bold mt-1">عام /100</div>
                </div>
                {TRACKS.filter((t) => scores[t.id] !== undefined).map((t) => (
                  <div key={t.id} className="text-center">
                    <div className="text-2xl font-black text-[#1A3D34] leading-none">{scores[t.id]}</div>
                    <div className="text-[10px] text-[#9DB3AB] font-bold mt-1">{t.title.replace('أريد ', '').replace('تجهيز الشركة لل', '')}</div>
                  </div>
                ))}
              </div>
              <p className="text-[#9DB3AB] text-xs font-bold text-center mb-4">صادر عن منصة مُرضي — د. عبدالحكيم المرضي</p>
              <button onClick={() => window.print()} className="w-full py-3 rounded-full bg-[#1A3D34] text-white font-black text-sm">طباعة / حفظ PDF</button>
            </div>
          </div>
        )}

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
        <div className="grid md:grid-cols-3 gap-5 mb-16">
          <a href="/dashboard/consultation" className="block bg-white rounded-3xl p-7 border-2 border-[#C9A84C] hover:shadow-md transition">
            <div className="text-3xl mb-3">🎓</div>
            <h3 className="font-black text-[#1A3D34] text-lg mb-2">استشارتك الخاصة + أسئلتك</h3>
            <p className="text-[#6B8A80] text-sm font-bold leading-relaxed mb-3">استشارة شهرية مخصصة لشركتك وفق منهجية د. عبدالحكيم المرضي: تحليل خاص، خطة نجاح، وتوعية مالية. وضع أسئلتك على مدار الشهر وسيرد عليها الفريق.</p>
            <span className="text-[#C9A84C] font-black text-sm">افتح استشارتك ←</span>
          </a>
          <a href="/dashboard/consultation" className="block bg-white rounded-3xl p-7 border-2 border-[#E8F5EF] hover:shadow-md transition">
            <div className="text-3xl mb-3">✏️</div>
            <h3 className="font-black text-[#1A3D34] text-lg mb-2">تصحيح بيانات التقييم</h3>
            <p className="text-[#6B8A80] text-sm font-bold leading-relaxed mb-3">أخطأت في إدخال بياناتك؟ أرسل طلب تعديل وسيراجعه فريق د. عبدالحكيم ويفتح لك الإدخال من جديد، وتُحدَّث استشارتك بناءً على بياناتك الصحيحة.</p>
            <span className="text-[#2E9E7B] font-black text-sm">تصحيح البيانات ←</span>
          </a>
          <a href="https://wa.me/966570314005?text=%D8%A7%D9%84%D8%B3%D9%84%D8%A7%D9%85%20%D8%B9%D9%84%D9%8A%D9%83%D9%85%D8%8C%20%D8%A3%D9%88%D8%A7%D8%AC%D9%87%20%D9%85%D8%B4%D9%83%D9%84%D8%A9%20%D8%AA%D9%82%D9%86%D9%8A%D8%A9%20%D9%81%D9%8A%20%D9%85%D9%8F%D8%B1%D8%B6%D9%8A" target="_blank" rel="noopener noreferrer" className="block bg-white rounded-3xl p-7 border-2 border-[#E8F5EF] hover:shadow-md transition">
            <div className="text-3xl mb-3">📞</div>
            <h3 className="font-black text-[#1A3D34] text-lg mb-2">الدعم الفني</h3>
            <p className="text-[#6B8A80] text-sm font-bold leading-relaxed mb-3">واجهت مشكلة تقنية في المنصة (تسجيل دخول، صفحة لا تفتح، خطأ في النظام)؟ تواصل مع فريق مُرضي مباشرة عبر واتساب.</p>
            <span className="text-[#2E9E7B] font-black text-sm">تواصل عبر واتساب ←</span>
          </a>
        </div>

        {/* خدمات التنفيذ مع فريق مُرضي */}
        <div className="mb-16">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-black text-[#1A3D34] mb-2" style={{ fontFamily: 'Amiri, serif' }}>من التوصية إلى التنفيذ</h2>
            <p className="text-[#6B8A80] font-bold text-sm leading-relaxed max-w-xl mx-auto">المنصة تكشف لك ما تحتاجه شركتك. وفريق د. عبدالحكيم المرضي ينفّذه معك خطوةً بخطوة. هذه خدمات التنفيذ المتاحة:</p>
          </div>
          {[
            { label: 'خدمات أساسية', note: 'تخدم المسارات الثلاثة', items: [
              { icon: '📊', title: 'إعداد القوائم المالية المعتمدة', desc: 'قوائم مالية وفق المعايير المحاسبية المعتمدة، جاهزة للعرض على الممولين والمستثمرين والجهات الرقابية.' },
              { icon: '🏛️', title: 'بناء الحوكمة المؤسسية', desc: 'لوائح الحوكمة ومجلس الإدارة واللجان، وفصل الملكية عن الإدارة لترتقي شركتك لمستوى مؤسسي.' },
              { icon: '💎', title: 'التقييم العادل المعمّق', desc: 'تقدير قيمة شركتك بمنهجية متكاملة تعتمد على أرقامك وقطاعك، لتتفاوض من موقع قوة.' },
              { icon: '🔧', title: 'إعادة الهيكلة المالية ومعالجة التعثّر', desc: 'إعادة جدولة الديون، وقف النزيف النقدي، واستعادة انتظام السداد لتمهيد تعافٍ حقيقي.' },
            ]},
            { label: 'مسار التمويل', note: 'للوصول إلى التمويل المناسب', items: [
              { icon: '🏦', title: 'تجهيز ملف التمويل والتفاوض', desc: 'إعداد ملفك التمويلي بصورة تُقنع البنوك وجهات التمويل، ومرافقتك في التفاوض حتى الحصول على التمويل.' },
              { icon: '🗓️', title: 'إعادة جدولة الديون', desc: 'إعادة ترتيب التزاماتك القائمة بما يخفّف الضغط النقدي ويحسّن قدرتك على السداد.' },
            ]},
            { label: 'مسار الاستثمار', note: 'لجعل شركتك جاذبة للمستثمر', items: [
              { icon: '📈', title: 'تجهيز ملف عرض المستثمر', desc: 'بناء ملف العرض (Pitch) الذي يُبرز قيمة شركتك ويطمئن المستثمر المؤسسي.' },
              { icon: '🎯', title: 'بناء خطة جذب المستثمر', desc: 'خطة عملية ترفع جاذبية شركتك وتجهّزها للعرض على الجهات الاستثمارية المناسبة.' },
            ]},
            { label: 'مسار الطرح والإدراج', note: 'الطريق المؤسسي نحو السوق المالية', items: [
              { icon: '📁', title: 'تجهيز ملف هيئة السوق المالية', desc: 'إعداد ملف الطرح الكامل وفق متطلبات الهيئة خطوةً بخطوة، بمرافقة المستشار المالي المرخّص.' },
              { icon: '⚖️', title: 'تشكيل لجنة المراجعة والحوكمة', desc: 'تأسيس اللجان والهياكل التي يتطلبها الإدراج، وضمان توافقها مع لوائح الهيئة.' },
              { icon: '🗺️', title: 'خارطة طريق الإدراج', desc: 'خطة تنفيذية مرحلية بالمدد والمتطلبات، تقودك من وضعك الحالي حتى لحظة الإدراج.' },
            ]},
          ].map((cat, ci) => (
            <div key={ci} className="mb-7">
              <div className="flex items-baseline gap-3 mb-4 border-b-2 border-[#EAF2EE] pb-2">
                <span className="text-lg font-black text-[#1A3D34]">{cat.label}</span>
                <span className="text-[#9DB3AB] text-xs font-bold">{cat.note}</span>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                {cat.items.map((it, ii) => (
                  <div key={ii} className="bg-white rounded-2xl p-6 border-2 border-[#EAF2EE] flex flex-col">
                    <div className="text-2xl mb-2">{it.icon}</div>
                    <h4 className="font-black text-[#1A3D34] text-base mb-2 leading-snug">{it.title}</h4>
                    <p className="text-[#6B8A80] text-sm font-bold leading-relaxed flex-1 mb-4">{it.desc}</p>
                    <a href={'https://wa.me/966570314005?text=' + encodeURIComponent('السلام عليكم، أرغب بمعرفة تفاصيل خدمة: ' + it.title)} target="_blank" rel="noopener noreferrer" className="text-center py-2.5 rounded-full bg-[#1A3D34] text-white font-black text-sm">تواصل لمعرفة التفاصيل ←</a>
                  </div>
                ))}
              </div>
            </div>
          ))}
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
