import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireStaff } from '@/lib/requireStaff';
import { waLink, prettyPhone } from '@/lib/phone';

// «الوارد» — كل من دخل المنصة، لمن يتصل به.
//
// العطب الذي بُني هذا لأجله: الأبواب ستة، وكانت الشاشات ستّاً كذلك —
// التقييم والتسجيل في «مكالمات اليوم»، وطلب الخدمة من الموقع في «الفرص
// الساخنة» وهي للمساعِدة وحدها، والتحويل وطلب المطابقة في «مكتب الطلبات».
// فمن طلب خدمةً من الموقع لم ترَه المتابِعةُ قطّ — ولا في شاشةٍ واحدة.
// وفوق ذلك، «مكالمات اليوم» تُرتِّب بالتأهّل لا بالوقت (وهو صواب لمن يتصل
// طول اليوم)، فالداخل الجديد غير المكتمل يسقط إلى ذيل مئة صفّ.
//
// فهذا المسار يقول شيئاً واحداً ويقوله كاملاً: **من طرق الباب، ومتى، ورقمه.**
// أحدثُ أولاً — بلا ترتيبٍ ذكيّ، فالحرارة هنا هي الوقت وحده.

export const dynamic = 'force-dynamic';

const admin = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  );

type Arrival = {
  source: string;
  ref_id: string;
  company_id: string | null;
  at: string;
  kind_label: string;
  name: string | null;
  person: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  detail: string | null;
  contacted: boolean;
  contacted_at: string | null;
  outcome: string | null;
};

/** أي بابٍ يُسجَّل التواصل فيه على صفّه هو — وما عداه يُتابَع من شاشته */
const MARKABLE: Record<string, { table: string; hot: string } | undefined> = {
  assessment: { table: 'mini_assessments', hot: 'assessment' },
  inquiry: { table: 'service_inquiries', hot: 'inquiry' },
  signup: { table: 'companies', hot: 'signup' },
};

export async function GET(req: Request) {
  const { who, error } = await requireStaff();
  if (error || !who) return NextResponse.json({ error: error || 'غير مصرح' }, { status: 401 });

  const url = new URL(req.url);
  const tab = url.searchParams.get('tab') || 'open';

  const sb = admin();
  const { data, error: dbErr } = await sb
    .from('platform_arrivals')
    .select('*')
    .order('at', { ascending: false })
    .limit(400);
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });

  const all = (data || []) as Arrival[];

  // صفوف الاختبار لا تُعرض على من يتصل: رقمٌ داخلي أو اسمٌ مكتوب عليه «يُحذف».
  const STAFF_PHONES = ['966570314005', '966570749196', '966560721110'];
  const isTest = (a: Arrival) => {
    const n = String(a.name || '') + ' ' + String(a.person || '');
    const p = String(a.phone || '').replace(/\D/g, '');
    return /اختبار|يُحذف|test/i.test(n) || STAFF_PHONES.some((s) => p.endsWith(s.slice(-9)));
  };

  const rows = all.filter((a) => !isTest(a)).map((a) => ({
    ...a,
    phone_pretty: a.phone ? prettyPhone(a.phone) : '',
    wa: a.phone ? waLink(a.phone) : null,
    // ★ الجوال يخرج كاملاً للموظفة عمداً: هي من تتصل، ورقمٌ محجوبٌ يوقف العمل.
    //   والمحجوب عنها في المنصة هو المال — أتعاب المكتب — لا أرقام العملاء.
  }));

  const open = rows.filter((r) => !r.contacted);
  const done = rows.filter((r) => r.contacted);

  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const since = (t: number) => open.filter((r) => Date.parse(r.at || '') >= t).length;

  return NextResponse.json({
    ok: true,
    role: who.role,
    rows: tab === 'done' ? done : tab === 'all' ? rows : open,
    stats: {
      open: open.length,
      today: since(dayAgo),
      week: since(weekAgo),
      done: done.length,
      // الأقدم بلا تواصل — الرقم الذي يُخجل، فهو أول ما يُقرأ
      oldest_open_days: open.length
        ? Math.floor((Date.now() - Date.parse(open[open.length - 1].at || '')) / 86400000)
        : 0,
    },
  });
}

// POST — «تواصلتُ معه»: يُكتب على الصفّ نفسه وفي سجلّ اللمسات معاً،
// فلا يظهر الاسم غداً في شاشةٍ أخرى وقد كُلِّم اليوم.
const OUTCOMES = ['لم يرد', 'مهتم', 'طلب معاودة', 'غير مهتم', 'رقم خاطئ', 'تحوّل عميلاً'];

export async function POST(req: Request) {
  const { who, error } = await requireStaff();
  if (error || !who) return NextResponse.json({ error: error || 'غير مصرح' }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const source = String(b?.source || '');
  const refId = String(b?.ref_id || '');
  const outcome = String(b?.outcome || '');
  const note = b?.note ? String(b.note).slice(0, 1000) : null;

  if (!source || !refId) return NextResponse.json({ error: 'source و ref_id مطلوبان' }, { status: 400 });
  if (!OUTCOMES.includes(outcome)) return NextResponse.json({ error: 'نتيجة غير معروفة' }, { status: 400 });

  const target = MARKABLE[source];
  if (!target) {
    return NextResponse.json(
      { error: 'هذا البند يُغلق من شاشته — الطلب من مكتب الطلبات، والتحويل بتأكيده' },
      { status: 400 }
    );
  }

  const sb = admin();
  const now = new Date().toISOString();

  const { error: upErr } = await sb
    .from(target.table)
    .update({ contacted: true, contacted_at: now, outcome, contact_note: note })
    .eq('id', refId);
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  // سجلّ اللمسات مشتركٌ مع «الفرص الساخنة» — فالتسجيل هنا يُسقطها هناك.
  const { data: me } = await sb.from('staff').select('name').eq('user_id', who.userId).maybeSingle();
  // وفشلُ السجلّ لا يُسقط التسجيل نفسه — الصفّ قد كُتب، وهو الأصل.
  await sb.from('hot_touches').insert({
    source: target.hot,
    ref_id: refId,
    outcome,
    note,
    actor: who.userId,
    actor_name: me?.name || (who.role === 'admin' ? 'د. عبدالحكيم المرضي' : who.email),
  });

  return NextResponse.json({ ok: true });
}
