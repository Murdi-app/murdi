// مولّد ملف غرض التمويل.
// ملف SK أخذ يوماً كاملاً بخطّ اليد؛ والعاشر يجب أن يأخذ دقيقة. ومدخلاته كلها
// موجودة أصلاً في financial_data — فالمنصة كانت تُخرج تقريراً للعميل ولا تُخرج
// البضاعة التي تُباع للممول. هذا الملف يسدّ تلك الفجوة.
//
// القاعدة الحاكمة هنا: لا يُخترع رقم. ما ليس في القاعدة يُكتب «غير مسجّل»
// ويظهر في قائمة النواقص — لأن رقماً مخترعاً في ملف ائتماني يُسقط الملف كله.

export type MemoCompany = {
  company_name?: string | null; cr_number?: string | null; city?: string | null;
  sector?: string | null; owner_name?: string | null;
};

export type MemoFin = Record<string, unknown>;

const n = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
};
const money = (v: unknown): string => {
  const x = n(v);
  return x === null ? '—' : x.toLocaleString('en-US');
};
const esc = (s: unknown): string =>
  String(s ?? '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string));
const yes = (v: unknown) => v === true || v === 'true' || v === 'نعم';

/** ما ينقص الملف — يُعرض للمالك لا للممول */
export function memoGaps(f: MemoFin): string[] {
  const g: string[] = [];
  if (n(f.annual_revenue) === null) g.push('الإيراد السنوي غير مسجّل');
  if (n(f.net_profit) === null) g.push('صافي الربح غير مسجّل — وهو الرقم الذي تُحسب عليه تغطية خدمة الدين');
  if (n(f.requested_amount) === null) g.push('المبلغ المطلوب غير مسجّل');
  if (!f.audited_statements && !f.external_auditor) g.push('حالة تدقيق القوائم غير مؤكدة — تفصل بين مسار البنوك ومسار المنصات');
  if (!f.major_buyers) g.push('العملاء الرئيسيون غير مسجّلين — وهم أقوى ورقة في تمويل الفواتير');
  if (!f.collection_cycle) g.push('دورة التحصيل غير مسجّلة');
  if (!f.has_collateral) g.push('الضمانات المتاحة غير مسجّلة');
  if (n(f.employee_count) === null) g.push('عدد الموظفين غير مسجّل — يُسأل عنه في نماذج كفالة');
  return g;
}

/** تغطية خدمة الدين — تقدير محافظ يُعلن أنه تقدير */
export function dscr(f: MemoFin, years = 4, cost = 0.08): { service: number; ratio: number } | null {
  const profit = n(f.net_profit);
  const amount = n(f.requested_amount);
  if (profit === null || amount === null || amount <= 0) return null;
  const newService = (amount * (1 + cost * years)) / years;
  const existing = (n(f.monthly_installment) ?? 0) * 12;
  const service = newService + existing;
  if (service <= 0) return null;
  return { service: Math.round(service), ratio: Math.round((profit / service) * 100) / 100 };
}

export function buildCreditMemo(c: MemoCompany, f: MemoFin): string {
  const rev = n(f.annual_revenue);
  const profit = n(f.net_profit);
  const req = n(f.requested_amount);
  const margin = rev && profit ? Math.round((profit / rev) * 1000) / 10 : null;
  const cover = dscr(f);
  const gaps = memoGaps(f);
  const noDebt = f.has_debt === 'false' || f.has_debt === false;
  const askPct = rev && req ? Math.round((req / rev) * 100) : null;

  // رأس المال العامل المحتجز — هو الردّ على اعتراض «المبلغ نسبة عالية من الإيراد»
  // ملاحظة: لا يوجد عمود للمخزون في القاعدة، فلا يُقحَم رقم مخزون هنا بالتخمين.
  // المحتجز = الذمم المدينة التقديرية وحدها، ويُقال ذلك صراحةً في النصّ.
  const cycle = n(f.collection_cycle);
  const receivables = rev && cycle ? Math.round((rev * cycle) / 365) : null;
  const tied = receivables;

  const row = (label: string, val: string) =>
    `<tr><td>${esc(label)}</td><td class="n">${val}</td></tr>`;

  const stat = (v: string, l: string) =>
    `<div class="st"><b>${v}</b><span>${esc(l)}</span></div>`;

  return `<div class="doc" dir="rtl">
  <div class="eyebrow">مُرضي · حلول المرضي للاستشارات المالية · ترخيص FL-457927015</div>
  <h1>ملف غرض التمويل<br>${esc(c.company_name || 'منشأة')}</h1>
  <p class="lede">${[c.cr_number ? 'سجل تجاري ' + esc(c.cr_number) : '', esc(c.city || ''),
      esc(String(f.years_operating ?? '') ? f.years_operating + ' سنوات تشغيل' : '')]
      .filter(Boolean).join(' · ')}</p>

  <h2>الملخّص التنفيذي</h2>
  <div class="grid">
    ${stat(money(rev), 'الإيراد السنوي (ريال)')}
    ${stat(money(profit) + (margin !== null ? ` <i>${margin}٪</i>` : ''), 'صافي الربح')}
    ${stat(noDebt ? 'صفر' : money(f.total_debt), 'الالتزامات القائمة')}
    ${stat(cover ? cover.ratio + '×' : '—', 'تغطية خدمة الدين (تقديرية)')}
  </div>

  <p><b>المطلوب:</b> ${money(req)} ريال${askPct !== null ? ` — أي ${askPct}٪ من الإيراد السنوي` : ''}.</p>
  ${f.funding_purpose ? `<div class="key"><div class="q">الغرض كما ذكره العميل</div><div class="a">${esc(f.funding_purpose)}</div></div>` : ''}

  <h2>١ · نقاط القوة</h2>
  <ul>
    ${noDebt ? '<li><b>خلوّ من الديون</b> — طاقة الاستيعاب الائتماني كاملة غير مستهلكة، وهو وضع نادر في هذا الحجم ويُبرَز في الصفحة الأولى لا في الملاحق.</li>' : ''}
    ${margin !== null && margin >= 15 ? `<li><b>هامش صافٍ ${margin}٪</b> — أعلى من معتاد القطاع. <b>ولا يُنطق أمام لجنة ائتمان قبل أن تسنده قائمة معتمدة</b>، وإلا انقلب من ورقة قوة إلى سؤال محرج.</li>` : ''}
    ${f.major_buyers ? `<li><b>جودة المدينين</b> — ${esc(String(f.major_buyers).slice(0, 320))}.<br>وهذا يقلب معادلة التمويل: في تسييل الفواتير يُسعَّر التمويل على ائتمان المدين لا على ائتمان المورّد.</li>` : ''}
    ${yes(f.zakat_compliant) && yes(f.tax_compliant) ? '<li><b>الالتزام النظامي مكتمل</b> — الزكاة والضريبة مسدّدتان والسجل ساري، فلا عائق نظامي أمام أي جهة.</li>' : ''}
    ${yes(f.issues_invoices) ? '<li>فوترة إلكترونية قائمة — شرط أساسي لأي تمويل مربوط بالفواتير.</li>' : ''}
  </ul>

  <h2>٢ · أين تقف السيولة</h2>
  <table>
    <tr><th>البند</th><th style="text-align:left">ريال</th></tr>
    ${row('الإيراد السنوي', money(rev))}
    ${row('صافي الربح', money(profit))}
    ${receivables !== null ? row(`الذمم المدينة التقديرية (دورة ${cycle} يوماً)`, '≈ ' + money(receivables)) : ''}
    ${row('المبلغ المطلوب', money(req))}
  </table>
  ${tied !== null
      ? `<div class="key"><div class="a">هذا الرقم هو مفتاح الردّ على أول اعتراض: «المبلغ نسبة عالية من الإيراد». فالسيولة محتجزة فعلاً في الذمم بمقدار ≈ ${money(tied)} ريال${req !== null && req < tied ? '، والطلب دونه — أي تمويل محافظ لا متجاوز' : ''}. <b>ويُضاف إليه المخزون إن وُجد — وهو غير مسجّل في القاعدة فلا يُقدَّر بالتخمين.</b></div></div>`
      : ''}

  <h2>٣ · تغطية خدمة الدين</h2>
  ${cover
      ? `<p>على تقدير محافظ (${money(req)} ريال لأربع سنوات بكلفة ٨٪ سنوياً${n(f.monthly_installment) ? ' مضافاً إليه القسط القائم' : ''}):
         خدمة دين سنوية <b>${money(cover.service)}</b> ريال مقابل ربح صافٍ <b>${money(profit)}</b> ريال،
         أي تغطية <b>${cover.ratio}×</b> — والحدّ البنكي المعتاد ١.٢٥×.</p>
         <p class="mini">تقدير للتفاوض لا رقم نهائي؛ الكلفة والمدة الفعليتان تُحدَّدان بعرض الجهة.</p>`
      : '<p class="mini">لا يمكن حسابها — صافي الربح أو المبلغ المطلوب غير مسجّل.</p>'}

  <h2>٤ · الضمانات</h2>
  <p>${f.has_collateral ? esc(String(f.has_collateral)) : 'غير مسجّلة — تُستكمل قبل التقديم.'}</p>

  <h2>٥ · الاعتراضات المتوقعة</h2>
  ${askPct !== null && askPct > 30
      ? `<div class="obj"><div class="q">«المطلوب ${askPct}٪ من الإيراد — نسبة مرتفعة»</div>
         <div class="a">${tied !== null ? 'رأس المال العامل المحتجز فعلياً ≈ ' + money(tied) + ' ريال، فالطلب دونه.' : 'يُقسَّم الطلب على أدوات، فيُقاس كل مبلغ على ضمانه لا على الإيراد.'} والتمويل المربوط بالفواتير ذاتيّ التسييل ولا يُقاس بهذه النسبة أصلاً.</div></div>`
      : ''}
  ${n(f.years_operating) !== null && (n(f.years_operating) as number) < 5
      ? `<div class="obj"><div class="q">«المنشأة عمرها ${f.years_operating} سنوات»</div>
         <div class="a">فوق حدّ السنتين لدى أغلب الجهات. وإن تمسّك البنك بالعمر فالمسار البديل جاهز: منصات تمويل الفواتير المرخّصة من ساما لا تشترط أكثر من سنة.</div></div>`
      : ''}
  ${yes(f.has_parent_company) && !yes(f.parent_can_guarantee)
      ? `<div class="obj"><div class="q">«توجد شركة أمّ — فلماذا لا تضمن؟»</div>
         <div class="a">تُقال بمبادرة منّا قبل أن تُكتشف منهم: لا ضمان بنكياً من الشركة الأم، والكيان السعودي يقف بذاته. المبادرة تحوّلها من ثغرة مكتشَفة إلى شفافية محسوبة.</div></div>`
      : ''}

  ${gaps.length ? `<h2>٦ · ما ينقص الملف <span class="mini">(للمالك — لا يُرسل للممول)</span></h2>
    <div class="stop"><ul>${gaps.map((g) => `<li>${esc(g)}</li>`).join('')}</ul></div>` : ''}

  <div class="foot">أُعدّ لصالح ${esc(c.company_name || '')} · وثيقة سرّية لا تُتداول خارج أطرافها · ${new Date().toLocaleDateString('ar-SA')}</div>
</div>`;
}

export const MEMO_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap');
*{box-sizing:border-box}
body{margin:0;background:#F4F7F6;font-family:Cairo,system-ui,sans-serif;color:#12302A;line-height:1.95;padding:20px 14px 50px}
.doc{max-width:820px;margin:0 auto;background:#fff;border:1px solid #E1EDE8;border-radius:16px;padding:28px 26px}
.eyebrow{font-size:11px;letter-spacing:.12em;color:#9DB3AB;font-weight:900}
h1{font-size:24px;margin:6px 0 4px;line-height:1.5}
h2{font-size:17px;margin:28px 0 10px;padding-bottom:7px;border-bottom:2px solid #EDF4F1}
p{font-size:13.8px;margin:0 0 11px}
.lede{font-size:13.5px;color:#5E7C73}
.mini{font-size:11.5px;color:#9DB3AB;font-weight:400}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:9px;margin:14px 0}
.st{background:#F7FAF9;border:1px solid #E7F1ED;border-radius:11px;padding:12px 14px}
.st b{display:block;font-size:19px;font-weight:900;line-height:1.4}
.st b i{font-size:13px;color:#1A6B52;font-style:normal}
.st span{font-size:11.5px;color:#6B8A80;font-weight:700}
table{width:100%;border-collapse:collapse;font-size:13px;margin:10px 0}
th{text-align:right;background:#F4F8F6;padding:8px 11px;font-size:11.5px;color:#406057;font-weight:900}
td{padding:8px 11px;border-bottom:1px solid #EFF5F2}
td.n{text-align:left;font-weight:900;white-space:nowrap;font-variant-numeric:tabular-nums}
ul{font-size:13.5px;padding-inline-start:20px}
li{margin-bottom:8px}
.key{background:#F6FAF8;border-right:4px solid #2E9E7B;border-radius:9px;padding:12px 15px;margin:12px 0;font-size:13.3px}
.stop{background:#FDF1EC;border-right:4px solid #B4622A;border-radius:9px;padding:8px 15px;margin:12px 0;font-size:13.3px}
.obj{border:1px solid #E7F1ED;border-radius:11px;padding:13px 16px;margin-bottom:10px;background:#FCFDFD}
.q{font-weight:900;margin-bottom:3px;font-size:13.4px}
.a{font-size:13.2px;color:#33544B}
.foot{font-size:11.5px;color:#9DB3AB;text-align:center;padding-top:16px;margin-top:18px;border-top:1px solid #EFF5F2}
@media print{body{background:#fff;padding:0}.doc{border:none;border-radius:0;padding:0}}
`;
