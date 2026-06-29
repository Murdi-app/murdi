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

export async function GET() {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 });
  const { data } = await admin
    .from('payment_link_requests')
    .select('*, companies(company_name, phone)')
    .order('created_at', { ascending: false });
  return NextResponse.json({ ok: true, requests: data || [] });
}

export async function PATCH(req: Request) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 });
  let id = '', status = '', note = '';
  try { const b = await req.json(); id = String(b.id || ''); status = String(b.status || ''); note = String(b.note || ''); }
  catch { return NextResponse.json({ error: 'طلب غير صالح' }, { status: 400 }); }
  if (!id) return NextResponse.json({ error: 'id مطلوب' }, { status: 400 });
  const patch: Record<string, unknown> = {};
  if (status) patch.status = status;
  if (note) patch.note = note;
  const { error } = await admin.from('payment_link_requests').update(patch).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
