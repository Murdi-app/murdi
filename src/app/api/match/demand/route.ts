import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { demandFromMatches, blockersFromMatches, isRejected, isFullyQualified } from '@/lib/gapDemand';

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

  // العتبة كانت `fit_score > 0`، وهي ليست عتبة. وفي تشغيلة حقيقية قِيست:
  // ٢٢٦ صفّاً فوق الصفر، منها ٧٦ درجتها بين ١ و١٤ — ضجيجٌ لا مطابقة.
  //
  // ثم كان العدّ بالصفوف، والصفّ منتجٌ لا جهة: الجهة الواحدة تظهر ثلاث مرات
  // بثلاثة منتجات فتُعدّ ثلاثاً. والعميل يسأل «كم جهة؟» لا «كم صفّاً؟».
  //
  // فصار العدّ بالجهات المختلفة، والعتبة ٣٠ — وهي الحدّ الذي يبقى فوقه
  // ما يستحق أن يُقال. ويُفرَز منها ما فوق ٥٠ باسمه: مطابقة قوية.
  const FIT_FLOOR = 30;
  const { data: rows } = await admin
    .from('match_results')
    .select('provider, product, requirements, gaps, fit_score, verdict')
    .eq('company_id', co.id)
    .eq('status', 'new')
    .gte('fit_score', FIT_FLOOR)
    .limit(500);

  // ما استبعده المحرك لا يُعدّ ولا يُعرض — ولو كانت درجته عالية.
  const list = (rows || []).filter((r) => !isRejected(r.verdict));

  const uniq = (xs: Array<string | null | undefined>) =>
    new Set(xs.map((x) => String(x || '').trim()).filter(Boolean)).size;

  // و«القوي» صار حكمَ المحرك لا عتبةً اخترعناها: «متأهل» بلا شرط.
  return NextResponse.json({
    entities: uniq(list.map((r) => r.provider)),
    strong: uniq(list.filter((r) => isFullyQualified(r.verdict)).map((r) => r.provider)),
    products: list.length,
    demands: demandFromMatches(list, 3),
    blockers: blockersFromMatches(list, 3),
  });
}
