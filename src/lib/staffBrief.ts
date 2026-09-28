import type { SupabaseClient } from '@supabase/supabase-js';
import { closesOpportunity } from './outcomes';
import { OPEN_PAID_STATUSES } from './serviceStatus';
import { involvesOutreach } from './serviceCatalog';
import { isFrozen } from './frozen';

// توجيه الصباح للموظفتين — يُكتب من بيانات المنصة نفسها.
//
// ★ كانت المسوّدتان تُكتبان في مهمةٍ مجدولة خارج المنصة، ولم تُكتبا منذ ١٦
//   سبتمبر إلا مرةً يدوياً — فتبدأ الموظفتان يومهما بلا توجيه، ولا يعلم
//   أحد. والجرد اليومي بُني من قبل لهذه العلّة نفسها («مهام Claude المجدولة
//   تقف عند طلب الإذن فتموت معلّقة»): فصار التوجيه كذلك، يوقظه `pg_cron`.
//
// ★ والقواعد مكتوبةٌ في البناء لا في الذاكرة:
//   · لا مبلغ ولا سعر ولا ما دفعه عميل في رسالة موظفة.
//   · ضي ما قبل الدفع، ورغد ما بعده وجهات التمويل — وتُقرأ القوائم من
//     المصادر نفسها التي ترسم شاشتيهما (`hot_list` · الطلبات المدفوعة · المخاطبات).
//   · رغد لا تتواصل مع صاحب ملفٍ إلا بتوجيه المالك.
//   · لا يخرج شيءٌ إلى الموظفة إلا بضغطة المالك على «اعتمد وأرسل».

export type Brief = { recipient: 'dhai' | 'raghad'; to: string; subject: string; body: string; items: number };

const SIGN = '\n\nد. عبدالحكيم المرضي';
const ORD = ['أولاً', 'ثانياً', 'ثالثاً', 'رابعاً', 'خامساً', 'سادساً'];
const AR_DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const AR_MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

/** تاريخ الرياض اليوم بصيغة YYYY-MM-DD */
export const riyadhDate = (d = new Date()): string =>
  new Date(d.getTime() + 3 * 3600_000).toISOString().slice(0, 10);

const arDay = (iso: string) => {
  const d = new Date(iso + 'T12:00:00Z');
  return AR_DAYS[d.getUTCDay()] + ' ' + d.getUTCDate().toLocaleString('ar-SA') + ' ' + AR_MONTHS[d.getUTCMonth()];
};

const who = (name: unknown, person: unknown) => {
  const n = String(name || '').trim(), p = String(person || '').trim();
  return n && p && n !== p ? n + ' — ' + p : (n || p || 'بلا اسم');
};

type HotRow = { source: string; ref_id: string; tier: number; name: string | null; person: string | null; reason: string; at: string | null };
type Touch = { source: string; ref_id: string; outcome: string | null; next_action_at: string | null; created_at: string };

/** صفُّ ضي — من `hot_list` بعد استبعاد ما حُسم وما ينتظر موعده، كما تفعل شاشتها */
async function dhaiBrief(sb: SupabaseClient, today: string): Promise<Brief> {
  const { data: list, error } = await sb.from('hot_list').select('source, ref_id, tier, name, person, reason, at')
    .lte('tier', 3).order('tier').order('at', { ascending: false }).limit(200);
  if (error) throw new Error('hot_list: ' + error.message);
  const rows = (list || []) as HotRow[];
  const refs = Array.from(new Set(rows.map((r) => r.ref_id)));
  const { data: tl, error: tErr } = refs.length
    ? await sb.from('hot_touches').select('source, ref_id, outcome, next_action_at, created_at').in('ref_id', refs).order('created_at', { ascending: false })
    : { data: [], error: null };
  if (tErr) throw new Error('hot_touches: ' + tErr.message);
  const last = new Map<string, Touch>();
  for (const t of (tl || []) as Touch[]) { const k = t.source + '|' + t.ref_id; if (!last.has(k)) last.set(k, t); }
  const due = rows.filter((r) => {
    const t = last.get(r.source + '|' + r.ref_id);
    return !(closesOpportunity(t?.outcome) || (t?.next_action_at && t.next_action_at > today));
  });

  const pick = (src: string, n: number) => due.filter((r) => r.source === src).slice(0, n);
  // اسمٌ من حرفٍ واحد مكرّر أو أرقام ليس عميلاً — تجربة أو عبث
  const junk = (r: HotRow) => /^(.)\1+$/.test(String(r.name || '').trim()) || /^[\d\s]+$/.test(String(r.person || '').replace(/[^\d\s\u0600-\u06FFa-z]/gi, ''));
  const score = (r: HotRow) => Number((String(r.reason || '').match(/\d+/) || ['0'])[0]);
  const parts: string[] = [];
  let count = 0;
  const section = (title: string, rs: HotRow[], line: (r: HotRow) => string) => {
    if (!rs.length) return;
    count += rs.length;
    parts.push(ORD[parts.length] + ' — ' + title + '\n' + rs.map((r) => '· ' + line(r)).join('\n'));
  };

  section('تحويلٌ وصل وينتظر تأكيده في مكتب الطلبات (طابقيه بالإيصال ثم أكّديه):',
    pick('transfer', 10), (r) => who(r.name, r.person));
  section('طلبٌ مسعَّر ينتظر التحويل (أعيدي له رابط الدفع):',
    pick('ordered', 10), (r) => who(r.name, r.person) + ' — ' + String(r.reason || '').replace(/\s*ولم يدفع$/, ''));
  section('طلب خدمةً من الموقع ولم يُتّصل به:',
    pick('inquiry', 8), (r) => who(r.name, r.person) + ' — ' + String(r.reason || ''));
  section('ملفٌّ مكتمل ولم يصدر له عقد (الأحدث أولاً):',
    pick('file', 6), (r) => who(r.name, r.person));
  // الأعلى درجةً أولاً — هو الأقرب إلى خدمة
  section('أنهى التقييم وينتظر نتيجته (الأعلى درجةً أولاً):',
    due.filter((r) => r.source === 'assessment' && !junk(r)).sort((a, b) => score(b) - score(a)).slice(0, 6),
    (r) => who(r.name, r.person) + ' — درجة ' + score(r).toLocaleString('ar-SA'));

  const body = 'صباح الخير يا ضي،\n\nشاشتك «الفرص الساخنة» مرتّبة لك، وهذا ترتيب اليوم:\n\n'
    + (parts.length ? parts.join('\n\n') : 'لا أسماء تنتظر اتصالاً اليوم — راجعي «الوارد» لمن وصل حديثاً.')
    + '\n\nوبعد كل مكالمة: «اتصلتُ» ثم النتيجة ثم موعد المعاودة إن وُجد. المكالمة التي لا تُكتب نتيجتها مكالمةٌ ضائعة.'
    + '\nولا تتصلي بأي جهة تمويل ولا تراسليها.' + SIGN;
  return { recipient: 'dhai', to: 'dhai@murdi.sa', subject: 'توجيه اليوم — ' + arDay(today), body, items: count };
}

