import type { SupabaseClient } from '@supabase/supabase-js';
import { needsSignedContract } from '@/lib/contracts';

// ★ ١ أكتوبر — لا يُفتح دفعٌ قبل وثيقته، في كل الخدمات:
//   · ما فيه أتعاب استكمال (نسبة): عقدٌ **موقَّع**.
//   · ما برسمٍ ثابت: سند خدمةٍ **صادر**.
//   وصلت فاتورة «تمويل العقد» عميلاً بلا عقد فسأل بحقّ: كيف أدفع ولا أعرف ما
//   تلتزمون به وما ألتزم به؟ والحارس هنا لبابَي الدفع (التحويل · الرابط)، وشاشة
//   العميل تقرأ القاعدة نفسها (`needsSignedContract`).

export const CONTRACT_FIRST_MSG =
  'عقد هذه الخدمة يصلك قبل الدفع — وقّعه من الرابط الذي يصلك منّا أو من لوحتك في المنصة، ثم يُفتح الدفع. وللاستفسار واتساب 0570749196';
export const VOUCHER_FIRST_MSG =
  'سند هذه الخدمة لم يصدر بعد — يصلك قبل الدفع. وللاستفسار واتساب 0570749196';

/** رسالة المنع إن كان الدفع مقفلاً، وإلا null */
export async function contractGate(sb: SupabaseClient, sr: { id: string; service_title?: string | null }): Promise<string | null> {
  const percent = needsSignedContract(String(sr.service_title || ''));
  const { data, error } = await sb.from('contracts').select('id, status, contract_type')
    .eq('service_request_id', sr.id).neq('status', 'draft');
  // الفشل في القراءة لا يُقرأ «موقَّع» — يُمنع الدفع ويُقال السبب
  if (error) return 'تعذّر التحقق من وثيقة الخدمة — أعد المحاولة بعد قليل';
  const docs = data || [];
  if (percent) return docs.some((d) => d.status === 'signed' || d.status === 'completed') ? null : CONTRACT_FIRST_MSG;
  return docs.length ? null : VOUCHER_FIRST_MSG;
}
