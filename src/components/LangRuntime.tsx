'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { currentLang, NO_I18N_PATH } from '@/lib/i18n/lang'

// مترجم العرض: يقرأ كل نصٍّ عربي معروض ويبدّله بمقابله الإنجليزي من القاموس.
//
// ثلاث طبقات، بالترتيب:
//  ١) مطابقة تامة: النص بعد ضمّ المسافات واستبدال كل رقم بـ«#».
//  ٢) قوالب: مفاتيح فيها «{}» مكان قيمةٍ تُدرج (اسم، رقم، عبارة) — تُطابَق بتعبير
//     نمطي، وتُترجم القيمة المُدرجة نفسها إن كان لها مقابل.
//  ٣) العنصر كاملاً: React يقسم «يقف عند {n} جهة» إلى ثلاث عُقد نصية؛ فيُجمع نص
//     العنصر من عُقده الأصلية ويُترجم جملةً واحدة، وتُفرَّغ العُقد الباقية.
// ما لا مقابل له يبقى عربياً كما هو: لا تخمين ولا ترجمة آلية.

// القاموس يُحمَّل عند اختيار English وحده — فلا يدفع زائر العربي ثمنه
let DICT: Record<string, string> = {}
let PATTERNS: { re: RegExp; kinds: ('n' | 'v')[]; en: string; anchor: string }[] = []

const AR = /[؀-ۿ]/
const NUM_SRC = '[0-9\\u0660-\\u0669]+(?:[.,\\u066B\\u066C][0-9\\u0660-\\u0669]+)*'
const NUM = new RegExp(NUM_SRC, 'g')
const ATTRS = ['placeholder', 'title', 'aria-label', 'alt'] as const
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'NOSCRIPT', 'CODE', 'PRE'])

const latin = (s: string) =>
  s.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660)).replace(/٬/g, ',').replace(/٫/g, '.')

