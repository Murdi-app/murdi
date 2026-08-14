import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { buildFullOutreach, type ClientInput, type EntityInput } from '@/lib/outreachGenerate';
import { logError } from '@/lib/logError';
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

type Admin = NonNullable<Awaited<ReturnType<typeof getAdmin>>>;
type MatchRow = Record<string, unknown> & { id: string; company_id: string };

// ————— بناء بيانات العميل (مشتركة بين التوليد الفردي والدفعات) —————
async function buildClient(admin: Admin, companyId: string): Promise<ClientInput | null> {
  const { data: company, error: cErr } = await admin
    .from('companies')
    .select('id, company_name, sector, city, goal')
    .eq('id', companyId)
    .single();
  if (cErr || !company) return null;

  const { data: fd } = await admin
    .from('financial_data')
    .select('annual_revenue, net_profit, requested_amount, funding_purpose')
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

  try {
    const { data: fi } = await admin.from('service_inputs').select('inputs')
      .eq('company_id', companyId).eq('activity_kind', 'funding')
      .order('updated_at', { ascending: false }).limit(1).maybeSingle();
    const inp = (fi?.inputs || {}) as { amount?: number; purpose?: string };
    if (inp.amount) client.fundAmount = Number(inp.amount);
    if (inp.purpose) client.fundPurpose = String(inp.purpose);
  } catch {}
  try {
    if (!client.fundAmount && fd?.requested_amount) client.fundAmount = Number(fd.requested_amount);
    if (!client.fundPurpose && fd?.funding_purpose) client.fundPurpose = String(fd.funding_purpose);
  } catch {}

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

  return client;
}

// ————— صفٌّ واحد ← رسالة واحدة —————
// المسار يُؤخذ من الصف نفسه دائماً. لا من الرابط ولا من kind.
async function generateForRow(admin: Admin, client: ClientInput, m: MatchRow) {
  const entityTrack: 'funding' | 'investment' = m.track === 'investment' ? 'investment' : 'funding';
  const entity: EntityInput = {
    provider: String(m.provider || 'جهة غير مسمّاة'),
    product: String(m.product || ''),
    requirements: (m.requirements as string) || undefined,
    region: (m.region as string) || undefined,
    track: entityTrack,
    instrument: (m.instrument as string) || undefined,
    engagement: (m.engagement as string) || undefined,
  };

  const gen = await buildFullOutreach(client, entity);

  // نُبطل المسودة السابقة لهذه الجهة وحدها — لا لكل العميل
  await admin.from('outreach_messages')
    .update({ status: 'مستبدلة' })
    .eq('company_id', m.company_id)
    .eq('entity_name', entity.provider)
    .eq('track', entityTrack)
    .eq('status', 'مسودة');

  const { data: inserted, error: iErr } = await admin.from('outreach_messages').insert({
    company_id: m.company_id,
    match_row_id: m.id,
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
  }).select('*').single();
  if (iErr) throw iErr;

  return { inserted, gen, entity, entityTrack };
}

// POST { rowId }              : توليد مخاطبة لجهة واحدة عند الطلب  ← المسار الجديد
// POST { company_id, track }  : الدفعات القديمة (باقية للتوافق، ولم تعد مستعملة من الواجهة)
export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return NextResponse.json({ error: denied }, { status: 401 });
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 });

  let companyId = '';
  let track = '';
  let offset = 0;
  let kind = '';
  let rowId = '';
  try {
    const body = await req.json();
    companyId = String(body.company_id || '');
    track = String(body.track || '');
    offset = Number(body.offset) || 0;
    kind = String(body.kind || '');
    rowId = String(body.rowId || '');
  } catch {
    return NextResponse.json({ error: 'طلب غير صالح' }, { status: 400 });
  }

  // ═══════ المسار الفردي: جهة واحدة عند الطلب ═══════
  if (rowId) {
    const { data: row, error: rErr } = await admin
      .from('match_results').select('*').eq('id', rowId).single();
    if (rErr || !row) return NextResponse.json({ error: 'الصف غير موجود' }, { status: 404 });

    const client = await buildClient(admin, String(row.company_id));
    if (!client) return NextResponse.json({ error: 'العميل غير موجود' }, { status: 404 });

    try {
      const { inserted, gen, entity, entityTrack } = await generateForRow(admin, client, row as MatchRow);
      return NextResponse.json({
        ok: true,
        single: true,
        track: entityTrack,
        message: inserted,
        provider: entity.provider,
        email: gen.email,
        contactMethod: gen.contactMethod,
        altContact: gen.altContact,
        emailConfidence: gen.emailConfidence,
        subject: gen.subject,
        body: gen.body,
        language: gen.language,
      });
    } catch (e) {
      await logError('outreach.generateOne', e, { rowId, company_id: row.company_id });
      return NextResponse.json(
        { error: e instanceof Error ? e.message : 'تعذّر توليد المخاطبة' },
        { status: 500 }
      );
    }
  }

  // ═══════ المسار القديم بالدفعات ═══════
  if (!companyId) return NextResponse.json({ error: 'company_id مطلوب' }, { status: 400 });

  const client = await buildClient(admin, companyId);
  if (!client) return NextResponse.json({ error: 'العميل غير موجود' }, { status: 404 });

  const PAGE = 10;
  let q = admin.from('match_results').select('*', { count: 'exact' }).eq('company_id', companyId);
  if (track) q = q.eq('track', track);
  if (kind === 'acquisition') q = q.ilike('instrument', '%استحواذ%');
  else if (kind === 'equity') q = q.or('instrument.is.null,instrument.not.ilike.%استحواذ%');
  q = q.or('status.is.null,status.neq.superseded')
       .or('fit_score.is.null,fit_score.gt.0')
       .or('engagement.is.null,engagement.neq.قناة')
       .order('fit_score', { ascending: false, nullsFirst: false })
       .range(offset, offset + PAGE - 1);
  const { data: matches, error: mErr, count: totalCount } = await q;
  if (mErr) return NextResponse.json({ error: 'تعذّر جلب الجهات' }, { status: 500 });
  if (!matches || matches.length === 0) {
    return NextResponse.json({ error: 'لا توجد جهات مطابقة لهذا العميل' }, { status: 404 });
  }

  const results: { provider: string; ok: boolean; confidence?: string; error?: string }[] = [];
  const BATCH = 3;
  for (let i = 0; i < matches.length; i += BATCH) {
    const slice = matches.slice(i, i + BATCH);
    await Promise.all(slice.map(async (m) => {
      const provider = String(m.provider || 'جهة غير مسمّاة');
      try {
        const { gen } = await generateForRow(admin, client, m as MatchRow);
        results.push({ provider, ok: true, confidence: gen.emailConfidence });
      } catch (e) {
        await logError('outreach.generate', e, { company_id: companyId, entity: provider });
        results.push({ provider, ok: false, error: e instanceof Error ? e.message : String(e) });
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
