import type { SupabaseClient } from '@supabase/supabase-js';
import { listInbox, replyOnly, gmailConfigured, type Mail } from '@/lib/gmail';
import { askClaude, jsonOf } from '@/lib/claudeApi';
import { importEtimadAlert } from '@/lib/etimadAlerts';

// ★ ١ أكتوبر (بأمر المالك): مراقبة بريد partners@murdi.sa على الخادم — كانت جلسة Claude على
//   جهاز المالك (١٠:٣٣ و٦:٣٧) تقرؤه، فإن أُغلق الجهاز لم يُقرأ. التعليمات نفسها:
//   · ردّ صاحب ترسية ← award_touches (email · in) بنصّه وكلامه بحرفه.
//   · ردّ جهة تمويل ← outreach_messages (reply_received · reply_at · reply_status · المسؤول).
//   · استفسار عميل جديد ← service_inquiries إن لم يكن فيها.
//   · ارتداد ← email_blocklist «عنوان غير صالح».   · تنبيه اعتماد ← contract_awards (etimad_alert).
//   ولا يُرسل منه شيءٌ لأحد. وكل رسالة تُقرأ مرةً واحدة (`mail_seen`).

const ACTOR = 'Claude التشغيل (الخادم)';
const GENERIC = /@(gmail|hotmail|outlook|yahoo|icloud|live)\./;
const domainOf = (e: string) => e.split('@')[1] || '';

export type MailResult = { configured: boolean; read: number; award: number; entity: number; inquiry: number; bounce: number; etimad: number; notes: string[] };

async function seen(sb: SupabaseClient, m: Mail, kind: string, ref: string | null) {
  await sb.from('mail_seen').insert({ message_id: m.id, kind, ref, from_email: m.fromEmail, subject: m.subject.slice(0, 300) });
}

