import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { buildDeckHTML, buildNotesHTML } from '@/lib/pitchDeck';

const ADMIN_EMAIL = 'hololalmurdi.fs@gmail.com';

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await sb.auth.getUser();
  if (!user || user.email !== ADMIN_EMAIL) return NextResponse.json({ error: 'غير مصرّح' }, { status: 403 });

  let requestId = '', text = '', lang: 'ar' | 'en' = 'ar', subtitle = '';
  try {
    const b = await req.json();
    requestId = String(b.requestId || '');
    text = String(b.text || '');
    lang = b.lang === 'en' ? 'en' : 'ar';
    subtitle = String(b.subtitle || '');
  } catch { return NextResponse.json({ error: 'طلب غير صالح' }, { status: 400 }); }
  if (!requestId) return NextResponse.json({ error: 'requestId مطلوب' }, { status: 400 });

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  );
  const { data: sr } = await admin.from('service_requests')
    .select('admin_deliverable, companies(company_name)').eq('id', requestId).single();
  if (!sr) return NextResponse.json({ error: 'الطلب غير موجود' }, { status: 404 });

  const raw = text.trim() || String(sr.admin_deliverable || '');
  if (!raw) return NextResponse.json({ error: 'لا يوجد محتوى — جهّز الخدمة أولاً' }, { status: 400 });
  const co = (sr.companies as unknown as { company_name?: string } | null)?.company_name || 'الشركة';

  return NextResponse.json({
    ok: true,
    deckHtml: buildDeckHTML(raw, co, subtitle || 'عرض استثماري', lang),
    notesHtml: buildNotesHTML(raw, co, lang),
  });
}
