import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { requireStaff } from '@/lib/requireStaff';
import { sendMail } from '@/lib/sendMail';
import { waLink } from '@/lib/phone';

// طلب تشغيل المطابقة.
//
// أُلغي رسم التشغيل (٤٩٠). وكان الرسم — إلى جانب كونه رقماً ثالثاً يُربك
// العميل بين ٩٩٠ و٧٩٠٠ — هو البوابة التي تمنع تشغيلة مفتوحة للجميع.
// وحذفُه بلا بديل يفتح باباً كل عبورٍ منه يكلّف نحو ٢٢ دولاراً.
//
// فحلّ الإذنُ محلّ الدفع: العميل يطلب، والمالك يأذن بضغطة، فتُمنح تشغيلة
// واحدة عبر grant_match_credit — وتبقى آلية الخصم الذرّية كما هي، فلا
// تُشغَّل تشغيلتان بإذنٍ واحد ولو نقر العميل مرتين.

const admin = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  );

const OWNER = 'hololalmurdi.fs@gmail.com';
const FROM = 'مُرضي <partners@murdi.sa>';

async function currentCompany() {
  const store = await cookies();
  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    { cookies: { getAll: () => store.getAll(), setAll: () => {} } }
  );
  const { data } = await sb.auth.getUser();
  if (!data?.user) return null;
  const { data: co } = await admin()
    .from('companies')
    .select('id, company_name, match_credits')
    .eq('user_id', data.user.id)
    .maybeSingle();
  return co || null;
}

// GET — حالة طلب العميل، ليعرف أين يقف بلا أن يسأل أحداً.
// و‏?pending=1‏ للمالك: الطلبات المفتوحة كلها بأسمائها، لأن زرّ الإذن كان
// مدفوناً في قائمة الشركات ولا شيء يقول مَن طلب — فيطلب العميل ولا يُرى.
export async function GET(req: Request) {
  if (new URL(req.url).searchParams.get('pending') === '1') {
    const { who, error: denied } = await requireStaff();
    if (denied || !who || who.role !== 'admin') {
      return NextResponse.json({ error: denied || 'غير مصرح' }, { status: 401 });
    }
    const sb = admin();
    const { data: rows } = await sb
      .from('match_requests')
      .select('id, company_id, track, status, requested_at')
      .eq('status', 'requested')
      .order('requested_at', { ascending: true })
      .limit(100);
    const ids = Array.from(new Set((rows || []).map((r) => r.company_id)));
    const { data: cos } = ids.length
      ? await sb.from('companies').select('id, company_name, phone, sector, match_credits').in('id', ids)
      : { data: [] as Array<Record<string, unknown>> };
    const byId = new Map((cos || []).map((c) => [String(c.id), c]));
    return NextResponse.json({
      pending: (rows || []).map((r) => ({ ...r, company: byId.get(String(r.company_id)) || null })),
    });
  }

  const co = await currentCompany();
  if (!co) return NextResponse.json({ state: 'none' });
  const { data: reqs } = await admin()
    .from('match_requests')
    .select('track, status, requested_at, decided_at')
    .eq('company_id', co.id)
    .order('requested_at', { ascending: false })
    .limit(10);
  return NextResponse.json({
    state: 'ok',
    credits: Number(co.match_credits || 0),
    requests: reqs || [],
  });
}

// POST — العميل يطلب تشغيلة
export async function POST(req: Request) {
  const co = await currentCompany();
  if (!co) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const track = b?.track === 'investment' ? 'investment' : 'funding';
  const sb = admin();

  // طلب مفتوح واحد لكل مسار — النقر المتكرر لا يُنشئ طوابير
  const { data: open } = await sb
    .from('match_requests')
    .select('id')
    .eq('company_id', co.id)
    .eq('track', track)
    .eq('status', 'requested')
    .maybeSingle();
  if (open) return NextResponse.json({ ok: true, already: true });

  const { error } = await sb.from('match_requests').insert({ company_id: co.id, track });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await sb.from('deal_events').insert({
    company_id: co.id,
    kind: 'match_request',
    title: 'طلب العميل تشغيل المطابقة — ' + (track === 'investment' ? 'استثمار' : 'تمويل'),
    detail: 'لا تعمل المطابقة إلا بإذنك. افتح «الاعتمادات» وامنح تشغيلة.',
    actor: 'system',
    needs_owner: true,
  });

  // إخطارك فوراً: العميل الذي يطلب المطابقة هو أسخن ما في اليوم
  await sendMail({
    from: FROM,
    to: OWNER,
    subject: 'طلب تشغيل مطابقة — ' + String(co.company_name || ''),
    html:
      '<div dir="rtl" style="font-family:Arial;line-height:1.9;color:#1A3D34">' +
      '<h2 style="color:#1A3D34">طلب تشغيل مطابقة</h2>' +
      '<p><b>' + String(co.company_name || '') + '</b> — مسار ' + (track === 'investment' ? 'الاستثمار' : 'التمويل') + '</p>' +
      '<p>لا تعمل حتى تأذن. والتشغيلة تكلّف، فالإذن قرارك لا قراره.</p>' +
      '<p><a href="https://murdi.sa/admin/approvals" style="background:#1A3D34;color:#fff;padding:12px 26px;border-radius:8px;text-decoration:none;font-weight:bold">افتح الاعتمادات</a></p></div>',
  });

  return NextResponse.json({ ok: true });
}

