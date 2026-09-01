import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireStaff } from '@/lib/requireStaff';

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
  const { who, error: denied } = await requireStaff();
  if (denied || !who) return NextResponse.json({ error: denied || 'غير مصرح' }, { status: 401 });

  const sb = admin();
  const [list, touches] = await Promise.all([
    sb.from('hot_list').select('*').order('tier').order('at', { ascending: false }).limit(400),
    sb.from('hot_touches').select('*').order('created_at', { ascending: false }).limit(1000),
  ]);

  const rows = (list.data || []) as Row[];
  const all = (touches.data || []) as Touch[];

  // آخر لمسة لكل فرصة — ما يقرّر هل تُعرض اليوم أم تنتظر موعدها
  const last = new Map<string, Touch>();
  for (const t of all) {
    const k = t.source + '|' + t.ref_id;
    if (!last.has(k)) last.set(k, t);
  }

  const today = new Date().toISOString().slice(0, 10);
  const merged = rows.map((r) => {
    const t = last.get(r.source + '|' + r.ref_id) || null;
    // مغلقة = لا تُعرض · مؤجّلة بموعد لم يحن = تنتظر · غير ذلك = اليوم
    const closed = t?.outcome === 'غير مهتم' || t?.outcome === 'رقم خاطئ' || t?.outcome === 'تحوّل عميلاً';
    const waiting = !!t?.next_action_at && t.next_action_at > today;
    return {
      ...r,
      touches: all.filter((x) => x.source === r.source && x.ref_id === r.ref_id).length,
      last_outcome: t?.outcome || null,
      last_note: t?.note || null,
      last_at: t?.created_at || null,
      next_action_at: t?.next_action_at || null,
      state: closed ? 'closed' : waiting ? 'waiting' : 'due',
    };
  });

  const due = merged.filter((m) => m.state === 'due');
  return NextResponse.json({
    ok: true,
    role: who.role,
    rows: merged,
    stats: {
      due: due.length,
      untouched: due.filter((m) => m.touches === 0).length,
      waiting: merged.filter((m) => m.state === 'waiting').length,
      closed: merged.filter((m) => m.state === 'closed').length,
      money_on_table: merged
        .filter((m) => m.tier === 1)
        .reduce((s, m) => s + Number(m.money || 0), 0),
    },
  });
}

// POST: تسجيل لمسة — نتيجة المكالمة وموعد المعاودة
const OUTCOMES = ['لم يرد', 'مهتم', 'طلب معاودة', 'غير مهتم', 'رقم خاطئ', 'تحوّل عميلاً'];

export async function POST(req: Request) {
  const { who, error: denied } = await requireStaff();
  if (denied || !who) return NextResponse.json({ error: denied || 'غير مصرح' }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const source = String(b?.source || '');
  const refId = String(b?.ref_id || '');
  const outcome = String(b?.outcome || '');
  if (!source || !refId) return NextResponse.json({ error: 'source و ref_id مطلوبان' }, { status: 400 });
  if (!OUTCOMES.includes(outcome)) return NextResponse.json({ error: 'نتيجة غير معروفة' }, { status: 400 });

  const sb = admin();
  const { data: me } = await sb.from('staff').select('name').eq('user_id', who.userId).maybeSingle();

  const { error } = await sb.from('hot_touches').insert({
    source,
    ref_id: refId,
    outcome,
    note: b?.note ? String(b.note).slice(0, 2000) : null,
    next_action_at: b?.next_action_at ? String(b.next_action_at).slice(0, 10) : null,
    actor: who.userId,
    actor_name: who.role === 'admin' ? 'د. عبدالحكيم' : String(me?.name || 'الفريق'),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // التقييم له عمودا اتصال خاصان به — تُحدَّث حتى لا يظهر الاسم مرتين
  if (source === 'assessment') {
    await sb
      .from('mini_assessments')
      .update({
        contacted: true,
        contacted_at: new Date().toISOString(),
        outcome,
        contact_note: b?.note ? String(b.note).slice(0, 1000) : null,
        next_action_at: b?.next_action_at ? String(b.next_action_at).slice(0, 10) : null,
      })
      .eq('id', refId);
  }

  return NextResponse.json({ ok: true });
}
