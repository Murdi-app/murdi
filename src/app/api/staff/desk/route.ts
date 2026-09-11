import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireStaff } from '@/lib/requireStaff';
import { sendMail } from '@/lib/sendMail';
import { sendPush } from '@/lib/push';

// مكتب الطلبات — شاشة المساعِدة.
//
// طلب المالك أن تحمل المساعِدةُ نحو سبعين بالمئة من العمل: ترى الخدمات،
// وتعتمد أو ترفض طلبات الخدمة وطلبات المطابقة، وترى بيانات العميل كاملةً
// لتتصل به. وكان ذلك يعني — ظاهراً — أن تُفتح لها `/admin/services`
// و`/admin/approvals`.
//
// ولا يجوز. فتلك صفحتان للمالك فيهما ما ليس لها بحال:
//   · `/admin/services` فيها أزرار التوليد كلّها — دراسة الجدوى، الملف
//     الائتماني، عرض المستثمر، ورقة التفاوض. وهي منهجية المكتب نفسها.
//   · `/admin/approvals` فيها محادثة البحث، والعقود، والتسعير، ونسب
//     الأتعاب — وهي سرّ العمل لا تفصيلٌ فيه.
// وإخفاء زرٍّ في المتصفح ليس حماية: ما وصل الجهازَ وُصل إليه.
//
// فبابٌ ثالث: هذا المسار. يُعطي ما تحتاجه بالضبط ولا يمرّ بجواره ما سواه —
// فلا يبقى شيءٌ يُخفى، إذ لا يخرج من الخادم أصلاً.
//
// وكل قرارٍ تتّخذه يصل المالك بريداً لحظتَه. لا رقابةً عليها، بل لأن الطلب
// المعتمَد يفتح عملاً على المكتب، والمكتب لا يُفاجأ بعملٍ فُتح عليه.

export const dynamic = 'force-dynamic';

const OWNER = 'hololalmurdi.fs@gmail.com';
const FROM = 'مُرضي <partners@murdi.sa>';

const admin = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  );

/** من يجلس على هذا المكتب: المساعِدة، والمالك (ليرى ما تراه) */
async function atDesk() {
  const { who, error } = await requireStaff();
  if (error || !who) return { who: null, error: error || 'غير مصرح' };
  if (who.role === 'admin') return { who, error: null };
  if (who.job === 'assistant') return { who, error: null };
  return { who: null, error: 'هذه الشاشة ليست من عملك' };
}

