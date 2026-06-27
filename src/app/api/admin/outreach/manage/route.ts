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

// GET ?company_id=... : كل رسائل المخاطبة لعميل
export async function GET(req: Request) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

  const url = new URL(req.url);
  const companyId = url.searchParams.get('company_id');
  if (!companyId) return NextResponse.json({ error: 'company_id مطلوب' }, { status: 400 });

  const { data, error } = await admin
    .from('outreach_messages')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: 'تعذّر الجلب' }, { status: 500 });
  return NextResponse.json({ ok: true, messages: data || [] });
}

// POST { id, action, ...fields } : إجراء على رسالة واحدة
// action: approve | reject | update | delete
export async function POST(req: Request) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 });

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'طلب غير صالح' }, { status: 400 }); }

  const id = String(body.id || '');
  const action = String(body.action || '');
  if (!id || !action) return NextResponse.json({ error: 'id و action مطلوبان' }, { status: 400 });

  if (action === 'delete') {
    const { error } = await admin.from('outreach_messages').delete().eq('id', id);
    if (error) return NextResponse.json({ error: 'تعذّر الحذف' }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === 'approve') {
    const { error } = await admin.from('outreach_messages')
      .update({ status: 'معتمدة', updated_at: new Date().toISOString() }).eq('id', id);
    if (error) return NextResponse.json({ error: 'تعذّر الاعتماد' }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === 'reject') {
    const { error } = await admin.from('outreach_messages')
      .update({ status: 'مرفوضة', updated_at: new Date().toISOString() }).eq('id', id);
    if (error) return NextResponse.json({ error: 'تعذّر الرفض' }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === 'update') {
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (typeof body.subject === 'string') patch.subject = body.subject;
    if (typeof body.message_body === 'string') patch.message_body = body.message_body;
    if (typeof body.entity_email === 'string') patch.entity_email = body.entity_email;
    const { error } = await admin.from('outreach_messages').update(patch).eq('id', id);
    if (error) return NextResponse.json({ error: 'تعذّر التحديث' }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'إجراء غير معروف' }, { status: 400 });
}
