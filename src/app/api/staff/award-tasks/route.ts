import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requirePage } from '@/lib/requireStaff';
import { isOutcome, OUTCOMES } from '@/lib/outcomes';
import { sendPush } from '@/lib/push';
import { submitRecommendation } from '@/lib/codexActions';
import { OWNER_EMAIL } from '@/lib/notifyLead';
import { FIT_SERVICES, isFitService, staffTasks, statusAfterOutcome, whatsappText, gapMessage, waDigits, loadConfig, type Award } from '@/lib/awards';

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
    const sb = admin();
    // ما ينتظر رقماً موثّقاً — يُقال لها صراحةً بدل شاشةٍ فارغة تُقرأ «لا عمل»
    const { count: waiting } = await sb.from('contract_awards').select('id', { count: 'exact', head: true })
      .in('status', ['qualified', 'messaged', 'replied', 'gap_sent', 'meeting', 'priced']).is('phone_source_url', null);
    // «ابحثي عن رقم»: أعلى المؤهَّلة درجةً بلا رقمٍ موثّق ولا توصية تواصلٍ معلّقة — خمسٌ في اليوم
    const { data: bare } = await sb.from('contract_awards').select('id, company_name, buyer_entity, tender_title')
      .eq('status', 'qualified').is('phone_source_url', null);
    const bareIds = (bare || []).map((r) => String(r.id));
    const [{ data: pend }, { data: sc }] = await Promise.all([
      bareIds.length ? sb.from('award_recommendations').select('award_id').in('award_id', bareIds).eq('kind', 'contact').eq('status', 'pending') : Promise.resolve({ data: [] }),
      bareIds.length ? sb.from('award_pipeline').select('id, score').in('id', bareIds) : Promise.resolve({ data: [] }),
    ]);
    const pending = new Set((pend || []).map((r: { award_id: string }) => String(r.award_id)));
    const scoreOf = new Map((sc || []).map((r: { id: string; score: number }) => [String(r.id), Number(r.score)]));
    const research = (bare || []).filter((r) => !pending.has(String(r.id)))
      .sort((x, y) => (scoreOf.get(String(y.id)) || 0) - (scoreOf.get(String(x.id)) || 0)).slice(0, 5)
      .map((r) => ({ id: String(r.id), company: r.company_name, buyer: r.buyer_entity, title: r.tender_title }));
    return NextResponse.json({ ok: true, tasks: await staffTasks(sb), waiting: waiting || 0, research, outcomes: OUTCOMES, services: FIT_SERVICES });
  } catch (e) {
    return NextResponse.json({ error: 'تعذّرت قراءة مهام الترسيات — ' + (e instanceof Error ? e.message : '') }, { status: 500 });
  }
}

