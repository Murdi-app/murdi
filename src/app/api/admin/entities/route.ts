import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/requireAdmin';

// كانت هذه الشاشة تدير جدولين ميّتين: financing_products (٤ صفوف) و investment_entities (صفر)،
// ولا يقرأ منهما محرك المطابقة شيئاً — فكان تبويباً يبدو عاملاً ولا أثر له.
// صارت الآن بوابة سجلّ الجهات: ما اكتشفه المحرك فعلاً، مضافاً إليه ما تعلّمه الواقع من الردود.

const admin = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

const BROKEN = ['غير موجودة', 'تعذّر الوصول', 'محجوب آلياً'];

export async function GET(req: Request) {
  const denied = await requireAdmin();
  if (denied) return NextResponse.json({ error: denied }, { status: 401 });
  const a = admin();
  const q = new URL(req.url).searchParams;
  const search = String(q.get('q') || '').trim();
  const track = String(q.get('track') || '');
  const view = String(q.get('view') || 'core');

  let sel = a.from('funding_entities').select('*');
  if (search) sel = sel.ilike('display_name', '%' + search + '%');
  if (track) sel = sel.contains('tracks', [track]);

  // العرض الافتراضي «النواة»: من ظهر لأكثر من عميل — إشارة أنه جهة حقيقية متكررة
  // لا اسماً ظهر مرة في بحث واحد.
  if (view === 'core') sel = sel.gte('companies_seen', 2);
  if (view === 'once') sel = sel.eq('companies_seen', 1);
  if (view === 'replied') sel = sel.gt('outreach_replied', 0);
  if (view === 'silent') sel = sel.gt('outreach_sent', 0).eq('outreach_replied', 0);
  if (view === 'broken') sel = sel.in('link_status', BROKEN);
  if (view === 'blocked') sel = sel.eq('blocked', true);
  else sel = sel.eq('blocked', false);

  const { data, error } = await sel
    .order('companies_seen', { ascending: false })
    .order('times_matched', { ascending: false })
    .limit(600);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: all } = await a.from('funding_entities')
    .select('companies_seen, evidence_grade, link_status, outreach_sent, outreach_replied, median_reply_hours, blocked');
  const rows = all || [];
  const replied = rows.filter(r => (r.outreach_replied || 0) > 0);
  const meds = replied.map(r => Number(r.median_reply_hours)).filter(n => n > 0).sort((x, y) => x - y);

  return NextResponse.json({
    ok: true,
    entities: data || [],
    stats: {
      total: rows.length,
      core: rows.filter(r => (r.companies_seen || 0) >= 2).length,
      once: rows.filter(r => (r.companies_seen || 0) === 1).length,
      confirmed: rows.filter(r => r.evidence_grade === 'مؤكّد').length,
      needsCheck: rows.filter(r => r.evidence_grade === 'يحتاج تحقق' || !r.evidence_grade).length,
      broken: rows.filter(r => BROKEN.includes(String(r.link_status))).length,
      contacted: rows.filter(r => (r.outreach_sent || 0) > 0).length,
      replied: replied.length,
      blocked: rows.filter(r => r.blocked).length,
      medianReplyHours: meds.length ? meds[Math.floor(meds.length / 2)] : null,
    },
  });
}

// إعادة البناء من مخرجات المحرك — لا تمسّ حكم المستشار (verdict / blocked / admin_note)
export async function POST() {
  const denied = await requireAdmin();
  if (denied) return NextResponse.json({ error: denied }, { status: 401 });
  const { data, error } = await admin().rpc('rebuild_funding_entities');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const r = Array.isArray(data) ? data[0] : data;
  return NextResponse.json({ ok: true, result: r });
}

const VERDICTS = ['معتمدة', 'قيد التحقق', 'لا تُناسبنا', 'لا وجود لها'];

export async function PATCH(req: Request) {
  const denied = await requireAdmin();
  if (denied) return NextResponse.json({ error: denied }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const id = String(b?.id || '');
  if (!id) return NextResponse.json({ error: 'id مطلوب' }, { status: 400 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (b.verdict !== undefined) {
    const v = String(b.verdict || '');
    if (v && !VERDICTS.includes(v)) return NextResponse.json({ error: 'حكم غير معروف' }, { status: 400 });
    patch.verdict = v || null;
    // «لا وجود لها» تُقصى من العرض تلقائياً: لا معنى لإبقائها أمام عينك مرة أخرى
    if (v === 'لا وجود لها') patch.blocked = true;
  }
  if (b.blocked !== undefined) patch.blocked = Boolean(b.blocked);
  if (b.admin_note !== undefined) patch.admin_note = String(b.admin_note || '').slice(0, 2000) || null;

  const { error } = await admin().from('funding_entities').update(patch).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