/** صفُّ رغد — ملفّات من دفع لخدمةٍ ثمنُها المخاطبة */
async function raghadBrief(sb: SupabaseClient, today: string): Promise<Brief> {
  const { data: paid, error } = await sb.from('service_requests')
    .select('company_id, service_title, status, updated_at, option_key').in('status', [...OPEN_PAID_STATUSES]);
  if (error) throw new Error('service_requests: ' + error.message);
  // الفحص الائتماني وما لا مخاطبة فيه ليس من صفّها
  const rows = (paid || []).filter((r) => involvesOutreach(r.service_title, r.option_key));
  const ids = Array.from(new Set(rows.map((r) => String(r.company_id))));
  const { data: cos, error: cErr } = ids.length
    ? await sb.from('companies').select('id, company_name, admin_note, outreach_paused').in('id', ids)
    : { data: [], error: null };
  if (cErr) throw new Error('companies: ' + cErr.message);
  const live = new Map((cos || [])
    .filter((c) => !isFrozen(c.admin_note) && c.outreach_paused !== true)
    .map((c) => [String(c.id), String(c.company_name || 'منشأة')]));

  const { data: msgs, error: mErr } = live.size
    ? await sb.from('outreach_messages').select('company_id').in('company_id', [...live.keys()])
        .not('status', 'in', '("مستبعدة","موقوفة")')
    : { data: [], error: null };
  if (mErr) throw new Error('outreach_messages: ' + mErr.message);

  const now = Date.parse(today + 'T09:00:00Z');
  const days = (iso: unknown) => Math.floor((now - Date.parse(String(iso || ''))) / 86400_000);

  // ملفٌّ دفع صاحبه ولم يُخاطَب له بابٌ واحد — أخطر حالة
  const touched = new Set((msgs || []).map((m) => String(m.company_id)));
  const untouched = [...live.entries()].filter(([id]) => !touched.has(id)).map(([, n]) => n);

  // ★ لا قسم «أبواب ساكتة» هنا: الباب الساكت يُذكَّر مرةً ثم يُترك، والمتابعة
  //   الهاتفية لمن ردّ ومتى قرّر المالك (قاعدته). فلا يُكلَّف بها آلياً.

  // الملفّات الأقدم سكوناً
  const idle = new Map<string, number>();
  for (const r of rows) {
    const id = String(r.company_id);
    if (!live.has(id)) continue;
    const d = days(r.updated_at);
    if (!idle.has(id) || d > (idle.get(id) as number)) idle.set(id, d);
  }
  const stale = [...idle.entries()].sort((a, b) => b[1] - a[1]).filter(([, d]) => d >= 5).slice(0, 8)
    .map(([id, d]) => (live.get(id) as string) + ' — ساكن منذ ' + d.toLocaleString('ar-SA') + ' يوماً');

  const parts: string[] = [];
  if (untouched.length) parts.push(ORD[parts.length] + ' — ملفٌّ دفع صاحبه ولم يُخاطَب له بابٌ واحد (بلّغيني بها اليوم، ولا تتواصلي مع صاحبه):\n' + untouched.map((x) => '· ' + x).join('\n'));
  if (stale.length) parts.push(ORD[parts.length] + ' — «ملفّات تنتظرك» الأقدم سكوناً: اكتبي عند كلٍّ منها أين وقف وما ينقصه:\n' + stale.map((x) => '· ' + x).join('\n'));
  parts.push(ORD[parts.length] + ' — المكالمات المُسندة إليك في شاشة «المتابعة»: سجّلي بعد كل مكالمة اسم المسؤول ورقمه وملاحظتك.');

  const body = 'صباح الخير يا رغد،\n\nعملك اليوم في جهات التمويل وملفّات من دفع، وكل نتيجة تُكتب في شاشة «المتابعة»:\n\n'
    + parts.join('\n\n')
    + '\n\nولا تتواصلي مع صاحب أي ملف ولا مع جهةٍ لم تُسنَد إليك إلا بتوجيهٍ مني.' + SIGN;
  return { recipient: 'raghad', to: 'raghad@murdi.sa', subject: 'توجيه اليوم — ' + arDay(today), body, items: untouched.length + stale.length };
}

export async function buildBriefs(sb: SupabaseClient, today = riyadhDate()): Promise<Brief[]> {
  return Promise.all([dhaiBrief(sb, today), raghadBrief(sb, today)]);
}
