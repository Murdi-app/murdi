'use client';

import { useState, useEffect, useRef } from 'react';
import ConsultationPanel from './ConsultationPanel';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { SERVICES, TRACK_LABEL } from '@/lib/serviceSuggestion';
import { COMMISSION_SERVICES } from '@/lib/contracts';
import { priceFor } from '@/lib/servicePricing';
import { CATALOG, SERVICE_COUNT, displayName, canonicalTitle, commercialFor, TRACKS_OVERRIDE, needsDiagnosis } from '@/lib/serviceCatalog';

const TRACKS = [
  { id: 'funding', icon: '', title: 'أريد تمويلاً', en: 'FUNDING READINESS', desc: 'اعرف مدى جاهزية شركتك للحصول على تمويل، وما الذي يمنعها، وكيف تتأهل.', href: '/assessment/funding' },
  { id: 'investment', icon: '', title: 'أريد مستثمراً', en: 'INVESTMENT READINESS', desc: 'اعرف مدى جاذبية شركتك للمستثمرين، ونقاط القوة والضعف قبل العرض.', href: '/assessment/investment' },
  { id: 'ipo', icon: '', title: 'أريد تجهيز الشركة للطرح', en: 'IPO READINESS', desc: 'اعرف موقع شركتك على طريق الطرح، وخارطة الطريق للوصول للجاهزية.', href: '/assessment/ipo' },
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
  // كان هذا الحقل يقيس اشتراكاً ربعياً أُلغي من المنصة. وما يحكم هذه
  // الشاشة اليوم شيء آخر: هل تملك تشغيلة مطابقة؟ فسُمِّي بما يقيسه.
  // ومن اشترك قبل الإلغاء يبقى على حقه حتى تنتهي مدّته المسجَّلة.
  const [canMatch, setCanMatch] = useState(false);
  const [matchCount, setMatchCount] = useState<number | null>(null);
  const [matchCounts, setMatchCounts] = useState<Record<string, number>>({});
  const [matching, setMatching] = useState(false);
  const [matchPhase, setMatchPhase] = useState('');
  const [matchNotice, setMatchNotice] = useState('');
  const [matchReq, setMatchReq] = useState('');
  const [demands, setDemands] = useState<{ key: string; service: string; demand: string; consequence: string; entities: number }[]>([]);
  const [demandTotal, setDemandTotal] = useState(0);
  // «مؤهّل لـ٣٩ · جاهز لـ١» حُذف: كان يَعُدّ ملاحظاتٍ عن الجهة نفسها
  // («لا فرع لها في السعودية») نقصاً في العميل، فيخرج رقمٌ مُحبط وكاذب.
  // وحلّ محلّه ما يُقاس: كم جهةً مختلفة، وما الثلاثة التي تقف بينه وبينها.
  const [entities, setEntities] = useState(0);
  const [strong, setStrong] = useState(0);
  const [blockers, setBlockers] = useState<Array<{ key: string; service: string; what: string; entities: number }>>([]);
  const [reqBusy, setReqBusy] = useState(false);
  const [pendingTracks, setPendingTracks] = useState<string[]>([]);
  const [resumeMap, setResumeMap] = useState<Record<string, number>>({});
  const [showPaywall, setShowPaywall] = useState(false);
  const [serviceRequests, setServiceRequests] = useState<Record<string, { id: string; status: string; price: number | null; deliverable: string | null }>>({});
  const [clientContracts, setClientContracts] = useState<Record<string, { id: string; status: string; body: string; signedUrl: string | null }>>({});
  const [openDetails, setOpenDetails] = useState<string>('');
  const [orderFor, setOrderFor] = useState<string>('');       // الخدمة المفتوح لها نموذج الطلب
  const [orderInvest, setOrderInvest] = useState<string>('');  // حجم الاستثمار كما أدخله العميل
  const [orderKind, setOrderKind] = useState<'new' | 'expansion'>('new');
  const [orderOption, setOrderOption] = useState<string>('');
  const [orderBusy, setOrderBusy] = useState(false);
  const [orderCategory, setOrderCategory] = useState<string>('');
  // حوالة بانتظار تأكيدك — بدونها كان العميل الذي حوّل يرى «فعّل الآن» فيحوّل مرة ثانية
  const [pendingTransfer, setPendingTransfer] = useState<{ kind: string; amount: number } | null>(null);
  // طبقة الدليل: لماذا هذه الخدمة لك أنت — من بياناتك ومن فجوات جهاتك، لا من وصف تسويقي
  const [reasons, setReasons] = useState<Record<string, { urgency: 'blocking' | 'strong' | 'fit'; evidence: string; hook?: string }>>({});
  const [pitch, setPitch] = useState<{ headline: string; lines: string[]; cta: string } | null>(null);

  useEffect(() => {
    fetch('/api/service-evidence').then(r => r.json()).then(d => {
      const m: Record<string, { urgency: 'blocking' | 'strong' | 'fit'; evidence: string; hook?: string }> = {};
      for (const r of (d.reasons || [])) if (!m[r.service]) m[r.service] = { urgency: r.urgency, evidence: r.evidence, hook: r.hook };
      setReasons(m); setPitch(d.pitch || null);
    }).catch(() => {});
  }, []);

  useEffect(() => { fetch('/api/match/run').then(r => r.json()).then(d => { setMatchCount(d.count || 0); setMatchCounts(d.counts || {}); setPendingTracks(d.pending || []); setResumeMap(d.resume || {}); setMatchNotice(d.notice || ''); }).catch(() => {}); }, []);
  // ما تطلبه جهاته — يُقرأ بعد المطابقة، ويبيع الخدمات بلا أن نعرضها
  useEffect(() => {
    fetch('/api/match/demand').then(r => r.json())
      .then(d => {
        setDemands(d?.demands || []);
        setEntities(Number(d?.entities || 0));
        setStrong(Number(d?.strong || 0));
        setBlockers(d?.blockers || []);
        setDemandTotal(Number(d?.entities || 0));
      })
      .catch(() => {});
  }, [matchCount]);

  // حالة طلب التشغيل: هل طلب العميل وينتظر إذناً؟
  useEffect(() => { fetch('/api/match/request').then(r => r.json()).then(d => {
    const open = (d?.requests || []).find((x: { status: string }) => x.status === 'requested');
    if (open) setMatchReq('requested');
  }).catch(() => {}); }, []);

  // من اختار تبويباً بيده لا يُنتزع منه. والعلامة تُرفع أيضاً حين يأتي
  // التبويب في الرابط، فلا يزاحمه اختيارٌ تلقائي بعده.
  const tabChosen = useRef(false);

  // بعد المطابقة تُفتح الصفحة على «الخدمات» لا على النظرة العامة.
  // ونتيجتُه لا تضيع بهذا: عدد الجهات وما طلبته منه يعيش فوق شريط
  // التبويبات، فيُقرأ في كل حال. والذي يلي النتيجة قرارٌ يُتخذ لا رقمٌ
  // يُتأمَّل — فيُنزَل به إلى حيث يُتَّخذ.
  useEffect(() => {
    if (tabChosen.current) return;
    if ((matchCount || 0) > 0) { tabChosen.current = true; setTab('services'); }
  }, [matchCount]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('tab');
    if (t === 'services' || t === 'consult' || t === 'overview') { tabChosen.current = true; setTab(t); }
    const h = params.get('highlight');
    // العنوان القادم من صفحة النتيجة قد يكون اسماً قديماً — يُردّ إلى المعياري وإلا لم يُطابق شيئاً
    if (h) setHighlightService(canonicalTitle(h));
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
        .from('companies').select('id, company_name, sector, match_credits, subscription_active, subscription_end')
        .eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle();

      // فتحُ المنصة من أيقونة الجوال يبدأ من هنا (start_url في manifest).
      // والمالك والموظفة لا منشأة لهما، فكانت الشاشة تقف فارغة بلا خبر —
      // ولا زرّ يمضي بهما إلى مكانهما. فمن لا منشأة له ويملك صلاحية إدارة
      // يُحوَّل إلى لوحته، ومن لا منشأة له ولا صلاحية يُحوَّل إلى التسجيل.
      if (!comp) {
        const { data: st } = await supabase
          .from('staff').select('user_id').eq('user_id', user.id).eq('active', true).maybeSingle();
        const isStaff = st !== null || user.email === 'hololalmurdi.fs@gmail.com';
        // ومن له حساب بلا منشأة — وهم ثلاثة وثمانون ممّن وقفوا عند باب
        // التسجيل القديم — يُرسَل إلى صفحة البيانات لا إلى إنشاء حساب:
        // بريده مسجَّل أصلاً، فصفحة الإنشاء ترفضه بـ«هذا البريد مسجل
        // مسبقاً» فيقف أمام حائطٍ ثانٍ. و/register يكمل منشأته بجلسته.
        window.location.replace(isStaff ? '/admin' : '/register');
        return;
      }
      setCompany({ name: comp.company_name || 'شركتك', sector: comp.sector || '' });
      const legacySub = comp.subscription_active === true && (!comp.subscription_end || new Date(comp.subscription_end) > new Date());
      setCanMatch(legacySub || Number(comp.match_credits || 0) > 0);
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
        .select('id, service_title, status, price')
        .eq('company_id', comp.id)
        .order('created_at', { ascending: false });
      const reqMap: Record<string, { id: string; status: string; price: number | null; deliverable: string | null }> = {};
      // العناوين القديمة تُردّ إلى عنوانها الحالي حتى يظل طلب العميل ظاهراً بعد دمج الخدمات
      // المحتوى المُسلَّم لا يُقرأ هنا — يُطلب من الخادم عند الطباعة، بعد التحقق من الحالة
      for (const r of (reqs || [])) { const key = canonicalTitle(r.service_title); if (!reqMap[key]) reqMap[key] = { id: r.id, status: r.status, price: r.price, deliverable: null }; }
      setServiceRequests(reqMap);
      const { data: ctrs } = await supabase
        .from('contracts')
        .select('id, contract_type, status, contract_body, signed_file_url')
        .eq('company_id', comp.id)
        .order('created_at', { ascending: false });
      const ctrMap: Record<string, { id: string; status: string; body: string; signedUrl: string | null }> = {};
      for (const c of (ctrs || [])) { if (c.status !== 'draft' && !ctrMap[c.contract_type]) ctrMap[c.contract_type] = { id: c.id, status: c.status, body: c.contract_body, signedUrl: c.signed_file_url }; }
      setClientContracts(ctrMap);
      const { data: pays } = await supabase
        .from('payments').select('kind, amount_sar, status, created_at')
        .eq('company_id', comp.id).eq('status', 'awaiting_confirmation')
        .order('created_at', { ascending: false }).limit(1);
      const pend = (pays || [])[0];
      if (pend) setPendingTransfer({ kind: String(pend.kind || ''), amount: Number(pend.amount_sar || 0) });
    };
    load();
  }, []);

  const trackLabel = (k: string) => (k === 'investment' ? 'استثمار' : 'تمويل');
  const countText = () => {
    const parts = ['funding', 'investment'].filter((k) => (matchCounts[k] || 0) > 0).map((k) => (matchCounts[k] || 0) + ' جهة ' + trackLabel(k));
    return parts.length > 0 ? parts.join(' · ') : (matchCount || 0) + ' جهة';
  };
  const doneScores = Object.values(scores);
  const overall = doneScores.length ? Math.round(doneScores.reduce((a, b) => a + b, 0) / doneScores.length) : 0;
  const pct = overall >= 75 ? 90 : overall >= 70 ? 82 : overall >= 65 ? 74 : overall >= 55 ? 60 : overall >= 45 ? 45 : overall >= 35 ? 30 : 18;

  const submitServiceRequest = async (
    title: string,
    category: string,
    extra?: { optionKey?: string; quotedPrice?: number | null; clientInputs?: Record<string, unknown> }
  ) => {
    if (!companyId) return;
    void category;
    const optimisticPrice = extra?.quotedPrice ?? null;
    const optimisticStatus = typeof optimisticPrice === 'number' && optimisticPrice > 0 ? 'priced' : 'submitted';
    setServiceRequests((prev) => ({ ...prev, [title]: { id: '', status: optimisticStatus, price: optimisticPrice, deliverable: null } }));
    // الطلب يمرّ من الخادم: هو الذي يُصدّق الخدمة ويقرأ سعرها. وكان العميل
    // يُدخل الصفّ بنفسه ومعه السعر والحالة، فيستطيع تسعير نفسه أو أن يكتب
    // «مدفوعة» بلا دفع. لا يُكتب رقم من المتصفح بعد اليوم.
    try {
      const r = await fetch('/api/services/order', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service_title: title, option_key: extra?.optionKey || null, client_inputs: extra?.clientInputs || null }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || 'تعذّر الطلب');
      setServiceRequests((prev) => ({ ...prev, [title]: { id: String(d.id || ''), status: String(d.status || 'submitted'), price: d.price ?? null, deliverable: null } }));
    } catch (e) {
      console.error('فشل حفظ طلب الخدمة:', e);
      setServiceRequests((prev) => { const c = { ...prev }; delete c[title]; return c; });
      alert('تعذّر إرسال الطلب — حاول مرة أخرى');
    }
  };

  // نموذج الطلب: الخدمات ذات الشرائح أو الخيارات تحتاج سؤالين قبل أن يظهر السعر
  const needsForm = (title: string) => {
    const c = commercialFor(title);
    return Boolean(c && (c.tiersBy === 'investment' || (c.options && c.options.length)));
  };

  const openOrder = (title: string) => {
    const c = commercialFor(title);
    setOrderFor(title);
    setOrderInvest('');
    setOrderKind('new');
    setOrderOption(c?.options?.[0]?.key || '');
  };

  const confirmOrder = async (category: string) => {
    if (!orderFor || orderBusy) return;
    setOrderBusy(true);
    const c = commercialFor(orderFor);
    const investment = Number(String(orderInvest).replace(/[^\d]/g, '')) || 0;
    const opt = c?.options?.find((o) => o.key === orderOption);
    // خيار له سعر معلن يأخذ سعره، وإلا فسعر الشريحة بحسب حجم الاستثمار
    const quoted = opt && opt.price != null ? opt.price : priceFor(canonicalTitle(orderFor), investment).amount;
    const inputs: Record<string, unknown> = {};
    if (c?.tiersBy === 'investment') { inputs.totalInvestment = investment; inputs.projectKind = orderKind; }
    if (orderOption) inputs.option = orderOption;
    await submitServiceRequest(orderFor, category, { optionKey: orderOption || undefined, quotedPrice: quoted, clientInputs: inputs });
    setOrderBusy(false);
    setOrderFor('');
  };

  const uploadSignedContract = async (contractId: string, contractType: string, file: File) => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
    );
    const safeName = (file.name || 'file.pdf').replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_');
    const path = companyId + '/' + contractId + '_' + Date.now() + '_' + safeName;
    const { error: upErr } = await supabase.storage.from('contracts').upload(path, file);
    if (upErr) { alert('تعذّر رفع الملف: ' + (upErr.message || JSON.stringify(upErr))); return; }
    // يُخزَّن المسار لا رابطاً عاماً: العقد الموقّع يحمل رقم الهوية،
    // ولا يُفتح إلا برابط موقّع قصير الأجل عبر /api/contract-file
    await supabase.from('contracts').update({ signed_file_url: path, status: 'signed', signed_at: new Date().toISOString() }).eq('id', contractId);
    setClientContracts((prev) => ({ ...prev, [contractType]: { ...prev[contractType], status: 'signed', signedUrl: path } }));
    alert('تم رفع العقد الموقّع بنجاح، شكراً لك');
  };

  const go = () => {
    const t = TRACKS.find((x) => x.id === selected);
    if (t) router.push(t.href);
  };

  // «عنده نتيجة» شيء، و«يستطيع التشغيل» شيء آخر. والنتيجة تُعرض لصاحبها
  // دائماً — سواء بقي في رصيده تشغيلة أم لا.
  const showResults = (matchCount || 0) > 0 || matchNotice === 'running' || matching || canMatch;

  return (
    <div dir="rtl" className="min-h-screen overflow-x-hidden bg-[#FBFCFB]" style={{ fontFamily: 'Tajawal, Cairo, sans-serif' }}>

      {/* عيبٌ صنعتُه أمس حين سمّيتُ الحقل canMatch: صار عرضُ **النتيجة**
          معلّقاً على **امتلاك تشغيلة**. والتشغيلة تُخصم عند التشغيل، فيصير
          الرصيد صفراً لحظةَ اكتمال المطابقة — فتختفي نتيجتها من الشاشة،
          ويُعرض على صاحبها «اطلب المطابقة» وكأنه لم يُطابَق. عميلٌ خرجت
          له ٣٥٢ جهة رأى الطلب من جديد، ولو ضغطه لطلب تشغيلة ثانية بلا سبب.
          فصار الشرط ما يملكه لا ما يستطيعه: نتيجةٌ قائمة، أو تشغيل جارٍ،
          أو تشغيلة بيده. */}
      {(showResults) && (
        <div style={{ background: '#1A3D34', padding: '18px 16px' }}>
          <div className="max-w-5xl mx-auto text-center">
            {matchNotice === 'stalled' && !matching ? (
              <>
                <div className="text-white font-black text-sm mb-1">تعذّر إكمال مطابقتك — أعد المحاولة</div>
                <div className="text-[#CFE0DA] text-xs font-bold mb-3">توقّفت العملية قبل اكتمالها. ما أُنجز محفوظ، والضغط مرة أخرى يكمل من حيث توقّفت بلا رسوم إضافية.</div>
              </>
            ) : null}
            {matching || matchNotice === 'running' ? (
              <>
                <div style={{ display: 'inline-block', width: 22, height: 22, border: '3px solid rgba(201,168,76,0.3)', borderTopColor: '#C9A84C', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: 8 }} />
                <div className="text-white font-black text-sm">{matchPhase || 'جارٍ مطابقة ملفك مع شبكة جهات مُرضي'}</div>
                <div className="text-[#CFE0DA] text-xs font-bold mt-1">التحليل جارٍ — يمكنك إغلاق الصفحة والعودة عند وصول إشعار على بريدك أو بعد ساعة تقريباً</div>
                <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
              </>
            ) : matchCount && matchCount > 0 && pendingTracks.length === 0 ? (
              <>
                <div style={{ color: '#C9A84C', fontWeight: 900, fontSize: 26 }}>{countText()}</div>
                <div className="text-[#CFE0DA] text-xs font-bold mt-1">طوبق ملفك مع شبكة مُرضي — هذه جهات تنطبق شروطها على ملفك أنت، لا قائمة عامة</div>

                {/* الرقم وحده لا يبيع. وأسماء الجهات لا تُعرض مجاناً وإلا أخذها
                    العميل ومشى وحده، فتضيع الخدمة والنسبة معاً. فيُعرض هنا
                    البابان: ماذا يشتري بـ٩٩٠، وماذا يشتري بالملف الكامل. */}
                {/* الطرح قبل العرض. «مؤهّل لتسع، جاهز لاثنتين» تقرأها الأرقام
                    لا نحن — والعميل لا يجادل الطرح كما يجادل البائع. */}
                {entities >= 2 && (
                  <div style={{ marginTop: 16, background: '#fff', borderRadius: 14, padding: '18px 18px 16px' }}>
                    <div style={{ color: '#5E7C73', fontSize: 12, fontWeight: 800, marginBottom: 8, textAlign: 'center' }}>موقفك اليوم بالأرقام</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ color: '#1A3D34', fontSize: 34, fontWeight: 900, lineHeight: 1 }}>{entities}</span>
                      <span style={{ color: '#1A3D34', fontSize: 15, fontWeight: 800 }}>جهة تنطبق شروطها على ملفك</span>
                    </div>
                    {strong > 0 && (
                      <div style={{ color: '#1A7A5A', fontSize: 12.8, fontWeight: 800, marginTop: 8, textAlign: 'center' }}>
                        منها {strong} جهة المطابقة فيها قوية.
                      </div>
                    )}

                    {/* العائق ثلاثة أشياء لا ثمانية وثلاثون باباً موصداً */}
                    {blockers.length > 0 && (
                      <div style={{ marginTop: 14, borderTop: '1px solid #EFF5F2', paddingTop: 14 }}>
                        <div style={{ color: '#1A3D34', fontSize: 13.5, fontWeight: 900, marginBottom: 10 }}>
                          {blockers.length === 1 ? 'وشيء واحد يتكرر عند أكثرها:' : 'و' + (blockers.length === 2 ? 'شيئان يتكرران' : 'ثلاثة أشياء تتكرر') + ' عند أكثرها:'}
                        </div>
                        {blockers.map(b => (
                          <div key={b.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid #F5F9F7' }}>
                            <span style={{ color: '#3A4D47', fontSize: 13, fontWeight: 800 }}>{b.what}</span>
                            <span style={{ color: '#B4622A', fontSize: 12.5, fontWeight: 900, whiteSpace: 'nowrap' }}>
                              يقف عند {b.entities} جهة
                            </span>
                          </div>
                        ))}
                        <div style={{ color: '#6B8A80', fontSize: 12.3, fontWeight: 700, marginTop: 10, lineHeight: 1.85 }}>
                          وهذه أشياء تُصلَح — لا أبواب مغلقة.
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div style={{ marginTop: 12, background: '#fff', borderRadius: 14, padding: '16px 18px', textAlign: 'right' }}>
                  <div style={{ color: '#1A3D34', fontWeight: 900, fontSize: 14.5, marginBottom: 6 }}>
                    ويبقى سؤالان: مَن هم؟ وكيف تدخل عليهم؟
                  </div>
                  <p style={{ color: '#3A4D47', fontSize: 12.8, lineHeight: 1.9, margin: '0 0 12px' }}>
                    أسماء هذه الجهات وشروط كل واحدة وما ينقصك عندها — يكشفها
                    <b> الحكم الائتماني لمنشأتك</b>. أما بناء الملف ومخاطبتها باسمك
                    والتفاوض حتى القرار، فهو <b>تجهيز ملف التمويل</b>.
                  </p>

                  <div style={{ display: 'grid', gap: 10 }}>
                    <div style={{ border: '1px solid #E4EFEA', borderRadius: 12, padding: '12px 14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
                        <span style={{ color: '#1A3D34', fontWeight: 900, fontSize: 13.5 }}>الحكم الائتماني لمنشأتك</span>
                        <span style={{ color: '#1A7A5A', fontWeight: 900, fontSize: 14 }}>٩٩٠ ر.س</span>
                      </div>
                      <div style={{ color: '#5E7C73', fontSize: 12, lineHeight: 1.85, marginTop: 4 }}>
                        الجهات بأسمائها · شروط كل واحدة · ما ينقصك عندها · طريقة التقديم — خلال ساعات
                      </div>
                    </div>

                    <div style={{ border: '1.5px solid #C9A84C', background: '#FFFDF5', borderRadius: 12, padding: '12px 14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
                        <span style={{ color: '#1A3D34', fontWeight: 900, fontSize: 13.5 }}>تجهيز ملف التمويل والمخاطبة</span>
                        <span style={{ color: '#1A7A5A', fontWeight: 900, fontSize: 14 }}>٧٬٩٠٠ ر.س</span>
                      </div>
                      <div style={{ color: '#5E7C73', fontSize: 12, lineHeight: 1.85, marginTop: 4 }}>
                        نبني ملفك بالعربية والإنجليزية، ونخاطب الجهات باسمك، ونتابع ونفاوض حتى قرار نهائي.
                        <b style={{ color: '#8A6D1F' }}> ويُخصم منها الحكم الائتماني إن كنت دفعته خلال ٣٠ يوماً.</b>
                      </div>
                    </div>
                  </div>

                  {/* الترجيح الصادق: من يبدأ صغيراً ثم يكمل يدفع نفس المبلغ.
                      فالسؤال لم يعد «كم أدفع؟» بل «هل أكتفي بأن أعرف؟». */}
                  <div style={{ background: '#F1F8F5', borderInlineStart: '3px solid #1A6B55', borderRadius: '0 10px 10px 0', padding: '10px 13px', marginTop: 12 }}>
                    <div style={{ color: '#1A6B55', fontWeight: 900, fontSize: 12.5, marginBottom: 3 }}>
                      وأيّهما تختار؟
                    </div>
                    <div style={{ color: '#3A4D47', fontSize: 12, lineHeight: 1.9 }}>
                      إن بدأت بالحكم الائتماني ثم أكملت خلال ٣٠ يوماً، <b>دفعتَ ٧٬٩٠٠ لا أكثر</b> — الحكم لا يكلّفك شيئاً إضافياً.
                      والفرق الوحيد أنك عرفت قبل أن تلتزم.
                      <br />أمّا إن اكتفيتَ بالحكم، فستعرف أبوابك ولن يُطرق منها باب — <b>لأن الطرق يحتاج ملفاً</b>.
                    </div>
                  </div>

                  <div style={{ color: '#6B8A80', fontSize: 11.8, lineHeight: 1.85, marginTop: 10 }}>
                    وأتعاب النجاح على التمويل المنفَّذ لا تُدفع إلا بعد صرفه إلى حسابك.
                  </div>

                  {/* ما تطلبه الجهات — العدّ يبيع، لا العرض */}
                  {demands.length > 0 && (
                    <div style={{ marginTop: 16, borderTop: '1px solid #E4EFEA', paddingTop: 14 }}>
                      <div style={{ color: '#1A3D34', fontWeight: 900, fontSize: 14, marginBottom: 3 }}>
                        وهذا ما طلبته جهاتك منك
                      </div>
                      <div style={{ color: '#6B8A80', fontSize: 11.8, marginBottom: 10 }}>
                        ليس رأينا — بل ما ورد في شروط الجهات التي طوبقت على ملفك.
                      </div>
                      <div style={{ display: 'grid', gap: 8 }}>
                        {demands.map(d => (
                          <div key={d.key} style={{ border: '1px solid #E4EFEA', borderRadius: 10, padding: '11px 13px' }}>
                            <div style={{ color: '#B4622A', fontWeight: 900, fontSize: 12.5 }}>
                              {d.entities}{demandTotal > 0 ? ' من ' + demandTotal : ''} جهة تطلب {d.demand}
                            </div>
                            <div style={{ color: '#5E7C73', fontSize: 11.8, lineHeight: 1.8, marginTop: 3 }}>
                              {d.consequence}
                            </div>
                            <button onClick={() => { tabChosen.current = true; setTab('services'); setOrderFor(canonicalTitle(d.service)); }}
                              style={{ marginTop: 7, background: 'transparent', border: 'none', padding: 0, color: '#1A6B55', fontFamily: 'Cairo,sans-serif', fontWeight: 900, fontSize: 12, cursor: 'pointer' }}>
                              {displayName(d.service)} ←
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* «الخدمات» تبويب لا موضع في الصفحة — فالزرّ يبدّل التبويب.
                      وكان مكتوباً «اعرض الخدمتين» فيُقرأ فوق ثلاث بطاقات
                      متطلّبات، فيظنّ القارئ العدد ناقصاً. والعدد ليس شأنه. */}
                  <button onClick={() => { tabChosen.current = true; setTab('services'); }}
                    style={{ width: '100%', marginTop: 12, background: '#1A3D34', color: '#fff', border: 'none', padding: '12px', borderRadius: 999, fontFamily: 'Cairo', fontWeight: 900, fontSize: 14, cursor: 'pointer' }}>
                    اعرض الخدمات
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="text-white font-black text-sm mb-1">{Object.values(resumeMap).some(v => (v || 0) > 0) ? 'مطابقتك لم تكتمل بعد' : 'ملفك مفعّل — ابدأ مطابقة الجهات'}</div>{matchCount && matchCount > 0 ? <div style={{ color: '#C9A84C', fontWeight: 900, fontSize: 15, marginBottom: 4 }}>{countText()}</div> : null}
                <div className="text-[#CFE0DA] text-xs font-bold mb-3">نطابق ملفك مع شبكة جهات مُرضي ونستخرج المنتج المناسب لك في كل جهة</div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                  {pendingTracks.map(tr => (
                  <button key={tr} disabled={matching} onClick={async () => {
                    const PH = ['نفحص شبكة جهات مُرضي…', 'نطابق ملفك مع معايير كل جهة…', 'نستخرج المنتج المناسب لك في كل جهة…', 'نتحقق من شروط القبول…', 'نرتّب الجهات حسب احتمال قبولك…', 'نجهّز متطلبات التقديم…'];
                    setMatching(true); setMatchNotice('running'); setPendingTracks([]); let k = 0; let last = matchCount || 0;
                    try {
                      const info = await (await fetch('/api/match/run')).json();
                      const start = (info.resume && info.resume[tr]) || 0;
                      let stop = false;
                      for (let w = start; w < 40 && !stop; w += 1) {
                        setMatchPhase(PH[k++ % PH.length]);
                        const rs = await Promise.all([w].map(bn =>
                          fetch('/api/match/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ track: tr, batch: bn }) })
                            .then(x => x.json()).catch(() => ({ done: true }))
                        ));
                        for (const d of rs) {
                          if (typeof d.count === 'number' && d.count > last) last = d.count;
                          if (d.done) stop = true;
                        }
                      }
                    } catch {}
                    try {
                      let off = 0, g2 = 0;
                      while (g2++ < 10) {
                        setMatchPhase('نجهّز طريق التقديم لكل جهة…');
                        const er = await fetch('/api/match/enrich', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ track: tr, offset: off }) });
                        const ed = await er.json();
                        if (!er.ok || ed.done) break;
                        off = ed.next;
                      }
                    } catch {}
                    setMatchCount(last); setMatchPhase(''); setMatching(false);
                    try { const q3 = await (await fetch('/api/match/run')).json(); setMatchNotice(q3.notice || ''); } catch {}
                    try { const q2 = await (await fetch('/api/match/run')).json(); setPendingTracks(q2.pending || []); setResumeMap(q2.resume || {}); } catch {}
                  }}
                    className="font-black text-sm px-7 py-3 rounded-full disabled:opacity-50" style={{ background: '#C9A84C', color: '#1A3D34' }}>
                    {((resumeMap[tr] || 0) > 0 ? 'أكمل مطابقة ' : 'طابق جهات ') + (tr === 'investment' ? 'الاستثمار' : 'التمويل')}
                  </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {!showResults && pendingTransfer && (
        <div style={{ background: '#1A3D34', padding: '14px 16px' }}>
          <div className="max-w-5xl mx-auto text-center">
            <div className="text-white font-black text-sm">استلمنا تحويلك — قيد المراجعة</div>
            <div className="text-[#CFE0DA] text-xs font-bold mt-1 leading-relaxed">
              {pendingTransfer.amount > 0 ? pendingTransfer.amount.toLocaleString('ar-SA') + ' ر.س · ' : ''}
              يراجعه فريق مُرضي ويُفعَّل ملفك فور التأكد. <b>لا حاجة لتحويل مرة أخرى.</b>
            </div>
          </div>
        </div>
      )}

      {!showResults && !pendingTransfer && Object.keys(scores || {}).length > 0 && (
        <div style={{ background: '#1A3D34', padding: '14px 16px' }}>
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-3 flex-wrap">
            <div className="text-right">
              <div className="text-white font-black text-sm">درجتك جاهزة — والخطوة التالية مجانية</div>
              <div className="text-[#CFE0DA] text-xs font-bold mt-1 leading-relaxed">اطلب تشغيل المطابقة لتعرف كم جهة تنطبق شروطها على ملفك. لا يُطلب منك دفع في هذه الخطوة.</div>
            </div>
            <button onClick={() => setShowPaywall(true)} className="font-black text-sm px-6 py-2.5 rounded-full whitespace-nowrap" style={{ background: '#C9A84C', color: '#1A3D34', border: 'none', cursor: 'pointer' }}>اطلب المطابقة ←</button>
          </div>
        </div>
      )}

      {/* الشريط العلوي */}
      <nav className="bg-white border-b border-[#F0F5F3] px-3 md:px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-[#1A3D34] flex items-center justify-center">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M3 17L9 11L13 15L21 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M15 7H21V13" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <div>
              <span className="font-black text-[#1A3D34] text-lg block leading-tight">مُرضي</span>
              <span className="text-[10px] tracking-widest text-[#A3BAB2] font-black">MURDI</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={async () => {
              // كان رابطاً يُعيد التوجيه بلا إنهاء الجلسة — فمن يفتح الجهاز بعده يدخل على الملف المالي
              try {
                const sb = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string);
                await sb.auth.signOut();
              } catch {}
              router.push('/auth/login');
            }} className="px-4 py-2 rounded-full border border-[#E8F5EF] text-[#6B8A80] font-bold text-sm">خروج</button>
          </div>
        </div>
      </nav>

      {/* شريط التبويبات */}
      <div className="bg-white border-b border-[#F0F5F3] px-3 md:px-6">
        <div className="max-w-5xl mx-auto flex gap-1 overflow-x-auto min-w-0">
          {[
            { id: 'overview', label: 'نظرة عامة' },
            { id: 'consult', label: 'الاستشارة والأسئلة' },
            { id: 'services', label: 'الخدمات' },
          ].map((t) => (
            <button key={t.id} onClick={() => { tabChosen.current = true; setTab(t.id as 'overview' | 'consult' | 'services'); }}
              className={'px-3 md:px-5 py-4 font-black text-[13px] md:text-sm whitespace-nowrap transition border-b-[3px] ' + (tab === t.id ? 'text-[#1A3D34] border-[#C9A84C]' : 'text-[#9DB3AB] border-transparent hover:text-[#6B8A80]')}>
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
            <div className="rounded-2xl p-6 md:p-8 mb-5 text-center" style={{ background: 'linear-gradient(135deg,#1A3D34,#2E5D4E)' }}>
              <p className="text-[#C9D8D0] text-sm font-bold mb-2">مؤشر جاهزية {company?.name || 'شركتك'}</p>
              <div className="text-5xl md:text-6xl font-black text-[#C9A84C] leading-none">{overall}<span className="text-2xl text-[#9DB3AB]"> / 100</span></div>
              <p className="text-white font-bold mt-4">شركتك أفضل من <span className="text-[#C9A84C]">{pct}%</span> من الشركات في مرحلتك</p>
              <p className="text-[#8FA8A0] text-xs font-bold mt-1">يتحدّث مع كل تقييم</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
              {TRACKS.map((t) => (
                <div key={t.id} className="bg-white rounded-2xl p-5 border-2 border-[#F0F5F3] text-center">
                  <div className="w-10 h-[3px] bg-[#C9A84C] mb-5"></div>
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
              <button onClick={() => setShowCard(true)} className="px-8 py-3 rounded-full bg-[#C9A84C] text-[#1A3D34] font-black text-sm">بطاقة عرض شركتك</button>
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
              className={'text-right bg-white rounded-2xl p-5 md:p-7 border transition relative ' + (selected === t.id ? 'border-[#1A3D34] shadow-md' : 'border-[#F0F5F3]')}>
              {selected === t.id && (
                <span className="absolute top-4 left-4 w-7 h-7 rounded-full bg-[#1A3D34] text-white flex items-center justify-center text-sm font-black">✓</span>
              )}
              <div className="w-10 h-[3px] bg-[#C9A84C] mb-5"></div>
              <h3 className="font-black text-[#1A3D34] text-lg mb-1">{t.title}</h3>
              <p className="text-[10px] tracking-widest text-[#A3BAB2] font-black mb-3">{t.en}</p>
              <p className="text-[#6B8A80] text-sm font-bold leading-relaxed">{t.desc}</p>
            </button>
          ))}
        </div>

        <div className="text-center mb-16">
          <button onClick={go} className="px-14 py-4 rounded-full bg-[#1A3D34] text-white font-black text-lg shadow-lg shadow-[#1A3D34]/25">
            ابدأ التقييم
          </button>
        </div>
        </>)}

        <div style={{ display: tab === 'consult' ? 'block' : 'none' }}>
        <ConsultationPanel />
        </div>

        {tab === 'services' && (
        <div className="mb-16">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-black text-[#1A3D34] mb-2" style={{ fontFamily: 'Amiri, serif' }}>من التوصية إلى التنفيذ</h2>
            <p className="text-[#6B8A80] font-bold text-sm leading-relaxed max-w-xl mx-auto mb-4">المنصة تكشف لك ما تحتاجه شركتك. وفريق د. عبدالحكيم المرضي ينفّذه معك خطوةً بخطوة — بسعر معلن ومدة معلومة، بلا مكالمة ولا مساومة.</p>
            <div className="inline-flex flex-col items-center gap-1 px-6 py-3 rounded-2xl bg-[#F7FBF9] border border-[#EAF2EE]">
              <div className="text-[#1A3D34] font-black text-sm">{SERVICE_COUNT} خدمة تؤهّل منشأتك لرأس المال</div>
              <div className="text-[#9DB3AB] text-xs font-bold">كل واحدة منها تُزيل عائقاً بعينه بين ملفك وبين الجهة التي تموّله</div>
            </div>
          </div>

          {/* ما يقوله ملفك — دليل من إجاباته يصنع السؤال الذي لا تجيبه إلا المطابقة */}
          {pitch && !showResults && (
            <div className="rounded-2xl p-6 mb-8 text-center" style={{ background: '#1A3D34' }}>
              <div className="text-white font-black text-base mb-3" style={{ fontFamily: 'Amiri, serif' }}>{pitch.headline}</div>
              {pitch.lines.map((l, i) => (
                <p key={i} className="text-[#CFE0DA] text-sm font-bold leading-loose mb-2 max-w-2xl mx-auto text-right">{l}</p>
              ))}
              {/* كان يمضي إلى /pay — بوابة اشتراكٍ أُلغي. والخطوة التالية مجانية،
                  فصار الزرّ ينزل إلى موضع الطلب لا إلى صفحة دفع. */}
              <a href="#match-request" className="inline-block mt-3 font-black text-sm px-7 py-3 rounded-full" style={{ background: '#C9A84C', color: '#1A3D34' }}>اطلب تشغيل المطابقة ←</a>
            </div>
          )}
          {CATALOG.map((cat, ci) => (
            <div key={ci} className="mb-7">
              <div className="flex items-baseline gap-3 mb-4 border-b-2 border-[#EAF2EE] pb-2">
                <span className="text-lg font-black text-[#1A3D34]">{cat.label}</span>
                <span className="text-[#9DB3AB] text-xs font-bold">{cat.note}</span>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                {[...cat.items].sort((a, b) => {
                  // ما يوقف ملفه يتقدّم، ثم ما ظهر فيه، ثم الباقي بترتيبه الأصلي
                  const rk = (t: string) => ({ blocking: 0, strong: 1, fit: 2 } as Record<string, number>)[reasons[t]?.urgency ?? ''] ?? 3;
                  return rk(a) - rk(b);
                }).map((title, ii) => {
                  const c = commercialFor(title);
                  const label = displayName(title);
                  const isHighlighted = highlightService === title;
                  const pr = priceFor(canonicalTitle(title));
                  const isOpen = openDetails === title;
                  return (
                  <div key={ii}
                    ref={isHighlighted ? (el) => { if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 400); } : undefined}
                    className="bg-white rounded-2xl p-6 flex flex-col"
                    style={{ border: isHighlighted ? '2.5px solid #C9A84C' : '2px solid #EAF2EE', boxShadow: isHighlighted ? '0 0 0 4px rgba(201,168,76,0.15)' : undefined }}>
                    {isHighlighted && <div style={{ background: '#C9A84C', color: '#fff', fontSize: 11, fontWeight: 900, padding: '3px 12px', borderRadius: 999, alignSelf: 'flex-start', marginBottom: 10 }}>⭐ الخدمة المقترحة لك</div>}
                    <h4 className="font-black text-[#1A3D34] text-base mb-2 leading-snug">{label}</h4>

                    {/* الألم أولاً: العميل يعرف نفسه في السطر قبل أن يعرف الخدمة */}
                    <p className="text-[#6B8A80] text-sm font-bold leading-relaxed mb-4">{c?.pain || ''}</p>

                    {/* الدليل: ما ظهر في ملفه هو — يبيع أكثر من أي وصف، لأنه قياس لا عرض */}
                    {reasons[title] && (() => {
                      const rz = reasons[title];
                      const tone = rz.urgency === 'blocking'
                        ? { bg: '#FBEEEC', bd: '#F0D6D2', fg: '#B4453C', lb: 'يوقف ملفك الآن' }
                        : rz.urgency === 'strong'
                        ? { bg: '#FBF5E8', bd: '#EAD9A8', fg: '#9A7B2E', lb: 'ظهر في ملفك' }
                        : { bg: '#F2FAF6', bd: '#CBE8DA', fg: '#1A7A5A', lb: 'يرفع فرصتك' };
                      return (
                        <div className="rounded-xl p-3 mb-4" style={{ background: tone.bg, border: '1px solid ' + tone.bd }}>
                          <div className="font-black text-[11px] mb-1" style={{ color: tone.fg }}>● {tone.lb}</div>
                          <div className="text-[#3A4D47] text-xs font-bold leading-relaxed">{rz.evidence}</div>
                          {rz.hook && <div className="text-[#6B8A80] text-[11px] font-bold leading-relaxed mt-1.5">{rz.hook}</div>}
                        </div>
                      );
                    })()}

                    {/* السعر والمدة — معلنان، فلا يحتاج العميل مكالمة ليعرفهما */}
                    <div className="flex items-baseline justify-between gap-2 mb-1 pb-3 border-b border-dashed border-[#EAF2EE]">
                      <span className="text-[#1A3D34] font-black text-lg">{pr.amount != null ? pr.amount.toLocaleString('ar-SA') + ' ر.س' : (pr.label || 'بعرض خاص')}</span>
                      <span className="text-[#9DB3AB] text-xs font-bold">{c?.days || ''}</span>
                    </div>
                    {c?.successFee && <div className="text-[#9A7B2E] text-[11px] font-bold leading-relaxed mb-1 pt-2">{c.successFee.replace(/\*\*/g, '')}</div>}
                    {c?.quoteBasis && pr.amount == null && <div className="text-[#9DB3AB] text-[11px] font-bold leading-relaxed mb-1 pt-2">{c.quoteBasis}</div>}

                    {/* التفاصيل الكاملة داخل البطاقة — لا صفحة أخرى ولا مكالمة */}
                    {c && (
                      <>
                        <button onClick={() => setOpenDetails(isOpen ? '' : title)}
                          className="text-[#1A7A5A] font-black text-xs py-2 text-right">
                          {isOpen ? 'إخفاء التفاصيل ▲' : 'ما الذي نفعله بالضبط؟ ▼'}
                        </button>
                        {isOpen && (
                          <div className="rounded-2xl bg-[#F7FBF9] border border-[#EAF2EE] p-4 mb-3 text-right">
                            {c.level && <div className="text-[#9A7B2E] text-xs font-black mb-3">{c.level}</div>}
                            <div className="text-[#1A3D34] text-xs font-black mb-1.5">ماذا نفعل</div>
                            <ul className="mb-3 pr-4" style={{ listStyle: 'disc' }}>
                              {c.whatWeDo.map((x, k) => <li key={k} className="text-[#4A6A60] text-xs font-bold leading-relaxed mb-1">{x}</li>)}
                            </ul>
                            <div className="text-[#1A3D34] text-xs font-black mb-1.5">ما تستلمه</div>
                            <ul className="mb-3 pr-4" style={{ listStyle: 'disc' }}>
                              {c.deliverables.map((x, k) => <li key={k} className="text-[#4A6A60] text-xs font-bold leading-relaxed mb-1">{x}</li>)}
                            </ul>
                            <div className="text-[#1A3D34] text-xs font-black mb-1.5">ما الذي يتغيّر</div>
                            <p className="text-[#4A6A60] text-xs font-bold leading-relaxed mb-3">{c.afterwards}</p>
                            <div className="text-[#4A6A60] text-xs font-bold leading-relaxed mb-1"><span className="text-[#1A3D34] font-black">لمن: </span>{c.forWho}</div>
                            {c.notForWho && <div className="text-[#9A7B2E] text-xs font-bold leading-relaxed mb-1"><span className="font-black">ليست لمن: </span>{c.notForWho}</div>}
                            {c.objection && <div className="mt-3 pt-3 border-t border-dashed border-[#DCEBE4] text-[#4A6A60] text-xs font-bold leading-relaxed">{c.objection.replace(/\*\*/g, '')}</div>}
                          </div>
                        )}
                      </>
                    )}
                    <div className="flex-1"></div>
                    {(() => {
                      const req = serviceRequests[title];
                      const def = SERVICES[title];
                      // ما يُطلب مباشرةً لا يُشترط له تقييم — والتقييم العادل
                      // كان محجوباً خلف مسارَي الاستثمار والطرح بلا داعٍ، وهو
                      // منتج قائم بذاته يشتريه من لا ينوي جولةً ولا إدراجاً.
                      const neededTracks = needsDiagnosis(title) ? (TRACKS_OVERRIDE[title] || def?.tracks || []) : [];
                      const hasTrack = neededTracks.length === 0 || neededTracks.some((tk) => scores[tk] !== undefined);
                      if (!req && !hasTrack) {
                        const missing = neededTracks.map((tk) => TRACK_LABEL[tk]).join(' أو ');
                        const firstTrack = neededTracks[0];
                        return (
                          <div className="flex flex-col gap-2">
                            <div className="rounded-2xl bg-[#FBF5E8] border border-[#EAD9A8] p-3 text-center">
                              <div className="text-[#9A7B2E] font-black text-sm mb-1">تحتاج تقييم مسار {missing}</div>
                              <div className="text-[#6B5A2E] text-xs font-bold leading-relaxed">هذه الخدمة تخص مسار {missing}. قيّم جاهزيتك فيه أولاً ليتمكّن فريق مُرضي من تحليل دقيق وفق منهجيته.</div>
                            </div>
                            <button onClick={() => router.push('/assessment/' + firstTrack)} className="text-center py-2.5 rounded-full bg-[#C9A84C] text-[#1A3D34] font-black text-sm">ابدأ تقييم {TRACK_LABEL[firstTrack]} ←</button>
                          </div>
                        );
                      }
                      if (!req) {
                        return (
                          <div className="flex flex-col gap-2">
                            <button onClick={() => { if (needsForm(title)) { setOrderCategory(cat.label); openOrder(title); } else { submitServiceRequest(title, cat.label); } }} className="text-center py-2.5 rounded-full bg-[#1A3D34] text-white font-black text-sm">{needsForm(title) ? 'اطلبها — واعرف سعرك الآن' : 'تقديم طلب الخدمة'}</button>
                            <a href={'https://wa.me/966570314005?text=' + encodeURIComponent('السلام عليكم، أستفسر عن خدمة: ' + label)} target="_blank" rel="noopener noreferrer" className="text-center py-2 rounded-full border border-[#E8F5EF] text-[#6B8A80] font-bold text-xs">استفسار سريع عبر واتساب</a>
                          </div>
                        );
                      }
                      const STAT: Record<string, { t: string; bg: string; fg: string }> = {
                        submitted: { t: 'بانتظار الفريق والدكتور', bg: '#FBF5E8', fg: '#9A7B2E' },
                        in_progress: { t: 'قيد التجهيز', bg: '#EAF7F0', fg: '#9A7B2E' },
                        priced: { t: 'جاهزة — بانتظار الدفع', bg: '#FBF3DC', fg: '#B8860B' },
                        paid: { t: 'تم الدفع — يُجهَّز التسليم', bg: '#E8F5EF', fg: '#1A7A4C' },
                        delivered: { t: 'جاهزة — يمكنك طباعتها', bg: '#EAF7F0', fg: '#1E7A5A' },
                        // in_follow_up تُوضع لحظة إصدار العقد، لا لحظة مخاطبة الجهات.
                        // فلا يُكتب هنا ما يوهم العميل أن ملفه عند جهة تمويل قبل أن يصل إليها فعلاً.
                        in_follow_up: { t: 'صدر عقدك', bg: '#EAF7F0', fg: '#9A7B2E' },
                        rejected: { t: 'لم تُقبل — راجعنا للتفاصيل', bg: '#FBEEEC', fg: '#C0564B' },
                        completed: { t: 'مكتملة', bg: '#EAF7F0', fg: '#1E7A5A' },
                      };
                      let st = STAT[req.status] || STAT.submitted;
                      if (req.status === 'in_follow_up') {
                        const ct = COMMISSION_SERVICES[title];
                        const signed = ct ? clientContracts[ct]?.status === 'signed' : false;
                        st = signed
                          ? { t: 'عقدك موقّع — ملفك في الترتيب للمخاطبة', bg: '#EAF7F0', fg: '#1E7A5A' }
                          : { t: 'صدر عقدك — بانتظار توقيعك لتبدأ المخاطبة', bg: '#FBF5E8', fg: '#9A7B2E' };
                      }
                      return (
                        <div className="flex flex-col gap-2">
                          <div className="text-center py-2.5 rounded-full font-black text-sm" style={{ background: st.bg, color: st.fg }}>{st.t}</div>
                          {req.status === 'priced' && pendingTransfer && pendingTransfer.kind === 'service' && (
                            <div className="text-center text-[#1A7A5A] font-black text-xs leading-relaxed">استلمنا تحويلك لهذه الخدمة — قيد المراجعة. لا تُحوّل مرة أخرى.</div>
                          )}
                          {req.status === 'priced' && req.price && !(pendingTransfer && pendingTransfer.kind === 'service') && (
                            <div className="flex flex-col gap-2 mt-1">
                              <div className="text-center text-[#1A3D34] font-black text-lg">{Number(req.price).toLocaleString('ar-SA')} ر.س</div>
                              <button onClick={() => router.push('/pay/transfer?amount=' + req.price + '&kind=service&company_id=' + companyId + '&sr=' + (req.id || ''))} className="text-center py-2.5 rounded-full bg-[#1A3D34] text-white font-black text-sm">إتمام الدفع</button>
                            </div>
                          )}
                          {(req.status === 'delivered' || req.status === 'completed') && (
                            <button onClick={async () => {
                              const w = window.open('', '', 'width=800');   // يُفتح داخل نقرة المستخدم وإلا حجبه المتصفح
                              try {
                                const d = await (await fetch('/api/service-deliverable?id=' + encodeURIComponent(req.id))).json();
                                if (!w) return;
                                if (!d?.deliverable) { w.document.write('<p dir=rtl style="font-family:Cairo">تعذّر جلب المحتوى — راجع فريق مُرضي.</p>'); w.document.close(); return; }
                                w.document.write('<html dir=rtl><head><meta charset=utf-8><title>' + label + '</title></head><body style="font-family:Cairo,Arial;padding:32px;line-height:2;white-space:pre-wrap">' + d.deliverable + '</body></html>');
                                w.document.close(); w.print();
                              } catch { if (w) { w.document.write('<p dir=rtl style="font-family:Cairo">تعذّر الاتصال.</p>'); w.document.close(); } }
                            }} className="text-center py-2 rounded-full bg-[#1A3D34] text-white font-black text-xs">طباعة الخدمة</button>
                          )}
                        </div>
                      );
                    })()}
                    {COMMISSION_SERVICES[title] && (() => {
                      const ctype = COMMISSION_SERVICES[title];
                      const ctr = clientContracts[ctype];
                      if (!ctr) return null;
                      return (
                        <div className="mt-3 pt-3 border-t border-dashed border-[#EAD9A8]">
                          <div className="text-[#9A7B2E] font-black text-xs mb-2">عقد الخدمة {ctr.status === 'signed' ? '— تم استلام توقيعك ' : '— بانتظار توقيعك'}</div>
                          <div className="flex flex-col gap-2">
                            <button onClick={() => { const w = window.open('', '', 'width=800'); if (w) { w.document.write('<html dir=rtl><head><meta charset=utf-8><title>عقد</title></head><body style="font-family:Cairo,Arial;padding:32px;line-height:2;white-space:pre-wrap">' + (ctr.body || '') + '</body></html>'); w.document.close(); w.print(); } }} className="text-center py-2 rounded-full bg-[#1A3D34] text-white font-black text-xs">اطبع العقد لقراءته وتوقيعه</button>
                            {ctr.status !== 'signed' && (
                              <label className="text-center py-2 rounded-full bg-[#C9A84C] text-[#1A3D34] font-black text-xs cursor-pointer">
                                ارفع العقد بعد توقيعه
                                <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadSignedContract(ctr.id, ctype, f); }} />
                              </label>
                            )}
                            {ctr.status === 'signed' && <div className="text-center py-2 rounded-full bg-[#EAF7F0] text-[#1E7A5A] font-black text-xs">تم رفع العقد الموقّع — فريق مُرضي يتابع معك</div>}
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

      {orderFor && (() => {
        const c = commercialFor(orderFor);
        const investment = Number(String(orderInvest).replace(/[^\d]/g, '')) || 0;
        const opt = c?.options?.find((o) => o.key === orderOption);
        const tiered = c?.tiersBy === 'investment';
        const shown = opt && opt.price != null
          ? { amount: opt.price, label: opt.price.toLocaleString('ar-SA') + ' ر.س' }
          : priceFor(canonicalTitle(orderFor), investment);
        const needInvestment = tiered && (!opt || opt.price == null);
        const ready = !needInvestment || investment > 0;
        return (
        <div onClick={() => setOrderFor('')} style={{ position: 'fixed', inset: 0, background: 'rgba(26,61,52,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} dir="rtl" style={{ fontFamily: 'Cairo', background: '#fff', borderRadius: 20, maxWidth: 480, width: '100%', maxHeight: '88vh', overflowY: 'auto', padding: '28px 26px', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <h2 style={{ color: '#1A3D34', fontSize: 19, fontWeight: 900, margin: '0 0 4px' }}>{displayName(orderFor)}</h2>
            <p style={{ color: '#9DB3AB', fontSize: 12, fontWeight: 700, margin: '0 0 18px' }}>سؤالان فقط، ويظهر سعرك فوراً.</p>

            {c?.options && c.options.length > 0 && (
              <div style={{ marginBottom: 18 }}>
                <div style={{ color: '#1A3D34', fontSize: 13, fontWeight: 900, marginBottom: 8 }}>١ · ما الذي تريده الآن؟</div>
                {c.options.map((o) => (
                  <button key={o.key} onClick={() => setOrderOption(o.key)}
                    style={{ display: 'block', width: '100%', textAlign: 'right', marginBottom: 8, padding: '12px 14px', borderRadius: 14, cursor: 'pointer', fontFamily: 'Cairo',
                      background: orderOption === o.key ? '#F2FAF6' : '#fff',
                      border: orderOption === o.key ? '2px solid #1A7A5A' : '2px solid #EAF2EE' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
                      <span style={{ color: '#1A3D34', fontWeight: 900, fontSize: 13.5 }}>{o.label}</span>
                      <span style={{ color: '#1A7A5A', fontWeight: 900, fontSize: 13 }}>{o.price != null ? o.price.toLocaleString('ar-SA') + ' ر.س' : 'بحسب حجمك'}</span>
                    </div>
                    <div style={{ color: '#9DB3AB', fontSize: 11, fontWeight: 700, marginTop: 3 }}>{o.days}</div>
                    {orderOption === o.key && (
                      <div style={{ marginTop: 8 }}>
                        {o.includes.map((x, k) => <div key={k} style={{ color: '#4A6A60', fontSize: 11.5, fontWeight: 700, lineHeight: 1.9 }}>✓ {x}</div>)}
                        {(o.excludes || []).map((x, k) => <div key={k} style={{ color: '#C3908F', fontSize: 11.5, fontWeight: 700, lineHeight: 1.9 }}>✕ {x}</div>)}
                        {o.note && <div style={{ color: '#9A7B2E', fontSize: 11.5, fontWeight: 800, lineHeight: 1.8, marginTop: 6 }}>{o.note}</div>}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}

            {tiered && (
              <div style={{ marginBottom: 18 }}>
                <div style={{ color: '#1A3D34', fontSize: 13, fontWeight: 900, marginBottom: 8 }}>٢ · مشروعك</div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  {([['new', 'مشروع جديد'], ['expansion', 'توسعة نشاط قائم']] as const).map(([k, lb]) => (
                    <button key={k} onClick={() => setOrderKind(k)}
                      style={{ flex: 1, padding: '10px', borderRadius: 999, cursor: 'pointer', fontFamily: 'Cairo', fontWeight: 900, fontSize: 12.5,
                        background: orderKind === k ? '#1A3D34' : '#fff', color: orderKind === k ? '#fff' : '#6B8A80',
                        border: orderKind === k ? '2px solid #1A3D34' : '2px solid #EAF2EE' }}>{lb}</button>
                  ))}
                </div>
                <input value={orderInvest} onChange={(e) => setOrderInvest(e.target.value)}
                  inputMode="numeric" placeholder="إجمالي الاستثمار التقديري بالريال — مثال: 1,500,000"
                  style={{ width: '100%', padding: '13px 14px', borderRadius: 14, border: '2px solid #EAF2EE', fontFamily: 'Cairo', fontWeight: 800, fontSize: 13.5, color: '#1A3D34', outline: 'none' }} />
                <div style={{ color: '#9DB3AB', fontSize: 11, fontWeight: 700, marginTop: 6 }}>رقم تقديري يكفي — يشمل التجهيز والمعدات ورأس المال العامل للسنة الأولى.</div>
              </div>
            )}

            <div style={{ background: '#F7FBF9', border: '1px solid #EAF2EE', borderRadius: 16, padding: '14px 16px', marginBottom: 16, textAlign: 'center' }}>
              <div style={{ color: '#9DB3AB', fontSize: 11.5, fontWeight: 800, marginBottom: 4 }}>سعرك</div>
              <div style={{ color: '#1A3D34', fontSize: 24, fontWeight: 900 }}>
                {ready ? (shown.amount != null ? shown.amount.toLocaleString('ar-SA') + ' ر.س' : 'بعرض خاص') : '—'}
              </div>
              {!ready && <div style={{ color: '#9A7B2E', fontSize: 11.5, fontWeight: 800, marginTop: 4 }}>أدخل حجم استثمارك ليظهر سعرك</div>}
              {ready && shown.amount == null && c?.quoteBasis && <div style={{ color: '#6B8A80', fontSize: 11.5, fontWeight: 700, marginTop: 6, lineHeight: 1.8 }}>{c.quoteBasis}</div>}
            </div>

            <button disabled={!ready || orderBusy} onClick={() => confirmOrder(orderCategory)}
              style={{ width: '100%', background: ready ? '#1A3D34' : '#C7D8D2', color: '#fff', border: 'none', padding: '14px', borderRadius: 999, fontFamily: 'Cairo', fontWeight: 900, fontSize: 15, cursor: ready ? 'pointer' : 'not-allowed', marginBottom: 8 }}>
              {orderBusy ? 'جارٍ الإرسال…' : 'تأكيد الطلب'}
            </button>
            <button onClick={() => setOrderFor('')}
              style={{ width: '100%', background: 'transparent', color: '#9DB3AB', border: 'none', padding: '8px', fontFamily: 'Cairo', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              إغلاق
            </button>
          </div>
        </div>
        );
      })()}

      {showPaywall && (
        <div onClick={() => setShowPaywall(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(26,61,52,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} dir="rtl" style={{ fontFamily: 'Cairo', background: '#fff', borderRadius: 20, maxWidth: 460, width: '100%', padding: '32px 28px', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            {/* أُلغي رسم التشغيل. لم يعد هنا جدار دفع، بل طلبٌ يُؤذن به —
                فالتشغيلة تكلّف، والإذن قرار المكتب لا قرار العميل. */}
            <h2 id="match-request" style={{ color: '#1A3D34', fontSize: 22, fontWeight: 900, margin: '0 0 12px', scrollMarginTop: 90 }}>شغّل مطابقتك</h2>
            <p style={{ color: '#3A4D47', fontSize: 14.5, lineHeight: 1.95, margin: '0 0 10px' }}>
              نطابق ملفك مع شبكة جهات مُرضي، ونستخرج الجهات التي تنطبق شروطها عليك أنت،
              والمنتج المناسب لك عند كل واحدة.
            </p>
            <p style={{ color: '#1A7A5A', fontSize: 14, fontWeight: 900, margin: '0 0 18px' }}>
              والمطابقة مجانية — لا رسوم عليها.
            </p>
            {matchReq === 'requested' ? (
              <div style={{ background: '#FBF5E8', border: '1px solid #E8D9AE', borderRadius: 12, padding: '14px 16px', color: '#8A6D1F', fontSize: 13.5, fontWeight: 800, lineHeight: 1.85 }}>
                استلمنا طلبك. يراجعه المستشار ويفتح لك التشغيلة، ويصلك إشعار فور جاهزيتها.
              </div>
            ) : (
              <button disabled={reqBusy} onClick={async () => {
                setReqBusy(true);
                try {
                  const r = await fetch('/api/match/request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ track: 'funding' }) });
                  if (r.ok) setMatchReq('requested');
                } catch {}
                setReqBusy(false);
              }}
                style={{ width: '100%', background: '#1A3D34', color: '#fff', border: 'none', padding: '14px', borderRadius: 999, fontFamily: 'Cairo', fontWeight: 900, fontSize: 15, cursor: 'pointer', marginBottom: 10 }}>
                {reqBusy ? 'جارٍ الإرسال…' : 'اطلب تشغيل المطابقة'}
              </button>
            )}
            <button onClick={() => setShowPaywall(false)}
              style={{ width: '100%', background: 'transparent', color: '#9DB3AB', border: 'none', padding: '10px', fontFamily: 'Cairo', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              إغلاق
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
