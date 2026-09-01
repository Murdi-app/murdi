import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/requireAdmin';
import { buildCreditMemo, memoGaps, MEMO_CSS } from '@/lib/creditMemo';

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

  if (url.searchParams.get('as') === 'json') {
    return NextResponse.json({ ok: true, company: company.company_name, gaps });
  }

  const html = `<!doctype html><html lang="ar" dir="rtl"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>ملف غرض التمويل — ${String(company.company_name || '')}</title>
<style>${MEMO_CSS}</style></head><body>
${buildCreditMemo(company, fin)}
</body></html>`;

  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
