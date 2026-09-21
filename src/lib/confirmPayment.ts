import type { SupabaseClient } from '@supabase/supabase-js';
import { canonicalTitle } from '@/lib/serviceCatalog';
import { sendPush } from '@/lib/push';

// تأكيد استلام دفعة — بابٌ واحد يمرّ منه المالك ومكتب الطلبات معاً.
//
// ★ كان هذا المنطق كلّه داخل `/api/admin/payments` وحده، فلم يكن لأحدٍ غير
//   المالك أن يؤكّد تحويلاً. ثم فُتح للموظفتين قبولُ الخدمات (٢١ سبتمبر)،
//   وقبولُ خدمةٍ مسعَّرة معناه تأكيدُ أن العميل دفع ثمنها — فلزم أن يكون
//   المنطق نفسه لا نسخةً منه: ختمُ الطلب مدفوعاً، ومنحُ تشغيلة المطابقة لما
//   يَعِد مخرَجُه بجدول جهات، وإشعارُ المالك. نسختان كانتا ستفترقان يوماً،
//   فيدفع العميل عند الموظفة ولا تُمنح له المطابقة.

// الخدمة التي يَعِد مخرَجها بجدول جهات تشتري تشغيلة مطابقة معها.
//
// وكان تأكيد دفعة الخدمة يختم الطلب «مدفوعاً» ولا يمنح رصيد تشغيلة —
// فيدفع العميل سبعة آلاف وتسعمئة ثمن ملفٍ نصفُه قائمة جهات، ثم يقف
// الملف بلا مطابقة ولا يعرف أحد لماذا. وقع فعلاً على عميل دفع.
const NEEDS_MATCH = new Set<string>([
  'تجهيز ملف التمويل والتفاوض',
  'دراسة الجدوى الاقتصادية',
  'تمويل العقد',
  'ملف الممر الأجنبي',
  'تجهيز ملف عرض المستثمر والتفاوض',
]);

export type ConfirmResult = { ok: true; note: string | null } | { ok: false; error: string; status: number };

/** يؤكّد دفعةً بمعرّفها. `by` اسمُ من أكّد، يظهر في إشعار المالك حين لا يكون هو. */
export async function confirmPayment(sb: SupabaseClient, id: string, by?: string): Promise<ConfirmResult> {
  const { data: pay } = await sb.from('payments').select('*').eq('id', id).maybeSingle();
  if (!pay) return { ok: false, error: 'غير موجود', status: 404 };

  // ملاحظة تُعاد حين يتعذّر ربط الدفعة بطلبها تلقائياً
  let linkNote: string | null = null;
  await sb.from('payments').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', id);

  // الاشتراك الربعي أُلغي: الدفعة صارت تشتري تشغيلة مطابقة واحدة لأي مسار.
  // ويبقى المشتركون القدامى على مدتهم — لا نقطع عليهم ما دفعوه قبل التغيير.
  if ((pay.kind === 'subscription' || pay.kind === 'match_run') && pay.company_id) {
    await sb.rpc('grant_match_credit', { p_company: pay.company_id, p_n: 1 });
    // الحساب يُفتح ليدخل العميل ويشغّل، بلا تاريخ انتهاء يُحاسَب عليه
    await sb.from('companies')
      .update({ account_status: 'active', payment_confirmed_at: new Date().toISOString() })
      .eq('id', pay.company_id);
  }

  if (pay.kind === 'service' && pay.company_id) {
    const stamp = { status: 'paid', payment_id: id, paid_at: new Date().toISOString(), payment_ref: id, updated_at: new Date().toISOString() };
    // المعرّف يُلتقط في ثابت قبل الإغلاق: تضييق `pay.company_id` لا يعبر
    // إلى داخل دالة، فيسقط البناء على «قد يكون undefined».
    const payCompanyId = String(pay.company_id);
    const grantIfNeeded = async (title: string | null | undefined) => {
      if (!title || !NEEDS_MATCH.has(canonicalTitle(String(title)))) return;
      await sb.rpc('grant_match_credit', { p_company: payCompanyId, p_n: 1 });
      await sb.from('companies')
        .update({ account_status: 'active', payment_confirmed_at: new Date().toISOString() })
        .eq('id', payCompanyId);
    };
    if (pay.service_request_id) {
      await sb.from('service_requests').update(stamp).eq('id', pay.service_request_id);
      const { data: srv } = await sb.from('service_requests')
        .select('service_title').eq('id', pay.service_request_id).maybeSingle();
      await grantIfNeeded(srv?.service_title);
    } else {
      // دفعات قديمة بلا رقم طلب: نطابق بالمبلغ، ولا نخمّن حين يتعدد المرشّح
      const { data: cands } = await sb.from('service_requests')
        .select('id, price, quoted_price, service_title')
        .eq('company_id', pay.company_id).eq('status', 'priced');
      const amt = Number(pay.amount_sar || 0);
      const hit = (cands || []).filter((c: { price: number | null; quoted_price: number | null }) =>
        Number(c.price ?? c.quoted_price ?? -1) === amt);
      if (hit.length === 1) {
        await sb.from('service_requests').update(stamp).eq('id', hit[0].id);
        const { data: srv2 } = await sb.from('service_requests')
          .select('service_title').eq('id', hit[0].id).maybeSingle();
        await grantIfNeeded(srv2?.service_title);
      } else {
        linkNote = hit.length === 0
          ? 'لم يُطابق أي طلب مسعّر مبلغَ هذه الدفعة — اربطها بالطلب يدوياً من لوحة الخدمات.'
          : 'أكثر من طلب مسعّر بنفس المبلغ — لم يُعلَّم أيٌّ منها تلقائياً حتى لا يُسلَّم طلب بلا دفع. اربطها يدوياً.';
      }
    }
  }

  // المال يدخل، فيصل خبره إلى الجوال — ومعه ما ينبغي عمله بعده مباشرة
  try {
    const { data: payCo } = await sb.from('companies')
      .select('company_name').eq('id', String(pay.company_id || '')).maybeSingle();
    await sendPush({
      title: '💰 دفعة مؤكَّدة — ' + Number(pay.amount_sar || 0).toLocaleString('en-US') + ' ريال',
      body: String(payCo?.company_name || 'منشأة')
        + (by ? ' — أكّدها ' + by : '')
        + (linkNote ? ' — ' + linkNote : ' — الخدمة صارت مدفوعة، والمطابقة صارت من حقه'),
      url: 'https://murdi.sa/admin/approvals',
      important: true,
      tag: 'pay-' + id,
    });
  } catch {}

  return { ok: true, note: linkNote };
}
