import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/requireAdmin';
import { requireStaff } from '@/lib/requireStaff';

const admin = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

export async function GET() {
  const { who, error: denied } = await requireStaff();
  if (denied || !who) return NextResponse.json({ error: denied || 'غير مصرح' }, { status: 401 });
  const a = admin();
  let mine: string[] | null = null;
  if (who.role === 'staff') {
    const { data: my } = await a.from('companies').select('id').eq('assigned_to', who.userId);
    mine = (my || []).map(c => c.id);
    if (!mine.length) return NextResponse.json({ ok: true, rows: [], role: who.role, can_send: who.canSend });
  }
  let q = a.from('match_results')
    .select('id, company_id, track, provider, product, fit_score, apply_channel, apply_url, apply_steps, required_docs, apply_status, apply_note, verdict, region, requirements')
    .eq('status', 'new').gt('fit_score', 0)
    .order('fit_score', { ascending: false }).limit(400);
  if (mine) q = q.in('company_id', mine);
  const { data: rows, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const ids = Array.from(new Set((rows || []).map(r => r.company_id)));
  const { data: cos } = await a.from('companies').select('id, company_name, match_progress').in('id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
  const map = new Map((cos || []).map(c => [c.id, c.company_name]));
  const inc = new Map((cos || []).map(c => [c.id, Object.values((c.match_progress || {}) as Record<string, unknown>).some(v => typeof v === 'number')]));
  const ids2 = ids.length ? ids : ['00000000-0000-0000-0000-000000000000'];
  const { data: srv } = await a.from('service_requests').select('company_id, service_title, status').in('company_id', ids2);
  const { data: con } = await a.from('contracts').select('company_id, status').in('company_id', ids2);
  const { data: msgs } = await a.from('outreach_messages')
    .select('id, match_row_id, entity_email, subject, message_body, admin_edited_body, status, sent_at, alt_contact, contact_method')
    .in('company_id', ids2).neq('status', 'مستبدلة');
  const draft = new Map<string, Record<string, unknown>>();
  for (const m of (msgs || [])) {
    if (!m.match_row_id) continue;
    const prev = draft.get(m.match_row_id);
    if (!prev || String(m.status) === 'مرسلة') draft.set(m.match_row_id, m);
  }
  const fileReady = new Map<string, boolean>();
  const contractOk = new Map<string, boolean>();
  for (const r of (srv || [])) {
    if (['delivered', 'completed', 'paid'].includes(String(r.status))) fileReady.set(r.company_id, true);
  }
  for (const r of (con || [])) {
    if (['signed', 'issued', 'active'].includes(String(r.status))) contractOk.set(r.company_id, true);
  }
  return NextResponse.json({ ok: true, rows: (rows || []).map(r => ({ ...r, company_name: map.get(r.company_id) || '', incomplete: inc.get(r.company_id) || false, file_ready: fileReady.get(r.company_id) || false, contract_ok: contractOk.get(r.company_id) || false, draft: draft.get(r.id) || null })), role: who.role, can_send: who.canSend });
}

export async function PATCH(req: Request) {
  const denied = await requireAdmin();
  if (denied) return NextResponse.json({ error: denied }, { status: 401 });
  const { id, apply_status, apply_note } = await req.json();
  if (!id) return NextResponse.json({ error: 'id مطلوب' }, { status: 400 });
  const patch: Record<string, unknown> = { };
  if (apply_status) { patch.apply_status = apply_status; if (apply_status === 'قُدِّم') patch.applied_at = new Date().toISOString(); }
  if (apply_note !== undefined) patch.apply_note = apply_note;
  const { error } = await admin().from('match_results').update(patch).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
