import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  const { track } = await req.json().catch(() => ({}));
  const cookieStore = await cookies();
  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string);
  const { data: co } = await admin.from('companies')
    .select('id, subscription_active, subscription_end, approved_tracks').eq('user_id', user.id).maybeSingle();
  if (!co) return NextResponse.json({ error: 'لا يوجد ملف' }, { status: 404 });
  const active = co.subscription_active === true && (!co.subscription_end || new Date(co.subscription_end) > new Date());
  if (!active) return NextResponse.json({ error: 'يلزم تفعيل الملف' }, { status: 402 });

  const tk = track === 'investment' ? 'investment' : 'funding';
  const appr = Array.isArray((co as Record<string, unknown>).approved_tracks) ? ((co as Record<string, unknown>).approved_tracks as string[]) : [];
  if (!appr.includes(tk)) {
    const { data: prev } = await admin.from('match_results')
      .select('track').eq('company_id', co.id).neq('track', tk).limit(1);
    if (prev && prev.length > 0) {
      await admin.from('companies')
        .update({ track_request: tk, track_request_at: new Date().toISOString() }).eq('id', co.id);
      return NextResponse.json({ error: 'أرسلنا طلبك لفريق مُرضي لفتح هذا المسار — سنبلغك فور الموافقة' }, { status: 403 });
    }
    await admin.from('companies').update({ approved_tracks: appr.concat([tk]) }).eq('id', co.id);
  }
  const url = process.env.WORKER_URL;
  if (!url) return NextResponse.json({ error: 'المشغّل غير مهيأ' }, { status: 500 });

  await admin.from('companies').update({ match_notice: 'running', match_started_at: new Date().toISOString() }).eq('id', co.id);
  fetch(url + '/api/match/worker', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret: process.env.WORKER_SECRET, companyId: co.id, track }),
  }).catch(() => {});
  await new Promise(r => setTimeout(r, 1500));
  return NextResponse.json({ ok: true, started: true, done: true, count: 0 });
}
