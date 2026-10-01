import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/requireAdmin';
import { loadFeeSettings, contractFinanceUpfront, CONTRACT_FINANCE } from '@/lib/feeSettings';
import { ensureDocument, refreshDraft } from '@/lib/contractFirst';

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
  const denied = await requireAdmin();
  if (denied) return NextResponse.json({ error: denied }, { status: 401 });
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
  const denied = await requireAdmin();
  if (denied) return NextResponse.json({ error: denied }, { status: 401 });
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
  const denied = await requireAdmin();
  if (denied) return NextResponse.json({ error: denied }, { status: 401 });
  const admin = await getAdmin();
  if (admin === null) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  const body = await req.json();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.status) updates.status = body.status;
  if (body.admin_deliverable !== undefined) updates.admin_deliverable = body.admin_deliverable;
  if (body.price !== undefined) updates.price = body.price;
  // رقم طلب الفحص السريع الذي خُصمت قيمته من هذه الدراسة — أثرٌ مكتوب للوعد لا ذاكرة
  if (body.credited_from !== undefined) updates.credited_from = body.credited_from || null;
  if (body.status === 'priced') updates.priced_at = new Date().toISOString();
  if (body.status === 'delivered') updates.delivered_at = new Date().toISOString();
  if (body.status === 'completed') updates.completed_at = new Date().toISOString();

  // ★ قيمة العقد (١ أكتوبر): تُكتب على الطلب، ومقدَّم «تمويل العقد» يُعاد من إعدادات
  //   المالك ما دام الطلب لم يُدفع — ومسودّة عقده تتبعها.
  const { data: cur } = await admin.from('service_requests').select('service_title, status, paid_at').eq('id', body.id).maybeSingle();
  if (body.contract_value !== undefined) {
    const v = Number(String(body.contract_value).replace(/[,٬\s]/g, ''));
    updates.contract_value = Number.isFinite(v) && v > 0 ? v : null;
    if (cur?.service_title === CONTRACT_FINANCE && !cur.paid_at && body.price === undefined && Number(updates.contract_value) > 0) {
      const fees = await loadFeeSettings(admin);
      const up = contractFinanceUpfront(fees, Number(updates.contract_value));
      if (up) { updates.price = up; updates.quoted_price = up; }
    }
  }
  const { error } = await admin.from('service_requests').update(updates).eq('id', body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // العقد أولاً: كل طلبٍ صار مسعَّراً تصدر وثيقته — سندٌ للثابت، ومسودّةُ عقدٍ لما فيه نسبة
  const nowStatus = String(body.status || cur?.status || '');
  let doc: { kind: string; status: string } | null = null;
  let docErr: string | null = null;
  if (nowStatus === 'priced') {
    try { doc = await ensureDocument(admin, String(body.id)); }
    catch (e) { docErr = 'سُعّر الطلب وتعذّر إصدار وثيقته — ' + (e instanceof Error ? e.message : ''); }
    // مسودّةٌ موجودة تتبع المقدَّم وقيمة العقد الجديدين
    if (doc?.status === 'draft' && (updates.price !== undefined || updates.contract_value !== undefined)) {
      await refreshDraft(admin, String(body.id));
    }
  }
  return NextResponse.json({ ok: true, doc, warn: docErr });
}
