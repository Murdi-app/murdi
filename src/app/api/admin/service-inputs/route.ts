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

// GET ?service_request_id= : جلب المدخلات المحفوظة لطلب خدمة
export async function GET(req: Request) {
  const admin = await getAdmin();
  if (admin === null) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  const srid = new URL(req.url).searchParams.get('service_request_id');
  if (!srid) return NextResponse.json({ error: 'معرّف الطلب مطلوب' }, { status: 400 });

  const { data } = await admin.from('service_inputs').select('*').eq('service_request_id', srid).maybeSingle();
  return NextResponse.json({ ok: true, record: data || null });
}

// POST : حفظ/تحديث مدخلات طلب خدمة (upsert على service_request_id)
export async function POST(req: Request) {
  const admin = await getAdmin();
  if (admin === null) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });

  const body = await req.json();
  const { service_request_id, company_id, activity_kind, inputs } = body;
  if (!service_request_id || !company_id) return NextResponse.json({ error: 'الطلب والشركة مطلوبان' }, { status: 400 });

  const { data, error } = await admin.from('service_inputs').upsert({
    service_request_id,
    company_id,
    activity_kind: activity_kind || 'general',
    inputs: inputs || {},
    updated_by: ADMIN_EMAIL,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'service_request_id' }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, record: data });
}
