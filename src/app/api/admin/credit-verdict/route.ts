import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/requireAdmin';
import { buildCreditVerdict, VERDICT_CSS, type VerdictMatch } from '@/lib/creditVerdict';

// توليد «الحكم الائتماني» — مخرَج الفحص السريع (٩٩٠) على مسار التمويل.
//
// وخلافاً لـ generate-file الذي كان يفتح الوثيقة في متصفح المالك وحده،
// هذا يكتبها في `admin_deliverable` — فيراها العميل بزرّ «طباعة الخدمة»
// في حسابه متى أفرجتَ عنها. لأن ما لا يصل إلى حساب العميل لم يُسلَّم.
//
// ولا يُفرج تلقائياً: يُحفظ بحالة in_progress، وتبقى «سلّم» بيدك — فوثيقة
// تحمل توقيعك لا تخرج قبل أن تقرأها.

const admin = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  );

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return NextResponse.json({ error: denied }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const requestId = String(b?.requestId || '');
  if (!requestId) return NextResponse.json({ error: 'requestId مطلوب' }, { status: 400 });

  const sb = admin();

  const { data: sr } = await sb
    .from('service_requests')
    .select('id, company_id, service_title, option_key, client_inputs, status')
    .eq('id', requestId)
    .maybeSingle();
  if (!sr) return NextResponse.json({ error: 'الطلب غير موجود' }, { status: 404 });

  const { data: co } = await sb
    .from('companies')
    .select('company_name, cr_number, city, sector, owner_name')
    .eq('id', sr.company_id)
    .maybeSingle();
  if (!co) return NextResponse.json({ error: 'المنشأة غير موجودة' }, { status: 404 });

  const { data: fd } = await sb
    .from('financial_data')
    .select('*')
    .eq('company_id', sr.company_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!fd) return NextResponse.json({ error: 'لا توجد بيانات مالية لهذه المنشأة' }, { status: 422 });

  // طبقة التصحيح تسبق مُدخَل العميل — كما في بقية المخرجات، فلا تتناقض
  // وثيقتان خرجتا من مكتب واحد.
  const { data: corr } = await sb
    .from('admin_corrections')
    .select('*')
    .eq('company_id', sr.company_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const fin: Record<string, unknown> = {
    ...fd,
    ...(corr?.original_loan_amount != null ? { original_loan_amount: corr.original_loan_amount, total_financing: corr.original_loan_amount } : {}),
    ...(corr?.debt_remaining != null ? { debt_remaining: corr.debt_remaining, remaining_debt: corr.debt_remaining } : {}),
    ...(corr?.annual_revenue != null ? { annual_revenue: corr.annual_revenue } : {}),
  };

  // نفس مصفاة شاشة العميل حرفياً: ما يُعدّ له على الشاشة هو ما يُسمّى له
  // في الوثيقة، وإلا رأى رقماً ثم استلم غيره.
  const { data: rows } = await sb
    .from('match_results')
    .select('provider, product, instrument, fit_score, verdict, amount_range, timeline, evidence_grade, apply_channel, apply_url, link_status, required_docs, requirements, gaps')
    .eq('company_id', sr.company_id)
    .eq('status', 'new')
    .eq('track', 'funding')
    .gte('fit_score', 30)
    .order('fit_score', { ascending: false });

  const kept = (rows || []).filter((r) => !/غير مناسب|مستبعد/.test(String(r.verdict || '')));

  // الجهة تُذكر مرة واحدة بأفضل صفوفها — والعميل يعدّ الجهات لا الصفوف
  const byProvider = new Map<string, VerdictMatch>();
  for (const r of kept) {
    const key = String(r.provider || '').trim();
    if (!key) continue;
    const prev = byProvider.get(key);
    if (!prev || (Number(r.fit_score) || 0) > (Number(prev.fit_score) || 0)) byProvider.set(key, r as VerdictMatch);
  }
  const matches = [...byProvider.values()];

  const inner = buildCreditVerdict(co, fin, matches);
  const html = '<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<title>الحكم الائتماني — ' + String(co.company_name || '') + '</title>'
    + '<style>' + VERDICT_CSS + '</style></head><body>' + inner + '</body></html>';

  const { error } = await sb
    .from('service_requests')
    .update({ admin_deliverable: html, status: 'in_progress', updated_at: new Date().toISOString() })
    .eq('id', requestId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await sb.from('deal_events').insert({
    company_id: sr.company_id,
    kind: 'service',
    title: 'جُهِّز الحكم الائتماني',
    detail: matches.length + ' جهة مؤهَّلة · بانتظار مراجعتك قبل التسليم',
    actor: 'owner',
    needs_owner: true,
  });

  return NextResponse.json({ ok: true, html, entities: matches.length });
}
