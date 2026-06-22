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
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string);
}

// GET: كل المدفوعات + اسم الشركة
export async function GET() {
  const admin = await getAdmin();
  if (admin === null) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  const { data: pays } = await admin.from('payments').select('*').order('created_at', { ascending: false });
  const ids = [...new Set((pays || []).map((p) => p.company_id).filter(Boolean))];
  const names: Record<string, string> = {};
  if (ids.length) {
    const { data: comps } = await admin.from('companies').select('id, company_name').in('id', ids);
    for (const c of (comps || [])) names[c.id] = c.company_name || '';
  }
  const rows = (pays || []).map((p) => ({ ...p, company_name: p.company_id ? (names[p.company_id] || '—') : '—' }));
  return NextResponse.json({ payments: rows });
}

// POST { id, action: 'confirm' } : تأكيد تحويل وتفعيل الاشتراك
export async function POST(req: Request) {
  const admin = await getAdmin();
  if (admin === null) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const id: string = body?.id || '';
  const action: string = body?.action || '';
  if (!id) return NextResponse.json({ error: 'id مطلوب' }, { status: 400 });

  const { data: pay } = await admin.from('payments').select('*').eq('id', id).maybeSingle();
  if (!pay) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });

  if (action === 'confirm') {
    await admin.from('payments').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', id);
    if (pay.kind === 'subscription' && pay.company_id) {
      const until = new Date(); until.setMonth(until.getMonth() + 4);
      await admin.from('companies').update({ subscription_active: true, subscription_until: until.toISOString() }).eq('id', pay.company_id);
    }
    // عند تأكيد تحويل خدمة: ربط الدفعة بالطلب وتحويله إلى مدفوع
    if (pay.kind === 'service' && pay.company_id) {
      await admin.from('service_requests')
        .update({ status: 'paid', payment_id: id, updated_at: new Date().toISOString() })
        .eq('company_id', pay.company_id).eq('status', 'priced');
    }
    return NextResponse.json({ ok: true });
  }
  if (action === 'reject') {
    await admin.from('payments').update({ status: 'rejected' }).eq('id', id);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: 'إجراء غير معروف' }, { status: 400 });
}
