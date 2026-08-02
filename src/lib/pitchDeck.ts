type Slide = { title: string; bullets: string[]; pivot: string };

const BRK_END = /[═=]{3,}[^\n]*نهاية العرض[^\n]*/;
const BRK_NOTES = /[═=]{3,}[^\n]*ملاحظات المستشار[^\n]*/;

export function splitPitch(raw: string): { deck: string; notes: string } {
  const m = raw.match(BRK_END) || raw.match(BRK_NOTES);
  if (!m || m.index === undefined) return { deck: raw, notes: '' };
  return { deck: raw.slice(0, m.index), notes: raw.slice(m.index + m[0].length) };
}

const md = (t: string) =>
  t.replace(/^\s*#{1,6}\s*/, '')
   .replace(/\*\*(.+?)\*\*/g, '$1')
   .replace(/[*`]/g, '')
   .replace(/^\s*[-•·◆—]\s*/, '')
   .replace(/^الشريحة\s*\S{1,4}\s*[—:\-]\s*/, '')
   .trim();

const isRule = (l: string) => /^[-–—_*═=#\s]{2,}$/.test(l);

function parseSlides(deck: string): Slide[] {
  const parts = deck.split('[[SLIDE]]');
  const chunks = (parts.length > 1 ? parts.slice(1) : parts).map((c) => c.trim()).filter(Boolean);
  return chunks.map((c) => {
    const ls = c.split('\n').map((l) => l.trim()).filter((l) => l && !isRule(l)).map(md).filter(Boolean);
    const pIdx = ls.findIndex((l) => /^(الرقم المحوري|Key figure)/i.test(l));
    const pivot = pIdx >= 0 ? ls[pIdx].replace(/^(الرقم المحوري|Key figure)\s*:?\s*/i, '') : '';
    const body = ls.filter((_, k) => k !== pIdx);
    return { title: body[0] || '', bullets: body.slice(1), pivot };
  }).filter((s) => s.title);
}

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const dens = (s: Slide) => {
  const n = s.title.length + s.bullets.reduce((a, b) => a + b.length, 0);
  return n > 620 ? ' d3' : n > 430 ? ' d2' : '';
};

const SHELL = (dir: string, page: 'landscape' | 'portrait', body: string) => `<!doctype html><html dir="${dir}" lang="${dir === 'rtl' ? 'ar' : 'en'}"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap" rel="stylesheet">
<style>
@page { size: A4 ${page}; margin: 0 }
* { box-sizing: border-box; margin: 0; padding: 0 }
body { font-family:'Cairo','Segoe UI',Tahoma,sans-serif; background:${page === 'portrait' ? '#fff' : '#1A3D34'} }
.s { width:297mm; height:210mm; overflow:hidden; position:relative; page-break-after:always; background:#1A3D34; color:#fff; padding:20mm 24mm 18mm; display:flex; flex-direction:column; justify-content:center }
.s:last-child { page-break-after:auto }
.t { color:#C9A84C; font-weight:900; font-size:29pt; line-height:1.3; margin-bottom:5mm }
.k { color:#C9A84C; font-weight:900; font-size:17pt; line-height:1.5; border-inline-start:4px solid #C9A84C; padding-inline-start:6mm; margin-bottom:10mm }
.b { list-style:none; flex:none }
.b li { font-size:15pt; line-height:1.95; color:#EAF2EE; padding-inline-start:9mm; position:relative; margin-bottom:3mm }
.b li:before { content:'◆'; color:#C9A84C; position:absolute; inset-inline-start:0; font-size:9pt; top:5.5pt }
.n { position:absolute; bottom:9mm; inset-inline-end:24mm; color:#6B8A80; font-size:10pt; font-weight:700 }
.d2 .t { font-size:25pt; margin-bottom:7mm }
.d2 .b li { font-size:13pt; line-height:1.8; margin-bottom:2.5mm }
.d2 .k { font-size:15pt; margin-bottom:8mm }
.d3 .t { font-size:22pt; margin-bottom:6mm }
.d3 .b li { font-size:11.5pt; line-height:1.7; margin-bottom:2mm }
.d3 .k { font-size:13.5pt; margin-bottom:7mm }
.cv { justify-content:center; text-align:center }
.cv h1 { color:#fff; font-size:42pt; font-weight:900; margin-bottom:6mm }
.cv h2 { color:#C9A84C; font-size:19pt; font-weight:700; margin-bottom:14mm }
.cv .f { color:#9DB3AB; font-size:12pt }
.doc { background:#fff; color:#1A3D34; padding:16mm 18mm; font-size:12.5pt; line-height:1.95 }
.doc h1 { color:#1A3D34; font-size:21pt; margin-bottom:4mm }
.doc h2 { color:#9A7B2E; font-size:14.5pt; margin:7mm 0 3mm }
.doc li { list-style:none; padding-inline-start:6mm; position:relative; margin-bottom:2mm }
.doc li:before { content:'◆'; color:#C9A84C; position:absolute; inset-inline-start:0; font-size:8pt; top:5pt }
.doc .w { background:#FBF5E8; border:2px solid #E8D9A8; color:#8A6D1A; padding:5mm; border-radius:3mm; font-weight:900; margin-bottom:8mm }
</style></head><body>${body}</body></html>`;

export function buildDeckHTML(raw: string, company: string, subtitle: string, lang: 'ar' | 'en' = 'ar'): string {
  const { deck } = splitPitch(raw);
  const slides = parseSlides(deck);
  const dir = lang === 'en' ? 'ltr' : 'rtl';
  const brand = lang === 'en' ? 'Murdi — Capital Readiness Platform' : 'مُرضي — منصة جاهزية رأس المال';
  const cover = `<section class="s cv"><h1>${esc(company)}</h1><h2>${esc(subtitle)}</h2><div class="f">${esc(brand)}</div></section>`;
  const body = slides.map((s, i) => `<section class="s${dens(s)}"><div class="t">${esc(s.title)}</div>
${s.pivot ? `<div class="k">${esc(s.pivot)}</div>` : ''}
<ul class="b">${s.bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>
<div class="n">${i + 1}</div></section>`).join('');
  return SHELL(dir, 'landscape', cover + body);
}

function notesBody(notes: string): string {
  const ls = notes.split('\n').map((l) => l.trim()).filter((l) => l && !isRule(l));
  let out = '', open = false;
  for (const line of ls) {
    if (/^[═=\s]*(وثيقة منفصلة|ملاحظات المستشار)/.test(line)) continue;
    const head = /^#{1,6}\s/.test(line);
    const bullet = /^[-•·◆*]\s/.test(line);
    const t = md(line);
    if (!t) continue;
    if (bullet) { if (!open) { out += '<ul>'; open = true } out += `<li>${esc(t)}</li>`; continue }
    if (open) { out += '</ul>'; open = false }
    out += head ? `<h2>${esc(t)}</h2>` : `<p>${esc(t)}</p>`;
  }
  if (open) out += '</ul>';
  return out;
}

export function buildNotesHTML(raw: string, company: string, lang: 'ar' | 'en' = 'ar'): string {
  const { notes } = splitPitch(raw);
  const dir = lang === 'en' ? 'ltr' : 'rtl';
  const body = notesBody(notes);
  const miss = '<p style="color:#C0564B;font-weight:900">لم يُعثر على قسم «ملاحظات المستشار» في نص التوليد — تحقّق من وجود الفاصل في المحتوى أو أعد التوليد.</p>';
  const html = `<div class="doc"><h1>ملاحظات المستشار — ${esc(company)}</h1>
<div class="w">وثيقة داخلية خاصة بالمستشار — لا تُعرض على المستثمر ولا تُرسل مع العرض.</div>
${body || miss}</div>`;
  return SHELL(dir, 'portrait', html);
}
