import { NextResponse } from 'next/server';
import { contractGate } from '@/lib/contractGate';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  );
}

// GET ?sr=<id> : المبلغ المستحق لطلبٍ يملكه صاحب الجلسة — من سعره المحفوظ.
//
// ★ كانت صفحة التحويل تعرض المبلغ من الرابط (?amount=) وتطلب تحويله، والخادم
//   يسجّل سعر الطلب. فرابطٌ قديم، أو سعرٌ خُصم منه بعد إرسال الرابط، يجعل
//   العميل يحوّل مبلغاً ويُقيَّد له غيره — ولا شيء يكشف الفرق. فصارت الصفحة
//   تسأل هنا، وتعرض ما سيُقيَّد لا ما في الرابط.
export async function GET(req: Request) {
  const srId = new URL(req.url).searchParams.get('sr') || '';
  if (!srId) return NextResponse.json({ error: 'رقم الطلب مطلوب' }, { status: 400 });
  try {
    const store = await cookies();
    const ss = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
      { cookies: { getAll: () => store.getAll(), setAll: () => {} } }
    );
    const { data: au } = await ss.auth.getUser();
    if (!au?.user) return NextResponse.json({ error: 'يلزم تسجيل الدخول' }, { status: 401 });
    const sb = admin();
    const { data: sr } = await sb.from('service_requests')
      .select('id, company_id, price, status, service_title').eq('id', srId).maybeSingle();
    if (!sr) return NextResponse.json({ error: 'طلب غير معروف' }, { status: 404 });
    const { data: mine } = await sb.from('companies').select('id').eq('user_id', au.user.id).eq('id', sr.company_id).maybeSingle();
    if (!mine) return NextResponse.json({ error: 'طلب غير معروف' }, { status: 403 });
    return NextResponse.json({
      ok: true, status: sr.status, title: sr.service_title,
      amount: sr.status === 'priced' && Number(sr.price) > 0 ? Number(sr.price) : null,
      contract_first: await contractGate(sb, { id: String(sr.id), service_title: sr.service_title }),
    });
  } catch {
    return NextResponse.json({ error: 'تعذّر التحقق من الطلب' }, { status: 500 });
  }
}

