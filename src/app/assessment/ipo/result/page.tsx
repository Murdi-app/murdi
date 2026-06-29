'use client';

import { useEffect, useState } from 'react';
import { suggestService, suggestAllServices } from '@/lib/serviceSuggestion';
import { createBrowserClient } from '@supabase/ssr';

type Result = {
  readiness_score: number;
  months_to_ready?: number;
  valuation_estimate?: string;
  verdict: string;
  top_obstacles: string[];
  required_documents: string[];
  improvement_plan: string[];
};

export default function IpoResult() {
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [eligibility, setEligibility] = useState('');
  const [eligLoading, setEligLoading] = useState(true);
  const [finData, setFinData] = useState<{ rev: number; profit: number; growth: string } | null>(null);
  const [fdRaw, setFdRaw] = useState<Record<string, unknown> | null>(null);
  const [companyId, setCompanyId] = useState<string>('');
  const [bundleStatus, setBundleStatus] = useState<string>('');

  useEffect(() => {
    const load = async () => {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL as string,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
      );
      const { data: { user } } = await supabase.auth.getUser();
      if (user === null) { setLoading(false); return; }

      const { data: company } = await supabase
        .from('companies')
        .select('id')
        .eq('user_id', user.id)
        .single();
      if (company === null) { setLoading(false); return; }
      setCompanyId(company.id);

      const { data: fd } = await supabase
        .from('financial_data')
        .select('annual_revenue, net_profit, revenue_growth, repayment_status, debt_status, has_financial_statements, audited_statements, has_governance, has_debt')
        .eq('company_id', company.id)
        .eq('assessment_type', 'ipo')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      if (fd) { setFinData({ rev: Number(fd.annual_revenue) || 0, profit: Number(fd.net_profit) || 0, growth: fd.revenue_growth || '' }); setFdRaw(fd); }

      const { data: rr } = await supabase
        .from('readiness_results')
        .select('readiness_score, verdict, top_obstacles, required_documents, improvement_plan, months_to_ready, valuation_estimate')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      setResult(rr);
      setLoading(false);

      // استدعاء الاستشارة فوراً (الأهم) — بلا انتظار أي شيء قبله
      fetch('/api/consultation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'ipo' }) }).catch(() => {});
      // المطابقة وإشعار الأدمن يتمّان تلقائياً ومتيناً داخل التقييم (runIpoMatch) — لا حاجة لاستدعاء هنا

      // تحليل الأهلية للطرح (بحث في مصادر الهيئة — يظهر للعميل)
      fetch('/api/ipo-eligibility', { method: 'POST' })
        .then((r) => r.json())
        .then((d) => { setEligibility(d.eligibility || ''); setEligLoading(false); })
        .catch(() => setEligLoading(false));
    };
    load();
  }, []);

  if (loading) {
    return (
      <div dir="rtl" className="min-h-screen bg-[#FBFCFB] flex items-center justify-center" style={{ fontFamily: 'Cairo, sans-serif' }}>
        <p className="text-[#6B8A80] font-bold">جارٍ تحميل النتيجة...</p>
      </div>
    );
  }

  if (result === null) {
    return (
      <div dir="rtl" className="min-h-screen bg-[#FBFCFB] flex items-center justify-center" style={{ fontFamily: 'Cairo, sans-serif' }}>
        <p className="text-[#6B8A80] font-bold">لا توجد نتيجة — ابدأ التقييم أولاً</p>
      </div>
    );
  }

  const parseValuation = () => {
    if (!result?.valuation_estimate) return null;
    try {
      const v = JSON.parse(result.valuation_estimate);
      if (typeof v.lo === 'number' && typeof v.hi === 'number' && v.hi > 0) return v;
    } catch {}
    return null;
  };
  const estimateValuation = () => {
    if (finData === null) return null;
    const { rev, profit, growth } = finData;
    let lo = 0, hi = 0, basis = '';
    if (profit > 0) {
      let ml = 6, mh = 8;
      if (growth === 'high') { ml = 9; mh = 12; }
      else if (growth === 'medium') { ml = 7; mh = 9; }
      lo = profit * ml; hi = profit * mh; basis = 'multiple';
    } else if (rev > 0) {
      lo = rev * 1; hi = rev * 1.5; basis = 'revenue';
    } else {
      return null;
    }
    return { lo, hi, basis };
  };
  const aiVal = parseValuation();
  const valuation = aiVal ? { lo: aiVal.lo, hi: aiVal.hi, basis: 'multiple', note: aiVal.note || '' } : estimateValuation();
  const fmtM = (n: number) => (n >= 1000000 ? (n / 1000000).toFixed(1) + ' مليون' : Math.round(n / 1000).toLocaleString() + ' ألف');

  function printResult() {
    if (!result) return;
    const esc = (t: unknown) => String(t || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const sc = result.readiness_score;
    const col = sc >= 70 ? '#2E9E7B' : sc >= 50 ? '#C9A84C' : '#C0564B';
    const today = new Date().toLocaleDateString('ar-SA', { year:'numeric', month:'long', day:'numeric' });
    const listHTML = (arr: unknown) => Array.isArray(arr) && arr.length
      ? '<ul>' + arr.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul>' : '';
    const rmap = (result.improvement_plan || []).filter((p: string) => p.startsWith('السوق المقترح') === false);
    const mkt = (result.improvement_plan || []).find((p: string) => p.startsWith('السوق المقترح'));
    const obstacles = listHTML(result.top_obstacles);
    const roadmapHTML = listHTML(rmap);
    const val = result.valuation_estimate ? esc(result.valuation_estimate) : '';
    const months = result.months_to_ready ? esc(result.months_to_ready) : '';
    const html = '<!DOCTYPE html><html dir=rtl lang=ar><head><meta charset=utf-8><title>نتيجة جاهزيتك للطرح</title>'
      + '<style>'
      + '@import url("https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap");'
      + '*{margin:0;padding:0;box-sizing:border-box;font-family:Cairo,Arial,sans-serif}'
      + 'body{padding:40px;color:#1A3D34;line-height:1.9}'
      + '.head{text-align:center;border-bottom:3px solid #C9A84C;padding-bottom:20px;margin-bottom:28px}'
      + '.brand{color:#C9A84C;font-size:14px;font-weight:900;letter-spacing:1px}'
      + '.head h1{font-size:24px;margin-top:8px}'
      + '.score-box{text-align:center;margin:30px 0}'
      + '.score{font-size:64px;font-weight:900;color:' + col + '}'
      + '.score small{font-size:20px;color:#A3BAB2}'
      + '.verdict{font-size:20px;font-weight:900;margin-top:10px}'
      + '.info{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin:18px 0}'
      + '.chip{background:#F0F5F3;border-radius:12px;padding:12px 18px;font-size:14px;font-weight:900;color:#1A3D34}'
      + '.sec{margin:24px 0}'
      + '.sec h2{font-size:17px;color:#1A3D34;border-right:5px solid #2E9E7B;padding-right:10px;margin-bottom:10px}'
      + 'ul{padding-right:24px}li{margin-bottom:7px;font-size:14px}'
      + '.method{background:#F0F5F3;border-radius:12px;padding:14px;font-size:12.5px;color:#6B8A80;text-align:center;margin-top:20px}'
      + '.footer{margin-top:30px;padding-top:16px;border-top:2px solid #EEE;text-align:center;color:#9DB3AB;font-size:12px}'
      + '@media print{body{padding:20px}}'
      + '</style></head><body>'
      + '<div class=head><div class=brand>حلول المرضي للاستشارات المالية · منصة مُرضي</div><h1>تقرير جاهزيتك للطرح (IPO)</h1></div>'
      + '<div class=score-box><div class=score>' + sc + '<small>/100</small></div><div class=verdict style="color:' + col + '">' + esc(result.verdict) + '</div></div>'
      + ((val || months || mkt) ? '<div class=info>' + (val ? '<div class=chip>التقييم: ' + val + '</div>' : '') + (months ? '<div class=chip>المدة المتوقعة: ' + months + '</div>' : '') + (mkt ? '<div class=chip>' + esc(mkt) + '</div>' : '') + '</div>' : '')
      + (obstacles ? '<div class=sec><h2>أبرز العقبات</h2>' + obstacles + '</div>' : '')
      + (roadmapHTML ? '<div class=sec><h2>خارطة الطريق للطرح</h2>' + roadmapHTML + '</div>' : '')
      + '<div class=method>تحليل وفق منهجية د. عبدالحكيم المرضي — دكتوراه إدارة الأعمال، عضوية البورد الأمريكي، وخبرة ١٥ عاماً في القطاع المالي</div>'
      + '<div class=footer>' + today + ' · هذا التقرير لأغراض التقييم الاسترشادي</div>'
      + '</body></html>';
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); }
  }

  const scoreColor = result.readiness_score >= 70 ? '#2E9E7B' : result.readiness_score >= 50 ? '#C9A84C' : '#C0564B';
  const roadmap = result.improvement_plan?.filter((p) => p.startsWith('السوق المقترح') === false) || [];
  const market = result.improvement_plan?.find((p) => p.startsWith('السوق المقترح'));

  return (
    <div dir="rtl" className="min-h-screen bg-[#FBFCFB] px-4 py-8" style={{ fontFamily: 'Cairo, sans-serif' }}>
      <div className="max-w-2xl mx-auto mb-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <a href="/goal" className="inline-flex items-center gap-2 text-[#6B8A80] hover:text-[#2E9E7B] font-black text-sm transition-colors">
            <span style={{ fontSize: 18 }}>→</span> رجوع للمركز
          </a>
          <button onClick={printResult} className="inline-flex items-center gap-2 bg-[#1A3D34] text-white font-black text-sm px-5 py-2.5 rounded-full hover:opacity-90 transition">
            🖨️ احفظ نتيجتك PDF
          </button>
        </div>
      </div>
      <div className="max-w-xl mx-auto space-y-6">

        <div className="bg-white rounded-2xl p-8 shadow-sm border border-[#E8F5EF] text-center">
          <p className="text-[#6B8A80] font-bold mb-2">IPO Readiness Score</p>
          <p className="text-6xl font-black" style={{ color: scoreColor }}>{result.readiness_score}</p>
          <p className="text-lg font-black text-[#1A3D34] mt-3">{result.verdict}</p>
          <p className="text-[#A3BAB2] text-xs font-bold mt-2 leading-relaxed">تحليل وفق منهجية د. عبدالحكيم المرضي — دكتوراه إدارة الأعمال، عضوية البورد الأمريكي، وخبرة 15 عاماً في القطاع المالي</p>
          {market && <p className="text-[#2E9E7B] font-black text-sm mt-2">{market}</p>}
        </div>

        {(result.months_to_ready ?? 0) > 0 && (
          <div className="bg-gradient-to-br from-[#1A3D34] to-[#2E5D4E] rounded-2xl p-6 text-center shadow-sm">
            <p className="text-[#D8E8E0] font-bold text-sm mb-1">المدة التقديرية حتى جاهزية الطرح</p>
            <p className="text-white font-black text-5xl mb-1">{result.months_to_ready}</p>
            <p className="text-[#C9A84C] font-black text-lg mb-3">شهراً</p>
            <p className="text-[#D8E8E0] text-xs font-bold leading-relaxed">تقدير مبني على الفجوات الحالية في ملفك — يقصُر كلما عالجت العوائق. فريق مُرضي يضع لك خطة زمنية تختصر هذه المدة.</p>
          </div>
        )}

        {result.top_obstacles?.length > 0 && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#E8F5EF]">
            <h2 className="font-black text-[#1A3D34] mb-4">العوائق أمام الطرح</h2>
            <ul className="space-y-2">
              {result.top_obstacles.map((o, i) => (
                <li key={i} className="text-[#6B8A80] font-bold text-sm">• {o}</li>
              ))}
            </ul>
          </div>
        )}

        {valuation !== null && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border-2 border-[#C9A84C]">
            <h2 className="font-black text-[#1A3D34] mb-1">💰 القيمة السوقية التقديرية للطرح</h2>
            <p className="text-[#6B8A80] text-xs font-bold mb-4">تقدير استرشادي مبدئي وفق ربحية شركتك ونموها على أساس مضاعفات السوق</p>
            <div className="bg-[#FBF5E8] rounded-xl p-5 text-center">
              <p className="text-[#9A7B2E] font-black text-2xl">{fmtM(valuation.lo)} — {fmtM(valuation.hi)} ريال</p>
              {(valuation as { note?: string }).note && (
                <p className="text-[#6B5B2E] text-xs font-bold mt-3 leading-relaxed">{(valuation as { note?: string }).note}</p>
              )}
              {valuation.basis === 'revenue' && (
                <p className="text-[#6B5B2E] text-xs font-bold mt-2">قُدّرت على أساس الإيرادات (الشركة دون ربحية صافية حالياً)</p>
              )}
            </div>
            <div className="mt-4">
              <div className="bg-[#F0F5F3] rounded-xl p-5">
                <p className="text-[#1A3D34] font-black text-sm mb-2">عند استيفاء متطلبات الحوكمة والإفصاح، يرتفع مضاعف التقييم إلى:</p>
                <p className="text-[#2E9E7B] font-black text-xl">{fmtM(valuation.hi * 1.5)} ريال</p>
              </div>
            </div>
            <p className="text-[#6B8A80] text-xs font-bold mt-4 leading-relaxed">القيمة الفعلية عند الطرح تحتاج تقييماً معمّقاً يعدّه فريق د. عبدالحكيم المرضي بالتنسيق مع المستشار المالي المرخّص.</p>
          </div>
        )}

        {roadmap.length > 0 && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border-2 border-[#2E9E7B]">
            <h2 className="font-black text-[#1A3D34] mb-1">خارطة الطريق للجاهزية</h2>
            <p className="text-[#6B8A80] text-xs font-bold mb-4">خطوات مرتبة للوصول لمتطلبات الإدراج</p>
            <ul className="space-y-3">
              {/* المرحلة الأولى — عيّنة مكشوفة */}
              <li className="text-[#1A3D34] text-sm font-bold bg-[#E8F5EF] rounded-xl p-3">1. {roadmap[0]}</li>
            </ul>

            {roadmap.length > 1 && (
              <ul className="space-y-3 mt-3">
                {roadmap.slice(1).map((p, i) => (
                  <li key={i} className="text-[#1A3D34] text-sm font-bold bg-[#E8F5EF] rounded-xl p-3">{i + 2}. {p}</li>
                ))}
              </ul>
            )}

            {/* الدعوة حسب الأهلية */}
            {result.readiness_score >= 65 ? (
              <div className="mt-5 bg-gradient-to-l from-[#FBF5E8] to-white rounded-xl p-5 border-2 border-[#C9A84C]">
                <h3 className="font-black text-[#1A3D34] mb-1">🎯 شركتك مؤهلة — افتح خطة الطرح الكاملة</h3>
                <p className="text-[#6B8A80] text-sm font-bold leading-relaxed mb-4">يُعدّ لك فريق د. عبدالحكيم المرضي خطة طرح تنفيذية كاملة: كل مرحلة بمدتها وتكلفتها، تجهيز ملف الهيئة، واختيار السوق الأنسب — بمرافقة حتى الإدراج.</p>
              </div>
            ) : (
              <div className="mt-5 bg-[#FBFCFB] rounded-xl p-5 border border-[#F0F5F3]">
                <h3 className="font-black text-[#1A3D34] mb-1">شركتك تحتاج تجهيزاً قبل الطرح</h3>
                <p className="text-[#6B8A80] text-sm font-bold leading-relaxed">ركّز على رفع جاهزيتك عبر معالجة العوائق أعلاه. عند وصولك لمستوى الجاهزية، يفتح فريق مُرضي لك خطة الطرح الكاملة ويرافقك في الطريق.</p>
              </div>
            )}
          </div>
        )}

        {/* رسالة: الاستشارة المجانية قيد الإعداد */}
        <div className="rounded-2xl p-6 border-2 border-[#C9A84C] bg-[#FDFBF6] text-center">
          <div className="inline-block w-7 h-7 rounded-full border-2 border-[#C9A84C]/30 border-t-[#C9A84C] animate-spin mb-3" />
          <h2 className="font-black text-[#1A3D34] mb-1">استشارتك المجانية قيد الإعداد الآن</h2>
          <p className="text-[#6B8A80] text-xs font-bold mb-4 leading-relaxed">فريق د. عبدالحكيم المرضي يُعدّ لك استشارة خاصة بمسار الطرح — تصلك فور جهوزها واعتمادها</p>
          <a href="/goal" className="inline-block px-6 py-2.5 rounded-full bg-[#C9A84C] text-white font-black text-sm">الذهاب لقسم الاستشارات ←</a>
        </div>

        {/* قسم: اقتراح الخدمة الذكي — يظهر حسب حاجة العميل فعلاً */}
        {fdRaw && (() => {
          const sug = suggestService(fdRaw, 'ipo', result.readiness_score);
          const theme = sug.urgency === 'required'
            ? { bg: '#FBECEC', border: '#C0564B', label: '🔴 خدمة ضرورية قبل الطرح', labelColor: '#A33' }
            : sug.urgency === 'none'
            ? { bg: '#EAF7F0', border: '#2E9E7B', label: '✅ ملفك سليم — لا حاجة لخدمة تجهيز', labelColor: '#1E7A5A' }
            : { bg: '#FBF5E8', border: '#C9A84C', label: '💡 خدمة موصى بها تقوّي ملفك', labelColor: '#9A7B2E' };
          return (
            <div style={{ background: theme.bg, border: '2px solid ' + theme.border, borderRadius: 16, padding: '22px 24px' }}>
              <div style={{ color: theme.labelColor, fontSize: 14, fontWeight: 900, marginBottom: 8 }}>{theme.label}</div>
              <div style={{ color: '#1A3D34', fontSize: 18, fontWeight: 900, marginBottom: 8 }}>{sug.icon} {sug.service}</div>
              <p style={{ color: '#5C4A1F', fontSize: 14, lineHeight: 1.9, fontWeight: 700, marginBottom: sug.urgency === 'none' ? 0 : 18 }}>{sug.why}</p>
              {sug.urgency !== 'none' && (
                <a href={'/goal?tab=services&highlight=' + encodeURIComponent(sug.service)}
                  style={{ display: 'inline-block', background: '#1A3D34', color: '#fff', fontWeight: 900, fontSize: 14, padding: '13px 30px', borderRadius: 999, textDecoration: 'none' }}>
                  اطلب هذه الخدمة من فريق مُرضي ←
                </a>
              )}
            </div>
          );
        })()}

        {fdRaw && result.readiness_score < 65 && (() => {
          const all = suggestAllServices(fdRaw, 'ipo', result.readiness_score);
          if (all.length === 0) return null;
          const submitAll = async () => {
            if (!companyId) return;
            const names = all.map(a => '• ' + a.service).join('\n');
            if (!confirm('سيتم تقديم طلب لكل الخدمات التالية:\n\n' + names + '\n\nتأكيد؟')) return;
            setBundleStatus('جارٍ التقديم...');
            const supabase = createBrowserClient(
              process.env.NEXT_PUBLIC_SUPABASE_URL as string,
              process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
            );
            const rows = all.map(a => ({
              company_id: companyId,
              service_title: a.service,
              service_category: 'تجهيز',
              status: 'submitted',
            }));
            const { error } = await supabase.from('service_requests').insert(rows);
            if (error) { setBundleStatus('تعذّر التقديم، حاول مرة أخرى'); return; }
            setBundleStatus('✅ تم تقديم طلباتك — فريق مُرضي سيتابع معك');
          };
          return (
            <div style={{ background: '#FBF5E8', border: '2px solid #C9A84C', borderRadius: 16, padding: '22px 24px', marginBottom: 20 }}>
              <div style={{ color: '#9A7B2E', fontSize: 14, fontWeight: 900, marginBottom: 10 }}>🧭 خطتك للجاهزية</div>
              <p style={{ color: '#5C4A1F', fontSize: 14, lineHeight: 1.9, fontWeight: 700, marginBottom: 14 }}>
                بناءً على نتيجتك، هذه الخطوات التي تهيّئ شركتك لرحلة الطرح. يرافقك فريق مُرضي فيها:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
                {all.map((a, i) => (
                  <div key={i} style={{ background: '#fff', borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <span style={{ fontSize: 20 }}>{a.icon}</span>
                    <div>
                      <div style={{ color: '#1A3D34', fontSize: 15, fontWeight: 900 }}>{a.service}
                        {a.urgency === 'required' && <span style={{ color: '#A33', fontSize: 11, fontWeight: 900, marginRight: 8 }}>ضروري</span>}
                      </div>
                      <div style={{ color: '#5C4A1F', fontSize: 12.5, lineHeight: 1.7, marginTop: 2 }}>{a.why}</div>
                    </div>
                  </div>
                ))}
              </div>
              {bundleStatus ? (
                <div style={{ background: '#EAF7F0', color: '#1E7A5A', fontWeight: 900, fontSize: 14, padding: '13px 20px', borderRadius: 999, textAlign: 'center' }}>{bundleStatus}</div>
              ) : (
                <button onClick={submitAll}
                  style={{ width: '100%', background: '#1A3D34', color: '#fff', fontWeight: 900, fontSize: 15, padding: '15px 30px', borderRadius: 999, border: 'none', cursor: 'pointer' }}>
                  قدّم لكل ما تحتاجه بضغطة — ويرافقك فريق مُرضي ←
                </button>
              )}
            </div>
          );
        })()}

        {/* قسم المستندات المطلوبة مخفي عن العميل عمداً — يبقى في DB ويظهر للأدمن */}

        {/* تحليل الأهلية للطرح — بحث في مصادر الهيئة */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border-2 border-[#1A3D34]">
          <h2 className="font-black text-[#1A3D34] mb-1">🏛️ تحليل أهليتك للطرح</h2>
          <p className="text-[#6B8A80] text-xs font-bold mb-4">وفق آخر متطلبات هيئة السوق المالية وتداول — مطابقة بأرقام شركتك</p>
          {eligLoading && (
            <div className="flex items-center gap-3 bg-[#FBFCFB] rounded-xl p-4">
              <div className="w-5 h-5 rounded-full border-2 border-[#1A3D34]/30 border-t-[#1A3D34] animate-spin" />
              <p className="text-[#6B8A80] font-bold text-sm">جارٍ تحليل أهليتك وفق متطلبات الهيئة... (قد يأخذ دقيقة)</p>
            </div>
          )}
          {eligLoading === false && eligibility !== '' && (() => {
            const clean = eligibility.replace(/^#+ /gm, '').replace(/\*\*/g, '');
            const cut = Math.min(450, Math.floor(clean.length / 3));
            const sample = clean.slice(0, cut);
            const rest = clean.slice(cut);
            return (
              <div>
                <div className="bg-[#FBFCFB] rounded-xl p-5 border border-[#F0F5F3] whitespace-pre-wrap text-[#1A3D34] text-sm font-bold leading-loose">{sample}…</div>
                {rest.length > 0 && (
                  <div className="bg-[#FBFCFB] rounded-xl p-5 border border-[#F0F5F3] whitespace-pre-wrap text-[#1A3D34] text-sm font-bold leading-loose mt-3">{rest}</div>
                )}
                {result.readiness_score >= 65 ? (
                  <div className="mt-5 rounded-2xl p-5 text-center" style={{ background: 'linear-gradient(135deg,#1A3D34,#2E5D4E)' }}>
                    <p className="text-3xl mb-2">🏛️</p>
                    <p className="font-black text-white mb-1">شركتك على أعتاب الطرح</p>
                    <p className="text-[#D8E8E0] text-sm font-bold leading-relaxed mb-4">يُعدّ لك فريق د. عبدالحكيم المرضي تحليل الأهلية الكامل وخطوات العمل الفورية، ويرافقك في تجهيز ملف الشركة لهيئة السوق المالية مرحلةً بمرحلة.</p>
                  </div>
                ) : (
                  <div className="mt-5 rounded-2xl p-5 text-center bg-[#FBF5E8] border border-[#E8D9B5]">
                    <p className="font-black text-[#1A3D34] mb-1">الطريق إلى الطرح يبدأ من هنا</p>
                    <p className="text-[#6B5B2E] text-sm font-bold leading-relaxed">ارفع جاهزيتك بمعالجة العوائق أعلاه، وفريق مُرضي مستعد لمرافقتك خطوة بخطوة حتى تستوفي متطلبات الهيئة.</p>
                  </div>
                )}
              </div>
            );
          })()}
          {eligLoading === false && eligibility === '' && (
            <p className="text-[#6B8A80] font-bold text-sm">تعذّر جلب المتطلبات حالياً — حاول لاحقاً أو تواصل مع فريق مُرضي.</p>
          )}
        </div>

        <div className="bg-[#E8F5EF] rounded-2xl p-6 text-center">
          <p className="text-[#1A3D34] font-black text-sm">فريق مُرضي استلم نتيجتك وسيتواصل معك لمناقشة خطة الطرح والخطوات التالية.</p>
        </div>

      </div>
    </div>
  );
}
