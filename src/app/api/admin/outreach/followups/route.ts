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

function buildFollowup(stage: number, entityName: string, lang: string, companyName: string): { subject: string; body: string } {
  const en = lang === 'إنجليزي';
  if (stage === 1) {
    return en ? {
      subject: 'Following up — ' + companyName,
      body: 'Dear ' + entityName + ' team,\n\nWe recently shared the profile of ' + companyName + ' for your review. We understand schedules are busy, so we wanted to gently bring it back to your attention.\n\nWe would be glad to provide any additional information or clarification that would assist your evaluation.\n\nBest regards,\nPartnerships Team — Holol Almurdi Financial Consulting',
    } : {
      subject: 'متابعة لطيفة — ملف ' + companyName,
      body: 'السلام عليكم فريق ' + entityName + '،\n\nسبق أن شاركناكم ملف منشأة ' + companyName + ' للاطلاع، ونقدّر انشغالكم — أحببنا فقط إعادة الملف إلى عنايتكم.\n\nيسعدنا تزويدكم بأي معلومات إضافية أو إيضاحات تُعين فريقكم على الدراسة.\n\nمع خالص التقدير،\nفريق الشراكات — حلول المرضي للاستشارات المالية',
    };
  }
  return en ? {
    subject: 'Final follow-up — ' + companyName,
    body: 'Dear ' + entityName + ' team,\n\nThis is a final gentle follow-up regarding ' + companyName + '. A simple yes, no, or "not at this stage" would be greatly appreciated and helps us guide our client.\n\nIf the timing is not right, we fully understand and hope to collaborate on future opportunities.\n\nBest regards,\nPartnerships Team — Holol Almurdi Financial Consulting',
  } : {
    subject: 'متابعة أخيرة — ملف ' + companyName,
    body: 'السلام عليكم فريق ' + entityName + '،\n\nهذه متابعة أخيرة بخصوص منشأة ' + companyName + ' — يسعدنا أي رد ولو مختصراً (مناسب، غير مناسب، أو ليس في هذه المرحلة)، فذلك يعيننا على توجيه عميلنا.\n\nوإن لم يكن التوقيت مناسباً فنحن نقدّر ذلك تماماً، ونأمل التعاون في فرص قادمة.\n\nمع خالص التقدير،\nفريق الشراكات — حلول المرضي للاستشارات المالية',
  };
}

// GET : المتابعات المستحقة اليوم
export async function GET() {
  const admin = await getAdmin();
  if (admin === null) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  const { data } = await admin
    .from('outreach_messages')
    .select('id, company_id, entity_name, entity_email, entity_language, subject, followup_stage, last_sent_at, next_followup_at, reply_status')
    .eq('status', 'مُرسلة')
    .eq('reply_status', 'awaiting')
    .lt('followup_stage', 2)
    .lte('next_followup_at', new Date().toISOString())
    .order('next_followup_at', { ascending: true })
    .limit(50);
  return NextResponse.json({ due: data || [] });
}

// POST { id, company_name } : إرسال متابعة لرسالة واحدة
export async function POST(req: Request) {
  const admin = await getAdmin();
  if (admin === null) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  const { id, company_name } = await req.json();
  if (!id) return NextResponse.json({ error: 'معرف مفقود' }, { status: 400 });

  const { data: m } = await admin.from('outreach_messages').select('*').eq('id', id).single();
  if (!m) return NextResponse.json({ error: 'الرسالة غير موجودة' }, { status: 404 });
  if (m.reply_status !== 'awaiting' || (m.followup_stage || 0) >= 2) {
    return NextResponse.json({ error: 'لا متابعة مستحقة لهذه الرسالة' }, { status: 400 });
  }

  const nextStage = (m.followup_stage || 0) + 1;
  const fu = buildFollowup(nextStage, String(m.entity_name || ''), String(m.entity_language || ''), String(company_name || 'عميلنا'));

  try {
    const html = '<div style="font-family:Arial,sans-serif;line-height:1.8;direction:'
      + (m.entity_language === 'إنجليزي' ? 'ltr' : 'rtl')
      + ';color:#1A3D34;font-size:14px;">'
      + fu.body.replace(/\n/g, '<br>')
      + '</div>';

    await resend.emails.send({
      from: FROM,
      to: String(m.entity_email).trim(),
      subject: fu.subject,
      html,
    });

    await admin.from('outreach_messages').update({
      followup_stage: nextStage,
      last_sent_at: new Date().toISOString(),
      next_followup_at: nextStage < 2 ? new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString() : null,
      updated_at: new Date().toISOString(),
    }).eq('id', id);

    return NextResponse.json({ ok: true, stage: nextStage });
  } catch (e) {
    return NextResponse.json({ error: 'فشل الإرسال: ' + String(e).slice(0, 100) }, { status: 500 });
  }
}

// PATCH { id, reply_status } : تحديث حالة الرد (replied / declined / closed)
export async function PATCH(req: Request) {
  const admin = await getAdmin();
  if (admin === null) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  const { id, reply_status } = await req.json();
  if (!id || !['replied', 'declined', 'closed', 'awaiting'].includes(reply_status)) {
    return NextResponse.json({ error: 'طلب غير صالح' }, { status: 400 });
  }
  await admin.from('outreach_messages').update({ reply_status, updated_at: new Date().toISOString() }).eq('id', id);
  return NextResponse.json({ ok: true });
}
