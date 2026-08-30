import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/requireAdmin';

// صندوق التعميد — كل ما يحتاج كلمة المالك في مكان واحد، يُجاب عليه من الجوال بنقرة.
// وترتيبه بالمال لا بالتاريخ: بندٌ يؤخّر ستمئة ألف يسبق بنداً يؤخّر خطاباً.

const admin = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

export async function GET(req: Request) {
  const denied = await requireAdmin();
  if (denied) return NextResponse.json({ error: denied }, { status: 401 });
  const status = new URL(req.url).searchParams.get('status') || 'pending';

  const { data, error } = await admin().from('approvals')
    .select('*, companies(company_name)')
    .eq('status', status)
    .order('urgency', { ascending: true })   // money < normal < low أبجدياً بالمصادفة، فنرتّب بعدها يدوياً
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const RANK: Record<string, number> = { money: 0, normal: 1, low: 2 };
  const rows = (data || []).slice().sort((a, b) =>
    (RANK[String(a.urgency)] ?? 1) - (RANK[String(b.urgency)] ?? 1));

  const { count: pending } = await admin().from('approvals')
    .select('id', { count: 'exact', head: true }).eq('status', 'pending');

  return NextResponse.json({ ok: true, items: rows, pending: pending || 0 });
}

export async function PATCH(req: Request) {
  const denied = await requireAdmin();
  if (denied) return NextResponse.json({ error: denied }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const id = String(b?.id || '');
  if (!id) return NextResponse.json({ error: 'id مطلوب' }, { status: 400 });

  const { data: item } = await admin().from('approvals').select('*').eq('id', id).maybeSingle();
  if (!item) return NextResponse.json({ error: 'بند غير موجود' }, { status: 404 });

  if (b.action === 'cancel') {
    await admin().from('approvals').update({ status: 'cancelled', answered_at: new Date().toISOString() }).eq('id', id);
    return NextResponse.json({ ok: true });
  }

  const key = String(b?.answer_key || '');
  const opts = Array.isArray(item.options) ? item.options as { key: string }[] : [];
  if (!key || !opts.some(o => o.key === key)) {
    return NextResponse.json({ error: 'جواب غير معروف' }, { status: 400 });
  }
  // بند يطلب رقماً لا يُعتمد فارغاً — وإلا صدر عقد بنسبة صفر
  if (item.value_label && key === 'yes' && !String(b?.answer_value || '').trim()) {
    return NextResponse.json({ error: 'اكتب ' + item.value_label + ' قبل الاعتماد' }, { status: 422 });
  }

  const { error } = await admin().from('approvals').update({
    status: 'answered',
    answer_key: key,
    answer_value: b.answer_value ? String(b.answer_value).slice(0, 200) : null,
    answer_note: b.answer_note ? String(b.answer_note).slice(0, 1000) : null,
    answered_at: new Date().toISOString(),
  }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
