import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { requireStaff, ownsCompany } from '@/lib/requireStaff';

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
  const { who, error: denied } = await requireStaff();
  if (denied || !who) return NextResponse.json({ error: denied || 'غير مصرح' }, { status: 401 });
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

  const url = new URL(req.url);
  const companyId = url.searchParams.get('company_id');
  if (!companyId) return NextResponse.json({ error: 'company_id مطلوب' }, { status: 400 });
  if (!(await ownsCompany(who, companyId))) return NextResponse.json({ error: 'هذا العميل ليس ضمن عملائك' }, { status: 403 });

  const { data, error } = await admin
    .from('outreach_messages')
    .select('*')
    .eq('company_id', companyId)
    .neq('status', 'مستبدلة')
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: 'تعذّر الجلب' }, { status: 500 });
  return NextResponse.json({ ok: true, messages: data || [] });
}

// POST { id, action, ...fields } : إجراء على رسالة واحدة
// action: approve | reject | update | delete
export async function POST(req: Request) {
  const { who, error: denied } = await requireStaff();
  if (denied || !who) return NextResponse.json({ error: denied || 'غير مصرح' }, { status: 401 });
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 });

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'طلب غير صالح' }, { status: 400 }); }

  const id = String(body.id || '');
  const action = String(body.action || '');
  if (!id || !action) return NextResponse.json({ error: 'id و action مطلوبان' }, { status: 400 });
  if (who.role === 'staff' && (action === 'update' || action === 'delete')) {
    return NextResponse.json({ error: 'تعديل نص الرسالة أو حذفها من صلاحية الإدارة فقط' }, { status: 403 });
  }
  {
    const { data: own } = await admin.from('outreach_messages').select('company_id').eq('id', id).maybeSingle();
    if (!own) return NextResponse.json({ error: 'الرسالة غير موجودة' }, { status: 404 });
    if (!(await ownsCompany(who, String(own.company_id)))) return NextResponse.json({ error: 'هذا العميل ليس ضمن عملائك' }, { status: 403 });
  }

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

  if (action === 'undo') {
    const { error } = await admin.from('outreach_messages')
      .update({ status: 'مسودة', updated_at: new Date().toISOString() }).eq('id', id);
    if (error) return NextResponse.json({ error: 'تعذّر التراجع' }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === 'reject') {
    const { error } = await admin.from('outreach_messages')
      .update({ status: 'مرفوضة', updated_at: new Date().toISOString() }).eq('id', id);
    if (error) return NextResponse.json({ error: 'تعذّر الرفض' }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === 'contacted') {
    const { error } = await admin.from('outreach_messages')
      .update({ status: 'مُرسلة', reply_status: 'awaiting', last_sent_at: new Date().toISOString(), next_followup_at: new Date(Date.now() + 5*24*60*60*1000).toISOString(), updated_at: new Date().toISOString() }).eq('id', id);
    if (error) return NextResponse.json({ error: 'تعذّر تسجيل التواصل' }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === 'reply') {
    const rs = String((body as Record<string, unknown>).reply_status || '');
    if (!['replied', 'declined', 'closed', 'awaiting'].includes(rs)) return NextResponse.json({ error: 'حالة رد غير صالحة' }, { status: 400 });
    const { error } = await admin.from('outreach_messages')
      .update({ reply_status: rs, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) return NextResponse.json({ error: 'تعذّر تحديث الرد' }, { status: 500 });
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
