import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const ADMIN_EMAIL = 'hololalmurdi.fs@gmail.com';
const FROM = 'مُرضي — فريق الشراكات <partners@murdi.sa>';
const resend = new Resend(process.env.RESEND_API_KEY);

async function getAdmin() {
  const cookieStore = await cookies();
  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await sb.auth.getUser();
  if (!user || user.email !== ADMIN_EMAIL) return null;
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  );
}

// POST { company_id } : يرسل كل الرسائل المعتمدة لهذا العميل
export async function POST(req: Request) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 });

  let companyId = '';
  let ids: string[] = [];
  try { const b = await req.json(); companyId = String(b.company_id || ''); ids = Array.isArray(b.ids) ? b.ids.map(String) : []; }
  catch { return NextResponse.json({ error: 'طلب غير صالح' }, { status: 400 }); }
  if (!companyId) return NextResponse.json({ error: 'company_id مطلوب' }, { status: 400 });

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
  const { data: att } = await admin.from('outreach_attachments').select('*').eq('company_id', companyId).single();
  const loadAtt = async (fileUrl?: string, fileName?: string): Promise<Att | null> => {
    if (!fileUrl) return null;
    const bad = /سرّي|سرية|موقف|تقييم|negotiation|valuation|confidential/i;
    if (bad.test(String(fileName || '')) || bad.test(String(fileUrl))) return null;
    try {
      const fileRes = await fetch(fileUrl);
      if (fileRes.ok) {
        const buf = await fileRes.arrayBuffer();
        return { filename: fileName || 'document.pdf', content: Buffer.from(buf).toString('base64') };
      }
    } catch {}
    return null;
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
    return NextResponse.json({ error: 'ارفع ملف المخاطبة (PDF) أولاً قبل الإرسال — الإرسال بدون ملف غير مسموح' }, { status: 400 });
  }

  let sent = 0;
  let skipped = 0;

  for (const m of msgs) {
    // حماية: لا نرسل بدون إيميل صحيح
    if (!m.entity_email || !String(m.entity_email).includes('@')) {
      skipped++;
      await admin.from('outreach_messages')
        .update({ status: 'فشل', error_note: 'لا يوجد إيميل صالح', updated_at: new Date().toISOString() })
        .eq('id', m.id);
      continue;
    }

    try {
      // نحوّل النص لـ HTML بسيط (نحافظ على الأسطر)
      const html = '<div style="font-family:Arial,sans-serif;line-height:1.7;direction:'
        + (m.entity_language === 'إنجليزي' ? 'ltr' : 'rtl')
        + ';color:#1A3D34;font-size:14px;">'
        + String(m.message_body).replace(/\n/g, '<br>')
        + '</div>';

      await resend.emails.send({
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

      await admin.from('outreach_messages')
        .update({ status: 'مُرسلة', sent_at: new Date().toISOString(), error_note: null, updated_at: new Date().toISOString(),
          last_sent_at: new Date().toISOString(),
          next_followup_at: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
          reply_status: 'awaiting' })
        .eq('id', m.id);
      sent++;
    } catch (e) {
      skipped++;
      await admin.from('outreach_messages')
        .update({ status: 'فشل', error_note: 'فشل الإرسال: ' + String(e).slice(0, 100), updated_at: new Date().toISOString() })
        .eq('id', m.id);
    }
  }

  return NextResponse.json({ ok: true, sent, skipped, total: msgs.length });
}