function buildPatterns() {
  PATTERNS = []
  for (const [key, en] of Object.entries(DICT)) {
    if (!key.includes('{}')) continue
    const kinds: ('n' | 'v')[] = []
    const parts = key.split(/(\{\}|#)/)
    let src = '^'
    let anchor = ''
    for (const p of parts) {
      if (p === '{}') { src += '(.+?)'; kinds.push('v') }
      else if (p === '#') { src += '(' + NUM_SRC + ')'; kinds.push('n') }
      else if (p) { src += p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); if (p.trim().length > anchor.length) anchor = p.trim() }
    }
    const holes = kinds.filter((k) => k === 'v').length
    if (anchor.length < 3 || (holes > 1 && anchor.length < 6)) continue
    PATTERNS.push({ re: new RegExp(src + '$'), kinds, en, anchor })
  }
  PATTERNS.sort((a, b) => b.anchor.length - a.anchor.length)
}

function exact(core: string): string | null {
  const nums = core.match(NUM) || []
  const en = DICT[core.replace(NUM, '#')]
  if (en == null) return null
  let i = 0
  return en.replace(/#/g, () => latin(nums[i++] ?? ''))
}

function byPattern(core: string, depth: number): string | null {
  for (const p of PATTERNS) {
    if (!core.includes(p.anchor)) continue
    const m = core.match(p.re)
    if (!m) continue
    const nums: string[] = []
    const vals: string[] = []
    p.kinds.forEach((k, i) => (k === 'n' ? nums : vals).push(m[i + 1]))
    // القيمة المُدرجة تُترجم إن كان لها مقابل؛ وإن بقيت عربية لا يُستعمل هذا القالب (لا نُخرج جملةً نصفها عربي)
    const tv: string[] = []
    let ok = true
    for (const raw of vals) {
      const v = (raw ?? '').trim()
      const t = AR.test(v) ? (depth < 2 ? translateCore(v, depth + 1) : null) : latin(v)
      if (t == null) { ok = false; break }
      tv.push(t)
    }
    if (!ok) continue
    let ni = 0, vi = 0
    return p.en.replace(/\{\}|#/g, (t) => (t === '#' ? latin(nums[ni++] ?? '') : tv[vi++] ?? ''))
  }
  return null
}

function translateCore(core: string, depth = 0): string | null {
  if (!core || !AR.test(core)) return null
  return exact(core) ?? byPattern(core, depth)
}

export function translate(text: string): string | null {
  if (!text || !AR.test(text)) return null
  const lead = (text.match(/^\s*/) || [''])[0]
  const trail = (text.match(/\s*$/) || [''])[0]
  const core = text.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim()
  const en = translateCore(core)
  return en == null ? null : lead + en + trail
}

function skipped(el: Element | null): boolean {
  for (let e = el; e; e = e.parentElement) {
    if (SKIP_TAGS.has(e.tagName) || e.hasAttribute('data-no-i18n') || (e as HTMLElement).isContentEditable) return true
  }
  return false
}

// ما وضعناه في كل عقدة، وأصلها العربي — لنعرف إن غيّرها React بعدنا
const ORIG = new WeakMap<Text, string>()
const SET = new WeakMap<Text, string>()
const originalOf = (t: Text) => {
  const cur = t.nodeValue || ''
  if (SET.has(t) && SET.get(t) === cur) return ORIG.get(t) ?? cur
  ORIG.set(t, cur); SET.delete(t)
  return cur
}
const put = (t: Text, v: string) => { if (t.nodeValue !== v) t.nodeValue = v; SET.set(t, v) }

/** عنصرٌ كل أبنائه عُقد نصية (اثنتان فأكثر) — يُترجم جملةً واحدة */
function translateElementWhole(el: Element): boolean {
  const kids = Array.from(el.childNodes)
  if (kids.length < 2 || !kids.every((k) => k.nodeType === Node.TEXT_NODE)) return false
  const texts = kids as Text[]
  const full = texts.map(originalOf).join('')
  if (!AR.test(full)) return false
  const en = translate(full)
  if (en == null) return false
  texts.forEach((t, i) => put(t, i === 0 ? en : ''))
  return true
}

function translateText(t: Text) {
  if (!t.nodeValue || skipped(t.parentElement)) return
  const parent = t.parentElement
  if (parent && translateElementWhole(parent)) return
  const orig = originalOf(t)
  if (!AR.test(orig)) return
  const en = translate(orig)
  if (en != null) put(t, en)
}

function translateTree(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) { translateText(root as Text); return }
  if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return
  const el = root as Element
  if (root.nodeType === Node.ELEMENT_NODE && skipped(el)) return
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const list: Text[] = []
  let n: Node | null
  while ((n = walker.nextNode())) { const t = n as Text; if (t.nodeValue && (AR.test(t.nodeValue) || SET.has(t))) list.push(t) }
  for (const t of list) if (t.isConnected) translateText(t)
  const els = root.nodeType === Node.ELEMENT_NODE ? [el, ...Array.from(el.querySelectorAll('*'))] : Array.from((root as Document).querySelectorAll('*'))
  for (const e of els) {
    for (const a of ATTRS) {
      const v = e.getAttribute(a)
      if (v && AR.test(v) && !skipped(e)) { const en = translate(v); if (en != null) e.setAttribute(a, en) }
    }
    if (e instanceof HTMLInputElement && (e.type === 'button' || e.type === 'submit') && AR.test(e.value)) {
      const en = translate(e.value); if (en != null) e.value = en
    }
  }
}

export default function LangRuntime() {
  const path = usePathname() || '/'
  useEffect(() => {
    const html = document.documentElement
    if (currentLang() !== 'en' || NO_I18N_PATH.test(path)) {
      html.classList.remove('i18n-en', 'i18n-pending')
      if (html.lang !== 'ar') { html.lang = 'ar'; html.dir = 'rtl' }
      return
    }
    html.lang = 'en'; html.dir = 'ltr'; html.classList.add('i18n-en')
    let cancelled = false
    let mo: MutationObserver | null = null
    let timer = 0
    const run = () => {
      translateTree(document.body)
      const tt = translate(document.title); if (tt) document.title = tt
    }
    let queued: Node[] = []
    const flush = () => { timer = 0; const q = queued; queued = []; for (const n of q) if (n.isConnected) translateTree(n) }
    const observe = () => {
      mo = new MutationObserver((muts) => {
        for (const m of muts) {
          if (m.type === 'characterData') queued.push(m.target)
          else if (m.type === 'attributes') queued.push(m.target)
          else { m.addedNodes.forEach((n) => queued.push(n)); if (m.target !== document.body && m.target.childNodes.length <= 12) queued.push(m.target) }
        }
        if (!timer) timer = window.setTimeout(flush, 16)
      })
      mo.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...ATTRS] })
    }
    import('@/lib/i18n/en.json').then((m) => {
      if (cancelled) return
      DICT = (m.default || m) as unknown as Record<string, string>
      buildPatterns()
      run(); observe()
    }).finally(() => html.classList.remove('i18n-pending'))
    return () => { cancelled = true; mo?.disconnect(); if (timer) clearTimeout(timer) }
  }, [path])
  return null
}
