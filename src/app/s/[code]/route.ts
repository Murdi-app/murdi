import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { resolveShort } from '@/lib/shortLinks';

// رابط تعيين كلمة المرور القصير (murdi.sa/s/…). لا يحمل الرابط رمزاً: الرمز
// يُولَّد هنا لحظة الضغط ويُوجَّه إليه المتصفّح — فلا يجلس رمزٌ حيّ في محادثة.
export const dynamic = 'force-dynamic';

export async function GET(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const origin = new URL(req.url).origin;
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string);
  const link = await resolveShort(sb, 's', code);
  if (!link?.email) return NextResponse.redirect(origin + '/auth/login?expired=1');
  const after = '/auth/update-password?next=' + encodeURIComponent('/goal?tab=services');
  const { data, error } = await sb.auth.admin.generateLink({
    type: 'recovery', email: link.email,
    options: { redirectTo: origin + '/auth/callback?next=' + encodeURIComponent(after) },
  });
  const action = String(data?.properties?.action_link || '');
  if (error || !action) return NextResponse.redirect(origin + '/auth/login?expired=1');
  return NextResponse.redirect(action);
}
