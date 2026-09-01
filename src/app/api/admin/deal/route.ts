import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/requireAdmin';

// لوحة الصفقة: خطّ زمني واحد لكل عميل، ودفتر الأسماء المتراكم.
// نصف العمل الذي يُباع كان يعيش في صندوق بريد؛ هذا المسار يُدخله المنصة.

const admin = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

export async function GET(req: Request) {
  const denied = await requireAdmin();
  if (denied) return NextResponse.json({ error: denied }, { status: 401 });

  const sb = admin();
  const companyId = new URL(req.url).searchParams.get('company_id') || '';

  const { data: companies } = await sb
    .from('companies')
    .select('id, company_name, account_status')
    .order('created_at', { ascending: false });

  if (!companyId) return NextResponse.json({ ok: true, companies: companies || [] });

  const [timeline, contacts, outreach, contract] = await Promise.all([
    sb.from('deal_timeline').select('*').eq('company_id', companyId)
      .order('at', { ascending: false }).limit(200),
    sb.from('entity_contacts').select('*')
      .order('last_seen_at', { ascending: false }).limit(100),
    sb.from('outreach_messages')
      .select('entity_name, entity_email, status, reply_status, sent_at, reply_at, next_followup_at, reply_received')
      .eq('company_id', companyId).order('sent_at', { ascending: false }),
    sb.from('contracts').select('status, fee_percent, fixed_amount, signed_at')
      .eq('company_id', companyId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ]);

  const now = Date.now();
  const rows = outreach.data || [];
  // ما تجاوز موعد معاودته ولم يردّ — هذا هو ما يضيع المال بصمت
  const overdue = rows.filter(
    (r) => !r.reply_at && r.next_followup_at && new Date(r.next_followup_at).getTime() < now
  );
  const silentDays = (d: string | null) =>
    d ? Math.floor((now - new Date(d).getTime()) / 86400000) : null;

  return NextResponse.json({
    ok: true,
    companies: companies || [],
    timeline: timeline.data || [],
    contacts: contacts.data || [],
    outreach: rows.map((r) => ({ ...r, silent_days: silentDays(r.sent_at) })),
    contract: contract.data || null,
    stats: {
      approached: rows.length,
      replied: rows.filter((r) => r.reply_at).length,
      overdue: overdue.length,
    },
  });
}

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return NextResponse.json({ error: denied }, { status: 401 });
  const b = await req.json().catch(() => ({}));

  const companyId = String(b?.company_id || '');
  const title = String(b?.title || '').trim();
  if (!companyId || !title) {
    return NextResponse.json({ error: 'company_id و title مطلوبان' }, { status: 400 });
  }

  const sb = admin();
  const { error } = await sb.from('deal_events').insert({
    company_id: companyId,
    kind: String(b?.kind || 'note'),
    entity_name: b?.entity_name ? String(b.entity_name).slice(0, 200) : null,
    title: title.slice(0, 300),
    detail: b?.detail ? String(b.detail).slice(0, 4000) : null,
    actor: 'owner',
    needs_owner: false,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // كل مكالمة مع جهة تحصد اسماً — الدفتر يُبنى من العمل لا من جلسة إدخال
  if (b?.entity_name && (b?.person_name || b?.person_email || b?.person_phone)) {
    await sb.rpc('record_contact', {
      p_entity_name: String(b.entity_name),
      p_person: b.person_name ? String(b.person_name) : null,
      p_role: b.person_role ? String(b.person_role) : null,
      p_email: b.person_email ? String(b.person_email) : null,
      p_phone: b.person_phone ? String(b.person_phone) : null,
      p_channel: String(b?.kind || 'call'),
      p_company: companyId,
      p_note: b?.detail ? String(b.detail).slice(0, 500) : null,
    });
  }

  return NextResponse.json({ ok: true });
}
