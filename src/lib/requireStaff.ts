import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { MAX_SESSION_MS } from './requireAdmin';

const ADMIN_EMAIL = 'hololalmurdi.fs@gmail.com';
// أُضيف البريد لأن إشعارات المتصفح تُخزَّن باسم صاحبها: جهاز المالك
// وجهاز الموظفة اشتراكان مختلفان، ولا يجوز أن يصل أحدهما إشعارَ الآخر.
export type Who = { role: 'admin' | 'staff'; userId: string; email: string; canSend: boolean };

export async function requireStaff(): Promise<{ who: Who | null; error: string | null }> {
  try {
    const store = await cookies();
    const sb = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
      { cookies: { getAll: () => store.getAll(), setAll: () => {} } }
    );
    const { data } = await sb.auth.getUser();
    const u = data?.user;
    if (!u) return { who: null, error: 'غير مصرح' };
    const t = Date.parse(String(u.last_sign_in_at || ''));
    if (!t || Date.now() - t > MAX_SESSION_MS) return { who: null, error: 'انتهت الجلسة — يلزم تسجيل الدخول' };
    if (u.email === ADMIN_EMAIL) return { who: { role: 'admin', userId: u.id, email: String(u.email), canSend: true }, error: null };
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string);
    const { data: st } = await admin.from('staff').select('user_id, active, can_send').eq('user_id', u.id).maybeSingle();
    if (!st || st.active !== true) return { who: null, error: 'غير مصرح' };
    return { who: { role: 'staff', userId: u.id, email: String(u.email || ''), canSend: st.can_send !== false }, error: null };
  } catch {
    return { who: null, error: 'غير مصرح' };
  }
}

export async function ownsCompany(who: Who, companyId: string): Promise<boolean> {
  if (who.role === 'admin') return true;
  if (!companyId) return false;
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string);
  const { data } = await admin.from('companies').select('assigned_to').eq('id', companyId).maybeSingle();
  return !!data && data.assigned_to === who.userId;
}
