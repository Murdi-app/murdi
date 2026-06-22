import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { fetchPayment, toSAR } from '@/lib/moyasar';

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
  const kind = meta.kind || 'subscription';
  const isPaid = mp.status === 'paid';

  // هل سبق تسجيل هذه الدفعة؟ (idempotent)
  const { data: existing } = await sb
    .from('payments')
    .select('id')
    .eq('moyasar_id', mp.id)
    .maybeSingle();

  const row = {
    company_id: companyId,
    kind,
    description: mp.description || null,
    amount_sar: toSAR(mp.amount),
    method: 'online',
    status: isPaid ? 'paid' : (mp.status === 'failed' ? 'failed' : 'pending'),
    moyasar_id: mp.id,
    paid_at: isPaid ? new Date().toISOString() : null,
  };

  if (existing) {
    await sb.from('payments').update(row).eq('id', existing.id);
  } else {
    await sb.from('payments').insert(row);
  }

  return NextResponse.json({ ok: true, status: mp.status, paid: isPaid });
}
