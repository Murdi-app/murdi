import { createClient } from '@supabase/supabase-js';

export async function logError(area: string, e: unknown, ctx?: Record<string, unknown>) {
  try {
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      process.env.SUPABASE_SERVICE_ROLE_KEY as string
    );
    await admin.from('error_log').insert({
      area,
      company_id: (ctx?.company_id as string) || null,
      entity: (ctx?.entity as string) || null,
      message: e instanceof Error ? e.message : String(e),
      context: ctx || {},
    });
  } catch { /* التسجيل نفسه لا يُسقط الطلب */ }
}
