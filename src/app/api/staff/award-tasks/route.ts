import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requirePage } from '@/lib/requireStaff';
import { isOutcome, OUTCOMES } from '@/lib/outcomes';
import { staffTasks, statusAfterOutcome, whatsappText, waDigits, loadConfig, type Award } from '@/lib/awards';

// مهام الترسيات في «مكالمات اليوم» — صفّ ضي.
//
// ★ لا يخرج منها للموظفة إلا الشركة وصاحب القرار والرقمان ونصّ الواتساب المعتمد:
//   لا الحدود ولا القيمة ولا نص البريد ولا شاشة المالك.
// ★ وكل ضغطةٍ وكل نتيجةٍ تُكتب في `award_touches` (بالقناة واسم الموظفة) وفي
//   `hot_touches` (بمفردة `outcomes`) — فيرى المالك في شاشته كل مراسلة بحرفها.

export const dynamic = 'force-dynamic';
const admin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string);
const STAMP: Record<string, string> = { messaged: 'messaged_at', reminder_call: 'reminder_at', replied: 'replied_at' };

export async function GET() {
  const { who, error, status } = await requirePage('/admin/leads');
  if (!who) return NextResponse.json({ error }, { status });
  try {
    return NextResponse.json({ ok: true, tasks: await staffTasks(admin()), outcomes: OUTCOMES });
  } catch (e) {
    return NextResponse.json({ error: 'تعذّرت قراءة مهام الترسيات — ' + (e instanceof Error ? e.message : '') }, { status: 500 });
  }
}

// POST { id, action: 'call' | 'whatsapp' | 'outcome', outcome?, note? }
export async function POST(req: Request) {
  const { who, error, status } = await requirePage('/admin/leads');
  if (!who) return NextResponse.json({ error }, { status });
  const b = await req.json().catch(() => ({} as Record<string, unknown>));
  const id = String(b.id || '');
  const action = String(b.action || '');
  if (!id || !['call', 'whatsapp', 'outcome'].includes(action)) return NextResponse.json({ error: 'طلبٌ ناقص' }, { status: 400 });
  const outcome = action === 'outcome' ? String(b.outcome || '') : '';
  if (action === 'outcome' && !isOutcome(outcome)) {
    return NextResponse.json({ error: 'نتيجة غير معروفة — المقبول: ' + OUTCOMES.join(' · ') }, { status: 400 });
  }
  const note = String(b.note || '').trim().slice(0, 1000) || null;
  const sb = admin();

  // المهمة قائمةٌ فعلاً: ترسية مؤهَّلة أو «أُرسلت» — لا يُكتب على ما سواها
  const { data: a, error: rErr } = await sb.from('contract_awards')
    .select('id, status, tender_title, buyer_entity, contact_phone, contact_whatsapp').eq('id', id).maybeSingle();
  if (rErr) return NextResponse.json({ error: 'تعذّرت القراءة — ' + rErr.message }, { status: 500 });
  if (!a || !['qualified', 'messaged'].includes(String(a.status))) return NextResponse.json({ error: 'هذه المهمة لم تعد قائمة' }, { status: 409 });

  const { data: me } = await sb.from('staff').select('name').eq('user_id', who.userId).maybeSingle();
  const actor = who.role === 'admin' ? 'د. عبدالحكيم المرضي' : String(me?.name || who.email || 'الفريق');

  let body: string | null = null;
  if (action === 'whatsapp') {
    const { settings } = await loadConfig(sb);
    body = whatsappText(a as Pick<Award, 'tender_title' | 'buyer_entity'>, settings);
    if (!body) return NextResponse.json({ error: 'قالب الواتساب غير معتمد بعد' }, { status: 409 });
  }
  const to = action === 'whatsapp' ? waDigits(a.contact_whatsapp || a.contact_phone) : String(a.contact_phone || a.contact_whatsapp || '');

  const { error: tErr } = await sb.from('award_touches').insert({
    award_id: id, channel: action === 'whatsapp' ? 'whatsapp' : 'call', direction: 'out', actor,
    to_address: to || null, body: action === 'whatsapp' ? body : note, outcome: outcome || null,
  });
  if (tErr) return NextResponse.json({ error: 'لم تُسجَّل — ' + tErr.message }, { status: 500 });

  const { error: hErr } = await sb.from('hot_touches').insert({
    source: 'award', ref_id: id, outcome: outcome || null,
    note: action === 'call' ? 'ضغطت «اتصال»' : action === 'whatsapp' ? 'فتحت الواتساب بالنص المعتمد' : note,
    actor: who.userId, actor_name: actor,
  });

  // الحالة: الواتساب تواصلٌ وقع؛ والنتيجة تقرّر (ردّ · إسقاط · أُرسلت · مكالمة التذكير)
  let next: string | null = null;
  if (action === 'whatsapp' && a.status === 'qualified') next = 'messaged';
  if (action === 'outcome') next = statusAfterOutcome(String(a.status), outcome);
  if (next && next !== a.status) {
    const now = new Date().toISOString();
    const patch: Record<string, unknown> = { status: next, updated_at: now };
    if (STAMP[next]) patch[STAMP[next]] = now;
    const { data: moved, error: mErr } = await sb.from('contract_awards').update(patch).eq('id', id).eq('status', a.status).select('id');
    if (mErr) return NextResponse.json({ error: 'سُجّلت، ولم تُحدَّث حالة الترسية — ' + mErr.message }, { status: 500 });
    if (!moved?.length) return NextResponse.json({ ok: true, warn: 'سُجّلت — وكانت حالة الترسية قد تغيّرت قبلها' });
  }
  return NextResponse.json({ ok: true, status: next || a.status, warn: hErr ? 'سُجّلت في الترسية ولم تُسجَّل في «الفرص الساخنة»' : null });
}
