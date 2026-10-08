import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { miniLures } from '@/lib/lures';

// طُعم التقييم المختصر للزائر — أعدادٌ مجمّعة بلا أسماء ولا بيانات عميل، فيُتاح بلا تسجيل.
export const revalidate = 600;

export async function GET(req: Request) {
  const rev = Number(new URL(req.url).searchParams.get('rev'));
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string);
  const r = await miniLures(admin, Number.isInteger(rev) ? rev : -1);
  return NextResponse.json({ ok: true, ...r });
}
