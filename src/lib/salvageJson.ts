// إنقاذ ما يُنقذ من ردٍّ مقطوع.
// في سجل الأخطاء أحد عشر فشلاً متطابقاً على أربعة أيام، كلها:
//   Expected ',' or ']' after array element in JSON at position ~11000
// والسبب أن رد النموذج يُقطع عند سقف الرموز في منتصف عنصر من المصفوفة،
// فيرمي JSON.parse فتُفقد الدفعة كاملة — ثماني جهات ذهبت لأن الثامنة نقصت.
// وهذا يفسّر لماذا أُثريت ٨٩٦ صفاً من ١٢١٧ رغم أن الإثراء يعمل.
// القاعدة هنا: العناصر التامّة تُؤخذ، والناقص وحده يُترك.

export interface SalvageResult<T> {
  items: T[];
  salvaged: boolean;   // هل احتجنا الإنقاذ أصلاً
  dropped: number;     // كم عنصراً ناقصاً أسقطنا
}

/** يستخرج الكائنات التامّة من نصّ JSON مقطوع، بعدّ الأقواس واحترام النصوص والهروب. */
export function completeObjects(text: string): string[] {
  const out: string[] = [];
  let depth = 0, start = -1, inStr = false, esc = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (esc) { esc = false; continue; }
      if (c === '\\') { esc = true; continue; }
      if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') { inStr = true; continue; }
    if (c === '{') { if (depth === 0) start = i; depth++; continue; }
    if (c === '}') {
      depth--;
      if (depth === 0 && start >= 0) { out.push(text.slice(start, i + 1)); start = -1; }
      if (depth < 0) depth = 0;
    }
  }
  return out;
}

/**
 * يحاول التحليل السليم أولاً؛ فإن فشل انتقى العناصر التامّة من المصفوفة.
 * `key` اسم المصفوفة في الرد (items مثلاً).
 */
export function parseItemsLenient<T = Record<string, unknown>>(raw: string, key = 'items'): SalvageResult<T> {
  const text = String(raw || '');
  const m = text.match(/\{[\s\S]*\}/);
  if (m) {
    try {
      const parsed = JSON.parse(m[0]);
      const arr = Array.isArray(parsed?.[key]) ? parsed[key] : [];
      return { items: arr as T[], salvaged: false, dropped: 0 };
    } catch { /* مقطوع — ننتقل للإنقاذ */ }
  }

  // نبدأ من بعد "key": [ حتى لا نلتقط الكائن الخارجي نفسه
  const at = text.indexOf('"' + key + '"');
  const from = at >= 0 ? text.indexOf('[', at) : text.indexOf('[');
  const body = from >= 0 ? text.slice(from + 1) : text;

  const chunks = completeObjects(body);
  const items: T[] = [];
  let dropped = 0;
  for (const c of chunks) {
    try { items.push(JSON.parse(c) as T); } catch { dropped++; }
  }
  // العنصر الأخير قد يكون ناقصاً فلا يُحتسب كائناً تامّاً أصلاً — نعدّه إسقاطاً واحداً
  const tail = body.slice(chunks.length ? body.lastIndexOf(chunks[chunks.length - 1]) + chunks[chunks.length - 1].length : 0);
  if (/\{/.test(tail)) dropped++;

  return { items, salvaged: true, dropped };
}
