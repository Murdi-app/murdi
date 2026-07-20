// قالب تصدير القوائم المالية PDF بترويسة مُرضي
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
  const safe = html
  return `<!doctype html><html dir="rtl"><head><meta charset="utf-8"><title>${title}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap');
body { font-family: Cairo, sans-serif; color: #1A3D34; padding: 40px; line-height: 2; }
.hd { text-align: center; border-bottom: 3px solid #2E9E7B; padding-bottom: 16px; margin-bottom: 24px; }
.hd .n { font-size: 30px; font-weight: 900; color: #2E9E7B; }
.hd .s { font-size: 13px; color: #6B8A80; margin-top: 4px; }
.hd .c { font-size: 12px; color: #9DB3AB; margin-top: 8px; }
@media print { body { padding: 20px; } }
</style></head><body>
<div class="hd">
  <div class="n">مُرضي</div>
  <div class="s">منصة جاهزية رأس المال</div>
  <div class="c">شركة حلول المرضي للاستشارات المالية · حي الربيع، الرياض</div>
</div>
<div>${safe}</div>
<script>window.onload = () => window.print()</script>
</body></html>`
}
