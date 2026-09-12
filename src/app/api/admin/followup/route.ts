import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireStaff } from '@/lib/requireStaff';
import { logError } from '@/lib/logError';
import { canonicalTitle, displayName } from '@/lib/serviceCatalog';

// لوحة المتابعة — ما يراه من يلاحق مخاطبات الجهات.
//
// السؤال الذي تجيب عنه: **أي ملف يقعد ساكتاً الآن؟** لا «كم أرسلنا».
// فالصفوف تُرتَّب بما يستحقّ عملاً اليوم: ردٌّ لم يُصنَّف، ثم مخاطبة تجاوزت
// يومين بلا اتصال، ثم الباقي. والترتيب يُحسب هنا لا في المتصفح، لئلا تختلف
// شاشتان على أيّهما أولى.
//
// ★ قاعدة اليومين: مضى على الإرسال يومان ولم يصل رد ولم يقع اتصال متابعة
//   → صفٌّ أحمر. وأكثر الملفات لا تُرفض، تُنسى — وهذا الحقل هو ما يمنع ذلك.
//
// ★ ولا يخرج من هنا رقم عميلٍ ولا مالكه: اللوحة تعرض الجهات وردودها، أما
//   بيانات العميل فاسمه ومنشأته وخدمته لا أكثر.

export const runtime = 'nodejs';

const DAY = 24 * 60 * 60 * 1000;
const STALE_MS = 2 * DAY;

type Row = {
  id: string;
  company_id: string;
  entity_name: string | null;
  entity_email: string | null;
  status: string | null;
  reply_received: string | null;
  reply_at: string | null;
  reply_status: string | null;
  sent_at: string | null;
  last_sent_at: string | null;
  last_call_at: string | null;
  officer_name: string | null;
  officer_phone: string | null;
  officer_email: string | null;
  staff_note: string | null;
  track: string | null;
};

