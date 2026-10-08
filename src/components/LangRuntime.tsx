'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { currentLang, NO_I18N_PATH } from '@/lib/i18n/lang'

// مترجم العرض: يقرأ كل نصٍّ عربي معروض ويبدّله بمقابله الإنجليزي من القاموس.
// المفتاح هو النص بعد ضمّ المسافات واستبدال كل رقم بـ«#» — فالأسعار والأعداد
// المتغيّرة تُترجم بقالبٍ واحد، وتُنقل أرقامها كما هي (بالأرقام اللاتينية).
// ما لا مقابل له يبقى عربياً كما هو: لا تخمين ولا ترجمة آلية.

// القاموس يُحمَّل عند اختيار English وحده — فلا يدفع زائر العربي ثمنه
let DICT: Record<string, string> = {}
const AR = /[؀-ۿ]/
const NUM = /[0-9٠-٩]+(?:[.,٫٬][0-9٠-٩]+)*/g
const ATTRS = ['placeholder', 'title', 'aria-label', 'alt'] as const
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'NOSCRIPT', 'CODE', 'PRE'])

const latin = (s: string) =>
  s.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660)).replace(/٬/g, ',').replace(/٫/g, '.')

export function translate(text: string): string | null {
  if (!text || !AR.test(text)) return null
  const lead = (text.match(/^\s*/) || [''])[0]
  const trail = (text.match(/\s*$/) || [''])[0]
  const core = text.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim()
  const nums = core.match(NUM) || []
  const en = DICT[core.replace(NUM, '#')]
  if (en == null) return null
  let i = 0
  return lead + en.replace(/#/g, () => latin(nums[i++] ?? '')) + trail
}

function skipped(el: Element | null): boolean {
  for (let e = el; e; e = e.parentElement) {
    if (SKIP_TAGS.has(e.tagName) || e.hasAttribute('data-no-i18n') || (e as HTMLElement).isContentEditable) return true
  }
  return false
}

function translateTree(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) {
    const t = root as Text
    if (!skipped(t.parentElement)) { const en = translate(t.nodeValue || ''); if (en != null && en !== t.nodeValue) t.nodeValue = en }
    return
  }
  if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return
  const el = root as Element
  if (root.nodeType === Node.ELEMENT_NODE && skipped(el)) return
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let n: Node | null
  while ((n = walker.nextNode())) {
    const t = n as Text
    if (!t.nodeValue || !AR.test(t.nodeValue) || skipped(t.parentElement)) continue
    const en = translate(t.nodeValue)
    if (en != null) t.nodeValue = en
  }
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
    let raf = 0
    const run = () => {
      translateTree(document.body)
      const tt = translate(document.title); if (tt) document.title = tt
    }
    let queued: Node[] = []
    const flush = () => { raf = 0; const q = queued; queued = []; for (const n of q) if (n.isConnected) translateTree(n) }
    const observe = () => { mo = new MutationObserver((muts) => {
      for (const m of muts) {
        if (m.type === 'characterData') queued.push(m.target)
        else if (m.type === 'attributes') queued.push(m.target)
        else m.addedNodes.forEach((n) => queued.push(n))
      }
      if (!raf) raf = requestAnimationFrame(flush)
    })
    mo.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...ATTRS] }) }
    import('@/lib/i18n/en.json').then((m) => {
      if (cancelled) return
      DICT = (m.default || m) as unknown as Record<string, string>
      run(); observe()
    }).finally(() => html.classList.remove('i18n-pending'))
    return () => { cancelled = true; mo?.disconnect(); if (raf) cancelAnimationFrame(raf) }
  }, [path])
  return null
}
