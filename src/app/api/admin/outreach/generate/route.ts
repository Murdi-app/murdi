import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { buildFullOutreach, type ClientInput, type EntityInput } from '@/lib/outreachGenerate';
import { logError } from '@/lib/logError';

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

// POST { company_id, track } : يولّد رسائل المخاطبة لكل جهة مطابقة
export async function POST(req: Request) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 });

  let companyId = '';
  let track = '';
  let offset = 0;
  try {
    const body = await req.json();
    companyId = String(body.company_id || '');
    track = String(body.track || '');
    offset = Number(body.offset) || 0;
  } catch {
    return NextResponse.json({ error: 'طلب غير صالح' }, { status: 400 });
  }
  if (!companyId) return NextResponse.json({ error: 'company_id مطلوب' }, { status: 400 });

  // ١) بيانات العميل
  const { data: company, error: cErr } = await admin
    .from('companies')
    .select('id, company_name, sector, city, goal')
    .eq('id', companyId)
    .single();
  if (cErr || !company) return NextResponse.json({ error: 'العميل غير موجود' }, { status: 404 });

  // جلب الإيراد الفعلي من financial_data ودرجة الجاهزية من readiness_results
  const { data: fd } = await admin
    .from('financial_data')
    .select('annual_revenue, net_profit')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data: rr } = await admin
    .from('readiness_results')
    .select('readiness_score, verdict')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const client: ClientInput = {
    companyName: company.company_name || '',
    revenue: fd?.annual_revenue ? Number(fd.annual_revenue) : undefined,
    readinessScore: rr?.readiness_score ? Number(rr.readiness_score) : undefined,
    verdict: rr?.verdict || undefined,
    sector: company.sector || undefined,
    city: company.city || undefined,
    goal: company.goal || undefined,
    profit: fd?.net_profit ? Number(fd.net_profit) : undefined,
  };

  // أرقام العرض المحفوظة من خدمة العرض الاستثماري
  try {
    const { data: pin } = await admin.from('service_inputs')
      .select('inputs').eq('company_id', companyId).eq('activity_kind', 'pitch')
      .order('updated_at', { ascending: false }).limit(1).maybeSingle();
    const pv = (pin?.inputs as { pitch?: Record<string, string> } | null)?.pitch;
    if (pv) {
      if (pv.equity_offered) client.equityOffered = String(pv.equity_offered);
      if (pv.pre_money) client.preMoney = Number(pv.pre_money).toLocaleString('en-US');
      if (pv.round_size) client.roundSize = Number(pv.round_size);
    }
    const { data: srv } = await admin.from('service_requests')
      .select('price').eq('company_id', companyId).not('price', 'is', null)
      .order('updated_at', { ascending: false }).limit(1).maybeSingle();
    if (srv?.price) client.roundSize = Number(srv.price);
  } catch {}

  // ٢) الجهات المطابقة (نفلتر حسب المسار إن طُلب)
  const PAGE = 10;
  let q = admin.from('match_results').select('*', { count: 'exact' }).eq('company_id', companyId);
  if (track) q = q.eq('track', track);
  q = q.or('status.is.null,status.neq.superseded').or('fit_score.is.null,fit_score.gt.0').or('engagement.is.null,engagement.neq.قناة').order('fit_score', { ascending: false, nullsFirst: false }).range(offset, offset + PAGE - 1);
  const { data: matches, error: mErr, count: totalCount } = await q;
  if (mErr) return NextResponse.json({ error: 'تعذّر جلب الجهات' }, { status: 500 });
  if (!matches || matches.length === 0) {
    return NextResponse.json({ error: 'لا توجد جهات مطابقة لهذا العميل' }, { status: 404 });
  }

  // ٣) نتجنّب التكرار: نحذف المسودات السابقة لنفس العميل (نبدأ نظيف)
  if (offset === 0) await admin.from('outreach_messages').update({ status: 'مستبدلة' }).eq('company_id', companyId).eq('status', 'مسودة');

  // ٤) نولّد رسالة لكل جهة (نعالجها بدفعات صغيرة لتجنّب الضغط)
  const results: { provider: string; ok: boolean; confidence?: string; error?: string }[] = [];
  const BATCH = 3;
  for (let i = 0; i < matches.length; i += BATCH) {
    const slice = matches.slice(i, i + BATCH);
    await Promise.all(slice.map(async (m) => {
      const entityTrack: 'funding' | 'investment' = m.track === 'investment' ? 'investment' : 'funding';
      const entity: EntityInput = {
        provider: m.provider || 'جهة غير مسمّاة',
        product: m.product || '',
        requirements: m.requirements || undefined,
        region: m.region || undefined,
        track: entityTrack,
      instrument: (m as { instrument?: string }).instrument || undefined,
      engagement: (m as { engagement?: string }).engagement || undefined,
      };
      try {
        const gen = await buildFullOutreach(client, entity);
        await admin.from('outreach_messages').insert({
          company_id: companyId,
          entity_table: entityTrack === 'funding' ? 'financing_products' : 'investment_entities',
          entity_name: entity.provider,
          entity_email: gen.email,
          entity_language: gen.language,
          alt_contact: gen.altContact,
          contact_method: gen.contactMethod,
          track: entityTrack,
          subject: gen.subject,
          message_body: gen.body,
          status: 'مسودة',
          error_note: gen.emailConfidence !== 'مؤكّد'
            ? 'الإيميل: ' + gen.emailConfidence + ' (' + gen.emailSource + ')'
            : null,
        });
        results.push({ provider: entity.provider, ok: true, confidence: gen.emailConfidence });
      } catch (e) {
        await logError('outreach.generate', e, { company_id: companyId, entity: entity.provider });
        results.push({ provider: entity.provider, ok: false, error: e instanceof Error ? e.message : String(e) });
      }
    }));
  }

  const okCount = results.filter(r => r.ok).length;
  const grandTotal = totalCount || matches.length;
  const processedSoFar = offset + matches.length;
  const remaining = Math.max(0, grandTotal - processedSoFar);
  return NextResponse.json({
    ok: true,
    total: grandTotal,
    batchGenerated: okCount,
    batchFailed: matches.length - okCount,
    processedSoFar,
    remaining,
    nextOffset: remaining > 0 ? processedSoFar : null,
    results,
  });
}
