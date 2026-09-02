import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendMail } from '@/lib/sendMail';
import { prettyPhone } from '@/lib/phone';

// إخطار فوري بكل عميل جديد.
//
// سجّلت «برفية رمز مطبق الابداع» الساعة ١:٤٨، وأنهت تقييماً بدرجة ٨١ الساعة
// ٢:٠٦ — ولم يعلم المالك حتى سأل بنفسه ليلاً. وتلخيصُ المساء لم يذكرها،
// لأن `daily_digest` ليس فيه حقلٌ للتسجيلات الجديدة أصلاً: يعدّ الدفعات
// المعلّقة والخدمات الراكدة والروابط الميتة، ولا يقول «دخل عميل».
//
// والعميل الذي ينهي تقييمه اليوم ويُتصَل به بعد أسبوع ليس هو نفسه: حرارته
// تبرد بالساعات لا بالأيام. فصار الإخطار فورياً، ومن القاعدة نفسها عبر
// pg_net — لا من متصفح العميل، فلا يُزوَّر ولا يضيع إن أغلق الصفحة.

export const dynamic = 'force-dynamic';

const admin = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  );

const OWNER = 'hololalmurdi.fs@gmail.com';
const FROM = 'مُرضي <partners@murdi.sa>';

async function authorized(req: Request): Promise<boolean> {
  const given = req.headers.get('x-cron-secret') || '';
  if (!given) return false;
  const { data } = await admin().from('app_config').select('value').eq('key', 'cron_secret').maybeSingle();
  const want = String(data?.value || '');
  if (!want || given.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < want.length; i++) diff |= given.charCodeAt(i) ^ want.charCodeAt(i);
  return diff === 0;
}

const esc = (s: unknown) =>
  String(s ?? '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string));

const row = (k: string, v: unknown) =>
  '<tr><td style="padding:6px 10px;color:#6B8A80;font-size:13px">' + esc(k) +
  '</td><td style="padding:6px 10px;color:#1A3D34;font-weight:bold;font-size:13.5px">' + esc(v) + '</td></tr>';

export async function POST(req: Request) {
  if (!(await authorized(req))) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  }

  const b = await req.json().catch(() => ({}));
  const kind = String(b?.kind || '');
  const companyId = String(b?.company_id || '');
  if (!companyId) return NextResponse.json({ error: 'company_id مطلوب' }, { status: 400 });

  const sb = admin();
  const { data: c } = await sb
    .from('companies')
    .select('id, company_name, owner_name, phone, city, sector, cr_number, created_at')
    .eq('id', companyId)
    .maybeSingle();
  if (!c) return NextResponse.json({ error: 'لا توجد منشأة' }, { status: 404 });

  let subject = '';
  let head = '';
  let extra = '';

  if (kind === 'assessment') {
    // التقييم انتهى: الدرجة هي أول ما يريد المالك رؤيته، ثم ما يطلبه العميل
    const { data: r } = await sb
      .from('readiness_results')
      .select('readiness_score, verdict, result_type')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const { data: f } = await sb
      .from('financial_data')
      .select('annual_revenue, requested_amount, funding_purpose, has_debt, ownership_type, years_operating')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    subject = 'تقييم جديد: ' + String(c.company_name || '') + ' — ' + String(r?.readiness_score ?? '؟') + '/١٠٠';
    head = 'أنهى تقييمه الآن';
    extra =
      row('الدرجة', String(r?.readiness_score ?? '—') + ' — ' + String(r?.verdict || '')) +
      row('الإيرادات السنوية', f?.annual_revenue ? Number(f.annual_revenue).toLocaleString('en-US') + ' ر.س' : '—') +
      row('المبلغ المطلوب', f?.requested_amount ? Number(f.requested_amount).toLocaleString('en-US') + ' ر.س' : '—') +
      row('الغرض', f?.funding_purpose || '—') +
      row('عليه ديون', f?.has_debt === true ? 'نعم' : f?.has_debt === false ? 'لا' : '—') +
      row('الملكية', f?.ownership_type === 'saudi' ? 'سعودية' : f?.ownership_type === 'foreign' ? 'أجنبية' : f?.ownership_type === 'mixed' ? 'مختلطة' : '—');
  } else {
    subject = 'تسجيل جديد: ' + String(c.company_name || '');
    head = 'سجّل منشأته الآن';
    extra = row('السجل التجاري', c.cr_number || '—');
  }

  const html =
    '<div dir="rtl" style="font-family:Arial;line-height:1.9;color:#1A3D34;max-width:560px">' +
    '<h2 style="color:#1A3D34;margin:0 0 4px">' + esc(c.company_name) + '</h2>' +
    '<p style="margin:0 0 14px;color:#6B8A80;font-size:13.5px">' + head + '</p>' +
    '<table style="border-collapse:collapse;width:100%;background:#F7FBF9;border-radius:8px">' +
    row('المالك', c.owner_name || '—') +
    row('الجوال', prettyPhone(c.phone)) +
    row('المدينة', c.city || '—') +
    row('القطاع', c.sector || '—') +
    extra +
    '</table>' +
    '<p style="margin:18px 0 8px">' +
    '<a href="https://murdi.sa/admin/hot" style="background:#1A3D34;color:#fff;padding:12px 26px;border-radius:8px;text-decoration:none;font-weight:bold">افتح الفرص الساخنة</a>' +
    '</p>' +
    '<p style="margin:0;color:#6B8A80;font-size:12.5px">حرارة العميل تبرد بالساعات — لا بالأيام.</p>' +
    '</div>';

  const mail = await sendMail({ from: FROM, to: OWNER, subject, html });

  await sb.from('deal_events').insert({
    company_id: companyId,
    kind: kind === 'assessment' ? 'assessment' : 'signup',
    title: kind === 'assessment' ? 'أنهى العميل تقييمه' : 'سجّل عميل جديد منشأته',
    detail: mail.ok ? 'أُخطر المالك بالبريد' : 'تعذّر إخطار المالك: ' + mail.reason,
    actor: 'system',
    needs_owner: true,
  });

  return NextResponse.json({ ok: true, notified: mail.ok });
}
