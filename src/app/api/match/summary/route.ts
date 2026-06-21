import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

// مسار خفيف: يقرأ عدد الفرص المحفوظة للعميل (بلا بحث، بلا إيميل)
export async function GET(req: Request) {
  const track = new URL(req.url).searchParams.get('track') || 'funding';
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (user === null) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

  const { data: company } = await supabase
    .from('companies')
    .select('id')
    .eq('user_id', user.id)
    .single();
  if (company === null) return NextResponse.json({ match_count: 0, matches: [] });

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  );
  const { data: rows, count } = await admin
    .from('match_results')
    .select('region', { count: 'exact' })
    .eq('company_id', company.id)
    .eq('track', track);

  // للعميل: العدد فقط + بطاقات عامة (بلا أسماء الجهات — تبقى سرية لك في الأدمن)
  const total = count || (rows?.length ?? 0);
  const matches = Array.from({ length: Math.min(total, 6) }).map((_, i) => ({
    funding_type: 'فرصة مطابقة',
    fit_percent: 92 - i * 3,
    reasons: ['الشروط المعلنة تتطابق مع ملف شركتك'],
    next_step: 'فريق مُرضي سيتولى التواصل وتجهيز ملفك',
  }));
  return NextResponse.json({ match_count: total, matches });
}
