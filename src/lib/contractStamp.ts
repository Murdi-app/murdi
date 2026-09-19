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

import { LICENCE_NO, CR_NO } from './legalStance';

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

const stampBlock = (): string =>
  STAMP_IMAGE_URL
    ? `<img src="${STAMP_IMAGE_URL}" alt="ختم المكتب" style="width:168px;height:168px;object-fit:contain">`
    : stampSvg();

/**
 * يلفّ نصّ العقد بترويسةٍ وختم. والختم يُوضع عند توقيع الطرف الأول —
 * حيث يبحث عنه القارئ — لا في أعلى الصفحة ولا في هامشها.
 */
export function contractHtml(body: string, title = 'عقد الخدمة'): string {
  const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const MARK = '\u0000STAMP\u0000';

  // موضع الختم: سطر توقيع الطرف الأول. وإن لم يوجد، ذُيّل به العقد.
  let text = esc(String(body || ''));
  const sig = /^(الطرف الأول: .*\n?التوقيع: .*)$/m;
  text = sig.test(text) ? text.replace(sig, '$1\n' + MARK) : text + '\n' + MARK;

  const [before, after] = text.split(MARK);

  return `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} — مُرضي</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap" rel="stylesheet">
<style>
@page{size:A4;margin:16mm 15mm}
*{box-sizing:border-box}
body{margin:0;font-family:Cairo,system-ui,sans-serif;color:#12302A;background:#F4F7F6;padding:26px 14px 60px}
.sheet{max-width:860px;margin:0 auto;background:#fff;border:1px solid #E1EDE8;border-radius:14px;padding:30px 30px 34px}
.hd{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;border-bottom:2.5px solid #1A3D34;padding-bottom:12px;margin-bottom:18px}
.nm{font-size:17px;font-weight:900;color:#1A3D34;line-height:1.5}
.sub{font-size:11.5px;color:#93A9A1;line-height:1.85;margin-top:3px}
.doc{white-space:pre-wrap;line-height:2;font-size:14px}
.stamp{margin:14px 0 4px}
.ft{margin-top:22px;padding-top:10px;border-top:1px solid #EFF5F2;font-size:10.5px;color:#A3B7B0;text-align:center;line-height:1.9}
@media print{body{background:#fff;padding:0}.sheet{border:0;border-radius:0;padding:0;max-width:none}}
</style></head><body><div class="sheet">
<div class="hd">
  <div>
    <div class="nm">شركة حلول المرضي للاستشارات المالية</div>
    <div class="sub">سجل تجاري ${CR_NO} · ترخيص المستشار ${LICENCE_NO}<br>الرياض — المملكة العربية السعودية</div>
  </div>
  <div class="sub" style="text-align:left">partners@murdi.sa<br>murdi.sa</div>
</div>
<div class="doc">${before}</div>
<div class="stamp">${stampBlock()}</div>
<div class="doc">${after || ''}</div>
<div class="ft">وثيقة صادرة عن شركة حلول المرضي للاستشارات المالية · سرية بين طرفيها</div>
</div></body></html>`;
}
