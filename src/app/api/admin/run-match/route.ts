import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { runAutoMatch } from '@/lib/matchEngine';
import { requireAdmin } from '@/lib/requireAdmin';
import { logError } from '@/lib/logError';

export const maxDuration = 300;
export const runtime = 'nodejs';

// تشغيل مطابقة مسار التمويل أو الاستثمار من لوحة الإدارة.
//
// وكان تشغيلها بيد العميل وحده: يدخل حسابه ويضغط «طابق». فمن دفع ثم تردّد
// في الدخول — وهذا يقع — بقي ملفه واقفاً بلا أن يملك المكتب تحريكه، وهو
// الذي قبض. ولا يوجد باب ثالث: `match/worker` محروسٌ بسرٍّ لا يُعرف من
// المتصفح، و`match/run` يقرأ جلسة العميل نفسه.
//
// ★ ولا يُمسّ المحرّك ولا مساره: هذا نداءٌ لـrunAutoMatch كما ينادِيه
//   `match/run` حرفاً بحرف — نفس الدالة ونفس الدفعات ونفس الحفظ.
// ★ والرصيد يُخصم كما يُخصم على العميل: من دفع تشغيلةً يأخذ واحدة، ولا
//   تُفتح للمكتب تشغيلاتٌ بلا حساب — فالتشغيلة تكلّف، والحساب يُمسك.

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return NextResponse.json({ error: denied }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const companyId = String(b?.companyId || '');
  const track: 'funding' | 'investment' = b?.track === 'investment' ? 'investment' : 'funding';
  const batch: number | undefined = typeof b?.batch === 'number' ? b.batch : undefined;
  const spend = b?.spend !== false;   // الدفعة الأولى وحدها تخصم الرصيد
  if (!companyId) return NextResponse.json({ error: 'companyId مطلوب' }, { status: 400 });

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  );

  try {
    const { data: co } = await admin.from('companies')
      .select('id, company_name, match_credits').eq('id', companyId).maybeSingle();
    if (!co) return NextResponse.json({ error: 'المنشأة غير موجودة' }, { status: 404 });

    // التقييم شرطٌ لا شكلي: بلا `financial_data` يبحث المحرّك عن منشأةٍ بلا
    // أرقام فيردّ صفوفاً عامة — ويُصرف ثمنُ تشغيلةٍ على لا شيء.
    const { data: fd } = await admin.from('financial_data')
      .select('id').eq('company_id', companyId).limit(1).maybeSingle();
    if (!fd) {
      return NextResponse.json(
        { error: 'لا توجد بيانات مالية لهذه المنشأة — التقييم قبل المطابقة، وإلا صُرفت تشغيلة على ملف فارغ' },
        { status: 422 }
      );
    }

    if (batch === undefined || batch === 0) {
      if (spend && Number(co.match_credits || 0) < 1) {
        return NextResponse.json(
          { error: 'لا يوجد رصيد تشغيلة لهذه المنشأة. تُمنح بتأكيد دفعة خدمةٍ فيها جدول جهات، أو بمنحها يدوياً.' },
          { status: 402 }
        );
      }
      if (spend) {
        await admin.from('companies')
          .update({ match_credits: Math.max(0, Number(co.match_credits || 0) - 1) })
          .eq('id', companyId);
      }
    }

    const r = await runAutoMatch(companyId, track, batch);

    const { count } = await admin.from('match_results')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId).eq('track', track).eq('status', 'new').gt('fit_score', 0);

    return NextResponse.json({
      ok: true, done: r.done, next: r.next, total: r.total,
      count: count || 0, company: co.company_name, track,
    });
  } catch (e) {
    await logError('admin.run-match', e, { company_id: companyId, track });
    return NextResponse.json({ error: 'تعذّر تشغيل المطابقة: ' + String(e).slice(0, 140) }, { status: 500 });
  }
}
