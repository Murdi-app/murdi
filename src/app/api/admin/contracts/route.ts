import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { fundingContract, investmentContract, acquisitionContract, ContractFields, type FeeType } from '@/lib/contracts';

// آلية الأتعاب تُقرأ من صفوف العقد ذاتها، فنص العقد يتبع الحقول ولا يُكتب يدوياً
const FEE_COLS = ['client_name', 'client_id_number', 'establishment_name', 'establishment_cr',
                  'fee_percent', 'deal_value', 'fee_type', 'fixed_amount', 'success_min', 'success_base'];

function toFields(r: Record<string, unknown>): ContractFields {
  return {
    clientName: r.client_name as string,
    clientIdNumber: r.client_id_number as string,
    establishmentName: r.establishment_name as string,
    establishmentCr: r.establishment_cr as string,
    feePercent: r.fee_percent as number,
    feeType: (r.fee_type as FeeType) || 'percent',
    fixedAmount: r.fixed_amount as number,
    successMin: r.success_min as number,
  };
}

function render(type: string, f: ContractFields): string {
  return type === 'acquisition' ? acquisitionContract(f) : type === 'investment' ? investmentContract(f) : fundingContract(f);
}
import { requireAdmin } from '@/lib/requireAdmin';

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
  const denied = await requireAdmin();
  if (denied) return NextResponse.json({ error: denied }, { status: 401 });
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
  const denied = await requireAdmin();
  if (denied) return NextResponse.json({ error: denied }, { status: 401 });
  const admin = await getAdmin();
  if (admin === null) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  const body = await req.json();
  const { serviceRequestId, companyId, contractType } = body;

  // آلية الأتعاب المبدئية: تُورَّث من طلب الخدمة إن حُدِّدت فيه، وإلا نسبة نجاح
  let seed: Record<string, unknown> = { fee_type: 'percent' };
  if (serviceRequestId) {
    const { data: sr } = await admin.from('service_requests')
      .select('fee_type, success_pct, success_min, success_base, quoted_price')
      .eq('id', serviceRequestId).maybeSingle();
    if (sr) seed = {
      fee_type: sr.fee_type || 'percent',
      fee_percent: sr.success_pct ?? null,
      success_min: sr.success_min ?? null,
      success_base: sr.success_base ?? null,
      fixed_amount: (sr.fee_type === 'fixed' || sr.fee_type === 'both') ? (sr.quoted_price ?? null) : null,
    };
  }
  const text = render(String(contractType), toFields(seed));

  const { data, error } = await admin.from('contracts').insert({
    company_id: companyId,
    service_request_id: serviceRequestId,
    contract_type: contractType,
    status: 'draft',
    contract_body: text,
    ...seed,
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, contract: data });
}

// PATCH: تحديث المسودّة أو إصدارها
export async function PATCH(req: Request) {
  const denied = await requireAdmin();
  if (denied) return NextResponse.json({ error: denied }, { status: 401 });
  const admin = await getAdmin();
  if (admin === null) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  const body = await req.json();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const k of [...FEE_COLS, 'status']) {
    if (body[k] !== undefined) updates[k] = body[k] === '' ? null : body[k];
  }
  // إعادة توليد نص العقد بالحقول المعبأة (الحقول هي المصدر، لا النص)
  // السلسلة مكتوبة حرفياً لا مبنيةً من مصفوفة — وإلا فقد Supabase استنتاج النوع وعاد GenericStringError
  const { data: existingRaw } = await admin.from('contracts')
    .select('contract_type, client_name, client_id_number, establishment_name, establishment_cr, fee_percent, deal_value, fee_type, fixed_amount, success_min, success_base')
    .eq('id', body.id).single();
  const existing = existingRaw as unknown as Record<string, unknown> | null;
  if (existing) {
    const merged: Record<string, unknown> = { ...existing };
    for (const k of FEE_COLS) if (updates[k] !== undefined) merged[k] = updates[k];
    updates.contract_body = render(String(merged.contract_type), toFields(merged));
  }
  if (body.status === 'issued') updates.issued_at = new Date().toISOString();
  if (body.status === 'completed') updates.completed_at = new Date().toISOString();
  const { error } = await admin.from('contracts').update(updates).eq('id', body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
