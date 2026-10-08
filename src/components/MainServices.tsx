'use client';
import { useEffect, useMemo, useState } from 'react';
import { computeContract } from '@/lib/contractCompute';
import type { Lures } from '@/lib/lures';

// الخدمات الخمس الرئيسية بطُعمها المجاني (٨ أكتوبر، بأمر المالك) — طبقة عرضٍ فوق المحركات القائمة.
// كل بطاقة: رقمٌ عن منشأة العميل نفسه ← زرٌّ واحد «خلّنا نشتغلها عنك» ← مسار الطلب القائم (العقد قبل الدفع).
// ★ لا رقم مختلَق: ما نقصت بياناته يُطلب حقله الناقص وحده، وما لا بيانات وراءه لا يُعرض.

export const MAIN_SERVICES = [
  'تجهيز ملف التمويل والتفاوض',
  'تمويل العقد',
  'دراسة الجدوى الاقتصادية',
  'تجهيز ملف عرض المستثمر والتفاوض',
  'تجهيز صفقة التملّك والتفاوض',
] as const;

const G = '#1A3D34', GOLD = '#C9A84C';
const sar = (n: number) => Math.round(n).toLocaleString('ar-SA') + ' ريال';
const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

type Props = {
  requested: Record<string, { status: string } | undefined>;
  onOrder: (title: string) => void;
  /** مصدر الطُعم — '/api/lures' للعميل نفسه */
  luresUrl?: string;
};

function Card({ title, sub, children, cta, onCta, pending }: { title: string; sub: string; children: React.ReactNode; cta: string; onCta: () => void; pending: boolean }) {
  return (
    <div className="rounded-2xl p-5 mb-4" style={{ background: '#fff', border: '1.5px solid #E3EAE7' }}>
      <div className="font-black text-lg" style={{ color: G }}>{title}</div>
      <div className="text-xs font-bold mb-3" style={{ color: '#6B8A80' }}>{sub}</div>
      <div className="rounded-xl p-4 mb-3" style={{ background: '#F6FAF8', border: '1px solid #D5E6DE' }}>{children}</div>
      {pending
        ? <div className="text-center text-sm font-black py-2" style={{ color: '#9A7B2E' }}>طلبك قائم — تابعه في بطاقته أدناه</div>
        : <button onClick={onCta} className="w-full py-3 rounded-full font-black text-sm" style={{ background: G, color: '#fff' }}>{cta}</button>}
    </div>
  );
}

const Missing = ({ fields }: { fields: string[] }) => (
  <div className="text-sm font-bold" style={{ color: '#9A7B2E' }}>
    نحتاج منك: {fields.join(' · ')} — <a href="/assessment/funding" className="underline">أكمل بياناتك</a> ويظهر رقمك.
  </div>
);

