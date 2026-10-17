import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkInquiryKey } from '@/lib/inquiryToken';
import { KIND_QUESTIONS, kindFromNote } from '@/lib/inquiryQuestions';
import { askMessage, type InquiryRow } from '@/lib/inquiryConsult';
import { logError } from '@/lib/logError';

// إجابات العميل على أسئلة استشارته — من صفحة التسجيل نفسها (١٧ أكتوبر).
// ★ تُكتب في الحقول نفسها التي كانت الموظفة تلصق فيها ردّه، فيلتقطها نبض الاستشارات
//   كأي ردّ — لا مسار ثانٍ. وتُقدَّم ساعة ردّها نصف ساعة فلا تنتظر مهلة اللصق.
// ★ والكتابة بمفتاح الطلب وحده، ومرةً واحدة: ردٌّ موجود لا يُستبدل من الخارج.

const admin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string);
const N = '١٢٣٤٥';

export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const id = String(b?.id || ''), k = String(b?.k || '');
  if (!checkInquiryKey(id, k)) return NextResponse.json({ error: 'الرابط غير صالح' }, { status: 403 });
  const answers: string[] = Array.isArray(b?.answers) ? b.answers.slice(0, 4).map((a: unknown) => String(a ?? '').trim().slice(0, 600)) : [];
  if (answers.filter((a) => a.length >= 2).length < 2) return NextResponse.json({ error: 'أجب على سؤالين على الأقل' }, { status: 400 });

  const sb = admin();
  const { data: r } = await sb.from('service_inquiries').select('id, full_name, company_name, phone, service_title, note, contact_note, outcome, ask_message, ask_reply, ask_reply_at, ask_sent_at, consult_status, consult_tries, consult_at, consult_code, consult_sent_at, consult_owner_note').eq('id', id).maybeSingle();
  if (!r) return NextResponse.json({ error: 'الطلب غير موجود' }, { status: 404 });
  if (r.ask_reply) return NextResponse.json({ ok: true, already: true });

  const kind = kindFromNote(r.note);
  const qs = KIND_QUESTIONS[kind];
  const reply = qs.map((q, i) => N[i] + '- ' + q + '\n' + (answers[i] && answers[i].length >= 1 ? answers[i] : '(لم يُجب)')).join('\n');
  const now = Date.now();
  const { error } = await sb.from('service_inquiries').update({
    ask_reply: reply + '\n(أجاب بنفسه من صفحة التسجيل)',
    ask_reply_at: new Date(now - 31 * 60_000).toISOString(),
    ...(r.ask_message ? {} : { ask_message: askMessage(r as unknown as InquiryRow, qs, kind !== 'new') }),
    ...(r.ask_sent_at ? {} : { ask_sent_at: new Date(now).toISOString() }),
  }).eq('id', id).is('ask_reply', null);
  if (error) { await logError('inquiry.answers', error, { id }); return NextResponse.json({ error: 'تعذّر الحفظ — حاول مرة أخرى' }, { status: 500 }); }
  return NextResponse.json({ ok: true });
}

// حالة الاستشارة للصفحة — تسأل كل نصف دقيقة حتى تجهز
export async function GET(req: Request) {
  const u = new URL(req.url);
  const id = String(u.searchParams.get('id') || ''), k = String(u.searchParams.get('k') || '');
  if (!checkInquiryKey(id, k)) return NextResponse.json({ error: 'الرابط غير صالح' }, { status: 403 });
  const sb = admin();
  const { data: r } = await sb.from('service_inquiries').select('ask_reply, consult_status, consult_code, consult_sent_at').eq('id', id).maybeSingle();
  if (!r) return NextResponse.json({ error: 'الطلب غير موجود' }, { status: 404 });
  const ready = r.consult_status === 'ready' && !!r.consult_code;
  // عرضُها على صفحته هو إيصالها — فلا تظهر للموظفة «جاهزة لم تُرسل» وقد وصلته
  if (ready && !r.consult_sent_at) await sb.from('service_inquiries').update({ consult_sent_at: new Date().toISOString() }).eq('id', id).is('consult_sent_at', null);
  return NextResponse.json({ ok: true, answered: !!r.ask_reply, ready, code: ready ? r.consult_code : null });
}
