import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { fundingContract, investmentContract, ContractFields } from '@/lib/contracts';

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

// GET: كل العقود (أو عقود شركة واحدة عبر ?company_id=)
export async function GET(req: Request) {
  const admin = await getAdmin();
  if (admin === null) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  const companyId = new URL(req.url).searchParams.get('company_id');
  let q = admin.from('contracts').select('*, companies(company_name, phone)').order('created_at', { ascending: false });
  if (companyId) q = q.eq('company_id', companyId);
  const { data } = await q;
  return NextResponse.json({ contracts: data || [] });
}

// POST: إنشاء مسودّة عقد لطلب خدمة
export async function POST(req: Request) {
  const admin = await getAdmin();
  if (admin === null) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  const body = await req.json();
  const { serviceRequestId, companyId, contractType } = body;

  const fields: ContractFields = {};
  const text = contractType === 'investment' ? investmentContract(fields) : fundingContract(fields);

  const { data, error } = await admin.from('contracts').insert({
    company_id: companyId,
    service_request_id: serviceRequestId,
    contract_type: contractType,
    status: 'draft',
    contract_body: text,
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, contract: data });
}

// PATCH: تحديث المسودّة أو إصدارها
export async function PATCH(req: Request) {
  const admin = await getAdmin();
  if (admin === null) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  const body = await req.json();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const k of ['client_name', 'client_id_number', 'establishment_name', 'establishment_cr', 'fee_percent', 'deal_value', 'status']) {
    if (body[k] !== undefined) updates[k] = body[k];
  }
  // إعادة توليد نص العقد بالحقول المعبأة (الحقول هي المصدر)
  const { data: existing } = await admin.from('contracts').select('contract_type, client_name, client_id_number, establishment_name, establishment_cr, fee_percent').eq('id', body.id).single();
  if (existing) {
    const fields: ContractFields = {
      clientName: body.client_name ?? existing.client_name,
      clientIdNumber: body.client_id_number ?? existing.client_id_number,
      establishmentName: body.establishment_name ?? existing.establishment_name,
      establishmentCr: body.establishment_cr ?? existing.establishment_cr,
      feePercent: body.fee_percent ?? existing.fee_percent,
    };
    updates.contract_body = existing.contract_type === 'investment' ? investmentContract(fields) : fundingContract(fields);
  }
  if (body.status === 'issued') updates.issued_at = new Date().toISOString();
  if (body.status === 'completed') updates.completed_at = new Date().toISOString();
  const { error } = await admin.from('contracts').update(updates).eq('id', body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
