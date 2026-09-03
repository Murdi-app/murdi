import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendMail } from '@/lib/sendMail';
import { prettyPhone } from '@/lib/phone';
import { sendPush } from '@/lib/push';

// إخطار فوري بما لا يحتمل الانتظار.
//
// القاعدة الحاكمة: **يُشعِر ما تخسر مالاً إن تأخّرت عنه ساعة.** وما عداه
// مكانه تلخيص المساء. والإشعار الذي يرنّ كثيراً يُطفأ، ويوم يُطفأ يفوت
// صاحبَه ما كان يستحق — فالإمساك هنا حمايةٌ للإشعار لا بخلٌ به.
//
// سبب وجود هذا الملف: سجّلت «برفية رمز مطبق الابداع» ١:٤٨ ظهراً وأنهت
// تقييماً بدرجة ٨١ في ٢:٠٦، ولم يعلم المالك حتى سأل ليلاً — لأن تلخيص
// المساء لم يكن فيه حقلٌ يقول «دخل عميل» أصلاً.
//
// والإخطار من القاعدة عبر pg_net لا من متصفح العميل: لا يُزوَّر، ولا يضيع
// إن أغلق صفحته، ولا يحتاج أحداً ساهراً.

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

const money = (n: unknown) => {
  const v = Number(n);
  return Number.isFinite(v) && v > 0 ? v.toLocaleString('en-US') + ' ر.س' : null;
};

/** الموظفات النشطات — يُشعَرن بالعملاء، لا بالمال */
async function staffEmails(sb: ReturnType<typeof admin>): Promise<string[]> {
  const { data: st } = await sb.from('staff').select('user_id').eq('active', true);
  const ids = (st || []).map((s) => String(s.user_id)).filter(Boolean);
  if (ids.length === 0) return [];
  const out: string[] = [];
  for (const id of ids) {
    const { data } = await sb.auth.admin.getUserById(id);
    const e = data?.user?.email;
    if (e) out.push(e);
  }
  return out;
}

// من يُشعَر بماذا: العميل الجديد يخصّ المكتب كلّه لأن الموظفة هي من تتصل،
// والمال والعقود تخصّ المالك وحده.
const CLIENT_KINDS = new Set(['signup', 'assessment', 'match_request']);

