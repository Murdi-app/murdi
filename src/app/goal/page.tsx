'use client';

import { useState, useEffect } from 'react';
import ConsultationPanel from './ConsultationPanel';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { SERVICES, TRACK_LABEL } from '@/lib/serviceSuggestion';
import { COMMISSION_SERVICES } from '@/lib/contracts';

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
  const [tab, setTab] = useState<'overview' | 'consult' | 'services'>('overview');
  const [highlightService, setHighlightService] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [subscriptionActive, setSubscriptionActive] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [serviceRequests, setServiceRequests] = useState<Record<string, { id: string; status: string; price: number | null; deliverable: string | null }>>({});
  const [clientContracts, setClientContracts] = useState<Record<string, { id: string; status: string; body: string; signedUrl: string | null }>>({});

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('tab');
    if (t === 'services' || t === 'consult' || t === 'overview') setTab(t);
    const h = params.get('highlight');
    if (h) setHighlightService(h);
  }, []);

  useEffect(() => {
    const load = async () => {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL as string,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
      );
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: comp } = await supabase
        .from('companies').select('id, company_name, sector, subscription_active, subscription_until')
        .eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (!comp) return;
      setCompany({ name: comp.company_name || 'شركتك', sector: comp.sector || '' });
      const subActive = comp.subscription_active === true && (!comp.subscription_until || new Date(comp.subscription_until) > new Date());
      setSubscriptionActive(subActive);
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
      setCompanyId(comp.id);
      const { data: reqs } = await supabase
        .from('service_requests')
        .select('id, service_title, status, price, admin_deliverable')
        .eq('company_id', comp.id)
        .order('created_at', { ascending: false });
      const reqMap: Record<string, { id: string; status: string; price: number | null; deliverable: string | null }> = {};
      for (const r of (reqs || [])) { if (!reqMap[r.service_title]) reqMap[r.service_title] = { id: r.id, status: r.status, price: r.price, deliverable: r.admin_deliverable }; }
      setServiceRequests(reqMap);
      const { data: ctrs } = await supabase
        .from('contracts')
        .select('id, contract_type, status, contract_body, signed_file_url')
        .eq('company_id', comp.id)
        .order('created_at', { ascending: false });
      const ctrMap: Record<string, { id: string; status: string; body: string; signedUrl: string | null }> = {};
      for (const c of (ctrs || [])) { if (c.status !== 'draft' && !ctrMap[c.contract_type]) ctrMap[c.contract_type] = { id: c.id, status: c.status, body: c.contract_body, signedUrl: c.signed_file_url }; }
      setClientContracts(ctrMap);
    };
    load();
  }, []);

  const doneScores = Object.values(scores);
  const overall = doneScores.length ? Math.round(doneScores.reduce((a, b) => a + b, 0) / doneScores.length) : 0;
  const pct = overall >= 75 ? 90 : overall >= 70 ? 82 : overall >= 65 ? 74 : overall >= 55 ? 60 : overall >= 45 ? 45 : overall >= 35 ? 30 : 18;

  const submitServiceRequest = async (title: string, category: string) => {
    if (!companyId) return;
    setServiceRequests((prev) => ({ ...prev, [title]: { id: '', status: 'submitted', price: null, deliverable: null } }));
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
    );
    const { error } = await supabase.from('service_requests').insert({
      company_id: companyId,
      service_title: title,
      service_category: category,
      status: 'submitted',
    });
    if (error) { console.error('فشل حفظ طلب الخدمة:', error); setServiceRequests((prev) => { const c = { ...prev }; delete c[title]; return c; }); }
  };

  const uploadSignedContract = async (contractId: string, contractType: string, file: File) => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
    );
    const path = companyId + '/' + contractId + '_' + Date.now() + '_' + file.name;
    const { error: upErr } = await supabase.storage.from('contracts').upload(path, file);
    if (upErr) { alert('تعذّر رفع الملف، حاول مرة أخرى'); return; }
    const { data: pub } = supabase.storage.from('contracts').getPublicUrl(path);
    await supabase.from('contracts').update({ signed_file_url: pub.publicUrl, status: 'signed', signed_at: new Date().toISOString() }).eq('id', contractId);
    setClientContracts((prev) => ({ ...prev, [contractType]: { ...prev[contractType], status: 'signed', signedUrl: pub.publicUrl } }));
    alert('تم رفع العقد الموقّع بنجاح، شكراً لك');
  };

  const go = () => {
    if (!subscriptionActive) { setShowPaywall(true); return; }
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
              <span className="font-black text-[#2E9E7B] text-lg block leading-tight">مُرضي</span>
              <span className="text-[10px] tracking-widest text-[#A3BAB2] font-black">MURDI</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a href="/auth/login" className="px-4 py-2 rounded-full border border-[#E8F5EF] text-[#6B8A80] font-bold text-sm">خروج</a>
          </div>
        </div>
      </nav>

      {/* شريط التبويبات */}
      <div className="bg-white border-b border-[#F0F5F3] px-6">
        <div className="max-w-5xl mx-auto flex gap-1">
          {[
            { id: 'overview', label: 'نظرة عامة' },
            { id: 'consult', label: 'الاستشارة والأسئلة' },
            { id: 'services', label: 'الخدمات' },
          ].map((t) => (
            <button key={t.id} onClick={() => setTab(t.id as 'overview' | 'consult' | 'services')}
              className={'px-5 py-4 font-black text-sm transition border-b-2 ' + (tab === t.id ? 'text-[#2E9E7B] border-[#2E9E7B]' : 'text-[#6B8A80] border-transparent')}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-12">

        {tab === 'overview' && (<>
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
        </>)}

        <div style={{ display: tab === 'consult' ? 'block' : 'none' }}>
        <ConsultationPanel />
        </div>
        {tab === 'consult' && (<>
        {/* الدعم الفني */}
        <div className="grid md:grid-cols-1 gap-5 mb-16">
          <a href="https://wa.me/966570314005?text=%D8%A7%D9%84%D8%B3%D9%84%D8%A7%D9%85%20%D8%B9%D9%84%D9%8A%D9%83%D9%85%D8%8C%20%D8%A3%D9%88%D8%A7%D8%AC%D9%87%20%D9%85%D8%B4%D9%83%D9%84%D8%A9%20%D8%AA%D9%82%D9%86%D9%8A%D8%A9%20%D9%81%D9%8A%20%D9%85%D9%8F%D8%B1%D8%B6%D9%8A" target="_blank" rel="noopener noreferrer" className="block bg-white rounded-3xl p-7 border-2 border-[#E8F5EF] hover:shadow-md transition">
            <div className="text-3xl mb-3">📞</div>
            <h3 className="font-black text-[#1A3D34] text-lg mb-2">الدعم الفني</h3>
            <p className="text-[#6B8A80] text-sm font-bold leading-relaxed mb-3">واجهت مشكلة تقنية في المنصة (تسجيل دخول، صفحة لا تفتح، خطأ في النظام)؟ تواصل مع فريق مُرضي مباشرة عبر واتساب.</p>
            <span className="text-[#2E9E7B] font-black text-sm">تواصل عبر واتساب ←</span>
          </a>
        </div>
        </>)}

        {tab === 'services' && (
        <div className="mb-16">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-black text-[#1A3D34] mb-2" style={{ fontFamily: 'Amiri, serif' }}>من التوصية إلى التنفيذ</h2>
            <p className="text-[#6B8A80] font-bold text-sm leading-relaxed max-w-xl mx-auto">المنصة تكشف لك ما تحتاجه شركتك. وفريق د. عبدالحكيم المرضي ينفّذه معك خطوةً بخطوة. هذه خدمات التنفيذ المتاحة:</p>
          </div>
          {[
            { label: 'خدمات أساسية', note: 'تخدم المسارات الثلاثة', items: [
              { icon: '📊', title: 'إعداد القوائم المالية المعتمدة', display: 'تجهيز ملف القوائم المالية الجاهز للاعتماد', desc: 'قوائم مالية وفق المعايير المحاسبية المعتمدة، جاهزة للعرض على الممولين والمستثمرين والجهات الرقابية.' },
              { icon: '🏛️', title: 'بناء الحوكمة المؤسسية', display: 'إعداد لوائح الحوكمة ومسوّداتها الجاهزة', desc: 'لوائح الحوكمة ومجلس الإدارة واللجان، وفصل الملكية عن الإدارة لترتقي شركتك لمستوى مؤسسي.' },
              { icon: '💎', title: 'التقييم العادل المعمّق', display: 'تقرير تقييم القيمة العادلة المعمّق', desc: 'تقدير قيمة شركتك بمنهجية متكاملة تعتمد على أرقامك وقطاعك، لتتفاوض من موقع قوة.' },
              { icon: '🔧', title: 'إعادة الهيكلة المالية ومعالجة التعثّر', display: 'خطة إعادة الهيكلة المالية ومعالجة التعثّر', desc: 'إعادة جدولة الديون، وقف النزيف النقدي، واستعادة انتظام السداد لتمهيد تعافٍ حقيقي.' },
            ]},
            { label: 'مسار التمويل', note: 'للوصول إلى التمويل المناسب', items: [
              { icon: '🏦', title: 'تجهيز ملف التمويل والتفاوض', desc: 'إعداد ملفك التمويلي بصورة تُقنع البنوك وجهات التمويل، ومرافقتك في التفاوض حتى الحصول على التمويل.' },
              { icon: '🗓️', title: 'إعادة جدولة الديون', display: 'خطة إعادة جدولة الديون', desc: 'إعادة ترتيب التزاماتك القائمة بما يخفّف الضغط النقدي ويحسّن قدرتك على السداد.' },
            ]},
            { label: 'مسار الاستثمار', note: 'لجعل شركتك جاذبة للمستثمر', items: [
              { icon: '📈', title: 'تجهيز ملف عرض المستثمر والتفاوض', desc: 'الخطوة الأخيرة قبل المستثمر: نبني ملف العرض (Pitch) الذي يُبرز قيمة شركتك الجاهزة ويطمئن المستثمر المؤسسي، ونرافقك في التفاوض حتى إتمام الصفقة. للشركات التي بلغت جاهزيتها.' },
              { icon: '🎯', title: 'بناء خطة جذب المستثمر', desc: 'الخطوة التمهيدية: نعالج الفجوات التي تخفض جاذبية شركتك (الحوكمة، تركّز العملاء، وضوح الأرقام) ونرفع جاهزيتها — قبل أن تُعرض على المستثمر. تأتي قبل تجهيز ملف العرض.' },
            ]},
            { label: 'مسار الطرح والإدراج', note: 'الطريق المؤسسي نحو السوق المالية', items: [
              { icon: '📁', title: 'تجهيز ملف هيئة السوق المالية', desc: 'خدمة استشارية ترافقك في التهيؤ للإدراج: تحديد متطلبات الهيئة النظامية وتجهيز ملف الشركة، والتنسيق مع مستشار مالي مرخّص يتولّى الإجراءات الخاضعة للترخيص.' },
              { icon: '⚖️', title: 'تشكيل لجنة المراجعة والحوكمة', display: 'خطة تشكيل لجنة المراجعة والحوكمة', desc: 'تأسيس اللجان والهياكل التي يتطلبها الإدراج، وضمان توافقها مع لوائح الهيئة.' },
              { icon: '🗺️', title: 'خارطة طريق الإدراج', desc: 'خطة تنفيذية مرحلية بالمدد والمتطلبات، تقودك من وضعك الحالي حتى لحظة الإدراج.' },
            ]},
          ].map((cat, ci) => (
            <div key={ci} className="mb-7">
              <div className="flex items-baseline gap-3 mb-4 border-b-2 border-[#EAF2EE] pb-2">
                <span className="text-lg font-black text-[#1A3D34]">{cat.label}</span>
                <span className="text-[#9DB3AB] text-xs font-bold">{cat.note}</span>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                {cat.items.map((it, ii) => {
                  const isHighlighted = highlightService === it.title;
                  return (
                  <div key={ii}
                    ref={isHighlighted ? (el) => { if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 400); } : undefined}
                    className="bg-white rounded-2xl p-6 flex flex-col"
                    style={{ border: isHighlighted ? '2.5px solid #C9A84C' : '2px solid #EAF2EE', boxShadow: isHighlighted ? '0 0 0 4px rgba(201,168,76,0.15)' : undefined }}>
                    {isHighlighted && <div style={{ background: '#C9A84C', color: '#fff', fontSize: 11, fontWeight: 900, padding: '3px 12px', borderRadius: 999, alignSelf: 'flex-start', marginBottom: 10 }}>⭐ الخدمة المقترحة لك</div>}
                    <div className="text-2xl mb-2">{it.icon}</div>
                    <h4 className="font-black text-[#1A3D34] text-base mb-2 leading-snug">{(it as any).display || it.title}</h4>
                    <p className="text-[#6B8A80] text-sm font-bold leading-relaxed flex-1 mb-4">{it.desc}</p>
                    {(() => {
                      const req = serviceRequests[it.title];
                      const def = SERVICES[it.title];
                      const neededTracks = def?.tracks || [];
                      const hasTrack = neededTracks.length === 0 || neededTracks.some((tk) => scores[tk] !== undefined);
                      if (!req && !hasTrack) {
                        const missing = neededTracks.map((tk) => TRACK_LABEL[tk]).join(' أو ');
                        const firstTrack = neededTracks[0];
                        return (
                          <div className="flex flex-col gap-2">
                            <div className="rounded-2xl bg-[#FBF5E8] border border-[#EAD9A8] p-3 text-center">
                              <div className="text-[#9A7B2E] font-black text-sm mb-1">🔒 تحتاج تقييم مسار {missing}</div>
                              <div className="text-[#6B5A2E] text-xs font-bold leading-relaxed">هذه الخدمة تخص مسار {missing}. قيّم جاهزيتك فيه أولاً ليتمكّن فريق مُرضي من تحليل دقيق وفق منهجيته.</div>
                            </div>
                            <button onClick={() => router.push('/assessment/' + firstTrack)} className="text-center py-2.5 rounded-full bg-[#C9A84C] text-[#1A3D34] font-black text-sm">ابدأ تقييم {TRACK_LABEL[firstTrack]} ←</button>
                          </div>
                        );
                      }
                      if (!req) {
                        return (
                          <div className="flex flex-col gap-2">
                            <button onClick={() => submitServiceRequest(it.title, cat.label)} className="text-center py-2.5 rounded-full bg-[#2E9E7B] text-white font-black text-sm">📤 تقديم طلب الخدمة</button>
                            <a href={'https://wa.me/966570314005?text=' + encodeURIComponent('السلام عليكم، أستفسر عن خدمة: ' + ((it as any).display || it.title))} target="_blank" rel="noopener noreferrer" className="text-center py-2 rounded-full border border-[#E8F5EF] text-[#6B8A80] font-bold text-xs">استفسار سريع عبر واتساب</a>
                          </div>
                        );
                      }
                      const STAT: Record<string, { t: string; bg: string; fg: string }> = {
                        submitted: { t: '⏳ بانتظار الفريق والدكتور', bg: '#FBF5E8', fg: '#9A7B2E' },
                        in_progress: { t: '🛠️ قيد التجهيز', bg: '#EAF0FB', fg: '#3B5BA5' },
                        priced: { t: '💳 جاهزة — بانتظار الدفع', bg: '#FBF3DC', fg: '#B8860B' },
                        paid: { t: '✅ تم الدفع — يُجهَّز التسليم', bg: '#E8F5EF', fg: '#1A7A4C' },
                        delivered: { t: '✅ جاهزة — يمكنك طباعتها', bg: '#EAF7F0', fg: '#1E7A5A' },
                        completed: { t: '🏆 مكتملة', bg: '#EAF7F0', fg: '#1E7A5A' },
                      };
                      const st = STAT[req.status] || STAT.submitted;
                      return (
                        <div className="flex flex-col gap-2">
                          <div className="text-center py-2.5 rounded-full font-black text-sm" style={{ background: st.bg, color: st.fg }}>{st.t}</div>
                          {req.status === 'priced' && req.price && (
                            <div className="flex flex-col gap-2 mt-1">
                              <div className="text-center text-[#1A3D34] font-black text-lg">{Number(req.price).toLocaleString('ar-SA')} ر.س</div>
                              <button onClick={() => router.push('/pay?amount=' + req.price + '&kind=service&company_id=' + companyId + '&sr=' + (req.id || ''))} className="text-center py-2.5 rounded-full bg-[#1A3D34] text-white font-black text-sm">💳 ادفع أونلاين</button>
                              <button onClick={() => router.push('/pay/transfer?amount=' + req.price + '&kind=service&company_id=' + companyId + '&sr=' + (req.id || ''))} className="text-center py-2 rounded-full border-2 border-[#1A3D34] text-[#1A3D34] font-black text-xs">🏦 تحويل بنكي</button>
                            </div>
                          )}
                          {req.status === 'delivered' && req.deliverable && (
                            <button onClick={() => { const w = window.open('', '', 'width=800'); if (w) { w.document.write('<html dir=rtl><head><meta charset=utf-8><title>' + ((it as any).display || it.title) + '</title></head><body style="font-family:Cairo,Arial;padding:32px;line-height:2;white-space:pre-wrap">' + (req.deliverable || '') + '</body></html>'); w.document.close(); w.print(); } }} className="text-center py-2 rounded-full bg-[#1A3D34] text-white font-black text-xs">🖨️ طباعة الخدمة</button>
                          )}
                        </div>
                      );
                    })()}
                    {COMMISSION_SERVICES[it.title] && (() => {
                      const ctype = COMMISSION_SERVICES[it.title];
                      const ctr = clientContracts[ctype];
                      if (!ctr) return null;
                      return (
                        <div className="mt-3 pt-3 border-t border-dashed border-[#EAD9A8]">
                          <div className="text-[#9A7B2E] font-black text-xs mb-2">📄 عقد الخدمة {ctr.status === 'signed' ? '— تم استلام توقيعك ✅' : '— بانتظار توقيعك'}</div>
                          <div className="flex flex-col gap-2">
                            <button onClick={() => { const w = window.open('', '', 'width=800'); if (w) { w.document.write('<html dir=rtl><head><meta charset=utf-8><title>عقد</title></head><body style="font-family:Cairo,Arial;padding:32px;line-height:2;white-space:pre-wrap">' + (ctr.body || '') + '</body></html>'); w.document.close(); w.print(); } }} className="text-center py-2 rounded-full bg-[#1A3D34] text-white font-black text-xs">🖨️ اطبع العقد لقراءته وتوقيعه</button>
                            {ctr.status !== 'signed' && (
                              <label className="text-center py-2 rounded-full bg-[#C9A84C] text-[#1A3D34] font-black text-xs cursor-pointer">
                                📎 ارفع العقد بعد توقيعه
                                <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadSignedContract(ctr.id, ctype, f); }} />
                              </label>
                            )}
                            {ctr.status === 'signed' && <div className="text-center py-2 rounded-full bg-[#EAF7F0] text-[#1E7A5A] font-black text-xs">✅ تم رفع العقد الموقّع — فريق مُرضي يتابع معك</div>}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        )}

        {tab === 'overview' && (<>
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
        </>)}

      </div>

      {showPaywall && (
        <div onClick={() => setShowPaywall(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(26,61,52,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} dir="rtl" style={{ fontFamily: 'Cairo', background: '#fff', borderRadius: 20, maxWidth: 440, width: '100%', padding: '32px 28px', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <div style={{ fontSize: 44, marginBottom: 8 }}>🔑</div>
            <h2 style={{ color: '#1A3D34', fontSize: 22, fontWeight: 900, margin: '0 0 10px' }}>افتح كامل منصّة مُرضي</h2>
            <p style={{ color: '#3A4D47', fontSize: 14.5, lineHeight: 1.9, margin: '0 0 8px' }}>
              باشتراكك تفتح جميع مسارات الجاهزية (التمويل، الاستثمار، الطرح)، مع التقييم الكامل، خطة التحسين، ومتابعة د. عبدالحكيم المرضي.
            </p>
            <div style={{ color: '#1A3D34', fontSize: 28, fontWeight: 900, margin: '14px 0 4px' }}>2,900 <span style={{ fontSize: 15 }}>ر.س</span></div>
            <div style={{ color: '#6B8A80', fontSize: 12.5, marginBottom: 20 }}>لكل أربعة أشهر — يشمل كل شيء</div>
            <button onClick={() => router.push('/pay?amount=2900&kind=subscription&company_id=' + companyId)}
              style={{ width: '100%', background: '#1A3D34', color: '#fff', border: 'none', padding: '14px', borderRadius: 999, fontFamily: 'Cairo', fontWeight: 900, fontSize: 15, cursor: 'pointer', marginBottom: 10 }}>
              💳 الدفع أونلاين (بطاقة)
            </button>
            <button onClick={() => router.push('/pay/transfer?amount=2900&kind=subscription&company_id=' + companyId)}
              style={{ width: '100%', background: '#fff', color: '#1A3D34', border: '2px solid #1A3D34', padding: '12px', borderRadius: 999, fontFamily: 'Cairo', fontWeight: 900, fontSize: 15, cursor: 'pointer', marginBottom: 10 }}>
              🏦 تحويل بنكي
            </button>
            <button onClick={() => setShowPaywall(false)}
              style={{ width: '100%', background: 'transparent', color: '#9DB3AB', border: 'none', padding: '8px', fontFamily: 'Cairo', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              ربما لاحقاً
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
