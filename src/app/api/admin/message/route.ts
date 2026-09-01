import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { requireStaff } from '@/lib/requireStaff';
import { TEMPLATES, findTemplate, fillTemplate } from '@/lib/clientTemplates';

// مراسلة العملاء — لا الجهات.
//
// الفصل مقصود: مخاطبة جهات التمويل تبقى في يد واحدة (‏/admin/outreach)،
// لأن وصول رسالتين بخطّين مختلفين إلى نفس البنك يُفسد الملف. أما العميل
// فيحتاج ردّاً في وقته، فتُفتح مراسلته للموظفة — بقالبٍ لا يعد بشيء.
//
// القاعدة: قالب جاهز يخرج فوراً. أي نصّ حرّ لا يخرج إلا باعتماد المالك.

const resend = new Resend(process.env.RESEND_API_KEY);
const OWNER_FROM = 'مُرضي للاستشارات المالية <partners@murdi.sa>';

const admin = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  );

// من أي صندوق تخرج الرسالة. لا نخترع عنواناً غير موجود: الردّ يعود إلى
// صندوق حقيقي يقرأه صاحبه — وإلا ضاع ردّ العميل في العدم.
async function senderFor(userId: string, role: string) {
  if (role === 'admin') {
    return { from: OWNER_FROM, replyTo: 'partners@murdi.sa', name: 'د. عبدالحكيم المرضي' };
  }
  const sb = admin();
  const { data } = await sb.from('staff').select('name, email').eq('user_id', userId).maybeSingle();
  const email = String(data?.email || '').trim();
  const name = String(data?.name || '').trim() || 'فريق مُرضي';
  if (!email.endsWith('@murdi.sa')) return null;
  return { from: 'مُرضي — ' + name + ' <' + email + '>', replyTo: email, name };
}

const htmlOf = (body: string) =>
  '<div style="font-family:Arial,Tahoma,sans-serif;line-height:1.9;direction:rtl;' +
  'text-align:right;color:#1A3D34;font-size:14.5px;">' +
  body
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#1A6B55;">$1</a>')
    .replace(/\n/g, '<br>') +
  '</div>';

// سجلّ في الخطّ الزمني — حتى تظهر مراسلة العميل في لوحة الصفقة مع بقية العمل
async function logEvent(
  sb: ReturnType<typeof admin>,
  companyId: string | null,
  title: string,
  detail: string,
  actor: string
) {
  if (!companyId) return;
  await sb.from('deal_events').insert({
    company_id: companyId,
    kind: 'client_email',
    entity_name: null,
    title: title.slice(0, 300),
    detail: detail.slice(0, 4000),
    actor,
    needs_owner: false,
  });
}

// GET: القوالب + آخر الرسائل + ما ينتظر الاعتماد
export async function GET(req: Request) {
  const { who, error: denied } = await requireStaff();
  if (denied || !who) return NextResponse.json({ error: denied || 'غير مصرح' }, { status: 401 });

  const sb = admin();
  const url = new URL(req.url);
  const companyId = url.searchParams.get('company_id') || '';

  let q = sb
    .from('client_messages')
    .select('id, company_id, to_name, to_email, subject, body, status, created_by_name, sent_at, error_note, created_at')
    .order('created_at', { ascending: false })
    .limit(60);
  if (companyId) q = q.eq('company_id', companyId);
  if (who.role === 'staff') q = q.eq('created_by', who.userId);

  // بريد العميل يعيش في حساب دخوله لا في جدول المنشآت — والمنظر يجمعهما
  const [msgs, companies] = await Promise.all([
    q,
    sb.from('company_contacts').select('company_id, company_name, owner_name, phone, contact_email'),
  ]);

  const pending =
    who.role === 'admin'
      ? (await sb
          .from('client_messages')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'بانتظار الاعتماد')).count || 0
      : 0;

  return NextResponse.json({
    ok: true,
    role: who.role,
    templates: TEMPLATES.map((t) => ({ key: t.key, label: t.label, when: t.when })),
    messages: msgs.data || [],
    companies: companies.data || [],
    pending_approval: pending,
  });
}

