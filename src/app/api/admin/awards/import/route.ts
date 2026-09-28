import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/requireAdmin';
import { importAwardsFromNews } from '@/lib/awardsImport';

// «استورد الآن» من شاشة الترسيات — للمالك، وبنافذة أسبوع.
export const maxDuration = 60;

export async function POST() {
  const denied = await requireAdmin();
  if (denied) return NextResponse.json({ error: denied }, { status: 401 });
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string);
  try {
    const r = await importAwardsFromNews(sb, 7);
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'تعذّر الاستيراد' }, { status: 500 });
  }
}
