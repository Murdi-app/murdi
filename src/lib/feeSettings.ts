import type { SupabaseClient } from '@supabase/supabase-js';
import { COMMERCIAL, priceFor, type PriceTier } from '@/lib/servicePricing';

// ★ ١ أكتوبر (بأمر المالك): «أريد أن أتحكّم في النسب بشكلٍ عام من المنصة».
//   نسبة أتعاب استكمال الخدمة لكل خدمة، ومقدَّم «تمويل العقد» بشرائحه، ونسبة
//   الضريبة، ونصّا رسالتي العقد — كلها في جدول `fee_settings` يحرّرها المالك
//   من شاشة الخدمات. وما هنا الافتراضي وحده إن غاب الصفّ.
//   والنسبة لكل عميل تُكتب على عقده عند إصداره (`contracts.fee_percent`)؛
//   فالإعداد هو ما تبدأ به المسودّة، لا ما يُلزَم به العميل.

export const CONTRACT_FINANCE = 'تمويل العقد';

export type FeeSettings = {
  completionPct: Record<string, number>;
  cfUpfront: PriceTier[];
  vatRate: number;
  msgIssued: string;
  msgSigned: string;
  /** ★ ٣ أكتوبر: تذكير التوقيع — واتساب واحد ترسله ضي بعد يومَي عمل بلا توقيع (نصٌّ اعتمده المالك) */
  msgSignReminder: string;
  firstDelivery: Record<string, string>;
};

export const FEE_DEFAULTS: FeeSettings = {
  completionPct: { default: 6 },
  // الافتراضي من سجلّ الأسعار نفسه — لا شرائح ثانية تُكتب بيدٍ هنا
  cfUpfront: COMMERCIAL[CONTRACT_FINANCE]?.tiers || [],
  vatRate: 0,
  msgIssued: 'أهلاً {الاسم}،\nجهّزنا لكم {الوثيقة} خدمة «{الخدمة}». للاطلاع عليه: {رابط العقد}\nالدكتور عبدالحكيم المرضي — مُرضي',
  msgSigned: 'شكراً لكم. رابط سداد المقدّم ({المبلغ} ريال): {رابط الدفع}\nالدكتور عبدالحكيم المرضي — مُرضي',
  msgSignReminder: 'السلام عليكم أستاذ {الاسم}،\nمعك ضي من مكتب الدكتور عبدالحكيم المرضي.\nنذكّرك بـ{الوثيقة} خدمة «{الخدمة}» اللي أصدرناه لك، ووصلك رابطه على بريدك. تقدر تراجعه وتوقّعه من هنا مباشرة: {رابط العقد}\nوبعد التوقيع يوصلك رابط السداد تلقائياً، ونبدأ العمل على ملفك.\nوأي استفسار على العقد أو الخدمة، أنا موجودة على هذا الرقم، أو تقدر تتواصل مع المكتب على 0570749196.',
  firstDelivery: {},
};

const KEYS: Record<string, keyof FeeSettings> = {
  completion_pct: 'completionPct', contract_finance_upfront: 'cfUpfront', vat_rate: 'vatRate',
  msg_issued: 'msgIssued', msg_signed: 'msgSigned', msg_sign_reminder: 'msgSignReminder', first_delivery: 'firstDelivery',
};
export const SETTING_KEYS = Object.keys(KEYS);

/** الإعدادات من القاعدة، وما غاب منها أو فسد يأخذ الافتراضي — ولا يُسكت عن الخطأ */
export async function loadFeeSettings(sb: SupabaseClient): Promise<FeeSettings> {
  const { data, error } = await sb.from('fee_settings').select('key, value');
  if (error) throw new Error('تعذّرت قراءة إعدادات الأتعاب — ' + error.message);
  const out: FeeSettings = { ...FEE_DEFAULTS, completionPct: { ...FEE_DEFAULTS.completionPct } };
  for (const r of data || []) {
    const k = KEYS[String(r.key)];
    if (!k) continue;
    const v = r.value as unknown;
    if (k === 'vatRate') { const n = Number(v); if (Number.isFinite(n) && n >= 0 && n < 100) out.vatRate = n; }
    else if (k === 'cfUpfront') { if (Array.isArray(v) && v.every((t) => t && Number(t.price) > 0)) out.cfUpfront = v as PriceTier[]; }
    else if (k === 'msgIssued' || k === 'msgSigned' || k === 'msgSignReminder') { if (typeof v === 'string' && v.trim()) out[k] = v; }
    else if (v && typeof v === 'object' && !Array.isArray(v)) (out as Record<string, unknown>)[k] = v;
  }
  return out;
}

/** النسبة الافتراضية لخدمةٍ — ما في الإعداد لها، وإلا `default` */
export function completionPctFor(s: FeeSettings, title: string): number {
  const v = Number(s.completionPct[title] ?? s.completionPct.default);
  return Number.isFinite(v) && v > 0 ? v : 0;
}

/** مقدَّم «تمويل العقد» من قيمة العقد الفعلية — null إن لم تُعرف القيمة */
export function contractFinanceUpfront(s: FeeSettings, contractValue: number | null | undefined): number | null {
  if (!contractValue || contractValue <= 0) return null;
  return priceFor(CONTRACT_FINANCE, contractValue, s.cfUpfront).amount;
}

/** يملأ {المتغيرات} في نصّ رسالة — وما لم يُعطَ يُحذف مع ما حوله من فراغ */
export function fillMessage(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{([^{}]+)\}/g, (_, k: string) => vars[k.trim()] ?? '').replace(/[ \t]+\n/g, '\n');
}
