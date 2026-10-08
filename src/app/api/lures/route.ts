import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { computeLures } from '@/lib/lures';

// طُعم الخدمات الخمس لمنشأة العميل نفسه — أرقامٌ بلا أسماء جهات.
// ?investment=&ask=&isNew= لطُعم الجدوى (يُدخلها العميل في البطاقة ولا تُحفظ).
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const store = await cookies();
  const sb = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    { cookies: { getAll: () => store.getAll(), setAll: () => {} } });
  const { data } = await sb.auth.getUser();
  if (!data?.user) return NextResponse.json({ error: 'سجّل الدخول' }, { status: 401 });
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string);
  const { data: co } = await admin.from('companies').select('id').eq('user_id', data.user.id).maybeSingle();
  if (!co) return NextResponse.json({ error: 'لا منشأة' }, { status: 404 });
  const q = new URL(req.url).searchParams;
  const n = (k: string) => { const v = Number(q.get(k)); return Number.isFinite(v) && v > 0 ? v : undefined; };
  const lures = await computeLures(admin, String(co.id), { investment: n('investment'), ask: n('ask'), isNew: q.get('isNew') !== 'false' });
  return NextResponse.json({ ok: true, lures });
}
