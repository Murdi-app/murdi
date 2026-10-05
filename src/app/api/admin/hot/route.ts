import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requirePage } from '@/lib/requireStaff';
import { OUTCOMES, isOutcome, closesOpportunity, FOLLOW_OUTCOMES, NO_ANSWER_LIMIT, NO_ANSWER_CLOSED, nextWorkday } from '@/lib/outcomes';

// الفرص الساخنة — بديل «صيد العملاء» و«صيد الفرص».
//
// الصيد يبحث عمّن لا يعرفك: ٣٠٠ اسم مسحوب و١٨٠ قائمة يومية، نسبة ردّها
// كنسبة أي اتصال بارد. وفي المقابل ٦٧ شخصاً أنهوا التقييم بأنفسهم وكتبوا
// أرقامهم ولم يُتّصل بأحدهم. هؤلاء يعرفون المنصة، ورفعوا أيديهم، وينتظرون.
//
// فالشاشة ترتّب من هو داخل المنصة أصلاً بقربه من الدفع، لا بحداثته:
// ١) عقد موقّع لم يُحصَّل  ٢) ملف مكتمل بلا عقد
// ٣) أنهى التقييم ولم يُتّصل به  ٤) سجّل ووقف قبل بياناته المالية

const admin = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  );

type Row = {
  source: string; ref_id: string; name: string | null; phone: string | null;
  email: string | null; company_id: string | null; tier: number;
  reason: string; money: number | null; at: string | null; next_step: string;
};

type Touch = {
  source: string; ref_id: string; outcome: string | null; note: string | null;
  next_action_at: string | null; actor_name: string | null; created_at: string;
};

