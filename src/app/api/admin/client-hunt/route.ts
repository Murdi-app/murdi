import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { runClientHunt } from '@/lib/clientHunt';

export const maxDuration = 300;

const ADMIN_EMAIL = 'hololalmurdi.fs@gmail.com';
const DAILY_EMAIL_LIMIT = 35;

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

// GET : جلب كل الشركات (الأحدث أولاً)
export async function GET() {
  const admin = await getAdmin();
  if (admin === null) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  const { data } = await admin
    .from('client_hunt_leads')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(600);
  return NextResponse.json({ leads: data || [] });
}

// POST : تشغيل جولة صيد عملاء جديدة
export async function POST() {
  const admin = await getAdmin();
  if (admin === null) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  try {
    const result = await runClientHunt();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'فشل الصيد' }, { status: 500 });
  }
}

// PATCH : إرسال دفعة الإيميل اليومية (محكومة بحد أقصى)
export async function PATCH() {
  const admin = await getAdmin();
  if (admin === null) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });

  const today = new Date().toISOString().slice(0, 10);
  const { count: sentToday } = await admin
    .from('client_hunt_leads')
    .select('id', { count: 'exact', head: true })
    .gte('email_sent_at', today + 'T00:00:00Z');

  const remaining = DAILY_EMAIL_LIMIT - (sentToday || 0);
  if (remaining <= 0) {
    return NextResponse.json({ ok: true, sent: 0, note: 'اكتمل حد اليوم (' + DAILY_EMAIL_LIMIT + ') — الدفعة القادمة غداً' });
  }

  const { data: batch } = await admin
    .from('client_hunt_leads')
    .select('id, company_name, email, message')
    .eq('status', 'new')
    .not('email', 'is', null)
    .neq('email', '')
    .order('created_at', { ascending: true })
    .limit(remaining);

  if (!batch || batch.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, note: 'لا توجد شركات جديدة بإيميل بانتظار الإرسال' });
  }

  let sent = 0;
  const errors: string[] = [];
  for (const lead of batch) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + process.env.RESEND_API_KEY },
        body: JSON.stringify({
          from: 'منصة مُرضي <noreply@murdi.sa>',
          reply_to: ['hololalmurdi.fs@gmail.com'],
          to: [lead.email],
          subject: 'كم جاهزية شركتكم للحصول على رأس المال؟',
          text: lead.message + '\n\n—\nإن لم ترغبوا باستقبال رسائلنا، يكفي الرد بكلمة "إيقاف".',
        }),
      });
      if (res.ok) {
        await admin.from('client_hunt_leads').update({ status: 'emailed', email_sent_at: new Date().toISOString() }).eq('id', lead.id);
        sent++;
      } else {
        const body = await res.text();
        errors.push(lead.company_name + ': ' + res.status + ' ' + body.slice(0, 120));
      }
      await new Promise((r) => setTimeout(r, 600));
    } catch (e) {
      errors.push(lead.company_name + ': ' + (e instanceof Error ? e.message : 'خطأ'));
    }
  }
  return NextResponse.json({ ok: true, sent, failed: errors.length, errors: errors.slice(0, 5) });
}
