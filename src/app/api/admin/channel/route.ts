import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/requireAdmin';
import { newKey, KEY_NAME } from '@/lib/codexAuth';
import { enqueueReady, sendDue, inWindow, riyadhDayStart } from '@/lib/awardsPipeline';

// قناة الفائزين — لوحة المالك: «ما يحتاج قراري» وحده، وصندوق التوصيات، والصادر وزرّ إيقافه،
// ومفتاح Codex، ومقياس الأتمتة. للمالك وحده (requireAdmin)، وكل قراءةٍ وكتابةٍ بمفتاح الخدمة.

export const dynamic = 'force-dynamic';
export const maxDuration = 120;
const admin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string);
const DR = 'د. عبدالحكيم المرضي';
const now = () => new Date().toISOString();

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return NextResponse.json({ error: denied }, { status: 401 });
  const sb = admin();
  const since7 = new Date(Date.now() - 7 * 86400_000).toISOString();
  const since14 = new Date(Date.now() - 14 * 86400_000).toISOString();
  const [pl, aw, recs, ob, set, keys, calls, tpl, hyp, obj, cur] = await Promise.all([
    sb.from('award_pipeline').select('*'),
    sb.from('contract_awards').select('id, company_name, tender_title, contract_value, status, replied_at, offered_at, gap_sent_at, paid_at, referrals_count, dr_manual, codex_flag, codex_reason, contact_email, gap_pdf_path'),
    sb.from('award_recommendations').select('*').eq('status', 'pending').order('created_at').limit(200),
    sb.from('award_outbox').select('id, award_id, to_address, subject, status, attempts, last_error, sent_at, created_at').order('created_at', { ascending: false }).limit(50),
    sb.from('award_settings').select('key, value').in('key', ['outbox_enabled', 'outbox_daily_cap', 'outbox_hours', 'high_value_min', 'general_email_approved', 'whatsapp_template_approved', 'gap_email_approved']),
    sb.from('api_keys').select('id, name, key_prefix, created_at, revoked_at, last_used_at, client_id, expires_at').is('client_id', null).order('created_at', { ascending: false }).limit(10),
    sb.from('api_calls').select('at, method, path, status, note').order('at', { ascending: false }).limit(20),
    sb.from('award_message_templates').select('id, category, stage, subject, context_paragraph, approved').eq('approved', false),
    sb.from('award_hypotheses').select('*').eq('approved', false),
    sb.from('award_touches').select('id, award_id, actor, said, objection, created_at').eq('objection_important', true).gte('created_at', since14).order('created_at', { ascending: false }),
    sb.from('feed_cursors').select('*').eq('key_name', KEY_NAME).maybeSingle(),
  ]);
  for (const r of [pl, aw, recs, ob, set, keys, calls, tpl, hyp, obj]) if (r.error) return NextResponse.json({ error: r.error.message }, { status: 500 });
  const settings: Record<string, string> = {};
  for (const r of set.data || []) settings[String(r.key)] = String(r.value);
  const awards = new Map((aw.data || []).map((a) => [String(a.id), a]));
  const pipe = (pl.data || []) as Record<string, unknown>[];
  const withAward = (p: Record<string, unknown>) => ({ ...p, award: awards.get(String(p.id)) || null });
  const high = Number(settings.high_value_min || 0);

  // «ما يحتاج قراري» — وحده
  const decisions = {
    yes: pipe.filter((p) => p.state === 'ردّت' && String(awards.get(String(p.id))?.replied_at || '') >= since7).map(withAward),
    consults: pipe.filter((p) => p.state === 'الاستشارة تنتظر اعتمادي').map(withAward),
    templates: tpl.data || [],
    hypotheses: hyp.data || [],
    texts: ['general_email_approved', 'whatsapp_template_approved', 'gap_email_approved'].filter((k) => settings[k] !== 'true'),
    template_recs: (recs.data || []).filter((r) => r.kind === 'template'),
    objections: (obj.data || []).map((t) => ({ ...t, award: awards.get(String(t.award_id)) || null })),
    high_value: pipe.filter((p) => !['مغلقة', 'لا تتواصل', 'دُفع', 'انتقلت لرغد'].includes(String(p.state)) && Number(awards.get(String(p.id))?.contract_value || 0) >= high && high > 0).map(withAward),
    flagged: pipe.filter((p) => awards.get(String(p.id))?.codex_flag === 'needs_dr').map(withAward),
    overdue: pipe.filter((p) => p.overdue === true).map(withAward),
  };

  // مقياس الأتمتة: من بلغ العرض بلا إدخالٍ أو توجيهٍ يدوي من المالك — ومعه الدفع والإحالات
  const all = [...awards.values()];
  const offered = all.filter((a) => a.offered_at || a.gap_sent_at);
  const metric = {
    offered: offered.length,
    offered_auto: offered.filter((a) => !a.dr_manual).length,
    paid: all.filter((a) => a.paid_at).length,
    referrals: all.reduce((x, a) => x + Number(a.referrals_count || 0), 0),
    open: pipe.filter((p) => p.responsible).length,
    by_state: pipe.reduce((m: Record<string, number>, p) => { const k = String(p.state); m[k] = (m[k] || 0) + 1; return m; }, {}),
  };

  const { count: sentToday } = await sb.from('award_outbox').select('id', { count: 'exact', head: true }).eq('status', 'sent')
    .gte('sent_at', riyadhDayStart());
  return NextResponse.json({
    ok: true, decisions, metric,
    recommendations: (recs.data || []).map((r) => ({ ...r, award: awards.get(String(r.award_id)) || null })),
    outbox: { items: ob.data || [], enabled: settings.outbox_enabled === 'true', cap: Number(settings.outbox_daily_cap || 0), hours: settings.outbox_hours, sent_today: sentToday || 0, window: inWindow(settings) },
    keys: keys.data || [], calls: calls.data || [], cursor: cur.data || null,
    mcp: await (async () => {
      const [{ count: live }, { data: lastTok }] = await Promise.all([
        sb.from('oauth_refresh').select('token_hash', { count: 'exact', head: true }).is('revoked_at', null).gt('expires_at', now()),
        sb.from('api_keys').select('last_used_at, created_at').not('client_id', 'is', null).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      ])
      return { linked: (live || 0) > 0, last_used_at: lastTok?.last_used_at || null, linked_at: lastTok?.created_at || null }
    })(),
    pipeline: pipe.map(withAward),
  });
}

