import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const admin = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

export async function GET() {
  const a = admin();
  const { data: rows, error } = await a.from('match_results')
    .select('id, company_id, track, provider, product, fit_score, apply_channel, apply_url, apply_steps, required_docs, apply_status, apply_note, entity_email')
    .eq('status', 'new').gt('fit_score', 0)
    .order('fit_score', { ascending: false }).limit(400);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const ids = Array.from(new Set((rows || []).map(r => r.company_id)));
  const { data: cos } = await a.from('companies').select('id, company_name, match_progress').in('id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
  const map = new Map((cos || []).map(c => [c.id, c.company_name]));
  const inc = new Map((cos || []).map(c => [c.id, Object.values((c.match_progress || {}) as Record<string, unknown>).some(v => typeof v === 'number')]));
  const ids2 = ids.length ? ids : ['00000000-0000-0000-0000-000000000000'];
  const { data: srv } = await a.from('service_requests').select('company_id, service_title, status').in('company_id', ids2);
  const { data: con } = await a.from('contracts').select('company_id, status').in('company_id', ids2);
  const fileReady = new Map<string, boolean>();
  const contractOk = new Map<string, boolean>();
  for (const r of (srv || [])) {
    if (['delivered', 'completed', 'paid'].includes(String(r.status))) fileReady.set(r.company_id, true);
  }
  for (const r of (con || [])) {
    if (['signed', 'issued', 'active'].includes(String(r.status))) contractOk.set(r.company_id, true);
  }
  return NextResponse.json({ ok: true, rows: (rows || []).map(r => ({ ...r, company_name: map.get(r.company_id) || '', incomplete: inc.get(r.company_id) || false, file_ready: fileReady.get(r.company_id) || false, contract_ok: contractOk.get(r.company_id) || false })) });
}

export async function PATCH(req: Request) {
  const { id, apply_status, apply_note } = await req.json();
  if (!id) return NextResponse.json({ error: 'id مطلوب' }, { status: 400 });
  const patch: Record<string, unknown> = { };
  if (apply_status) { patch.apply_status = apply_status; if (apply_status === 'قُدِّم') patch.applied_at = new Date().toISOString(); }
  if (apply_note !== undefined) patch.apply_note = apply_note;
  const { error } = await admin().from('match_results').update(patch).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