export async function GET() {
  const { who, error: denied, status: gate } = await requirePage('/admin/hot');
  if (denied || !who) return NextResponse.json({ error: denied || 'غير مصرح' }, { status: gate });

  const sb = admin();
  const list = await sb.from('hot_list').select('*').order('tier').order('at', { ascending: false }).limit(400);
  if (list.error) return NextResponse.json({ error: 'تعذّرت قراءة القائمة — ' + list.error.message }, { status: 500 });
  const rows = (list.data || []) as Row[];

  // ★ اللمسات تُقرأ لصفوف القائمة نفسها لا «آخر ألف في المنصة»: بعد الألف
  //   كانت الفرصة المغلقة («غير مهتم») تفقد لمستها فتعود «لم تُلمس بعد».
  const refs = Array.from(new Set(rows.map((r) => r.ref_id)));
  const touches = refs.length
    ? await sb.from('hot_touches').select('*').in('ref_id', refs).order('created_at', { ascending: false })
    : { data: [], error: null };
  if (touches.error) return NextResponse.json({ error: 'تعذّرت قراءة سجلّ المكالمات — ' + touches.error.message }, { status: 500 });
  const all = (touches.data || []) as Touch[];

  // آخر لمسة لكل فرصة — ما يقرّر هل تُعرض اليوم أم تنتظر موعدها
  const last = new Map<string, Touch>();
  for (const t of all) {
    const k = t.source + '|' + t.ref_id;
    if (!last.has(k)) last.set(k, t);
  }

  // ★ «متابعاتي» (٥ أكتوبر): كان العميل يختفي من قائمتها بعد أول اتصال — الطلب
  //   يخرج حين contacted، والتقييم والتسجيل يخرجان حين يتبدّل صفّهما — ولو كانت
  //   النتيجة «مهتم» أو «طلب معاودة». فصار كلُّ من آخرُ نتيجته متابعةً يُستعاد من
  //   سجلّ اللمسات نفسه، ويبقى حتى نتيجةٍ مُغلِقة أو دفع.
  const since = new Date(Date.now() - 120 * 86400_000).toISOString();
  const { data: recent } = await sb.from('hot_touches').select('source, ref_id, outcome, note, next_action_at, actor_name, created_at')
    .neq('source', 'award').gte('created_at', since).order('created_at', { ascending: false }).limit(5000);
  const inList = new Set(rows.map((r) => r.source + '|' + r.ref_id));
  const lastAll = new Map<string, Touch>();
  for (const t of (recent || []) as Touch[]) { const k = t.source + '|' + t.ref_id; if (!lastAll.has(k)) lastAll.set(k, t); }
  const lost = [...lastAll.values()].filter((t) => FOLLOW_OUTCOMES.includes(String(t.outcome)) && !inList.has(t.source + '|' + t.ref_id));
  const ids = (src: string[]) => lost.filter((t) => src.includes(t.source)).map((t) => t.ref_id);
  const [ma, si, co] = await Promise.all([
    ids(['assessment']).length ? sb.from('mini_assessments').select('id, full_name, company_name, phone').in('id', ids(['assessment'])) : Promise.resolve({ data: [] }),
    ids(['inquiry']).length ? sb.from('service_inquiries').select('id, full_name, company_name, phone, email, service_title').in('id', ids(['inquiry'])) : Promise.resolve({ data: [] }),
    ids(['signup', 'file', 'ordered']).length ? sb.from('companies').select('id, company_name, phone').in('id', ids(['signup', 'file', 'ordered'])) : Promise.resolve({ data: [] }),
  ]);
  const det = new Map<string, { name: string | null; phone: string | null; email?: string | null; company_id?: string | null; what?: string }>();
  for (const m of (ma.data || []) as Record<string, string | null>[]) det.set('assessment|' + m.id, { name: m.company_name || m.full_name, phone: m.phone });
  for (const m of (si.data || []) as Record<string, string | null>[]) det.set('inquiry|' + m.id, { name: m.company_name || m.full_name, phone: m.phone, email: m.email, what: m.service_title || '' });
  for (const m of (co.data || []) as Record<string, string | null>[]) for (const src of ['signup', 'file', 'ordered']) det.set(src + '|' + m.id, { name: m.company_name, phone: m.phone, company_id: String(m.id) });
  const extra: Row[] = lost.flatMap((t) => {
    const d = det.get(t.source + '|' + t.ref_id);
    if (!d) return [];
    return [{
      source: t.source, ref_id: t.ref_id, name: d.name, phone: d.phone, email: d.email || null, company_id: d.company_id || null,
      tier: 3, reason: 'متابعة — آخر نتيجة «' + t.outcome + '»' + (d.what ? ' · طلب «' + d.what + '»' : ''), money: 0, at: t.created_at,
      next_step: 'تابعي حسب ما اتُّفق عليه في آخر مكالمة' + (t.note ? ': ' + t.note.slice(0, 160) : ''),
    }];
  });
  rows.push(...extra);
  // من دفع خرج من المتابعة — يُطابَق بالمنشأة أو بآخر ٩ أرقام من الجوال
  const { data: paidRows } = await sb.from('payments').select('company_id, companies(phone)').eq('status', 'paid');
  const paidCo = new Set<string>(), paidPh = new Set<string>();
  for (const p of (paidRows || []) as { company_id: string; companies: { phone: string | null } | { phone: string | null }[] | null }[]) {
    paidCo.add(String(p.company_id));
    const ph = Array.isArray(p.companies) ? p.companies[0]?.phone : p.companies?.phone;
    if (ph) paidPh.add(ph.replace(/\D/g, '').slice(-9));
  }
  const isPaid = (r: Row) => (r.company_id && paidCo.has(String(r.company_id))) || (!!r.phone && paidPh.has(r.phone.replace(/\D/g, '').slice(-9)));
  for (const t of (recent || []) as Touch[]) { const k = t.source + '|' + t.ref_id; if (!last.has(k)) last.set(k, t); }
  // عدد المحاولات لكل فرصة — اللمسة الواحدة قد تأتي في القراءتين فتُعدّ بوقتها مرةً واحدة
  const seen = new Set<string>(), countOf = new Map<string, number>();
  for (const t of [...all, ...((recent || []) as Touch[])]) {
    const k = t.source + '|' + t.ref_id;
    if (seen.has(k + '@' + t.created_at)) continue;
    seen.add(k + '@' + t.created_at); countOf.set(k, (countOf.get(k) || 0) + 1);
  }

  const today = new Date().toISOString().slice(0, 10);
  const merged = rows.map((r) => {
    const t = last.get(r.source + '|' + r.ref_id) || null;
    // مغلقة = لا تُعرض · مؤجّلة بموعد لم يحن = تنتظر · غير ذلك = اليوم
    const paid = r.tier > 1 && isPaid(r);
    const closed = closesOpportunity(t?.outcome) || (paid && !!t);
    const waiting = !!t?.next_action_at && t.next_action_at > today;
    return {
      ...r,
      follow: !closed && FOLLOW_OUTCOMES.includes(String(t?.outcome || '')),
      touches: countOf.get(r.source + '|' + r.ref_id) || 0,
      last_outcome: t?.outcome || null,
      last_note: t?.note || null,
      last_at: t?.created_at || null,
      next_action_at: t?.next_action_at || null,
      state: closed ? 'closed' : waiting ? 'waiting' : 'due',
    };
  });

  const due = merged.filter((m) => m.state === 'due');
  // ★ `money` هو أتعاب المكتب المعلَّقة على كل صفّ — أي ما يدخل جيبه من هذا
  //   العميل. والموظفة تُقاس بعدد مكالماتها وتحويلاتها، لا بمال المكتب.
  //   فيُحذف الرقم عن الموظفة في الخادم، ولا يُخفى في المتصفّح.
  const isStaff = who.role === 'staff';
  const money = merged.filter((m) => m.tier === 1).reduce((s, m) => s + Number(m.money || 0), 0);

  return NextResponse.json({
    ok: true,
    role: who.role,
    rows: isStaff ? merged.map((m) => ({ ...m, money: null })) : merged,
    stats: {
      due: due.length,
      untouched: due.filter((m) => m.touches === 0).length,
      waiting: merged.filter((m) => m.state === 'waiting').length,
      closed: merged.filter((m) => m.state === 'closed').length,
      follow: merged.filter((m) => m.follow).length,
      money_on_table: isStaff ? null : money,
    },
  });
}

