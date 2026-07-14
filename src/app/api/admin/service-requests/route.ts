import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

const ADMIN_EMAIL = 'hololalmurdi.fs@gmail.com';

async function getAdmin() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== ADMIN_EMAIL) return null;
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  );
}

export async function GET() {
  const admin = await getAdmin();
  if (admin === null) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  const { data } = await admin
    .from('service_requests')
    .select('*, companies(company_name, phone)')
    .order('created_at', { ascending: false });
  return NextResponse.json({ requests: data || [] });
}

// POST: إنشاء طلب خدمة نيابةً عن العميل (يُنشأ بحالة submitted تماماً كطلب العميل)
export async function POST(req: Request) {
  const admin = await getAdmin();
  if (admin === null) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  const body = await req.json();
  const { company_id, service_title } = body;
  if (!company_id || !service_title) return NextResponse.json({ error: 'الشركة والخدمة مطلوبتان' }, { status: 400 });

  const { data, error } = await admin.from('service_requests').insert({
    company_id,
    service_title,
    service_category: 'تجهيز',
    status: 'submitted',
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, request: data });
}

export async function PATCH(req: Request) {
  const admin = await getAdmin();
  if (admin === null) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  const body = await req.json();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.status) updates.status = body.status;
  if (body.admin_deliverable !== undefined) updates.admin_deliverable = body.admin_deliverable;
  if (body.price !== undefined) updates.price = body.price;
  if (body.status === 'priced') updates.priced_at = new Date().toISOString();
  if (body.status === 'delivered') updates.delivered_at = new Date().toISOString();
  if (body.status === 'completed') updates.completed_at = new Date().toISOString();
  const { error } = await admin.from('service_requests').update(updates).eq('id', body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