export async function GET() {
  const { who, error } = await requireStaff();
  if (!who) return NextResponse.json({ error: error || 'غير مصرح' }, { status: 401 });

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  );

  try {
    // العملاء الذين دفعوا خدمةً مخرَجُها مخاطبة — وهم وحدهم من يُتابَع.
    // ومن لم يدفع لا يظهر: المتابعة عملٌ مدفوع، وعرضُه يُشتّت.
    const { data: paid } = await admin
      .from('service_requests')
      .select('company_id, service_title, status, updated_at')
      .in('status', ['paid', 'delivered', 'in_follow_up', 'completed']);

    const svc = new Map<string, string>();
    for (const r of (paid || []) as { company_id: string; service_title: string | null }[]) {
      // الاسم المعروض لا المفتاح المخزَّن: «الاقتصادية» مفتاح قاعدة،
      // والمنتج اسمه «دراسة الجدوى الائتمانية» في كل شاشة سواها
      if (!svc.has(r.company_id)) svc.set(r.company_id, displayName(canonicalTitle(String(r.service_title || ''))));
    }
    const ids = [...svc.keys()];
    if (ids.length === 0) return NextResponse.json({ ok: true, clients: [], counts: zero() });

    // ★ الموقوفة لا تظهر: الهمام موقوفة بأمر المالك، ومنشآت الاختبار ليست
    //   عملاء. وظهورهما على لوحة الموظفة يُغريها بالاتصال بمن نُهي عن
    //   مخاطبته، وبعملٍ على ملفٍ ليس ملفاً.
    const { data: cos } = await admin
      .from('companies')
      .select('id, company_name, city, sector, assigned_to')
      .in('id', ids)
      .eq('outreach_paused', false);

    // ★ المسوّدة ليست عملاً لها: رسالةٌ لم تُرسل لا تُتابَع ولا يُتصل بشأنها.
    //   وكانت تُعدّ صفّاً فتقول اللوحة «٧ جهات» لعميلٍ لم تخرج له رسالة
    //   واحدة — فيبدو مشغولاً وهو ساكن.
    const { data: msgs } = await admin
      .from('outreach_messages')
      .select('id, company_id, entity_name, entity_email, status, reply_received, reply_at, reply_status, sent_at, last_sent_at, last_call_at, officer_name, officer_phone, officer_email, staff_note, track')
      .in('company_id', ids)
      .not('sent_at', 'is', null)
      .order('sent_at', { ascending: false });

    // ★ المساعدة تساعد في المكالمات وحدها: ترى ما تأخّر يومين، ولا ترى نصّ
    //   ردٍّ واصل. والردود تأتي من جهات تمويل وقد تحمل حديثاً عن عمولةٍ أو
    //   شروطٍ مع المكتب — وهي ليست بابها. ومن رأى نصّاً قرأه.
    const callsOnly = who.job === 'assistant' && who.role !== 'admin';

    const now = Date.now();
    const byCo = new Map<string, Row[]>();
    for (const m of (msgs || []) as Row[]) {
      const k = String(m.company_id);
      if (!byCo.has(k)) byCo.set(k, []);
      (byCo.get(k) as Row[]).push(m);
    }

    const counts = zero();

    const clients = (cos || []).map((c: { id: string; company_name: string | null; city: string | null; sector: string | null }) => {
      const rows = (byCo.get(c.id) || []).map((m: Row) => {
        const sentAt = Date.parse(String(m.last_sent_at || m.sent_at || '')) || 0;
        const hasReply = String(m.reply_received || '').trim() !== '' || m.reply_at !== null;
        const calledAt = Date.parse(String(m.last_call_at || '')) || 0;
        const sent = sentAt > 0;

        // «متأخرة» تُقاس من آخر لمسة لا من الإرسال وحده: من اتصلت به أمس
        // ليس متأخراً اليوم، وإن مضى على رسالته أسبوع.
        const lastTouch = Math.max(sentAt, calledAt);
        const stale = sent && !hasReply && now - lastTouch > STALE_MS;

        // ردٌّ وصل ولم يُصنَّف بعد — أول ما يُعمل في الصباح
        const needsTriage = hasReply && String(m.reply_status || '').trim() === '';

        const kind = needsTriage ? 'reply' : stale ? 'stale' : hasReply ? 'done' : 'waiting';
        counts[kind as keyof typeof counts] += 1;

        return {
          id: m.id,
          entity: m.entity_name || '—',
          email: m.entity_email || '',
          track: m.track || '',
          kind,
          sentAt: sentAt || null,
          daysSince: sent ? Math.floor((now - lastTouch) / DAY) : null,
          reply: m.reply_received || '',
          replyStatus: m.reply_status || '',
          officerName: m.officer_name || '',
          officerPhone: m.officer_phone || '',
          officerEmail: m.officer_email || '',
          note: m.staff_note || '',
          calledAt: calledAt || null,
          suggested: needsTriage ? suggestFor(String(m.reply_received || ''), String(m.officer_name || '')) : '',
        };
      });

      // ترتيب الجهات داخل العميل: ما يستحقّ عملاً اليوم أولاً
      const W: Record<string, number> = { reply: 0, stale: 1, waiting: 2, done: 3 };
      rows.sort((a, b) => (W[a.kind] - W[b.kind]) || ((b.sentAt || 0) - (a.sentAt || 0)));

      // المساعدة: صفوف المكالمات وحدها، ونصّ الرد يُحذف قبل الإرسال
      const shown = callsOnly
        ? rows.filter((r) => r.kind === 'stale').map((r) => ({ ...r, reply: '', replyStatus: '', suggested: '' }))
        : rows;

      return {
        id: c.id,
        name: c.company_name || 'منشأة',
        city: c.city || '',
        service: svc.get(c.id) || '',
        rows: shown,
        urgent: shown.filter((r) => r.kind === 'reply' || r.kind === 'stale').length,
        // ملفٌ دفع صاحبه ولا مخاطبة له إطلاقاً — أخطر حالة في اللوحة.
        // ولا تُعرض على المساعدة: ليست من عملها، وبلاغُها للمالك عمل المتابِعة.
        untouched: !callsOnly && rows.length === 0,
      };
    });

    // العميل الذي عليه عملٌ اليوم يتصدّر، ومن لا مخاطبة له يسبق الجميع
    clients.sort((a, b) => (Number(b.untouched) - Number(a.untouched)) || (b.urgent - a.urgent));

    // والمساعدة لا تُعرض عليها إلا مَن لها عنده مكالمة
    const shownClients = callsOnly ? clients.filter((c) => c.rows.length > 0) : clients;
    const shownCounts = callsOnly ? { ...zero(), stale: counts.stale } : counts;

    return NextResponse.json({
      ok: true, clients: shownClients, counts: shownCounts,
      job: who.job, role: who.role, callsOnly,
    });
  } catch (e) {
    await logError('admin.followup', e, {});
    return NextResponse.json({ error: 'تعذّر تحميل اللوحة' }, { status: 500 });
  }
}

