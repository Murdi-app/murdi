import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { runDailyHunt } from '@/lib/dailyHunt';

export const maxDuration = 300;

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

// GET ?date=YYYY-MM-DD : جلب جولة يوم (افتراضياً اليوم)
export async function GET(req: Request) {
  const admin = await getAdmin();
  if (admin === null) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  const url = new URL(req.url);
  const savedOnly = url.searchParams.get('saved') === 'true';
  const date = url.searchParams.get('date') || new Date().toISOString().slice(0, 10);
  if (savedOnly) {
    const { data } = await admin
      .from('daily_leads')
      .select('*')
      .eq('saved', true)
      .order('created_at', { ascending: false });
    return NextResponse.json({ leads: data || [], date: 'saved' });
  }
  const { data } = await admin
    .from('daily_leads')
    .select('*')
    .eq('hunt_date', date)
    .order('category', { ascending: true });
  return NextResponse.json({ leads: data || [], date });
}

// POST : تشغيل جولة صيد جديدة لليوم
export async function POST() {
  const admin = await getAdmin();
  if (admin === null) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  try {
    const result = await runDailyHunt();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'فشل الصيد' }, { status: 500 });
  }
}
