import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

const ADMIN_EMAIL = 'hololalmurdi.fs@gmail.com';

async function getAdmin() {
  const cookieStore = await cookies();
  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await sb.auth.getUser();
  if (!user || user.email !== ADMIN_EMAIL) return null;
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  );
}

// GET ?company_id=...&track=... : جهات مطابقة عميل
export async function GET(req: Request) {
  const admin = await getAdmin();
  if (admin === null) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  const url = new URL(req.url);
  const companyId = url.searchParams.get('company_id');
  const track = url.searchParams.get('track');
  if (!companyId) return NextResponse.json({ matches: [] });
  let q = admin.from('match_results').select('*').eq('company_id', companyId).order('created_at', { ascending: false });
  if (track) q = q.eq('track', track);
  const { data } = await q;
  return NextResponse.json({ matches: data || [] });
}

// PATCH : تحديث حالة جهة (تواصلت/ردّت...)
export async function PATCH(req: Request) {
  const admin = await getAdmin();
  if (admin === null) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  const body = await req.json();
  const { error } = await admin.from('match_results').update({ status: body.status }).eq('id', body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
