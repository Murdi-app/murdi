import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// رابط الدفع بلا تسجيل — /pay/transfer?t=<pay_token>
//
// ★ كان الدفع لا يكون إلا من حسابٍ مسجَّل: صفحة التحويل تسأل الجلسة عن
//   الطلب، وتسجيل الحوالة يأخذ المنشأة من الجلسة. والعميل الذي يأتي من
//   الإعلان يطلب الخدمة «بلا تسجيل» كما وعدته الصفحة — فلا يجد مبلغاً ولا
//   زرّ دفع. تكرّر ذلك حتى قال صاحب «فاست بارسل» (٣٠ سبتمبر): ما يطلع مبلغ
//   الخدمة. فصار لكل طلبٍ مسعَّر رمزٌ عشوائي لا يُخمَّن، من يحمله يرى مبلغ
//   ذلك الطلب وحده ويرفع إيصاله — ولا يرى شيئاً غيره من الملف.
//
// والمبلغ من `price` في القاعدة لا من الرابط، والإيصال يُرفع من الخادم
// إلى الدلو الخاص باسم المنشأة صاحبة الطلب.

const admin = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  );

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BYTES = 10 * 1024 * 1024;

async function byToken(t: string) {
  if (!UUID.test(t)) return null;
  const { data } = await admin().from('service_requests')
    .select('id, company_id, service_title, option_key, price, status')
    .eq('pay_token', t).maybeSingle();
  return data;
}

export async function GET(req: Request) {
  const t = new URL(req.url).searchParams.get('t') || '';
  const sr = await byToken(t);
  if (!sr) return NextResponse.json({ error: 'رابط الدفع غير صحيح — اطلب رابطاً جديداً على واتساب 0570749196' }, { status: 404 });
  const { data: pending } = await admin().from('payments').select('id')
    .eq('service_request_id', sr.id).eq('status', 'awaiting_confirmation').limit(1).maybeSingle();
  return NextResponse.json({
    ok: true, title: sr.service_title, status: sr.status, received: !!pending,
    amount: sr.status === 'priced' && Number(sr.price) > 0 ? Number(sr.price) : null,
  });
}

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: 'بيانات ناقصة' }, { status: 400 });
  const t = String(form.get('t') || '');
  const note = String(form.get('note') || '').slice(0, 500);
  const file = form.get('file');

  const sr = await byToken(t);
  if (!sr) return NextResponse.json({ error: 'رابط الدفع غير صحيح' }, { status: 404 });
  if (String(sr.status) !== 'priced') {
    return NextResponse.json({ error: 'هذا الطلب لا ينتظر دفعاً الآن — لا تحوّل، وراسلنا واتساب 0570749196' }, { status: 409 });
  }
  const due = Number(sr.price ?? 0);
  if (!due || due <= 0) return NextResponse.json({ error: 'هذه الخدمة لم تُسعَّر بعد' }, { status: 409 });
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: 'أرفق صورة الإيصال أولاً' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'الملف أكبر من ١٠ ميغابايت — أرسله واتساب 0570749196' }, { status: 413 });
  if (!/^image\/|^application\/pdf$/.test(file.type || '')) {
    return NextResponse.json({ error: 'الإيصال صورة أو PDF' }, { status: 415 });
  }

  const sb = admin();
  const companyId = String(sr.company_id);
  const path = companyId.replace(/[^a-zA-Z0-9-]/g, '') + '/' + Date.now() + '_'
    + (file.name || 'receipt').replace(/[^a-zA-Z0-9._-]/g, '');
  const { error: upErr } = await sb.storage.from('receipts')
    .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type });
  if (upErr) return NextResponse.json({ error: 'تعذّر رفع الإيصال — حاول مرة أخرى أو أرسله واتساب على 0570749196' }, { status: 500 });

  // حوالةٌ معلّقة للطلب نفسه تُحدَّث ولا تُكرَّر — كما في /api/payments/transfer
  const { data: dup, error: dupErr } = await sb.from('payments').select('id')
    .eq('service_request_id', sr.id).eq('kind', 'service').eq('status', 'awaiting_confirmation')
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (dupErr) return NextResponse.json({ error: 'تعذّر التحقق من تحويلٍ سابق' }, { status: 500 });
  if (dup) {
    const { error } = await sb.from('payments').update({
      amount_sar: due, transfer_receipt_url: path, transfer_note: note || null,
    }).eq('id', dup.id);
    if (error) return NextResponse.json({ error: 'تعذّر تحديث التحويل' }, { status: 500 });
    return NextResponse.json({ ok: true, updated: true });
  }
  const { error } = await sb.from('payments').insert({
    company_id: companyId, kind: 'service', description: String(sr.service_title || 'خدمة'),
    amount_sar: due, method: 'transfer', status: 'awaiting_confirmation',
    transfer_receipt_url: path, transfer_note: note ? note + ' · (رابط دفع)' : '(رابط دفع)',
    service_request_id: sr.id,
  });
  if (error) return NextResponse.json({ error: 'تعذّر تسجيل التحويل' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
