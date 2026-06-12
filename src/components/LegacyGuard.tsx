'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

export default function LegacyGuard() {
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (pathname.startsWith('/dashboard/consultation')) return;
    const check = async () => {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL as string,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
      );
      const { data: { user } } = await supabase.auth.getUser();
      if (user === null) { router.replace('/auth/login'); return; }
      if (user.email !== 'hololalmurdi.fs@gmail.com') router.replace('/goal');
    };
    check();
  }, [pathname]);
  return null;
}
