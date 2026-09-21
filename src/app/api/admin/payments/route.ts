import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { logError } from '@/lib/logError';
import { requireAdmin } from '@/lib/requireAdmin';
import { confirmPayment } from '@/lib/confirmPayment';

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
  const denied = await requireAdmin();
  if (denied) return NextResponse.json({ error: denied }, { status: 401 });
  const admin = await getAdmin();
  if (admin === null) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  const { data: pays } = await admin.from('payments').select('*').order('created_at', { ascending: false });
  const ids = [...new Set((pays || []).map((p) => p.company_id).filter(Boolean))];
  const names: Record<string, string> = {};
  if (ids.length) {
    const { data: comps } = await admin.from('companies').select('id, company_name').in('id', ids);
    for (const c of (comps || [])) names[c.id] = c.company_name || '';
  }
  // الإيصالات في دلو خاص: يُوقَّع رابط مؤقت لكل واحد وقت العرض، فيفتح فعلاً
  const rows = await Promise.all((pays || []).map(async (p) => {
    let receipt: string | null = p.transfer_receipt_url || null;
    if (receipt && !/^https?:/i.test(receipt)) {
      const { data: sg } = await admin.storage.from('receipts').createSignedUrl(receipt, 60 * 60);
      receipt = sg?.signedUrl || null;
    }
    return { ...p, transfer_receipt_url: receipt, company_name: p.company_id ? (names[p.company_id] || '—') : '—' };
  }));
  return NextResponse.json({ payments: rows });
}

// POST { id, action: 'confirm' } : تأكيد استلام تحويل بنكي
export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return NextResponse.json({ error: denied }, { status: 401 });
  const admin = await getAdmin();
  if (admin === null) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const id: string = body?.id || '';
  const action: string = body?.action || '';
  if (!id) return NextResponse.json({ error: 'id مطلوب' }, { status: 400 });

  const { data: pay } = await admin.from('payments').select('*').eq('id', id).maybeSingle();
  if (!pay) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });

  if (action === 'confirm') {
    // المنطق في مكتبةٍ مشتركة: المالك ومكتب الطلبات يؤكّدان بالطريقة نفسها
    const res = await confirmPayment(admin, id);
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
    return NextResponse.json({ ok: true, note: res.note });
  }
  if (action === 'reject') {
    await admin.from('payments').update({ status: 'rejected' }).eq('id', id);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: 'إجراء غير معروف' }, { status: 400 });
}
