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

// POST: اعتماد تصحيح رسمي لبيانات شركة
export async function POST(req: Request) {
  const admin = await getAdmin();
  if (admin === null) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });

  const body = await req.json();
  const { company_id, total_financing, remaining_debt, annual_revenue, source_note } = body;

  if (!company_id) return NextResponse.json({ error: 'معرّف الشركة مطلوب' }, { status: 400 });
  if (!source_note || String(source_note).trim().length < 5) {
    return NextResponse.json({ error: 'مصدر التصحيح مطلوب — لا تصحيح بلا مستند يسنده' }, { status: 400 });
  }

  const n = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number(v));

  const { data, error } = await admin.from('admin_corrections').insert({
    company_id,
    total_financing: n(total_financing),
    remaining_debt: n(remaining_debt),
    annual_revenue: n(annual_revenue),
    source_note: String(source_note).trim(),
    corrected_by: ADMIN_EMAIL,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, correction: data });
}
