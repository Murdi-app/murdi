// مكتبة الربط مع بوابة الدفع Moyasar — backend آمن
// المفتاح السرّي يُقرأ من متغيّرات البيئة فقط، لا يُكشف للعميل أبداً

const MOYASAR_API = 'https://api.moyasar.com/v1';

function secretKey(): string {
  const k = process.env.MOYASAR_SECRET_KEY;
  if (!k) throw new Error('MOYASAR_SECRET_KEY غير معرّف في متغيّرات البيئة');
  return k;
}

// مصادقة Basic: المفتاح السرّي كاسم مستخدم، بلا كلمة مرور
function authHeader(): string {
  return 'Basic ' + Buffer.from(secretKey() + ':').toString('base64');
}

export type MoyasarPayment = {
  id: string;
  status: string;       // initiated, paid, failed, ...
  amount: number;       // بالهللات (هللة = 1/100 ريال)
  currency: string;
  description: string;
  source?: { type?: string; company?: string; message?: string };
  metadata?: Record<string, string>;
  created_at?: string;
};

// جلب تفاصيل دفعة من Moyasar للتحقق من حالتها (نستخدمه عند التأكيد)
export async function fetchPayment(paymentId: string): Promise<MoyasarPayment | null> {
  try {
    const res = await fetch(MOYASAR_API + '/payments/' + encodeURIComponent(paymentId), {
      method: 'GET',
      headers: { Authorization: authHeader() },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.log('[moyasar] HTTP', res.status, '—', body.slice(0, 300));
      return null;
    }
    return (await res.json()) as MoyasarPayment;
  } catch (e) {
    console.log('[moyasar] fetch error:', e instanceof Error ? e.message : String(e));
    return null;
  }
}

// تحويل الريال إلى هللات (Moyasar يتعامل بالهللات)
export function toHalalas(sar: number): number {
  return Math.round(sar * 100);
}

// تحويل الهللات إلى ريال
export function toSAR(halalas: number): number {
  return halalas / 100;
}
