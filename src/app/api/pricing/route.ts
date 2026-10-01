import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { loadFeeSettings } from '@/lib/feeSettings';

// شرائح المقدَّم كما في إعدادات المالك — تقرؤها الصفحات العامة فلا تُظهر سعراً
// والخادمُ يحصّل غيره. لا شيء فيها سرّي: هي الأسعار المعلنة نفسها.
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string);
    const s = await loadFeeSettings(sb);
    return NextResponse.json({ ok: true, contract_finance_tiers: s.cfUpfront, vat_rate: s.vatRate });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'تعذّرت القراءة' }, { status: 500 });
  }
}
