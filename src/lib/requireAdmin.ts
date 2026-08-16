import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

const ADMIN_EMAIL = 'hololalmurdi.fs@gmail.com';
export const MAX_SESSION_MS = 12 * 60 * 60 * 1000;

export async function requireAdmin(): Promise<string | null> {
  try {
    const store = await cookies();
    const sb = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
      { cookies: { getAll: () => store.getAll(), setAll: () => {} } }
    );
    const { data } = await sb.auth.getUser();
    const u = data?.user;
    if (!u || u.email !== ADMIN_EMAIL) return 'غير مصرح';
    const t = Date.parse(String(u.last_sign_in_at || ''));
    if (!t || Date.now() - t > MAX_SESSION_MS) return 'انتهت الجلسة — يلزم تسجيل الدخول';
    return null;
  } catch {
    return 'غير مصرح';
  }
}
