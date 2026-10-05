import type { SupabaseClient } from '@supabase/supabase-js';
import { loadFeeSettings } from '@/lib/feeSettings';

// أتعاب الاستكمال — من «وافقت الجهة» إلى «قُيِّد التمويل» ففاتورة ضريبية مسوّدة (٥ أكتوبر، بأمر المالك).
// ★ النسبة من عقد العميل نفسه (contracts.fee_percent للعقد الموقّع) لا من الإعداد العام:
//   الإعداد ما تبدأ به المسوّدة، والعقد ما التزم به العميل.
// ★ الضريبة: إن نصّ العقد على أن الأتعاب «شاملة» الضريبة فُصلت منها، وإلا أُضيفت عليها —
//   والفاتورة مسوّدة لا تخرج حتى يعتمدها المالك.

export type FeeCalc = { pct: number; vatRate: number; inclusive: boolean; net: number; vat: number; total: number; contractId: string };

const r2 = (n: number) => Math.round(n * 100) / 100;

export async function feeFromContract(sb: SupabaseClient, serviceRequestId: string, amount: number): Promise<FeeCalc> {
  const { data: c, error } = await sb.from('contracts')
    .select('id, fee_type, fee_percent, contract_body, status')
    .eq('service_request_id', serviceRequestId).in('status', ['signed', 'completed'])
    .order('signed_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error(error.message);
  if (!c) throw new Error('لا عقد موقّعاً لهذا الملف — لا تُحسب أتعاب استكمال بلا عقد');
  const pct = Number(c.fee_percent || 0);
  if (!(pct > 0) || c.fee_type === 'fixed') throw new Error('عقد هذا الملف بلا نسبة نجاح — لا أتعاب استكمال فيه');
  const s = await loadFeeSettings(sb);
  const vatRate = s.vatRate || 0;
  const inclusive = /شامل[ةٌ]*\s*ضريبة/.test(String(c.contract_body || ''));
  const fee = r2(amount * pct / 100);
  const net = inclusive && vatRate ? r2(fee / (1 + vatRate / 100)) : fee;
  const vat = inclusive ? r2(fee - net) : r2(fee * vatRate / 100);
  const total = inclusive ? fee : r2(fee + vat);
  return { pct, vatRate, inclusive, net, vat, total, contractId: String(c.id) };
}

export async function nextInvoiceNo(sb: SupabaseClient): Promise<string> {
  const { data, error } = await sb.rpc('next_invoice_no');
  if (error) throw new Error(error.message);
  return String(data);
}
