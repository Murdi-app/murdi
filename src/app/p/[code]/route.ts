import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { resolveShort } from '@/lib/shortLinks';

// رابط الدفع القصير (murdi.sa/p/…) — يقود إلى صفحة التحويل برمز الطلب. والحارس
// (العقد أو السند قبل الدفع) في الصفحة وفي بابَي الدفع، لا هنا وحده.
export const dynamic = 'force-dynamic';

export async function GET(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string);
  const link = await resolveShort(sb, 'p', code);
  const origin = new URL(req.url).origin;
  if (!link?.service_request_id) return NextResponse.redirect(origin + '/pay/transfer?expired=1');
  const { data: sr } = await sb.from('service_requests').select('pay_token').eq('id', link.service_request_id).maybeSingle();
  if (!sr?.pay_token) return NextResponse.redirect(origin + '/pay/transfer?expired=1');
  return NextResponse.redirect(origin + '/pay/transfer?t=' + sr.pay_token);
}
