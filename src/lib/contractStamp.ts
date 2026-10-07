// ختم المكتب وترويسة العقد.
//
// كان العميل يفتح العقد فيرى نصاً خاماً على صفحةٍ بيضاء: بلا ترويسة، بلا
// ختم، بلا ما يقول إن هذه وثيقة مكتبٍ مرخَّص. وطلبنا منه أن يوقّع ويختم
// ونحن نرسل له ما لا يحمل ختمنا — فيُقرأ العقد أضعف مما هو، وهو في لحظةٍ
// كل ما فيها يزيد ثقةً أو ينقصها.
//
// والختم هنا مرسومٌ بـSVG لا صورة: يطبع حادّاً في أي مقاس، ولا يحتاج ملفاً
// يُرفع ولا رابطاً قد ينكسر، وبياناته تُقرأ من مصدرٍ واحد فلا تتناقض مع
// العقد الذي هو فوقه. ومن أراد وضع ختمه المصوَّر بدلاً منه فموضعُه
// `STAMP_IMAGE_URL` وحده.

import { LICENCE_NO, CR_NO, ADVISOR_LINE, ADVISOR_LINE_EN } from './legalStance';
import { MURDI_FONT_IMPORT, MURDI_HEAD_CSS, murdiHeader, isoLatin } from './pdfTemplate';
import { CONTRACT_DATE_LINE, CONTRACT_DATE_LINE_EN } from './contracts';

/** ختمٌ مصوَّر إن وُجد — وإلا رُسم الختم أدناه */
export const STAMP_IMAGE_URL = '';

const INK = '#1A6B55';

/** ختم المكتب — دائريٌّ بحلقتين، اسم الشركة دائراً حول أعلاه وسجلّها أسفله */
export function stampSvg(size = 168): string {
  const s = size;
  return `<svg width="${s}" height="${s}" viewBox="0 0 220 220" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="ختم حلول المرضي للاستشارات المالية">
  <defs>
    <path id="mrd-top" d="M 110,110 m -84,0 a 84,84 0 1,1 168,0" fill="none"/>
    <path id="mrd-bot" d="M 110,110 m -80,0 a 80,80 0 1,0 160,0" fill="none"/>
  </defs>
  <g fill="none" stroke="${INK}">
    <circle cx="110" cy="110" r="101" stroke-width="3"/>
    <circle cx="110" cy="110" r="94" stroke-width="1.6"/>
    <circle cx="110" cy="110" r="62" stroke-width="1.6"/>
  </g>
  <text font-family="Cairo, system-ui, sans-serif" font-weight="700" font-size="13.5" fill="${INK}">
    <textPath href="#mrd-top" startOffset="50%" text-anchor="middle">حلول المرضي للاستشارات المالية</textPath>
  </text>
  <text font-family="Cairo, system-ui, sans-serif" font-weight="700" font-size="12" fill="${INK}">
    <textPath href="#mrd-bot" startOffset="50%" text-anchor="middle">سجل تجاري ${CR_NO}</textPath>
  </text>
  <g stroke="${INK}" stroke-width="2" stroke-linecap="round">
    <line x1="14" y1="110" x2="26" y2="110"/>
    <line x1="194" y1="110" x2="206" y2="110"/>
  </g>
  <text x="110" y="104" text-anchor="middle" font-family="Cairo, system-ui, sans-serif" font-weight="900" font-size="23" fill="${INK}">مُرضي</text>
  <text x="110" y="126" text-anchor="middle" font-family="Cairo, system-ui, sans-serif" font-weight="700" font-size="10.5" fill="${INK}">ترخيص ${LICENCE_NO}</text>
  <text x="110" y="144" text-anchor="middle" font-family="Cairo, system-ui, sans-serif" font-weight="700" font-size="10" fill="${INK}">الرياض</text>
</svg>`;
}

const stampBlock = (size = 168): string =>
  STAMP_IMAGE_URL
    ? `<img src="${STAMP_IMAGE_URL}" alt="ختم المكتب" style="width:${size}px;height:${size}px;object-fit:contain">`
    : stampSvg(size);