// POST { action, … } — كل فعلٍ يُفحص ويُقال فشله
export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return NextResponse.json({ error: denied }, { status: 401 });
  const b = await req.json().catch(() => ({} as Record<string, unknown>));
  const sb = admin();
  const action = String(b.action || '');
  const now = new Date().toISOString();

  if (action === 'decide') {
    // القبول وحده يكتب — بالدالة نفسها التي يستعملها Claude التشغيل من القاعدة
    const reason = String(b.reason || '').trim();
    const fn = b.accept === true ? 'accept_recommendation' : 'reject_recommendation';
    if (b.accept !== true && !reason) return NextResponse.json({ error: 'سبب الرفض مطلوب' }, { status: 400 });
    const { data, error } = await sb.rpc(fn, { rec: String(b.id || ''), by_name: DR, why: reason || 'قبول المالك' });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, rec: data });
  }
  if (action === 'outbox') {
    // زرّ الإيقاف الكلي — يُقرأ قبل كل حجزٍ وكل إرسال
    const { error } = await sb.from('award_settings').update({ value: b.enabled === true ? 'true' : 'false' }).eq('key', 'outbox_enabled');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, enabled: b.enabled === true });
  }
  if (action === 'outbox_run') {
    // «شغّل الآن» — الدورة نفسها، في النافذة والسقف والإيقاف
    const q = await enqueueReady(sb);
    const s = await sendDue(sb);
    return NextResponse.json({ ok: true, enqueue: q, send: s });
  }
  if (action === 'key_create') {
    // تدوير: المفتاح الجديد يُلغي السابق. ويُعاد نصّه مرةً واحدة هنا — لا يُحفظ إلا بصمته
    await sb.from('api_keys').update({ revoked_at: now }).eq('name', KEY_NAME).is('revoked_at', null);
    const k = newKey();
    const { error } = await sb.from('api_keys').insert({ name: KEY_NAME, key_hash: k.hash, key_prefix: k.prefix, created_by: DR });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, key: k.key, prefix: k.prefix });
  }
  if (action === 'mcp_revoke') {
    // إلغاء ربط ChatGPT كله: رموز الوصول ورموز التجديد — يلزمه ربطٌ جديد بموافقتك
    const { error: e1 } = await sb.from('api_keys').update({ revoked_at: now }).not('client_id', 'is', null).is('revoked_at', null);
    const { error: e2 } = await sb.from('oauth_refresh').update({ revoked_at: now }).is('revoked_at', null);
    if (e1 || e2) return NextResponse.json({ error: (e1 || e2)?.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  if (action === 'key_revoke') {
    const { error } = await sb.from('api_keys').update({ revoked_at: now }).eq('id', String(b.id || '')).is('revoked_at', null);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  if (action === 'template_approve') {
    const { error } = await sb.from('award_message_templates').update({ approved: true, approved_at: now }).eq('id', String(b.id || ''));
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  if (action === 'hypothesis_approve') {
    const { error } = await sb.from('award_hypotheses').update({ approved: true, approved_at: now }).eq('id', String(b.id || ''));
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  if (action === 'text_approve') {
    const key = String(b.key || '');
    if (!['general_email_approved', 'whatsapp_template_approved', 'gap_email_approved'].includes(key)) return NextResponse.json({ error: 'مفتاح غير معروف' }, { status: 400 });
    const { error } = await sb.from('award_settings').update({ value: 'true' }).eq('key', key);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  if (action === 'flag_done') {
    const { error } = await sb.from('contract_awards').update({ codex_flag: 'none', codex_reason: 'حسمه المالك: ' + String(b.note || '').slice(0, 300) }).eq('id', String(b.id || ''));
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: 'فعلٌ غير معروف' }, { status: 400 });
}
