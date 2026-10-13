import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/requireAdmin';

// مراجعة المالك للاستشارات المحجوزة (١٣ أكتوبر): «ما فهمت وش أسوي». فكل محجوزةٍ هنا بسطرٍ
// واحد: لمن، ولماذا حُجزت بكلامٍ بسيط، ورابطها، وزرّان: «اعتمدها» أو «أعد كتابتها بملاحظتي».
// للمالك وحده — لا تمرّ بها موظفة.
const sb = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string);

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return NextResponse.json({ error: denied }, { status: 401 });
  const { data, error } = await sb().from('service_inquiries')
    .select('id, full_name, company_name, ask_reply, consult_error, consult_code, consult_sent_at, consult_draft_html, consult_at')
    .eq('consult_status', 'held').order('consult_at', { ascending: false }).limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, rows: (data || []).map((r) => ({ ...r, has_draft: !!r.consult_draft_html, consult_draft_html: undefined })) });
}

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return NextResponse.json({ error: denied }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const id = String(b?.id || '');
  if (!id) return NextResponse.json({ error: 'الطلب غير محدد' }, { status: 400 });
  const db = sb();
  if (b.action === 'approve') {
    const { data: r } = await db.from('service_inquiries').select('consult_draft_html').eq('id', id).maybeSingle();
    const patch: Record<string, unknown> = { consult_status: 'ready', consult_error: null };
    if (r?.consult_draft_html) { patch.consult_html = r.consult_draft_html; patch.consult_draft_html = null; }
    const { error } = await db.from('service_inquiries').update(patch).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  if (b.action === 'rewrite') {
    const note = String(b.note || '').trim().slice(0, 1500);
    const { error } = await db.from('service_inquiries').update({ consult_status: null, consult_tries: 0, consult_error: null, consult_owner_note: note || null }).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: 'إجراء غير معروف' }, { status: 400 });
}
