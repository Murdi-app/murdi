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
    <div dir="rtl" className="min-h-screen bg-[#FBFCFB] px-4 py-10" style={{ fontFamily: 'Cairo, sans-serif' }}>
      <div className="max-w-2xl mx-auto space-y-6">

        <div className="text-center mb-2">
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
            <div className="bg-[#FBFCFB] rounded-2xl p-5 border border-[#F0F5F3] whitespace-pre-wrap text-[#1A3D34] text-sm font-bold leading-loose" style={{ maxHeight: '600px', overflowY: 'auto' }}>
              {consultContent.replace(/^#+ /gm, '').replace(/\*\*/g, '')}
            </div>
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
              <p className="text-[#2E9E7B] text-sm font-black mb-2">✓ تمت الموافقة — يمكنك الآن إعادة إدخال بياناتك</p>
              <a href="/assessment/funding" className="inline-block px-6 py-2 rounded-full bg-[#2E9E7B] text-white font-black text-sm">إدخال البيانات الجديدة</a>
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
