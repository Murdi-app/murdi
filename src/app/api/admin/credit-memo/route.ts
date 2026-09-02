import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/requireAdmin';
import { buildCreditMemo, memoGaps, MEMO_CSS } from '@/lib/creditMemo';
import { demandFromMatches, readinessFromMatches, readinessLine } from '@/lib/gapDemand';

// ملف غرض التمويل يُولَّد من القاعدة لا يُكتب باليد.
// GET ?company_id=…            → صفحة كاملة للطباعة أو الإرسال
// GET ?company_id=…&as=json    → الفجوات فقط، لعرضها في لوحة الصفقة

const admin = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

export async function GET(req: Request) {
  const denied = await requireAdmin();
  if (denied) return NextResponse.json({ error: denied }, { status: 401 });

  const url = new URL(req.url);
  const companyId = url.searchParams.get('company_id') || '';
  if (!companyId) return NextResponse.json({ error: 'company_id مطلوب' }, { status: 400 });

  const sb = admin();
  const { data: company, error: cErr } = await sb
    .from('companies')
    .select('company_name, cr_number, city, sector, owner_name')
    .eq('id', companyId).maybeSingle();
  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });
  if (!company) return NextResponse.json({ error: 'منشأة غير موجودة' }, { status: 404 });

  const { data: fin } = await sb
    .from('financial_data')
    .select('*')
    .eq('company_id', companyId)
    .order('updated_at', { ascending: false })
    .limit(1).maybeSingle();

  if (!fin) {
    return NextResponse.json(
      { error: 'لا يوجد ملف مالي لهذه المنشأة — لا يُبنى ملف ائتماني على فراغ' },
      { status: 422 }
    );
  }

  const gaps = memoGaps(fin);

  // موقفه أمام جهاته — يُحسب من صفوف مطابقته لا من تقدير.
  // «مؤهّل لتسع، جاهز لاثنتين» أوجع سطر يقرؤه، وأصدقه.
  const { data: mrows } = await sb
    .from('match_results')
    .select('provider, requirements, gaps')
    .eq('company_id', companyId)
    .eq('status', 'new')
    .gt('fit_score', 0)
    .limit(400);
  const matches = mrows || [];
  const readiness = readinessFromMatches(matches);
  const demands = demandFromMatches(matches, 4);
  const standing = readinessLine(readiness);

  if (url.searchParams.get('as') === 'json') {
    return NextResponse.json({ ok: true, company: company.company_name, gaps, readiness, demands });
  }

  // لا يُطبع القسم إن لم يكن هناك ما يُقاس — الفراغ لا يُزيَّن
  const standingHtml = standing
    ? `<section class="sec">
  <h2>موقفك أمام جهاتك</h2>
  <p class="standing">${standing}</p>
  ${readiness.blocked > 0
    ? `<p class="blocked">و${readiness.blocked} جهة بابها مفتوح لك، ويوقفك عندها نقصٌ قابل للإصلاح:</p>`
    : ''}
  ${demands.length
    ? '<ul class="demands">' + demands.map((d) =>
        `<li><b>${d.entities} من ${readiness.total} جهة تطلب ${d.demand}</b><br><span>${d.consequence}</span></li>`
      ).join('') + '</ul>'
    : ''}
  <p class="note">هذه الأرقام معدودة من شروط الجهات التي طوبقت على ملفك، لا من تقدير.</p>
</section>`
    : '';

  const html = `<!doctype html><html lang="ar" dir="rtl"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>ملف غرض التمويل — ${String(company.company_name || '')}</title>
<style>${MEMO_CSS}
.standing{font-size:19px;font-weight:900;color:#1A3D34;margin:0 0 8px;line-height:1.7}
.blocked{color:#B4622A;font-weight:800;font-size:14px;margin:0 0 8px}
.demands{margin:0 0 10px;padding-inline-start:20px}
.demands li{margin-bottom:8px;font-size:13.5px;line-height:1.8}
.demands li span{color:#5E7C73}
.note{color:#5E7C73;font-size:12px;margin:0}</style></head><body>
${buildCreditMemo(company, fin)}
${standingHtml}
</body></html>`;

  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
