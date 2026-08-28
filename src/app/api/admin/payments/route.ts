import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { runAutoMatch } from '@/lib/matchEngine';
import { logError } from '@/lib/logError';
import { requireAdmin } from '@/lib/requireAdmin';

const ADMIN_EMAIL = 'hololalmurdi.fs@gmail.com';

async function getAdmin() {
  const cookieStore = await cookies();
  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await sb.auth.getUser();
  if (!user || user.email !== ADMIN_EMAIL) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string);
}

// GET: كل المدفوعات + اسم الشركة
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return NextResponse.json({ error: denied }, { status: 401 });
  const admin = await getAdmin();
  if (admin === null) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  const { data: pays } = await admin.from('payments').select('*').order('created_at', { ascending: false });
  const ids = [...new Set((pays || []).map((p) => p.company_id).filter(Boolean))];
  const names: Record<string, string> = {};
  if (ids.length) {
    const { data: comps } = await admin.from('companies').select('id, company_name').in('id', ids);
    for (const c of (comps || [])) names[c.id] = c.company_name || '';
  }
  // الإيصالات في دلو خاص: يُوقَّع رابط مؤقت لكل واحد وقت العرض، فيفتح فعلاً
  const rows = await Promise.all((pays || []).map(async (p) => {
    let receipt: string | null = p.transfer_receipt_url || null;
    if (receipt && !/^https?:/i.test(receipt)) {
      const { data: sg } = await admin.storage.from('receipts').createSignedUrl(receipt, 60 * 60);
      receipt = sg?.signedUrl || null;
    }
    return { ...p, transfer_receipt_url: receipt, company_name: p.company_id ? (names[p.company_id] || '—') : '—' };
  }));
  return NextResponse.json({ payments: rows });
}

// POST { id, action: 'confirm' } : تأكيد تحويل وتفعيل الاشتراك
export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return NextResponse.json({ error: denied }, { status: 401 });
  const admin = await getAdmin();
  if (admin === null) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const id: string = body?.id || '';
  const action: string = body?.action || '';
  if (!id) return NextResponse.json({ error: 'id مطلوب' }, { status: 400 });

  const { data: pay } = await admin.from('payments').select('*').eq('id', id).maybeSingle();
  if (!pay) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });

  if (action === 'confirm') {
    await admin.from('payments').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', id);
    if (pay.kind === 'subscription' && pay.company_id) {
      // التجديد المبكر يُضاف إلى ما تبقّى، لا يمحوه
      const { data: curCo } = await admin.from('companies').select('subscription_end').eq('id', pay.company_id).maybeSingle();
      const cur = curCo?.subscription_end ? new Date(curCo.subscription_end) : null;
      const until = cur && cur > new Date() ? new Date(cur) : new Date();
      until.setMonth(until.getMonth() + 4);
      await admin.from('companies').update({ subscription_active: true, subscription_end: until.toISOString(), account_status: 'active' }).eq('id', pay.company_id);
      // المطابقة يُطلقها العميل بنفسه من بوابته بعد التفعيل
    }
    // عند تأكيد تحويل خدمة: يُعلَّم الطلب الذي دُفع من أجله وحده.
    // كان هذا السطر يُحدّث كل طلبات العميل المسعّرة دفعةً واحدة — فيُسلَّم ثلاث خدمات بثمن واحدة.
    let linkNote: string | undefined;
    if (pay.kind === 'service' && pay.company_id) {
      const stamp = { status: 'paid', payment_id: id, paid_at: new Date().toISOString(), payment_ref: id, updated_at: new Date().toISOString() };
      if (pay.service_request_id) {
        await admin.from('service_requests').update(stamp).eq('id', pay.service_request_id);
      } else {
        // دفعات قديمة بلا رقم طلب: نطابق بالمبلغ، ولا نخمّن حين يتعدد المرشّح
        const { data: cands } = await admin.from('service_requests')
          .select('id, price, quoted_price')
          .eq('company_id', pay.company_id).eq('status', 'priced');
        const amt = Number(pay.amount_sar || 0);
        const hit = (cands || []).filter((c: { price: number | null; quoted_price: number | null }) =>
          Number(c.price ?? c.quoted_price ?? -1) === amt);
        if (hit.length === 1) {
          await admin.from('service_requests').update(stamp).eq('id', hit[0].id);
        } else {
          linkNote = hit.length === 0
            ? 'لم يُطابق أي طلب مسعّر مبلغَ هذه الدفعة — اربطها بالطلب يدوياً من لوحة الخدمات.'
            : 'أكثر من طلب مسعّر بنفس المبلغ — لم يُعلَّم أيٌّ منها تلقائياً حتى لا يُسلَّم طلب بلا دفع. اربطها يدوياً.';
        }
      }
    }
    return NextResponse.json({ ok: true, note: linkNote });
  }
  if (action === 'reject') {
    await admin.from('payments').update({ status: 'rejected' }).eq('id', id);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: 'إجراء غير معروف' }, { status: 400 });
}
