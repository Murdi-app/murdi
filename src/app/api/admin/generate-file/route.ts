import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { generateFileContent, buildFileHTML, type FileClientData } from '@/lib/fileGenerate';

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

// POST { company_id, track } : يولّد ملف HTML احترافي
export async function POST(req: Request) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 });

  let companyId = '', track = 'funding';
  try { const b = await req.json(); companyId = String(b.company_id || ''); track = b.track === 'investment' ? 'investment' : 'funding'; }
  catch { return NextResponse.json({ error: 'طلب غير صالح' }, { status: 400 }); }
  if (!companyId) return NextResponse.json({ error: 'company_id مطلوب' }, { status: 400 });

  // بيانات الشركة
  const { data: company } = await admin
    .from('companies')
    .select('company_name, cr_number, sector, city, goal')
    .eq('id', companyId)
    .single();
  if (!company) return NextResponse.json({ error: 'الشركة غير موجودة' }, { status: 404 });

  // أحدث بيانات مالية
  const { data: fd } = await admin
    .from('financial_data')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  // أحدث تقييم
  const { data: rr } = await admin
    .from('readiness_results')
    .select('readiness_score, verdict, valuation_estimate')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  const client: FileClientData = {
    companyName: company.company_name || 'الشركة',
    crNumber: company.cr_number || undefined,
    sector: company.sector || undefined,
    city: company.city || undefined,
    goal: company.goal || undefined,
    revenue: fd?.annual_revenue ?? undefined,
    liabilities: fd?.debt_remaining ?? undefined,
    readinessScore: rr?.readiness_score ?? undefined,
    verdict: rr?.verdict ?? undefined,
    valuationEstimate: rr?.valuation_estimate ?? undefined,
  };

  try {
    const content = await generateFileContent(client, track as 'funding' | 'investment');
    const html = buildFileHTML(client, content, track as 'funding' | 'investment');
    return NextResponse.json({ ok: true, html });
  } catch (e) {
    return NextResponse.json({ error: 'تعذر التوليد: ' + String(e).slice(0, 120) }, { status: 500 });
  }
}
