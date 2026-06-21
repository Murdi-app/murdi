import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

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

export async function GET(req: Request) {
  const admin = await getAdmin();
  if (admin === null) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  const companyId = new URL(req.url).searchParams.get('company_id');
  if (!companyId) return NextResponse.json({ error: 'company_id مطلوب' }, { status: 400 });
  const { data } = await admin
    .from('admin_research_chat')
    .select('id, role, content, created_at')
    .eq('company_id', companyId)
    .order('created_at', { ascending: true });
  return NextResponse.json({ messages: data || [] });
}

export async function POST(req: Request) {
  const admin = await getAdmin();
  if (admin === null) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const companyId: string = body?.company_id || '';
  const message: string = (body?.message || '').trim();
  if (!companyId || !message) return NextResponse.json({ error: 'company_id والرسالة مطلوبان' }, { status: 400 });

  await admin.from('admin_research_chat').insert({ company_id: companyId, role: 'admin', content: message });

  const { data: company } = await admin.from('companies').select('company_name, sector, city, cr_number').eq('id', companyId).single();
  const { data: fd } = await admin.from('financial_data').select('*').eq('company_id', companyId).order('created_at', { ascending: false }).limit(1).single();
  const { data: matches } = await admin.from('match_results').select('track, region, provider, product, requirements, fit, source').eq('company_id', companyId).order('created_at', { ascending: false });
  const { data: history } = await admin.from('admin_research_chat').select('role, content').eq('company_id', companyId).order('created_at', { ascending: true });

  const matchesText = (matches || []).map((m, i) =>
    (i + 1) + '. [' + m.track + ' | ' + m.region + '] ' + m.provider + ' — ' + m.product + ' | الشروط: ' + (m.requirements || '—') + ' | الملاءمة: ' + (m.fit || '—') + (m.source ? ' | المصدر: ' + m.source : '')
  ).join('\n') || 'لا توجد جهات مطابقة محفوظة بعد.';

  const sysContext = 'أنت "مُرضي" — مساعد البحث المالي الخبير لـ د. عبدالحكيم المرضي (حلول المرضي للاستشارات المالية، السعودية). '
    + 'هذه محادثة خاصة بالأدمن (د. عبدالحكيم) فقط — لا يراها العميل. مهمتك: مساعدته في التعمّق في جهات التمويل والاستثمار والطرح بدقّة عالية. '
    + 'يمكنك البحث في الويب عند الحاجة (تفاصيل جهة، منتجاتها، مقرّها، طريقة التواصل، أو إيجاد جهات إضافية). كن دقيقاً ومحدداً ومهنياً، وتكلم بالعربية الخليجية باحترافية. '
    + 'إذا طلب تفاصيل جهة معيّنة، ابحث وأعطِ: المقر، المنتجات التمويلية/الاستثمارية بالتفصيل، شروط الأهلية، وطريقة التواصل العملية (موقع/بريد/هاتف رسمي). '
    + 'إذا طلب جهات إضافية، ابحث وأضف جهات حقيقية مناسبة لهذه الشركة تحديداً.\n\n'
    + '=== ملف الشركة ===\n'
    + 'الاسم: ' + (company?.company_name || '—') + ' | القطاع: ' + (company?.sector || '—') + ' | المدينة: ' + (company?.city || '—') + ' | السجل: ' + (company?.cr_number || '—') + '\n'
    + 'البيانات المالية: ' + JSON.stringify(fd || {}) + '\n\n'
    + '=== الجهات المطابقة الحالية (' + (matches?.length || 0) + ') ===\n' + matchesText;

  const convo = (history || []).map((h) => ({ role: h.role === 'admin' ? 'user' : 'assistant', content: h.content as string }));

  let answer = '';
  let diag = '';
  for (const model of ['claude-opus-4-8', 'claude-sonnet-4-6']) {
    try {
      const messages: { role: string; content: unknown }[] = [
        { role: 'user', content: sysContext + '\n\n=== سؤال الأدمن ===\n' + message },
      ];
      if (convo.length > 1) {
        messages.length = 0;
        messages.push({ role: 'user', content: sysContext + '\n\nابدأ المحادثة بناءً على ما يلي.' });
        messages.push({ role: 'assistant', content: 'تمام يا دكتور، جاهز. اسألني عن أي جهة أو اطلب جهات إضافية.' });
        for (const c of convo) messages.push(c);
      }
      let text = '';
      for (let turn = 0; turn < 8; turn++) {
        let res: Response | null = null;
        for (let attempt = 0; attempt < 4; attempt++) {
          res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY as string, 'anthropic-version': '2023-06-01' },
            body: JSON.stringify({ model, max_tokens: 6000, messages, tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 8 }] }),
          });
          if (res.ok) break;
          if (res.status === 429 || res.status === 529 || res.status >= 500) { await new Promise((r) => setTimeout(r, 2500 * (attempt + 1))); continue; }
          break;
        }
        if (!res || !res.ok) { diag = model + ' HTTP ' + (res ? res.status : 'null'); break; }
        const data = await res.json();
        const content = (data.content || []) as { type: string; text?: string }[];
        text += content.filter((b) => b.type === 'text').map((b) => b.text || '').join('');
        if (data.stop_reason === 'pause_turn') { messages.push({ role: 'assistant', content: data.content }); continue; }
        break;
      }
      text = text.trim();
      if (text.length > 20) { answer = text; break; }
    } catch (e) { diag = model + ' خطأ: ' + (e instanceof Error ? e.message : String(e)); }
  }

  if (!answer) answer = 'تعذّر إكمال البحث الآن' + (diag ? ' (' + diag + ')' : '') + '. حاول مرة أخرى.';

  await admin.from('admin_research_chat').insert({ company_id: companyId, role: 'murdi', content: answer });

  return NextResponse.json({ answer });
}
