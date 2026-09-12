import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendPush } from '@/lib/push';

export const runtime = 'nodejs';

// توقيع العميل لعقده يقع في متصفحه: صفحة الهدف ترفع النسخة الموقّعة وتكتب
// `status='signed'` إلى القاعدة مباشرة، بلا مرور بخادمٍ يعلم بها. فقد يبقى
// عقدٌ موقَّع ساعاتٍ لا يدري به المكتب — والعقد الموقّع هو إذن العمل كله:
// قبله لا مخاطبة ولا تقديم ولا استحقاق أتعاب.
//
// فهذا مِشبكٌ يناديه مِشبكُ القاعدة نفسه (pg_net على جدول العقود) لحظة تحوّل
// الحالة إلى «موقَّع». ولا يُصدَّق على ما يصله: يُقرأ العقد من القاعدة، ولا
// يُشعَر إلا إن كان موقَّعاً حقاً، وتوقيعه حديثاً، ولم يُشعَر عنه من قبل —
// فالتكرار إزعاج، والخبر عن مالٍ لا يُبنى على ما يرسله طرفٌ خارجي.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const contractId = String(body?.contractId || '');
  if (!contractId) return NextResponse.json({ error: 'contractId مطلوب' }, { status: 400 });

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  );

  const { data: ct } = await admin.from('contracts')
    .select('id, status, company_id, fee_percent, signed_at')
    .eq('id', contractId).maybeSingle();
  if (!ct || ct.status !== 'signed' || !ct.signed_at) {
    return NextResponse.json({ ok: true, skipped: 'ليس موقَّعاً' });
  }
  const ageMin = (Date.now() - new Date(String(ct.signed_at)).getTime()) / 60000;
  if (ageMin > 120) return NextResponse.json({ ok: true, skipped: 'توقيع قديم' });

  // لا يُشعَر عن العقد مرتين: الأثر نفسه هو الحارس
  const { data: seen } = await admin.from('deal_events')
    .select('id').eq('company_id', String(ct.company_id))
    .eq('kind', 'contract_signed').ilike('detail', '%' + String(ct.id) + '%').limit(1);
  if (seen && seen.length) return NextResponse.json({ ok: true, skipped: 'أُشعِر سابقاً' });

  const { data: co } = await admin.from('companies')
    .select('company_name').eq('id', String(ct.company_id)).maybeSingle();

  await admin.from('deal_events').insert({
    company_id: ct.company_id,
    kind: 'contract_signed',
    title: 'وقّع العميل عقده ورفع النسخة الموقّعة',
    detail: 'أتعاب ' + String(ct.fee_percent ?? '—') + '٪ — عقد ' + String(ct.id),
    actor: 'client',
    needs_owner: true,
  });

  await sendPush({
    title: '✍️ عقد موقَّع — ' + String(co?.company_name || 'منشأة'),
    body: 'رفع العميل نسخته الموقّعة (أتعاب ' + String(ct.fee_percent ?? '—') + '٪). المخاطبة صارت مفتوحة على ملفه.',
    url: 'https://murdi.sa/admin/services',
    important: true,
    tag: 'ctr-' + ct.id,
  });

  return NextResponse.json({ ok: true });
}
