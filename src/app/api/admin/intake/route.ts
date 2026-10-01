import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requirePage } from '@/lib/requireStaff';
import { waNumber } from '@/lib/phone';
import { COMMERCIAL, FUNDING_TITLE, intakeQuote } from '@/lib/servicePricing';
import { loadFeeSettings, CONTRACT_FINANCE } from '@/lib/feeSettings';
import { ensureDocument, issuedMessage } from '@/lib/contractFirst';
import { sendPush } from '@/lib/push';
import { OWNER_EMAIL } from '@/lib/notifyLead';
import { asOwnership, asRoute } from '@/lib/ownership';
import { canonicalTitle, CATALOG } from '@/lib/serviceCatalog';
import { isPaidStatus } from '@/lib/serviceStatus';

// فتح ملف عميلٍ باعته الموظفة بالهاتف.
//
// يصنع في نداءٍ واحد ما كان العميل يصنعه بيده في أربع خطوات: حسابه،
// ومنشأته، وأرقام مشروعه، وطلب الخدمة مسعَّراً. ثم يُعيد رابطاً يفتحه
// فيجد كل ذلك جاهزاً وأمامه زرّ الدفع.
//
// وثلاثة أشياء لا يفعلها عمداً:
//   • لا يولّد الوثيقة — تُجهَّز بعد تأكيد التحويل، وإلا سلّمنا ما لم يُدفع.
//   • لا يُسعَّر من الواجهة — السعر يُقرأ من طبقة التسعير في الخادم كما في
//     طلب العميل نفسه، فلا تكتب موظفةٌ رقماً.
//   • لا يمنح كلمة مرور — الرابط يضعها العميل بنفسه.

const SERVICE = 'دراسة الجدوى الاقتصادية';

// ★ ومسارٌ ثانٍ: منشأة قائمة تطلب «تجهيز ملف التمويل».
//   كانت الأداة لا تفتح إلا الفحص الائتماني لمشروعٍ جديد، وتشترط أرقام
//   مشروع (سعر وحدة ووحدات وتكلفة تجهيز) لا معنى لها لشركةٍ قائمة. فوقف
//   «فاست بارسل» (٣٠ سبتمبر): طلب ملف التمويل ولا طريق يُريه مبلغاً يدفعه —
//   لا حساب له، ولا تملك ضي أداةً تفتح له طلباً مسعَّراً.
//   فالخيار هنا من خيارات الخدمة نفسها (quick ٩٩٠ · full ٧٬٩٠٠)، والسعر من
//   الخادم كما في طلب العميل بنفسه.
type Kind = 'feasibility' | 'funding';

const admin = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  );

const cut = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n);
const numOf = (v: unknown) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };

