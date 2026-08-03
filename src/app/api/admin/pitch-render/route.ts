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

  let body = raw;
  let coEn = '';
  if (lang === 'en') {
    const tp = 'Translate the following Arabic investor pitch deck into professional institutional English.\n\n'
      + 'STRICT RULES:\n'
      + '1) Keep every [[SLIDE]] marker exactly as it is, on its own line, in the same positions.\n'
      + '2) Translate the line starting with «الرقم المحوري:» as a line starting exactly with "Key figure:".\n'
      + '3) Keep the separator lines and everything after them (the advisor notes section) in ARABIC, untranslated — that section is internal.\n'
      + '4) Do not add, drop, merge or reorder any slide, bullet or figure. Numbers stay identical.\n'
      + '5) Write the English of an investment banker: concrete, tight, no marketing filler.\n'
      + '6) Start your output with a single line: COMPANY_EN: <the company name in English or transliteration>, then a blank line, then the translated document. Nothing else before it.\n\n'
      + raw;
    for (const model of ['claude-opus-4-8', 'claude-sonnet-4-6']) {
      try {
        const r = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY as string, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({ model, max_tokens: 8000, messages: [{ role: 'user', content: tp }] }),
        });
        if (!r.ok) continue;
        const d = await r.json();
        const out = (d?.content || []).map((x: { text?: string }) => x.text || '').join('').trim();
        if (out && out.includes('[[SLIDE]]')) {
          const m = out.match(/^COMPANY_EN:\s*(.+)$/m);
          if (m) { coEn = m[1].trim(); }
          body = out.replace(/^COMPANY_EN:.*$/m, '').trim();
          break;
        }
      } catch {}
    }
    if (body === raw) return NextResponse.json({ error: 'تعذّرت الترجمة — أعد المحاولة' }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    deckHtml: buildDeckHTML(body, (lang === 'en' && coEn) ? coEn : co, subtitle || (lang === 'en' ? 'Investment Offering' : 'عرض استثماري'), lang),
    notesHtml: lang === 'en' ? '' : buildNotesHTML(raw, co, 'ar'),
  });
}
