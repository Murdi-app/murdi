'use client';

import { useEffect, useState } from 'react';
import { canonicalTitle } from '@/lib/serviceCatalog';
import { suggestService, suggestAllServices } from '@/lib/serviceSuggestion';
import { createBrowserClient } from '@supabase/ssr';

type Result = {
  readiness_score: number;
  valuation_estimate?: string;
  verdict: string;
  top_obstacles: string[];
  required_documents: string[];
  improvement_plan: string[];
};

type Match = {
  funding_type: string;
  fit_percent: number;
  reasons: string[];
  next_step: string;
};

export default function InvestmentResult() {
  const [result, setResult] = useState<Result | null>(null);
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [matchCount, setMatchCount] = useState(0);
  const [finData, setFinData] = useState<{ rev: number; profit: number; growth: string } | null>(null);
  const [fdRaw, setFdRaw] = useState<Record<string, unknown> | null>(null);
  // بطاقة التفعيل كانت تُعرض لكل من يفتح الصفحة — بما فيهم من دفع بالفعل
  const [subActive, setSubActive] = useState(false);
  const [companyId, setCompanyId] = useState<string>('');
  const [bundleStatus, setBundleStatus] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [matchLoading, setMatchLoading] = useState(false);

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
        .select('id, subscription_active, subscription_end')
        .eq('user_id', user.id)
        .single();
      if (company === null) { setLoading(false); return; }
      setCompanyId(company.id);
      setSubActive(company.subscription_active === true
        && (!company.subscription_end || new Date(company.subscription_end) > new Date()));

      const { data: fd } = await supabase
        .from('financial_data')
        .select('annual_revenue, net_profit, revenue_growth, repayment_status, debt_status, has_financial_statements, audited_statements, has_governance, has_debt')
        .eq('company_id', company.id)
        .eq('assessment_type', 'investment')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      if (fd) { setFinData({ rev: Number(fd.annual_revenue) || 0, profit: Number(fd.net_profit) || 0, growth: fd.revenue_growth || '' }); setFdRaw(fd); }

      const { data: rr } = await supabase
        .from('readiness_results')
        .select('readiness_score, verdict, top_obstacles, required_documents, improvement_plan, valuation_estimate')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      setResult(rr);
      setLoading(false);

      // الاستشارة تستدعى دائماً (مستقلة عن السكور والمطابقة)
      fetch('/api/consultation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'investment' }) }).catch(() => {});

      if (rr !== null && rr.readiness_score >= 70) {
        // المطابقة تتم تلقائياً ومتيناً داخل التقييم وتُحفظ في الأدمن — هنا نقرأ العدد فقط
        setMatchLoading(true);
        try {
          const res = await fetch('/api/match/summary?track=investment', { method: 'GET' });
          const data = await res.json();
          if (res.ok) { setMatches(data.matches || []); setMatchCount(data.match_count || 0); }
        } catch {}
        setMatchLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div dir="rtl" className="min-h-screen bg-[#FBFCFB] flex items-center justify-center" style={{ fontFamily: 'Tajawal, Cairo, sans-serif' }}>
        <p className="text-[#6B8A80] font-bold">جارٍ تحميل النتيجة...</p>
      </div>
    );
  }

  if (result === null) {
    return (
      <div dir="rtl" className="min-h-screen bg-[#FBFCFB] flex items-center justify-center" style={{ fontFamily: 'Tajawal, Cairo, sans-serif' }}>
        <p className="text-[#6B8A80] font-bold">لا توجد نتيجة — ابدأ التقييم أولاً</p>
      </div>
    );
  }

  const parseValuation = () => {
    if (!result?.valuation_estimate) return null;
    try { const v = JSON.parse(result.valuation_estimate); if (typeof v.lo === 'number' && typeof v.hi === 'number' && v.hi > 0) return v; } catch {}
    return null;
  };
  const estimateValuation = () => {
    if (finData === null) return null;
    const { rev, profit, growth } = finData;
    let lo = 0, hi = 0, basis = '';
    if (profit > 0) {
      let ml = 4, mh = 5;
      if (growth === 'high') { ml = 6; mh = 8; }
      else if (growth === 'medium') { ml = 5; mh = 6; }
      lo = profit * ml; hi = profit * mh; basis = 'multiple';
    } else if (rev > 0) {
      lo = rev * 0.8; hi = rev * 1.2; basis = 'revenue';
    } else {
      return null;
    }
    return { lo, hi, basis, profit, growth };
  };
  const aiVal = parseValuation();
  const valuation = aiVal ? { lo: aiVal.lo, hi: aiVal.hi, basis: 'multiple', note: aiVal.note || '' } : estimateValuation();
  const fmtM = (n: number) => (n >= 1000000 ? (n / 1000000).toFixed(1) + ' مليون' : Math.round(n / 1000).toLocaleString() + ' ألف');

  function printResult() {
    if (!result) return;
    const esc = (t: unknown) => String(t || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const sc = result.readiness_score;
    const col = sc >= 70 ? '#1A3D34' : sc >= 50 ? '#C9A84C' : '#C0564B';
    const today = new Date().toLocaleDateString('ar-SA', { year:'numeric', month:'long', day:'numeric' });
    const listHTML = (arr: unknown) => Array.isArray(arr) && arr.length
      ? '<ul>' + arr.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul>' : '';
    const obstacles = listHTML(result.top_obstacles);
    const plan = listHTML(result.improvement_plan);
    const val = result.valuation_estimate ? esc(result.valuation_estimate) : '';
    const html = '<!DOCTYPE html><html dir=rtl lang=ar><head><meta charset=utf-8><title>نتيجة جاهزيتك الاستثمارية</title>'
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
      + '.val{background:#F0F5F3;border-radius:12px;padding:14px;text-align:center;margin:18px 0;font-size:15px;font-weight:900;color:#1A3D34}'
      + '.sec{margin:24px 0}'
      + '.sec h2{font-size:17px;color:#1A3D34;border-right:5px solid #1A3D34;padding-right:10px;margin-bottom:10px}'
      + 'ul{padding-right:24px}li{margin-bottom:7px;font-size:14px}'
      + '.method{background:#F0F5F3;border-radius:12px;padding:14px;font-size:12.5px;color:#6B8A80;text-align:center;margin-top:20px}'
      + '.footer{margin-top:30px;padding-top:16px;border-top:2px solid #EEE;text-align:center;color:#9DB3AB;font-size:12px}'
      + '@media print{body{padding:20px}}'
      + '</style></head><body>'
      + '<div class=head><div class=brand>حلول المرضي للاستشارات المالية · منصة مُرضي</div><h1>تقرير جاهزيتك الاستثمارية</h1></div>'
      + '<div class=score-box><div class=score>' + sc + '<small>/100</small></div><div class=verdict style="color:' + col + '">' + esc(result.verdict) + '</div></div>'
      + (val ? '<div class=val>التقييم التقديري: ' + val + '</div>' : '')
      + (obstacles ? '<div class=sec><h2>أبرز العقبات</h2>' + obstacles + '</div>' : '')
      + (plan ? '<div class=sec><h2>خطة رفع الجاهزية</h2>' + plan + '</div>' : '')
      + '<div class=method>تحليل وفق منهجية د. عبدالحكيم المرضي — دكتوراه إدارة الأعمال، عضوية البورد الأمريكي، وخبرة ١٥ عاماً في القطاع المالي</div>'
      + '<div class=footer>' + today + ' · هذا التقرير لأغراض التقييم الاسترشادي</div>'
      + '</body></html>';
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); }
  }

  const scoreColor = result.readiness_score >= 70 ? '#1A3D34' : result.readiness_score >= 50 ? '#C9A84C' : '#C0564B';

  return (
    <div dir="rtl" className="min-h-screen bg-[#FBFCFB] px-4 py-8" style={{ fontFamily: 'Tajawal, Cairo, sans-serif' }}>
      <div className="max-w-2xl mx-auto mb-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <a href="/goal" className="inline-flex items-center gap-2 text-[#6B8A80] hover:text-[#1A3D34] font-black text-sm transition-colors">
            <span style={{ fontSize: 18 }}>→</span> رجوع للمركز
          </a>
          <button onClick={printResult} className="inline-flex items-center gap-2 bg-[#1A3D34] text-white font-black text-sm px-5 py-2.5 rounded-full hover:opacity-90 transition">
            احفظ نتيجتك PDF
          </button>
        </div>
      </div>
      <div className="max-w-xl mx-auto space-y-6">

        <div className="bg-white rounded-2xl p-8 shadow-sm border border-[#E8F5EF] text-center">
          <p className="text-[#6B8A80] font-bold mb-2">درجة جاهزية الاستثمار</p>
          <p className="text-6xl font-black" style={{ color: scoreColor }}>{result.readiness_score}</p>
          <p className="text-xl font-black text-[#1A3D34] mt-3">{result.verdict}</p>
          <p className="text-[#A3BAB2] text-xs font-bold mt-2 leading-relaxed">تحليل وفق منهجية د. عبدالحكيم المرضي — دكتوراه إدارة الأعمال، عضوية البورد الأمريكي، وخبرة 15 عاماً في القطاع المالي</p>
        </div>

        {result.top_obstacles?.length > 0 && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#E8F5EF]">
            <h2 className="font-black text-[#1A3D34] mb-4">أبرز العوائق</h2>
            <ul className="space-y-2">
              {result.top_obstacles.map((o, i) => (
                <li key={i} className="text-[#6B8A80] font-bold text-sm">• {o}</li>
              ))}
            </ul>
          </div>
        )}

        {valuation !== null && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border-2 border-[#C9A84C]">
            <h2 className="font-black text-[#1A3D34] mb-1">القيمة التقديرية لشركتك</h2>
            <p className="text-[#6B8A80] text-xs font-bold mb-4">تقدير استرشادي مبدئي وفق ربحية شركتك ونموها</p>
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
                <p className="text-[#1A3D34] font-black text-sm mb-2">لو رفعت ربحيتك 15%، ترتفع قيمتك إلى:</p>
                <p className="text-[#1A3D34] font-black text-xl">{fmtM(valuation.hi * 1.4)} ريال</p>
                <p className="text-[#6B8A80] text-xs font-bold mt-2">+ سيناريوهات الحوكمة والتنويع ترفع المضاعف أكثر</p>
              </div>
            </div>
            <p className="text-[#6B8A80] text-xs font-bold mt-4 leading-relaxed">القيمة الفعلية تحتاج تقييماً معمّقاً يقدّمه فريق د. عبدالحكيم المرضي وفق منهجية تقييم متكاملة.</p>
          </div>
        )}

        {result.improvement_plan?.length > 0 && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#E8F5EF]">
            <h2 className="font-black text-[#1A3D34] mb-4">خطة جذب المستثمر</h2>
            <ul className="space-y-3">
              <li className="text-[#1A3D34] text-sm font-bold bg-[#E8F5EF] rounded-xl p-3">1. {result.improvement_plan[0]}</li>
            </ul>
            {result.improvement_plan.length > 1 && (
              <ul className="space-y-3 mt-3">
                {result.improvement_plan.slice(1).map((p, i) => (
                  <li key={i} className="text-[#1A3D34] text-sm font-bold bg-[#E8F5EF] rounded-xl p-3">{i + 2}. {p}</li>
                ))}
              </ul>
            )}
            {result.readiness_score >= 65 ? (
              <div className="mt-5 rounded-2xl p-5 text-center" style={{ background: 'linear-gradient(135deg,#1A3D34,#2E5D4E)' }}>
                <p className="text-3xl mb-2"></p>
                <p className="font-black text-white mb-1">شركتك جاذبة للمستثمر</p>
                <p className="text-[#D8E8E0] text-sm font-bold leading-relaxed mb-4">يعدّ لك فريق د. عبدالحكيم المرضي خطة جذب المستثمر الكاملة خطوةً بخطوة، مع تجهيز ملف الشركة للعرض على المستثمرين المناسبين.</p>
              </div>
            ) : (
              <div className="mt-5 rounded-2xl p-5 text-center bg-[#FBF5E8] border border-[#E8D9B5]">
                <p className="font-black text-[#1A3D34] mb-1">أنت في الطريق الصحيح</p>
                <p className="text-[#6B5B2E] text-sm font-bold leading-relaxed">ارفع جاهزيتك أولاً عبر معالجة العوائق أعلاه، وفريق مُرضي مستعد لمرافقتك خطوة بخطوة حتى تصبح شركتك جاهزة لجذب المستثمرين.</p>
              </div>
            )}
          </div>
        )}

        {/* قسم المستندات المطلوبة مخفي عن العميل عمداً — يبقى في DB ويظهر للأدمن */}

        {result.readiness_score >= 70 && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border-2 border-[#1A3D34]">
            <h2 className="font-black text-[#1A3D34] mb-1">فرص الاستثمار المتاحة</h2>
            <p className="text-[#6B8A80] text-xs font-bold mb-4">بناءً على ملفك، هذه الفرص التي تتطابق معها شركتك</p>

            {matchLoading && <p className="text-[#6B8A80] font-bold text-sm">جارٍ البحث عن الجهات المتطابقة...</p>}

            {matchLoading === false && matches !== null && matches.length > 0 && (
              <div>
                <div className="bg-[#E8F5EF] rounded-xl p-4 text-center mb-3">
                  <p className="text-3xl mb-1"></p>
                  <p className="text-[#1A3D34] font-black">وجدنا لك {matchCount} جهة استثمارية مناسبة</p>
                  <p className="text-[#6B8A80] text-xs font-bold mt-1">طابقناها مع ملف شركتك — التفاصيل محفوظة لك مع فريق مُرضي</p>
                </div>
                <div className="relative">
                  <div className="space-y-3 select-none" style={{ filter: 'blur(6px)', pointerEvents: 'none' }} aria-hidden="true">
                    {matches.map((m, i) => (
                      <div key={i} className="border border-[#E8F5EF] rounded-xl p-4">
                        <div className="flex justify-between items-center mb-2">
                          <p className="font-black text-[#1A3D34] text-sm">{m.funding_type}</p>
                          <span className="bg-[#E8F5EF] text-[#1A3D34] font-black text-xs px-3 py-1 rounded-full">ملاءمة {m.fit_percent}%</span>
                        </div>
                        <ul className="space-y-1">
                          {m.reasons.map((r, j) => (
                            <li key={j} className="text-[#6B8A80] text-xs font-bold">✓ {r}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
                    <span className="text-3xl mb-1"></span>
                    <p className="font-black text-[#1A3D34] text-sm">أسماء الجهات وتفاصيل المطابقة محجوبة</p>
                  </div>
                </div>
                <div className="mt-5 rounded-2xl p-5 text-center" style={{ background: 'linear-gradient(135deg,#1A3D34,#2E5D4E)' }}>
                  <p className="font-black text-white mb-1">جهاتك الاستثمارية جاهزة</p>
                  <p className="text-[#D8E8E0] text-sm font-bold leading-relaxed mb-4">يشاركك فريق د. عبدالحكيم المرضي قائمة الجهات المطابقة وطريقة الوصول إليها، ويرافقك في عرض شركتك عليها بأفضل صورة.</p>
                </div>
              </div>
            )}

            {matchLoading === false && (matches === null || matches.length === 0) && (
              <p className="text-[#6B8A80] font-bold text-sm">فريق مُرضي يراجع ملفك وسيتواصل معك بالفرص المناسبة.</p>
            )}
          </div>
        )}

        {result.readiness_score < 70 && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border-2 border-[#1A3D34]">
            <h2 className="font-black text-[#1A3D34] mb-1">فرص استثمارية في قطاعك</h2>
            <p className="text-[#6B8A80] text-xs font-bold mb-4">رصد فريق مُرضي جهات استثمارية نشطة في قطاع شركتك — تُفتح لك عند رفع جاهزيتك</p>
            <div className="bg-[#E8F5EF] rounded-xl p-4 text-center mb-3">
              <p className="text-3xl mb-1"></p>
              <p className="text-[#1A3D34] font-black">{matchCount > 0 ? matchCount : 3} جهة استثمارية محتملة في قطاعك</p>
              <p className="text-[#6B8A80] text-xs font-bold mt-1">تظهر تفاصيلها فور وصول جاهزيتك إلى المستوى المطلوب</p>
            </div>
            <div className="relative">
              <div className="space-y-3 select-none" style={{ filter: 'blur(6px)', pointerEvents: 'none' }} aria-hidden="true">
                {['صندوق استثماري متخصص', 'مستثمر استراتيجي', 'استثمار جريء (Venture)'].map((t, i) => (
                  <div key={i} className="border border-[#E8F5EF] rounded-xl p-4">
                    <div className="flex justify-between items-center mb-2">
                      <p className="font-black text-[#1A3D34] text-sm">{t}</p>
                      <span className="bg-[#E8F5EF] text-[#1A3D34] font-black text-xs px-3 py-1 rounded-full">ملاءمة مبدئية</span>
                    </div>
                    <p className="text-[#6B8A80] text-xs font-bold">تفاصيل الجهة وشروط دخولها محجوبة</p>
                  </div>
                ))}
              </div>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
                <span className="text-3xl mb-1"></span>
                <p className="font-black text-[#1A3D34] text-sm">الجهات الاستثمارية محجوبة حتى ترفع جاهزيتك</p>
              </div>
            </div>
            <div className="mt-5 rounded-2xl p-5 text-center bg-[#FBF5E8] border border-[#E8D9B5]">
              <p className="font-black text-[#1A3D34] mb-1">قرّبك خطوة من هذه الفرص</p>
              <p className="text-[#6B5B2E] text-sm font-bold leading-relaxed mb-4">عالج العوائق أعلاه لرفع جاهزيتك، ويرافقك فريق د. عبدالحكيم المرضي حتى تصبح شركتك جاهزة لعرضها على هذه الجهات.</p>
            </div>
          </div>
        )}

        {/* بطاقة الاستشارة القادمة — لفت انتباه العميل */}
        {/* بطاقة اقتراح الخدمة الذكية (استثمار) — تظهر حسب حاجة العميل فعلاً */}
        {fdRaw && (() => {
          const sug = suggestService(fdRaw, 'investment', result.readiness_score);
          const theme = sug.urgency === 'required'
            ? { bg: '#FBECEC', border: '#C0564B', label: 'خدمة ضرورية قبل التقديم', labelColor: '#A33' }
            : sug.urgency === 'none'
            ? { bg: '#EAF7F0', border: '#1A3D34', label: 'توجيه مُرضي', labelColor: '#1E7A5A' }
            : { bg: '#FBF5E8', border: '#C9A84C', label: 'خدمة موصى بها تقوّي عرضك', labelColor: '#9A7B2E' };
          return (
            <div style={{ background: theme.bg, border: '2px solid ' + theme.border, borderRadius: 16, padding: '22px 24px' }}>
              <div style={{ color: theme.labelColor, fontSize: 14, fontWeight: 900, marginBottom: 8 }}>{theme.label}</div>
              <div style={{ color: '#1A3D34', fontSize: 18, fontWeight: 900, marginBottom: 8 }}>{sug.icon} {sug.service}</div>
              <p style={{ color: '#5C4A1F', fontSize: 14, lineHeight: 1.9, fontWeight: 700, marginBottom: sug.urgency === 'none' ? 0 : 18 }}>{sug.why}</p>
              {sug.urgency !== 'none' && (
                <a href={'/goal?tab=services&highlight=' + encodeURIComponent(canonicalTitle(sug.service))}
                  style={{ display: 'inline-block', background: '#1A3D34', color: '#fff', fontWeight: 900, fontSize: 14, padding: '13px 30px', borderRadius: 999, textDecoration: 'none' }}>
                  اطلب هذه الخدمة من فريق مُرضي ←
                </a>
              )}
            </div>
          );
        })()}

        {fdRaw && result.readiness_score < 70 && (() => {
          const all = suggestAllServices(fdRaw, 'investment', result.readiness_score);
          if (all.length === 0) return null;
          const submitAll = async () => {
            if (!companyId) return;
            const names = all.map(a => '• ' + a.service).join('\n');
            if (!confirm('سيتم تقديم طلب لكل الخدمات التالية:\n\n' + names + '\n\nتأكيد؟')) return;
            setBundleStatus('جار التقديم...');
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
            setBundleStatus('تم تقديم طلباتك — فريق مرضي سيتابع معك');
          };
          return (
            <div style={{ background: '#FBF5E8', border: '2px solid #C9A84C', borderRadius: 16, padding: '22px 24px' }}>
              <div style={{ color: '#9A7B2E', fontSize: 14, fontWeight: 900, marginBottom: 10 }}>خطتك للجاهزية</div>
              <p style={{ color: '#5C4A1F', fontSize: 14, lineHeight: 1.9, fontWeight: 700, marginBottom: 14 }}>
                بناءً على نتيجتك، هذه الخطوات التي تجهّز شركتك لجذب المستثمر. يرافقك فريق مُرضي فيها:
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

        <div className="bg-gradient-to-l from-[#FBF5E8] to-white rounded-2xl p-6 border-2 border-[#C9A84C]">
          <div className="flex items-start gap-3">
            <span style={{ fontSize: 28 }}></span>
            <div className="flex-1">
              <h2 className="font-black text-[#1A3D34] mb-1">استشارتك الخاصة قيد الإعداد الآن</h2>
              <p className="text-[#6B8A80] text-sm font-bold leading-relaxed mb-4">د. عبدالحكيم المرضي وفريقه يُعدّون لك استشارة استثمار مخصّصة لأرقام شركتك — تحليل عميق، خطة نجاح، وتوعية مالية. ستجدها جاهزة في قسم الاستشارات فور مراجعتها واعتمادها.</p>
              <a href="/goal" className="inline-block px-6 py-2.5 rounded-full bg-[#C9A84C] text-white font-black text-sm">الذهاب لقسم الاستشارات ←</a>
            </div>
          </div>
        </div>

        {fdRaw && !subActive && (() => {
          const f = fdRaw as Record<string, unknown>;
          const rev = Number(f.annual_revenue) || 0;
          let n = 38;
          if (rev >= 1000000) n += 8;
          if (rev >= 5000000) n += 8;
          if (rev >= 20000000) n += 6;
          if (f.has_collateral && f.has_collateral !== 'none') n += 7;
          if (f.trades_cross_border && f.trades_cross_border !== 'none') n += 9;
          n += Math.min(9, String(f.funding_type || '').split(',').filter(Boolean).length * 3);
          if (f.issues_invoices === true) n += 4;
          void n;   // الرقم لم يعد يُعرض — لا نعِد بعدد قبل أن نقيسه
          return (
          <div className="rounded-3xl p-7 text-center" style={{ background: '#1A3D34' }}>
            <div className="text-3xl mb-3"></div>
            <h3 className="text-white font-black text-lg mb-3">مطابقة الجهات — الخطوة التي تحوّل درجتك إلى تمويل</h3>
            <p className="text-[#CFE0DA] text-sm font-bold leading-loose mb-4">
              درجتك تقول أين أنت. والمطابقة تقول <span style={{ color: '#C9A84C' }}>مع مَن</span>:
              نبحث لك في صناديق الاستثمار والمستثمرين المحليين والخليجيين والدوليين، ونستخرج <span style={{ color: '#C9A84C' }}>المنتج المحدَّد</span> الذي تتأهل له في كل جهة — لا اسم الجهة فقط.
              فالعميل قد يُرفض في منتج ويُقبل في آخر داخل البنك نفسه.
            </p>
            <div className="rounded-2xl py-4 px-5 mb-4" style={{ background: 'rgba(201,168,76,0.12)', border: '1.5px solid rgba(201,168,76,0.35)' }}>
              <div className="text-[#C9A84C] font-black text-2xl">شبكة مُرضي التمويلية</div>
              <div className="text-[#CFE0DA] text-xs font-bold mt-1">عدد الجهات المؤهّلة لك يظهر بعد المطابقة — ولا نعِدك برقم قبل أن نقيسه</div>
            </div>
            <p className="text-[#CFE0DA] text-xs font-bold leading-loose mb-5 text-right">
              ويشمل تفعيل ملفك: مطابقة المسارات الثلاثة · رفع ملفك للجهات ومتابعة الرد · استشارات مفتوحة أربعة أشهر · أسئلة مباشرة يجيب عنها د. عبدالحكيم والفريق داخل المنصة.
            </p>
            <button onClick={() => { window.location.href = '/pay'; }}
              className="w-full font-black text-sm py-4 rounded-full transition hover:opacity-90"
              style={{ background: '#C9A84C', color: '#1A3D34' }}>
              فعّل ملفك وشاهد جهاتك ←
            </button>
          </div>
          );
        })()}

      </div>
    </div>
  );
}
