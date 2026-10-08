import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { fetchPayment, toSAR } from '@/lib/moyasar';
import { confirmPayment } from '@/lib/confirmPayment';

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  );
}

// POST { paymentId } : يتحقق من Moyasar ويسجّل/يحدّث الدفعة
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const paymentId: string = body?.paymentId || '';
  if (!paymentId) return NextResponse.json({ error: 'paymentId مطلوب' }, { status: 400 });

  // التحقق المباشر من Moyasar (مصدر الحقيقة)
  const mp = await fetchPayment(paymentId);
  if (!mp) return NextResponse.json({ error: 'تعذّر التحقق من الدفعة' }, { status: 502 });

  const sb = admin();
  const meta = mp.metadata || {};
  const companyId = meta.company_id || null;
  const kind = meta.kind || 'service';
  const isPaid = mp.status === 'paid';

  // هل سبق تسجيل هذه الدفعة؟ (idempotent)
  const { data: existing } = await sb
    .from('payments')
    .select('id, status')
    .eq('moyasar_id', mp.id)
    .maybeSingle();
  // ما قُيّد لا يُعاد فتحه: الصفحة تُحدَّث، والرابط يُفتح مرتين
  if (existing?.status === 'paid') return NextResponse.json({ ok: true, status: mp.status, paid: true });

  // ★ خدمةٌ تُختم مدفوعةً من بيانات البوابة وحدها، والبيانات الوصفية
  //   يكتبها من أنشأ الدفعة — لا نحن. فدفعةُ ريالٍ واحد تحمل رقمَ طلبٍ
  //   بسبعة آلاف كانت تختمه مدفوعاً. فالطلب يُصدَّق هنا: لصاحب الدفعة،
  //   ومبلغُه سعرُه. وما صدق يمرّ على `confirmPayment` كالتحويل تماماً —
  //   تشغيلةٌ وإشعار وحراسةُ المرّة الواحدة. وما لم يصدق يبقى «بانتظار
  //   التأكيد» في لوحة المدفوعات، فيراه المالك ولا يُمنح شيء آلياً.
  let srId: string | null = null;
  let autoConfirm = false;
  if (isPaid && kind === 'service' && meta.sr && companyId) {
    const { data: sr } = await sb.from('service_requests')
      .select('id, company_id, price').eq('id', meta.sr).maybeSingle();
    if (sr && String(sr.company_id) === String(companyId)) {
      srId = String(sr.id);
      autoConfirm = Number(sr.price ?? 0) > 0 && Number(sr.price) === toSAR(mp.amount);
    }
  }

  const row = {
    company_id: companyId,
    kind,
    description: mp.description || null,
    amount_sar: toSAR(mp.amount),
    method: 'online',
    // المدفوع يدخل منتظراً ثم يُؤكَّد — لا يُكتب «مدفوعاً» مباشرة فيتخطّى التأكيد
    status: isPaid ? 'awaiting_confirmation' : (mp.status === 'failed' ? 'failed' : 'pending'),
    moyasar_id: mp.id,
    service_request_id: srId,
    paid_at: null,
  };

  let payId = existing?.id ? String(existing.id) : '';
  if (payId) {
    const { error } = await sb.from('payments').update(row).eq('id', payId);
    if (error) return NextResponse.json({ error: 'تعذّر تسجيل الدفعة' }, { status: 500 });
  } else {
    const { data: ins, error } = await sb.from('payments').insert(row).select('id').single();
    if (error || !ins) return NextResponse.json({ error: 'تعذّر تسجيل الدفعة' }, { status: 500 });
    payId = String(ins.id);
  }


  if (autoConfirm) {
    const res = await confirmPayment(sb, payId, 'بوابة الدفع');
    // سبقٌ مع تحديثٍ آخر للصفحة نفسها: الدفعة قُيّدت هناك
    if (!res.ok && res.status !== 409) return NextResponse.json({ error: res.error }, { status: res.status });
  }

  return NextResponse.json({ ok: true, status: mp.status, paid: isPaid });
}
