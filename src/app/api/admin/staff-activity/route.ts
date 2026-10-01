import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/requireAdmin';
import { riyadhDate } from '@/lib/staffBrief';

// نشاط الموظفتين يوماً بيوم — للمالك وحده. المصدر الدالة `staff_activity` في القاعدة
// (hot_touches + award_touches)؛ وما لا يُسجَّل في المنصة لا يظهر هنا.
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const denied = await requireAdmin();
  if (denied) return NextResponse.json({ error: denied }, { status: 401 });
  const days = Math.min(30, Math.max(1, Number(new URL(req.url).searchParams.get('days') || 7)));
  const to = riyadhDate();
  const from = new Date(Date.parse(to + 'T00:00:00Z') - (days - 1) * 86400_000).toISOString().slice(0, 10);
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string);
  const { data, error } = await sb.rpc('staff_activity', { p_from: from, p_to: to });
  if (error) return NextResponse.json({ error: 'تعذّرت قراءة النشاط — ' + error.message }, { status: 500 });
  return NextResponse.json({ ok: true, from, to, rows: data || [] });
}
