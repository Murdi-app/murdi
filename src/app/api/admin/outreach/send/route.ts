import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const ADMIN_EMAIL = 'hololalmurdi.fs@gmail.com';
const FROM = 'فريق الشراكات - حلول المرضي <partners@murdi.sa>';
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
  try { const b = await req.json(); companyId = String(b.company_id || ''); }
  catch { return NextResponse.json({ error: 'طلب غير صالح' }, { status: 400 }); }
  if (!companyId) return NextResponse.json({ error: 'company_id مطلوب' }, { status: 400 });

  // نجلب الرسائل المعتمدة فقط، اللي عندها إيميل
  const { data: msgs, error } = await admin
    .from('outreach_messages')
    .select('*')
    .eq('company_id', companyId)
    .eq('status', 'معتمدة');

  if (error) return NextResponse.json({ error: 'تعذّر الجلب' }, { status: 500 });
  if (!msgs || msgs.length === 0) return NextResponse.json({ error: 'لا توجد رسائل معتمدة' }, { status: 404 });

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
      });

      await admin.from('outreach_messages')
        .update({ status: 'مُرسلة', sent_at: new Date().toISOString(), error_note: null, updated_at: new Date().toISOString() })
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
