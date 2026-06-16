'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';

type Question = { id: string; question: string; answer: string | null; status: string; created_at: string };

export default function ConsultationPage() {
  const [loading, setLoading] = useState(true);
  const [consults, setConsults] = useState<Record<string, { status: string; content: string | null }>>({});
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
        if (cData.consultations) setConsults(cData.consultations);
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

        {/* الاستشارات الخاصة — مسار لكل خدمة */}
        {(['funding', 'investment', 'ipo'] as const).map((tk) => {
          const TRACK_AR: Record<string, string> = { funding: 'التمويل', investment: 'الاستثمار', ipo: 'الطرح العام' };
          const c = consults[tk];
          const st = c?.status || '';
          const content = c?.content || '';
          return (
          <div key={tk} className="bg-white rounded-3xl p-7 shadow-sm border-2 border-[#C9A84C]">
            <h2 className="font-black text-[#1A3D34] mb-1">استشارتك الخاصة — {TRACK_AR[tk]}</h2>
            <p className="text-[#6B8A80] text-xs font-bold mb-4">تحليل خاص + خطة نجاح + توعية مالية — لمسار {TRACK_AR[tk]} تحديدا</p>

            {st === '' && (
              <div className="bg-[#FBFCFB] rounded-2xl p-5 text-center border border-[#F0F5F3]">
                <p className="text-[#6B8A80] font-bold text-sm">أكمل تقييم {TRACK_AR[tk]} لتبدأ استشارتك الخاصة في هذا المسار</p>
              </div>
            )}

            {st !== '' && st !== 'released' && (
              <div className="bg-[#FBF5E8] rounded-2xl p-5 text-center">
                <div className="inline-block w-6 h-6 rounded-full border-2 border-[#C9A84C]/30 border-t-[#C9A84C] animate-spin mb-2" />
                <p className="text-[#9A7B2E] font-black text-sm">استشارتك الخاصة بـ{TRACK_AR[tk]} قيد الإعداد من د. عبدالحكيم المرضي</p>
                <p className="text-[#A3BAB2] text-xs font-bold mt-1">ستتوفر هنا فور جهوزها واعتمادها</p>
              </div>
            )}

            {st === 'released' && content !== '' && (
              <>
                <button onClick={() => { const el = document.getElementById('print-' + tk); if (el) { const w = window.open('', '', 'width=800'); if (w) { w.document.write('<html dir=rtl><head><meta charset=utf-8><title>استشارة ' + TRACK_AR[tk] + '</title></head><body style=\"font-family:Cairo,Arial;padding:32px;line-height:2;white-space:pre-wrap\">' + el.innerText + '</body></html>'); w.document.close(); w.print(); } } }} className="mb-4 px-6 py-2 rounded-full bg-[#1A3D34] text-white font-black text-sm">
                  🖨️ طباعة الاستشارة
                </button>
                <div id={'print-' + tk} className="bg-[#FBFCFB] rounded-2xl p-5 border border-[#F0F5F3] whitespace-pre-wrap text-[#1A3D34] text-sm font-bold leading-loose" style={{ maxHeight: '600px', overflowY: 'auto' }}>
                  {content.replace(/^#+ /gm, '').replace(/\*\*/g, '')}
                  <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid #E8D9B5', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                    <div style={{ width: 88, height: 88, borderRadius: '50%', border: '2px solid #C9A84C', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: '#1A3D34', flexShrink: 0, lineHeight: 1.3 }}>
                      <span style={{ fontSize: 11, fontWeight: 900, color: '#C9A84C' }}>مُرضي</span>
                      <span style={{ fontSize: 9, fontWeight: 700 }}>اعتماد وإشراف</span>
                      <span style={{ fontSize: 9, fontWeight: 700 }}>د. عبدالحكيم المرضي</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 180, textAlign: 'left', direction: 'rtl' }}>
                      <p style={{ fontWeight: 900, color: '#1A3D34', fontSize: 14, margin: 0 }}>د. عبدالحكيم المرضي</p>
                      <p style={{ fontWeight: 700, color: '#6B8A80', fontSize: 11, margin: '2px 0 0' }}>دكتوراه إدارة الأعمال · عضوية البورد الأمريكي للمستشارين</p>
                      <p style={{ fontWeight: 700, color: '#6B8A80', fontSize: 11, margin: '2px 0 0' }}>خبرة 15 عاماً في الاستشارات المالية</p>
                      <p style={{ fontWeight: 900, color: '#C9A84C', fontSize: 12, margin: '8px 0 0' }}>✦ استشارة معتمدة من منصة مُرضي</p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
          );
        })}

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

        {/* بطاقة الدعم الفني والتواصل */}
        <div className="bg-white rounded-3xl p-7 shadow-sm border border-[#E8F5EF]">
          <h2 className="font-black text-[#1A3D34] mb-1">📞 الدعم الفني</h2>
          <p className="text-[#6B8A80] text-xs font-bold mb-4">واجهت مشكلة تقنية في المنصة (تسجيل دخول، صفحة لا تفتح، خطأ في النظام)؟ تواصل مع فريق مُرضي مباشرة عبر واتساب</p>
          <a href="https://wa.me/966570314005?text=السلام%20عليكم،%20أحتاج%20مساعدة%20بخصوص%20منصة%20مُرضي" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-7 py-3 rounded-full bg-[#25D366] text-white font-black text-sm">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15l-1.4 5 5.1-1.3A10 10 0 1 0 12 2zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.2-.7-2.7-1.1-4.4-3.9-4.5-4.1-.1-.2-1.1-1.4-1.1-2.7s.7-1.9.9-2.2c.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.4.5c-.1.2-.3.3-.1.6.1.3.6 1 1.3 1.6.9.8 1.6 1 1.9 1.2.2.1.4.1.6-.1l.7-.8c.2-.2.4-.2.6-.1l1.9.9c.2.1.4.2.4.3.1.1.1.6-.1 1.2z"/></svg>
            تواصل عبر واتساب
          </a>
          <p className="text-[#A3BAB2] text-xs font-bold mt-3">أوقات الرد: الأحد - الخميس، 9 صباحاً - 5 مساءً</p>
        </div>

        {/* بطاقة الدعم الخاص */}
        <div className="bg-white rounded-3xl p-7 shadow-sm border border-[#E8F5EF]">
          <h2 className="font-black text-[#1A3D34] mb-1">✏️ تصحيح بيانات التقييم</h2>
          <p className="text-[#6B8A80] text-xs font-bold mb-4">أدخلت رقماً خاطئاً في أحد التقييمات؟ أرسل طلب تعديل، وبعد مراجعة الفريق يفتح لك إدخال المسار من جديد لتصحيحه</p>

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