// POST { companyId, amountSar, kind, description, receiptUrl, note }
// يسجّل عملية تحويل بنكي بانتظار تأكيد الأدمن
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  let companyId: string = body?.companyId || '';
  let amountSar: number = Number(body?.amountSar || 0);
  const kind: string = body?.kind || 'service';
  const description: string = body?.description || '';
  let receiptUrl: string = body?.receiptUrl || '';
  const note: string = body?.note || '';
  const serviceRequestId: string = body?.serviceRequestId || '';

  // الهوية تُؤخذ من الجلسة دائماً، لا من الجسم — وإلا أنشأ أي أحد دفعاتٍ باسم عميل آخر
  {
    try {
      const store = await cookies();
      const ss = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL as string,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
        { cookies: { getAll: () => store.getAll(), setAll: () => {} } }
      );
      const { data: au } = await ss.auth.getUser();
      if (!au?.user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
      const { data: co } = await admin().from('companies')
        .select('id, receipt_path').eq('user_id', au.user.id)
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      const row = co as Record<string, unknown> | null;
      if (!row) return NextResponse.json({ error: 'لا يوجد ملف منشأة' }, { status: 404 });
      companyId = String(row.id || '');
      const rp = String(row.receipt_path || '');
      if (!receiptUrl && rp) receiptUrl = rp;
    } catch {
      return NextResponse.json({ error: 'تعذّر التحقق من الجلسة' }, { status: 401 });
    }
  }

  const sb0 = admin();

  // مبلغ الخدمة يُحسب من سعرها المحفوظ، لا من الرابط.
  // كان المبلغ يأتي من ?amount=… فيدفع العميل مئة ريال عن خدمة بعشرين ألفاً بإيصال صحيح.
  // ★ لم يبقَ في المنصة ما يُدفع إلا خدمةٌ مسعَّرة. وكان أي نوعٍ آخر غير
  //   «اشتراك» — `match_run` مثلاً — يمرّ بمبلغٍ يرسله المتصفح، وتأكيدُه يمنح
  //   تشغيلة مطابقة. فالباب يُغلق لكل ما سوى الخدمة.
  if (kind !== 'service' && kind !== 'subscription') {
    return NextResponse.json({ error: 'الدفع يكون مقابل خدمة مسعَّرة' }, { status: 410 });
  }

  if (kind === 'service') {
    if (!serviceRequestId) return NextResponse.json({ error: 'رقم الطلب مطلوب' }, { status: 400 });
    const { data: sr } = await sb0.from('service_requests')
      .select('id, company_id, price, quoted_price, status, service_title').eq('id', serviceRequestId).maybeSingle();
    if (!sr || String(sr.company_id) !== companyId) {
      return NextResponse.json({ error: 'طلب غير معروف' }, { status: 403 });
    }
    // يُحوَّل لما ينتظر الدفع وحده. رابطٌ قديم في سجلّ المتصفح كان يُنشئ دفعةً
    // ثانية لطلبٍ مدفوع، فيُطالَب العميل مرتين أو تُمنح تشغيلةٌ ثانية.
    if (String(sr.status) !== 'priced') {
      return NextResponse.json({ error: 'هذا الطلب لا ينتظر دفعاً — حالته الآن: ' + String(sr.status) }, { status: 409 });
    }
    // المستحق من `price` وحده — وهو عمودٌ لا يكتبه العميل. و`quoted_price`
    // كان يُقبل بديلاً، وهو كان مكتوباً من المتصفح، فيدفع أحدهم ريالاً بإيصال
    // صحيح عن خدمة بـ٧٬٩٠٠. حزامٌ ثانٍ فوق منع الكتابة في القاعدة.
    const due = Number(sr.price ?? 0);
    if (!due || due <= 0) return NextResponse.json({ error: 'هذه الخدمة لم تُسعَّر بعد' }, { status: 409 });
    const blocked = await contractGate(sb0, { id: String(sr.id), service_title: sr.service_title });
    if (blocked) return NextResponse.json({ error: blocked, contract_first: true }, { status: 409 });
    amountSar = due;
  }

  // الاشتراك ورسم التشغيل أُلغيا معاً. ولم يبقَ في المنصة ما يُدفع إلا خدمة
  // مسعَّرة. فالباب يُغلق صراحةً بدل أن يُسعَّر بمبلغ لم يعد له وجود — وإلا
  // بقي رابط قديم يُنشئ دفعة عن شيء لا نبيعه.
  if (kind === 'subscription') {
    return NextResponse.json(
      { error: 'لم يعد هناك اشتراك في المنصة — الدفع يكون مقابل خدمة مسعَّرة' },
      { status: 410 }
    );
  }

  if (!companyId || !amountSar) {
    return NextResponse.json({ error: 'بيانات ناقصة' }, { status: 400 });
  }

  const sb = sb0;
  // التكرار يُقاس بالطلب لا بالعميل: عميل له طلبان مسعّران يدفع لكلٍّ منهما دفعةً مستقلة
  let dupQ = sb.from('payments').select('id')
    .eq('company_id', companyId).eq('kind', kind).eq('status', 'awaiting_confirmation');
  dupQ = serviceRequestId ? dupQ.eq('service_request_id', serviceRequestId) : dupQ.is('service_request_id', null);
  // `.limit(1)`: صفّان معلّقان كانا يُفشلان `maybeSingle` فيُدرج صفٌّ ثالث
  const { data: dup, error: dupErr } = await dupQ.order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (dupErr) return NextResponse.json({ error: 'تعذّر التحقق من تحويلٍ سابق' }, { status: 500 });
  if (dup) {
    const { error: upErr } = await sb.from('payments').update({
      amount_sar: amountSar,
      transfer_receipt_url: receiptUrl || null,
      transfer_note: note || null,
      service_request_id: serviceRequestId || null,
    }).eq('id', dup.id);
    // كان يُردّ «تم» ولو فشل التحديث — فيظنّ العميل أن إيصاله الجديد وصل
    if (upErr) return NextResponse.json({ error: 'تعذّر تحديث التحويل' }, { status: 500 });
    return NextResponse.json({ ok: true, updated: true });
  }
  const { error } = await sb.from('payments').insert({
    company_id: companyId,
    kind,
    description: description || 'خدمة',
    amount_sar: amountSar,
    method: 'transfer',
    status: 'awaiting_confirmation',
    transfer_receipt_url: receiptUrl || null,
    transfer_note: note || null,
    service_request_id: serviceRequestId || null,
  });

  if (error) return NextResponse.json({ error: 'تعذّر تسجيل التحويل' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
