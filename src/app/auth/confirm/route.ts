import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { EmailOtpType } from '@supabase/supabase-js';

// التحقق من رابط الاستعادة العربي (token_hash) — يفتح جلسةً ثم يحوّل إلى صفحة كلمة المرور الجديدة.
// الرابط المنتهي أو المستعمل يعود إلى صفحة الاستعادة برسالة عربية (otp_expired).
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get('token_hash');
  const type = (searchParams.get('type') || 'recovery') as EmailOtpType;
  const next = searchParams.get('next') || '/';
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/';
  if (!token_hash) return NextResponse.redirect(origin + '/auth/reset?e=nocode');
  const cookieStore = await cookies();
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(list) { list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); },
    },
  });
  const { error } = await supabase.auth.verifyOtp({ token_hash, type });
  if (error) return NextResponse.redirect(origin + '/auth/reset?e=otp_expired');
  return NextResponse.redirect(origin + safeNext);
}
