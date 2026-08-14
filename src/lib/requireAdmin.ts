import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

const ADMIN_EMAIL = 'hololalmurdi.fs@gmail.com';

export async function requireAdmin(): Promise<string | null> {
  try {
    const store = await cookies();
    const sb = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
      { cookies: { getAll: () => store.getAll(), setAll: () => {} } }
    );
    const { data } = await sb.auth.getUser();
    return data?.user?.email === ADMIN_EMAIL ? null : 'غير مصرح';
  } catch {
    return 'غير مصرح';
  }
}
