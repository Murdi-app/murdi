import type { SupabaseClient } from '@supabase/supabase-js';
import type { Mail } from '@/lib/gmail';
import { askClaude, jsonOf } from '@/lib/claudeApi';

// ★ ١ أكتوبر (بأمر المالك): ترسيات اعتماد بلا متصفح ولا كشط — من تنبيهات البريد التي
//   يفعّلها المالك من حسابه مورّداً، تصل partners@murdi.sa فتقرؤها مراقبة البريد.
//   تُستخرج الترسيات بـClaude (صيغة البريد قد تتغيّر) وتدخل contract_awards بمصدر
//   etimad_alert، فتمرّ بمشغّلات القاعدة نفسها (لا تتواصل · ربط المقاول · المفتاح).
//   والتنبيه بمنافسةٍ جديدة (لا ترسية) لا يُدخل — ليس فيه فائز.

type Row = { company_name: string; tender_title: string; buyer_entity?: string; contract_value?: number | null; awarded_at?: string; tender_no?: string };
const CATS: [RegExp, string][] = [[/تشييد|إنشاء|مقاولات|بناء|طرق|جسور/, 'construction'], [/تشغيل|صيانة|نظافة|حراسة|مرافق/, 'om_services'], [/توريد|تقنية|أنظمة|برمجيات|أجهزة|معدات/, 'supply_it'], [/استشار/, 'consulting'], [/نقل|تأجير|لوجست/, 'transport']];

export async function importEtimadAlert(sb: SupabaseClient, m: Mail): Promise<number> {
  const j = jsonOf<{ awards: Row[] }>(await askClaude(
    'تستخرج الترسيات من بريد تنبيه منصة اعتماد السعودية. الترسية = منافسة أُعلن الفائز بها. أعد JSON فقط: {"awards":[{"company_name":"الفائز","tender_title":"اسم المنافسة","buyer_entity":"الجهة","contract_value":رقم بالريال أو null,"awarded_at":"YYYY-MM-DD","tender_no":""}]}. إن لم يكن في البريد فائزٌ مسمّى فأعد {"awards":[]}. لا تخترع.',
    'الموضوع: ' + m.subject + '\n\n' + m.text.slice(0, 10000), 2000));
  let n = 0;
  for (const a of (j?.awards || []).slice(0, 30)) {
    if (!a.company_name || !a.tender_title) continue;
    const t = a.tender_title + ' ' + (a.buyer_entity || '');
    const { error } = await sb.from('contract_awards').insert({
      source: 'etimad_alert', source_ref: (a.tender_no ? 'etimad:' + a.tender_no : 'gmail:' + m.id).slice(0, 500),
      company_name: a.company_name.slice(0, 200), tender_title: a.tender_title.slice(0, 300), buyer_entity: a.buyer_entity || null,
      category: CATS.find(([re]) => re.test(t))?.[1] || 'other', contract_value: a.contract_value || null,
      awarded_at: a.awarded_at || new Date().toISOString().slice(0, 10),
      notes: 'من تنبيه اعتماد بالبريد — ' + m.subject.slice(0, 200),
    });
    if (!error) n++;
  }
  return n;
}