export default function MainServices({ requested, onOrder, luresUrl = '/api/lures' }: Props) {
  const [lures, setLures] = useState<Lures | null>(null);
  const [err, setErr] = useState('');
  const [fzInv, setFzInv] = useState('');
  const [fzNew, setFzNew] = useState(true);
  const [cv, setCv] = useState(''); const [cDays, setCDays] = useState('90'); const [cMonths, setCMonths] = useState('12');
  const [acqSide, setAcqSide] = useState<'sell' | 'buy'>('sell');

  const load = (inv?: string, isNew?: boolean) => {
    const q = inv ? 'investment=' + encodeURIComponent(inv.replace(/\D/g, '')) + '&isNew=' + String(isNew !== false) : '';
    fetch(luresUrl + (q ? (luresUrl.includes('?') ? '&' : '?') + q : '')).then(async (r) => { const d = await r.json().catch(() => ({})); if (r.ok) setLures(d.lures); else setErr(d.error || ''); }).catch(() => setErr('تعذّر الاتصال'));
  };
  useEffect(() => { load(); }, []);
  // العقد القائم المسجّل يملأ بطاقة تمويل العقد تلقائياً — والعميل يعدّلها إن شاء
  useEffect(() => {
    const c = lures?.contract;
    if (!c || cv) return;
    setCv(String(c.value)); setCMonths(String(c.months)); if (c.collectDays) setCDays(String(c.collectDays));
  }, [lures]); // eslint-disable-line react-hooks/exhaustive-deps

  const contract = useMemo(() => {
    const value = Number(cv.replace(/\D/g, ''));
    if (!(value > 0)) return null;
    const delay = Math.max(1, Math.round(Number(cDays || 90) / 30));
    const p = computeContract({ value, months: Number(cMonths) || 12, collectDelay: delay });
    const m = p.worst ? p.worst.m : 0;
    return { gap: p.gap, month: m, label: m ? 'الشهر ' + m.toLocaleString('ar-SA') + ' من التنفيذ' : '', profit: p.profit, perf: p.bonds.perf };
  }, [cv, cDays, cMonths]);

  const inp = 'w-full px-3 py-2 rounded-lg text-sm font-bold border';
  const pend = (t: string) => !!requested[t] && !['rejected', 'cancelled'].includes(String(requested[t]?.status));
  const f = lures?.funding, inv = lures?.investment, acq = lures?.acquisition, fz = lures?.feasibility;
  void MONTHS;

  return (
    <div className="mb-8">
      <div className="text-center mb-5">
        <h2 className="text-2xl font-black mb-1" style={{ color: G, fontFamily: 'Cairo, sans-serif' }}>الخدمات الرئيسية</h2>
        <p className="text-sm font-bold" style={{ color: '#6B8A80' }}>رقمٌ عن منشأتك أنت قبل أن تدفع — ثم نشتغلها عنك.</p>
      </div>
      {err && <div className="text-sm text-center mb-3" style={{ color: '#C0564B' }}>{err}</div>}

      <Card title="تجهيز الملف التمويلي" sub="٩٩٠ ريال: ترى جهاتك بأسمائها وتتقدّم بنفسك · ٧٬٩٠٠ ريال: نخاطب الجهات عنك + نسبة نجاح عند الصرف"
        cta="خلّنا نشتغلها عنك" onCta={() => onOrder(MAIN_SERVICES[0])} pending={pend(MAIN_SERVICES[0])}>
        {!lures ? <div className="text-sm" style={{ color: '#6B8A80' }}>نحسب رقمك…</div>
          : f?.lure && f.lure.hi > 0 ? (
            <>
              <div className="font-black" style={{ color: G }}>منشأتك مؤهلة لتمويل تقديري من <span style={{ color: GOLD }}>{sar(f.lure.lo)}</span> إلى <span style={{ color: GOLD }}>{sar(f.lure.hi)}</span></div>
              <div className="mt-2 rounded-lg p-2" style={{ background: '#fff', border: '1px solid #EAD9A8' }}>
                <div className="font-black text-sm" style={{ color: G }}>فرصتك في الحصول على التمويل: <span style={{ color: GOLD, fontSize: 18 }}>{f.lure.chance.toLocaleString('ar-SA')}٪</span></div>
                <div className="text-xs font-bold" style={{ color: '#6B8A80' }}>وقد ترتفع أو تنخفض بحسب خطوات المستشار والفريق في تجهيز ملفك وعرضه على الجهة المناسبة.</div>
              </div>
              {f.lure.n ? <div className="text-sm font-bold mt-2" style={{ color: '#5E7C73' }}>{f.lure.n.toLocaleString('ar-SA')} جهة تموّل منشآت بحجمك — أسماؤها تظهر بعد الحكم الائتماني (٩٩٠)</div> : null}
              <div className="text-xs mt-2" style={{ color: '#8CA49B' }}>تقديرٌ من سعة سدادك (ربحك بعد أقساطك) — والقرار للجهة الممولة.</div>
            </>
          ) : f?.lure?.note ? <div className="text-sm font-bold" style={{ color: '#9A7B2E' }}>{f.lure.note}</div>
          : <Missing fields={f?.missing?.length ? f.missing : ['صافي الربح']} />}
      </Card>

      <Card title="تمويل العقود" sub="لمن رسا عليه عقد — أو يستعد لمنافسة" cta="خلّنا نشتغلها عنك" onCta={() => onOrder(MAIN_SERVICES[1])} pending={pend(MAIN_SERVICES[1])}>
        <div className="grid grid-cols-3 gap-2 mb-2">
          <label className="text-xs font-bold col-span-3" style={{ color: '#6B8A80' }}>قيمة العقد (ريال)<input className={inp} inputMode="numeric" value={cv} onChange={(e) => setCv(e.target.value)} placeholder="مثال: 5000000" /></label>
          <label className="text-xs font-bold" style={{ color: '#6B8A80' }}>مدته (شهر)<input className={inp} inputMode="numeric" value={cMonths} onChange={(e) => setCMonths(e.target.value)} /></label>
          <label className="text-xs font-bold col-span-2" style={{ color: '#6B8A80' }}>صرف المستخلص بعد (يوم)<input className={inp} inputMode="numeric" value={cDays} onChange={(e) => setCDays(e.target.value)} /></label>
        </div>
        {contract && contract.gap > 0 ? (
          <>
            <div className="font-black" style={{ color: G }}>عقدك يحتاج <span style={{ color: GOLD }}>{sar(contract.gap)}</span> سيولة، وأصعب نقطة {contract.label}</div>
            {contract.profit > 0 && <div className="text-sm font-bold mt-2" style={{ color: '#5E7C73' }}>وربح عقدك المتوقع قرابة <b style={{ color: G }}>{sar(contract.profit)}</b> — لا تخسره بنقص السيولة.</div>}
            <div className="text-sm font-bold mt-1" style={{ color: '#5E7C73' }}>نرتّب لك تمويل هذه الفجوة من أكثر من جهة: ضمان حسن الأداء{contract.perf > 0 ? ' (' + sar(contract.perf) + ')' : ''}، وتسييل المستخلصات، واعتماد المورّدين — بخطة شهرية جاهزة للجهة.</div>
          </>
        ) : contract ? <div className="text-sm font-bold" style={{ color: '#1E7A5E' }}>بهذه المدد لا يحتاج عقدك سيولةً إضافية — تأكّد من مدة الصرف الفعلية.</div>
          : <div className="text-sm" style={{ color: '#6B8A80' }}>اكتب قيمة العقد ومدة صرف المستخلص — ويظهر رقمك فوراً.</div>}
        <div className="text-xs mt-2" style={{ color: '#8CA49B' }}>تقديرٌ بتكلفة مباشرة ٨٠٪ من القيمة وبلا دفعة مقدمة — والتحليل الكامل يدخل بنود عقدك نفسها.</div>
      </Card>

      <Card title="دراسة الجدوى" sub="لمشروعٍ جديد أو توسعة" cta="خلّنا نشتغلها عنك" onCta={() => onOrder(MAIN_SERVICES[2])} pending={pend(MAIN_SERVICES[2])}>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <label className="text-xs font-bold" style={{ color: '#6B8A80' }}>حجم الاستثمار (ريال)<input className={inp} inputMode="numeric" value={fzInv} onChange={(e) => setFzInv(e.target.value)} placeholder="مثال: 2000000" /></label>
          <label className="text-xs font-bold" style={{ color: '#6B8A80' }}>نوعه<select className={inp} value={fzNew ? 'new' : 'exp'} onChange={(e) => setFzNew(e.target.value === 'new')}><option value="new">مشروع جديد</option><option value="exp">توسعة نشاط قائم</option></select></label>
        </div>
        <button onClick={() => load(fzInv, fzNew)} className="w-full py-2 rounded-full text-sm font-black mb-2" style={{ background: '#fff', border: '1px solid ' + G, color: G }}>احسب</button>
        {fz?.program ? (
          <div className="font-black" style={{ color: G }}>أنسب جهة حكومية لمشروعك: <span style={{ color: GOLD }}>{fz.program.name}</span> — يموّل {fz.program.max}، ويشترط {fz.program.requirement}.</div>
        ) : null}
        {fz?.funders ? <div className="text-sm font-bold mt-1" style={{ color: '#5E7C73' }}>و<b style={{ color: G }}>{fz.funders.toLocaleString('ar-SA')}</b> جهة تمويل ومستثمر يناسبهم مشروعك — نعرضه عليهم بعد الدراسة.</div> : null}
        {!fz?.program && !fz?.funders && <div className="text-sm" style={{ color: '#6B8A80' }}>اكتب حجم الاستثمار واضغط «احسب».</div>}
      </Card>

      <Card title="الاستثمار" sub="لمن يريد شريكاً أو مستثمراً في منشأته" cta="خلّنا نشتغلها عنك" onCta={() => onOrder(MAIN_SERVICES[3])} pending={pend(MAIN_SERVICES[3])}>
        {!lures ? <div className="text-sm" style={{ color: '#6B8A80' }}>نحسب رقمك…</div>
          : inv?.value ? (
            <>
              <div className="font-black" style={{ color: G }}>قيمتك اليوم: من <span style={{ color: GOLD }}>{sar(inv.value.lo)}</span> إلى <span style={{ color: GOLD }}>{sar(inv.value.hi)}</span></div>
              {inv.value.after ? <div className="font-black mt-1" style={{ color: G }}>قيمتك بعد تنفيذ عقودك: من <span style={{ color: GOLD }}>{sar(inv.value.after.lo)}</span> إلى <span style={{ color: GOLD }}>{sar(inv.value.after.hi)}</span></div> : null}
              {inv.value.after ? <div className="text-xs font-bold mt-1" style={{ color: '#6B8A80' }}>بإضافة ربح عقدك القائم (قرابة {sar(inv.value.after.contractProfit)} في السنة) إلى ربحك الفعلي.</div> : null}
              <div className="text-sm font-bold mt-2" style={{ color: '#5E7C73' }}>بهذه القيمة، حصة ٢٠٪ تعادل قرابة <b style={{ color: G }}>{sar(inv.value.lo * 0.2)}</b> إلى <b style={{ color: G }}>{sar(inv.value.hi * 0.2)}</b> نقداً لنموّ منشأتك — دون قرضٍ ولا أقساط.</div>
              {inv.investors ? <div className="text-sm font-bold mt-1" style={{ color: '#5E7C73' }}>{inv.investors.toLocaleString('ar-SA')} مستثمر وصندوق يستهدف قطاعك</div> : null}
              <div className="text-xs font-bold mt-1" style={{ color: '#6B8A80' }}>والتجهيز الصحيح للعرض — الحوكمة والقوائم وخطة النمو — يرفع هذه القيمة عند التفاوض.</div>
              <div className="text-xs mt-2" style={{ color: '#8CA49B' }}>{inv.value.basis === 'profit' ? 'بمضاعفات ربح قطاعك' : 'بمضاعف الإيراد — لأن الربح غير موجب'} — تقديرٌ أولي لا تقييمٌ معتمد.</div>
            </>
          ) : <Missing fields={inv?.missing || ['الإيراد السنوي']} />}
        {/* ★ ٨ أكتوبر: ما يُسلَّم فعلاً في الخدمة — المبني في المنصة وحده (العرض التقديمي · ملف العرض · المطابقة).
            لا ورقة شروط ولا غرفة بيانات ولا اتفاقية سرية: غير مبنية بعد. ولا «مخاطبة المستثمرين»: عقد الاستثمار يجعلها للعميل وحده. */}
        <div className="text-sm font-black mt-1 mb-1" style={{ color: G }}>ما تحصل عليه في الخدمة:</div>
        <ul className="text-sm font-bold mb-3 space-y-1" style={{ color: '#5E7C73', listStyle: 'none', padding: 0 }}>
          <li>✓ عرض تقديمي للمستثمر بالعربية والإنجليزية</li>
          <li>✓ ملف العرض الاستثماري بالعربية والإنجليزية</li>
          <li>✓ قائمة المستثمرين والصناديق التي تنطبق معاييرها على منشأتك</li>
        </ul>
      </Card>

      <Card title="الاستحواذ" sub="تبيع منشأتك أو تشتري منشأة" cta="خلّنا نشتغلها عنك" onCta={() => onOrder(MAIN_SERVICES[4])} pending={pend(MAIN_SERVICES[4])}>
        <div className="flex gap-2 mb-2">
          {(['sell', 'buy'] as const).map((s) => (
            <button key={s} onClick={() => setAcqSide(s)} className="flex-1 py-1.5 rounded-full text-xs font-black" style={{ background: acqSide === s ? G : '#fff', color: acqSide === s ? '#fff' : G, border: '1px solid ' + G }}>{s === 'sell' ? 'أنا بائع' : 'أنا مشتري'}</button>
          ))}
        </div>
        {!lures ? <div className="text-sm" style={{ color: '#6B8A80' }}>نحسب رقمك…</div>
          : acqSide === 'sell' ? (acq?.value
            ? <>
              <div className="font-black" style={{ color: G }}>منشأتك تسوى لو بعتها اليوم من <span style={{ color: GOLD }}>{sar(acq.value.lo)}</span> إلى <span style={{ color: GOLD }}>{sar(acq.value.hi)}</span></div>
              {acq.value.after ? <div className="font-black mt-1" style={{ color: G }}>وبعد تنفيذ عقودك من <span style={{ color: GOLD }}>{sar(acq.value.after.lo)}</span> إلى <span style={{ color: GOLD }}>{sar(acq.value.after.hi)}</span></div> : null}
            </>
            : <Missing fields={acq?.missing || ['الإيراد السنوي']} />)
          : acq?.buyOpportunities === null
            ? <div className="text-sm font-bold" style={{ color: '#9A7B2E' }}>نحتاج قطاعك — <a href="/assessment/funding" className="underline">أكمل بياناتك</a>.</div>
            : <div className="font-black" style={{ color: G }}>{acq?.buyOpportunities ? acq.buyOpportunities.toLocaleString('ar-SA') + ' فرصة معروضة للبيع في قطاعك' : 'لا فرصة معروضة للبيع في قطاعك على المنصة الآن — ونبحث لك خارجها'}</div>}
      </Card>
    </div>
  );
}
