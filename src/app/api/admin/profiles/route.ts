import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (user === null || user.email !== 'hololalmurdi.fs@gmail.com') {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  );

  const { data: companies } = await admin
    .from('companies')
    .select('id, company_name, cr_number, sector, phone, city')
    .eq('account_status', 'active')
    .order('created_at', { ascending: false });

  if (!companies) return NextResponse.json({ profiles: [] });

  const profiles = [];
  for (const c of companies) {
    const { data: rr } = await admin
      .from('readiness_results')
      .select('readiness_score, verdict, top_obstacles, improvement_plan, months_to_ready, eligibility_analysis, valuation_estimate, created_at')
      .eq('company_id', c.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const { data: fd } = await admin
      .from('financial_data')
      .select('assessment_type, annual_revenue, net_profit, revenue_growth, has_debt, remaining_debt, repayment_status')
      .eq('company_id', c.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!rr && !fd) continue;

    const rev = Number(fd?.annual_revenue) || 0;
    const profit = Number(fd?.net_profit) || 0;
    const growth = fd?.revenue_growth || '';
    const aType = fd?.assessment_type || 'funding';
    let valLo = 0, valHi = 0, valBasis = 'none';
    if (profit > 0) {
      let ml = aType === 'ipo' ? 6 : 4;
      let mh = aType === 'ipo' ? 8 : 5;
      if (growth === 'high') { ml = aType === 'ipo' ? 8 : 6; mh = aType === 'ipo' ? 10 : 8; }
      else if (growth === 'medium') { ml = aType === 'ipo' ? 7 : 5; mh = aType === 'ipo' ? 9 : 6; }
      valLo = profit * ml; valHi = profit * mh; valBasis = 'profit';
    } else if (rev > 0) {
      valBasis = 'loss';
    }
    // تفضيل تقييم Claude المحفوظ إن وُجد
    let valNote = '';
    if (rr?.valuation_estimate) {
      try {
        const v = JSON.parse(rr.valuation_estimate);
        if (typeof v.lo === 'number' && typeof v.hi === 'number' && v.hi > 0) {
          valLo = v.lo; valHi = v.hi; valBasis = 'profit'; valNote = v.note || '';
        }
      } catch {}
    }

    profiles.push({
      company: c,
      assessment_type: aType,
      score: rr?.readiness_score ?? null,
      verdict: rr?.verdict ?? null,
      obstacles: rr?.top_obstacles ?? [],
      plan: rr?.improvement_plan ?? [],
      months_to_ready: rr?.months_to_ready ?? null,
      eligibility: rr?.eligibility_analysis ?? null,
      rev, profit, growth,
      has_debt: fd?.has_debt ?? null,
      remaining_debt: Number(fd?.remaining_debt) || 0,
      repayment_status: fd?.repayment_status ?? null,
      val_lo: valLo, val_hi: valHi, val_basis: valBasis, val_note: valNote,
      assessed_at: rr?.created_at ?? null,
    });
  }

  return NextResponse.json({ profiles });
}
