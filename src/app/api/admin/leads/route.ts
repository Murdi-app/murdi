import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireStaff } from '@/lib/requireStaff';
import { buildLeads, leadStats, type RawLead } from '@/lib/leadDesk';

const admin = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

// جدول mini_assessments لم تكن تقرؤه أي صفحة في المنصة: أسماء وهواتف تتراكم منذ يونيو
// بلا شاشة واحدة تعرضها. هذا المسار هو أول من يفتحه.
export async function GET() {
  const { error: denied } = await requireStaff();
  if (denied) return NextResponse.json({ error: denied }, { status: 401 });
  const a = admin();

  const { data: rows, error } = await a.from('mini_assessments')
    .select('id, created_at, full_name, phone, track, score, completed, contacted, src, answers, contacted_at, outcome, contact_note, next_action_at')
    .order('created_at', { ascending: false })
    .limit(1000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // ★ كان هذا المسار يقرأ التقييم السريع وحده، فغاب عن الشاشة من سجّل في
  //   المنصة مباشرةً بلا تقييم — وهم أثقل الأسماء وزناً (أربعون سنة تشغيل،
  //   عشرون مليوناً إيراداً). فصار المصدران في تبويبٍ واحد: من قاس ومن سجّل.
  const { data: cos } = await a.from('companies')
    .select('id, company_name, owner_name, phone, sector, city, created_at, contacted, contacted_at, outcome, contact_note, next_action_at, file_status');
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
  const { data: fin } = await a.from('financial_data')
    .select('company_id, requested_amount, annual_revenue, years_operating, created_at')
    .order('created_at', { ascending: false });
  const finBy = new Map<string, Record<string, unknown>>();
  for (const f of (fin || [])) {
    const k = String((f as Record<string, unknown>).company_id || '');
    if (k && !finBy.has(k)) finBy.set(k, f as Record<string, unknown>);
  }

  const num = (v: unknown) => { const n = Number(v); return isFinite(n) && n > 0 ? n : 0; };
  const sar = (n: number) => n.toLocaleString('en-US');

  const regLeads = (cos || []).map((c) => {
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
      band: (ask && rev && !odd ? 'ready' : odd ? 'unknown' : 'gap') as 'ready' | 'gap' | 'unknown',
      temp: 'hot' as const,
      registered: true,
      headline: odd
        ? 'سجّل ويطلب ' + sar(ask) + ' وإيراده ' + sar(rev) + ' — تحقّقي من الرقم قبل أي شيء، فالغالب خطأ إدخال'
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

  const all = [
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

const OUTCOMES = ['لا يرد', 'مهتم', 'طلب معاودة', 'غير مؤهل الآن', 'تحوّل عميلاً', 'رفض'];

export async function PATCH(req: Request) {
  const { error: denied } = await requireStaff();
  if (denied) return NextResponse.json({ error: denied }, { status: 401 });
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
    if (o && !OUTCOMES.includes(o)) return NextResponse.json({ error: 'نتيجة غير معروفة' }, { status: 400 });
    patch.outcome = o || null;
    if (o) { patch.contacted = true; patch.contacted_at = patch.contacted_at || new Date().toISOString(); }
  }
  if (body.contact_note !== undefined) patch.contact_note = String(body.contact_note || '').slice(0, 2000) || null;
  if (body.next_action_at !== undefined) patch.next_action_at = body.next_action_at || null;
  if (!Object.keys(patch).length) return NextResponse.json({ error: 'لا تغيير' }, { status: 400 });

  // صفوف المسجّلين تحمل بادئة co: وتُكتب في جدول الشركات لا في التقييم السريع
  const isCo = id.startsWith('co:');
  const { error } = isCo
    ? await admin().from('companies').update(patch).eq('id', id.slice(3))
    : await admin().from('mini_assessments').update(patch).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
