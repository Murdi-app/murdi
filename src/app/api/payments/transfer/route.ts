import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  );
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
  if (kind === 'service') {
    if (!serviceRequestId) return NextResponse.json({ error: 'رقم الطلب مطلوب' }, { status: 400 });
    const { data: sr } = await sb0.from('service_requests')
      .select('id, company_id, price, quoted_price, status').eq('id', serviceRequestId).maybeSingle();
    if (!sr || String(sr.company_id) !== companyId) {
      return NextResponse.json({ error: 'طلب غير معروف' }, { status: 403 });
    }
    // المستحق من `price` وحده — وهو عمودٌ لا يكتبه العميل. و`quoted_price`
    // كان يُقبل بديلاً، وهو كان مكتوباً من المتصفح، فيدفع أحدهم ريالاً بإيصال
    // صحيح عن خدمة بـ٧٬٩٠٠. حزامٌ ثانٍ فوق منع الكتابة في القاعدة.
    const due = Number(sr.price ?? 0);
    if (!due || due <= 0) return NextResponse.json({ error: 'هذه الخدمة لم تُسعَّر بعد' }, { status: 409 });
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
  const { data: dup } = await dupQ.maybeSingle();
  if (dup) {
    await sb.from('payments').update({
      amount_sar: amountSar,
      transfer_receipt_url: receiptUrl || null,
      transfer_note: note || null,
      service_request_id: serviceRequestId || null,
    }).eq('id', dup.id);
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