// PATCH — المالك يأذن أو يرفض
export async function PATCH(req: Request) {
  const { who, error: denied } = await requireStaff();
  if (denied || !who) return NextResponse.json({ error: denied || 'غير مصرح' }, { status: 401 });
  if (who.role !== 'admin') {
    return NextResponse.json({ error: 'الإذن بالتشغيل للمالك وحده' }, { status: 403 });
  }

  const b = await req.json().catch(() => ({}));
  const companyId = String(b?.company_id || '');
  const track = b?.track === 'investment' ? 'investment' : 'funding';
  const approve = b?.action !== 'reject';
  if (!companyId) return NextResponse.json({ error: 'company_id مطلوب' }, { status: 400 });

  const sb = admin();

  if (approve) {
    const { error } = await sb.rpc('grant_match_credit', { p_company: companyId, p_n: 1 });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await sb
    .from('match_requests')
    .update({
      status: approve ? 'granted' : 'rejected',
      decided_at: new Date().toISOString(),
      decided_by: who.userId,
      note: b?.note ? String(b.note).slice(0, 500) : null,
    })
    .eq('company_id', companyId)
    .eq('track', track)
    .eq('status', 'requested');

  // العميل طلب ثم انتظر بلا خبر: الإذن كان يقع في القاعدة ولا يعلم به
  // صاحبه، فيبقى الزرّ مفتوحاً أمامه ولا أحد قال له إنه فُتح. فصار الإذن
  // يُخبِر صاحبه: بريد يُرسَل فوراً، ورابط واتساب جاهز يُعاد للمكتب.
  let notified = false;
  let whatsapp: string | null = null;
  let mailNote: string | null = null;

  const { data: contact } = await sb
    .from('company_contacts')
    .select('company_name, owner_name, phone, contact_email')
    .eq('company_id', companyId)
    .maybeSingle();

  const trackAr = track === 'investment' ? 'جهات الاستثمار' : 'جهات التمويل';
  const greet = contact?.owner_name ? 'أهلاً ' + String(contact.owner_name) + '،' : 'السلام عليكم ورحمة الله،';

  if (approve && contact) {
    const waText =
      'السلام عليكم ورحمة الله\n\n' +
      'فُتحت لك المطابقة في منصة مُرضي على ' + String(contact.company_name || 'ملفك') + '.\n' +
      'تبقّى عليك خطوة واحدة: ادخل لوحتك واضغط «طابق ' + trackAr + '».\n' +
      'ولا يُطلب منك أي دفع في هذه الخطوة.\n\n' +
      'https://murdi.sa/goal';
    whatsapp = waLink(contact.phone, waText);

    if (contact.contact_email) {
      const r = await sendMail({
        from: FROM,
        to: String(contact.contact_email),
        subject: 'فُتحت لك المطابقة في مُرضي',
        html:
          '<div dir="rtl" style="font-family:Arial;line-height:1.9;color:#1A3D34;max-width:560px">' +
          '<h2 style="color:#1A3D34;margin:0 0 14px">فُتحت لك المطابقة</h2>' +
          '<p style="margin:0 0 12px">' + greet + '</p>' +
          '<p style="margin:0 0 12px">فُتحت لك تشغيلة المطابقة على <b>' + String(contact.company_name || 'ملفك') + '</b>.</p>' +
          '<p style="margin:0 0 12px">تبقّى عليك خطوة واحدة: ادخل لوحتك واضغط «<b>طابق ' + trackAr + '</b>»، ' +
          'ونبحث لك عن الجهات التي تنطبق شروطها على ملفك أنت، والمنتج المناسب لك عند كل واحدة.</p>' +
          '<p style="margin:0 0 22px"><a href="https://murdi.sa/goal" style="background:#1A3D34;color:#fff;padding:13px 30px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">افتح لوحتك ←</a></p>' +
          '<p style="margin:0 0 12px;color:#1A7A5A;font-weight:bold">ولا يُطلب منك أي دفع في هذه الخطوة.</p>' +
          '<p style="margin:0;color:#6B8A80;font-size:13px">مُرضي — حلول المرضي للاستشارات المالية</p>' +
          '</div>',
      });
      notified = r.ok;
      if (!r.ok) mailNote = r.reason;
    }
  }

  // القرار الذي اتُّخذ لا يبقى في طابور القرارات: كان طلبُ العميل يُسجَّل
  // بـ needs_owner=true، ثم تأذن أنت فيُضاف حدثٌ جديد — ويبقى الطلب القديم
  // مرفوعاً، فيعيده تلخيصُ المساء عليك كل يوم كأنك لم تقرّره. يُطوى هنا.
  await sb.from('deal_events')
    .update({ needs_owner: false })
    .eq('company_id', companyId)
    .eq('kind', 'match_request')
    .eq('needs_owner', true);

  await sb.from('deal_events').insert({
    company_id: companyId,
    kind: 'match_request',
    title: approve ? 'أذنتَ بتشغيلة مطابقة' : 'رُفض طلب التشغيل',
    detail: 'مسار ' + (track === 'investment' ? 'الاستثمار' : 'التمويل')
      + (approve ? (notified ? ' — أُبلغ العميل بالبريد' : ' — لم يصل بريد الإبلاغ' + (mailNote ? ': ' + mailNote : '')) : ''),
    actor: 'owner',
    needs_owner: approve && !notified,
  });

  return NextResponse.json({ ok: true, granted: approve, notified, whatsapp, mailNote });
}
