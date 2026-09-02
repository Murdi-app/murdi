import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { demandFromMatches, readinessFromMatches } from '@/lib/gapDemand';

// ما تطلبه جهاتك — يُحسب من صفوف مطابقتك أنت، ويُعاد بلا أسماء الجهات.
//
// الاسم هو ما يُباع في الفحص السريع (٩٩٠)، فلا يخرج من هنا. أما ما ينقصك
// فيخرج كاملاً — لأنه هو الذي يجعلك تشتري بلا أن نطلب منك الشراء.

export async function GET() {
  const store = await cookies();
  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    { cookies: { getAll: () => store.getAll(), setAll: () => {} } }
  );
  const { data } = await sb.auth.getUser();
  if (!data?.user) return NextResponse.json({ demands: [], total: 0 });

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  );
  const { data: co } = await admin
    .from('companies')
    .select('id')
    .eq('user_id', data.user.id)
    .maybeSingle();
  if (!co) return NextResponse.json({ demands: [], total: 0 });

  const { data: rows } = await admin
    .from('match_results')
    .select('provider, requirements, gaps')
    .eq('company_id', co.id)
    .eq('status', 'new')
    .gt('fit_score', 0)
    .limit(400);

  const list = rows || [];
  return NextResponse.json({
    total: list.length,
    readiness: readinessFromMatches(list),
    demands: demandFromMatches(list, 3),
  });
}
