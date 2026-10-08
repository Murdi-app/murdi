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
  const { data: reqs } = await admin.from('service_requests').select('id, service_title, status, paid_at, created_at, delivered_at')
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
  // ★ ٨ أكتوبر (المالك): الاستثمار مرحلتان لا أربع — عقده يجعل مخاطبة المستثمرين للعميل وحده،
  //   فلا يُذكر له عرضٌ على جهة ولا موافقة: «جهّزنا العرض والملف» ← «سلّمناك قائمة المستثمرين».
  const INVEST = 'تجهيز ملف عرض المستثمر والتفاوض';
  let invList: { at: string | null; done: boolean } = { at: null, done: false };
  if (reqs.some((r) => r.service_title === INVEST)) {
    const [{ data: c2 }, { data: im }] = await Promise.all([
      admin.from('companies').select('approved_tracks').eq('id', co.id).maybeSingle(),
      admin.from('match_results').select('created_at').eq('company_id', co.id).eq('track', 'investment').eq('status', 'new').gt('fit_score', 0).order('created_at', { ascending: false }).limit(1),
    ]);
    const shown = Array.isArray(c2?.approved_tracks) && (c2.approved_tracks as string[]).includes('investment') && !!im?.length;
    invList = { at: shown ? String(im![0].created_at) : null, done: shown };
  }
  const files = reqs.map((r) => {
    const f = (fees || []).find((x) => x.service_request_id === r.id);
    if (r.service_title === INVEST) {
      const prep = r.delivered_at || prepared;
      return { id: r.id, service: r.service_title, stages: [
        { key: 'prepared', label: 'جهّزنا العرض والملف', at: prep, done: !!prep },
        { key: 'list', label: 'سلّمناك قائمة المستثمرين', at: invList.at, done: invList.done },
      ] };
    }
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
