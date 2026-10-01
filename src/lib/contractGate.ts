import type { SupabaseClient } from '@supabase/supabase-js';
import { CONTRACT_BEFORE_PAYMENT } from '@/lib/contracts';

// ★ ١ أكتوبر — لا يُفتح دفع خدمةٍ عقدُها شرطٌ قبل أن يوقّعه العميل.
//   وصلت فاتورة «تمويل العقد» عميلاً بلا عقد، فسأل بحقّ: كيف أدفع ولا أعرف
//   ما تلتزمون به وما ألتزم به؟ والحارس هنا لبابَي الدفع (التحويل · الرابط)،
//   والشاشة تقرأ القاعدة نفسها من `CONTRACT_BEFORE_PAYMENT`.

export const CONTRACT_FIRST_MSG =
  'عقد هذه الخدمة يصلك قبل الدفع — وقّعه من لوحتك في المنصة (murdi.sa/goal) أولاً، ثم يُفتح الدفع. وللاستفسار واتساب 0570749196';

/** رسالة المنع إن كان الدفع مقفلاً حتى التوقيع، وإلا null */
export async function contractGate(sb: SupabaseClient, sr: { id: string; service_title?: string | null }): Promise<string | null> {
  if (!CONTRACT_BEFORE_PAYMENT.has(String(sr.service_title || ''))) return null;
  const { data, error } = await sb.from('contracts').select('id')
    .eq('service_request_id', sr.id).eq('status', 'signed').limit(1).maybeSingle();
  // الفشل في القراءة لا يُقرأ «موقَّع» — يُمنع الدفع ويُقال السبب
  if (error) return 'تعذّر التحقق من توقيع العقد — أعد المحاولة بعد قليل';
  return data ? null : CONTRACT_FIRST_MSG;
}
