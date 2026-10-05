import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requirePage } from '@/lib/requireStaff';
import { decidesAtDesk } from '@/lib/staffPages';
import { OPEN_PAID_STATUSES } from '@/lib/serviceStatus';
import { sendMail } from '@/lib/sendMail';
import { sendPush } from '@/lib/push';
import { confirmPayment } from '@/lib/confirmPayment';
import { feeFromContract, nextInvoiceNo } from '@/lib/successFees';
import { redactTimeline } from '@/lib/staffRedact';
import { logStaff } from '@/lib/staffLog';

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

/**
 * من يجلس على هذا المكتب: المساعِدة والمتابِعة، والمالك (ليرى ما ترَيان).
 *
 * ★ وفُتح للمتابِعة في ١٤ سبتمبر: انطلقت حملة جوجل للمنصة فصارت تصل
 *   استفساراتٌ وطلبات خدمة كل يوم، وأُسندت إليها، ولا تُعتمد الطلبات ولا
 *   يُؤكَّد تحويلُ عميلٍ من شاشةٍ لا تراها.
 */
// ★ كانت هنا قائمة الأدوار مكتوبةً ثانيةً (`assistant || followup`) لا مقروءةً
//   من `staffPages` — والشرط صادقٌ دائماً. فصار الحكم حارسَ الشاشة الواحد.
async function atDesk() {
  const { who, error, status } = await requirePage('/admin/desk');
  return { who, error: who ? null : (error || 'غير مصرح'), status };
}