/**
 * توقيع المستشار وختم المكتب في آخر كل دراسة تُسلَّم وكل ملف تمويل (بأمر المالك،
 * ٢٧ سبتمبر). وملف التمويل قد يخرج بالإنجليزية لجهة دولية، فللكتلة لغتان.
 *
 * وكان كل مولّدٍ يكتب توقيعه بيده — الجدوى والحكم الائتماني وملف العقد —
 * بصيغة ترخيصٍ غير المعتمدة، وبلا ختم. فصار هنا وحده، وتستورده المولّدات:
 * من غيّر الختم أو الصيغة غيّرها في كل دراسة معاً. والأنماط مضمّنة لأن
 * الكتلة تُزرع في وثائق لكلٍّ منها ورقة أنماطه.
 */
export function studySeal(lang: 'ar' | 'en' = 'ar'): string {
  const en = lang === 'en';
  return `<div style="display:flex;align-items:center;justify-content:space-between;gap:18px;margin-top:30px;padding-top:14px;border-top:2px solid #EDF4F1;break-inside:avoid;page-break-inside:avoid">
  <div style="line-height:1.9">
    <div style="font-size:15px;font-weight:900;color:#1A3D34">${en ? 'Dr. Abdulhakim Almurdi' : 'د. عبدالحكيم المرضي'}</div>
    <div style="font-size:12px;color:#5E7C73;font-weight:700">${en
      ? ADVISOR_LINE_EN + '<br>Holol Almurdi Financial Consulting · CR ' + CR_NO
      : isoLatin(ADVISOR_LINE) + '<br>حلول المرضي للاستشارات المالية · سجل تجاري ' + CR_NO}</div>
  </div>
  <div style="flex:0 0 auto">${stampBlock(128)}</div>
</div>`;
}

/**
 * يلفّ نصّ العقد بترويسةٍ وختم. والختم يُوضع عند توقيع الطرف الأول —
 * حيث يبحث عنه القارئ — لا في أعلى الصفحة ولا في هامشها.
 */
/** توقيع الموقّع الإلكتروني — يُطبع تحت العقد إن وُقّع من المنصة */
export type ContractSignature = { name: string; idNumber: string; at: string };

