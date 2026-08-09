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
    .select('id, subscription_active, subscription_end').eq('user_id', user.id).maybeSingle();
  if (!co) return NextResponse.json({ error: 'لا يوجد ملف' }, { status: 404 });
  const active = co.subscription_active === true && (!co.subscription_end || new Date(co.subscription_end) > new Date());
  if (!active) return NextResponse.json({ error: 'يلزم تفعيل الملف' }, { status: 402 });

  const url = process.env.WORKER_URL;
  if (!url) return NextResponse.json({ error: 'المشغّل غير مهيأ' }, { status: 500 });

  await admin.from('companies').update({ match_notice: 'running' }).eq('id', co.id);
  fetch(url + '/api/match/worker', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret: process.env.WORKER_SECRET, companyId: co.id, track }),
  }).catch(() => {});
  await new Promise(r => setTimeout(r, 1500));
  return NextResponse.json({ ok: true, started: true });
}
