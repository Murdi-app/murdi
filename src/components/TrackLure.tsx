'use client';
import { useEffect, useState } from 'react';
import type { Lures } from '@/lib/lures';
import { MAIN_SERVICES } from '@/components/MainServices';

// طُعم الخدمة تحت درجة التقييم المطوّل (٨ أكتوبر، بأمر المالك) — الأرقام نفسها التي في «الخدمات الرئيسية»
// من /api/lures، وزرٌّ واحد يفتح طلب الخدمة في المركز (/goal?order=). لا رقم بلا بيانات وراءه.

const G = '#1A3D34', GOLD = '#C9A84C';
const sar = (n: number) => Math.round(n).toLocaleString('ar-SA') + ' ريال';

export default function TrackLure({ track, luresUrl = '/api/lures' }: { track: 'funding' | 'investment'; luresUrl?: string }) {
  const [l, setL] = useState<Lures | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    fetch(luresUrl).then(async (r) => { const d = await r.json().catch(() => ({})); if (r.ok && d.lures) setL(d.lures); else setFailed(true); }).catch(() => setFailed(true));
  }, [luresUrl]);
  if (failed) return null;

  const title = track === 'funding' ? MAIN_SERVICES[0] : MAIN_SERVICES[3];
  const go = () => { window.location.href = '/goal?tab=services&order=' + encodeURIComponent(title); };
  const f = l?.funding, inv = l?.investment;

  let body: React.ReactNode = <div className="text-sm font-bold" style={{ color: '#6B8A80' }}>نحسب رقمك…</div>;
  if (l && track === 'funding') {
    body = f?.lure && f.lure.hi > 0 ? (
      <>
        <div className="font-black" style={{ color: G }}>منشأتك مؤهلة لتمويل تقديري من <span style={{ color: GOLD }}>{sar(f.lure.lo)}</span> إلى <span style={{ color: GOLD }}>{sar(f.lure.hi)}</span></div>
        <div className="text-sm font-black mt-2" style={{ color: G }}>فرصتك في الحصول على التمويل: <span style={{ color: GOLD }}>{f.lure.chance.toLocaleString('ar-SA')}٪</span></div>
        <div className="text-xs font-bold mt-1" style={{ color: '#6B8A80' }}>وقد ترتفع أو تنخفض بحسب خطوات المستشار والفريق في تجهيز ملفك وعرضه على الجهة المناسبة.</div>
        {f.lure.n ? <div className="text-sm font-bold mt-2" style={{ color: '#5E7C73' }}>{f.lure.n.toLocaleString('ar-SA')} جهة تموّل منشآت بحجمك</div> : null}
      </>
    ) : f?.lure?.note ? <div className="text-sm font-bold" style={{ color: '#9A7B2E' }}>{f.lure.note}</div>
      : <div className="text-sm font-bold" style={{ color: '#9A7B2E' }}>نحتاج منك: {(f?.missing?.length ? f.missing : ['صافي الربح']).join(' · ')} — ويظهر مدى تمويلك.</div>;
  }
  if (l && track === 'investment') {
    body = inv?.value ? (
      <>
        <div className="font-black" style={{ color: G }}>قيمتك اليوم: من <span style={{ color: GOLD }}>{sar(inv.value.lo)}</span> إلى <span style={{ color: GOLD }}>{sar(inv.value.hi)}</span></div>
        {inv.value.after ? <div className="font-black mt-1" style={{ color: G }}>قيمتك بعد تنفيذ عقودك: من <span style={{ color: GOLD }}>{sar(inv.value.after.lo)}</span> إلى <span style={{ color: GOLD }}>{sar(inv.value.after.hi)}</span></div> : null}
        {inv.investors ? <div className="text-sm font-bold mt-2" style={{ color: '#5E7C73' }}>{inv.investors.toLocaleString('ar-SA')} مستثمر وصندوق يستهدف قطاعك</div> : null}
        <div className="text-xs mt-2" style={{ color: '#8CA49B' }}>{inv.value.basis === 'profit' ? 'بمضاعفات ربح قطاعك' : 'بمضاعف الإيراد — لأن الربح غير موجب'} — تقديرٌ أولي لا تقييمٌ معتمد.</div>
      </>
    ) : <div className="text-sm font-bold" style={{ color: '#9A7B2E' }}>نحتاج منك: {(inv?.missing?.length ? inv.missing : ['الإيراد السنوي']).join(' · ')} — وتظهر قيمة منشأتك.</div>;
  }

  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-[#E8F5EF] text-right">
      <div className="font-black text-lg mb-1" style={{ color: G }}>{track === 'funding' ? 'تجهيز الملف التمويلي' : 'الاستثمار'}</div>
      <div className="rounded-xl p-4 mb-3" style={{ background: '#F6FAF8', border: '1px solid #D5E6DE' }}>{body}</div>
      <button onClick={go} className="w-full py-3 rounded-full font-black text-sm" style={{ background: G, color: '#fff' }}>خلّنا نشتغلها عنك</button>
    </div>
  );
}