/** «حُرّر في: ١٠/٠٤/١٤٤٨هـ الموافق ٠١/١٠/٢٠٢٦م» — هجري أم القرى وميلادي بتوقيت الرياض */
export function writtenOn(at: string | Date): string {
  const d = new Date(at);
  const fmt = (cal: string) => new Intl.DateTimeFormat('ar-SA-u-ca-' + cal + '-nu-arab', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Riyadh' }).formatToParts(d);
  const part = (p: Intl.DateTimeFormatPart[], t: string) => p.find((x) => x.type === t)?.value || '';
  const h = fmt('islamic-umalqura'), g = fmt('gregory');
  return 'حُرّر في: ' + part(h, 'day') + '/' + part(h, 'month') + '/' + part(h, 'year') + 'هـ الموافق '
    + part(g, 'day') + '/' + part(g, 'month') + '/' + part(g, 'year') + 'م';
}

export function contractHtml(body: string, title = 'عقد الخدمة', signer?: ContractSignature | null): string {
  const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const en = /^[A-Za-z]/.test(String(body || '').trim());
  const signedNote = signer
    ? (en
      ? '<div class="doc" dir="ltr" style="margin-top:14px;padding:10px 14px;border:1.5px solid #2E9E7B;border-radius:10px;font-size:13px;text-align:left">'
        + 'Signed electronically by the Second Party via the Murdi platform: ' + esc(signer.name) + ' · ID/Iqama ' + esc(signer.idNumber)
        + ' · ' + esc(new Date(signer.at).toLocaleString('en-GB', { timeZone: 'Asia/Riyadh' })) + '</div>'
      : '<div class="doc" style="margin-top:14px;padding:10px 14px;border:1.5px solid #2E9E7B;border-radius:10px;font-size:13px">'
        + 'وقّعه الطرف الثاني إلكترونياً عبر منصة مُرضي: ' + esc(signer.name) + ' · هوية رقم ' + esc(signer.idNumber)
        + ' · ' + esc(new Date(signer.at).toLocaleString('ar-SA', { timeZone: 'Asia/Riyadh' })) + '</div>')
    : '';
  const MARK = '\u0000STAMP\u0000';

  // تاريخ التحرير يُعبّأ بتاريخ التوقيع الإلكتروني (هجري أم القرى + ميلادي) إن وُقّع من المنصة
  let src = String(body || '');
  if (signer) src = src.replace(CONTRACT_DATE_LINE, writtenOn(signer.at))
    .replace(CONTRACT_DATE_LINE_EN, 'Date: ' + new Date(signer.at).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Asia/Riyadh' }));

  // ★ ١ أكتوبر (بأمر المالك): عنوان الوثيقة في الوسط عريضاً، و«حُرّر في» تحته أصغر.
  //   السطر الأول عنوانها، والثاني تاريخها إن بدأ بـ«حُرّر في».
  const lines = src.replace(/^\s+/, '').split('\n');
  const docTitle = lines.shift() || '';
  const dateLine = /^(حُرّر في|Date:)/.test(lines[0] || '') ? String(lines.shift()) : '';
  src = lines.join('\n').replace(/^\n+/, '');
  // ★ ٥ أكتوبر: وثيقةٌ إنجليزية (عميلٌ أجنبي) — عنوانها يبدأ بحرفٍ لاتيني ← من اليسار، بلا عزلٍ اتجاهي
  const ltr = /^[A-Za-z]/.test(docTitle.trim());
  const head = '<div class="ttl">' + (ltr ? esc(docTitle) : isoLatin(esc(docTitle))) + '</div>'
    + (dateLine ? '<div class="dt">' + esc(dateLine) + '</div>' : '');
  // موضع الختم: سطر توقيع الطرف الأول. وإن لم يوجد، ذُيّل به العقد.
  // والنص اللاتيني (FL-… · البريد · الروابط) يُعزل اتجاهياً بعد التهريب
  let text = ltr ? esc(src) : isoLatin(esc(src));
  const sig = /^(الطرف الأول: .*\n?التوقيع: .*)$/m;
  text = sig.test(text) ? text.replace(sig, '$1\n' + MARK) : text + '\n' + MARK;

  const [before, after] = text.split(MARK);

  // ★ ١ أكتوبر: بهوية مُرضي من مصدرها (`pdfTemplate`) — كانت للعقد ترويسةٌ خاصة به
  return `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} — مُرضي</title>
<style>
${MURDI_FONT_IMPORT}
@page{size:A4;margin:16mm 15mm}
*{box-sizing:border-box}
body{margin:0;font-family:Cairo,system-ui,sans-serif;color:#1A3D34;background:#F4F7F6;padding:26px 14px 60px}
.sheet{max-width:860px;margin:0 auto;background:#fff;border:1px solid #E1EDE8;border-radius:14px;padding:30px 30px 34px}
${MURDI_HEAD_CSS}
.doc{white-space:pre-wrap;line-height:2;font-size:14px}
.ttl{text-align:center;font-weight:900;font-size:21px;line-height:1.6;margin:6px 0 2px;color:#1A3D34}
.dt{text-align:center;font-size:12px;color:#5E7C73;margin-bottom:16px}
.stamp{margin:14px 0 4px}
.ft{margin-top:22px;padding-top:10px;border-top:1px solid #EFF5F2;font-size:10.5px;color:#A3B7B0;text-align:center;line-height:1.9}
@media print{body{background:#fff;padding:0}.sheet{border:0;border-radius:0;padding:0;max-width:none}}
</style></head><body><div class="sheet">
${murdiHeader()}
${head}
<div class="doc"${ltr ? ' dir="ltr" style="text-align:left"' : ''}>${before}</div>
<div class="stamp"${ltr ? ' style="text-align:left"' : ''}>${stampBlock()}</div>
<div class="doc"${ltr ? ' dir="ltr" style="text-align:left"' : ''}>${after || ''}</div>
${signedNote || ''}
<div class="ft">${ltr ? 'Issued by Holol Almurdi Financial Consulting (Murdi) · Confidential between the parties' : 'وثيقة صادرة عن شركة حلول المرضي للاستشارات المالية · سرية بين طرفيها'}</div>
</div></body></html>`;
}
