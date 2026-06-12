import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

const MODELS = ['claude-fable-5', 'claude-sonnet-4-5-20250929'];

async function getAdmin() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (user === null || user.email !== 'hololalmurdi.fs@gmail.com') return null;
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  );
}

export async function POST(req: Request) {
  const adminClient = await getAdmin();
  if (adminClient === null) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });

  const body = await req.json();
  const { data: q } = await adminClient
    .from('client_questions')
    .select('id, question, company_id')
    .eq('id', body.id)
    .single();
  if (q === null) return NextResponse.json({ error: 'السؤال غير موجود' }, { status: 404 });

  const { data: company } = await adminClient
    .from('companies').select('company_name, sector, city').eq('id', q.company_id).single();
  const { data: fd } = await adminClient
    .from('financial_data').select('*').eq('company_id', q.company_id)
    .order('created_at', { ascending: false }).limit(1).single();

  const prompt = 'أنت تجيب نيابة عن د. عبدالحكيم المرضي — مستشار مالي سعودي خبير (دكتوراه، بورد أمريكي، 15 سنة خبرة). أسلوبه مباشر وعملي وصريح.\n\n'
    + 'سؤال من عميل:\n"' + q.question + '"\n\n'
    + 'بيانات شركة العميل (استخدمها في الجواب إن كانت ذات صلة):\n'
    + '- الشركة: ' + (company?.company_name || '—') + ' | القطاع: ' + (company?.sector || '—') + '\n'
    + '- البيانات المالية: ' + JSON.stringify(fd || {}) + '\n\n'
    + 'قواعد الهوية الصارمة (أهم من أي شيء): أنت تمثل منصة مُرضي المبنية على منهجية د. عبدالحكيم المرضي، وكل جواب يُراجع ويُعتمد من الدكتور وفريقه قبل وصوله للعميل. ممنوع نهائياً ذكر أو تلميح: ذكاء اصطناعي، نموذج، روبوت، Claude، تقنية، نظام آلي. إذا سُئلت من أنت أو هل أنت ذكاء اصطناعي أو Claude أو من يجيب: قل باختصار وثقة إن هذه إجابات فريق د. عبدالحكيم المرضي عبر منظومة مُرضي التحليلية وفق منهجيته، وتُراجع وتُعتمد قبل إصدارها — ثم انتقل فوراً لخدمة سؤاله العملي دون استفاضة في الموضوع. لا تنفِ ولا تؤكد أي تقنية، ولا تشرح كيف تعمل المنصة داخلياً. وقاعدة السرية التجارية: ممنوع ذكر أسماء جهات أو منصات أو برامج تمويل كقنوات تقديم — قل إن الترشيح يتم عبر شبكة مُرضي بعد اكتمال الملف. يجوز ذكر الجهات التنظيمية فقط (سمة، هيئة المراجعين، هيئة الزكاة) كمتطلبات إجرائية.\n\nاكتب جواباً احترافياً (150-400 كلمة حسب حاجة السؤال): مباشر، مخصص لوضعهم، بخطوات عملية إن لزم. أكمل الجواب حتى نهايته ولا تتوقف في المنتصف. بدون مقدمات مطولة وبدون عناوين Markdown — نص متصل فقط.';

  for (const model of MODELS) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY as string,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({ model, max_tokens: 3000, messages: [{ role: 'user', content: prompt }] }),
      });
      if (!res.ok) continue;
      const data = await res.json();
      const text = (data.content || [])
        .filter((b: { type: string }) => b.type === 'text')
        .map((b: { text: string }) => b.text)
        .join('');
      if (text && text.length > 30) {
        await adminClient.from('client_questions')
          .update({ answer: text, status: 'answered', answered_at: new Date().toISOString() })
          .eq('id', q.id);
        return NextResponse.json({ ok: true, answer: text });
      }
    } catch { continue; }
  }
  return NextResponse.json({ error: 'فشل التوليد' }, { status: 500 });
}

export async function PATCH(req: Request) {
  const adminClient = await getAdmin();
  if (adminClient === null) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });

  const body = await req.json();

  if (body.type === 'release_answer') {
    await adminClient.from('client_questions')
      .update({ status: 'released', released_at: new Date().toISOString() })
      .eq('id', body.id);
    return NextResponse.json({ ok: true });
  }

  if (body.type === 'approve_edit') {
    await adminClient.from('edit_requests')
      .update({ status: 'approved', approved_at: new Date().toISOString() })
      .eq('id', body.id);
    return NextResponse.json({ ok: true });
  }

  if (body.type === 'reject_edit') {
    await adminClient.from('edit_requests')
      .update({ status: 'rejected' })
      .eq('id', body.id);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'نوع غير معروف' }, { status: 400 });
}

export async function GET() {
  const adminClient = await getAdmin();
  if (adminClient === null) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });

  const { data: questions } = await adminClient
    .from('client_questions')
    .select('id, question, answer, status, created_at, companies(company_name)')
    .order('created_at', { ascending: false });

  const { data: edits } = await adminClient
    .from('edit_requests')
    .select('id, reason, status, created_at, companies(company_name)')
    .order('created_at', { ascending: false });

  return NextResponse.json({ questions: questions || [], edits: edits || [] });
}
