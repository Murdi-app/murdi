import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/requireAdmin';
import { loadConfig, compose, isAddressed, type Award } from '@/lib/awards';
import { sendMail } from '@/lib/sendMail';

// إرسال بريد الترسية — من شاشة المالك، وبضغطته. يُسجَّل في `award_touches`
// بحرفه (العنوان والنص) ومعرّف الإرسال، وتصير الترسية «أُرسلت».
const admin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string);
const FROM = 'د. عبدالحكيم المرضي <partners@murdi.sa>';
const esc = (s: string) => s.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string));

// POST { id, subject?, body? } — النص من المؤلّف (بتعديل المالك إن عدّل)، وإلا يُركَّب من القوالب
export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return NextResponse.json({ error: denied }, { status: 401 });
  const b = await req.json().catch(() => ({} as Record<string, unknown>));
  const id = String(b.id || '');
  const sb = admin();
  const { data: a, error } = await sb.from('contract_awards').select('*').eq('id', id).maybeSingle();
  if (error) return NextResponse.json({ error: 'تعذّرت القراءة — ' + error.message }, { status: 500 });
  if (!a) return NextResponse.json({ error: 'غير موجودة' }, { status: 404 });
  if (!isAddressed(String(a.category))) return NextResponse.json({ error: 'هذه الفئة لا تُخاطَب' }, { status: 409 });
  if (!['qualified', 'messaged', 'reminder_call', 'replied'].includes(String(a.status))) {
    return NextResponse.json({ error: 'تُؤهَّل الترسية قبل مراسلتها — حالتها الآن: ' + a.status }, { status: 409 });
  }
  const to = String(a.contact_email || '').trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return NextResponse.json({ error: 'لا بريد صالحاً لهذه الترسية — أضفه أولاً' }, { status: 400 });

  let subject = String(b.subject || '').trim();
  let body = String(b.body || '').trim();
  if (!subject || !body) {
    const cfg = await loadConfig(sb);
    const c = compose(a as Award, cfg.templates, cfg.settings);
    if (!c.ready) return NextResponse.json({ error: c.kind === 'general' ? 'القالب العام ناقص في الإعدادات' : 'لا قالب مفعَّل لهذه الفئة والمرحلة' }, { status: 409 });
    subject = subject || c.subject; body = body || c.body;
  }
  const html = '<div dir="rtl" style="font-family:Arial,Tahoma;line-height:1.95;color:#1A3D34;font-size:15px;white-space:pre-wrap">' + esc(body) + '</div>';
  const r = await sendMail({ from: FROM, to, subject, html, replyTo: 'partners@murdi.sa' });
  if (!r.ok) return NextResponse.json({ error: 'لم يخرج البريد — ' + r.reason }, { status: 502 });

  const now = new Date().toISOString();
  const { error: tErr } = await sb.from('award_touches').insert({
    award_id: id, channel: 'email', direction: 'out', actor: 'د. عبدالحكيم المرضي',
    to_address: to, subject, body, external_ref: r.id,
  });
  const patch: Record<string, unknown> = { updated_at: now };
  if (a.status === 'qualified') { patch.status = 'messaged'; patch.messaged_at = now; }
  const { error: uErr } = await sb.from('contract_awards').update(patch).eq('id', id);
  if (tErr || uErr) {
    return NextResponse.json({ ok: true, warn: 'خرج البريد، ولم يُسجَّل كاملاً: ' + (tErr?.message || uErr?.message) });
  }
  return NextResponse.json({ ok: true });
}
