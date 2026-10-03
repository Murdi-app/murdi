import type { SupabaseClient } from '@supabase/supabase-js';
import { closesOpportunity } from './outcomes';
import { OPEN_PAID_STATUSES } from './serviceStatus';
import { involvesOutreach } from './serviceCatalog';
import { isFrozen } from './frozen';
import { needsSignedContract } from './contracts';
import { redactTimeline } from './staffRedact';

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

export type Brief = { recipient: 'dhai' | 'raghad'; to: string; subject: string; body: string; items: number; by?: 'claude' | 'platform'; why?: string };

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
  // ★ ٣ أكتوبر: «العقد أولاً» — الطلب الذي عقده لم يُوقَّع لا يُعاد له رابط دفع (لا يُفتح
  //   الدفع قبل التوقيع)؛ يُذكَّر صاحبه برابط العقد الذي وصله على بريده.
  const ordered = pick('ordered', 10);
  const coIds = ordered.map((r) => r.ref_id);
  const { data: srs } = coIds.length
    ? await sb.from('service_requests').select('id, company_id, service_title').in('company_id', coIds).eq('status', 'priced')
    : { data: [] as { id: string; company_id: string; service_title: string }[] };
  const srIds = (srs || []).map((s) => s.id);
  const { data: docs } = srIds.length
    ? await sb.from('contracts').select('service_request_id, status, contract_type').in('service_request_id', srIds)
    : { data: [] as { service_request_id: string; status: string; contract_type: string }[] };
  const awaitingSign = new Set((srs || []).filter((s) => needsSignedContract(s.service_title)
    && !(docs || []).some((d) => d.service_request_id === s.id && ['signed', 'completed'].includes(d.status))).map((s) => String(s.company_id)));
  const line = (r: HotRow) => who(r.name, r.person) + ' — ' + String(r.reason || '').replace(/\s*ولم يدفع$/, '');
  section('عقدٌ أُرسل ولم يُوقَّع بعد (ذكّريه بفتح رابط العقد من بريده وتوقيعه — الدفع يُفتح له بعد التوقيع، فلا ترسلي رابط دفع):',
    ordered.filter((r) => awaitingSign.has(r.ref_id)), line);
  section('طلبٌ مسعَّر ينتظر التحويل (أعيدي له رابط الدفع):',
    ordered.filter((r) => !awaitingSign.has(r.ref_id)), line);
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

// ★ ٣ أكتوبر (بأمر المالك: «اكتب التوجيه كل صباح من نفسك»): الحقائق تُجمع أعلاه من
//   المنصة كما هي، ثم يكتب Claude التوجيه منها بصوت المالك — أولوياتٌ وسببٌ ونبرة، لا قائمةٌ
//   جافة. ولا يضيف اسماً ولا رقماً ليس في الحقائق. ويُفحص الناتج: لا مبلغ، ولا كلمة محظورة،
//   ولا ذكر لآلةٍ أو ذكاءٍ اصطناعي (الموظفتان لا تعلمان)، والتوقيع باسم المالك — وإلا خرج
//   توجيه المنصة الأصلي، فلا يمرّ صباحٌ بلا توجيه.
const FORBIDDEN = /(قرض|كفالة|claude|chatgpt|ذكاء\s*اصطناعي|\bAI\b|بوت|نموذج لغوي|ريال|﷼|٪|%|\bSAR\b)/i;

const RULES: Record<Brief['recipient'], string> = {
  dhai: 'ضي: مرحلتها من وصول العميل إلى أن يدفع — الفرص الساخنة، والمكالمة الأولى، ومكتب الطلبات، وتأكيد التحويل بمطابقة الإيصال، وقناة الفائزين بالترسيات. لا تتصل بأي جهة تمويل ولا تراسلها. بعد كل مكالمة تسجّل «اتصلتُ» ثم النتيجة ثم موعد المعاودة.',
  raghad: 'رغد: مرحلتها ما بعد الدفع وجهات التمويل — ملفّات من دفع، والاتصال بالجهات المُسندة إليها (ومنها: تعميد، إمكان، لندو، الأهلي نقاط البيع، Funding Souq) وتسجيل اسم المسؤول ورقمه وملاحظتها في شاشة «المتابعة» بعد كل مكالمة. لا تتواصل مع صاحب أي ملف، ولا مع جهةٍ لم تُسنَد إليها، إلا بتوجيه المالك. والملفّ الذي دفع صاحبه ولم يُخاطَب له باب تبلّغ به المالك اليوم.',
};

