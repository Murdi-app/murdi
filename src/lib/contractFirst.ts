import type { SupabaseClient } from '@supabase/supabase-js';
import { COMMERCIAL } from '@/lib/servicePricing';
import { COMMISSION_SERVICES, renderContract, needsSignedContract } from '@/lib/contracts';
import { loadFeeSettings, completionPctFor, fillMessage, type FeeSettings } from '@/lib/feeSettings';
import { shortLink, SITE } from '@/lib/shortLinks';
import { writtenOn } from '@/lib/contractStamp';

// ★ ١ أكتوبر (بأمر المالك) — «العقد أولاً» في كل الخدمات:
//   · خدمةٌ فيها أتعاب استكمال (نسبة) ← عقدٌ يُصدره المالك ويوقّعه العميل، ثم الدفع.
//   · خدمةٌ برسمٍ ثابت ← «سند خدمة» يصدر قبل الدفع: اسمها وما تشمله وما لا تشمله
//     ومدّتها وسعرها. ولا رابط دفع قبل أيٍّ منهما (`contractGate`).
//   وهذا الملف يُنشئ الوثيقة ويبني الرسالتين؛ والحارس يقرأ القاعدة نفسها.

export type DocKind = 'contract' | 'voucher';
export { needsSignedContract };
export const docKindFor = (title: string): DocKind => (needsSignedContract(title) ? 'contract' : 'voucher');

type SR = { id: string; company_id: string; service_title: string; option_key: string | null; price: number | null; contract_value: number | null; status: string };

async function loadSR(sb: SupabaseClient, srId: string): Promise<SR> {
  const { data, error } = await sb.from('service_requests')
    .select('id, company_id, service_title, option_key, price, contract_value, status').eq('id', srId).maybeSingle();
  if (error || !data) throw new Error('الطلب غير موجود' + (error ? ' — ' + error.message : ''));
  return data as SR;
}

const money = (n: number) => Math.round(n).toLocaleString('en-US');

/** نصّ سند الخدمة — من سجلّ الأسعار نفسه، فلا يَعِد السند بغير ما في الصفحة */
export function voucherBody(title: string, optionKey: string | null, price: number, s: FeeSettings, company: { name: string; cr: string | null }): string {
  const c = COMMERCIAL[title];
  const opt = optionKey ? c?.options?.find((o) => o.key === optionKey) : undefined;
  const label = opt?.label || title;
  const includes = (opt?.includes?.length ? opt.includes : c?.deliverables?.length ? c.deliverables : c?.whatWeDo) || [];
  const excludes = [
    ...(opt?.excludes || []),
    'تقديم أي تمويل أو ضمان موافقة أي جهة — فقرار الجهة لها وحدها',
    'أي عملٍ خارج ما ذُكر أعلاه، إلا باتفاقٍ مكتوب',
  ];
  const days = opt?.days || c?.days || 'يُتّفق عليه';
  const vat = s.vatRate > 0
    ? 'المبلغ المستحق: (' + money(price) + ') ريال سعودي شاملاً ضريبة القيمة المضافة (' + s.vatRate + '٪)، ويصدر به فاتورة ضريبية نظامية.'
    : 'المبلغ المستحق: (' + money(price) + ') ريال سعودي.';
  return `سند خدمة — ${label}
${writtenOn(new Date())}

صادرٌ من: شركة حلول المرضي للاستشارات المالية، سجل تجاري رقم (7039663724)، ترخيص المستشار رقم (FL-457927015).
إلى: ${company.name || '(..............)'}، سجل تجاري رقم (${company.cr || '..............'}).

ما تشمله الخدمة:
${includes.map((x) => '- ' + x).join('\n')}

ما لا تشمله:
${excludes.map((x) => '- ' + x).join('\n')}

مدة التسليم: ${days}، تبدأ من تأكيد السداد واستلام ما يلزم من بيانات.

${vat}
ويُسدَّد كاملاً قبل بدء العمل، ولا يرتبط بحصول العميل على تمويل ولا بمقداره. ولا يتقاضى الطرف المُصدِر أي عمولة من أي جهة.

الطرف الأول: المستشار/ عبدالحكيم — حلول المرضي للاستشارات المالية
التوقيع: عبدالحكيم`;
}