// POST: تسجيل لمسة — نتيجة المكالمة وموعد المعاودة.
// والنتائج المقبولة معرَّفة في `@/lib/outcomes` وحده — هي نفسها التي تعرضها
// الشاشة والتي يقبلها قيد القاعدة، فلا تفترق ثلاثتها كما افترقت.

export async function POST(req: Request) {
  const { who, error: denied, status: gate } = await requirePage('/admin/hot');
  if (denied || !who) return NextResponse.json({ error: denied || 'غير مصرح' }, { status: gate });

  const b = await req.json().catch(() => ({}));
  const source = String(b?.source || '');
  const refId = String(b?.ref_id || '');
  let outcome = String(b?.outcome || '');
  if (!source || !refId) return NextResponse.json({ error: 'source و ref_id مطلوبان' }, { status: 400 });
  if (!isOutcome(outcome)) {
    return NextResponse.json({ error: 'نتيجة غير معروفة: ' + outcome + ' — المقبول: ' + OUTCOMES.join(' · ') }, { status: 400 });
  }

  const sb = admin();
  const { data: me } = await sb.from('staff').select('name').eq('user_id', who.userId).maybeSingle();

  const note = b?.note ? String(b.note).slice(0, 2000) : null;
  let when = b?.next_action_at ? String(b.next_action_at).slice(0, 10) : null;
  // ★ «لم يرد» تعود بعد يوم عمل، حتى ٣ محاولات متتالية، ثم تُغلق «لم يرد ٣ مرات»
  if (outcome === 'لم يرد') {
    const { data: prev } = await sb.from('hot_touches').select('outcome').eq('source', source).eq('ref_id', refId).order('created_at', { ascending: false }).limit(NO_ANSWER_LIMIT);
    let run = 0;
    for (const p of prev || []) { if (p.outcome === 'لم يرد') run++; else break; }
    if (run + 1 >= NO_ANSWER_LIMIT) { outcome = NO_ANSWER_CLOSED; when = null; }
    else if (!when) when = nextWorkday();
  }

  // ★ صفُّ المصدر يُحدَّث **قبل** تسجيل اللمسة، لا بعدها.
  //   فقد كانت اللمسة تُكتب أولاً ثم يسقط تحديثُ التقييم على قيد القاعدة،
  //   فيبقى في `hot_touches` أثرُ مكالمةٍ لا يعرفها جدول التقييم — والموظفة
  //   ترى خطأً أحمر وتظنّ أن شيئاً لم يُسجَّل وقد سُجِّل نصفُه.
  //   فالآن: إن تعذّر تحديثُ الصفّ لم تُكتب لمسةٌ أصلاً، ويُقال السبب عربياً.
  if (source === 'assessment') {
    const { error: upErr } = await sb.from('mini_assessments').update({
      contacted: true,
      contacted_at: new Date().toISOString(),
      outcome,
      contact_note: note ? note.slice(0, 1000) : null,
      next_action_at: when,
    }).eq('id', refId);
    if (upErr) return NextResponse.json({ error: 'تعذّر تسجيل النتيجة على التقييم — ' + upErr.message }, { status: 500 });
  }

  // وطلب الخدمة من الموقع كذلك — وإلا بقي في القائمة بعد أن كُلِّم صاحبه،
  // فيُكلَّم مرتين وقد طلب مرة واحدة.
  if (source === 'inquiry') {
    const { error: upErr } = await sb.from('service_inquiries').update({
      contacted: true,
      contacted_at: new Date().toISOString(),
      outcome,
      contact_note: note ? note.slice(0, 1000) : null,
    }).eq('id', refId);
    if (upErr) return NextResponse.json({ error: 'تعذّر تسجيل النتيجة على الطلب — ' + upErr.message }, { status: 500 });
  }

  const { error } = await sb.from('hot_touches').insert({
    source,
    ref_id: refId,
    outcome,
    note,
    next_action_at: when,
    actor: who.userId,
    actor_name: who.role === 'admin' ? 'د. عبدالحكيم' : String(me?.name || 'الفريق'),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