export async function POST(req: Request) {
  if (!(await authorized(req))) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  }

  const b = await req.json().catch(() => ({}));
  const kind = String(b?.kind || '');
  const companyId = String(b?.company_id || '');
  const ref = b?.ref ? String(b.ref) : '';
  if (!companyId) return NextResponse.json({ error: 'company_id مطلوب' }, { status: 400 });

  const sb = admin();
  const { data: c } = await sb
    .from('companies')
    .select('id, company_name, owner_name, phone, city, sector, cr_number')
    .eq('id', companyId)
    .maybeSingle();
  if (!c) return NextResponse.json({ error: 'لا توجد منشأة' }, { status: 404 });

  const name = String(c.company_name || '');
  let subject = '';
  let head = '';
  let extra = '';
  let pushTitle = '';
  let pushBody = '';
  let url = '/admin/hot';

  if (kind === 'assessment') {
    const { data: r } = await sb.from('readiness_results')
      .select('readiness_score, verdict, result_type')
      .eq('company_id', companyId).order('created_at', { ascending: false }).limit(1).maybeSingle();
    const { data: f } = await sb.from('financial_data')
      .select('annual_revenue, requested_amount, funding_purpose, has_debt, ownership_type')
      .eq('company_id', companyId).order('created_at', { ascending: false }).limit(1).maybeSingle();

    subject = 'تقييم جديد: ' + name + ' — ' + String(r?.readiness_score ?? '؟') + '/١٠٠';
    head = 'أنهى تقييمه الآن';
    pushTitle = '🔥 تقييم جديد';
    pushBody = name + ' — ' + String(r?.readiness_score ?? '؟') + '/100'
      + (money(f?.requested_amount) ? ' · يطلب ' + money(f?.requested_amount) : '')
      + ' · ' + String(c.city || '');
    extra =
      row('الدرجة', String(r?.readiness_score ?? '—') + ' — ' + String(r?.verdict || '')) +
      row('الإيرادات السنوية', money(f?.annual_revenue) || '—') +
      row('المبلغ المطلوب', money(f?.requested_amount) || '—') +
      row('الغرض', f?.funding_purpose || '—') +
      row('عليه ديون', f?.has_debt === true ? 'نعم' : f?.has_debt === false ? 'لا' : '—') +
      row('الملكية', f?.ownership_type === 'saudi' ? 'سعودية' : f?.ownership_type === 'foreign' ? 'أجنبية' : f?.ownership_type === 'mixed' ? 'مختلطة' : '—');

  } else if (kind === 'match_request') {
    subject = 'طلب تشغيل مطابقة — ' + name;
    head = 'طلب تشغيل المطابقة — وهو داخل المنصة الآن';
    pushTitle = '🎯 طلب مطابقة';
    pushBody = name + ' ينتظر إذنك بتشغيل المطابقة';
    url = '/admin/approvals';
    extra = row('الحالة', 'لا تعمل المطابقة إلا بإذنك — والتشغيلة تكلّف');

  } else if (kind === 'service_request') {
    const { data: s } = await sb.from('service_requests')
      .select('service_title, status, price, quoted_price, option_key')
      .eq('id', ref).maybeSingle();
    const amount = money(s?.price ?? s?.quoted_price);
    const priced = Boolean(amount);
    subject = 'طلب خدمة: ' + name + ' — ' + String(s?.service_title || '');
    head = priced ? 'طلب خدمة مسعَّرة — بانتظار دفعه' : 'طلب خدمة بلا سعر — ينتظر رقماً منك';
    pushTitle = priced ? '💼 طلب خدمة' : '⏳ خدمة تنتظر تسعيرك';
    pushBody = name + ' — ' + String(s?.service_title || '') + (amount ? ' · ' + amount : ' · تحتاج تسعيرك');
    url = '/admin/services';
    extra = row('الخدمة', s?.service_title || '—') + row('السعر', amount || 'لم تُسعَّر بعد');

  } else if (kind === 'payment') {
    const { data: p } = await sb.from('payments')
      .select('amount_sar, kind, description, method, status')
      .eq('id', ref).maybeSingle();
    const amount = money(p?.amount_sar);
    subject = 'تحويل بانتظار تأكيدك: ' + name + (amount ? ' — ' + amount : '');
    head = 'حوّل مبلغاً وينتظر تأكيدك';
    pushTitle = '💰 تحويل وصل';
    pushBody = name + (amount ? ' — ' + amount : '') + ' · بانتظار تأكيدك';
    url = '/admin/payments';
    extra = row('المبلغ', amount || '—') + row('البيان', p?.description || p?.kind || '—');

  } else if (kind === 'outreach_reply') {
    subject = 'ردّت جهة تمويل — ' + name;
    head = 'وصل ردٌّ من جهة تمويل';
    pushTitle = '📩 ردّت جهة';
    pushBody = name + ' — وصل ردّ من جهة تمويل. سرعة ردّك تحسم';
    url = '/admin/outreach';
    extra = row('التفصيل', b?.title || '—');

  } else if (kind === 'contract_signed') {
    const { data: k } = await sb.from('contracts')
      .select('contract_type, fixed_amount, fee_percent, deal_value')
      .eq('id', ref).maybeSingle();
    subject = 'وُقّع العقد: ' + name;
    head = 'وقّع العميل عقده';
    pushTitle = '✅ عقد موقّع';
    pushBody = name + ' وقّع عقده' + (money(k?.fixed_amount) ? ' — ' + money(k?.fixed_amount) : '');
    url = '/admin/services';
    extra = row('نوع العقد', k?.contract_type || '—') +
      row('المقدّم', money(k?.fixed_amount) || '—') +
      row('أتعاب النجاح', k?.fee_percent ? k.fee_percent + '٪' : '—');

  } else {
    subject = 'تسجيل جديد: ' + name;
    head = 'سجّل منشأته الآن';
    pushTitle = '🆕 تسجيل جديد';
    pushBody = name + ' — ' + String(c.city || '') + ' · ' + String(c.sector || '');
    extra = row('السجل التجاري', c.cr_number || '—');
  }

  const html =
    '<div dir="rtl" style="font-family:Arial;line-height:1.9;color:#1A3D34;max-width:560px">' +
    '<h2 style="color:#1A3D34;margin:0 0 4px">' + esc(name) + '</h2>' +
    '<p style="margin:0 0 14px;color:#6B8A80;font-size:13.5px">' + esc(head) + '</p>' +
    '<table style="border-collapse:collapse;width:100%;background:#F7FBF9;border-radius:8px">' +
    row('المالك', c.owner_name || '—') +
    row('الجوال', prettyPhone(c.phone)) +
    row('المدينة', c.city || '—') +
    row('القطاع', c.sector || '—') +
    extra +
    '</table>' +
    '<p style="margin:18px 0 8px">' +
    '<a href="https://murdi.sa' + url + '" style="background:#1A3D34;color:#fff;padding:12px 26px;border-radius:8px;text-decoration:none;font-weight:bold">افتح المنصة</a>' +
    '</p>' +
    '<p style="margin:0;color:#6B8A80;font-size:12.5px">حرارة العميل تبرد بالساعات — لا بالأيام.</p>' +
    '</div>';

  const mail = await sendMail({ from: FROM, to: OWNER, subject, html });

  // العميل الجديد يخصّ المكتب كلّه — الموظفة هي من تتصل. والمال والعقود لك.
  const audience = CLIENT_KINDS.has(kind)
    ? [OWNER, ...(await staffEmails(sb))]
    : [OWNER];

  const push = await sendPush({
    title: pushTitle,
    body: pushBody,
    url,
    important: true,
    tag: kind + '-' + companyId,
  }, audience).catch(() => ({ sent: 0, removed: 0, failed: 0, reason: 'تعذّر الإرسال' }));

  await sb.from('deal_events').insert({
    company_id: companyId,
    kind: kind === 'assessment' ? 'assessment' : kind === 'signup' ? 'signup' : 'note',
    title: head,
    detail: (mail.ok ? 'أُخطر المكتب بالبريد' : 'تعذّر البريد: ' + mail.reason)
      + ' · إشعار الجوال: ' + (push.sent > 0 ? push.sent + ' جهاز' : (push.reason || 'لم يصل')),
    actor: 'system',
    needs_owner: kind !== 'assessment' && kind !== 'signup',
  });

  return NextResponse.json({ ok: true, kind, mail: mail.ok, push });
}