// POST { id, action: 'check' | 'call' | 'whatsapp' | 'consult' | 'outcome' | 'yes' | 'service', answer?, outcome?, service?, note? }
export async function POST(req: Request) {
  const { who, error, status } = await requirePage('/admin/leads');
  if (!who) return NextResponse.json({ error }, { status });
  const b = await req.json().catch(() => ({} as Record<string, unknown>));
  const id = String(b.id || '');
  const action = String(b.action || '');
  // رقمٌ وجدته ضي بمصدره — يذهب توصيةً للمراجعة (القواعد أو Claude أو المالك)، ولا يُكتب في الفرصة مباشرة
  if (action === 'found') {
    const phone = String(b.phone || '').replace(/[^\d+]/g, '');
    const url = String(b.source_url || '').trim();
    if (phone.length < 9) return NextResponse.json({ error: 'الرقم ناقص' }, { status: 400 });
    if (!/^https?:\/\//i.test(url)) return NextResponse.json({ error: 'ضعي رابط الصفحة التي وجدتِ فيها الرقم' }, { status: 400 });
    const r = await submitRecommendation(admin(), {
      award_id: id, kind: 'contact', confidence: 0.7, evidence: [url],
      value: { phone, source: String(b.source || 'بحث ضي').slice(0, 80), source_url: url, found_by: 'ضي' },
    });
    return NextResponse.json(r.json, { status: r.status });
  }
  if (!id || !['check', 'call', 'whatsapp', 'consult', 'outcome', 'yes', 'service'].includes(action)) return NextResponse.json({ error: 'طلبٌ ناقص' }, { status: 400 });
  const outcome = action === 'outcome' ? String(b.outcome || '') : '';
  if (action === 'outcome' && !isOutcome(outcome)) {
    return NextResponse.json({ error: 'نتيجة غير معروفة — المقبول: ' + OUTCOMES.join(' · ') }, { status: 400 });
  }
  const note = String(b.note || '').trim().slice(0, 1000) || null;
  // التأهيل: «ردّ بنعم» و«مهتم» و«تحوّل عميلاً» لا تُسجَّل بلا الخدمة المناسبة
  const service = b.service ? String(b.service) : '';
  if (service && !isFitService(service)) return NextResponse.json({ error: 'خدمة غير معروفة' }, { status: 400 });
  const needsService = action === 'yes' || action === 'service' || (action === 'outcome' && ['مهتم', 'تحوّل عميلاً'].includes(outcome));
  if (needsService && !service) return NextResponse.json({ error: 'اختاري الخدمة المناسبة أولاً' }, { status: 400 });
  const sb = admin();

  // المهمة قائمةٌ فعلاً: ترسية مؤهَّلة أو «أُرسلت» — لا يُكتب على ما سواها
  const { data: a, error: rErr } = await sb.from('contract_awards')
    .select('id, status, company_name, source, contract_value, is_subcontract, tender_title, buyer_entity, contact_phone, contact_whatsapp').eq('id', id).maybeSingle();
  if (rErr) return NextResponse.json({ error: 'تعذّرت القراءة — ' + rErr.message }, { status: 500 });
  // مهامها: الأول والتذكير (موثّقة · أُرسلت) والتأهيل (ردّت) ومتابعة العرض — لا ما أُغلق أو دُفع
  if (!a || !['qualified', 'messaged', 'reminder_call', 'replied', 'gap_sent', 'meeting', 'priced'].includes(String(a.status))) return NextResponse.json({ error: 'هذه المهمة لم تعد قائمة' }, { status: 409 });
  // ما قاله العميل بحرفه، والاعتراض، والموعد، والخطوة التالية — من بطاقة ضي
  const said = String(b.said || '').trim().slice(0, 4000) || null;
  const objection = String(b.objection || '').trim().slice(0, 1000) || null;
  const important = b.objection_important === true;
  const appt = b.appointment_at && !Number.isNaN(Date.parse(String(b.appointment_at))) ? new Date(String(b.appointment_at)).toISOString() : null;
  const nextStep = String(b.next_step || '').trim().slice(0, 300) || null;

  const { data: me } = await sb.from('staff').select('name').eq('user_id', who.userId).maybeSingle();
  const actor = who.role === 'admin' ? 'د. عبدالحكيم المرضي' : String(me?.name || who.email || 'الفريق');

  // الخدمة المناسبة تُختم مع التأهيل — و«لا يناسب» يُغلق الترسية (لا خدمة لها عندنا الآن)
  if (service) {
    const now = new Date().toISOString();
    const patch: Record<string, unknown> = { fit_service: service, qualified_at: now, qualified_by: actor, updated_at: now };
    const { error: sErr } = await sb.from('contract_awards').update(patch).eq('id', id);
    if (sErr) return NextResponse.json({ error: 'لم تُسجَّل الخدمة — ' + sErr.message }, { status: 500 });
    if (action === 'service') {
      await sb.from('award_touches').insert({ award_id: id, channel: 'call', direction: 'out', actor, body: 'الخدمة المناسبة: ' + FIT_SERVICES[service] + (note ? ' — ' + note : ''), outcome: 'تأهيل' });
      if (service === 'not_fit') await sb.from('contract_awards').update({ status: 'dropped', updated_at: now }).eq('id', id).eq('status', a.status);
      return NextResponse.json({ ok: true, service });
    }
  }

  // التحقق أولاً: هل يصل الرقم لصاحب القرار؟ «نعم» يختم الوصول؛ و«لا» يُعيد الترسية
  // إلى «ينقصها رقم» ولا يُسقطها — فالمنشأة لم ترفض، الرقم هو الخطأ.
  if (action === 'check' || (action === 'outcome' && outcome === 'رقم خاطئ')) {
    const yes = action === 'check' && b.answer === 'yes';
    if (action === 'check' && !['yes', 'no'].includes(String(b.answer))) return NextResponse.json({ error: 'الجواب نعم أو لا' }, { status: 400 });
    const now = new Date().toISOString();
    const patch: Record<string, unknown> = { phone_check: yes ? 'yes' : 'no', phone_checked_at: now, phone_checked_by: actor, updated_at: now };
    if (yes) patch.reached_at = now;
    const { error: cErr } = await sb.from('contract_awards').update(patch).eq('id', id);
    if (cErr) return NextResponse.json({ error: 'لم يُسجَّل التحقق — ' + cErr.message }, { status: 500 });
    await sb.from('award_touches').insert({
      award_id: id, channel: 'call', direction: 'out', actor, to_address: String(a.contact_phone || a.contact_whatsapp || '') || null,
      body: yes ? 'تحقّقت: الرقم يصل لصاحب القرار' : 'الرقم لا يصل لصاحب القرار' + (note ? ' — ' + note : ''),
      outcome: yes ? 'وصل لصاحب القرار' : 'لا يصل لصاحب القرار',
    });
    const { error: hErr3 } = await sb.from('hot_touches').insert({
      source: 'award', ref_id: id, outcome: yes ? null : 'رقم خاطئ',
      note: yes ? 'الرقم يصل لصاحب القرار' : 'الرقم لا يصل لصاحب القرار', actor: who.userId, actor_name: actor,
    });
    return NextResponse.json({ ok: true, check: yes ? 'yes' : 'no', warn: hErr3 ? 'لم يُسجَّل في «الفرص الساخنة»' : null });
  }

  // «ردّ بنعم»: ردٌّ وارد بضغطةٍ واحدة. القناة قناة آخر تواصلٍ صادر منها
  // (واتساب أو اتصال). والحالة تصير «ردّ» بمشغّل القاعدة على كل صفٍّ وارد —
  // هو نفسه الذي يحوّل ما يكتبه المالك من Gmail مباشرة — فتخرج من قائمتها.
  if (action === 'yes') {
    const { data: last } = await sb.from('award_touches').select('channel')
      .eq('award_id', id).eq('direction', 'out').in('channel', ['whatsapp', 'call'])
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    const { error: yErr } = await sb.from('award_touches').insert({
      award_id: id, channel: last?.channel === 'whatsapp' ? 'whatsapp' : 'call', direction: 'in', actor,
      body: note || 'ردّ بنعم', outcome: 'yes',
    });
    if (yErr) return NextResponse.json({ error: 'لم يُسجَّل الرد — ' + yErr.message }, { status: 500 });
    const { error: hErr2 } = await sb.from('hot_touches').insert({
      source: 'award', ref_id: id, outcome: 'مهتم', note: 'ردّ بنعم' + (note ? ' — ' + note : ''), actor: who.userId, actor_name: actor,
    });
    const p = await sendPush({
      title: '🟢 ردّ بنعم — ترسية',
      body: String(a.company_name) + ' — سجّلته ' + actor + '. جدول الفجوة ينتظرك.',
      url: '/admin/awards', important: true, tag: 'award-yes-' + id,
    }, OWNER_EMAIL);
    // أُشعِر المالك هنا — فلا تُشعره دورة القناة ثانيةً
    if (p.sent) await sb.from('contract_awards').update({ reply_notified_at: new Date().toISOString() }).eq('id', id);
    const warns = [hErr2 ? 'لم يُسجَّل في «الفرص الساخنة»' : '', p.sent ? '' : 'لم يصل إشعار الجوال (' + (p.reason || 'فشل') + ')'].filter(Boolean);
    return NextResponse.json({ ok: true, status: 'replied', warn: warns.length ? warns.join(' · ') : null });
  }

  // ★ ٣٠ سبتمبر: ضي ترسل استشارة الفجوة التي اعتمدها المالك — تُسجَّل باسمها وبحرف الرسالة
  if (action === 'consult') {
    const { data: rel } = await sb.from('consultations').select('id').eq('award_id', id)
      .eq('assessment_type', 'award_gap').eq('status', 'released').limit(1).maybeSingle();
    if (!rel) return NextResponse.json({ error: 'لا استشارة معتمدة لهذه الترسية — يعتمدها المالك أولاً' }, { status: 409 });
    const { settings } = await loadConfig(sb);
    const msg = gapMessage(a as Parameters<typeof gapMessage>[0], settings);
    const { error: cErr } = await sb.from('award_touches').insert({
      award_id: id, channel: 'whatsapp', direction: 'out', actor, to_address: waDigits(a.contact_whatsapp || a.contact_phone) || null,
      subject: 'استشارة الفجوة', body: (msg ? msg + '\n\n' : '') + '(أرسلت ملف الاستشارة المعتمدة بالواتساب)',
    });
    if (cErr) return NextResponse.json({ error: 'لم يُسجَّل الإرسال — ' + cErr.message }, { status: 500 });
    const { error: hErr4 } = await sb.from('hot_touches').insert({
      source: 'award', ref_id: id, outcome: null, note: 'أرسلت الاستشارة المعتمدة بالواتساب', actor: who.userId, actor_name: actor,
    });
    return NextResponse.json({ ok: true, warn: hErr4 ? 'سُجّلت في الترسية ولم تُسجَّل في «الفرص الساخنة»' : null });
  }

  let body: string | null = null;
  if (action === 'whatsapp') {
    const { settings } = await loadConfig(sb);
    body = whatsappText(a as Parameters<typeof whatsappText>[0], settings);
    if (!body) return NextResponse.json({ error: 'قالب الواتساب غير معتمد بعد' }, { status: 409 });
  }
  const to = action === 'whatsapp' ? waDigits(a.contact_whatsapp || a.contact_phone) : String(a.contact_phone || a.contact_whatsapp || '');

  const { error: tErr } = await sb.from('award_touches').insert({
    award_id: id, channel: action === 'whatsapp' ? 'whatsapp' : 'call', direction: 'out', actor,
    to_address: to || null, body: action === 'whatsapp' ? body : note, outcome: outcome || null,
    said, objection, objection_important: important && !!objection, appointment_at: appt, next_step: nextStep,
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
  // النتيجة تحرّك الحالة في أول الطريق فقط؛ وبعد الرد لا يعود بها «مهتم» إلى الخلف —
  // إلا «غير مهتم» و«طلب عدم التواصل» فيُغلقان في أي مرحلة
  if (action === 'outcome') {
    const early = ['qualified', 'messaged', 'reminder_call'].includes(String(a.status));
    const n = statusAfterOutcome(String(a.status), outcome);
    next = early || ['dropped', 'do_not_contact'].includes(n) ? n : null;
  }
  if (next && next !== a.status) {
    const now = new Date().toISOString();
    const patch: Record<string, unknown> = { status: next, updated_at: now };
    if (STAMP[next]) patch[STAMP[next]] = now;
    if (next === 'do_not_contact') { patch.dnc_reason = note || 'طلب عدم التواصل في المكالمة'; patch.dnc_by = actor; patch.dnc_at = now; }
    const { data: moved, error: mErr } = await sb.from('contract_awards').update(patch).eq('id', id).eq('status', a.status).select('id');
    if (mErr) return NextResponse.json({ error: 'سُجّلت، ولم تُحدَّث حالة الترسية — ' + mErr.message }, { status: 500 });
    if (!moved?.length) return NextResponse.json({ ok: true, warn: 'سُجّلت — وكانت حالة الترسية قد تغيّرت قبلها' });
  }
  // موعد العميل وخطوتها التالية يصيران «الخطوة التالية» للفرصة (بعد تحريك الحالة، فالمشغّل يمسح القديم عندها)
  if (appt || nextStep) {
    await sb.from('contract_awards').update({ next_at_override: appt, next_step_override: nextStep || (appt ? 'موعد العميل' : null) }).eq('id', id);
  }
  return NextResponse.json({ ok: true, status: next || a.status, warn: hErr ? 'سُجّلت في الترسية ولم تُسجَّل في «الفرص الساخنة»' : null });
}
