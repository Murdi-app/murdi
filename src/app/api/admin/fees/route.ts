import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/requireAdmin';
import { loadFeeSettings } from '@/lib/feeSettings';

// أتعاب الاستكمال وفواتيرها — للمالك وحده: ما وافقت عليه الجهات، وما قُيِّد، والفاتورة المسوّدة واعتمادها.
export const dynamic = 'force-dynamic';
const admin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string);

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return NextResponse.json({ error: denied }, { status: 401 });
  const sb = admin();
  const { data, error } = await sb.from('success_fees').select('*').order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const ids = Array.from(new Set((data || []).map((f) => String(f.company_id)).filter(Boolean)));
  const { data: cos } = ids.length ? await sb.from('companies').select('id, company_name, cr_number, owner_name, city').in('id', ids) : { data: [] };
  const { data: v } = await sb.from('fee_settings').select('value').eq('key', 'seller_vat_number').maybeSingle();
  const s = await loadFeeSettings(sb);
  const co = new Map((cos || []).map((c) => [String(c.id), c]));
  return NextResponse.json({ ok: true, seller_vat: String(v?.value || ''), vat_rate: s.vatRate, fees: (data || []).map((f) => ({ ...f, company: co.get(String(f.company_id)) || null })) });
}

// POST { id, action: 'approve' | 'cancel' } · { seller_vat }
export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return NextResponse.json({ error: denied }, { status: 401 });
  const sb = admin();
  const b = await req.json().catch(() => ({} as Record<string, unknown>));
  if (b.seller_vat !== undefined) {
    const vat = String(b.seller_vat || '').replace(/\D/g, '');
    if (vat && vat.length !== 15) return NextResponse.json({ error: 'الرقم الضريبي ١٥ رقماً' }, { status: 400 });
    const { error } = await sb.from('fee_settings').upsert({ key: 'seller_vat_number', value: vat }, { onConflict: 'key' });
    return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ ok: true });
  }
  const id = String(b.id || ''), action = String(b.action || '');
  if (!id || !['approve', 'cancel'].includes(action)) return NextResponse.json({ error: 'طلبٌ ناقص' }, { status: 400 });
  const patch = action === 'approve'
    ? { invoice_status: 'approved', invoice_approved_at: new Date().toISOString(), updated_at: new Date().toISOString() }
    : { invoice_status: 'cancelled', updated_at: new Date().toISOString() };
  const { data, error } = await sb.from('success_fees').update(patch).eq('id', id).eq('invoice_status', 'draft').select('id');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data?.length) return NextResponse.json({ error: 'الفاتورة ليست مسوّدة' }, { status: 409 });
  return NextResponse.json({ ok: true });
}
