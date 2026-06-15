import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { Resend } from 'resend';

async function generateRecoveryPath(data: Record<string, unknown>): Promise<string> {
  const MODELS = ['claude-fable-5', 'claude-sonnet-4-5-20250929'];
  const prompt = 'انت مستشار مالي وفق منهجية د. عبدالحكيم المرضي. الشركة متعثرة في سداد ديونها، والادراج في السوق المالي مرفوض نظاما لمن لا ينتظم في التزاماته، فالطرح هدف بعيد يسبقه تعافي واستقرار. '
    + 'بياناتها: ' + JSON.stringify(data) + '. '
    + 'اكتب مسار تعافي واقعيا ومتدرجا يقدر عليه صاحب شركة متعثر فعلا، بلا مبالغة ولا حلول خيالية ولا راس مال كبير. '
    + 'ركز على: اعادة جدولة الديون والتفاوض مع الدائنين، وقف النزيف النقدي وضبط المصروفات، تحسين التدفق النقدي والربحية، استعادة الانتظام في السداد، ثم بعد سنوات من الاستقرار يعاد تقييم جاهزية الطرح. '
    + 'اربط كل خطوة بارقام الشركة الفعلية. اخرج HTML عربي بسيط: <h3>مسار التعافي قبل التفكير في الطرح</h3> ثم <ol> خطوات مرقمة كل خطوة <li> فيها رقم محسوب من بياناتهم. بلا اي اشارة لذكاء اصطناعي او تقنية. ابدا مباشرة بالـHTML.';
  for (const model of MODELS) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY as string, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model, max_tokens: 2000, messages: [{ role: 'user', content: prompt }] }),
      });
      if (!res.ok) continue;
      const j = await res.json();
      const txt = (j.content || []).filter((b: { type: string }) => b.type === 'text').map((b: { text: string }) => b.text).join('').trim();
      if (txt) return txt;
    } catch {}
  }
  return '<h3>مسار التعافي قبل التفكير في الطرح</h3><p>الشركة بحاجة لإعادة هيكلة ديونها واستعادة انتظام السداد قبل أي تفكير في الإدراج.</p>';
}

