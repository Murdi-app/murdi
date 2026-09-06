import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

// وثائق يُسلّمها المكتب للعميل خارج الخدمات المدفوعة — قراءة أولية أو ملاحظة.
//
// بلا `id` تُعاد القائمة (عنوان وتاريخ فقط)، ومعه يُعاد المتن.
// والمتن ممنوع على مفتاح المتصفح (REVOKE)، فهذه بوابته الوحيدة — وهي تتحقق
// من أن الوثيقة تخصّ منشأة صاحب الجلسة قبل أن تُخرج حرفاً، كما في مسار
// مخرجات الخدمات حرفاً بحرف.

const admin = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  );

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get('id') || '';

  const store = await cookies();
  const ss = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    { cookies: { getAll: () => store.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await ss.auth.getUser();
  if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

  const sb = admin();
  const { data: co } = await sb.from('companies').select('id').eq('user_id', user.id).maybeSingle();
  if (!co) return NextResponse.json({ ok: true, documents: [] });

  if (!id) {
    const { data } = await sb.from('client_documents')
      .select('id, title, kind, created_at')
      .eq('company_id', co.id)
      .order('created_at', { ascending: false })
      .limit(20);
    return NextResponse.json({ ok: true, documents: data || [] });
  }

  // الملكية تُتحقق بالمنشأة لا برقمٍ يُرسله المتصفح
  const { data: doc } = await sb.from('client_documents')
    .select('id, title, body, company_id')
    .eq('id', id).maybeSingle();
  if (!doc || doc.company_id !== co.id) {
    return NextResponse.json({ error: 'غير موجود' }, { status: 404 });
  }

  // أول فتحة تُسجَّل، فيعرف المكتب أنها قُرئت ولا يعيد إرسالها
  await sb.from('client_documents').update({ seen_at: new Date().toISOString() })
    .eq('id', id).is('seen_at', null);

  return NextResponse.json({ ok: true, title: doc.title, body: doc.body });
}