function zero() {
  return { reply: 0, stale: 0, waiting: 0, done: 0 };
}

// ★ الإجراء المقترح — ليقرأ الردَّ من لا يفتح صندوق البريد.
//
//   المتابِعة لا تدخل `partners@` إطلاقاً: المهمة المجدولة تقرأ الوارد
//   وتكتب ملخّص كل ردّ في `reply_received` واسمَ مسؤوله في `officer_name`.
//   فيبقى عليها القرار وحده — وهذا السطر يقوله لها بلغة العمل لا بلغة النصّ:
//   ردٌّ يَعِد بالتواصل يُصنَّف ولا يُلحّ عليه · وطلبُ أوراقٍ يُرفع للدكتور ·
//   وطلبُ رقمٍ يُجاب برقم المكتب وحده. والقاعدة المكتوبة هنا تُغني عن
//   اجتهادٍ في نصٍّ قد يُساء فهمه.
const RX_PROMISE = /سيتواصل|سنتواصل|سيقوم فريقنا|تم رفع طلب|سنقوم بالتواصل|نعاود الاتصال/;
const RX_DEFLECT = /زيارة (ال)?فرع|الموقع الالكتروني|الموقع الإلكتروني|عبر التطبيق|تقدم بطلب|قدّم عبر|رد آلي|auto\s*reply/i;
const RX_DOCS = /قوائم مالية|كشف حساب|مستند|وثائق|مرفق|نموذج|السجل التجاري|ترخيص/;
const RX_PHONE = /رقم جوال|رقم للتواصل|تزويدنا برقم|رقم الهاتف/;

export function suggestFor(reply: string, officerName: string, officeNumber = '0560721110'): string {
  const t = String(reply || '');
  if (t.trim() === '') return '';
  const who = String(officerName || '').trim() !== ''
    ? 'ولدينا مسؤول باسمه — تابعي معه.'
    : 'ولا نعرف مسؤولاً باسمه بعد — اسألي عن مسؤول الائتمان للمنشآت وسجّلي اسمه ورقمه.';
  if (RX_DOCS.test(t)) return 'طلبوا أوراقاً: صنّفي «طلبوا أوراق» واتركيها للدكتور — لا تُرسل مستندات من هنا. ' + who;
  if (RX_PHONE.test(t)) return 'طلبوا رقم تواصل: الرقم الذي يُعطى لأي جهة هو ' + officeNumber + ' وحده، ولا يُعطى رقم العميل. ' + who;
  if (RX_PROMISE.test(t)) return 'وعدوا بالتواصل: صنّفي «طلبوا اتصال» ولا تُرسلي تذكيراً — بابهم مغلق على البريد. ' + who;
  if (RX_DEFLECT.test(t)) return 'أحالونا إلى الفرع أو الموقع: صنّفي «حوّلونا للموقع/الفرع» — ولا تردّي. ' + who;
  return 'اقرئي الملخّص وصنّفيه بأحد الأربعة. ' + who;
}