// POST: يرسل قالباً فوراً، أو يودع نصاً حراً بانتظار اعتماد المالك
export async function POST(req: Request) {
  const { who, error: denied } = await requireStaff();
  if (denied || !who) return NextResponse.json({ error: denied || 'غير مصرح' }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const toEmail = String(b?.to_email || '').trim();
  const toName = String(b?.to_name || '').trim();
  const companyId = b?.company_id ? String(b.company_id) : null;
  const key = String(b?.template_key || '').trim();

  if (!toEmail.includes('@')) {
    return NextResponse.json({ error: 'بريد المستلم غير صحيح' }, { status: 400 });
  }

  const sender = await senderFor(who.userId, who.role);
  if (!sender) {
    return NextResponse.json(
      { error: 'لا يوجد بريد رسمي على النطاق لحسابك — لا تُرسل رسالة لا يعود ردّها إلى صندوق حقيقي' },
      { status: 403 }
    );
  }

  const sb = admin();

  // اسم المنشأة يُقرأ من السجل لا من الواجهة — حتى لا يخرج اسم خاطئ
  let companyName = '';
  if (companyId) {
    const { data } = await sb.from('companies').select('company_name').eq('id', companyId).maybeSingle();
    companyName = String(data?.company_name || '');
  }

  const tpl = key ? findTemplate(key) : null;
  if (key && !tpl) return NextResponse.json({ error: 'قالب غير معروف' }, { status: 400 });

  const vars = { name: toName, company: companyName, sender: sender.name };
  const subject = tpl
    ? fillTemplate(tpl.subject, vars)
    : String(b?.subject || '').trim();
  const body = tpl ? fillTemplate(tpl.body, vars) : String(b?.body || '').trim();

  if (!subject || !body) {
    return NextResponse.json({ error: 'العنوان والنص مطلوبان' }, { status: 400 });
  }
  if (tpl && tpl.body.includes('{{company}}') && !companyName) {
    return NextResponse.json({ error: 'هذا القالب يذكر اسم المنشأة — اختر العميل أولاً' }, { status: 400 });
  }

  // النص الحرّ من الموظفة لا يخرج بلا اعتماد: هنا يُكتب الرقم والوعد
  const needsApproval = who.role !== 'admin' && !tpl;

  const row = {
    company_id: companyId,
    lead_ref: b?.lead_ref ? String(b.lead_ref).slice(0, 200) : null,
    to_name: toName || null,
    to_email: toEmail,
    template_key: tpl ? tpl.key : null,
    subject: subject.slice(0, 300),
    body,
    status: needsApproval ? 'بانتظار الاعتماد' : 'مسودة',
    created_by: who.userId,
    created_by_name: sender.name,
  };

  const { data: saved, error: insErr } = await sb
    .from('client_messages')
    .insert(row)
    .select('id')
    .single();
  if (insErr || !saved) {
    return NextResponse.json({ error: insErr?.message || 'تعذّر الحفظ' }, { status: 500 });
  }

  if (needsApproval) {
    await logEvent(sb, companyId, 'رسالة عميل تنتظر اعتمادك', subject, 'staff');
    return NextResponse.json({
      ok: true,
      queued: true,
      id: saved.id,
      note: 'النص الحرّ لا يخرج إلا باعتماد المالك — حُفظ وسيصله التنبيه',
    });
  }

  try {
    await resend.emails.send({
      from: sender.from,
      to: toEmail,
      replyTo: sender.replyTo,
      subject,
      html: htmlOf(body),
    });
  } catch (e) {
    await sb
      .from('client_messages')
      .update({ status: 'فشل', error_note: String(e).slice(0, 200) })
      .eq('id', saved.id);
    return NextResponse.json({ error: 'فشل الإرسال: ' + String(e).slice(0, 120) }, { status: 502 });
  }

  await sb
    .from('client_messages')
    .update({ status: 'مُرسلة', sent_at: new Date().toISOString(), error_note: null })
    .eq('id', saved.id);
  await logEvent(sb, companyId, 'أُرسلت رسالة للعميل: ' + subject, sender.name + ' ← ' + toEmail, who.role === 'admin' ? 'owner' : 'staff');

  return NextResponse.json({ ok: true, sent: true, id: saved.id });
}

// PATCH: اعتماد نصّ حرّ وإرساله — للمالك وحده
export async function PATCH(req: Request) {
  const { who, error: denied } = await requireStaff();
  if (denied || !who) return NextResponse.json({ error: denied || 'غير مصرح' }, { status: 401 });
  if (who.role !== 'admin') {
    return NextResponse.json({ error: 'الاعتماد للمالك وحده' }, { status: 403 });
  }

  const b = await req.json().catch(() => ({}));
  const id = String(b?.id || '');
  const action = String(b?.action || 'approve');
  if (!id) return NextResponse.json({ error: 'id مطلوب' }, { status: 400 });

  const sb = admin();
  const { data: m } = await sb.from('client_messages').select('*').eq('id', id).maybeSingle();
  if (!m) return NextResponse.json({ error: 'الرسالة غير موجودة' }, { status: 404 });
  if (m.status === 'مُرسلة') return NextResponse.json({ error: 'أُرسلت من قبل' }, { status: 409 });

  if (action === 'reject') {
    await sb.from('client_messages').update({ status: 'مرفوضة', approved_by: who.userId, approved_at: new Date().toISOString() }).eq('id', id);
    return NextResponse.json({ ok: true, rejected: true });
  }

  // التعديل قبل الاعتماد مسموح — يعتمد ما يقرؤه لا ما كُتب قبله
  const subject = b?.subject ? String(b.subject).trim().slice(0, 300) : String(m.subject);
  const body = b?.body ? String(b.body).trim() : String(m.body);

  // تُرسل باسم كاتبتها ومن صندوقها، فالعميل يعرف من يكلّم
  const from = m.created_by === who.userId ? OWNER_FROM : null;
  let sendFrom = from;
  let replyTo = 'partners@murdi.sa';
  if (!sendFrom) {
    const s = await senderFor(String(m.created_by), 'staff');
    if (!s) return NextResponse.json({ error: 'لا يوجد بريد رسمي لكاتب الرسالة' }, { status: 409 });
    sendFrom = s.from;
    replyTo = s.replyTo;
  }

  try {
    await resend.emails.send({
      from: sendFrom,
      to: String(m.to_email),
      replyTo,
      subject,
      html: htmlOf(body),
    });
  } catch (e) {
    await sb.from('client_messages').update({ status: 'فشل', error_note: String(e).slice(0, 200) }).eq('id', id);
    return NextResponse.json({ error: 'فشل الإرسال: ' + String(e).slice(0, 120) }, { status: 502 });
  }

  await sb
    .from('client_messages')
    .update({
      status: 'مُرسلة',
      subject,
      body,
      sent_at: new Date().toISOString(),
      approved_by: who.userId,
      approved_at: new Date().toISOString(),
      error_note: null,
    })
    .eq('id', id);
  await logEvent(sb, m.company_id ? String(m.company_id) : null, 'اعتُمدت وأُرسلت رسالة للعميل: ' + subject, String(m.created_by_name || '') + ' ← ' + String(m.to_email), 'owner');

  return NextResponse.json({ ok: true, sent: true });
}
