import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

const ADMIN_EMAIL = 'hololalmurdi.fs@gmail.com';
const MODELS = ['claude-opus-4-8', 'claude-sonnet-4-6'];

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await sb.auth.getUser();
  if (!user || user.email !== ADMIN_EMAIL) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });

  const body = await req.json();
  const { requestId } = body;
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  );

  const { data: sr } = await admin.from('service_requests').select('*, companies(company_name, sector)').eq('id', requestId).single();
  if (!sr) return NextResponse.json({ error: 'الطلب غير موجود' }, { status: 404 });

  const companyId = sr.company_id;
  const { data: fd } = await admin.from('financial_data').select('*').eq('company_id', companyId).order('created_at', { ascending: false }).limit(1).maybeSingle();
  const { data: rr } = await admin.from('readiness_results').select('*').eq('company_id', companyId).order('created_at', { ascending: false }).limit(1).maybeSingle();

  const companyName = (sr.companies as { company_name?: string })?.company_name || 'الشركة';
  const sector = (sr.companies as { sector?: string })?.sector || 'غير محدد';

  const prompt = 'أنت تكتب نيابةً عن د. عبدالحكيم المرضي — مستشار مالي سعودي معتمد، دكتوراه إدارة أعمال، عضوية البورد الأمريكي، 15 سنة خبرة، عبر شركة حلول المرضي للاستشارات المالية. '
    + 'مهمتك: تجهيز مخرَج خدمة "' + sr.service_title + '" لشركة "' + companyName + '" (قطاع: ' + sector + ') بشكل احترافي دقيق جاهز للتسليم للعميل.\\n\\n'
    + 'بيانات الشركة المالية: ' + JSON.stringify(fd || {}) + '\\n'
    + 'نتيجة تقييم الجاهزية: ' + JSON.stringify(rr || {}) + '\\n\\n'
    + 'اكتب وثيقة الخدمة كاملة ومتقنة، مبنية على أرقام الشركة الفعلية، عملية وقابلة للتنفيذ، مرتّبة بعناوين وخطوات واضحة. '
    + 'اكتبها بصيغة وثيقة رسمية صادرة عن حلول المرضي للاستشارات المالية، بلا أي إشارة لذكاء اصطناعي أو تقنية. '
    + 'ابدأ مباشرة بمحتوى الوثيقة بصيغة نصية واضحة (يمكن استخدام عناوين بخطوط وفواصل)، واختم بسطر: "صادر عن: د. عبدالحكيم المرضي — حلول المرضي للاستشارات المالية".';

  for (const model of MODELS) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY as string, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model, max_tokens: 5000, messages: [{ role: 'user', content: prompt }] }),
      });
      if (!res.ok) continue;
      const data = await res.json();
      const text = (data.content || []).filter((b: { type: string }) => b.type === 'text').map((b: { text: string }) => b.text).join('').trim();
      if (text.length > 80) {
        await admin.from('service_requests').update({ admin_deliverable: text, status: 'in_progress', updated_at: new Date().toISOString() }).eq('id', requestId);
        return NextResponse.json({ ok: true, deliverable: text });
      }
    } catch {}
  }
  return NextResponse.json({ error: 'فشل التجهيز' }, { status: 500 });
}
