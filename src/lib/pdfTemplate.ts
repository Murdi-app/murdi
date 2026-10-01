// قالب تصدير القوائم المالية PDF بترويسة مُرضي

// ★ هوية مُرضي في المستندات — مصدرٌ واحد للترويسة وألوانها وخطّها، تقرؤه
//   القوائم والاستشارات (`buildPdfHtml`) والعقود وسندات الخدمة (`contractHtml`).
export const MURDI_FONT_IMPORT = "@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap');";
export const MURDI_HEAD_CSS =
  '.hd { text-align: center; border-bottom: 3px solid #2E9E7B; padding-bottom: 16px; margin-bottom: 24px; }'
  + '.hd .n { font-size: 30px; font-weight: 900; color: #2E9E7B; }'
  + '.hd .s { font-size: 13px; color: #6B8A80; margin-top: 4px; }'
  + '.hd .c { font-size: 12px; color: #9DB3AB; margin-top: 8px; }';
// ★ ١ أكتوبر (بأمر المالك): كل نصٍّ لاتيني داخل سطر عربي (البريد · FL-… · الروابط)
//   يُعزل اتجاهياً فلا يقفز في الجملة. والعزل على **نصوص** الوثيقة وحدها: تُحمى
//   كتل style وscript والوسوم، ولا يُعاد عزل ما هو داخل <bdi>.
// الكيانات المهرَّبة (&amp; &nbsp; &#1234;) تُطابَق أولاً وتُترك كما هي — وإلا انكسرت
const LATIN_RUN = /&[A-Za-z0-9#]+;|[A-Za-z0-9@._\-\/:+?=%]*[A-Za-z][A-Za-z0-9@._\-\/:+?=%]*/g;
/** يعزل المقاطع اللاتينية في نصٍّ مهرَّب (بلا وسوم) */
export function isoLatin(text: string): string {
  return text.replace(LATIN_RUN, (m) => (m.startsWith('&') && m.endsWith(';') ? m : '<bdi dir="ltr">' + m + '</bdi>'));
}
/** يعزل المقاطع اللاتينية في نصوص وثيقة HTML كاملة — لا في وسومها ولا أنماطها ولا سكربتها */
export function isolateLatinHtml(html: string): string {
  const kept: string[] = [];
  const guarded = html.replace(/<(style|script|title|head)\b[\s\S]*?<\/\1>/gi, (m) => { kept.push(m); return '\u0000' + (kept.length - 1) + '\u0000'; });
  let inBdi = 0;
  const out = guarded.replace(/(<[^>]*>)|([^<]+)/g, (m, tag: string | undefined, text: string | undefined) => {
    if (tag) {
      if (/^<bdi\b/i.test(tag)) inBdi++;
      else if (/^<\/bdi>/i.test(tag)) inBdi = Math.max(0, inBdi - 1);
      return tag;
    }
    return inBdi ? String(text) : isoLatin(String(text));
  });
  return out.replace(/\u0000(\d+)\u0000/g, (_, i) => kept[Number(i)]);
}

/** الترويسة: الاسم، والشركة، ثم السجل والترخيص في سطر، والبريد في سطرٍ مستقل */
export function murdiHeader(): string {
  return '<div class="hd">\n  <div class="n">مُرضي</div>\n  <div class="s">منصة جاهزية رأس المال</div>\n'
    + '  <div class="c">شركة حلول المرضي للاستشارات المالية · حي الربيع، الرياض</div>\n'
    + '  <div class="c">سجل تجاري 7039663724 · ترخيص المستشار رقم <bdi dir="ltr">FL-457927015</bdi></div>\n'
    + '  <div class="c"><bdi dir="ltr">partners@murdi.sa</bdi></div>\n</div>';
}

export function buildPdfHtml(title: string, body: string): string {
  // تنظيف قبل التحويل: احذف الحقول التقنية الخام، وحوّل ماركداون المتبقي أينما ظهر
  body = (body||'')
    .replace(/\[\[TABLES\]\]/g, '')
    .replace(/\([a-zA-Z_]+\s*=\s*(?:true|false)\)/g, '')
    .replace(/[a-zA-Z_]+\s*=\s*(?:true|false)/g, '')
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/(^|\s)###\s+/g, '$1')
    .replace(/(^|\s)##\s+/g, '$1')
    .replace(/\s*---\s*/g, ' ')
  // تنظيف قبل التحويل: احذف الحقول التقنية الخام، وحوّل ماركداون المتبقي أينما ظهر
  body = (body||'')
    .replace(/\([a-zA-Z_]+\s*=\s*(?:true|false)\)/g, '')
    .replace(/[a-zA-Z_]+\s*=\s*(?:true|false)/g, '')
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/(^|\s)###\s+/g, '$1')
    .replace(/(^|\s)##\s+/g, '$1')
    .replace(/\s*---\s*/g, ' ')
  // نحوّل Markdown البسيط لـHTML، ونترك وسوم HTML (الجداول) كما هي دون تهريب
  const lines = body.split('\n')
  let html = ''
  let inHtmlBlock = false
  for (const ln of lines) {
    const t = ln.trim()
    // أسطر داخل كتل HTML (تبدأ بوسم) تُترك كما هي
    if (t.startsWith('<')) { inHtmlBlock = true }
    if (inHtmlBlock) {
      html += ln + '\n'
      if (t.endsWith('>') && (t.startsWith('</div') || t.startsWith('</table'))) inHtmlBlock = false
      continue
    }
    if (t.startsWith('## ')) { html += '<h2 style=\"color:#1A3D34\">' + t.slice(3) + '</h2>\n'; continue }
    if (t.startsWith('# ')) { html += '<h1 style=\"color:#1A3D34\">' + t.slice(2) + '</h1>\n'; continue }
    if (t.startsWith('- ')) { html += '<li>' + t.slice(2).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>') + '</li>\n'; continue }
    if (t === '---') { html += '<hr style=\"border:none;border-top:1px solid #EAF2EE;margin:16px 0\">\n'; continue }
    if (t === '') { html += '<br/>\n'; continue }
    html += '<p style=\"margin:6px 0\">' + t.replace(/\*\*(.+?)\*\*/g,'<b>$1</b>') + '</p>\n'
  }
  const safe = isolateLatinHtml(html)
  return `<!doctype html><html dir="rtl"><head><meta charset="utf-8"><title>${title}</title>
<style>
${MURDI_FONT_IMPORT}
body { font-family: Cairo, sans-serif; color: #1A3D34; padding: 40px; line-height: 2; }
${MURDI_HEAD_CSS}
@media print { body { padding: 20px; } }
</style></head><body>
${murdiHeader()}
<div>${safe}</div>
<script>window.onload = () => window.print()</script>
</body></html>`
}
