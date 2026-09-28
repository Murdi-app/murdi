import { createHmac, timingSafeEqual } from 'crypto';
import { createClient } from '@supabase/supabase-js';

// سرّ المهام الآلية — يُقرأ من `app_config` في القاعدة.
//
// ★ كان `cronAuthorized` مكتوباً بنصّه في مساري الجرد والتذكير، وكلُّ مهمةٍ
//   جديدة ستنسخه ثالثةً. تعريفٌ واحد هنا تستورده المسارات.

const admin = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

async function secret(): Promise<string> {
  const { data } = await admin().from('app_config').select('value').eq('key', 'cron_secret').maybeSingle();
  return String(data?.value || '');
}

const same = (a: string, b: string) =>
  a.length === b.length && a.length > 0 && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** هل الطلب من `pg_cron`؟ — ترويسة `x-cron-secret` تساوي السرّ المحفوظ */
export async function cronAuthorized(req: Request): Promise<boolean> {
  const given = req.headers.get('x-cron-secret') || '';
  if (!given) return false;
  return same(given, await secret());
}

/**
 * توقيعٌ لرابطٍ يُرسل في بريد المالك (زرّ «اعتمد وأرسل»).
 * مشتقٌّ من السرّ نفسه ومقيَّدٌ بغرضه وتاريخه — فلا يصلح لغيرهما، ولا يُخمَّن.
 */
export async function signLink(purpose: string, value: string): Promise<string> {
  return createHmac('sha256', await secret()).update(purpose + '|' + value).digest('hex').slice(0, 40);
}

export async function linkValid(purpose: string, value: string, token: string): Promise<boolean> {
  return same(String(token || ''), await signLink(purpose, value));
}