/**
 * يضمن وثيقة الطلب قبل الدفع: مسودّة عقدٍ بالنسبة الافتراضية للخدمات ذات النسبة
 * (يُصدرها المالك بعد مراجعتها)، أو سند خدمةٍ صادراً للرسم الثابت.
 * ولا يمسّ وثيقةً موجودة.
 */
export async function ensureDocument(sb: SupabaseClient, srId: string): Promise<{ kind: DocKind; id: string; status: string; created: boolean }> {
  const sr = await loadSR(sb, srId);
  const kind = docKindFor(sr.service_title);
  const { data: ex } = await sb.from('contracts').select('id, status, contract_type')
    .eq('service_request_id', sr.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (ex) return { kind, id: String(ex.id), status: String(ex.status), created: false };
  const s = await loadFeeSettings(sb);
  const { data: co } = await sb.from('companies').select('company_name, cr_number').eq('id', sr.company_id).maybeSingle();
  const company = { name: String(co?.company_name || ''), cr: co?.cr_number ? String(co.cr_number) : null };
  const price = Number(sr.price || 0);
  if (kind === 'voucher') {
    if (!(price > 0)) throw new Error('لا سند قبل السعر');
    const { data, error } = await sb.from('contracts').insert({
      company_id: sr.company_id, service_request_id: sr.id, contract_type: 'voucher', status: 'issued',
      issued_at: new Date().toISOString(), fee_type: 'fixed', fixed_amount: price,
      establishment_name: company.name || null, establishment_cr: company.cr,
      contract_body: voucherBody(sr.service_title, sr.option_key, price, s, company),
    }).select('id').single();
    if (error || !data) throw new Error('تعذّر إصدار سند الخدمة — ' + (error?.message || ''));
    return { kind, id: String(data.id), status: 'issued', created: true };
  }
  const type = COMMISSION_SERVICES[sr.service_title];
  const pct = completionPctFor(s, sr.service_title);
  const fields = { feeType: 'deferred' as const, fixedAmount: price || undefined, feePercent: pct || undefined,
    establishmentName: company.name, establishmentCr: company.cr || undefined, contractValue: sr.contract_value || undefined };
  const { data, error } = await sb.from('contracts').insert({
    company_id: sr.company_id, service_request_id: sr.id, contract_type: type, status: 'draft',
    fee_type: 'deferred', fixed_amount: price || null, fee_percent: pct || null, success_base: 'financing',
    deal_value: sr.contract_value, establishment_name: company.name || null, establishment_cr: company.cr,
    contract_body: renderContract(type, fields),
  }).select('id').single();
  if (error || !data) throw new Error('تعذّر إنشاء مسودّة العقد — ' + (error?.message || ''));
  return { kind, id: String(data.id), status: 'draft', created: true };
}

/** يُعيد نصّ مسودّة العقد من صفّها وطلبها (المقدَّم · قيمة العقد · المنشأة) — لا يمسّ الصادر */
export async function refreshDraft(sb: SupabaseClient, srId: string): Promise<void> {
  const sr = await loadSR(sb, srId);
  const { data: c } = await sb.from('contracts').select('id, contract_type, status, fee_percent, fixed_amount, fee_scope, lang, with_statements')
    .eq('service_request_id', sr.id).eq('status', 'draft').order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (!c || c.contract_type === 'voucher') return;
  const { data: co } = await sb.from('companies').select('company_name, cr_number').eq('id', sr.company_id).maybeSingle();
  // ★ ٧/١٠: سعرٌ صفرٌ صريح = «الدفع عند الصرف» (لا مقدَّم) — لا يُقلب إلى نقاط
  const fixed = sr.price !== null && sr.price !== undefined ? Number(sr.price) : (c.fixed_amount !== null ? Number(c.fixed_amount) : undefined);
  const fields = { feeType: 'deferred' as const, fixedAmount: fixed, feePercent: Number(c.fee_percent) || undefined, feeScope: (c.fee_scope === 'each' ? 'each' : 'first') as 'each' | 'first', lang: (c.lang === 'en' ? 'en' : 'ar') as 'en' | 'ar', withStatements: c.with_statements === true,
    establishmentName: String(co?.company_name || ''), establishmentCr: co?.cr_number ? String(co.cr_number) : undefined,
    contractValue: sr.contract_value || undefined };
  await sb.from('contracts').update({
    fixed_amount: fixed ?? null, deal_value: sr.contract_value, establishment_name: co?.company_name || null, establishment_cr: co?.cr_number || null,
    contract_body: renderContract(String(c.contract_type), fields), updated_at: new Date().toISOString(),
  }).eq('id', c.id);
}

/** اسم من يُخاطَب في الرسالة، والبريد لرابط كلمة المرور */
export async function party(sb: SupabaseClient, companyId: string): Promise<{ name: string; email: string | null }> {
  const { data: co } = await sb.from('companies').select('owner_name, user_id').eq('id', companyId).maybeSingle();
  let email: string | null = null;
  if (co?.user_id) {
    const { data } = await sb.auth.admin.getUserById(String(co.user_id));
    email = data?.user?.email || null;
  }
  return { name: String(co?.owner_name || '').trim(), email };
}

/** الرسالة الأولى — عند إصدار العقد أو السند */
export async function issuedMessage(sb: SupabaseClient, srId: string, by?: string): Promise<{ text: string; link: string }> {
  const sr = await loadSR(sb, srId);
  const { data: doc } = await sb.from('contracts').select('id, status, contract_type').eq('service_request_id', sr.id)
    .neq('status', 'draft').order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (!doc) throw new Error('لا عقد صادر لهذا الطلب بعد');
  const s = await loadFeeSettings(sb);
  const p = await party(sb, sr.company_id);
  const link = await shortLink(sb, 'c', { contractId: String(doc.id), srId: sr.id, companyId: sr.company_id, by });
  const text = fillMessage(s.msgIssued, {
    'الاسم': p.name || 'عميلنا الكريم', 'الخدمة': sr.service_title,
    'الوثيقة': doc.contract_type === 'voucher' ? 'سند' : 'عقد', 'رابط العقد': link, 'رابط قصير': link,
  });
  return { text: doc.contract_type === 'voucher' ? text.replace('وبعد التوقيع يصلكم رابط السداد.', 'ورابط السداد في الصفحة نفسها.').replace('للاطلاع عليه وتوقيعه', 'للاطلاع عليه') : text, link };
}

/** الرسالة الثانية — بعد التوقيع (أو بعد إصدار السند): رابط السداد ورابط المنصة */
export async function signedMessage(sb: SupabaseClient, srId: string, by?: string): Promise<{ text: string; payLink: string; siteLink: string }> {
  const sr = await loadSR(sb, srId);
  const s = await loadFeeSettings(sb);
  const p = await party(sb, sr.company_id);
  const payLink = await shortLink(sb, 'p', { srId: sr.id, companyId: sr.company_id, by });
  const siteLink = p.email ? await shortLink(sb, 's', { email: p.email, companyId: sr.company_id, by }) : SITE + '/auth/login';
  const first = s.firstDelivery[sr.service_title] || '';
  const text = fillMessage(s.msgSigned, {
    'الاسم': p.name, 'الخدمة': sr.service_title, 'المبلغ': money(Number(sr.price || 0)),
    'رابط الدفع': payLink, 'رابط المنصة': siteLink, 'ما يصلكم': first ? '، ' + first : '',
  });
  return { text, payLink, siteLink };
}
