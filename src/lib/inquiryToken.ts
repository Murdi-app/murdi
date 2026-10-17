import { createHmac, timingSafeEqual } from 'crypto';

// مفتاح الطلب للعميل نفسه: يُعطى له لحظة التسجيل، فيُجيب على أسئلته ويرى استشارته
// من صفحته — ولا يقدر غيره أن يكتب على طلبٍ ليس له بمجرد معرفة رقمه.
const secret = () => String(process.env.SUPABASE_SERVICE_ROLE_KEY || '') + '|inquiry-ask';

export const inquiryKey = (id: string) => createHmac('sha256', secret()).update(String(id)).digest('base64url').slice(0, 22);

export function checkInquiryKey(id: string, k: string): boolean {
  if (!id || !k) return false;
  const a = Buffer.from(inquiryKey(id)), b = Buffer.from(String(k));
  return a.length === b.length && timingSafeEqual(a, b);
}
