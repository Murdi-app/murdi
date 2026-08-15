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
  const amountSar: number = Number(body?.amountSar || 0);
  const kind: string = body?.kind || 'subscription';
  const description: string = body?.description || '';
  let receiptUrl: string = body?.receiptUrl || '';
  const note: string = body?.note || '';

  if (!companyId) {
    try {
      const store = await cookies();
      const ss = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL as string,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
        { cookies: { getAll: () => store.getAll(), setAll: () => {} } }
      );
      const { data: au } = await ss.auth.getUser();
      if (au?.user) {
        const { data: co } = await admin().from('companies')
          .select('id, receipt_path').eq('user_id', au.user.id)
          .order('created_at', { ascending: false }).limit(1).maybeSingle();
        const row = co as Record<string, unknown> | null;
        if (row) {
          companyId = String(row.id || '');
          const rp = String(row.receipt_path || '');
          if (!receiptUrl && rp) {
            const { data: pub } = admin().storage.from('receipts').getPublicUrl(rp);
            receiptUrl = pub?.publicUrl || '';
          }
        }
      }
    } catch {}
  }
  if (!companyId || !amountSar) {
    return NextResponse.json({ error: 'بيانات ناقصة' }, { status: 400 });
  }

  const sb = admin();
  const { error } = await sb.from('payments').insert({
    company_id: companyId,
    kind,
    description: description || (kind === 'subscription' ? 'اشتراك العضوية الربعي' : 'خدمة'),
    amount_sar: amountSar,
    method: 'transfer',
    status: 'awaiting_confirmation',
    transfer_receipt_url: receiptUrl || null,
    transfer_note: note || null,
  });

  if (error) return NextResponse.json({ error: 'تعذّر تسجيل التحويل' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
