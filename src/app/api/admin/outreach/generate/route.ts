import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { buildFullOutreach, type ClientInput, type EntityInput } from '@/lib/outreachGenerate';

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
  try {
    const body = await req.json();
    companyId = String(body.company_id || '');
    track = String(body.track || '');
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

  const client: ClientInput = {
    companyName: company.company_name || '',
    sector: company.sector || undefined,
    city: company.city || undefined,
    goal: company.goal || undefined,
  };

  // ٢) الجهات المطابقة (نفلتر حسب المسار إن طُلب)
  let q = admin.from('match_results').select('*').eq('company_id', companyId);
  if (track) q = q.eq('track', track);
  const { data: matches, error: mErr } = await q;
  if (mErr) return NextResponse.json({ error: 'تعذّر جلب الجهات' }, { status: 500 });
  if (!matches || matches.length === 0) {
    return NextResponse.json({ error: 'لا توجد جهات مطابقة لهذا العميل' }, { status: 404 });
  }

  // ٣) نتجنّب التكرار: نحذف المسودات السابقة لنفس العميل (نبدأ نظيف)
  await admin.from('outreach_messages').delete().eq('company_id', companyId).eq('status', 'مسودة');

  // ٤) نولّد رسالة لكل جهة (نعالجها بدفعات صغيرة لتجنّب الضغط)
  const results: { provider: string; ok: boolean; confidence?: string }[] = [];
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
      } catch {
        results.push({ provider: entity.provider, ok: false });
      }
    }));
  }

  const okCount = results.filter(r => r.ok).length;
  return NextResponse.json({
    ok: true,
    total: matches.length,
    generated: okCount,
    failed: matches.length - okCount,
    results,
  });
}
