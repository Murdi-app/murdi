import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requirePage } from '@/lib/requireStaff';
import { logError } from '@/lib/logError';
import { ownerOf, staffContacts, asOwner } from '@/lib/leadOwners';

// أسئلة الاستشارة المختصرة (١٢ أكتوبر، المالك).
//
// ★ «قبل ما نصدر لهم استشارة، عطني أسئلة قليلة مبسّطة لكل شخص على وضعه، وضي ترسلها
//   لكل عميل» — فلكل طلبٍ رسالةُ أسئلةٍ مكتوبةٌ على وضعه هو (`ask_message`). ترسلها
//   ضي واتساب بضغطة، وتعلّمها مُرسَلة، ثم تلصق ما ردّ به العميل (`ask_reply`)
//   فتُبنى عليه استشارته المختصرة.
// ★ والكتابة هنا ضيّقة عمداً: تعليم الإرسال ولصق الرد فقط — لا يُعدَّل نصّ الأسئلة
//   ولا غيره من الطلب من هذا الباب.

const sbAdmin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string);

export async function GET() {
  const { who, error, status } = await requirePage('/admin/journey');
  if (!who) return NextResponse.json({ error: error || 'غير مصرح' }, { status });
  const { data, error: qErr } = await sbAdmin().from('service_inquiries')
    .select('id, full_name, company_name, phone, ask_message, ask_sent_at, ask_reply, ask_reply_at, created_at, consult_status, consult_code, consult_sent_at, consult_opened_at')
    .not('ask_message', 'is', null)
    .order('created_at', { ascending: false })
    .limit(200);
  if (qErr) { await logError('staff.asks.get', qErr, {}); return NextResponse.json({ error: 'تعذّر تحميل الأسئلة' }, { status: 500 }); }
  // ★ ١٤ أكتوبر (المالك): «رغد تخاف ترسل أسئلة وضي ما كلّمتهم» — فلكل طلبٍ آخرُ نتيجة مكالمة
  //   ومن كتبها. ورغد لا ترسل الأسئلة إلا لمن كُلِّم (أو اتُّصل به ولم يرد) — والمكالمة لضي أولاً.
  const ids = (data || []).map((r) => String(r.id));
  const last: Record<string, { outcome: string | null; note: string | null; actor: string | null; at: string }> = {};
  if (ids.length) {
    const { data: t } = await sbAdmin().from('hot_touches').select('ref_id, outcome, note, actor_name, created_at')
      .in('ref_id', ids).order('created_at', { ascending: false }).limit(1000);
    for (const x of t || []) {
      const k = String(x.ref_id);
      if (!last[k] && x.outcome !== 'تحوّل عميلاً') last[k] = { outcome: x.outcome, note: x.note, actor: x.actor_name, at: String(x.created_at) };
    }
  }
  let rows = data || [];
  const ownerBy = new Map<string, string>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data: o } = await sbAdmin().from('lead_owners').select('ref_id, owner').eq('source', 'inquiry').in('ref_id', ids.slice(i, i + 200));
    for (const x of o || []) ownerBy.set(String(x.ref_id), String(x.owner));
  }
  // ★ القسمة (١٤ أكتوبر): الموظفة ترى أسئلة عملائها هي فقط
  if (who.role === 'staff') rows = rows.filter((r) => ownerBy.get(String(r.id)) === who.userId);
  // ★ ١٥ أكتوبر: الرسالة باسم صاحبة العميل
  const contacts = await staffContacts(sbAdmin());
  const asks = rows.map((r) => ({ ...r, ask_message: asOwner(String(r.ask_message || ''), contacts.get(ownerBy.get(String(r.id)) || '')), call: last[String(r.id)] || null }));
  return NextResponse.json({ ok: true, asks });
}

export async function PATCH(req: Request) {
  const { who, error, status } = await requirePage('/admin/journey');
  if (!who) return NextResponse.json({ error: error || 'غير مصرح' }, { status });
  const b = await req.json().catch(() => ({}));
  const id = String(b?.id || '');
  if (!id) return NextResponse.json({ error: 'الطلب غير محدد' }, { status: 400 });
  const patch: Record<string, unknown> = {};
  if (b.sent === true) patch.ask_sent_at = new Date().toISOString();
  if (b.consultSent === true) patch.consult_sent_at = new Date().toISOString();
  if (typeof b.reply === 'string') {
    const r = b.reply.trim().slice(0, 4000);
    if (!r) return NextResponse.json({ error: 'الصقي رد العميل أولاً' }, { status: 400 });
    patch.ask_reply = r; patch.ask_reply_at = new Date().toISOString();
  }
  if (!Object.keys(patch).length) return NextResponse.json({ error: 'لا شيء للحفظ' }, { status: 400 });
  if (who.role === 'staff') {
    const o = await ownerOf(sbAdmin(), 'inquiry', id);
    if (o && o !== who.userId) return NextResponse.json({ error: 'هذا العميل عند زميلتك' }, { status: 403 });
  }
  const { error: uErr } = await sbAdmin().from('service_inquiries').update(patch).eq('id', id).not('ask_message', 'is', null);
  if (uErr) { await logError('staff.asks.patch', uErr, { id }); return NextResponse.json({ error: 'لم يُحفظ — حاولي مرة ثانية' }, { status: 500 }); }
  return NextResponse.json({ ok: true });
}