async function polish(sb: SupabaseClient, b: Brief, today: string): Promise<Brief> {
  const { askClaude } = await import('./claudeApi');
  // آخر يوم عمل (الأحد يُقرأ فيه الخميس — الجمعة والسبت عطلة)
  let yt = Date.parse(today + 'T12:00:00Z') - 86400_000;
  while ([5, 6].includes(new Date(yt).getUTCDay())) yt -= 86400_000;
  const y = new Date(yt).toISOString().slice(0, 10);
  const { data: act } = await sb.rpc('staff_activity', { p_from: y, p_to: y });
  const { data: st } = await sb.from('staff').select('name').eq('email', b.to).maybeSingle();
  const mine = ((act || []) as { name: string; touches: number; files: number }[]).find((a) => a.name === st?.name);
  const { data: lastBrief } = await sb.from('daily_briefs').select('read_at').eq('to_email', b.to).eq('brief_date', y).maybeSingle();
  // ★ «وين وصلنا»: توجيهات المالك القائمة لهذه الموظفة (`brief_context` — تُكتب من محادثته
  //   مع Claude)، وما استجدّ على الملفات منذ آخر يوم عمل (deal_events منقّاةً من المال والأرقام).
  const { data: ctxAll } = await sb.from('brief_context').select('note, message').eq('active', true)
    .in('audience', [b.recipient, 'both']).lte('starts_on', today).or('expires_on.is.null,expires_on.gte.' + today).order('id');
  const ctx = (ctxAll || []).filter((c) => !c.message);
  const verbatim = (ctxAll || []).filter((c) => c.message);
  const { data: evs } = await sb.from('deal_events').select('title, detail, kind, created_at, company_id')
    .gte('created_at', y + 'T00:00:00+03:00').in('kind', ['contract_signed', 'client_email', 'file_update', 'service', 'note'])
    .order('created_at', { ascending: false }).limit(25);
  const coIds = Array.from(new Set((evs || []).map((e) => String(e.company_id)).filter(Boolean)));
  const { data: cos } = coIds.length ? await sb.from('companies').select('id, company_name').in('id', coIds) : { data: [] as { id: string; company_name: string }[] };
  const coName = new Map((cos || []).map((c) => [String(c.id), String(c.company_name)]));
  const news = redactTimeline((evs || []).map((e) => ({ ...e, title: (coName.get(String(e.company_id)) || '') + ': ' + e.title })))
    .map((e) => '· ' + String(e.title).slice(0, 160)).join('\n');
  const facts = 'توجيه المنصة لليوم (الحقائق — لا تُضف عليها اسماً ولا رقماً):\n' + b.body
    + (ctx?.length ? '\n\nتوجيهات الدكتور القائمة لها (اجعل ما يخصّ اليوم منها مهاماً واضحة في مكانها من الأولوية، ولا تكرّر القواعد الثابتة كلها كل يوم — يكفي ما يمسّ مهام اليوم):\n' + ctx.map((c) => '· ' + c.note).join('\n') : '')
    + (news ? '\n\nما استجدّ على الملفات منذ آخر يوم عمل (للسياق — استعمل منه ما يخصّ مرحلتها فقط):\n' + news : '')
    + (verbatim.length ? '\n\nتنبيه: فوق توجيهك تُوضع «مهمة اليوم الأولى» بنصٍّ كتبه الدكتور بنفسه: ' + verbatim.map((v) => v.note).join(' · ')
      + ' — لا تذكرها في توجيهك أصلاً، واحذف من ترتيبك كل بندٍ عن الشخص أو المنشأة المذكورين فيها (فالرسالة تكفي اليوم).' : '')
    + '\n\nآخر يوم عمل (' + arDay(y) + '): ' + (mine ? 'سُجّل لها ' + mine.touches + ' عملاً على ' + mine.files + ' ملفاً' : 'لا شيء مسجّل لها')
    + (lastBrief ? (lastBrief.read_at ? '، وقرأت توجيه ذلك اليوم.' : '، ولم تضغط «قرأته» على توجيه ذلك اليوم.') : '.');
  const text = await askClaude(
    'أنت الدكتور عبدالحكيم المرضي، مالك مكتب «مُرضي» للاستشارات المالية، تكتب بنفسك توجيه الصباح لموظفتك. '
    + 'عربيٌّ فصيحٌ قريب، دافئٌ وحازم، موجزٌ (بين ١٥٠ و٣٢٠ كلمة). ابدأ «صباح الخير يا ' + (b.recipient === 'dhai' ? 'ضي' : 'رغد') + '». '
    + 'رتّب المهام بالأولوية: الأقرب إلى إغلاق أو دفع أولاً، وقل لماذا في نصف سطر. اذكر الأسماء كما وردت حرفياً. '
    + 'إن كان آخر يوم عملٍ لها بلا عملٍ مسجّل أو لم تقرأ توجيهه فنبّه بلطفٍ وحزم في سطر واحد، وإن عملت فاشكرها في نصف سطر. '
    + 'لا تذكر أي مبلغ أو سعر أو نسبة أو ما دفعه عميل. لا تستعمل كلمة «قرض» ولا «كفالة». لا تذكر أنك آلة أو برنامج. '
    + 'لا تضف مهمةً أو اسماً أو رقماً ليس في الحقائق أو توجيهات الدكتور. '
    + 'اذكر كل منشأة باسمها كما ورد حرفياً، ولا تفترض أبداً أن اسمين مختلفين منشأةٌ واحدة، ولا تنقل جهةً أو مهمةً من منشأة إلى أخرى — '
    + 'ملفٌّ في التوجيهات لم يرد في قائمة اليوم اذكره وحده بتوجيهه. واختم بسطرٍ واحد هو: د. عبدالحكيم المرضي\n\nحدود دورها: ' + RULES[b.recipient],
    facts, 4000);
  const out = text.trim().replace(/\*\*/g, '').replace(/^#+\s*/gm, '');
  const bad = FORBIDDEN.exec(out);
  const why = out.length < 200 ? 'قصير' : out.length > 3500 ? 'طويل'
    : !/د\.\s*عبدالحكيم المرضي\s*$/.test(out) ? 'بلا توقيع'
    : bad ? 'كلمة محظورة: ' + bad[0]
    : /[\d٠-٩][\d,٬.]*\s*(ألف|مليون)/.test(out) ? 'مبلغ' : '';
  return why ? { ...b, by: 'platform', why } : { ...b, body: out, by: 'claude' };
}

/**
 * ★ ٣ أكتوبر (بأمر المالك): «مهمة اليوم الأولى» بنصٍّ كتبه المالك ليُرسل بحرفه (واتساب) —
 * توضع بعد سطر التحية كما هي، خارج الصياغة والفحص (فيها ما أذن به المالك نفسه).
 */
async function withVerbatim(sb: SupabaseClient, b: Brief, today: string): Promise<Brief> {
  const { data } = await sb.from('brief_context').select('note, message').eq('active', true).not('message', 'is', null)
    .in('audience', [b.recipient, 'both']).lte('starts_on', today).or('expires_on.is.null,expires_on.gte.' + today).order('id');
  if (!data?.length) return b;
  const block = data.map((v, i) => (data.length > 1 ? 'مهمة اليوم ' + (i + 1) + ' — ' : 'مهمة اليوم الأولى — ') + v.note + ':\n\n'
    + '———\n' + String(v.message).trim() + '\n———').join('\n\n');
  const lines = b.body.split('\n');
  const head = lines.shift() || '';
  return { ...b, body: head + '\n\n' + block + '\n\n' + lines.join('\n').replace(/^\n+/, ''), items: b.items + data.length };
}

export async function buildBriefs(sb: SupabaseClient, today = riyadhDate()): Promise<Brief[]> {
  const base = await Promise.all([dhaiBrief(sb, today), raghadBrief(sb, today)]);
  const written = await Promise.all(base.map((b) => polish(sb, b, today).catch((e) => ({ ...b, by: 'platform' as const, why: e instanceof Error ? e.message : String(e) }))));
  return Promise.all(written.map((b) => withVerbatim(sb, b, today)));
}