const esc = (s: unknown) =>
  String(s ?? '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string));

// الحالات التي تنتظر كلمةً — وما عداها يُعرض للعلم لا للعمل
const AWAITING = 'submitted';

export async function GET() {
  const { who, error, status } = await atDesk();
  if (!who) return NextResponse.json({ error }, { status });

  const sb = admin();
  const fail = (what: string, e: { message: string }) =>
    NextResponse.json({ error: 'تعذّرت قراءة ' + what + ' — ' + e.message }, { status: 500 });

  // ★ الشاشة لا تخمّن مَن يقرّر: الخادم يقوله. فإن تغيّرت القسمة غداً في
  //   `staffPages` تغيّرت الشاشة والخادم معاً، ولا يبقى زرٌّ يظهر بلا مسار
  //   يقبله، ولا مسارٌ مفتوح خلف زرٍّ مخفيّ.
  const mayDecide = who.role === 'admin' || decidesAtDesk(who.job);

  // ★ الأعمدة مذكورةٌ بأسمائها، لا `*`. فـ`*` تُخرج غداً كل عمودٍ يُضاف —
  //   والسعر والمُخرَج المولَّد عمودان في هذا الجدول نفسه.
  // ★ كانت القراءة مقصوصةً عند أحدث ١٢٠ طلباً — فالملفّ المدفوع القديم
  //   الواقف، وهو أولى ما يُعمل، يخرج من الشاشة حين تكبر القائمة. فصار
  //   كل ما لم يُغلق يُقرأ كاملاً، والمُغلق يُقرأ لتسعين يوماً للعلم.
  //   ومَن لا تقرّر (رغد) لا يصلها صفُّ ما قبل الدفع أصلاً — ليس من عملها.
  const since = new Date(Date.now() - 90 * 86400_000).toISOString();
  const cols = 'id, company_id, service_title, service_category, status, client_note, track, created_at, updated_at, paid_at, price, quoted_price';
  const reqQ = mayDecide
    ? sb.from('service_requests').select(cols)
        .or('status.not.in.(completed,cancelled,rejected),created_at.gte.' + since)
    : sb.from('service_requests').select(cols).in('status', [...OPEN_PAID_STATUSES]);
  const { data: reqs, error: reqErr } = await reqQ.order('created_at', { ascending: false });
  if (reqErr) return fail('الطلبات', reqErr);

  // ★ قبول الخدمات للموظفتين (٢١ سبتمبر): صار كل طلبٍ من الكتالوج يُسعَّر
  //   آلياً فيقف «بانتظار الدفع» ولا يمرّ بـ«ينتظر كلمتك» أبداً — فبقي زرّا
  //   الاعتماد والرفض بلا طلبٍ واحدٍ يقعان عليه. فصار المسعَّر يُعرض عليهما:
  //   يُرفض إن لم يكن جادّاً، ويُقبل بتأكيد التحويل حين يصل إيصالُه.
  //   والسعر يخرج للمسعَّر وحده — هو ما يراه العميل نفسه على شاشته، ولا بدّ
  //   منه لمطابقة التحويل. ونِسب الأتعاب والعقود لا تزال لا تغادر الخادم.
  const pricedIds = mayDecide ? (reqs || []).filter((r) => r.status === 'priced').map((r) => String(r.id)) : [];
  const { data: pend, error: payErr } = pricedIds.length
    ? await sb.from('payments')
        .select('id, service_request_id, amount_sar, method, transfer_receipt_url, created_at')
        .in('service_request_id', pricedIds)
        .eq('status', 'awaiting_confirmation')
    : { data: [] as Array<Record<string, unknown>>, error: null };
  if (payErr) return fail('التحويلات', payErr);
  const payBy = new Map<string, Record<string, unknown>>();
  for (const p of (pend || [])) {
    let receipt = (p.transfer_receipt_url as string | null) || null;
    if (receipt && !/^https?:/i.test(receipt)) {
      const { data: sg } = await sb.storage.from('receipts').createSignedUrl(receipt, 60 * 60);
      receipt = sg?.signedUrl || null;
    }
    payBy.set(String(p.service_request_id), {
      id: p.id, amount_sar: p.amount_sar, method: p.method, receipt_url: receipt, created_at: p.created_at,
    });
  }

  // طلبات المطابقة قرارٌ كلُّها — فلا تُقرأ لمن لا تقرّر
  const { data: matches, error: mErr } = mayDecide
    ? await sb.from('match_requests')
        .select('id, company_id, track, status, requested_at')
        .eq('status', 'requested')
        .order('requested_at', { ascending: true })
        .limit(60)
    : { data: [] as Array<Record<string, unknown>>, error: null };
  if (mErr) return fail('طلبات المطابقة', mErr);

  // بيانات الاتصال كاملة — بأمر المالك، فبها تعمل: تتصل وتتابع وتُذكّر.
  const ids = Array.from(new Set([
    ...(reqs || []).map((r) => String(r.company_id)),
    ...(matches || []).map((r) => String(r.company_id)),
  ].filter(Boolean)));

  const { data: cos, error: cErr } = ids.length
    ? await sb.from('companies').select('id, company_name, owner_name, phone, city, sector, account_status').in('id', ids)
    : { data: [] as Array<Record<string, unknown>>, error: null };
  if (cErr) return fail('المنشآت', cErr);
  const { data: contacts } = ids.length
    ? await sb.from('company_contacts').select('company_id, contact_email').in('company_id', ids)
    : { data: [] as Array<Record<string, unknown>> };

  const mail = new Map((contacts || []).map((c) => [String(c.company_id), c.contact_email]));
  const byId = new Map((cos || []).map((c) => [String(c.id), { ...c, contact_email: mail.get(String(c.id)) || null }]));

  // ملفّات ما بعد الدفع: آخر ما سُجّل عليها، وهل فيها أرقامٌ مالية، وهل خدمتها
  // تستوجب مطابقة وكم نتيجةً خرجت — فتعرف رغد أين وقف كل ملفٍّ وما خطوته
  const paidCos = Array.from(new Set((reqs || []).filter((r) => (OPEN_PAID_STATUSES as readonly string[]).includes(String(r.status))).map((r) => String(r.company_id)).filter(Boolean)));
  const [{ data: evs }, { data: fins }, { data: mres }] = paidCos.length ? await Promise.all([
    sb.from('deal_events').select('company_id, title, detail, actor, created_at').in('company_id', paidCos).order('created_at', { ascending: false }).limit(300),
    sb.from('financial_data').select('company_id').in('company_id', paidCos),
    sb.from('match_results').select('company_id').in('company_id', paidCos).gt('fit_score', 0),
  ]) : [{ data: [] }, { data: [] }, { data: [] }];
  const evBy = new Map<string, { title: string; detail: string | null; actor: string | null; created_at: string }[]>();
  for (const e of (evs || []) as { company_id: string; title: string; detail: string | null; actor: string | null; created_at: string }[]) {
    const k = String(e.company_id); const l = evBy.get(k) || [];
    if (l.length < 4) l.push({ title: e.title, detail: e.detail, actor: e.actor, created_at: e.created_at });
    evBy.set(k, l);
  }
  const paidSr = (reqs || []).filter((r) => (OPEN_PAID_STATUSES as readonly string[]).includes(String(r.status))).map((r) => String(r.id));
  const { data: sfs } = paidSr.length ? await sb.from('success_fees').select('service_request_id, funder_name, approved_amount, expected_disbursement, booked_at').in('service_request_id', paidSr) : { data: [] };
  const finSet = new Set((fins || []).map((f: { company_id: string }) => String(f.company_id)));
  const mCount = new Map<string, number>();
  for (const m of (mres || []) as { company_id: string }[]) mCount.set(String(m.company_id), (mCount.get(String(m.company_id)) || 0) + 1);

  return NextResponse.json({
    role: who.role,
    job: who.role === 'admin' ? 'admin' : who.job,
    may_decide: mayDecide,
    // ★ ١ أكتوبر: الأحداث تُنقّى كما في `admin/deal` — كان فيها «دفعة مؤكَّدة — 990 ريال» خاماً
    files: Object.fromEntries(paidCos.map((c) => [c, { events: who.role === 'admin' ? (evBy.get(c) || []) : redactTimeline(evBy.get(c) || []), has_financials: finSet.has(c), matches: mCount.get(c) || 0 }])),
    // مرحلة التمويل لكل ملف — الجهة والمبلغ المعتمد وموعد الصرف وهل قُيِّد (بلا أتعاب ولا فاتورة: تلك للمالك)
    funding: Object.fromEntries((sfs || []).map((f: Record<string, unknown>) => [String(f.service_request_id), { funder: f.funder_name, approved: f.approved_amount, expected: f.expected_disbursement, booked: !!f.booked_at }])),
    requests: (reqs || []).map((r) => {
      const { price, quoted_price, ...rest } = r as Record<string, unknown>;
      // السعر ومبلغ التحويل لمن يقرّر وحده — بهما يطابق التحويل. ورغد لا
      // يصلها سعرٌ ولا ما دفعه عميل (قاعدة المالك)؛ وكانا يصلانها للعلم.
      const isPriced = mayDecide && r.status === 'priced';
      return {
        ...rest,
        price: isPriced ? (price ?? quoted_price ?? null) : null,
        payment: isPriced ? (payBy.get(String(r.id)) || null) : null,
        company: byId.get(String(r.company_id)) || null,
      };
    }),
    matches: (matches || []).map((r) => ({ ...r, company: byId.get(String(r.company_id)) || null })),
  });
}

export async function PATCH(req: Request) {
  const { who, error, status } = await atDesk();
  if (!who) return NextResponse.json({ error }, { status });

  // ★ القرار في هذا المكتب واقعٌ على عميلٍ **لم يدفع بعد** — اعتمادُ طلبٍ،
  //   أو رفضُه، أو تأكيدُ تحويله. وذاك صفُّ ضي وحدها بقسمة المالك
  //   (٢٧ سبتمبر). ورغد ترى المكتب لتعرف ملفّاتها المدفوعة وأرقام أصحابها،
  //   ولا تقرّر فيه. ويُمنع هنا لا بإخفاء الزرّ: ما وصل الجهازَ وُصل إليه.
  // ★ «سجّلي ما تم» على ملفٍّ مدفوع (٣٠ سبتمبر): كان «واقف منذ ٤٣ يوماً» يُحسب من
  //   آخر تغيّرٍ في الطلب، وعملُ رغد مع الجهات لا يُكتب فيه — فبدا الملف ساكناً
  //   وهي تعمل. فصار كلُّ ما تسجّله أثراً في خطّ الصفقة يحرّك تاريخ الملف،
  //   ومعه نقلُه بين «قيد التجهيز» و«قيد المتابعة».
  {
    const b0 = await req.clone().json().catch(() => ({} as Record<string, unknown>));
    if (String(b0?.kind || '') === 'log') {
      const id = String(b0.id || '');
      const done = String(b0.done || '').trim().slice(0, 600);
      const missing = String(b0.missing || '').trim().slice(0, 400);
      const next = String(b0.next || '').trim().slice(0, 300);
      const to = String(b0.status || '');
      if (!id || (!done && !b0.milestone)) return NextResponse.json({ error: 'اكتبي ما تمّ على الملف' }, { status: 400 });
      const sb = admin();
      const { data: r } = await sb.from('service_requests').select('id, company_id, service_title, status').eq('id', id).maybeSingle();
      if (!r) return NextResponse.json({ error: 'الملف غير موجود' }, { status: 404 });
      if (!(OPEN_PAID_STATUSES as readonly string[]).includes(String(r.status))) return NextResponse.json({ error: 'هذا الملف ليس ملفاً مدفوعاً مفتوحاً' }, { status: 409 });
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (['in_progress', 'in_follow_up'].includes(to) && to !== r.status) patch.status = to;
      const { error: uErr } = await sb.from('service_requests').update(patch).eq('id', id);
      if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 });
      const name = who.role === 'admin' ? 'المالك' : (who.email === 'raghad@murdi.sa' ? 'رغد' : who.email === 'dhai@murdi.sa' ? 'ضي' : who.email);
      // ★ مرحلة التمويل (٥ أكتوبر): «وافقت الجهة» لا يُقبل بلا الجهة والمبلغ وموعد الصرف،
      //   و«قُيِّد التمويل» يحسب أتعاب الاستكمال من العقد ويُصدر فاتورةً مسوّدةً تنتظر المالك.
      const milestone = String(b0.milestone || '');
      let feeNote = '';
      if (milestone === 'approved') {
        const funder = String(b0.funder || '').trim().slice(0, 120);
        const amount = Number(String(b0.amount || '').replace(/[^\d.]/g, ''));
        const date = String(b0.expected || '').slice(0, 10);
        if (!funder || !(amount > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          return NextResponse.json({ error: '«وافقت الجهة» يحتاج: اسم الجهة، والمبلغ المعتمد، وموعد الصرف المتوقع' }, { status: 400 });
        }
        const { error: fErr } = await sb.from('success_fees').upsert({
          service_request_id: id, company_id: r.company_id, funder_name: funder, approved_amount: amount,
          expected_disbursement: date, approved_logged_at: new Date().toISOString(), approved_logged_by: name, updated_at: new Date().toISOString(),
        }, { onConflict: 'service_request_id' });
        if (fErr) return NextResponse.json({ error: fErr.message }, { status: 500 });
        feeNote = 'وافقت ' + funder + ' — الصرف المتوقع ' + date;
      } else if (milestone === 'booked') {
        const { data: f } = await sb.from('success_fees').select('id, approved_amount, funder_name, invoice_status').eq('service_request_id', id).maybeSingle();
        if (!f) return NextResponse.json({ error: 'سجّلي «وافقت الجهة» أولاً (الجهة والمبلغ وموعد الصرف)' }, { status: 400 });
        if (f.invoice_status === 'draft' || f.invoice_status === 'approved') return NextResponse.json({ error: 'قُيِّد هذا التمويل من قبل وصدرت فاتورته' }, { status: 409 });
        const booked = Number(String(b0.amount || '').replace(/[^\d.]/g, '')) || Number(f.approved_amount);
        let calc;
        try { calc = await feeFromContract(sb, id, booked); }
        catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : 'تعذّر حساب الأتعاب' }, { status: 400 }); }
        const invoiceNo = await nextInvoiceNo(sb);
        const { error: bErr } = await sb.from('success_fees').update({
          booked_amount: booked, booked_at: new Date().toISOString(), booked_by: name, contract_id: calc.contractId,
          fee_pct: calc.pct, vat_rate: calc.vatRate, vat_inclusive: calc.inclusive, fee_net: calc.net, fee_vat: calc.vat, fee_total: calc.total,
          invoice_no: invoiceNo, invoice_status: 'draft', updated_at: new Date().toISOString(),
        }).eq('id', f.id);
        if (bErr) return NextResponse.json({ error: bErr.message }, { status: 500 });
        feeNote = 'قُيِّد التمويل لدى ' + f.funder_name;
        const { data: co } = await sb.from('companies').select('company_name').eq('id', r.company_id).maybeSingle();
        const money = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 2 });
        await sendPush({ title: '🧾 فاتورة استكمال تنتظر اعتمادك', body: (co?.company_name || '') + ' — ' + money(calc.total) + ' ريال (' + calc.pct + '٪ من ' + money(booked) + ')', url: '/admin/fees', important: true, tag: 'fee-' + id }, OWNER).catch(() => null);
        await sendMail({ from: FROM, to: OWNER, subject: '🧾 فاتورة استكمال تنتظر اعتمادك — ' + (co?.company_name || ''),
          html: '<div dir="rtl" style="font-family:Arial;line-height:1.9;color:#1A3D34">قُيِّد تمويل <b>' + esc(co?.company_name) + '</b> لدى ' + esc(f.funder_name) + ' بمبلغ ' + money(booked) + ' ريال.<br>أتعاب الاستكمال (' + calc.pct + '٪ من العقد): ' + money(calc.net) + ' + ضريبة ' + money(calc.vat) + ' = <b>' + money(calc.total) + ' ريال</b>' + ' (شاملة الضريبة)' + '.<br>الفاتورة ' + invoiceNo + ' مسوّدة لا تخرج قبل اعتمادك.<p><a href="https://murdi.sa/admin/fees" style="background:#1A3D34;color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none">راجِع واعتمد</a></p></div>' }).catch(() => null);
      }
      await sb.from('deal_events').insert({
        company_id: r.company_id, kind: 'file_update', title: (feeNote ? feeNote + ' · ' : '') + done.slice(0, 200),
        detail: [missing ? 'ينقصه: ' + missing : '', next ? 'الخطوة التالية: ' + next : '', 'سجّلته: ' + name].filter(Boolean).join(' · '),
        actor: who.role === 'admin' ? 'admin' : 'staff', needs_owner: false,
      });
      await logStaff(who, 'file_update', { table: 'service_requests', id, note: done });
      return NextResponse.json({ ok: true });
    }
  }

  if (who.role !== 'admin' && !decidesAtDesk(who.job)) {
    return NextResponse.json(
      { error: 'هذه الشاشة للاطلاع عندك — اعتمادُ الطلبات وتأكيد التحويلات ليس من عملك' },
      { status: 403 }
    );
  }

  const b = await req.json().catch(() => ({} as Record<string, unknown>));
  const kind = String(b?.kind || '');
  const id = String(b?.id || '');
  const approve = String(b?.action || '') !== 'reject';
  const note = b?.note ? String(b.note).slice(0, 400) : '';
  if (!id) return NextResponse.json({ error: 'id مطلوب' }, { status: 400 });

  const sb = admin();
  const actor = who.role === 'admin' ? 'المالك' : (who.email || 'المكتب');

  let headline = '';
  // ما لم يكتمل بعد تأكيد التحويل — يُعاد للموظفة ويُكتب للمالك، لا يُبتلع
  let payNote: string | null = null;
  let companyId = '';
  let companyName = '';

  if (kind === 'service') {
    const { data: r } = await sb
      .from('service_requests')
      .select('id, company_id, service_title, status')
      .eq('id', id)
      .maybeSingle();
    if (!r) return NextResponse.json({ error: 'الطلب غير موجود' }, { status: 404 });
    companyId = String(r.company_id || '');
    const st = String(r.status);

    if (st === 'priced') {
      // المسعَّر: قبولُه = تأكيدُ أن العميل حوّل ثمنه. فلا يُقبل بلا تحويلٍ
      // وصل إيصالُه — وإلا بدأ المكتب عملاً لم يُدفع ثمنه.
      if (approve) {
        const { data: pay } = await sb.from('payments')
          .select('id, amount_sar')
          .eq('service_request_id', id)
          .eq('status', 'awaiting_confirmation')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!pay) {
          return NextResponse.json({ error: 'لم يصل تحويلٌ لهذا الطلب بعد — يُقبل حين يرفع العميل إيصاله' }, { status: 409 });
        }
        const res = await confirmPayment(sb, String(pay.id), who.email || 'المكتب');
        if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
        payNote = res.note;
        headline = 'قُبل طلب خدمة وأُكّد تحويله (' + Number(pay.amount_sar || 0).toLocaleString('en-US') + ' ريال) — ' + String(r.service_title || '');
      } else {
        const { error: upErr } = await sb
          .from('service_requests')
          .update({ status: 'rejected', updated_at: new Date().toISOString() })
          .eq('id', id)
          .eq('status', 'priced');
        if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
        // تحويلٌ معلّق على طلبٍ رُفض لا يبقى معلّقاً في لوحة المدفوعات
        // وكان فشلُه يُبتلع: فيبقى التحويل «ينتظر تأكيدكم» في الوارد والفرص
        // الساخنة لطلبٍ مرفوض. يُقال للمالك ويُعلَّم أثرُ الصفقة.
        const { error: rjErr } = await sb.from('payments').update({ status: 'rejected' })
          .eq('service_request_id', id).eq('status', 'awaiting_confirmation');
        if (rjErr) payNote = 'رُفض الطلب ولم يُرفض تحويله المعلّق (' + rjErr.message + ') — ارفضه من لوحة المدفوعات.';
        headline = 'رُفض طلب خدمة — ' + String(r.service_title || '');
      }
    } else {
      // ★ لا يُعتمد إلا ما ينتظر. وبدون هذا الشرط تُعيد ضغطةٌ متأخرة طلباً
      //   مُسلَّماً إلى «قيد التجهيز»، فيبدو العمل غير منجزٍ وهو منجز.
      if (st !== AWAITING) {
        return NextResponse.json({ error: 'هذا الطلب لم يعد بانتظار الاعتماد — حالته: ' + r.status }, { status: 409 });
      }
      const { error: upErr } = await sb
        .from('service_requests')
        .update({ status: approve ? 'in_progress' : 'rejected', updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('status', AWAITING);
      if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
      headline = (approve ? 'اعتُمد طلب خدمة' : 'رُفض طلب خدمة') + ' — ' + String(r.service_title || '');
    }
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
  const evRes = await sb.from('deal_events').insert({
    company_id: companyId || null,
    kind: kind === 'match' ? 'match_request' : 'service_request',
    title: headline,
    detail: 'القرار من: ' + actor + (note ? ' · ' + note : '') + (payNote ? ' · ⚠️ ' + payNote : ''),
    actor: who.role === 'admin' ? 'admin' : 'staff',
    needs_owner: !!payNote,
  });
  // القرار نفذ؛ وسقوطُ أثره يُقال للمالك في بريده بدل أن يُبتلع
  const { error: evErr } = evRes;
  if (evErr) payNote = (payNote ? payNote + ' · ' : '') + 'لم يُكتب القرار في خطّ الصفقة (' + evErr.message + ').';

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
        (payNote ? '<p style="margin:10px 0 6px;font-size:13.5px;color:#C0564B"><b>يحتاج يدك:</b> ' + esc(payNote) + '</p>' : '') +
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

  // تفصيل الملاحظة فيه مبالغ وأسعار، وذاك لا يُكتب للموظفة — يصل المالكَ
  // كاملاً في البريد أعلاه، وتُخبَر هي بأن أمراً بقي وأنه أُبلغ.
  const noteForViewer = payNote && who.role !== 'admin'
    ? 'بقي في هذا التحويل أمرٌ يحتاج المالك، وقد أُبلغ به.'
    : payNote;
  await logStaff(who, approve ? 'desk_approve' : 'desk_reject', { table: 'service_requests', id });
  return NextResponse.json({ ok: true, note: noteForViewer });
}
