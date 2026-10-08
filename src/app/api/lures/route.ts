import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { computeLures } from '@/lib/lures';

// طُعم الخدمات الخمس لمنشأة العميل نفسه — أرقامٌ بلا أسماء جهات.
// ?investment=&ask=&isNew= لطُعم الجدوى (يُدخلها العميل في البطاقة ولا تُحفظ).
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const store = await cookies();
  const sb = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    { cookies: { getAll: () => store.getAll(), setAll: () => {} } });
  const { data } = await sb.auth.getUser();
  if (!data?.user) return NextResponse.json({ error: 'سجّل الدخول' }, { status: 401 });
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string);
  const { data: co } = await admin.from('companies').select('id').eq('user_id', data.user.id).maybeSingle();
  if (!co) return NextResponse.json({ error: 'لا منشأة' }, { status: 404 });
  const q = new URL(req.url).searchParams;
  const n = (k: string) => { const v = Number(q.get(k)); return Number.isFinite(v) && v > 0 ? v : undefined; };
  // ★ ٨ أكتوبر: بلا مدخلات في الرابط تُقرأ مدخلات الجدوى المحفوظة للعميل (service_inputs) — وإلا فلا طُعم جدوى بعدد
  let fz: { investment?: number; ask?: number; isNew?: boolean } = { investment: n('investment'), ask: n('ask'), isNew: q.get('isNew') !== 'false' };
  if (!fz.investment) {
    const { data: si } = await admin.from('service_inputs').select('inputs').eq('company_id', co.id).eq('activity_kind', 'feasibility')
      .order('updated_at', { ascending: false }).limit(1).maybeSingle();
    const raw = (si?.inputs as Record<string, unknown> | null) || null;
    if (raw) {
      const v = (k: string) => Number(String(raw[k] ?? '').replace(/,/g, '')) || 0;
      const inv = v('capex') + v('workingCapital');
      if (inv > 0) fz = { investment: inv, ask: v('financingAmount') || undefined, isNew: String(raw.projectKind || '') !== 'expansion' };
    }
  }
  const lures = await computeLures(admin, String(co.id), fz);
  return NextResponse.json({ ok: true, lures });
}
