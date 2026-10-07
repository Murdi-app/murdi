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

// الحالات التي تُقبل منها الدفعة للتأكيد. وما عداها قد حُسم.
const CONFIRMABLE = ['awaiting_confirmation', 'pending'];

// طلبٌ تجاوز الدفعَ في مساره لا يُعاد ختمُه «مدفوعاً» — وإلا نزل العمل
// المنجز إلى الوراء بمجرّد تأكيدٍ متأخّر.
// و`paid` منها: طلبٌ مدفوع لا يُختم ثانيةً بدفعةٍ ثانية — وإلا مُنحت تشغيلةٌ
// ثانية عن ثمنٍ واحد (رابط تحويلٍ قديم في سجلّ المتصفح كان يصنعها).
const PAST_PAYMENT = '(paid,in_progress,in_follow_up,delivered,completed)';

/** يؤكّد دفعةً بمعرّفها. `by` اسمُ من أكّد، يظهر في إشعار المالك حين لا يكون هو. */
export async function confirmPayment(sb: SupabaseClient, id: string, by?: string): Promise<ConfirmResult> {
  const { data: pay, error: readErr } = await sb.from('payments').select('*').eq('id', id).maybeSingle();
  if (readErr) return { ok: false, error: 'تعذّرت قراءة الدفعة: ' + readErr.message, status: 500 };
  if (!pay) return { ok: false, error: 'غير موجود', status: 404 };

  // ★ التأكيد مرةً واحدة. كان يُعاد بلا شرط: ضغطتان — أو المالك من لوحة
  //   المدفوعات وضي من المكتب على الدفعة نفسها — تمنحان العميلَ تشغيلتَي
  //   مطابقة عن ثمنٍ واحد، وتُعيدان طلباً سُلِّم إلى «مدفوع». وكان يقبل
  //   تحويلاً مرفوضاً فيحييه.
  if (pay.status === 'paid') return { ok: false, error: 'أُكّدت هذه الدفعة من قبل', status: 409 };
  if (!CONFIRMABLE.includes(String(pay.status))) {
    return { ok: false, error: 'هذه الدفعة حُسمت — حالتها: ' + pay.status, status: 409 };
  }

  // الحجز ذرّي: الانتقال مشروطٌ بالحالة التي قُرئت، فمن سبق أخذها ومن تأخّر يُردّ
  const { data: claimed, error: claimErr } = await sb.from('payments')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .eq('id', id).eq('status', pay.status)
    .select('id');
  if (claimErr) return { ok: false, error: 'تعذّر قيد الدفعة: ' + claimErr.message, status: 500 };
  if (!claimed?.length) return { ok: false, error: 'أُكّدت هذه الدفعة للتوّ من مكانٍ آخر', status: 409 };

  // من هنا المال مقيَّد. وكل ما يتعذّر بعده يُقال في الملاحظة ولا يُبتلع:
  // التأكيد لا يُتراجع عنه لأن المبلغ وصل فعلاً، لكن ما لم يُكمَل يجب أن يُرى.
  const notes: string[] = [];
  const grant = async (companyId: string) => {
    const { error: gErr } = await sb.rpc('grant_match_credit', { p_company: companyId, p_n: 1 });
    if (gErr) { notes.push('لم تُمنح تشغيلة المطابقة (' + gErr.message + ') — امنحها يدوياً.'); return; }
    // الحساب يُفتح ليدخل العميل ويشغّل، بلا تاريخ انتهاء يُحاسَب عليه
    const { error: aErr } = await sb.from('companies')
      .update({ account_status: 'active', payment_confirmed_at: new Date().toISOString() })
      .eq('id', companyId);
    if (aErr) notes.push('مُنحت التشغيلة ولم يُفتح الحساب (' + aErr.message + ').');
  };

  // الاشتراك الربعي أُلغي: الدفعة صارت تشتري تشغيلة مطابقة واحدة لأي مسار.
  // ويبقى المشتركون القدامى على مدتهم — لا نقطع عليهم ما دفعوه قبل التغيير.
  if ((pay.kind === 'subscription' || pay.kind === 'match_run') && pay.company_id) {
    await grant(String(pay.company_id));
  }

  if (pay.kind === 'service' && pay.company_id) {
    const stamp = { status: 'paid', payment_id: id, paid_at: new Date().toISOString(), payment_ref: id, updated_at: new Date().toISOString() };
    const amt = Number(pay.amount_sar || 0);
    type Sr = { id: string; price: number | null; quoted_price: number | null; service_title: string | null; status: string | null; option_key?: string | null };
    let target: Sr | null = null;

    if (pay.service_request_id) {
      const { data: srv, error: sErr } = await sb.from('service_requests')
        .select('id, price, quoted_price, service_title, status, option_key').eq('id', pay.service_request_id).maybeSingle();
      if (sErr || !srv) notes.push('تعذّر العثور على الطلب المربوط بالدفعة — اختمه يدوياً من لوحة الخدمات.');
      else target = srv as Sr;
    } else {
      // دفعات قديمة بلا رقم طلب: نطابق بالمبلغ، ولا نخمّن حين يتعدد المرشّح
      const { data: cands } = await sb.from('service_requests')
        .select('id, price, quoted_price, service_title, status, option_key')
        .eq('company_id', pay.company_id).eq('status', 'priced');
      const hit = ((cands || []) as Sr[]).filter((c) => Number(c.price ?? c.quoted_price ?? -1) === amt);
      if (hit.length === 1) target = hit[0];
      else notes.push(hit.length === 0
        ? 'لم يُطابق أي طلب مسعّر مبلغَ هذه الدفعة — اربطها بالطلب يدوياً من لوحة الخدمات.'
        : 'أكثر من طلب مسعّر بنفس المبلغ — لم يُعلَّم أيٌّ منها تلقائياً حتى لا يُسلَّم طلب بلا دفع. اربطها يدوياً.');
    }

    if (target) {
      // السعر قد يتغيّر بعد رفع الإيصال: المبلغ المحوَّل أُخذ من سعر لحظتها
      const due = Number(target.price ?? 0);
      if (due && due !== amt) {
        notes.push('المحوَّل ' + amt.toLocaleString('en-US') + ' والسعر الحالي ' + due.toLocaleString('en-US') + ' — راجع الفرق مع العميل.');
      }
      const { data: stamped, error: stErr } = await sb.from('service_requests')
        .update(stamp).eq('id', target.id).not('status', 'in', PAST_PAYMENT).select('id');
      if (stErr) notes.push('قُيّد المبلغ ولم يُختم الطلب مدفوعاً (' + stErr.message + ') — اختمه يدوياً.');
      else if (stamped?.length) {
        const title = target.service_title;
        // الفحص الائتماني **للمشروع** (خيار quick في دراسة الجدوى) يستثني جدول
        // الجهات صراحةً في الكتالوج — فلا تُمنح عليه تشغيلة مطابقة لا يشمله
        // ثمنها. أما «الحكم الائتماني لمنشأتك» (quick في مسار التمويل) فيسمّي
        // جهاته، فيبقى على المنح.
        // ★ ٧ أكتوبر (بأمر المالك): الفحص الائتماني كلّه سواء — فحص المشروع يسمّي جهاته أيضاً، فيُمنح المطابقة
        if (title && NEEDS_MATCH.has(canonicalTitle(String(title)))) await grant(String(pay.company_id));
      }
      // وإن لم يُختم لأنه تجاوز الدفع، فلا ملاحظة: العمل جارٍ والدفعة قُيّدت له
    }
  }

  const linkNote = notes.length ? notes.join(' ') : null;

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
