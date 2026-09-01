import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { requireStaff, ownsCompany } from '@/lib/requireStaff';
import { sendMail } from '@/lib/sendMail';

const ADMIN_EMAIL = 'hololalmurdi.fs@gmail.com';
const FROM = 'مُرضي — فريق الشراكات <partners@murdi.sa>';

async function getAdmin() {
  const cookieStore = await cookies();
  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  );
}

// POST { company_id } : يرسل كل الرسائل المعتمدة لهذا العميل
export async function POST(req: Request) {
  const { who, error: denied } = await requireStaff();
  if (denied || !who) return NextResponse.json({ error: denied || 'غير مصرح' }, { status: 401 });
  if (!who.canSend) return NextResponse.json({ error: 'الإرسال غير مصرّح لحسابك' }, { status: 403 });
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 });

  let companyId = '';
  let ids: string[] = [];
  try { const b = await req.json(); companyId = String(b.company_id || ''); ids = Array.isArray(b.ids) ? b.ids.map(String) : []; }
  catch { return NextResponse.json({ error: 'طلب غير صالح' }, { status: 400 }); }
  if (!companyId) return NextResponse.json({ error: 'company_id مطلوب' }, { status: 400 });
  if (!(await ownsCompany(who, companyId))) return NextResponse.json({ error: 'هذا العميل ليس ضمن عملائك' }, { status: 403 });

  // نجلب الرسائل المعتمدة فقط، اللي عندها إيميل
  let mq = admin
    .from('outreach_messages')
    .select('*')
    .eq('company_id', companyId);
  mq = ids.length > 0 ? mq.in('id', ids) : mq.eq('status', 'معتمدة');
  const { data: msgs, error } = await mq;

  if (error) return NextResponse.json({ error: 'تعذّر الجلب' }, { status: 500 });
  if (!msgs || msgs.length === 0) return NextResponse.json({ error: 'لا توجد رسائل معتمدة' }, { status: 404 });

  // نجلب نسختي الملف (عربية + إنجليزية) ونحمّلهما مرة واحدة
  type Att = { filename: string; content: string };
  let attAr: Att | null = null;
  let attEn: Att | null = null;
  let deckAr: Att | null = null;
  let deckEn: Att | null = null;
  const trk = String(msgs[0]?.track) === 'investment' ? 'investment' : 'funding';
  const { data: att } = await admin.from('outreach_attachments').select('*').eq('company_id', companyId).eq('track', trk).maybeSingle();
  // دلو contracts صار خاصاً — والملفات محفوظة بروابط عامة لم تعد تفتح.
  // فبدل جلبها عبر HTTP، تُنزَّل من التخزين بمفتاح الخدمة مباشرةً: أسرع، ولا يتوقف على رابط.
  const STORE = 'contracts';
  const asPath = (v: string): string | null => {
    for (const m of ['/object/public/' + STORE + '/', '/object/sign/' + STORE + '/']) {
      const i = v.indexOf(m);
      if (i >= 0) return decodeURIComponent(v.slice(i + m.length).split('?')[0]);
    }
    return /^https?:/i.test(v) ? null : v.replace(/^\/+/, '');
  };
  // سبب الفشل يُحفظ ويُقال: كان الملف يسقط بصمت ويبقى الخطأ «ارفع ملفاً» على ملفٍ مرفوع
  const attErrors: string[] = [];
  const loadAtt = async (fileUrl?: string, fileName?: string): Promise<Att | null> => {
    if (!fileUrl) return null;
    const bad = /سرّي|سرية|موقف|تقييم|negotiation|valuation|confidential/i;
    if (bad.test(String(fileName || '')) || bad.test(String(fileUrl))) return null;
    const name = fileName || 'document.pdf';
    try {
      const path = asPath(String(fileUrl));
      if (path) {
        const { data: blob, error: dErr } = await admin.storage.from(STORE).download(path);
        if (dErr || !blob) { attErrors.push(name + ': ' + (dErr?.message || 'غير موجود في التخزين')); return null; }
        const buf = await blob.arrayBuffer();
        return { filename: name, content: Buffer.from(buf).toString('base64') };
      }
      const fileRes = await fetch(fileUrl);
      if (!fileRes.ok) { attErrors.push(name + ': تعذّر التحميل (' + fileRes.status + ')'); return null; }
      const buf = await fileRes.arrayBuffer();
      return { filename: name, content: Buffer.from(buf).toString('base64') };
    } catch (e) {
      attErrors.push(name + ': ' + String(e).slice(0, 80));
      return null;
    }
  };
  if (att) {
    // الأعمدة الجديدة، مع دعم القديم (file_url) كنسخة عربية احتياطية
    attAr = await loadAtt(att.file_url_ar || att.file_url, att.file_name_ar || att.file_name);
    attEn = await loadAtt(att.file_url_en, att.file_name_en);
    deckAr = await loadAtt(att.deck_url_ar, att.deck_name_ar);
    deckEn = await loadAtt(att.deck_url_en, att.deck_name_en);
  }

  // حماية: لا نرسل بدون ملف مرفق (اتفاق: الإرسال لا يتم إلا بملف)
  if (!attAr && !attEn) {
    return NextResponse.json({
      error: attErrors.length
        ? 'الملف مرفوع لكنه لم يُحمَّل: ' + attErrors.join(' · ')
        : 'ارفع ملف المخاطبة (PDF) أولاً قبل الإرسال — الإرسال بدون ملف غير مسموح',
    }, { status: 400 });
  }
  // الشرائح لا تمنع الإرسال، لكن سقوطها يُقال في الرد لا يُبتلع
  const deckWarn = attErrors.length ? attErrors : null;

  let sent = 0;
  let skipped = 0;
  // أسباب الرفض تُجمع وتُعاد للواجهة — لا تُبتلع في عدّاد
  const failures: string[] = [];

  for (const m of msgs) {
    // حماية: لا نرسل بدون إيميل صحيح
    if (!m.entity_email || !String(m.entity_email).includes('@')) {
      skipped++;
      await admin.from('outreach_messages')
        .update({ status: 'فشل', error_note: 'لا يوجد إيميل صالح', updated_at: new Date().toISOString() })
        .eq('id', m.id);
      continue;
    }

    // نحوّل النص لـ HTML بسيط (نحافظ على الأسطر)
    const html = '<div style="font-family:Arial,sans-serif;line-height:1.7;direction:'
      + (m.entity_language === 'إنجليزي' ? 'ltr' : 'rtl')
      + ';color:#1A3D34;font-size:14px;">'
      + String(m.message_body).replace(/\n/g, '<br>')
      + '</div>';

    // كان هنا `await resend.emails.send(...)` داخل try/catch — ومكتبة Resend
    // لا ترمي عند رفض الخادم بل تُرجع {error}. فكان كل ملف يُعلَّم «مُرسلة»
    // ولو رُفض. الآن الإرسال يمرّ من مُرسِلٍ يقرأ الخطأ ويعيده.
    const out = await sendMail({
      from: FROM,
      to: String(m.entity_email).trim(),
      subject: m.subject || 'استفسار',
      html,
      attachments: (() => {
        const isEn = m.entity_language === 'إنجليزي';
        const list: Att[] = [];
        const main = isEn ? (attEn || attAr) : (attAr || attEn);
        if (main) list.push(main);
        // الشرائح: الإنجليزية تُرسل للجميع، والعربية للجهات المحلية فقط
        if (deckEn) list.push(deckEn);
        if (!isEn && deckAr) list.push(deckAr);
        return list.length ? (list as { filename: string; content: string }[]) : undefined;
      })(),
    });

    if (!out.ok) {
      skipped++;
      failures.push(String(m.entity_name || m.entity_email) + ': ' + out.reason);
      await admin.from('outreach_messages')
        .update({ status: 'فشل', error_note: out.reason.slice(0, 300), updated_at: new Date().toISOString() })
        .eq('id', m.id);
      continue;
    }

    await admin.from('outreach_messages')
      .update({ status: 'مُرسلة', sent_at: new Date().toISOString(), error_note: null, updated_at: new Date().toISOString(),
        last_sent_at: new Date().toISOString(),
        next_followup_at: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        reply_status: 'awaiting' })
      .eq('id', m.id);
    sent++;
  }

  return NextResponse.json({
    ok: true, sent, skipped, total: msgs.length,
    attachmentWarnings: deckWarn,
    failures: failures.length ? failures : null,
  });
}
