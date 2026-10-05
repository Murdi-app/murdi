import { createClient } from '@supabase/supabase-js';
import { linkValid } from '@/lib/cronAuth';
import { riyadhDate } from '@/lib/staffBrief';
import { sendMail } from '@/lib/sendMail';
import { BRIEF_FROM, BRIEF_BCC, BRIEF_REPLY_TO } from '@/lib/briefMail';

// «اعتمد وأرسل» — من بريد المالك.
//
// ★ الرابط يفتح صفحةً فيها التوجيهان وزرٌّ واحد، والإرسال بالضغط (POST) لا
//   بفتح الرابط: بعض صناديق البريد تفتح الروابط لتفحصها، ولو أرسل الفتحُ
//   لخرج التوجيه بلا كلمة المالك — وهو ما نصّ ألا يكون.
// ★ والتوقيع مشتقٌّ من سرّ المهام ومقيَّدٌ بالتاريخ، ولا يصلح إلا ليومه.

const admin = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);
const esc = (s: unknown) => String(s ?? '').replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c] as string));
const page = (inner: string, status = 200) => new Response(
  '<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
  + '<title>توجيه الموظفتين — مُرضي</title></head><body style="margin:0;background:#F4F7F6;font-family:Cairo,Tahoma,sans-serif;color:#12302A">'
  + '<div style="max-width:720px;margin:0 auto;padding:24px 16px 60px">' + inner + '</div></body></html>',
  { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });

async function check(d: string, t: string): Promise<string | null> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return 'رابطٌ غير صالح.';
  if (!(await linkValid('briefs', d, t))) return 'رابطٌ غير صالح.';
  if (d !== riyadhDate()) return 'هذا التوجيه ليومٍ مضى — لا يُرسل.';
  return null;
}

export async function GET(req: Request) {
  const u = new URL(req.url);
  const d = u.searchParams.get('d') || '', t = u.searchParams.get('t') || '';
  const bad = await check(d, t);
  if (bad) return page('<h2>' + esc(bad) + '</h2>', 400);
  const { data, error } = await admin().from('daily_briefs').select('recipient, to_email, subject, body, status').eq('brief_date', d).order('recipient');
  if (error) return page('<h2>تعذّرت قراءة التوجيه — أعد المحاولة.</h2>', 500);
  const drafts = (data || []).filter((b) => b.status === 'draft');
  const cards = (data || []).map((b) => '<div style="background:#fff;border:1px solid #E1EDE8;border-radius:12px;padding:16px;margin-bottom:14px">'
    + '<div style="color:#6B8A80;font-size:13px;margin-bottom:8px">إلى ' + esc(b.to_email) + ' · ' + (b.status === 'draft' ? 'مسوّدة' : b.status === 'sent' ? '✅ أُرسل' : esc(b.status)) + '</div>'
    + '<div style="white-space:pre-wrap;line-height:1.9;font-size:14.5px">' + esc(b.body) + '</div></div>').join('');
  const btn = drafts.length
    ? '<form method="POST"><input type="hidden" name="d" value="' + esc(d) + '"><input type="hidden" name="t" value="' + esc(t) + '">'
      + '<button style="background:#1A3D34;color:#fff;border:0;border-radius:24px;padding:13px 34px;font-size:16px;font-weight:800;font-family:inherit;cursor:pointer">اعتمد وأرسل (' + drafts.length.toLocaleString('ar-SA') + ')</button></form>'
    : '<p style="font-weight:800;color:#1E7A5A">لا مسوّدات تنتظر — أُرسل التوجيه أو لم يُكتب.</p>';
  return page('<h1 style="font-size:22px;margin:0 0 6px">توجيه الموظفتين — ' + esc(d) + '</h1>'
    + '<p style="color:#6B8A80;margin:0 0 18px">راجِعه ثم اضغط الزرّ. لا يخرج شيءٌ قبل ذلك.</p>' + btn + '<div style="height:18px"></div>' + cards);
}

export async function POST(req: Request) {
  const f = await req.formData().catch(() => null);
  const d = String(f?.get('d') || ''), t = String(f?.get('t') || '');
  const bad = await check(d, t);
  if (bad) return page('<h2>' + esc(bad) + '</h2>', 400);
  const sb = admin();
  const { data, error } = await sb.from('daily_briefs').select('id, to_email, subject, body').eq('brief_date', d).eq('status', 'draft');
  if (error) return page('<h2>تعذّرت قراءة التوجيه — لم يُرسل شيء.</h2>', 500);
  const out: string[] = [];
  for (const b of data || []) {
    // يُحجز الصفّ قبل الإرسال — ضغطتان لا ترسلان مرتين
    const { data: took } = await sb.from('daily_briefs').update({ status: 'sending' }).eq('id', b.id).eq('status', 'draft').select('id');
    if (!took?.length) continue;
    const html = '<div dir="rtl" style="font-family:Arial,Tahoma;line-height:1.95;color:#1A3D34;font-size:15px;white-space:pre-wrap">' + esc(b.body) + '</div>';
    const r = await sendMail({ from: BRIEF_FROM, to: String(b.to_email), bcc: BRIEF_BCC, subject: String(b.subject), html, replyTo: BRIEF_REPLY_TO });
    await sb.from('daily_briefs').update(r.ok
      ? { status: 'sent', sent_at: new Date().toISOString() }
      : { status: 'draft', note: 'فشل الإرسال: ' + r.reason }).eq('id', b.id);
    out.push((r.ok ? '✅ أُرسل إلى ' : '⚠️ لم يُرسل إلى ') + esc(b.to_email) + (r.ok ? '' : ' — ' + esc(r.reason)));
  }
  return page('<h2 style="font-size:20px">' + (out.length ? 'تم' : 'لا شيء يُرسل') + '</h2><p style="line-height:2;font-size:15px">' + (out.join('<br>') || 'أُرسل التوجيه من قبل.') + '</p>');
}
