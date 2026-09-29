import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/requireAdmin';

// تعديل قوالب رسائل الترسيات وإعداداتها — من شاشة المالك. المحتوى في
// القاعدة وحدها (المستودع عام)، وهذا المسار يكتبه بعد `requireAdmin`.

const admin = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

// PUT { template: { id, subject?, context_paragraph?, active? } } أو { setting: { key, value } }
export async function PUT(req: Request) {
  const denied = await requireAdmin();
  if (denied) return NextResponse.json({ error: denied }, { status: 401 });
  const b = await req.json().catch(() => ({} as Record<string, unknown>));
  const sb = admin();
  const now = new Date().toISOString();

  if (b.template && typeof b.template === 'object') {
    const t = b.template as Record<string, unknown>;
    const id = String(t.id || '');
    if (!id) return NextResponse.json({ error: 'معرّف القالب مطلوب' }, { status: 400 });
    const patch: Record<string, unknown> = { updated_at: now };
    if (t.subject !== undefined) {
      const v = String(t.subject).trim();
      if (!v) return NextResponse.json({ error: 'العنوان لا يُفرَّغ' }, { status: 400 });
      patch.subject = v.slice(0, 300);
    }
    if (t.context_paragraph !== undefined) {
      const v = String(t.context_paragraph).trim();
      if (!v) return NextResponse.json({ error: 'فقرة السياق لا تُفرَّغ' }, { status: 400 });
      patch.context_paragraph = v.slice(0, 4000);
    }
    if (t.active !== undefined) patch.active = t.active === true;
    // تعديل المالك اعتمادٌ (ومشغّل القاعدة يعيد غيرَه إلى «ينتظر الاعتماد»)
    if (patch.subject !== undefined || patch.context_paragraph !== undefined || t.approve === true) { patch.approved = true; patch.approved_at = now; }
    const { data, error } = await sb.from('award_message_templates').update(patch).eq('id', id).select('id');
    if (error) return NextResponse.json({ error: 'لم يُحفظ القالب — ' + error.message }, { status: 500 });
    if (!data?.length) return NextResponse.json({ error: 'القالب غير موجود' }, { status: 404 });
    return NextResponse.json({ ok: true });
  }

  if (b.setting && typeof b.setting === 'object') {
    const st = b.setting as Record<string, unknown>;
    const key = String(st.key || '').trim();
    const value = String(st.value ?? '').trim();
    if (!key) return NextResponse.json({ error: 'المفتاح مطلوب' }, { status: 400 });
    if (!value) return NextResponse.json({ error: 'القيمة لا تُفرَّغ' }, { status: 400 });
    // الإعدادات الرقمية تبقى أرقاماً — وإلا انكسر حساب المرحلة والتذكير صامتاً
    const { data: cur } = await sb.from('award_settings').select('value').eq('key', key).maybeSingle();
    if (!cur) return NextResponse.json({ error: 'إعدادٌ غير معروف' }, { status: 404 });
    if (/^\d+(\.\d+)?$/.test(String(cur.value).trim()) && !/^\d+(\.\d+)?$/.test(value)) {
      return NextResponse.json({ error: 'هذا الإعداد رقم — اكتبه أرقاماً' }, { status: 400 });
    }
    const { data, error } = await sb.from('award_settings').update({ value: value.slice(0, 4000) }).eq('key', key).select('key');
    if (error) return NextResponse.json({ error: 'لم يُحفظ الإعداد — ' + error.message }, { status: 500 });
    if (!data?.length) return NextResponse.json({ error: 'لم يُحدَّث شيء' }, { status: 404 });
    // نصٌّ يخرج للعميل عدّله المالك بنفسه ← معتمد (مشغّل القاعدة صفّر مفتاحه عند التعديل)
    const APPROVAL: Record<string, string> = {
      general_email_subject: 'general_email_approved', general_email_body: 'general_email_approved',
      whatsapp_template: 'whatsapp_template_approved', whatsapp_template_general: 'whatsapp_template_approved',
      gap_email_subject: 'gap_email_approved', gap_email_body: 'gap_email_approved',
    };
    if (APPROVAL[key]) await sb.from('award_settings').update({ value: 'true' }).eq('key', APPROVAL[key]);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'لا شيء يُحفظ' }, { status: 400 });
}
