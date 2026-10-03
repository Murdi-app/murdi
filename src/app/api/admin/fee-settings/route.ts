import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/requireAdmin';
import { loadFeeSettings, SETTING_KEYS } from '@/lib/feeSettings';
import { COMMISSION_SERVICES } from '@/lib/contracts';

// إعدادات الأتعاب والرسائل — للمالك وحده. كل مفتاحٍ يُتحقّق من شكله قبل الحفظ:
// نسبةٌ بين ٠ و٣٠، وشرائح مقدَّمٍ موجبة مرتّبة آخرها مفتوح، ورسالةٌ تحمل رابطها.
export const dynamic = 'force-dynamic';
const admin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string);

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return NextResponse.json({ error: denied }, { status: 401 });
  try {
    const s = await loadFeeSettings(admin());
    return NextResponse.json({ ok: true, settings: s, services: Object.keys(COMMISSION_SERVICES) });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : 'تعذّرت القراءة' }, { status: 500 }); }
}

function check(key: string, v: unknown): string | null {
  if (key === 'completion_pct') {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return 'النسب ليست جدولاً';
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      const n = Number(x);
      if (!(n > 0 && n <= 30)) return 'نسبة «' + k + '» بين ٠ و٣٠';
    }
    return null;
  }
  if (key === 'contract_finance_upfront') {
    if (!Array.isArray(v) || v.length < 1) return 'الشرائح فارغة';
    let last = 0;
    for (let i = 0; i < v.length; i++) {
      const t = v[i] as { upTo: unknown; price: unknown };
      if (!(Number(t.price) > 0)) return 'مقدَّم الشريحة ' + (i + 1) + ' يجب أن يكون موجباً';
      const open = t.upTo === null || t.upTo === '' || t.upTo === undefined;
      if (open && i !== v.length - 1) return 'الشريحة المفتوحة (بلا حدّ) تكون الأخيرة';
      if (!open && !(Number(t.upTo) > last)) return 'حدود الشرائح تصاعدية';
      if (!open) last = Number(t.upTo);
    }
    if ((v[v.length - 1] as { upTo: unknown }).upTo !== null) return 'آخر شريحة بلا حدّ أعلى';
    return null;
  }
  if (key === 'vat_rate') { const n = Number(v); return n >= 0 && n < 100 ? null : 'نسبة الضريبة بين ٠ و٩٩'; }
  if (key === 'msg_issued') return typeof v === 'string' && v.includes('{رابط العقد}') ? null : 'الرسالة الأولى لا بدّ أن تحمل {رابط العقد}';
  if (key === 'msg_signed') return typeof v === 'string' && v.includes('{رابط الدفع}') ? null : 'الرسالة الثانية لا بدّ أن تحمل {رابط الدفع}';
  if (key === 'msg_sign_reminder') return typeof v === 'string' && v.includes('{رابط العقد}') && !/ريال|﷼|٪|%/.test(v) ? null : 'تذكير التوقيع يحمل {رابط العقد}، ولا مبلغ فيه (ترسله الموظفة)';
  if (key === 'first_delivery') return v && typeof v === 'object' && !Array.isArray(v) ? null : 'صيغة غير صحيحة';
  return 'مفتاح غير معروف';
}

export async function PUT(req: Request) {
  const denied = await requireAdmin();
  if (denied) return NextResponse.json({ error: denied }, { status: 401 });
  const b = await req.json().catch(() => ({} as Record<string, unknown>));
  const key = String(b.key || '');
  if (!SETTING_KEYS.includes(key)) return NextResponse.json({ error: 'مفتاح غير معروف' }, { status: 400 });
  let value = b.value;
  if (key === 'contract_finance_upfront' && Array.isArray(value)) {
    value = value.map((t: { upTo: unknown; price: unknown }) => ({ upTo: t.upTo === '' || t.upTo === null || t.upTo === undefined ? null : Number(t.upTo), price: Number(t.price) }));
  }
  if (key === 'vat_rate') value = Number(value);
  const bad = check(key, value);
  if (bad) return NextResponse.json({ error: bad }, { status: 400 });
  const { error } = await admin().from('fee_settings').upsert({ key, value, updated_at: new Date().toISOString(), updated_by: 'المالك' });
  if (error) return NextResponse.json({ error: 'لم يُحفظ — ' + error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