// تسجيل ما انتزعته بالهاتف، أو تصنيف ردّ — ولا إرسال من هنا إطلاقاً.
// كل ما يخرج إلى جهة تمويل يمرّ على المالك، وهذه اللوحة تسجّل ولا تُرسل.
export async function PATCH(req: Request) {
  const { who, error } = await requireStaff();
  if (!who) return NextResponse.json({ error: error || 'غير مصرح' }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const id = String(b?.id || '');
  if (!id) return NextResponse.json({ error: 'id مطلوب' }, { status: 400 });

  // ★ حدّ المساعدة مفروضٌ هنا لا في الشاشة: تسجّل ما انتزعته بالهاتف، ولا
  //   تلصق رداً ولا تصنّفه. فتصنيفُ الردّ حكمٌ على نصٍّ في صندوقٍ لا تقرؤه،
  //   ومن صنّف ما لم يقرأ أفسد الملف بحسن نية.
  const callsOnly = who.job === 'assistant' && who.role !== 'admin';
  if (callsOnly && (b.reply_received !== undefined || b.reply_status !== undefined)) {
    return NextResponse.json(
      { error: 'تسجيل الردود وتصنيفها من عمل المتابعة. سجّلي اسم المسؤول ورقمه وملاحظتك.' },
      { status: 403 }
    );
  }

  const cut = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n);
  const patch: Record<string, unknown> = {};

  if (b.officer_name !== undefined) patch.officer_name = cut(b.officer_name, 120) || null;
  if (b.officer_phone !== undefined) patch.officer_phone = cut(b.officer_phone, 40) || null;
  if (b.officer_email !== undefined) patch.officer_email = cut(b.officer_email, 160) || null;
  if (b.staff_note !== undefined) patch.staff_note = cut(b.staff_note, 1200) || null;

  // ★ تسجيل ردٍّ وصل على البريد.
  //
  //   ولا يوجد في المنصة استقبالٌ للبريد الوارد إطلاقاً — لا خطّاف ولا
  //   مسار — فحقل `reply_received` لا يكتبه شيء. أي أن عدّاد «ردود جديدة»
  //   في لوحة المتابعة كان يبقى صفراً أبداً مهما وصل من ردود، وهي تراها
  //   في الصندوق ولا تجد أين تسجّلها.
  //
  //   فهذا هو الجسر: ما وصل البريدَ يُنقل هنا بيدها، فيصير للملف تاريخٌ
  //   في المنصة يقرؤه المالك بلا أن يفتح صندوقاً.
  if (b.reply_received !== undefined) {
    const txt = cut(b.reply_received, 4000);
    patch.reply_received = txt || null;
    // ووقت الرد يُسجَّل مع أول نصّ يصل، ولا يُمحى بتعديلٍ لاحق عليه
    if (txt !== '') patch.reply_at = new Date().toISOString();
  }

  // تصنيف الرد — أربع خانات لا خامس لها، ويُرفض ما سواها صراحةً
  const KINDS = ['docs', 'call', 'deflect', 'declined'] as const;
  if (b.reply_status !== undefined) {
    const k = KINDS.find((x: (typeof KINDS)[number]) => x === String(b.reply_status));
    if (!k && String(b.reply_status) !== '') {
      return NextResponse.json({ error: 'تصنيف غير معروف' }, { status: 400 });
    }
    patch.reply_status = k || null;
  }

  // «اتصلتُ اليوم» — وعليه وحده تُعاد قاعدة اليومين من الصفر
  if (b.called === true) patch.last_call_at = new Date().toISOString();

  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'لا تغيير' }, { status: 400 });
  patch.updated_at = new Date().toISOString();

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  );
  const { error: e } = await admin.from('outreach_messages').update(patch).eq('id', id);
  if (e) return NextResponse.json({ error: e.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
