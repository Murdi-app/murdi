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

// GET ?company_id : يجيب رابط الملف المرفق
export async function GET(req: Request) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 });
  const url = new URL(req.url);
  const companyId = url.searchParams.get('company_id') || '';
  if (!companyId) return NextResponse.json({ error: 'company_id مطلوب' }, { status: 400 });
  const { data } = await admin.from('outreach_attachments').select('*').eq('company_id', companyId).single();
  return NextResponse.json({ ok: true, attachment: data || null });
}

// POST { company_id, file_url, file_name } : يحفظ/يستبدل رابط الملف
export async function POST(req: Request) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 });
  let companyId = '', fileUrl = '', fileName = '';
  try { const b = await req.json(); companyId = String(b.company_id || ''); fileUrl = String(b.file_url || ''); fileName = String(b.file_name || ''); }
  catch { return NextResponse.json({ error: 'طلب غير صالح' }, { status: 400 }); }
  if (!companyId || !fileUrl) return NextResponse.json({ error: 'بيانات ناقصة' }, { status: 400 });
  const { error } = await admin.from('outreach_attachments').upsert({
    company_id: companyId, file_url: fileUrl, file_name: fileName, uploaded_at: new Date().toISOString(),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE ?company_id : يحذف الملف المرفق
export async function DELETE(req: Request) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 });
  const url = new URL(req.url);
  const companyId = url.searchParams.get('company_id') || '';
  if (!companyId) return NextResponse.json({ error: 'company_id مطلوب' }, { status: 400 });
  await admin.from('outreach_attachments').delete().eq('company_id', companyId);
  return NextResponse.json({ ok: true });
}
