import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

async function getAdmin() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (user === null || user.email !== 'hololalmurdi.fs@gmail.com') return null;
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  );
}

export async function GET() {
  const admin = await getAdmin();
  if (admin === null) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  const { data: products } = await admin.from('financing_products').select('*').order('created_at', { ascending: false });
  const { data: entities } = await admin.from('investment_entities').select('*').order('created_at', { ascending: false });
  return NextResponse.json({ products: products || [], entities: entities || [] });
}

export async function POST(req: Request) {
  const admin = await getAdmin();
  if (admin === null) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  const body = await req.json();
  const table = body.table === 'investment_entities' ? 'investment_entities' : 'financing_products';
  const { error } = await admin.from(table).insert(body.row);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request) {
  const admin = await getAdmin();
  if (admin === null) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  const body = await req.json();
  const table = body.table === 'investment_entities' ? 'investment_entities' : 'financing_products';
  if (body.action === 'toggle') {
    const { error } = await admin.from(table).update({ status: body.status }).eq('id', body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (body.action === 'delete') {
    const { error } = await admin.from(table).delete().eq('id', body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
