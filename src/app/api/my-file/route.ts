import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

// «ملفي» — مراحل ملف العميل الذي دفع، بتواريخها، من الخانات التي تسجّلها رغد (٨ أكتوبر، بأمر المالك):
//   جهّزنا الملف ← عرضناه على N جهات ← وافقت جهة ← صُرف التمويل.
// ★ بلا أسماء جهات ولا مبالغ أتعاب: عددٌ وتاريخ فقط.
export const dynamic = 'force-dynamic';
const FILE_SERVICES = ['تجهيز ملف التمويل والتفاوض', 'تمويل العقد', 'ملف الممر الأجنبي', 'تجهيز ملف عرض المستثمر والتفاوض', 'تجهيز صفقة التملّك والتفاوض'];
const PAID = ['paid', 'in_progress', 'in_follow_up', 'delivered', 'completed'];

export async function GET() {
  const store = await cookies();
  const sb = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    { cookies: { getAll: () => store.getAll(), setAll: () => {} } });
  const { data } = await sb.auth.getUser();
  if (!data?.user) return NextResponse.json({ files: [] });
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string);
  const { data: co } = await admin.from('companies').select('id').eq('user_id', data.user.id).maybeSingle();
  if (!co) return NextResponse.json({ files: [] });
  const { data: reqs } = await admin.from('service_requests').select('id, service_title, status, paid_at, created_at')
    .eq('company_id', co.id).in('status', PAID).in('service_title', FILE_SERVICES).order('created_at', { ascending: false });
  if (!reqs?.length) return NextResponse.json({ files: [] });
  const [{ data: evs }, { data: outs }, { data: pres }, { data: fees }] = await Promise.all([
    admin.from('deal_events').select('created_at').eq('company_id', co.id).eq('kind', 'file_update').order('created_at').limit(1),
    admin.from('outreach_messages').select('entity_name, sent_at').eq('company_id', co.id).not('sent_at', 'is', null),
    admin.from('deal_events').select('entity_name, created_at').eq('company_id', co.id).eq('kind', 'file_presented'),
    admin.from('success_fees').select('service_request_id, approved_logged_at, booked_at').in('service_request_id', reqs.map((r) => r.id)),
  ]);
  const norm = (s: unknown) => String(s || '').trim().toLowerCase();
  const funders = new Set([...(outs || []).map((o) => norm(o.entity_name)), ...(pres || []).map((p) => norm(p.entity_name))].filter(Boolean));
  const lastSent = [...(outs || []).map((o) => String(o.sent_at)), ...(pres || []).map((p) => String(p.created_at))].sort().pop() || null;
  const prepared = evs?.[0]?.created_at || null;
  const files = reqs.map((r) => {
    const f = (fees || []).find((x) => x.service_request_id === r.id);
    return {
      id: r.id, service: r.service_title,
      stages: [
        { key: 'prepared', label: 'جهّزنا الملف', at: prepared, done: !!prepared },
        { key: 'presented', label: funders.size ? 'عرضناه على ' + funders.size.toLocaleString('ar-SA') + ' جهات' : 'عرضه على الجهات', at: lastSent, done: funders.size > 0 },
        { key: 'approved', label: 'وافقت جهة', at: f?.approved_logged_at || null, done: !!f?.approved_logged_at },
        { key: 'disbursed', label: 'صُرف التمويل', at: f?.booked_at || null, done: !!f?.booked_at },
      ],
    };
  });
  return NextResponse.json({ files });
}