export async function POST(req: Request) {
  const { who, error: denied, status: gate } = await requirePage('/admin/hot');
  if (denied || !who) return NextResponse.json({ error: denied || 'غير مصرح' }, { status: gate });

  const b = await req.json().catch(() => ({}));
  const fullName = cut(b?.full_name, 120);
  const email = cut(b?.email, 160).toLowerCase();
  const phone = waNumber(b?.phone);
  const companyName = cut(b?.company_name, 200) || ('مشروع ' + fullName);
  const city = cut(b?.city, 80) || null;
  const sector = cut(b?.sector, 120) || null;
  const raw = (b?.inputs && typeof b.inputs === 'object') ? b.inputs as Record<string, unknown> : {};

  // الملكية تُضيَّق هنا لا تُمرَّر كما جاءت: القيَم مقيَّدة بـCHECK في
  // القاعدة، وقيمةٌ غريبة تُسقط إدراج المنشأة كله لا الحقل وحده.
  const ownershipType = asOwnership(b?.ownership_type) || null;
  const crRoute = asRoute(b?.cr_route) || null;
  const ownerNationality = cut(b?.owner_nationality, 80) || null;
  // الخدمة: أيُّ عنوانٍ في الفهرس (service_title)، ويبقى «funding» القديم مفهوماً
  const title = canonicalTitle(cut(b?.service_title, 120) || (b?.service === 'funding' ? FUNDING_TITLE : SERVICE));
  if (!CATALOG.some((cat) => cat.items.includes(title))) {
    return NextResponse.json({ error: 'خدمة غير معروفة' }, { status: 400 });
  }
  const kind: Kind = title === SERVICE ? 'feasibility' : 'funding';
  const hasOptions = !!COMMERCIAL[title]?.options?.length;
  const optionKey: string | null = hasOptions ? (cut(b?.option, 20) || 'quick') : null;
  const units = numOf(b?.units);
  const value = numOf(b?.value);

  if (!fullName) return NextResponse.json({ error: 'الاسم مطلوب' }, { status: 400 });
  if (!phone) return NextResponse.json({ error: 'رقم الجوال غير صحيح — اكتبيه 05xxxxxxxx' }, { status: 400 });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'البريد غير صحيح — وبلا بريدٍ لا يُفتح حساب ولا يُرسل رابط' }, { status: 400 });
  }

  const inputs = {
    capex: numOf(raw.capex), workingCapital: numOf(raw.workingCapital),
    unitPrice: numOf(raw.unitPrice), unitsYear1: numOf(raw.unitsYear1),
    growthRate: numOf(raw.growthRate), variableCostPct: numOf(raw.variableCostPct),
    fixedCostsAnnual: numOf(raw.fixedCostsAnnual), inflationRate: numOf(raw.inflationRate),
    ownFunds: numOf(raw.ownFunds), financingAmount: numOf(raw.financingAmount),
    financingYears: numOf(raw.financingYears) || 4, financingRate: numOf(raw.financingRate) || 8,
  };
  if (kind === 'feasibility' && optionKey === 'quick' && (inputs.unitPrice <= 0 || inputs.unitsYear1 <= 0 || (inputs.capex + inputs.workingCapital) <= 0)) {
    return NextResponse.json({ error: 'أرقام المشروع ناقصة — لا يُفتح ملف بلا سعر ووحدات وتكلفة' }, { status: 400 });
  }

  const sb = admin();

  // ═══ الحساب ═══
  // من سبق أن سجّل ببريده لا يُفتح له ثانٍ — يُستعمل حسابه القائم، ويُرسل
  // له رابط دخول بدل رابط تعيين. وإلا صار للرجل حسابان وضاع بينهما ملفه.
  let userId = '';
  let isNew = false;
  const { data: created, error: cErr } = await sb.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name: fullName, phone, source: 'intake', opened_by: who.email },
  });
  if (created?.user?.id) { userId = created.user.id; isNew = true; }
  else {
    // البريد مستعمل — يُبحث عن صاحبه في `profiles` لا بتصفّح المستخدمين.
    // كان البحث يقرأ أول مئتَي حساب فقط، فمن كان بعدهم لا يُعثر عليه ويُردّ
    // بخطأ وهو مسجَّل — عيبٌ لا يظهر اليوم ويظهر حين تكبر القائمة.
    const { data: prof } = await sb.from('profiles').select('id').eq('email', email).maybeSingle();
    if (prof?.id) userId = String(prof.id);
    else {
      const { data: list } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const hit = (list?.users || []).find((u) => String(u.email || '').toLowerCase() === email);
      if (!hit) return NextResponse.json({ error: 'تعذّر فتح الحساب: ' + (cErr?.message || 'سبب غير معروف') }, { status: 500 });
      userId = hit.id;
    }
  }

  // صفّ التعريف كما يكتبه التسجيل العادي — فلا يختلف من فُتح له ملفٌ من
  // مكالمة عمّن سجّل بنفسه في أي شاشة تقرأ هذا الجدول.
  await sb.from('profiles').upsert({ id: userId, email, company_name: companyName }, { onConflict: 'id' });

  // ═══ المنشأة ═══
  const { data: existingCo } = await sb.from('companies').select('id, company_name').eq('user_id', userId).maybeSingle();
  let companyId = existingCo?.id as string | undefined;
  // منشأة قائمة: تُستكمل ملكيتها إن كانت فارغة، ولا تُطمس إن كانت مسجَّلة.
  // فمكالمةٌ ثانية لم يُسأل فيها عن الملكية كانت ستمسح جواب الأولى.
  if (companyId && (ownershipType || crRoute || ownerNationality)) {
    const patch: Record<string, string> = {};
    if (ownershipType) patch.ownership_type = ownershipType;
    if (crRoute) patch.cr_route = crRoute;
    if (ownerNationality) patch.owner_nationality = ownerNationality;
    if (Object.keys(patch).length > 0) await sb.from('companies').update(patch).eq('id', companyId);
  }
  if (!companyId) {
    const { data: co, error: coErr } = await sb.from('companies').insert({
      user_id: userId, company_name: companyName, owner_name: fullName,
      phone, city, sector, account_status: 'active',
      ownership_type: ownershipType, cr_route: crRoute, owner_nationality: ownerNationality,
      admin_note: 'فُتح من مكالمة — ' + (who.role === 'admin' ? 'د. عبدالحكيم' : who.email),
    }).select('id').single();
    if (coErr || !co) return NextResponse.json({ error: 'تعذّر إنشاء المنشأة: ' + (coErr?.message || '') }, { status: 500 });
    companyId = co.id;
  }

  // ═══ الطلب — مسعَّراً من الخادم لا من الواجهة ═══
  // السعر من الخادم وحده. والجدوى يُسعَّر مدرَّجها بحجم الاستثمار من أرقام المشروع إن كُتبت.
  // ★ «تمويل العقد» يُسعَّر مقدَّمه من إعدادات المالك وبقيمة العقد الفعلية (`value`)
  const fees = await loadFeeSettings(sb).catch(() => null);
  const isCF = title === CONTRACT_FINANCE;
  const quote = intakeQuote(title, optionKey, kind === 'feasibility' && inputs.capex + inputs.workingCapital > 0
    ? inputs.capex + inputs.workingCapital : value, units, isCF ? fees?.cfUpfront : null);
  if (quote.amount === null || quote.amount <= 0) {
    return NextResponse.json({ error: quote.error || 'لا سعر معلن — حوّليه للدكتور' }, { status: 400 });
  }
  const opt = { label: quote.label };
  let amount: number = quote.amount;

  // ★ كان يُلتقط أيُّ طلبٍ «غير مغلق» — ومنه المدفوع والمرفوض — فتُكتب أرقام
  //   المكالمة فوق مدخلات طلبٍ مدفوع، ويُبلَّغ العميل «جاهز للدفع» عمّا دفعه.
  //   فالمدفوع يردّ صاحبَه إلى رغد، والمسعَّر وحده يُعاد استعماله.
  const { data: existing, error: exErr } = await sb.from('service_requests')
    .select('id, status')
    .eq('company_id', companyId).eq('service_title', title)
    .order('created_at', { ascending: false });
  if (exErr) return NextResponse.json({ error: 'تعذّرت قراءة طلبات العميل — ' + exErr.message }, { status: 500 });
  // الترقية من الحكم الائتماني المدفوع إلى الملف الكامل تمضي — ويُخصم ما دُفع
  // خلال ثلاثين يوماً كما في طلب العميل بنفسه (/api/services/order).
  let creditedFrom: string | null = null;
  const paid = (existing || []).filter((r) => isPaidStatus(r.status));
  if (hasOptions && optionKey !== 'quick' && paid.length > 0) {
    const { data: all } = await sb.from('service_requests')
      .select('id, option_key, price, paid_at')
      .eq('company_id', companyId).eq('service_title', title);
    const nonQuickPaid = (all || []).some((r) => r.paid_at && r.option_key && r.option_key !== 'quick');
    if (nonQuickPaid) {
      return NextResponse.json({ error: 'لهذا العميل ملف تمويل مدفوع — ملفّه بعد الدفع عند رغد، لا يُفتح له طلبٌ جديد من هنا' }, { status: 409 });
    }
    const since = Date.now() - 30 * 86400_000;
    const q = (all || []).filter((r) => r.option_key === 'quick' && r.paid_at && new Date(String(r.paid_at)).getTime() >= since)
      .sort((a, b2) => String(b2.paid_at).localeCompare(String(a.paid_at)))[0];
    const { data: used } = q
      ? await sb.from('service_requests').select('id').eq('credited_from', q.id).limit(1).maybeSingle()
      : { data: null };
    const qp = Number(q?.price || 0);
    if (q && !used && qp > 0 && qp < amount) { amount = amount - qp; creditedFrom = String(q.id); }
  } else if (paid.length > 0) {
    return NextResponse.json({ error: 'لهذا العميل طلبٌ مدفوع لهذه الخدمة — ملفّه بعد الدفع عند رغد، لا يُفتح له طلبٌ جديد من هنا' }, { status: 409 });
  }
  const { data: pricedRows } = await sb.from('service_requests')
    .select('id, option_key').eq('company_id', companyId).eq('service_title', title).eq('status', 'priced')
    .order('created_at', { ascending: false });
  // المسعَّر يُعاد استعماله إن كان للخيار نفسه؛ وإلا أُلغي ليبقى أمامه زرّ دفعٍ واحد
  const open = (pricedRows || []).find((r) => (r.option_key || null) === optionKey) || null;
  const stale = (pricedRows || []).filter((r) => r.id !== open?.id).map((r) => r.id);
  if (stale.length > 0) await sb.from('service_requests').update({ status: 'cancelled' }).in('id', stale);
  // المسعَّر للخيار نفسه يُعاد بسعره الجديد (سنواتٌ أكثر أو قيمة عقدٍ أخرى)
  if (open) await sb.from('service_requests').update({ price: amount, quoted_price: amount, priced_at: new Date().toISOString(), ...(isCF && value > 0 ? { contract_value: value } : {}) }).eq('id', open.id);

  let requestId = open?.id as string | undefined;
  if (!requestId) {
    const { data: sr, error: srErr } = await sb.from('service_requests').insert({
      company_id: companyId, service_title: title,
      service_category: CATALOG.find((cat) => cat.items.includes(title))?.label || null,
      status: 'priced', price: amount, quoted_price: amount, priced_at: new Date().toISOString(),
      option_key: optionKey, credited_from: creditedFrom,
      ...(isCF && value > 0 ? { contract_value: value } : {}),
      client_inputs: kind === 'feasibility'
        ? { option: optionKey, totalInvestment: inputs.capex + inputs.workingCapital, projectKind: 'new' }
        : { option: optionKey, ...(value > 0 ? { totalInvestment: value } : {}), ...(units > 0 ? { years: units } : {}) },
    }).select('id').single();
    if (srErr || !sr) return NextResponse.json({ error: 'تعذّر إنشاء الطلب: ' + (srErr?.message || '') }, { status: 500 });
    requestId = sr.id;
  }

  // ═══ أرقام مشروعه — يقرؤها مولّد الفحص كما لو أدخلها المكتب ═══
  if (kind === 'feasibility' && inputs.unitPrice > 0) await sb.from('service_inputs').upsert({
    service_request_id: requestId, company_id: companyId,
    activity_kind: 'feasibility', inputs,
    updated_by: who.email, updated_at: new Date().toISOString(),
  }, { onConflict: 'service_request_id' });

  // ═══ الوثيقة قبل الدفع (١ أكتوبر) ═══
  //
  // كانت الرسالة تحمل رابط الدفع ورابط supabase طويلاً لكلمة المرور — والعميل
  // يدفع قبل أن يرى عقداً. فصار: ما فيه نسبة ← مسودّة عقدٍ يراجعها الدكتور
  // ويُصدرها ثم تخرج الرسالة؛ وما برسمٍ ثابت ← سند خدمةٍ يصدر الآن، والرسالة
  // تحمل رابطه القصير (وفيه رابط السداد ورابط المنصة). ولا رابط طويل للعميل.
  let doc: Awaited<ReturnType<typeof ensureDocument>>;
  try { doc = await ensureDocument(sb, String(requestId)); }
  catch (e) { return NextResponse.json({ error: 'فُتح ملفه وتعذّر إصدار وثيقة الخدمة — ' + (e instanceof Error ? e.message : '') + '. راجعي الدكتور قبل أن ترسلي له شيئاً.' }, { status: 502 }); }

  let message = '';
  let link = '';
  let hold = false;
  if (doc.kind === 'contract') {
    hold = true;
    message = 'عقد «' + title + '» مسودّةٌ بانتظار مراجعة الدكتور وإصداره — لا يُرسل للعميل شيءٌ الآن. '
      + 'يصل الدكتورَ إشعارٌ بالمسودّة، وحين يُصدرها تخرج رسالة العميل ومعها رابط العقد.';
    await sendPush({
      title: '📄 عقدٌ ينتظر إصدارك', body: companyName + ' — ' + title + ' · راجع النسبة والمقدَّم ثم أصدره',
      url: '/admin/services', important: true, tag: 'contract-draft-' + requestId,
    }, OWNER_EMAIL).catch(() => null);
  } else {
    try { const m = await issuedMessage(sb, String(requestId), who.email); message = m.text; link = m.link; }
    catch (e) { return NextResponse.json({ error: 'صدر السند وتعذّر بناء الرسالة — ' + (e instanceof Error ? e.message : '') }, { status: 502 }); }
  }

  await sb.from('deal_events').insert({
    company_id: companyId, kind: 'service',
    title: 'فُتح ملف من مكالمة: ' + companyName,
    detail: (opt?.label || 'الفحص') + ' بـ' + amount + ' ريال — بانتظار دفعه · فتحه ' + (who.role === 'admin' ? 'د. عبدالحكيم' : who.email),
    actor: who.role === 'admin' ? 'owner' : 'staff', needs_owner: false,
  });

  return NextResponse.json({
    ok: true, link, hold, message, company_name: companyName, request_id: requestId, existing: !isNew,
    service_label: opt?.label || title, amount,
  });
}
