import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireStaff } from '@/lib/requireStaff';
import { buildLeads, leadStats, type RawLead } from '@/lib/leadDesk';

const admin = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

// جدول mini_assessments لم تكن تقرؤه أي صفحة في المنصة: أسماء وهواتف تتراكم منذ يونيو
// بلا شاشة واحدة تعرضها. هذا المسار هو أول من يفتحه.
export async function GET() {
  const { error: denied } = await requireStaff();
  if (denied) return NextResponse.json({ error: denied }, { status: 401 });
  const a = admin();

  const { data: rows, error } = await a.from('mini_assessments')
    .select('id, created_at, full_name, phone, track, score, completed, contacted, src, answers, contacted_at, outcome, contact_note, next_action_at')
    .order('created_at', { ascending: false })
    .limit(1000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // من فتح حساباً فعلاً ليس متابعةً باردة — له مسار العميل لا مسار الاتصال الأول
  const { data: cos } = await a.from('companies').select('phone');
  const phones = (cos || []).map(c => String(c.phone || '')).filter(Boolean);

  const leads = buildLeads((rows || []) as unknown as RawLead[], phones);
  const extra = new Map((rows || []).map(r => [r.id, r]));
  const merged = leads.map(l => ({
    ...l,
    contacted_at: (extra.get(l.id) as Record<string, unknown> | undefined)?.contacted_at ?? null,
    outcome: (extra.get(l.id) as Record<string, unknown> | undefined)?.outcome ?? null,
    contact_note: (extra.get(l.id) as Record<string, unknown> | undefined)?.contact_note ?? null,
    next_action_at: (extra.get(l.id) as Record<string, unknown> | undefined)?.next_action_at ?? null,
  }));

  return NextResponse.json({ ok: true, leads: merged, stats: leadStats(leads) });
}

const OUTCOMES = ['لا يرد', 'مهتم', 'طلب معاودة', 'غير مؤهل الآن', 'تحوّل عميلاً', 'رفض'];

export async function PATCH(req: Request) {
  const { error: denied } = await requireStaff();
  if (denied) return NextResponse.json({ error: denied }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const id = String(body?.id || '');
  if (!id) return NextResponse.json({ error: 'id مطلوب' }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (body.contacted !== undefined) {
    patch.contacted = Boolean(body.contacted);
    // وقت التواصل يُكتب مرة عند أول تعليم، ويُمحى عند التراجع — فلا يبقى تاريخ لاتصال لم يقع
    patch.contacted_at = body.contacted ? new Date().toISOString() : null;
  }
  if (body.outcome !== undefined) {
    const o = String(body.outcome || '');
    if (o && !OUTCOMES.includes(o)) return NextResponse.json({ error: 'نتيجة غير معروفة' }, { status: 400 });
    patch.outcome = o || null;
    if (o) { patch.contacted = true; patch.contacted_at = patch.contacted_at || new Date().toISOString(); }
  }
  if (body.contact_note !== undefined) patch.contact_note = String(body.contact_note || '').slice(0, 2000) || null;
  if (body.next_action_at !== undefined) patch.next_action_at = body.next_action_at || null;
  if (!Object.keys(patch).length) return NextResponse.json({ error: 'لا تغيير' }, { status: 400 });

  const { error } = await admin().from('mini_assessments').update(patch).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