export async function POST() {
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
    .select('id, company_name, cr_number, city, sector, phone, account_status')
    .eq('user_id', user.id)
    .single();

  if (company === null || company.account_status !== 'active') {
    return NextResponse.json({ error: 'الحساب غير مفعّل' }, { status: 403 });
  }

  const { data: fd } = await supabase
    .from('financial_data')
    .select('*')
    .eq('company_id', company.id)
    .eq('assessment_type', 'ipo')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  const { data: rr } = await supabase
    .from('readiness_results')
    .select('readiness_score, verdict, top_obstacles, improvement_plan, months_to_ready')
    .eq('company_id', company.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (fd === null) return NextResponse.json({ error: 'لا توجد بيانات تقييم طرح' }, { status: 404 });

  const rev = Number(fd.annual_revenue) || 0;
  const profit = Number(fd.net_profit) || 0;
  const score = rr?.readiness_score ?? 0;
  const yes = (v: unknown) => (v === true ? 'نعم' : 'لا');
  const marketLabel = fd.target_market === 'main' ? 'السوق الرئيسية' : 'السوق الموازي (نمو)';
  const growth = fd.revenue_growth || '';
  let valLo = 0, valHi = 0, valBasis = 'none';
  if (profit > 0) {
    let ml = 6, mh = 8;
    if (growth === 'high') { ml = 8; mh = 10; }
    else if (growth === 'medium') { ml = 7; mh = 9; }
    valLo = profit * ml; valHi = profit * mh; valBasis = 'profit';
  } else if (rev > 0) {
    valBasis = 'loss';
  }
  const fmtSar = (n: number) => Math.round(n).toLocaleString('en-US');
  const valuationHtml = valBasis === 'profit'
    ? '<p><b>القيمة السوقية التقديرية:</b> ' + fmtSar(valLo) + ' — ' + fmtSar(valHi) + ' ر.س (على أساس ربح ' + fmtSar(profit) + ' × مضاعف ' + (growth === 'high' ? '8-10' : growth === 'medium' ? '7-9' : '6-8') + ')</p>'
    : '<p><b>القيمة السوقية التقديرية:</b> تحتاج ربحية صافية موجبة للتقدير (الشركة غير ربحية حالياً)</p>';
  const planHtml = (rr?.improvement_plan || []).map((x: string, i: number) => '<li style="margin-bottom:4px">' + (i + 1) + '. ' + x + '</li>').join('');
  const monthsTxt = rr?.months_to_ready ? rr.months_to_ready + ' شهراً' : '—';

  try {
    const isDefaulted = fd?.repayment_status === 'default';
    let recoveryHtml = '';
    if (isDefaulted) { try { recoveryHtml = await generateRecoveryPath({ ...fd }); } catch {} }
    const resend = new Resend(process.env.RESEND_API_KEY);
    const obstacleRows = (rr?.top_obstacles || []).map((o: string) =>
      '<li style="margin-bottom:4px">' + o + '</li>'
    ).join('');

    await resend.emails.send({
      from: 'د. عبدالحكيم المرضي <noreply@murdi.sa>',
      to: 'hololalmurdi.fs@gmail.com',
      subject: (isDefaulted ? '⚠️ شركة متعثرة (مسار تعافي) — ' : (score >= 65 ? '🎯 مؤهل طرح — ' : 'تقييم طرح — ')) + company.company_name + ' (درجة ' + score + ')',
      html:
        '<div dir="rtl" style="font-family:Arial">' +
        (isDefaulted
          ? '<div style="background:#FBECEC;border:2px solid #C0564B;border-radius:10px;padding:14px;margin-bottom:14px"><b style="color:#A33;font-size:16px">⚠️ غير مؤهل للطرح حالياً — شركة متعثرة</b><br/>الإجراء: الشركة متعثرة في السداد والإدراج مرفوض نظاماً. الفرصة هنا خدمة <b>إعادة هيكلة وتعافٍ</b> تقدّمها حلول المرضي، تمهّد لاحقاً للطرح.</div>'
          : (score >= 65
          ? '<div style="background:#FBF5E8;border:2px solid #C9A84C;border-radius:10px;padding:14px;margin-bottom:14px"><b style="color:#9A7B2E;font-size:16px">🎯 مؤهل للطرح — فرصة خدمة مدفوعة</b><br/>الإجراء: تواصل مع العميل لعرض خطة الطرح الكاملة (المراحل + التكلفة + تجهيز ملف الهيئة).</div>'
          : '<div style="background:#F0F5F3;border:1px solid #ddd;border-radius:10px;padding:14px;margin-bottom:14px"><b style="color:#6B8A80;font-size:16px">⏳ يحتاج تجهيزاً قبل الطرح</b><br/>الإجراء: متابعة لاحقة — العميل بعيد عن الجاهزية حالياً.</div>')) +
        '<h2>ملف طرح جديد</h2>' +
        '<p><b>الشركة:</b> ' + company.company_name + ' — سجل: ' + company.cr_number + '</p>' +
        '<p><b>الجوال:</b> ' + (company.phone || '—') + ' | <b>المدينة:</b> ' + (company.city || '—') + ' | <b>القطاع:</b> ' + (fd?.sector || company.sector || '—') + '</p>' +
        '<p><b>IPO Readiness Score:</b> ' + score + '</p>' +
        '<p><b>الحكم:</b> ' + (rr?.verdict ?? '—') + '</p>' +
        '<p><b>السوق المقترح:</b> ' + marketLabel + '</p>' +
        '<hr/>' +
        '<p><b>الإيرادات:</b> ' + rev.toLocaleString() + ' ر.س | <b>صافي الربح:</b> ' + profit.toLocaleString() + ' ر.س</p>' +
        '<p><b>سنوات القوائم المعتمدة:</b> ' + (fd.num_statements_years ?? 0) + ' | <b>مراجع خارجي:</b> ' + yes(fd.external_auditor) + '</p>' +
        '<p><b>حوكمة:</b> ' + yes(fd.has_governance) + ' | <b>مجلس إدارة:</b> ' + yes(fd.has_board) + ' | <b>لجان:</b> ' + yes(fd.has_committees) + '</p>' +
        '<p><b>التزام ضريبي:</b> ' + yes(fd.tax_compliant) + ' | <b>زكاة:</b> ' + yes(fd.zakat_compliant) + '</p>' +
        '<p><b>تركّز أكبر عميل:</b> ' + (fd.top_client_pct ?? '—') + '%</p>' +
        '<hr/>' +
        '<p><b>أبرز العوائق:</b></p><ul>' + obstacleRows + '</ul>' +
        '<hr/>' +
        '<p><b>⏱️ المدة التقديرية للجاهزية:</b> ' + monthsTxt + '</p>' +
        valuationHtml +
        (planHtml ? '<p><b>🗺️ خارطة الطريق:</b></p><ul>' + planHtml + '</ul>' : '') +
        (isDefaulted && recoveryHtml ? '<hr/><div style="background:#F0F7F4;border-radius:10px;padding:14px;margin-top:10px">' + recoveryHtml + '</div>' : '') +
        '</div>',
    });
  } catch {}

  return NextResponse.json({ ok: true });
}
