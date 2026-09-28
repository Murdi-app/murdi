// مفردة `outreach_messages.reply_status` — حالُ الباب بعد أن طُرق.
//
// ★ كانت ثلاث مفرداتٍ لعمودٍ واحد: لوحة المتابعة تكتب docs|call|deflect|declined،
//   ولوحة المخاطبة تكتب replied|declined|closed|awaiting، ودورةُ التذكير لا
//   تعدّ «مُجاباً» إلا replied|call. فالجهة التي طلبت أوراقاً (docs) أو اعتذرت
//   (declined) من لوحة المتابعة كانت تُدرج غداً في «أبواب ساكتة، ذكّرها» —
//   أي يُلاحَق من أجاب، وهو ما نهى عنه المالك بنصّه («لا إلحاح»).
//   وكان الإرسال يكتب `awaiting`، واللوحة تعدّ «ينتظر التصنيف» الفراغَ وحده،
//   فالردّ على رسالةٍ مرسلة لا يظهر في «ردود وصلت» أبداً.
//   فصار التعريف هنا، وتستورده المسارات كلها ودورةُ التذكير.

/** لم يُجب بعد — والفراغ مثله (صفوف قديمة قبل أن يُكتب `awaiting`) */
export const AWAITING = 'awaiting';

/** ما يُصنَّف به ردٌّ وصل، من لوحة المتابعة */
export const TRIAGE_KINDS = ['docs', 'call', 'deflect', 'declined'] as const;

/** ما تكتبه لوحة المخاطبة */
export const MANAGE_KINDS = ['replied', 'declined', 'closed', AWAITING] as const;

/** كل قيمةٍ مقبولة في العمود */
export const REPLY_STATUSES = Array.from(new Set<string>([...TRIAGE_KINDS, ...MANAGE_KINDS, 'bounced']));

/** أجاب الباب — بأي صورة. ومن أجاب لا يُطرق ثانيةً أبداً. */
export const ANSWERED = new Set<string>(['replied', 'call', 'docs', 'deflect', 'declined', 'closed']);

/** لم يُجب بعد؟ */
export const isAwaiting = (s: unknown): boolean => {
  const v = String(s ?? '').trim();
  return v === '' || v === AWAITING;
};
