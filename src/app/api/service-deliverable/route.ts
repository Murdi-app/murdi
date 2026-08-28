import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

// تسليم محتوى الخدمة للعميل — بعد الدفع والتسليم فقط.
// العمود ممنوع على مفتاح المتصفح (REVOKE)، فهذه هي البوابة الوحيدة إليه،
// وهي تتحقق من أمرين قبل أن تُخرج حرفاً: أن الطلب لهذا العميل، وأن حالته تسمح.
const RELEASED = ['delivered', 'completed'];

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get('id') || '';
  if (!id) return NextResponse.json({ error: 'id مطلوب' }, { status: 400 });

  const store = await cookies();
  const ss = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    { cookies: { getAll: () => store.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await ss.auth.getUser();
  if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  );
  const { data: sr } = await admin.from('service_requests')
    .select('id, company_id, status, admin_deliverable, service_title')
    .eq('id', id).maybeSingle();
  if (!sr) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });

  // ملكية الطلب تُتحقق من الشركة المرتبطة بحساب المستخدم، لا من رقم يُرسله
  const { data: co } = await admin.from('companies')
    .select('id').eq('user_id', user.id).eq('id', sr.company_id).maybeSingle();
  if (!co) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });

  if (!RELEASED.includes(String(sr.status))) {
    return NextResponse.json({ error: 'لم تُسلَّم هذه الخدمة بعد' }, { status: 402 });
  }
  return NextResponse.json({ ok: true, title: sr.service_title, deliverable: sr.admin_deliverable || '' });
}
