import type { SupabaseClient } from '@supabase/supabase-js';

// القسمة بالمناصفة بين ضي ورغد (١٣ أكتوبر، المالك).
//
// ★ «ضي عليها عمل كثير وتفضّل أن رغد تعاونها — نصف اللي يسجّلون يروحون لصفحة رغد،
//   وتقوم رغد بما تقوم به ضي بالمناصفة». فلكل عميلٍ قبل الدفع صاحبة واحدة:
//   · من كلّمته موظفةٌ من قبل فهو لها (أول من لمسه) — فلا يُنتزع من ضي عميلٌ بدأت معه.
//   · ومن لم يُلمس بعد يُقسم بالتناوب الثابت على مفتاحه — نصفٌ لضي ونصفٌ لرغد،
//     ولا يتبدّل بإعادة التحميل.
// والمالك يرى الجميع وصاحبةَ كلٍّ منهم.

export type Staffers = { dhai: string; raghad: string; names: Set<string> };

export async function loadStaffers(sb: SupabaseClient): Promise<Staffers> {
  const { data } = await sb.from('staff').select('name, job, active');
  const live = (data || []).filter((s) => s.active !== false);
  const dhai = String(live.find((s) => s.job === 'followup')?.name || 'ضي').trim();
  const raghad = String(live.find((s) => s.job === 'assistant')?.name || 'رغد').trim();
  return { dhai, raghad, names: new Set([dhai, raghad]) };
}

const half = (key: string) => {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return h % 2;
};

/** صاحبة العميل: أول موظفة لمسته، وإلا القسمة الثابتة على المفتاح */
export function ownerOf(key: string, firstActor: string | null | undefined, s: Staffers): string {
  const a = String(firstActor || '').trim();
  if (a && s.names.has(a)) return a;
  return half(key) === 0 ? s.dhai : s.raghad;
}