const esc = (s: unknown) =>
  String(s ?? '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string));

// الحالات التي تنتظر كلمةً — وما عداها يُعرض للعلم لا للعمل
const AWAITING = 'submitted';

export async function GET() {
  const { who, error } = await atDesk();
  if (!who) return NextResponse.json({ error }, { status: 401 });

  const sb = admin();

  // ★ الأعمدة مذكورةٌ بأسمائها، لا `*`. فـ`*` تُخرج غداً كل عمودٍ يُضاف —
  //   والسعر والمُخرَج المولَّد عمودان في هذا الجدول نفسه.
  const { data: reqs } = await sb
    .from('service_requests')
    .select('id, company_id, service_title, service_category, status, client_note, track, created_at, paid_at')
    .order('created_at', { ascending: false })
    .limit(120);

  const { data: matches } = await sb
    .from('match_requests')
    .select('id, company_id, track, status, requested_at')
    .eq('status', 'requested')
    .order('requested_at', { ascending: true })
    .limit(60);

  // بيانات الاتصال كاملة — بأمر المالك، فبها تعمل: تتصل وتتابع وتُذكّر.
  const ids = Array.from(new Set([
    ...(reqs || []).map((r) => String(r.company_id)),
    ...(matches || []).map((r) => String(r.company_id)),
  ].filter(Boolean)));

  const { data: cos } = ids.length
    ? await sb.from('companies').select('id, company_name, owner_name, phone, city, sector, account_status').in('id', ids)
    : { data: [] as Array<Record<string, unknown>> };
  const { data: contacts } = ids.length
    ? await sb.from('company_contacts').select('company_id, contact_email').in('company_id', ids)
    : { data: [] as Array<Record<string, unknown>> };

  const mail = new Map((contacts || []).map((c) => [String(c.company_id), c.contact_email]));
  const byId = new Map((cos || []).map((c) => [String(c.id), { ...c, contact_email: mail.get(String(c.id)) || null }]));

  return NextResponse.json({
    role: who.role,
    requests: (reqs || []).map((r) => ({ ...r, company: byId.get(String(r.company_id)) || null })),
    matches: (matches || []).map((r) => ({ ...r, company: byId.get(String(r.company_id)) || null })),
  });
}

export async function PATCH(req: Request) {
  const { who, error } = await atDesk();
  if (!who) return NextResponse.json({ error }, { status: 401 });

  const b = await req.json().catch(() => ({} as Record<string, unknown>));
  const kind = String(b?.kind || '');
  const id = String(b?.id || '');
  const approve = String(b?.action || '') !== 'reject';
  const note = b?.note ? String(b.note).slice(0, 400) : '';
  if (!id) return NextResponse.json({ error: 'id مطلوب' }, { status: 400 });

  const sb = admin();
  const actor = who.role === 'admin' ? 'المالك' : (who.email || 'المكتب');

  let headline = '';
  let companyId = '';
  let companyName = '';

  if (kind === 'service') {
    const { data: r } = await sb
      .from('service_requests')
      .select('id, company_id, service_title, status')
      .eq('id', id)
      .maybeSingle();
    if (!r) return NextResponse.json({ error: 'الطلب غير موجود' }, { status: 404 });

    // ★ لا يُعتمد إلا ما ينتظر. وبدون هذا الشرط تُعيد ضغطةٌ متأخرة طلباً
    //   مُسلَّماً إلى «قيد التجهيز»، فيبدو العمل غير منجزٍ وهو منجز.
    if (String(r.status) !== AWAITING) {
      return NextResponse.json({ error: 'هذا الطلب لم يعد بانتظار الاعتماد — حالته: ' + r.status }, { status: 409 });
    }

    companyId = String(r.company_id || '');
    const { error: upErr } = await sb
      .from('service_requests')
      .update({ status: approve ? 'in_progress' : 'rejected', updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('status', AWAITING);
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

    headline = (approve ? 'اعتُمد طلب خدمة' : 'رُفض طلب خدمة') + ' — ' + String(r.service_title || '');
  } else if (kind === 'match') {
    const { data: r } = await sb
      .from('match_requests')
      .select('id, company_id, track, status')
      .eq('id', id)
      .maybeSingle();
    if (!r) return NextResponse.json({ error: 'الطلب غير موجود' }, { status: 404 });
    if (String(r.status) !== 'requested') {
      return NextResponse.json({ error: 'هذا الطلب حُسم من قبل' }, { status: 409 });
    }

    companyId = String(r.company_id || '');
    if (approve) {
      // التشغيلة تكلّف، فتُمنح واحدة بالآلية الذرّية نفسها — لا بزيادة يدوية
      const { error: rpcErr } = await sb.rpc('grant_match_credit', { p_company: companyId, p_n: 1 });
      if (rpcErr) return NextResponse.json({ error: rpcErr.message }, { status: 500 });
    }
    const { error: upErr } = await sb
      .from('match_requests')
      .update({
        status: approve ? 'granted' : 'rejected',
        decided_at: new Date().toISOString(),
        decided_by: who.userId,
        note: note || null,
      })
      .eq('id', id)
      .eq('status', 'requested');
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

    headline = (approve ? 'مُنحت تشغيلة مطابقة' : 'رُفض طلب مطابقة') +
      ' — مسار ' + (r.track === 'investment' ? 'الاستثمار' : 'التمويل');
  } else {
    return NextResponse.json({ error: 'نوع غير معروف' }, { status: 400 });
  }

  if (companyId) {
    const { data: co } = await sb.from('companies').select('company_name').eq('id', companyId).maybeSingle();
    companyName = String(co?.company_name || '');
  }

  // أثرٌ مكتوب في خطّ الصفقة — فالقرار يُقرأ بعد شهر كما قُرئ يومه
  await sb.from('deal_events').insert({
    company_id: companyId || null,
    kind: kind === 'match' ? 'match_request' : 'service_request',
    title: headline,
    detail: 'القرار من: ' + actor + (note ? ' · ' + note : ''),
    actor: who.role === 'admin' ? 'admin' : 'staff',
    needs_owner: false,
  }).then(() => null, () => null);

  // ★ المالك يُخبَر بكل قرارٍ تتّخذه المساعِدة — لا قراراته هو.
  if (who.role !== 'admin') {
    await sendMail({
      from: FROM,
      to: OWNER,
      subject: headline + (companyName ? ' — ' + companyName : ''),
      html:
        '<div dir="rtl" style="font-family:Arial;line-height:1.9;color:#1A3D34;max-width:560px">' +
        '<p style="margin:0 0 4px;color:#6B8A80;font-size:12.5px">قرارٌ من المكتب</p>' +
        '<h2 style="color:#1A3D34;margin:0 0 10px;font-size:18px">' + esc(headline) + '</h2>' +
        (companyName ? '<p style="margin:0 0 10px"><b>' + esc(companyName) + '</b></p>' : '') +
        '<p style="margin:0 0 6px;font-size:13.5px">اتّخذته: ' + esc(actor) + '</p>' +
        (note ? '<p style="margin:0 0 6px;font-size:13.5px">ملاحظتها: ' + esc(note) + '</p>' : '') +
        '<p style="margin:16px 0 0"><a href="https://murdi.sa/admin/services" style="background:#1A3D34;color:#fff;padding:12px 26px;border-radius:8px;text-decoration:none;font-weight:bold">افتح الخدمات</a></p>' +
        '<p style="margin:14px 0 0;color:#6B8A80;font-size:12px">إن لم يكن هذا صواباً فالتراجع من صفحة الخدمات عندك.</p>' +
        '</div>',
    }).catch(() => null);

    await sendPush({
      title: approve ? '📑 اعتماد من المكتب' : '📑 رفض من المكتب',
      body: (companyName ? companyName + ' — ' : '') + headline.slice(0, 120),
      url: '/admin/services',
      tag: 'desk-' + id,
    }, OWNER).catch(() => null);
  }

  return NextResponse.json({ ok: true });
}
