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

  // العتبة كانت `fit_score > 0`، وهي ليست عتبة. وفي تشغيلة واحدة قِيست:
  // ٢٢٦ صفّاً فوق الصفر، منها ٧٦ صفّاً درجتها بين ١ و١٤ — أي ضجيج لا مطابقة.
  // فكانت الشاشة تقول للعميل «أنت مؤهّل لـ٢٢٦ جهة»، وهو وعدٌ ينكشف كذبه في
  // اليوم الذي يدفع فيه ٩٩٠ ويرى الأسماء. والرقم الذي نقوله يجب أن يصمد
  // أمام ما يشتريه، فرُفعت العتبة إلى ٥٠: مطابقةٌ حكم المحرك بجدّيتها.
  const FIT_FLOOR = 50;
  const { data: rows } = await admin
    .from('match_results')
    .select('provider, requirements, gaps')
    .eq('company_id', co.id)
    .eq('status', 'new')
    .gte('fit_score', FIT_FLOOR)
    .limit(400);

  const list = rows || [];
  return NextResponse.json({
    total: list.length,
    readiness: readinessFromMatches(list),
    demands: demandFromMatches(list, 3),
  });
}