export async function watchMail(sb: SupabaseClient): Promise<MailResult> {
  const r: MailResult = { configured: gmailConfigured(), read: 0, award: 0, entity: 0, inquiry: 0, bounce: 0, etimad: 0, notes: [] };
  if (!r.configured) return r;
  const mails = await listInbox(3, 60);
  const { data: done } = await sb.from('mail_seen').select('message_id').in('message_id', mails.map((m) => m.id));
  const doneSet = new Set((done || []).map((d) => d.message_id));
  for (const m of mails.reverse()) {
    if (doneSet.has(m.id)) continue;
    r.read++;
    const e = m.fromEmail;

    // ١) ارتداد
    if (/mailer-daemon|postmaster|mail delivery/i.test(e + ' ' + m.from)) {
      const addrs = Array.from(new Set((m.text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/g) || []).map((x) => x.toLowerCase())))
        .filter((x) => !x.endsWith('@murdi.sa') && !/mailer-daemon|postmaster|google\.com|googlemail/.test(x));
      for (const a of addrs.slice(0, 3)) {
        await sb.from('email_blocklist').upsert({ email: a, reason: 'عنوان غير صالح — ارتدّ (' + m.date + ')' }, { onConflict: 'email', ignoreDuplicates: true });
        await sb.from('outreach_messages').update({ status: 'عنوان غير صالح', error_note: 'ارتدّ: ' + m.subject.slice(0, 120), updated_at: new Date().toISOString() }).ilike('entity_email', a);
      }
      r.bounce++; r.notes.push('ارتداد: ' + addrs.slice(0, 2).join('، '));
      await seen(sb, m, 'bounce', addrs[0] || null); continue;
    }

    // ٢) تنبيه من اعتماد
    if (/etimad\.sa$/.test(domainOf(e))) {
      const n = await importEtimadAlert(sb, m).catch((x) => { r.notes.push('اعتماد: ' + (x instanceof Error ? x.message : x)); return 0; });
      r.etimad += n; await seen(sb, m, 'etimad', String(n)); continue;
    }

    // ٣) ردّ صاحب ترسية
    const { data: aw } = await sb.from('contract_awards').select('id, company_name').ilike('contact_email', e).limit(1);
    let awardId = aw?.[0]?.id as string | undefined;
    if (!awardId) {
      const { data: ob } = await sb.from('award_outbox').select('award_id').ilike('to_address', e).order('created_at', { ascending: false }).limit(1);
      awardId = ob?.[0]?.award_id as string | undefined;
    }
    if (awardId) {
      const said = replyOnly(m.text);
      const { data: dup } = await sb.from('award_touches').select('id').eq('award_id', awardId).eq('external_ref', 'gmail:' + m.id).limit(1);
      if (!dup?.length) {
        await sb.from('award_touches').insert({ award_id: awardId, channel: 'email', direction: 'in', actor: ACTOR, subject: m.subject.slice(0, 300), body: m.text.slice(0, 6000), said, external_ref: 'gmail:' + m.id });
        r.award++; r.notes.push('ردّ ترسية: ' + (aw?.[0]?.company_name || e));
      }
      await seen(sb, m, 'award', awardId); continue;
    }

    // ٤) ردّ جهة تمويل
    const dom = domainOf(e);
    let { data: om } = await sb.from('outreach_messages').select('id, entity_name').or('entity_email.ilike.' + e + ',officer_email.ilike.' + e).limit(1);
    if (!om?.length && dom && !GENERIC.test(e)) ({ data: om } = await sb.from('outreach_messages').select('id, entity_name').ilike('entity_email', '%@' + dom).limit(1));
    if (om?.length) {
      const said = replyOnly(m.text);
      const c = jsonOf<{ reply_status: string; summary: string; officer_name?: string; officer_phone?: string }>(await askClaude(
        'تصنّف ردّ جهة تمويل على مكتب استشارات مالية سعودي. أعد JSON فقط: {"reply_status":"docs|call|deflect|declined","summary":"سطر عربي مختصر","officer_name":"","officer_phone":""}. docs = طلبوا مستندات/ملفاً · call = طلبوا اتصالاً أو اجتماعاً · deflect = حوّلونا لقناة أخرى أو ردّ آلي · declined = اعتذار.',
        'الجهة: ' + om[0].entity_name + '\nالمرسل: ' + m.from + '\nالموضوع: ' + m.subject + '\n\n' + said, 400).catch(() => '{}'));
      const st = ['docs', 'call', 'deflect', 'declined'].includes(String(c?.reply_status)) ? c!.reply_status : null;
      const patch: Record<string, unknown> = { reply_received: (c?.summary || said).slice(0, 4000), reply_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      if (st) patch.reply_status = st;
      if (c?.officer_name) patch.officer_name = c.officer_name.slice(0, 120);
      if (c?.officer_phone) patch.officer_phone = c.officer_phone.slice(0, 40);
      await sb.from('outreach_messages').update(patch).eq('id', om[0].id);
      r.entity++; r.notes.push('ردّ جهة: ' + om[0].entity_name + (st ? ' (' + st + ')' : ''));
      await seen(sb, m, 'entity', String(om[0].id)); continue;
    }

    // ٥) استفسار عميل جديد؟
    const c = jsonOf<{ inquiry: boolean; name?: string; company?: string; phone?: string; service?: string; note?: string }>(await askClaude(
      'تقرأ بريداً وصل مكتب «مُرضي» للاستشارات المالية (تجهيز ملفات التمويل، تمويل العقود، دراسات الجدوى). هل هو استفسار من عميل محتمل عن خدماتنا؟ النشرات والإعلانات والإشعارات الآلية والفواتير ليست استفسارات. أعد JSON فقط: {"inquiry":true|false,"name":"","company":"","phone":"","service":"","note":"سطر"}',
      'المرسل: ' + m.from + '\nالموضوع: ' + m.subject + '\n\n' + replyOnly(m.text).slice(0, 2500), 300).catch(() => '{}'));
    if (c?.inquiry) {
      const { data: ex } = await sb.from('service_inquiries').select('id').ilike('email', e).limit(1);
      if (!ex?.length) {
        await sb.from('service_inquiries').insert({ service_title: c.service || 'استفسار بالبريد', full_name: c.name || m.from.replace(/<.*>/, '').trim() || e, email: e, phone: c.phone || null, company_name: c.company || null, note: (c.note || m.subject).slice(0, 500), src: 'email' });
        r.inquiry++; r.notes.push('استفسار: ' + (c.company || c.name || e));
      }
      await seen(sb, m, 'inquiry', e); continue;
    }
    await seen(sb, m, 'other', null);
  }
  return r;
}
