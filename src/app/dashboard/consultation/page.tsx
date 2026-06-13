'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';

type Question = { id: string; question: string; answer: string | null; status: string; created_at: string };

export default function ConsultationPage() {
  const [loading, setLoading] = useState(true);
  const [consultStatus, setConsultStatus] = useState('');
  const [consultContent, setConsultContent] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [newQuestion, setNewQuestion] = useState('');
  const [sendingQ, setSendingQ] = useState(false);
  const [editReason, setEditReason] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [sendingE, setSendingE] = useState(false);
  const [companyId, setCompanyId] = useState('');

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
  );

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user === null) { setLoading(false); return; }

      const { data: company } = await supabase
        .from('companies').select('id').eq('user_id', user.id).single();
      if (company === null) { setLoading(false); return; }
      setCompanyId(company.id);

      try {
        const cRes = await fetch('/api/consultation');
        const cData = await cRes.json();
        if (cData.consultation) {
          setConsultStatus(cData.consultation.status || '');
          setConsultContent(cData.consultation.content || '');
        }
      } catch {}

      const { data: qs } = await supabase
        .from('client_questions')
        .select('id, question, answer, status, created_at')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false });
      setQuestions(qs || []);

      const { data: er } = await supabase
        .from('edit_requests')
        .select('status')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false })
        .limit(1);
      if (er && er.length > 0) setEditStatus(er[0].status);

      setLoading(false);
    };
    load();
  }, []);

  const sendQuestion = async () => {
    if (newQuestion.trim() === '' || companyId === '') return;
    setSendingQ(true);
    await supabase.from('client_questions').insert({ company_id: companyId, question: newQuestion.trim() });
    setNewQuestion('');
    const { data: qs } = await supabase
      .from('client_questions')
      .select('id, question, answer, status, created_at')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    setQuestions(qs || []);
    setSendingQ(false);
  };

  const sendEditRequest = async () => {
    if (editReason.trim() === '' || companyId === '') return;
    setSendingE(true);
    await supabase.from('edit_requests').insert({ company_id: companyId, reason: editReason.trim() });
    setEditReason('');
    setEditStatus('pending');
    setSendingE(false);
  };

  if (loading) {
    return (
      <div dir="rtl" className="min-h-screen bg-[#FBFCFB] flex items-center justify-center" style={{ fontFamily: 'Cairo, sans-serif' }}>
        <p className="text-[#6B8A80] font-bold">جارٍ التحميل...</p>
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-[#FBFCFB]" style={{ fontFamily: 'Cairo, sans-serif' }}>
      <style>{`
        .print-only { display: none; }
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          body * { visibility: hidden; }
          #print-area, #print-area * { visibility: visible; }
          #print-area { position: absolute; top: 0; right: 0; left: 0; padding: 24px; }
          .consult-body { max-height: none !important; overflow: visible !important; border: none !important; background: white !important; }
        }
      `}</style>
      <nav className="bg-white border-b border-[#F0F5F3] px-6 py-4 no-print">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <a href="/goal" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-[#2E9E7B] flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M3 17L9 11L13 15L21 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M15 7H21V13" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <span className="font-black text-[#1A3D34]">مُرضي</span>
          </a>
          <a href="/goal" className="px-5 py-2 rounded-full border border-[#E8F5EF] text-[#6B8A80] font-bold text-sm">← الرئيسية</a>
        </div>
      </nav>
      <div className="max-w-2xl mx-auto space-y-6 px-4 py-10">

        <div className="text-center mb-2 no-print">
          <h1 className="text-2xl font-black text-[#1A3D34]">🎓 استشارة د. عبدالحكيم المرضي</h1>
          <p className="text-[#6B8A80] text-sm font-bold mt-1">استشارتك الخاصة، أسئلتك، والدعم — في مكان واحد</p>
        </div>

        {/* الاستشارة الخاصة */}
        <div className="bg-white rounded-3xl p-7 shadow-sm border-2 border-[#C9A84C]">
          <h2 className="font-black text-[#1A3D34] mb-1">استشارتك الخاصة لهذا الشهر</h2>
          <p className="text-[#6B8A80] text-xs font-bold mb-4">تحليل خاص + خطة نجاح + توعية مالية — لشركتك تحديداً</p>

          {consultStatus === '' && (
            <div className="bg-[#FBFCFB] rounded-2xl p-5 text-center border border-[#F0F5F3]">
              <p className="text-[#6B8A80] font-bold text-sm">أكمل تقييم شركتك أولاً لتبدأ استشارتك الخاصة</p>
            </div>
          )}

          {consultStatus !== '' && consultStatus !== 'released' && (
            <div className="bg-[#FBF5E8] rounded-2xl p-5 text-center">
              <div className="inline-block w-6 h-6 rounded-full border-2 border-[#C9A84C]/30 border-t-[#C9A84C] animate-spin mb-2" />
              <p className="text-[#9A7B2E] font-black text-sm">جارٍ التحليل من قبل د. عبدالحكيم المرضي...</p>
              <p className="text-[#A3BAB2] text-xs font-bold mt-1">ستصدر استشارتك هنا فور اكتمال المراجعة</p>
            </div>
          )}

          {consultStatus === 'released' && consultContent !== '' && (
            <>
              <button onClick={() => window.print()} className="no-print mb-4 px-6 py-2 rounded-full bg-[#1A3D34] text-white font-black text-sm">
                🖨️ طباعة الاستشارة
              </button>
              <div id="print-area">
                <div className="print-only" style={{ textAlign: 'center', marginBottom: 24, borderBottom: '3px solid #C9A84C', paddingBottom: 16 }}>
                  <h1 style={{ fontSize: 22, fontWeight: 900, color: '#1A3D34' }}>استشارة د. عبدالحكيم المرضي الخاصة</h1>
                  <p style={{ fontSize: 12, color: '#9A7B2E', fontWeight: 700 }}>شركة حلول المرضي للاستشارات المالية — منصة مُرضي | murdi.sa</p>
                </div>
                <div className="bg-[#FBFCFB] rounded-2xl p-5 border border-[#F0F5F3] whitespace-pre-wrap text-[#1A3D34] text-sm font-bold leading-loose consult-body" style={{ maxHeight: '600px', overflowY: 'auto' }}>
                  {consultContent.replace(/^#+ /gm, '').replace(/\*\*/g, '')}
                </div>
                <div className="print-only" style={{ marginTop: 40, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontFamily: 'Amiri, serif', fontSize: 20, color: '#1A3D34', marginBottom: 4 }}>د. عبدالحكيم المرضي</p>
                    <p style={{ fontSize: 11, color: '#6B8A80', fontWeight: 700, borderTop: '1px solid #1A3D34', paddingTop: 6 }}>المستشار المعتمد — التوقيع</p>
                  </div>
                  <div style={{ width: 150, height: 150, position: 'relative', transform: 'rotate(-6deg)' }}>
                    <svg viewBox="0 0 150 150" style={{ position: 'absolute', inset: 0 }}>
                      <circle cx="75" cy="75" r="72" fill="none" stroke="#C9A84C" strokeWidth="2.5"/>
                      <circle cx="75" cy="75" r="66" fill="none" stroke="#C9A84C" strokeWidth="1"/>
                      <circle cx="75" cy="75" r="46" fill="none" stroke="#C9A84C" strokeWidth="1" strokeDasharray="3 3"/>
                      <path id="stampTop" d="M 75 75 m -56 0 a 56 56 0 1 1 112 0" fill="none"/>
                      <path id="stampBottom" d="M 75 75 m -56 0 a 56 56 0 1 0 112 0" fill="none"/>
                      <text style={{ fontSize: 10.5, fontWeight: 900, fill: '#9A7B2E', letterSpacing: 1 }}>
                        <textPath href="#stampTop" startOffset="50%" textAnchor="middle">شركة حلول المرضي للاستشارات المالية</textPath>
                      </text>
                      <text style={{ fontSize: 9, fontWeight: 700, fill: '#C9A84C', letterSpacing: 4 }}>
                        <textPath href="#stampBottom" startOffset="50%" textAnchor="middle">MURDI ★ SAUDI ARABIA</textPath>
                      </text>
                      <text x="75" y="68" textAnchor="middle" style={{ fontSize: 13, fontWeight: 900, fill: '#1A3D34' }}>مُرضي</text>
                      <text x="75" y="84" textAnchor="middle" style={{ fontSize: 8, fontWeight: 700, fill: '#9A7B2E' }}>استشارة معتمدة</text>
                      <text x="75" y="96" textAnchor="middle" style={{ fontSize: 7, fill: '#A3BAB2' }}>{new Date().toLocaleDateString('ar-SA')}</text>
                    </svg>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* بطاقة الأسئلة */}
        <div className="bg-white rounded-3xl p-7 shadow-sm border border-[#E8F5EF]">
          <h2 className="font-black text-[#1A3D34] mb-1">💬 ضع أسئلتك</h2>
          <p className="text-[#6B8A80] text-xs font-bold mb-4">أسئلة تخص عملك ووضعك المالي — مفتوحة على مدار الشهر</p>

          <textarea value={newQuestion} onChange={(e) => setNewQuestion(e.target.value)}
            placeholder="اكتب سؤالك هنا..." rows={3}
            className="w-full p-4 rounded-xl border-2 border-[#E8F5EF] bg-[#FBFCFB] text-[#1A3D34] font-bold focus:border-[#2E9E7B] focus:outline-none text-right resize-none" />
          <button onClick={sendQuestion} disabled={sendingQ || newQuestion.trim() === ''}
            className="mt-3 px-8 py-3 rounded-full bg-[#2E9E7B] text-white font-black text-sm disabled:opacity-40">
            {sendingQ ? 'جارٍ الإرسال...' : 'إرسال السؤال'}
          </button>

          {questions.length > 0 && (
            <div className="mt-6 space-y-4">
              {questions.map((q) => (
                <div key={q.id} className="border border-[#F0F5F3] rounded-2xl p-4">
                  <p className="text-[#1A3D34] font-black text-sm mb-2">س: {q.question}</p>
                  {q.status === 'released' && q.answer ? (
                    <div className="bg-[#E8F5EF] rounded-xl p-3 text-[#1A3D34] text-sm font-bold whitespace-pre-wrap leading-relaxed">
                      {q.answer}
                    </div>
                  ) : (
                    <p className="text-[#9A7B2E] text-xs font-black bg-[#FBF5E8] rounded-xl p-3">
                      ⏳ طلبك تحت المراجعة من قبل د. عبدالحكيم وفريقه — سيتم الرد قريباً
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* بطاقة الدعم الخاص */}
        <div className="bg-white rounded-3xl p-7 shadow-sm border border-[#E8F5EF]">
          <h2 className="font-black text-[#1A3D34] mb-1">🛠️ الدعم الخاص</h2>
          <p className="text-[#6B8A80] text-xs font-bold mb-4">أخطأت في إدخال بياناتك؟ أرسل طلب تعديل وسيراجعه الفريق ويفتح لك الإدخال من جديد</p>

          {editStatus === 'pending' && (
            <p className="text-[#9A7B2E] text-sm font-black bg-[#FBF5E8] rounded-xl p-4">⏳ طلب التعديل قيد المراجعة من الإدارة</p>
          )}
          {editStatus === 'approved' && (
            <div className="bg-[#E8F5EF] rounded-xl p-4">
              <p className="text-[#2E9E7B] text-sm font-black mb-3">✓ تمت الموافقة — اختر المسار الذي تريد تصحيح بياناته:</p>
              <div className="flex flex-wrap gap-2">
                <a href="/assessment/funding" className="inline-block px-5 py-2 rounded-full bg-[#2E9E7B] text-white font-black text-sm">تصحيح التمويل</a>
                <a href="/assessment/investment" className="inline-block px-5 py-2 rounded-full bg-[#2E9E7B] text-white font-black text-sm">تصحيح الاستثمار</a>
                <a href="/assessment/ipo" className="inline-block px-5 py-2 rounded-full bg-[#2E9E7B] text-white font-black text-sm">تصحيح الطرح</a>
              </div>
            </div>
          )}
          {(editStatus === '' || editStatus === 'used' || editStatus === 'rejected') && (
            <>
              <textarea value={editReason} onChange={(e) => setEditReason(e.target.value)}
                placeholder="اشرح باختصار ما الخطأ الذي تريد تصحيحه..." rows={2}
                className="w-full p-4 rounded-xl border-2 border-[#E8F5EF] bg-[#FBFCFB] text-[#1A3D34] font-bold focus:border-[#2E9E7B] focus:outline-none text-right resize-none" />
              <button onClick={sendEditRequest} disabled={sendingE || editReason.trim() === ''}
                className="mt-3 px-8 py-3 rounded-full border-2 border-[#2E9E7B] text-[#2E9E7B] font-black text-sm disabled:opacity-40">
                {sendingE ? 'جارٍ الإرسال...' : 'إرسال طلب تعديل'}
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
