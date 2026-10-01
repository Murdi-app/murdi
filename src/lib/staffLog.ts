import { createClient } from '@supabase/supabase-js';
import type { Who } from '@/lib/requireStaff';

// ★ ١ أكتوبر (بأمر المالك): كل إجراءٍ تجريه موظفة على ملف — مكالمة جهة، تحديث متابعة،
//   قرارٌ في المكتب، رسالة، فتح ملف — يُسجَّل باسمها (المسجّلة الدخول) ويدخل في عدّ
//   نشاطها (`staff_activity`). كانت مكالمات الجهات تُكتب في `outreach_messages` بلا فاعل
//   فلا تُحسب لأحد. وما يجريه المالك لا يُسجَّل هنا. ولا يُسقط فشلُ التسجيل الإجراءَ نفسه.
export async function logStaff(
  who: Who | null | undefined,
  kind: string,
  ref?: { table?: string; id?: string | null; note?: string | null },
): Promise<void> {
  if (!who || who.role === 'admin' || !who.userId) return;
  try {
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string);
    const { data: st } = await sb.from('staff').select('name').eq('user_id', who.userId).maybeSingle();
    await sb.from('staff_actions').insert({
      actor: who.userId, actor_name: st?.name || who.email, kind,
      ref_table: ref?.table || null, ref_id: ref?.id ? String(ref.id) : null,
      note: ref?.note ? String(ref.note).slice(0, 300) : null,
    });
  } catch { /* السجلّ لا يُسقط الإجراء */ }
}
