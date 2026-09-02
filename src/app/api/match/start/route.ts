import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  const { track } = await req.json().catch(() => ({}));
  const cookieStore = await cookies();
  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string);
  const { data: co } = await admin.from('companies')
    .select('id, subscription_active, subscription_end, approved_tracks, match_credits').eq('user_id', user.id).maybeSingle();
  if (!co) return NextResponse.json({ error: 'لا يوجد ملف' }, { status: 404 });

  const tk = track === 'investment' ? 'investment' : 'funding';

  // الاشتراك أُلغي، ثم أُلغي رسم التشغيل بعده. والباقي: تشغيلة تُمنح بإذن
  // المكتب (‏/api/match/request‏). ويبقى المشتركون القدامى على حقهم.
  const legacy = co.subscription_active === true && (!co.subscription_end || new Date(co.subscription_end) > new Date());
  if (!legacy) {
    // الخصم ذرّي في القاعدة: نقرتان متتاليتان كانتا تُشغّلان مرتين بمقابل واحد
    const { data: took } = await admin.rpc('consume_match_credit', { p_company: co.id });
    if (took !== true) {
      // أُلغي رسم التشغيل. البوابة الآن إذن المكتب لا دفع العميل —
      // فالتشغيلة تكلّف، ولا تُترك مفتوحة، ولا يُطلب من العميل مالٌ عليها.
      return NextResponse.json({ error: 'لم تُفتح لك تشغيلة بعد — اطلبها ويصلك إشعار فور فتحها', needsRequest: true }, { status: 402 });
    }
  }

  // الدفع هو الإذن: لم يعد المسار الثاني يحتاج اعتماداً يدوياً،
  // فقد كان العميل يدفع ثم يُمنع من مساره حتى يفرغ المستشار لاعتماده.
  const appr = Array.isArray((co as Record<string, unknown>).approved_tracks) ? ((co as Record<string, unknown>).approved_tracks as string[]) : [];
  if (!appr.includes(tk)) {
    await admin.from('companies').update({ approved_tracks: appr.concat([tk]) }).eq('id', co.id);
  }

  const url = process.env.WORKER_URL;
  if (!url) {
    // المشغّل معطّل: تُعاد التشغيلة المخصومة، فلا يدفع العميل ثمن عطلٍ عندنا
    if (!legacy) await admin.rpc('grant_match_credit', { p_company: co.id, p_n: 1 });
    return NextResponse.json({ error: 'المشغّل غير مهيأ' }, { status: 500 });
  }

  await admin.from('companies').update({ match_notice: 'running', match_started_at: new Date().toISOString() }).eq('id', co.id);
  fetch(url + '/api/match/worker', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret: process.env.WORKER_SECRET, companyId: co.id, track }),
  }).catch(() => {});
  await new Promise(r => setTimeout(r, 1500));
  return NextResponse.json({ ok: true, started: true, done: true, count: 0 });
}
