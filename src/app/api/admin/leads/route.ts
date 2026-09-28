import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requirePage } from '@/lib/requireStaff';
import { buildLeads, leadStats, type RawLead } from '@/lib/leadDesk';
import { OUTCOMES, isOutcome } from '@/lib/outcomes';
import { isFrozen } from '@/lib/frozen';

const admin = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

// جدول mini_assessments لم تكن تقرؤه أي صفحة في المنصة: أسماء وهواتف تتراكم منذ يونيو
// بلا شاشة واحدة تعرضها. هذا المسار هو أول من يفتحه.
export async function GET() {
  const { error: denied, status: gate } = await requirePage('/admin/leads');
  if (denied) return NextResponse.json({ error: denied }, { status: gate });
  const a = admin();

  const { data: rows, error } = await a.from('mini_assessments')
    .select('id, created_at, full_name, phone, track, score, completed, contacted, src, answers, contacted_at, outcome, contact_note, next_action_at')
    .order('created_at', { ascending: false })
    .limit(1000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // ★ كان هذا المسار يقرأ التقييم السريع وحده، فغاب عن الشاشة من سجّل في
  //   المنصة مباشرةً بلا تقييم — وهم أثقل الأسماء وزناً (أربعون سنة تشغيل،
  //   عشرون مليوناً إيراداً). فصار المصدران في تبويبٍ واحد: من قاس ومن سجّل.
  const { data: cos, error: coErr } = await a.from('companies')
    .select('id, company_name, owner_name, phone, sector, city, created_at, contacted, contacted_at, outcome, contact_note, next_action_at, file_status, admin_note');
  // فشل القراءة لا يُقرأ «لا مكالمات اليوم»
  if (coErr) return NextResponse.json({ error: 'تعذّرت قراءة المنشآت — ' + coErr.message }, { status: 500 });
  // ★ «مكالمات اليوم» صفُّ ما قبل الدفع: من دفع أو حوّل خرج منه إلى رغد،
  //   والموقوف بأمر المالك (⛔) لا يُتّصل به. وكانا يظهران هنا «سجّل ولم
  //   يُكمل بياناته» فتتصل ضي بعميلٍ دفع. والتعريفان نفساهما في `hot_list`.
  const { data: paidRows, error: paidErr } = await a.from('payments')
    .select('company_id').in('status', ['paid', 'awaiting_confirmation']);
  if (paidErr) return NextResponse.json({ error: 'تعذّرت قراءة المدفوعات — ' + paidErr.message }, { status: 500 });
  const paidCo = new Set((paidRows || []).map((p) => String(p.company_id)));
  const inLane = (c: Record<string, unknown>) =>
    !paidCo.has(String(c.id)) && !isFrozen(c.admin_note);
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

  // المسجّلون: صفٌّ بنفس شكل صف التقييم ليقرأهما الجدول بلا تفريع
  const { data: fin, error: finErr } = await a.from('financial_data')
    .select('company_id, requested_amount, annual_revenue, years_operating, created_at')
    .order('created_at', { ascending: false });
  if (finErr) return NextResponse.json({ error: 'تعذّرت قراءة البيانات المالية — ' + finErr.message }, { status: 500 });
  const finBy = new Map<string, Record<string, unknown>>();
  for (const f of (fin || [])) {
    const k = String((f as Record<string, unknown>).company_id || '');
    if (k && !finBy.has(k)) finBy.set(k, f as Record<string, unknown>);
  }

  const num = (v: unknown) => { const n = Number(v); return isFinite(n) && n > 0 ? n : 0; };
  const sar = (n: number) => n.toLocaleString('en-US');

  const regLeads = (cos || []).filter((c) => inLane(c as Record<string, unknown>)).map((c) => {
    const r = c as Record<string, unknown>;
    const f = finBy.get(String(r.id)) || {};
    const ask = num(f.requested_amount);
    const rev = num(f.annual_revenue);
    const yrs = num(f.years_operating);
    const nm = String(r.company_name || r.owner_name || 'منشأة');
    const bits: string[] = [];
    if (yrs) bits.push(yrs + ' سنة تشغيل');
    if (rev) bits.push('إيراد ' + sar(rev));
    if (ask) bits.push('يطلب ' + sar(ask));
    // الطلب الذي يتجاوز الإيراد أضعافاً غالبه خطأ إدخال، ويُقال صراحةً
    const odd = ask > 0 && rev > 0 && ask > rev * 3;
    // ★ حدٌّ عملي قرّره المالك: دون ثلاثة ملايين إيراداً سنوياً لا تفتح
    //   جهاتُ التمويل ملفاً جادّاً، فالمكالمة تُوجَّه إلى رفع الجاهزية لا
    //   إلى التقديم — وتوفيرُ هذه المكالمة على المساعِدة أنفع من إجرائها.
    const THIN_REVENUE = 3_000_000;
    const thin = rev > 0 && rev < THIN_REVENUE;
    const phone = String(r.phone || '');
    const wa = phone.replace(/\D/g, '').replace(/^0/, '966');
    return {
      id: 'co:' + String(r.id),
      kind: 'تسجيل' as const,
      created_at: String(r.created_at || ''),
      full_name: String(r.owner_name || ''),
      company_name: nm,
      phone,
      track: 'تمويل',
      score: null as number | null,
      completed: true,
      contacted: Boolean(r.contacted),
      days: Math.max(0, Math.floor((Date.now() - Date.parse(String(r.created_at || ''))) / 86400000)),
      band: (odd ? 'unknown' : thin ? 'weak' : ask && rev ? 'ready' : 'gap') as 'ready' | 'gap' | 'weak' | 'unknown',
      temp: 'hot' as const,
      registered: true,
      headline: odd
        ? 'سجّل ويطلب ' + sar(ask) + ' وإيراده ' + sar(rev) + ' — تحقّقي من الرقم قبل أي شيء، فالغالب خطأ إدخال'
        : thin
          ? (bits.join(' · ') || nm) + ' — الإيراد دون ثلاثة ملايين، والجهات لا تفتح به ملفاً جادّاً. المكالمة لرفع الجاهزية لا للتقديم'
          : (bits.length ? nm + ' — ' + bits.join(' · ') : nm + ' — سجّل ولم يُكمل بياناته'),
      opener: 'السلام عليكم' + (r.owner_name ? ' أستاذ ' + String(r.owner_name).split(' ')[0] : '')
        + '، معك ضي من مُرضي للاستشارات المالية. وصلنا تسجيلكم لـ' + nm
        + '، وأتواصل لاستكمال بيانات الملف — دقيقتان لا أكثر.',
      waLink: wa ? 'https://wa.me/' + wa : '',
      contacted_at: r.contacted_at ?? null,
      outcome: r.outcome ?? null,
      contact_note: r.contact_note ?? null,
      next_action_at: r.next_action_at ?? null,
    };
  });

  // ★ التذكير الواحد للترسيات (بند المالك ٢٨ سبتمبر): ترسيةٌ أُرسلت لها
  //   الرسالة ومضى عليها `reminder_after_days` بلا رد — مكالمةٌ واحدة من ضي.
  //   يُعرض لها اسم الشركة وصاحب القرار والهاتف فقط: لا نصّ الرسالة ولا الحدود.
  //   وبعد تسجيل النتيجة تصير «مكالمة التذكير» ولا تعود إلى هذا الصف أبداً.
  const { data: rs } = await a.from('award_settings').select('value').eq('key', 'reminder_after_days').maybeSingle();
  const remindDays = Number(rs?.value);
  let awardLeads: typeof regLeads = [];
  if (Number.isFinite(remindDays) && remindDays > 0) {
    const cutoff = new Date(Date.now() - remindDays * 86400_000).toISOString();
    const { data: aw, error: awErr } = await a.from('contract_awards')
      .select('id, company_name, decision_maker_name, decision_maker_role, contact_phone, messaged_at')
      .eq('status', 'messaged').lte('messaged_at', cutoff);
    if (awErr) return NextResponse.json({ error: 'تعذّرت قراءة الترسيات — ' + awErr.message }, { status: 500 });
    awardLeads = (aw || []).map((w) => {
      const phone = String(w.contact_phone || '');
      const wa = phone.replace(/\D/g, '').replace(/^0/, '966');
      const who = [w.decision_maker_name, w.decision_maker_role].filter(Boolean).join(' — ');
      return {
        id: 'aw:' + String(w.id),
        kind: 'ترسية' as unknown as 'تسجيل',
        created_at: String(w.messaged_at || ''),
        full_name: String(w.decision_maker_name || ''),
        company_name: String(w.company_name || 'منشأة'),
        phone,
        track: 'تمويل',
        score: null as number | null,
        completed: true,
        contacted: false,
        days: Math.max(0, Math.floor((Date.now() - Date.parse(String(w.messaged_at || ''))) / 86400000)),
        band: 'ready' as 'ready' | 'gap' | 'weak' | 'unknown',
        temp: 'hot' as const,
        registered: false,
        headline: String(w.company_name || 'منشأة') + (who ? ' — ' + who : '') + ' — مكالمة التذكير الوحيدة',
        opener: 'السلام عليكم' + (w.decision_maker_name ? ' أستاذ ' + String(w.decision_maker_name).split(' ')[0] : '')
          + '، معك ضي من مكتب د. عبدالحكيم المرضي. أتأكد أن رسالتنا وصلتكم قبل أيام.',
        waLink: wa ? 'https://wa.me/' + wa : '',
        contacted_at: null, outcome: null, contact_note: null, next_action_at: null,
      };
    }) as unknown as typeof regLeads;
  }

  const all = [
    ...awardLeads,
    ...regLeads,
    ...merged.map(m => ({ ...m, kind: 'تقييم' as const, company_name: null as string | null })),
  ].sort((x, y) => {
    // غير المتّصل به أولاً، ثم الأحدث
    if (Boolean(x.contacted) !== Boolean(y.contacted)) return x.contacted ? 1 : -1;
    return Date.parse(String(y.created_at)) - Date.parse(String(x.created_at));
  });

  const st = leadStats(leads);
  return NextResponse.json({
    ok: true,
    leads: all,
    stats: { ...st, total: all.length, contacted: all.filter(l => l.contacted).length, open: all.filter(l => !l.contacted).length },
  });
}

export async function PATCH(req: Request) {
  const { who, error: denied, status: gate } = await requirePage('/admin/leads');
  if (denied || !who) return NextResponse.json({ error: denied || 'غير مصرح' }, { status: gate });
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
    if (o && !isOutcome(o)) {
      return NextResponse.json({ error: 'نتيجة غير معروفة: ' + o + ' — المقبول: ' + OUTCOMES.join(' · ') }, { status: 400 });
    }
    patch.outcome = o || null;
    if (o) { patch.contacted = true; patch.contacted_at = patch.contacted_at || new Date().toISOString(); }
  }
  if (body.contact_note !== undefined) patch.contact_note = String(body.contact_note || '').slice(0, 2000) || null;
  if (body.next_action_at !== undefined) patch.next_action_at = body.next_action_at || null;
  if (!Object.keys(patch).length) return NextResponse.json({ error: 'لا تغيير' }, { status: 400 });

  // صفّ الترسية (`aw:`): النتيجة تُكتب لمسةً في `hot_touches`، وتصير الترسية
  // «مكالمة التذكير» — مرةً واحدة ولا تعود. و«اتصلتُ» وحدها لا تُتمّ الصف.
  if (id.startsWith('aw:')) {
    const awardId = id.slice(3);
    const o = String(body.outcome || '');
    if (!o) return NextResponse.json({ ok: true, pending: 'سجّلي نتيجة المكالمة لتُغلق' });
    const sbA = admin();
    const { data: me } = await sbA.from('staff').select('name').eq('user_id', who.userId).maybeSingle();
    const { error: tErr } = await sbA.from('hot_touches').insert({
      source: 'award', ref_id: awardId, outcome: o,
      note: (patch.contact_note as string) || null,
      next_action_at: (patch.next_action_at as string) || null,
      actor: who.userId,
      actor_name: who.role === 'admin' ? 'د. عبدالحكيم المرضي' : String(me?.name || who.email || 'الفريق'),
    });
    if (tErr) return NextResponse.json({ error: 'لم تُسجَّل المكالمة — ' + tErr.message }, { status: 500 });
    const now = new Date().toISOString();
    const { data: moved, error: mErr } = await sbA.from('contract_awards')
      .update({ status: 'reminder_call', reminder_at: now, updated_at: now })
      .eq('id', awardId).eq('status', 'messaged').select('id');
    if (mErr) return NextResponse.json({ error: 'سُجّلت المكالمة ولم تُغلق الترسية — ' + mErr.message }, { status: 500 });
    if (!moved?.length) return NextResponse.json({ ok: true, warn: 'سُجّلت المكالمة — وكانت حالة الترسية قد تغيّرت قبلها' });
    return NextResponse.json({ ok: true });
  }

  // صفوف المسجّلين تحمل بادئة co: وتُكتب في جدول الشركات لا في التقييم السريع
  const isCo = id.startsWith('co:');
  const rowId = isCo ? id.slice(3) : id;
  const sb = admin();
  const { error } = isCo
    ? await sb.from('companies').update(patch).eq('id', rowId)
    : await sb.from('mini_assessments').update(patch).eq('id', rowId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // ★ واللمسة تُكتب في السجلّ المشترك أيضاً.
  //
  //   فشاشة «الفرص الساخنة» لا تقرأ عمود `contacted` — تقرأ `hot_touches`
  //   وحده لتعرف ما حُسم وما ينتظر موعده. وكانت هذه الشاشة تكتب في العمود
  //   ولا تكتب لمسة: فتُنهي ضي المكالمة هنا، ويبقى الاسم في صفّ رغد هناك
  //   «ينتظر اتصالاً اليوم» — فتتصل به ثانيةً في اليوم نفسه.
  //   والعكس كان مضبوطاً أصلاً: شاشتا الوارد والفرص تكتبان في الموضعين.
  //   وفشلُ السجلّ لا يُسقط التسجيل — الصفُّ قد كُتب وهو الأصل.
  let warn: string | null = null;
  if (patch.contacted === true || patch.outcome) {
    const { data: me } = await sb.from('staff').select('name').eq('user_id', who.userId).maybeSingle();
    const { error: tErr } = await sb.from('hot_touches').insert({
      source: isCo ? 'signup' : 'assessment',
      ref_id: rowId,
      outcome: (patch.outcome as string) || null,
      note: (patch.contact_note as string) || null,
      next_action_at: (patch.next_action_at as string) || null,
      actor: who.userId,
      actor_name: who.role === 'admin' ? 'د. عبدالحكيم المرضي' : String(me?.name || who.email || 'الفريق'),
    });
    // ★ كان الفشل يُبتلع: فيبقى الاسم «ينتظر اتصالاً اليوم» في الفرص الساخنة
    //   ويُتّصل به مرتين. والتسجيل الأصلي كُتب، فلا يُردّ خطأً — يُقال تحذيراً.
    if (tErr) warn = 'سُجّلت المكالمة، لكن لم تُسجَّل في «الفرص الساخنة» — قد يظهر الاسم هناك مرة أخرى.';
  }

  return NextResponse.json({ ok: true, warn });
}
