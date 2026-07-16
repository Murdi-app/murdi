// قالب تصدير القوائم المالية PDF بترويسة مُرضي
export function buildPdfHtml(title: string, body: string): string {
  const safe = body.replace(/</g, '&lt;').replace(/\n/g, '<br/>')
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
