'use client'
import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import AdminNav from '@/components/AdminNav'
import { COMMISSION_SERVICES } from '@/lib/contracts'
import { priceFor, COMMERCIAL } from '@/lib/servicePricing'
import { canonicalTitle } from '@/lib/serviceCatalog'
import { SERVICES } from '@/lib/serviceSuggestion'
import { ACTIVITIES, fieldsFor } from '@/lib/financialActivities'
import { buildPdfHtml } from '@/lib/pdfTemplate'
import { buildComputedStatements, renderStatementsHtml } from '@/lib/financialCompute'

const ADMIN_EMAIL = 'hololalmurdi.fs@gmail.com'
const fmtDate = (d: string) => d ? new Date(d).toLocaleString('ar-SA', { year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }) : '—'
const isNew = (d: string) => d ? (Date.now() - new Date(d).getTime()) < 48*60*60*1000 : false

const STAT: Record<string, { t: string; bg: string; fg: string }> = {
  submitted: { t: 'بانتظار التجهيز', bg: '#FBF5E8', fg: '#9A7B2E' },
  in_progress: { t: 'تم التجهيز — بانتظار الإصدار', bg: '#EAF7F0', fg: '#9A7B2E' },
  priced: { t: 'مُسعّرة — بانتظار دفع العميل', bg: '#FBF3DC', fg: '#B8860B' },
  paid: { t: 'مدفوعة — بانتظار التسليم', bg: '#E8F5EF', fg: '#1A7A4C' },
  delivered: { t: 'صادرة للعميل', bg: '#EAF7F0', fg: '#1E7A5A' },
  in_follow_up: { t: 'قيد المتابعة مع الجهات', bg: '#EAF7F0', fg: '#9A7B2E' },
  completed: { t: 'مكتملة', bg: '#EAF7F0', fg: '#1E7A5A' },
  rejected: { t: 'مرفوضة', bg: '#FBEEEC', fg: '#C0564B' },
}

export default function AdminServicesPage() {
  const router = useRouter()
const IN_STYLE = { padding:'8px 10px', borderRadius:8, border:'1.5px solid #E8D9A8', fontFamily:'Cairo', fontSize:12.5 }
const FZ_TEXT = [
  { k: 'projectDescription', t: 'وصف المشروع' },
  { k: 'sectorText', t: 'القطاع' },
  { k: 'location', t: 'موقع المشروع — الحي أو النطاق' },
  { k: 'capacityNote', t: 'الطاقة المستهدفة (وحدات/يوم أو مساحة)' },
  { k: 'staffNote', t: 'العمالة المتوقعة (عدد ووظائف)' },
  { k: 'existingRevenue', t: 'إيراد النشاط القائم (للتوسعة)' },
  { k: 'importCountries', t: 'دول الاستيراد (إن وُجد)' },
  { k: 'largeBuyers', t: 'عملاء كبار بالاسم (إن وُجدوا)' },
  { k: 'collateralNote', t: 'أصول قابلة للرهن (وصفها إن وُجدت)' },
]
const FZ_NUM = [
  { k: 'capex', t: 'التكلفة الرأسمالية (ريال)' },
  { k: 'workingCapital', t: 'رأس المال العامل (ريال)' },
  { k: 'unitPrice', t: 'سعر الوحدة أو الخدمة (ريال)' },
  { k: 'unitsYear1', t: 'عدد الوحدات السنة الأولى' },
  { k: 'growthRate', t: 'نمو المبيعات سنوياً %' },
  { k: 'variableCostPct', t: 'التكلفة المتغيرة % من الإيراد' },
  { k: 'fixedCostsAnnual', t: 'المصاريف الثابتة سنوياً (ريال)' },
  { k: 'inflationRate', t: 'نمو المصاريف سنوياً % (افتراضي 3)' },
  { k: 'ownFunds', t: 'مساهمة المؤسس (ريال)' },
  { k: 'financingAmount', t: 'التمويل المطلوب (ريال)' },
  { k: 'financingYears', t: 'مدة السداد (سنوات)' },
  { k: 'financingRate', t: 'كلفة التمويل السنوية %' },
  { k: 'existingEbitda', t: 'الأرباح التشغيلية الحالية سنوياً (للتوسعة)' },
  { k: 'existingDebtService', t: 'أقساط التمويل القائمة سنوياً (للتوسعة)' },
  { k: 'existingYears', t: 'عمر النشاط القائم بالسنوات (للتوسعة)' },
]
const PITCH_FIELDS = [{k:'branch_revenue',t:'متوسط إيراد الفرع (ر.س)'},{k:'branch_cost',t:'تكلفة افتتاح الفرع (ر.س)'},{k:'payback',t:'استرداد رأس مال الفرع (شهر)'},{k:'branches_now',t:'عدد الفروع الحالية'},{k:'branches_target',t:'عدد الفروع الجديدة من الجولة'},{k:'headcount',t:'عدد الموظفين'},{k:'equity_offered',t:'الحصة المعروضة (%)'},{k:'pre_money',t:'التقييم قبل الجولة (ر.س)'},{k:'target_return',t:'مضاعف العائد المستهدف وأفقه'},{k:'round_size',t:'حجم الجولة المطلوب (ر.س)'}]
  const [loading, setLoading] = useState(true)
  const [pitchIn, setPitchIn] = useState<Record<string, Record<string, string>>>({})
  const [fzIn, setFzIn] = useState<Record<string, Record<string, string>>>({})
  const [fzMatch, setFzMatch] = useState<Record<string, string>>({})
  const [reqs, setReqs] = useState<any[]>([])
  const [busy, setBusy] = useState('')
  // رقم طلب الفحص السريع الذي خُصم من كل دراسة — يُرسل مع التسعير
  const [creditFrom, setCreditFrom] = useState<Record<string, string>>({})
  const [fundAmt, setFundAmt] = useState<Record<string, string>>({})
  const [fundPurpose, setFundPurpose] = useState<Record<string, string>>({})
  const [edits, setEdits] = useState<Record<string, { deliverable: string; price: string }>>({})
  const [contracts, setContracts] = useState<Record<string, any>>({})
  const [cEdits, setCEdits] = useState<Record<string, any>>({})
  const [integrity, setIntegrity] = useState<Record<string, any>>({})
  const [fixEdits, setFixEdits] = useState<Record<string, any>>({})
  const [inputsOpen, setInputsOpen] = useState<Record<string, boolean>>({})
  const [inputsData, setInputsData] = useState<Record<string, { activity_kind: string; inputs: Record<string, string> }>>({})
  const [addOpen, setAddOpen] = useState(false)
  const [addCompanies, setAddCompanies] = useState<any[]>([])
  const [addCompanyId, setAddCompanyId] = useState('')
  const [addService, setAddService] = useState('')

  const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string)

  async function load() {
    const res = await fetch('/api/admin/service-requests')
    if (res.ok) { const d = await res.json(); setReqs(d.requests || []); loadFeasibility((d.requests || []).map((x: { id: string }) => x.id)); loadPitchNums((d.requests || []).filter((x: { service_title?: string }) => String(x.service_title || '').includes('\u0627\u0644\u0645\u0633\u062a\u062b\u0645\u0631')).map((x: { id: string }) => x.id)) }
    const cr = await fetch('/api/admin/contracts')
    if (cr.ok) { const cd = await cr.json(); const map: Record<string, any> = {}; for (const c of (cd.contracts || [])) { if (c.service_request_id && !map[c.service_request_id]) map[c.service_request_id] = c; } setContracts(map); }
    setLoading(false)
  }

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || user.email !== ADMIN_EMAIL) { router.push('/'); return }
      await load()
    })()
  }, [])

  async function openAdd() {
    setAddOpen(true)
    if (addCompanies.length === 0) {
      const { data } = await supabase.from('companies').select('id, company_name').eq('account_status', 'active').order('created_at', { ascending: false })
      setAddCompanies(data || [])
    }
  }

  async function createRequest() {
    if (!addCompanyId || !addService) { alert('اختر العميل والخدمة'); return }
    setBusy('add')
    const res = await fetch('/api/admin/service-requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ company_id: addCompanyId, service_title: addService }) })
    if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.error || 'تعذر الإنشاء'); setBusy(''); return }
    setAddOpen(false); setAddCompanyId(''); setAddService('')
    await load()
    setBusy('')
  }

  async function openInputs(r: any) {
    const willOpen = !inputsOpen[r.id]
    setInputsOpen(p => ({ ...p, [r.id]: willOpen }))
    if (!willOpen) return
    const res = await fetch('/api/admin/service-inputs?service_request_id=' + r.id)
    const d = await res.json().catch(() => ({}))
    const rec = d.record
    // فكّ البيانات الملفوفة (multi_year/years) لحقول مسطّحة __y1/__y2 ليقرأها النموذج
    const kind = rec?.activity_kind || 'trade'
    const valid = new Set<string>(fieldsFor(kind).map((f: any) => f.key))
    const flat: Record<string,string> = {}
    const raw = rec?.inputs || {}
    if (raw && raw.multi_year && raw.years) {
      for (const k in (raw.years['1'] || {})) if (valid.has(k)) flat[k + '__y1'] = raw.years['1'][k]
      for (const k in (raw.years['2'] || {})) if (valid.has(k)) flat[k + '__y2'] = raw.years['2'][k]
    } else {
      for (const k in raw) if (valid.has(k)) flat[k + '__y1'] = raw[k]
    }
    if (raw.advisor_notes) flat['advisor_notes'] = raw.advisor_notes
    else if (raw.years && raw.years['1'] && raw.years['1'].advisor_notes) flat['advisor_notes'] = raw.years['1'].advisor_notes
    setInputsData(p => ({ ...p, [r.id]: { activity_kind: kind, inputs: flat } }))
  }


  function injectTables(rid: string, body: string): string {
    if (!body || !body.includes('[[TABLES]]')) return body
    try {
      const cur = inputsData[rid]
      if (!cur) return body
      const years: any = { '1': {}, '2': {} }
      for (const k in cur.inputs) {
        if (k.endsWith('__y1')) years['1'][k.slice(0,-4)] = cur.inputs[k]
        else if (k.endsWith('__y2')) years['2'][k.slice(0,-4)] = cur.inputs[k]
      }
      const tables = renderStatementsHtml(buildComputedStatements(years))
      return body.split('[[TABLES]]').join(tables)
    } catch { return body }
  }

  async function saveInputs(r: any) {
    const cur = inputsData[r.id]
    if (!cur) return
    for (const k in cur.inputs) {
      if (Number(cur.inputs[k]) < 0) { alert('قيمة سالبة غير مسموحة في: ' + k + ' — صحّحها قبل الحفظ'); return }
    }
    setBusy(r.id)
    const link: Record<string,string> = { cash_in_banks:'opening_cash', accounts_receivable:'opening_ar', inventory:'opening_inventory', accounts_payable:'opening_ap', fixed_assets:'opening_fixed_assets', eos_provision:'eos_opening' }
    for (const endK in link) {
      const openK = link[endK]
      const y1end = cur.inputs[endK + '__y1']
      if (y1end && !cur.inputs[openK + '__y2']) cur.inputs[openK + '__y2'] = y1end
    }
    // احسب القيم المقفولة واكتبها قبل الحفظ (النقل التلقائي بين السنتين)
    const carrySave: Record<string,string> = { opening_cash:'cash_in_banks', opening_ar:'accounts_receivable', opening_inventory:'inventory', opening_ap:'accounts_payable', opening_fixed_assets:'fixed_assets', eos_opening:'eos_provision', opening_vat:'vat_due', opening_zakat:'zakat_due' }
    for (const openK in carrySave) {
      const src = cur.inputs[carrySave[openK] + '__y1']
      if (src !== undefined && src !== '') cur.inputs[openK + '__y2'] = src
    }
    const _ore = Number(cur.inputs['opening_retained_earnings__y1'] || 0)
    const _rev = Number(cur.inputs['annual_revenue__y1'] || 0)
    const _oInv = Number(cur.inputs['opening_inventory__y1'] || 0)
    const _pur = Number(cur.inputs['purchases__y1'] || 0)
    const _cInv = Number(cur.inputs['close_inventory__y1'] || 0)
    const _cogs = _oInv + _pur - _cInv
    const _opex = Number(cur.inputs['operating_expenses__y1'] || 0)
    const _dep = Number(cur.inputs['depreciation__y1'] || 0)
    const _zak = Number(cur.inputs['zakat_due__y1'] || 0)
    const _dist = Number(cur.inputs['distributions__y1'] || 0)
    const _net = _rev - _cogs - _opex - _dep - _zak
    cur.inputs['opening_retained_earnings__y2'] = String(_ore + _net - _dist)
    const valid = new Set<string>(fieldsFor(cur.activity_kind).map((f: any) => f.key))
    const years: Record<string, Record<string,string>> = { '1': {}, '2': {} }
    for (const k in cur.inputs) {
      if (k === 'advisor_notes') continue
      const v = cur.inputs[k]
      if (k.endsWith('__y1')) { const b = k.slice(0,-4); if (valid.has(b)) years['1'][b] = v }
      else if (k.endsWith('__y2')) { const b = k.slice(0,-4); if (valid.has(b)) years['2'][b] = v }
      else if (valid.has(k)) { years['1'][k] = v; years['2'][k] = v }
    }
    const payload: any = { multi_year: true, years }
    if (cur.inputs['advisor_notes']) payload.advisor_notes = cur.inputs['advisor_notes']
    await fetch('/api/admin/service-inputs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ service_request_id: r.id, company_id: r.company_id, activity_kind: cur.activity_kind, inputs: payload }) })
    setBusy('')
    alert('✅ حُفظت الأرقام — الآن اضغط «جهّز الخدمة» لتوليد القوائم')
  }

  async function prepare(id: string) {
    setBusy(id)
    const res = await fetch('/api/admin/prepare-service', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId: id, pitch_inputs: pitchIn[id] || {} }) })
    if (res.status === 422) {
      const d = await res.json()
      setIntegrity(p => ({ ...p, [id]: d }))
      setFixEdits(p => ({ ...p, [id]: { original_loan_amount: d.current?.original_loan_amount ?? '', debt_remaining: d.current?.debt_remaining ?? '', annual_revenue: d.current?.annual_revenue ?? '', source_note: '' } }))
      setBusy('')
      return
    }
    setIntegrity(p => { const c = { ...p }; delete c[id]; return c })
    if (res.ok) { const d = await res.json(); setEdits(p => ({ ...p, [id]: { deliverable: d.deliverable || '', price: edits[id]?.price || '' } })) }
    await load()
    setBusy('')
  }

  async function saveCorrection(reqId: string, companyId: string) {
    const e = fixEdits[reqId] || {}
    if (!e.source_note || String(e.source_note).trim().length < 5) { alert('اكتب مصدر التصحيح (المستند الرسمي الذي استندت إليه)'); return }
    setBusy(reqId)
    const res = await fetch('/api/admin/corrections', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ company_id: companyId, original_loan_amount: e.original_loan_amount, debt_remaining: e.debt_remaining, annual_revenue: e.annual_revenue, source_note: e.source_note }) })
    if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.error || 'تعذّر حفظ التصحيح'); setBusy(''); return }
    setBusy('')
    await prepare(reqId)
  }

  async function generateFile(r: any, forceTrack?: string) {
    setBusy(r.id)
    const track = forceTrack || r.service_title === 'تجهيز صفقة التملّك والتفاوض' ? 'acquisition' : r.service_title === 'تجهيز ملف عرض المستثمر والتفاوض' ? 'investment' : 'funding'
    try {
      // نولّد نسختين: عربية (محلي) + إنجليزية (دولي). احفظ كل واحدة PDF وارفعها في قسم المخاطبة.
      const regions = ['محلي', 'دولي']
      let okCount = 0
      let lastErr = ''
      const made: { region: string; html: string }[] = []
      for (const region of regions) {
        const res = await fetch('/api/admin/generate-file', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ company_id: r.company_id, service_request_id: r.id, track, region, funding_amount: Number(fundAmt[r.id] || 0), funding_purpose: (fundPurpose[r.id] || '').trim() }) })
        const d = await res.json()
        if (res.status === 422) {
          setIntegrity(p => ({ ...p, [r.id]: d }))
          setFixEdits(p => ({ ...p, [r.id]: { original_loan_amount: d.current?.original_loan_amount ?? '', debt_remaining: d.current?.debt_remaining ?? '', annual_revenue: d.current?.annual_revenue ?? '', source_note: '' } }))
          setBusy('')
          return
        }
        if (d.ok && d.html) {
          made.push({ region, html: d.html })
          const blob = new Blob([d.html], { type: 'text/html;charset=utf-8' })
          const url = URL.createObjectURL(blob)
          const w = window.open(url, '_blank')
          if (!w) {
            const a = document.createElement('a')
            a.href = url; a.target = '_blank'; a.rel = 'noopener'
            a.textContent = 'افتح ملف ' + region
            a.style.cssText = 'display:block;margin:8px 0;color:#1A3D34;font-weight:900;text-decoration:underline'
            document.body.appendChild(a)
          }
          okCount++
        } else if (!d.ok) {
          lastErr = d.error || ('HTTP ' + res.status)
        }
      }
      if (okCount > 0) {
        document.getElementById('murdi-pdf-bar')?.remove()
        const bar = document.createElement('div')
        bar.id = 'murdi-pdf-bar'
        bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:#1A3D34;color:#fff;font-family:Cairo,sans-serif;font-size:14px;font-weight:900;padding:14px 20px;display:flex;gap:14px;align-items:center;justify-content:center;box-shadow:0 2px 12px rgba(0,0,0,.3)'
        const msg = document.createElement('span')
        msg.textContent = 'تم توليد ' + okCount + ' ملف وفُتحت للمراجعة. راجعها ثم حوّلها.'
        const btn = document.createElement('button')
        btn.textContent = '📎 حوّل PDF وارفع للمخاطبة'
        btn.style.cssText = 'background:#C9A84C;color:#1A3D34;border:none;padding:9px 22px;border-radius:30px;font-family:Cairo;font-weight:900;font-size:13px;cursor:pointer'
        const close = document.createElement('button')
        close.textContent = '✕'
        close.style.cssText = 'background:transparent;color:#9DB3AB;border:none;font-size:16px;cursor:pointer'
        close.onclick = () => bar.remove()
        btn.onclick = async () => {
          btn.disabled = true; msg.textContent = 'جارٍ التحويل والرفع…'
          let up = 0, upErr = ''
          for (const m of made) {
            const lang = m.region === 'دولي' ? 'en' : 'ar'
            try {
              const pr = await fetch('/api/admin/file-pdf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ company_id: r.company_id, html: m.html, lang, name: 'murdi-' + track, track }) })
              const txt = await pr.text()
              let pd: { ok?: boolean; error?: string } = {}
              try { pd = JSON.parse(txt) } catch { pd = { error: txt.slice(0, 300) } }
              if (pd.ok) up++; else upErr = pd.error || ('HTTP ' + pr.status)
            } catch (e) { upErr = String(e) }
          }
          msg.textContent = up > 0 ? ('تم رفع ' + up + ' ملف PDF وربطها بالمخاطبة.' + (upErr ? ' — تنبيه: ' + upErr : '')) : ('تعذر الرفع: ' + upErr)
          console.log('FILE-PDF RESULT', { up, upErr })
          btn.disabled = false
        }
        bar.appendChild(msg); bar.appendChild(btn); bar.appendChild(close)
        document.body.appendChild(bar)
      }
      else alert('تعذّر توليد الملفات: ' + (lastErr || 'سبب غير معروف'))
    } catch {
      alert('تعذّر الاتصال بالخادم')
    }
    setBusy('')
  }

  async function showDeck(id: string, text: string) {
    const wins = [window.open('', '_blank'), window.open('', '_blank')]
    if (!wins[0] || !wins[1]) { wins.forEach(w => { if (w) w.close() }); alert('المتصفح يمنع النوافذ المنبثقة — اسمح بها لهذا الموقع ثم أعد المحاولة'); return }
    wins.forEach(w => { if (w) w.document.write('<!doctype html><meta charset="utf-8"><body style="font-family:Cairo,sans-serif;padding:40px;color:#1A3D34">جارٍ التجهيز…</body>') })
    setBusy(id)
    const res = await fetch('/api/admin/pitch-render', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId: id, text }) })
    const d = await res.json()
    setBusy('')
    if (!d.ok) { wins.forEach(w => { if (w) w.close() }); alert(d.error || 'تعذّر بناء الشرائح'); return }
    const htmls: string[] = [d.deckHtml, d.notesHtml]
    wins.forEach((w, i) => { if (w) { w.document.open(); w.document.write(htmls[i]); w.document.close() } })
  }

  async function exportDeck(id: string, text: string, companyId: string) {
    setBusy('dl' + id)
    try {
      const res = await fetch('/api/admin/pitch-render', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId: id, text }) })
      const d = await res.json()
      if (!d.ok) { alert(d.error || 'تعذّر بناء الشرائح'); setBusy(''); return }
      let msg = ''
      if (d.deckHtml) {
        const pr = await fetch('/api/admin/file-pdf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ company_id: companyId, html: d.deckHtml, lang: 'ar', name: 'murdi-deck', landscape: true, kind: 'deck', track: 'investment' }) })
        const pd = await pr.json().catch(() => ({}))
        msg += pd.ok ? 'تم رفع الشرائح للمخاطبة. ' : ('تعذّر رفع الشرائح: ' + (pd.error || pr.status) + ' ')
      }
      const er = await fetch('/api/admin/pitch-render', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId: id, text, lang: 'en' }) })
      const ed = await er.json().catch(() => ({}))
      if (ed.ok && ed.deckHtml) {
        const pr2 = await fetch('/api/admin/file-pdf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ company_id: companyId, html: ed.deckHtml, lang: 'en', name: 'murdi-deck', landscape: true, kind: 'deck', track: 'investment' }) })
        const pd2 = await pr2.json().catch(() => ({}))
        msg += pd2.ok ? 'ورُفعت النسخة الإنجليزية. ' : ('تعذّر رفع الإنجليزية: ' + (pd2.error || pr2.status) + ' ')
      } else { msg += 'تعذّرت الترجمة الإنجليزية: ' + (ed.error || er.status) + ' ' }

      if (d.notesHtml) {
        const nr = await fetch('/api/admin/file-pdf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ company_id: companyId, html: d.notesHtml, lang: 'ar', name: 'murdi-notes', landscape: false, download: true }) })
        if (nr.ok) {
          const a = document.createElement('a')
          a.href = URL.createObjectURL(await nr.blob())
          a.download = 'murdi-notes.pdf'
          a.click()
          msg += 'ونُزّلت ملاحظات المستشار لك وحدك.'
        }
      }
      alert(msg || 'لم يُنتَج شيء')
    } catch (e) { alert('خطأ: ' + String(e)) }
    setBusy('')
  }

  async function saveFeasibility(id: string, companyId: string) {
    setBusy('fz' + id)
    const res = await fetch('/api/admin/service-inputs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ service_request_id: id, company_id: companyId, activity_kind: 'feasibility', inputs: fzIn[id] || {} }) })
    const d = await res.json()
    setBusy('')
    alert(d.ok ? 'تم حفظ مدخلات دراسة الجدوى.' : ('تعذّر الحفظ: ' + (d.error || '')))
  }
  // مطابقة الجهات الخاصة بالدراسة — تعمل على دفعات وتُحدّث الزر بالتقدم
  async function matchFeasibility(companyId: string) {
    // بحث فعلي على كل النطاقات — يستغرق دقائق وله كلفة، فلا يُشغَّل بنقرة عابرة
    if (!confirm('مطابقة الجهات بحث فعلي على كل النطاقات: تستغرق عدة دقائق ولها كلفة على كل تشغيلة.\n\nيُنصح بتشغيلها لعميل حقيقي لا لملف تجريبي. أُكمل؟')) return
    setBusy('mfz' + companyId)
    try {
      let batch = 0
      let total = 0
      let count = 0
      let drops = 0
      for (let guard = 0; guard < 40; guard++) {
        const res = await fetch('/api/admin/feasibility-match', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ company_id: companyId, batch }) })
        const d = await res.json()
        if (!d.ok) { alert('تعذّرت المطابقة: ' + (d.error || res.status)); setBusy(''); return }
        total = d.total || total
        count = d.count || count
        drops += d.dropped || 0
        setFzMatch((p) => ({ ...p, [companyId]: 'جارٍ المطابقة… ' + Math.min((batch + 1) * 5, total) + '/' + total + ' — ' + count + ' جهة' + (drops ? ' (استُبعدت ' + drops + ' غير مناسبة)' : '') + (d.gate ? ' | البوابة: ' + d.gate : '') }))
        if (d.done) break
        batch = d.next
      }
      setFzMatch((p) => ({ ...p, [companyId]: 'اكتملت المطابقة — ' + count + ' جهة · جارٍ تجهيز طرق التقديم…' }))

      // المرحلة الثانية: قناة التقديم والمستندات المطلوبة لأعلى الجهات — هي ما يحوّل القائمة إلى خارطة طريق
      let off = 0
      let filled = 0
      for (let guard = 0; guard < 12; guard++) {
        const er = await fetch('/api/admin/feasibility-enrich', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ company_id: companyId, offset: off }) })
        const ed = await er.json()
        if (!ed.ok) { setFzMatch((p) => ({ ...p, [companyId]: 'اكتملت المطابقة — ' + count + ' جهة · تعذّر تجهيز طرق التقديم' })); break }
        filled += ed.filled || 0
        setFzMatch((p) => ({ ...p, [companyId]: 'اكتملت المطابقة — ' + count + ' جهة · طرق التقديم ' + filled + '/' + (ed.top || 24) }))
        if (ed.done) break
        off = ed.next
      }
      setFzMatch((p) => ({ ...p, [companyId]: 'جاهزة — ' + count + ' جهة مرشّحة، وطريقة التقديم مجهّزة لأعلى ' + filled + ' جهة' }))
      alert('اكتمل التجهيز: ' + count + ' جهة مرشّحة، وطرق التقديم والمستندات جاهزة لأعلى ' + filled + ' جهة.\n\nولّد الدراسة الآن لتظهر داخلها.')
    } catch (e) { alert('خطأ: ' + String(e)) }
    setBusy('')
  }

  const genFeasibilityQuick = (companyId: string) => genFeasibility(companyId, true)

  async function genFeasibility(companyId: string, quick = false) {
    setBusy('gfz' + companyId)
    // النافذة تُفتح داخل نقرة المستخدم — فتحها بعد await يجعل المتصفح يمنعها فتضيع الدراسة
    const w = window.open('', '_blank')
    if (w) {
      w.document.write('<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>جارٍ توليد دراسة الجدوى…</title></head>'
        + '<body style="font-family:Arial,sans-serif;color:#1F2A44;text-align:center;padding:60px 24px">'
        + '<h2 style="color:#B8860B">' + (quick ? 'جارٍ إعداد الفحص الائتماني السريع…' : 'جارٍ توليد دراسة الجدوى…') + '</h2>'
        + '<p>التوليد يمر بمرحلتين: بحث السوق ثم كتابة الأقسام، ويستغرق عادةً دقيقة إلى دقيقتين.</p>'
        + '<p style="font-size:13px;color:#666">لا تغلق هذه الصفحة — ستُستبدل بالدراسة تلقائياً.</p></body></html>')
      w.document.close()
    }
    try {
      const res = await fetch('/api/admin/generate-file', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ company_id: companyId, track: 'feasibility', mode: quick ? 'quick' : 'full' }) })
      const d = await res.json()
      if (!d.ok) { w?.close(); alert('تعذّر التوليد: ' + (d.error || res.status)); setBusy(''); return }
      if (w) { w.document.open(); w.document.write(d.html); w.document.close(); w.focus() }
      else {
        // المتصفح منع النافذة — ننزّل الدراسة كملف بدل أن تضيع
        const url = URL.createObjectURL(new Blob([d.html], { type: 'text/html;charset=utf-8' }))
        const a = document.createElement('a')
        a.href = url; a.download = 'دراسة-جدوى.html'
        document.body.appendChild(a); a.click(); a.remove()
        setTimeout(() => URL.revokeObjectURL(url), 60000)
        alert('المتصفح منع فتح نافذة جديدة، فنُزّلت الدراسة كملف. للفتح المباشر مستقبلاً اسمح بالنوافذ المنبثقة لموقع murdi.sa.')
      }
      if (d.warn) alert('تنبيه: ' + d.warn + ' — الجداول المحسوبة والائتمانية ظهرت كاملة.')
    } catch (e) { w?.close(); alert('خطأ: ' + String(e)) }
    setBusy('')
  }
  async function savePitchNums(id: string, companyId: string) {
    setBusy('pn' + id)
    const res = await fetch('/api/admin/service-inputs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ service_request_id: id, company_id: companyId, activity_kind: 'pitch', inputs: { pitch: pitchIn[id] || {} } }) })
    const d = await res.json()
    setBusy('')
    alert(d.ok ? 'تم حفظ أرقام العرض.' : ('تعذّر الحفظ: ' + (d.error || '')))
  }

  async function loadFeasibility(ids: string[]) {
    for (const id of ids) {
      try {
        const res = await fetch('/api/admin/service-inputs?service_request_id=' + id)
        const d = await res.json()
        const v = d?.record?.inputs
        if (v && typeof v === 'object' && !Array.isArray(v) && !('pitch' in v)) {
          setFzIn((prev) => ({ ...prev, [id]: { ...(v as Record<string, string>), ...(prev[id] || {}) } }))
        }
      } catch {}
    }
  }
  async function loadPitchNums(ids: string[]) {
    for (const id of ids) {
      try {
        const res = await fetch('/api/admin/service-inputs?service_request_id=' + id)
        const d = await res.json()
        const pv = d?.record?.inputs?.pitch
        if (pv && typeof pv === 'object') setPitchIn((prev) => ({ ...prev, [id]: { ...(pv as Record<string, string>), ...(prev[id] || {}) } }))
      } catch {}
    }
  }

  async function save(id: string, deliverable: string, price: string, status?: string) {
    setBusy(id)
    await fetch('/api/admin/service-requests', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, admin_deliverable: deliverable, price: price ? Number(price) : null, status, credited_from: creditFrom[id] || undefined }) })
    await load()
    setBusy('')
  }

  async function createContract(sr: any) {
    setBusy(sr.id)
    const type = COMMISSION_SERVICES[sr.service_title]
    await fetch('/api/admin/contracts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ serviceRequestId: sr.id, companyId: sr.company_id, contractType: type }) })
    await load()
    setBusy('')
  }

  async function saveContract(c: any, status?: string) {
    setBusy(c.service_request_id)
    const e = cEdits[c.id] || {}
    const pick = (k: string) => e[k] !== undefined ? e[k] : c[k]
    const numOrNull = (k: string) => { const v = pick(k); return v === '' || v === null || v === undefined ? null : Number(v) }
    // نص العقد لا يُرسل: الخادم يعيد توليده من الحقول، فلا يفترق النص عن الأرقام أبداً
    await fetch('/api/admin/contracts', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      id: c.id,
      client_name: pick('client_name'), client_id_number: pick('client_id_number'),
      establishment_name: pick('establishment_name'), establishment_cr: pick('establishment_cr'),
      fee_type: pick('fee_type') || 'percent',
      fee_percent: numOrNull('fee_percent'),
      fixed_amount: numOrNull('fixed_amount'),
      success_min: numOrNull('success_min'),
      success_base: pick('success_base') || null,
      status,
    }) })
    if (status === 'issued') {
      await fetch('/api/admin/service-requests', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: c.service_request_id, status: 'in_follow_up' }) })
    }
    if (status === 'completed') {
      await fetch('/api/admin/service-requests', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: c.service_request_id, status: 'completed' }) })
    }
    await load()
    setBusy('')
  }

  if (loading) return <div dir="rtl" style={{ minHeight:'100vh', background:'#FBFCFB', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Cairo,sans-serif', color:'#2E9E7B', fontWeight:700 }}>جارٍ التحميل...</div>

  return (
    <div dir="rtl" style={{ minHeight:'100vh', background:'#FBFCFB', fontFamily:'Cairo,sans-serif' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Amiri:wght@700&family=Cairo:wght@400;600;700;900&display=swap');`}</style>
      <div style={{ background:'#fff', padding:'16px 32px', display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'1px solid #EAF2EE' }}>
        <div style={{ fontSize:22, fontWeight:700, color:'#1A3D34', fontFamily:'Amiri,serif' }}>مُرضي <span style={{ fontSize:13, color:'#C9A84C', fontWeight:900, fontFamily:'Cairo' }}>ADMIN</span></div>
        <button onClick={()=>router.push('/goal')} style={{ padding:'8px 18px', borderRadius:30, border:'1px solid #E8F5EF', background:'transparent', color:'#6B8A80', cursor:'pointer', fontSize:13, fontFamily:'Cairo', fontWeight:700 }}>المركز الرئيسي</button>
      </div>
      <div style={{ background:'#fff', padding:'0 32px' }}>
        <AdminNav />
      </div>

      <div style={{ maxWidth:900, margin:'0 auto', padding:'32px 24px' }}>
        <h1 style={{ fontSize:24, fontWeight:900, color:'#1A3D34', marginBottom:6 }}>طلبات الخدمات</h1>
        <p style={{ color:'#6B8A80', fontSize:14, fontWeight:600, marginBottom:16 }}>جهّز الخدمة، حدّد السعر بعد التفاوض، ثم أصدرها للعميل</p>

        {!addOpen && (
          <button onClick={openAdd} style={{ background:'#1A3D34', color:'#fff', border:'none', padding:'10px 22px', borderRadius:30, fontFamily:'Cairo', fontWeight:900, fontSize:13, cursor:'pointer', marginBottom:24 }}>➕ إنشاء طلب خدمة نيابةً عن العميل</button>
        )}

        {addOpen && (
          <div style={{ background:'#F7FAF9', border:'2px solid #E1EDE8', borderRadius:14, padding:'18px 20px', marginBottom:24 }}>
            <div style={{ color:'#1A3D34', fontWeight:900, fontSize:14, marginBottom:12 }}>➕ إنشاء طلب خدمة نيابةً عن العميل</div>
            <div style={{ color:'#6B8A80', fontSize:12.5, marginBottom:14, lineHeight:1.8 }}>يُنشأ الطلب بحالة «بانتظار التجهيز» تماماً كما لو طلبه العميل بنفسه. استخدمه بعد إغلاق الصفقة هاتفياً.</div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
              <div>
                <div style={{ color:'#6B8A80', fontSize:11.5, fontWeight:700, marginBottom:5 }}>العميل</div>
                <select value={addCompanyId} onChange={e => setAddCompanyId(e.target.value)} style={{ width:'100%', border:'1.5px solid #EAF2EE', borderRadius:10, padding:'10px 12px', fontFamily:'Cairo', fontSize:13, background:'#fff', color:'#1A3D34' }}>
                  <option value="">— اختر العميل —</option>
                  {addCompanies.map((c: any) => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                </select>
              </div>
              <div>
                <div style={{ color:'#6B8A80', fontSize:11.5, fontWeight:700, marginBottom:5 }}>الخدمة</div>
                <select value={addService} onChange={e => setAddService(e.target.value)} style={{ width:'100%', border:'1.5px solid #EAF2EE', borderRadius:10, padding:'10px 12px', fontFamily:'Cairo', fontSize:13, background:'#fff', color:'#1A3D34' }}>
                  <option value="">— اختر الخدمة —</option>
                  {Object.keys(SERVICES).map(k => <option key={k} value={k}>{k}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display:'flex', gap:10 }}>
              <button onClick={createRequest} disabled={busy === 'add'} style={{ background:'#2E9E7B', color:'#fff', border:'none', padding:'9px 22px', borderRadius:30, fontFamily:'Cairo', fontWeight:900, fontSize:13, cursor:'pointer' }}>{busy === 'add' ? 'جارٍ...' : '✅ إنشاء الطلب'}</button>
              <button onClick={() => setAddOpen(false)} style={{ background:'transparent', color:'#6B8A80', border:'1.5px solid #E8F5EF', padding:'9px 20px', borderRadius:30, fontFamily:'Cairo', fontWeight:700, fontSize:13, cursor:'pointer' }}>إلغاء</button>
            </div>
          </div>
        )}

        {reqs.length === 0 && <div style={{ color:'#9DB3AB', textAlign:'center', padding:40 }}>لا توجد طلبات بعد</div>}

        {reqs.map((r) => {
          const e = edits[r.id] || { deliverable: r.admin_deliverable || '', price: r.price ? String(r.price) : '' }
          const st = STAT[r.status] || STAT.submitted
          return (
            <div key={r.id} style={{ background:'#fff', border:'2px solid #EAF2EE', borderRadius:16, padding:20, marginBottom:16 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:8, marginBottom:10 }}>
                <div>
                  <div style={{ fontSize:16, fontWeight:900, color:'#1A3D34' }}>{isNew(r.created_at) && <span style={{ background:'#2E9E7B', color:'#fff', fontSize:10, fontWeight:900, padding:'2px 8px', borderRadius:20, marginLeft:6 }}>جديد</span>}{r.service_title}</div>
                  <div style={{ color:'#6B8A80', fontSize:13, fontWeight:600, marginTop:2 }}>{(r.companies?.company_name) || 'شركة'} · {r.companies?.phone || '—'}</div>
                  <div style={{ color:'#9DB3AB', fontSize:11.5, fontWeight:600, marginTop:2 }}>📅 {fmtDate(r.created_at)}</div>
                </div>
                <span style={{ padding:'4px 14px', borderRadius:20, fontSize:12, fontWeight:700, background:st.bg, color:st.fg }}>{st.t}</span>
              </div>

              {/* ما اشتراه العميل — كان محفوظاً في القاعدة ولا يظهر هنا،
                  فيُسلَّم عملٌ بعشرين ألفاً لمن دفع تسعمئة وتسعين */}
              {(() => {
                const ci = (r.client_inputs || {}) as { totalInvestment?: number; projectKind?: string; option?: string }
                const optKey = String(r.option_key || ci.option || '')
                if (!optKey && r.quoted_price == null && !ci.totalInvestment) return null
                const com = COMMERCIAL[canonicalTitle(r.service_title)]
                const optLabel = com?.options?.find(o => o.key === optKey)?.label || (optKey === 'quick' ? 'الفحص السريع' : optKey === 'full' ? 'الخدمة الكاملة' : '')
                const inv = Number(ci.totalInvestment || 0)
                const quoted = r.quoted_price == null ? null : Number(r.quoted_price)
                // إعادة حساب الشريحة على الخادم — العميل يكتب حجم استثماره بنفسه
                const right = inv > 0 ? priceFor(canonicalTitle(r.service_title), inv).amount : null
                const mismatch = quoted != null && right != null && quoted !== right
                const isQuick = optKey === 'quick'
                return (
                  <div style={{ background: isQuick ? '#FBF3DC' : '#F4F9F7', border:'1.5px solid ' + (isQuick ? '#E8D9A8' : '#DCEBE4'), borderRadius:10, padding:'10px 14px', marginBottom:10 }}>
                    <div style={{ color:'#1A3D34', fontWeight:900, fontSize:12.5, marginBottom:6 }}>🧾 ما طلبه العميل</div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:'6px 18px', fontSize:12.5, fontWeight:700, color:'#3A4D47' }}>
                      {optLabel && <span>الخيار: <b style={{ color: isQuick ? '#9A5B25' : '#1A7A5A' }}>{optLabel}</b></span>}
                      {quoted != null && <span>السعر المعروض عليه: <b>{quoted.toLocaleString('en-US')} ر.س</b></span>}
                      {inv > 0 && <span>حجم استثماره كما كتبه: <b>{inv.toLocaleString('en-US')} ر.س</b></span>}
                      {ci.projectKind && <span>النوع: <b>{ci.projectKind === 'expansion' ? 'توسعة نشاط قائم' : 'مشروع جديد'}</b></span>}
                    </div>
                    {mismatch && (
                      <div style={{ color:'#B4544A', fontWeight:800, fontSize:12, marginTop:7, lineHeight:1.8 }}>
                        ⚠︎ شريحة هذا الحجم سعرها {right!.toLocaleString('en-US')} ر.س لا {quoted!.toLocaleString('en-US')} — راجع الرقم قبل التسعير.
                      </div>
                    )}
                    {isQuick && (
                      <div style={{ color:'#9A5B25', fontWeight:800, fontSize:12, marginTop:7, lineHeight:1.8 }}>
                        ⚠︎ دفع ثمن الفحص السريع فقط — لا تُصدر له الدراسة الكاملة.
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* وعد «تُخصم قيمة الفحص من الدراسة» مكتوب في الـPDF الذي يستلمه العميل.
                  هنا يصير أثراً في القاعدة بدل أن يعتمد على ذاكرتك — أو على نزاع. */}
              {(() => {
                const ci = (r.client_inputs || {}) as { option?: string }
                const isFull = String(r.option_key || ci.option || '') !== 'quick'
                if (!isFull || canonicalTitle(r.service_title) !== 'دراسة الجدوى الاقتصادية') return null
                const quick = reqs.find((x: any) => x.company_id === r.company_id && x.id !== r.id
                  && canonicalTitle(x.service_title) === 'دراسة الجدوى الاقتصادية'
                  && String(x.option_key || (x.client_inputs || {}).option || '') === 'quick'
                  && ['paid', 'delivered', 'completed'].includes(String(x.status)))
                if (!quick) return null
                const paidAmt = Number(quick.price ?? quick.quoted_price ?? 990) || 990
                const already = r.credited_from === quick.id || creditFrom[r.id] === quick.id
                return (
                  <div style={{ background:'#EAF7F0', border:'1.5px solid #CBE8DA', borderRadius:10, padding:'10px 14px', marginBottom:10 }}>
                    <div style={{ color:'#1A7A5A', fontWeight:900, fontSize:12.5 }}>
                      💳 دفع {paidAmt.toLocaleString('en-US')} ر.س للفحص السريع في {fmtDate(quick.created_at)} — ووعدُك في الملف أن تُخصم بالكامل.
                    </div>
                    {already ? (
                      <div style={{ color:'#1A7A5A', fontWeight:800, fontSize:12, marginTop:6 }}>✓ الخصم مسجَّل على هذه الدراسة.</div>
                    ) : (
                      <button onClick={() => {
                        const cur = Number((edits[r.id]?.price ?? (r.price ? String(r.price) : '')) || 0)
                        if (!cur) { alert('اكتب سعر الدراسة أولاً، ثم اخصم.'); return }
                        setEdits(p => ({ ...p, [r.id]: { ...(p[r.id] || { deliverable: r.admin_deliverable || '', price: '' }), price: String(Math.max(0, cur - paidAmt)) } }))
                        setCreditFrom(p => ({ ...p, [r.id]: quick.id }))
                      }} style={{ marginTop:8, background:'#1A7A5A', color:'#fff', border:'none', padding:'7px 16px', borderRadius:24, fontFamily:'Cairo', fontWeight:900, fontSize:12, cursor:'pointer' }}>
                        اخصم {paidAmt.toLocaleString('en-US')} من السعر
                      </button>
                    )}
                  </div>
                )
              })()}

              {r.service_title === 'تجهيز ملف عرض المستثمر والتفاوض' && r.status !== 'delivered' && r.status !== 'completed' && (
                <div style={{ background:'#EAF7F0', border:'1.5px solid #D8E8E0', borderRadius:10, padding:'8px 14px', marginBottom:10, color:'#9A7B2E', fontWeight:900, fontSize:12.5 }}>
                  🎤 المرحلة ١: العرض التقديمي — حدّد مبلغه وأصدره للدفع. بعد تسليمه يظهر عقد تجهيز الملف (المرحلة ٢).
                </div>
              )}
              {r.service_title === 'دراسة الجدوى الاقتصادية' && (
                <div style={{ background:'#FBF5E8', border:'1.5px solid #E8D9A8', borderRadius:10, padding:'12px 14px', marginBottom:10 }}>
                  <div style={{ color:'#9A7B2E', fontWeight:900, fontSize:12.5, marginBottom:8 }}>📐 مدخلات دراسة الجدوى — الأرقام تُحسب برمجياً</div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))', gap:8, marginBottom:8 }}>
                    <select value={(fzIn[r.id] || {}).audience || ''} onChange={(e) => setFzIn((prev) => ({ ...prev, [r.id]: { ...(prev[r.id] || {}), audience: e.target.value } }))} style={IN_STYLE}>
                      <option value="">— لمن الدراسة؟ —</option><option value="financier">جهة تمويل</option><option value="investor">مستثمر</option><option value="regulator">جهة حكومية أو ترخيص</option><option value="internal">استخدام داخلي</option>
                    </select>
                    <select value={(fzIn[r.id] || {}).projectKind || ''} onChange={(e) => setFzIn((prev) => ({ ...prev, [r.id]: { ...(prev[r.id] || {}), projectKind: e.target.value } }))} style={IN_STYLE}>
                      <option value="">— نوع المشروع —</option><option value="new">مشروع جديد</option><option value="expansion">توسعة نشاط قائم</option>
                    </select>
                    {/* هذه الثلاثة تحدد أي أبواب تمويل تُفتح أصلاً — لا تدخل الدراسة فقط بل بوابة المطابقة */}
                    <select value={(fzIn[r.id] || {}).capexKind || ''} onChange={(e) => setFzIn((prev) => ({ ...prev, [r.id]: { ...(prev[r.id] || {}), capexKind: e.target.value } }))} style={IN_STYLE}>
                      <option value="">— أكبر بند رأسمالي —</option><option value="equipment">معدات وتجهيزات</option><option value="property">عقار</option><option value="vehicles">مركبات وأساطيل</option><option value="fitout">تشطيبات وديكور</option><option value="tech">تقنية وأنظمة</option><option value="inventory">بضاعة ومخزون</option><option value="mixed">متنوع</option>
                    </select>
                    <select value={(fzIn[r.id] || {}).propertyMode || ''} onChange={(e) => setFzIn((prev) => ({ ...prev, [r.id]: { ...(prev[r.id] || {}), propertyMode: e.target.value } }))} style={IN_STYLE}>
                      <option value="">— الموقع: إيجار أم تملّك —</option><option value="rent">إيجار</option><option value="buy">شراء عقار ضمن المشروع</option><option value="own">عقار مملوك مسبقاً</option>
                    </select>
                    <select value={(fzIn[r.id] || {}).compliance || ''} onChange={(e) => setFzIn((prev) => ({ ...prev, [r.id]: { ...(prev[r.id] || {}), compliance: e.target.value } }))} style={IN_STYLE}>
                      <option value="">— الالتزام الزكوي والضريبي —</option><option value="ok">مكتمل ومصرَّح به</option><option value="unknown">لم يُفصح عنه بعد</option>
                    </select>
                    <select value={(fzIn[r.id] || {}).imports || ''} onChange={(e) => setFzIn((prev) => ({ ...prev, [r.id]: { ...(prev[r.id] || {}), imports: e.target.value } }))} style={IN_STYLE}>
                      <option value="">— استيراد من الخارج؟ —</option><option value="no">لا يستورد</option><option value="yes">يستورد</option>
                    </select>
                    {[...FZ_TEXT, ...FZ_NUM].map((f) => (
                      <div key={f.k}>
                        <div style={{ fontSize:11, color:'#9A7B2E', fontWeight:900, marginBottom:3 }}>{f.t}</div>
                        <input value={(fzIn[r.id] || {})[f.k] || ''}
                          onChange={(e) => setFzIn((prev) => ({ ...prev, [r.id]: { ...(prev[r.id] || {}), [f.k]: e.target.value } }))}
                          style={{ ...IN_STYLE, width:'100%', boxSizing:'border-box' }} />
                      </div>
                    ))}
                  </div>
                  <button onClick={() => saveFeasibility(r.id, r.company_id)} disabled={busy === 'fz' + r.id} style={{ background:'#9A7B2E', color:'#fff', border:'none', padding:'8px 18px', borderRadius:24, fontFamily:'Cairo', fontWeight:900, fontSize:12.5, cursor:'pointer', marginLeft:8 }}>{busy === 'fz' + r.id ? 'جارٍ الحفظ...' : '💾 احفظ المدخلات'}</button>
                  <button onClick={() => matchFeasibility(r.company_id)} disabled={busy === 'mfz' + r.company_id} title="تبحث عن الجهات التي تنطبق شروطها على هذه الدراسة، وتُحفظ فتظهر داخلها" style={{ background:'#5C4A16', color:'#fff', border:'none', padding:'8px 18px', borderRadius:24, fontFamily:'Cairo', fontWeight:900, fontSize:12.5, cursor:'pointer', marginRight:8 }}>{busy === 'mfz' + r.company_id ? 'جارٍ البحث عن الجهات...' : '🏦 طابق الجهات لهذه الدراسة'}</button>
                  <button onClick={() => { const ci = (r.client_inputs || {}) as { option?: string }; const q = String(r.option_key || ci.option || '') === 'quick'; if (q && !confirm('هذا العميل دفع ثمن الفحص السريع (٩٩٠) لا الدراسة الكاملة.\n\nتوليد الدراسة الكاملة يعني تسليم عمل لم يُدفع ثمنه. متابعة؟')) return; genFeasibility(r.company_id) }} disabled={busy === 'gfz' + r.company_id} style={{ background:'#1A3D34', color:'#fff', border:'none', padding:'8px 18px', borderRadius:24, fontFamily:'Cairo', fontWeight:900, fontSize:12.5, cursor:'pointer' }}>{busy === 'gfz' + r.company_id ? 'جارٍ التوليد...' : '📐 ولّد دراسة الجدوى'}</button>
                  <button onClick={() => genFeasibilityQuick(r.company_id)} disabled={busy === 'gfz' + r.company_id} title="الأرقام المحسوبة وحدها — بلا بحث سوق وبلا جهات، يخرج في ثوانٍ" style={{ background:'#9A7B2E', color:'#fff', border:'none', padding:'8px 18px', borderRadius:24, fontFamily:'Cairo', fontWeight:900, fontSize:12.5, cursor:'pointer', marginRight:8 }}>⚡ فحص ائتماني سريع</button>
                  {fzMatch[r.company_id] && (<div style={{ fontSize:12, color:'#5C4A16', marginTop:6, fontWeight:700 }}>{fzMatch[r.company_id]}</div>)}
                </div>
              )}
              {r.service_title === 'تجهيز ملف عرض المستثمر والتفاوض' && (
                <div style={{ background:'#FBF5E8', border:'1.5px solid #E8D9A8', borderRadius:10, padding:'12px 14px', marginBottom:10 }}>
                  <div style={{ color:'#9A7B2E', fontWeight:900, fontSize:12.5, marginBottom:8 }}>📊 أرقام العرض — تُدرج حرفياً وتمنع أي فراغ في الشرائح</div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))', gap:8 }}>
                    {PITCH_FIELDS.map((f) => (
                      <input key={f.k} placeholder={f.t} value={(pitchIn[r.id] || {})[f.k] || ''}
                        onChange={(e) => setPitchIn((prev) => ({ ...prev, [r.id]: { ...(prev[r.id] || {}), [f.k]: e.target.value } }))}
                        style={{ padding:'8px 10px', borderRadius:8, border:'1.5px solid #E8D9A8', fontFamily:'Cairo', fontSize:12.5 }} />
                    ))}
                  </div>
                  <button onClick={() => savePitchNums(r.id, r.company_id)} disabled={busy === 'pn' + r.id} style={{ marginTop:10, background:'#9A7B2E', color:'#fff', border:'none', padding:'8px 18px', borderRadius:24, fontFamily:'Cairo', fontWeight:900, fontSize:12.5, cursor:'pointer' }}>{busy === 'pn' + r.id ? 'جارٍ الحفظ...' : '💾 احفظ أرقام العرض'}</button>
                </div>
              )}
              {(!COMMISSION_SERVICES[r.service_title] || (r.service_title === 'تجهيز ملف عرض المستثمر والتفاوض' && !r.delivered_at)) && (<>
              <button onClick={() => prepare(r.id)} disabled={busy === r.id} style={{ background:'#C9A84C', color:'#1A3D34', border:'none', padding:'9px 20px', borderRadius:30, fontFamily:'Cairo', fontWeight:900, fontSize:13, cursor:'pointer', marginBottom:12 }}>{busy === r.id ? 'جارٍ التجهيز...' : '✨ جهّز الخدمة بمنهجية مُرضي'}</button>

              {r.service_title === 'إعداد القوائم المالية المعتمدة' && (
                <div style={{ marginBottom:14 }}>
                  <button onClick={() => openInputs(r)} style={{ background:'#1A3D34', color:'#fff', border:'none', padding:'8px 18px', borderRadius:30, fontFamily:'Cairo', fontWeight:900, fontSize:12.5, cursor:'pointer' }}>
                    {inputsOpen[r.id] ? '▲ إخفاء أرقام العميل' : '🔢 أدخل أرقام العميل لتوليد قوائم فعلية'}
                  </button>

                  {inputsOpen[r.id] && inputsData[r.id] && (() => {
                    const cur = inputsData[r.id]
                    const setKind = (k: string) => setInputsData(p => ({ ...p, [r.id]: { ...cur, activity_kind: k } }))
                    const setVal = (k: string, v: string) => setInputsData(p => { const c = p[r.id] || cur; return { ...p, [r.id]: { ...c, inputs: { ...c.inputs, [k]: v } } } })
                    const flds = fieldsFor(cur.activity_kind)
                    const groups: Record<string, string> = { income: '📈 الدخل والتكاليف', assets: '🏦 الأصول', liabilities: '📉 الالتزامات', equity: '💼 حقوق الملكية' }
                    const inp: React.CSSProperties = { width:'100%', border:'1.5px solid #D8E8E0', borderRadius:8, padding:'8px 10px', fontFamily:'Cairo', fontSize:12.5, background:'#fff' }
                    return (
                      <div style={{ background:'#F7FAF9', border:'2px solid #D8E8E0', borderRadius:12, padding:'16px 18px', marginTop:10 }}>
                        <div style={{ color:'#6B8A80', fontSize:12, fontWeight:700, marginBottom:6 }}>نوع النشاط (يكيّف القوائم تلقائياً)</div>
                        <select value={cur.activity_kind} onChange={e => setKind(e.target.value)} style={{ ...inp, marginBottom:16 }}>
                          {ACTIVITIES.map(a => <option key={a.key} value={a.key}>{a.name}</option>)}
                        </select>

                        {(['income','assets','liabilities','equity'] as const).map(g => {
                          const gf = flds.filter(f => f.group === g)
                          if (gf.length === 0) return null
                          return (
                            <div key={g} style={{ marginBottom:14 }}>
                              <div style={{ color:'#1A3D34', fontWeight:900, fontSize:12.5, marginBottom:8 }}>{groups[g]}</div>
                              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                                {gf.map(f => (
                                  <div key={f.key}>
                                    <div style={{ color:'#6B8A80', fontSize:11.5, marginBottom:3 }}>{f.label}{f.hint && <span style={{ color:'#B0C4BC' }}> · {f.hint}</span>}</div>
                                    <div style={{ display:'flex', gap:6 }}>
                                      <input type="number" value={cur.inputs[f.key + '__y1'] ?? ''} onChange={e => setVal(f.key + '__y1', e.target.value)} placeholder="سنة ١" style={inp} />
                                      {(() => {
                                        const carry: Record<string,string> = { opening_cash:'cash_in_banks', opening_ar:'accounts_receivable', opening_inventory:'inventory', opening_ap:'accounts_payable', opening_fixed_assets:'fixed_assets', eos_opening:'eos_provision', opening_vat:'vat_due', opening_zakat:'zakat_due' }
                                        if (carry[f.key]) {
                                          const v = cur.inputs[carry[f.key] + '__y1'] ?? ''
                                          return <input type="number" value={v} readOnly title="يُنقل تلقائياً من ختام السنة الأولى" placeholder="من ختام سنة ١" style={{ ...inp, background:'#EFF5F2', color:'#6B8A80', cursor:'not-allowed' }} />
                                        }
                                        if (f.key === 'opening_retained_earnings') {
                                          const orе = Number(cur.inputs['opening_retained_earnings__y1'] || 0)
                                          const rev = Number(cur.inputs['annual_revenue__y1'] || 0)
                                          const openInv = Number(cur.inputs['opening_inventory__y1'] || 0)
                                          const purch = Number(cur.inputs['purchases__y1'] || 0)
                                          const closeInv = Number(cur.inputs['close_inventory__y1'] || 0)
                                          const cogs = openInv + purch - closeInv
                                          const opex = Number(cur.inputs['operating_expenses__y1'] || 0)
                                          const dep = Number(cur.inputs['depreciation__y1'] || 0)
                                          const zak = Number(cur.inputs['zakat_due__y1'] || 0)
                                          const dist = Number(cur.inputs['distributions__y1'] || 0)
                                          const net = rev - cogs - opex - dep - zak
                                          const closing = orе + net - dist
                                          return <input type="number" value={closing || ''} readOnly title="يُحسب تلقائياً: أرباح مرحّلة سنة ١ + صافي ربح سنة ١ − توزيعات سنة ١" placeholder="محسوب من سنة ١" style={{ ...inp, background:'#EFF5F2', color:'#6B8A80', cursor:'not-allowed' }} />
                                        }
                                        return <input type="number" value={cur.inputs[f.key + '__y2'] ?? ''} onChange={e => setVal(f.key + '__y2', e.target.value)} placeholder="سنة ٢" style={inp} />
                                      })()}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )
                        })}

{(() => {
                          const allKeys = flds.map(f => f.key)
                          const filled = allKeys.filter(k => (cur.inputs[k + '__y1'] && cur.inputs[k + '__y1'] !== '') || (cur.inputs[k] && cur.inputs[k] !== '')).length
                          const pct = allKeys.length ? Math.round(filled / allKeys.length * 100) : 0
                          const col = pct >= 80 ? '#2E9E7B' : pct >= 50 ? '#C9A84C' : '#C0564B'
                          return (
                            <div style={{ marginBottom:12 }}>
                              <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, fontWeight:700, color:col, marginBottom:4 }}><span>نسبة اكتمال المدخلات (سنة ١)</span><span>{pct}%</span></div>
                              <div style={{ height:8, background:'#EAF2EE', borderRadius:20, overflow:'hidden' }}><div style={{ width:pct+'%', height:'100%', background:col }} /></div>
                            </div>
                          )
                        })()}
                        <div style={{ marginBottom:12, background:'#F0F7F4', border:'1.5px solid #D8E8E0', borderRadius:10, padding:'12px 14px' }}>
                          <div style={{ color:'#1A3D34', fontWeight:900, fontSize:12.5, marginBottom:8 }}>❓ أسئلة توجيهية — اختر إجابة العميل</div>
                          {[
                            { q:'مصدر فرق حقوق الملكية (حساب المالك)؟', opts:['إيداع شخصي من المالك → يُسجّل حساب مالك جاري','أرباح سنوات سابقة غير مسجّلة → تُضاف للأرباح المرحّلة','قرض/تمويل غير مُدرج → يُسجّل التزام','غير معروف → يحتاج مراجعة محاسب'] },
                            { q:'هل ضمن المصروفات بنود شخصية للمالك؟', opts:['نعم، سيارة/مصاريف عائلية → تُفصل فيرتفع الربح','لا، كلها مصاريف تشغيلية فعلية'] },
                            { q:'المبيعات النقدية موثّقة بفواتير؟', opts:['نعم، كلها مفوترة','لا، جزء غير موثّق → يُسجّل فيرتفع الإيراد'] },
                            { q:'المخزون الختامي مبني على؟', opts:['جرد فعلي موثّق','تقدير تقريبي → يحتاج جرد'] },
                          ].map((item, qi) => (
                            <div key={qi} style={{ marginBottom:8 }}>
                              <div style={{ color:'#3A5A50', fontSize:11.5, fontWeight:700, marginBottom:4 }}>{item.q}</div>
                              <select onChange={e => { if(e.target.value) setVal('advisor_notes', ((cur.inputs['advisor_notes']||'') + '\n• ' + item.q + ' ' + e.target.value)) }} defaultValue="" style={{ width:'100%', border:'1.5px solid #D8E8E0', borderRadius:8, padding:'7px 10px', fontFamily:'Cairo', fontSize:12, background:'#fff' }}>
                                <option value="">— اختر —</option>
                                {item.opts.map((o,oi) => <option key={oi} value={o}>{o}</option>)}
                              </select>
                            </div>
                          ))}
                        </div>
                        <div style={{ marginBottom:12 }}>
                          <div style={{ color:'#1A3D34', fontWeight:900, fontSize:12.5, marginBottom:6 }}>📝 ملاحظات المستشار (إجابات العميل على الأسئلة)</div>
                          <textarea value={cur.inputs['advisor_notes'] ?? ''} onChange={e => setVal('advisor_notes', e.target.value)} placeholder="مثال: فرق حقوق الملكية 3 مليون = إيداع شخصي من المالك سنة سابقة. المصروفات تشمل 200 ألف سيارة خاصة." style={{ width:'100%', minHeight:70, border:'1.5px solid #D8E8E0', borderRadius:8, padding:'8px 10px', fontFamily:'Cairo', fontSize:12.5, lineHeight:1.8, background:'#fff' }} />
                        </div>
                        <div style={{ marginTop:12, marginBottom:6, padding:'10px 12px', background:'#FBF7EC', border:'1px solid #E8D9A8', borderRadius:8 }}>
                          <div style={{ fontFamily:'Cairo', fontSize:12.5, fontWeight:900, color:'#8A6D1A', marginBottom:6 }}>تصنيف فرق حقوق الملكية (إن ظهر فرق كبير يحتاج مراجعة)</div>
                          <div style={{ fontFamily:'Cairo', fontSize:11.5, color:'#6B5A2A', marginBottom:8 }}>اسأل العميل عن مصدر الفرق، ثم اختر الإجابة — تُضاف تلقائياً للملاحظات ويصنّفها النظام في بندها الصحيح.</div>
                          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                            <select onChange={e => { if(e.target.value){ setVal('advisor_notes', ((cur.inputs['advisor_notes']||'') + '\n' + e.target.value)); e.target.value=''; } }} defaultValue="" style={{ flex:1, minWidth:200, border:'1.5px solid #D8E8E0', borderRadius:8, padding:'7px 10px', fontFamily:'Cairo', fontSize:12, background:'#fff' }}>
                              <option value="" disabled>مصدر فرق السنة الأولى...</option>
                              <option value="gap_y1=owner_deposit">إيداع شخصي من المالك ← حساب مالك جاري</option>
                              <option value="gap_y1=prior_profit">أرباح سنوات سابقة غير مسحوبة ← أرباح مرحّلة</option>
                              <option value="gap_y1=loan">قرض أو تمويل خارجي ← التزام</option>
                              <option value="gap_y1=unlisted_assets">أصول مملوكة غير مُدرجة ← أصول</option>
                              <option value="gap_y1=unsure">غير متأكد ← يُترك للمراجعة</option>
                            </select>
                            <select onChange={e => { if(e.target.value){ setVal('advisor_notes', ((cur.inputs['advisor_notes']||'') + '\n' + e.target.value)); e.target.value=''; } }} defaultValue="" style={{ flex:1, minWidth:200, border:'1.5px solid #D8E8E0', borderRadius:8, padding:'7px 10px', fontFamily:'Cairo', fontSize:12, background:'#fff' }}>
                              <option value="" disabled>مصدر فرق السنة الثانية...</option>
                              <option value="gap_y2=owner_deposit">إيداع شخصي من المالك ← حساب مالك جاري</option>
                              <option value="gap_y2=prior_profit">أرباح سنوات سابقة غير مسحوبة ← أرباح مرحّلة</option>
                              <option value="gap_y2=loan">قرض أو تمويل خارجي ← التزام</option>
                              <option value="gap_y2=unlisted_assets">أصول مملوكة غير مُدرجة ← أصول</option>
                              <option value="gap_y2=unsure">غير متأكد ← يُترك للمراجعة</option>
                            </select>
                          </div>
                        </div>
                        <button onClick={() => saveInputs(r)} disabled={busy === r.id} style={{ background:'#2E9E7B', color:'#fff', border:'none', padding:'9px 22px', borderRadius:30, fontFamily:'Cairo', fontWeight:900, fontSize:13, cursor:'pointer', marginTop:6 }}>{busy === r.id ? 'جارٍ الحفظ...' : '💾 احفظ الأرقام'}</button>
                        <div style={{ color:'#9DB3AB', fontSize:11.5, marginTop:8, lineHeight:1.7 }}>اترك أي حقل فارغاً إن لم ينطبق. بعد الحفظ، اضغط «جهّز الخدمة» لتوليد القوائم من هذي الأرقام.</div>
                      </div>
                    )
                  })()}
                </div>
              )}

              {integrity[r.id] && (() => {
                const ig = integrity[r.id]
                const fe = fixEdits[r.id] || {}
                const setFe = (k: string, v: string) => setFixEdits(p => ({ ...p, [r.id]: { ...fe, [k]: v } }))
                const inp: React.CSSProperties = { width:'100%', border:'1.5px solid #E8D9A8', borderRadius:10, padding:'9px 12px', fontFamily:'Cairo', fontSize:13, background:'#fff' }
                return (
                  <div style={{ background:'#FBF5E8', border:'2px solid #E8D9A8', borderRadius:12, padding:'16px 18px', marginBottom:14 }}>
                    <div style={{ color:'#9A7B2E', fontWeight:900, fontSize:14, marginBottom:10 }}>⚠️ تعذّر التوليد — تناقض في البيانات</div>
                    {(ig.issues || []).map((iss: any, i: number) => (
                      <div key={i} style={{ background:'#fff', borderRadius:10, padding:'10px 14px', marginBottom:8 }}>
                        <div style={{ color:'#C0564B', fontWeight:900, fontSize:13, marginBottom:4 }}>{iss.title}</div>
                        <div style={{ color:'#5C4A1F', fontSize:12.5, lineHeight:1.9 }}>{iss.detail}</div>
                      </div>
                    ))}
                    <div style={{ color:'#8A6D1A', fontSize:12.5, fontWeight:900, margin:'14px 0 8px' }}>صحّح بناءً على مستند رسمي:</div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:10 }}>
                      <div>
                        <div style={{ color:'#8A6D1A', fontSize:11.5, marginBottom:4 }}>أصل التمويل</div>
                        <input type="number" value={fe.original_loan_amount ?? ''} onChange={ev => setFe('original_loan_amount', ev.target.value)} style={inp} />
                      </div>
                      <div>
                        <div style={{ color:'#8A6D1A', fontSize:11.5, marginBottom:4 }}>المتبقي من الدين</div>
                        <input type="number" value={fe.debt_remaining ?? ''} onChange={ev => setFe('debt_remaining', ev.target.value)} style={inp} />
                      </div>
                      <div>
                        <div style={{ color:'#8A6D1A', fontSize:11.5, marginBottom:4 }}>الإيراد السنوي</div>
                        <input type="number" value={fe.annual_revenue ?? ''} onChange={ev => setFe('annual_revenue', ev.target.value)} style={inp} />
                      </div>
                    </div>
                    <div style={{ color:'#8A6D1A', fontSize:11.5, marginBottom:4 }}>مصدر التصحيح (إلزامي)</div>
                    <input value={fe.source_note ?? ''} onChange={ev => setFe('source_note', ev.target.value)} placeholder="مثال: كشف رسمي من الجهة الممولة بتاريخ 2026/07/14" style={{ ...inp, marginBottom:12 }} />
                    <button onClick={() => saveCorrection(r.id, ig.companyId)} disabled={busy === r.id} style={{ background:'#9A7B2E', color:'#fff', border:'none', padding:'9px 22px', borderRadius:30, fontFamily:'Cairo', fontWeight:900, fontSize:13, cursor:'pointer' }}>{busy === r.id ? 'جارٍ...' : '💾 اعتمد التصحيح وولّد'}</button>
                  </div>
                )
              })()}

              <textarea value={e.deliverable} onChange={(ev) => setEdits(p => ({ ...p, [r.id]: { ...e, deliverable: ev.target.value } }))} placeholder="محتوى الخدمة (يُجهّز بالذكاء أو اكتبه يدوياً)..." style={{ width:'100%', minHeight:140, border:'1.5px solid #EAF2EE', borderRadius:12, padding:12, fontFamily:'Cairo', fontSize:13, lineHeight:1.8, color:'#1A3D34', marginBottom:10 }} />

              <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
                <input value={e.price} onChange={(ev) => setEdits(p => ({ ...p, [r.id]: { ...e, price: ev.target.value } }))} placeholder="السعر (ر.س)" type="number" style={{ width:140, border:'1.5px solid #EAF2EE', borderRadius:30, padding:'9px 16px', fontFamily:'Cairo', fontSize:13 }} />
                <button onClick={() => save(r.id, e.deliverable, e.price)} disabled={busy === r.id} style={{ background:'transparent', color:'#6B8A80', border:'1.5px solid #E8F5EF', padding:'9px 20px', borderRadius:30, fontFamily:'Cairo', fontWeight:700, fontSize:13, cursor:'pointer' }}>حفظ مسودّة</button>
                {r.service_title === 'تجهيز ملف عرض المستثمر والتفاوض' && (
                  <button onClick={() => showDeck(r.id, e.deliverable)} disabled={busy === r.id}
                    style={{ background:'#1A3D34', color:'#C9A84C', border:'none', padding:'9px 22px', borderRadius:30, fontFamily:'Cairo', fontWeight:900, fontSize:13, cursor:'pointer' }}>🎞️ اعرض الشرائح</button>
                )}
                <button onClick={() => { const w = window.open('', '_blank'); if (w) { w.document.write(buildPdfHtml(r.service_title, injectTables(r.id, e.deliverable))); w.document.close() } }} disabled={!e.deliverable} style={{ background:'#2E9E7B', color:'#fff', border:'none', padding:'9px 20px', borderRadius:30, fontFamily:'Cairo', fontWeight:900, fontSize:13, cursor:'pointer' }}>📄 تصدير PDF</button>
                <button onClick={() => save(r.id, e.deliverable, e.price, 'priced')} disabled={busy === r.id || !e.price} title={!e.price ? 'حدّد السعر أولاً' : ''} style={{ background:'#C9A84C', color:'#1A3D34', border:'none', padding:'9px 22px', borderRadius:30, fontFamily:'Cairo', fontWeight:900, fontSize:13, cursor:'pointer' }}>💰 أصدر للدفع</button>
                <button onClick={() => save(r.id, e.deliverable, e.price, 'delivered')} disabled={busy === r.id || !e.deliverable} style={{ background:'#2E9E7B', color:'#fff', border:'none', padding:'9px 22px', borderRadius:30, fontFamily:'Cairo', fontWeight:900, fontSize:13, cursor:'pointer' }}>📤 إصدار مباشر</button>
                {r.status === 'paid' && <button onClick={() => save(r.id, e.deliverable, e.price, 'delivered')} disabled={busy === r.id || !e.deliverable} style={{ background:'#1E7A5A', color:'#fff', border:'none', padding:'9px 22px', borderRadius:30, fontFamily:'Cairo', fontWeight:900, fontSize:13, cursor:'pointer' }}>🔓 سلّم المحتوى</button>}
                {r.status === 'delivered' && <button onClick={() => save(r.id, e.deliverable, e.price, 'completed')} disabled={busy === r.id} style={{ background:'#1A3D34', color:'#fff', border:'none', padding:'9px 22px', borderRadius:30, fontFamily:'Cairo', fontWeight:900, fontSize:13, cursor:'pointer' }}>🏆 إتمام</button>}
                {r.status !== 'completed' && r.status !== 'rejected' && r.status !== 'delivered' && <button onClick={() => { if (confirm('هل أنت متأكد من رفض هذه الخدمة؟')) save(r.id, e.deliverable, e.price, 'rejected') }} disabled={busy === r.id} style={{ background:'transparent', color:'#C0564B', border:'1.5px solid #F0D5D1', padding:'9px 20px', borderRadius:30, fontFamily:'Cairo', fontWeight:700, fontSize:13, cursor:'pointer' }}>✕ رفض الخدمة</button>}
              </div>
              </>)}
              {COMMISSION_SERVICES[r.service_title] && (r.service_title !== 'تجهيز ملف عرض المستثمر والتفاوض' || !!r.delivered_at) && (() => {
                const c = contracts[r.id]
                return (<>
                <div style={{ marginTop:16 }}>
                  <input type="number" value={fundAmt[r.id] || ''} onChange={e => setFundAmt(p => ({ ...p, [r.id]: e.target.value }))} placeholder="المبلغ المطلوب (ر.س)" style={{ padding:'9px 14px', borderRadius:20, border:'1.5px solid #D9E5DF', fontFamily:'Cairo', fontSize:12.5, width:170, marginLeft:8 }} /><input type="text" value={fundPurpose[r.id] || ''} onChange={e => setFundPurpose(p => ({ ...p, [r.id]: e.target.value }))} placeholder="الغرض من التمويل" style={{ padding:'9px 14px', borderRadius:20, border:'1.5px solid #D9E5DF', fontFamily:'Cairo', fontSize:12.5, width:230, marginLeft:8 }} />{r.service_title === 'تجهيز صفقة التملّك والتفاوض' && (<><button onClick={() => generateFile(r, 'intake')} disabled={busy === r.id} style={{ background:'#2E9E7B', color:'#fff', border:'none', padding:'9px 20px', borderRadius:30, fontFamily:'Cairo', fontWeight:900, fontSize:13, cursor:'pointer', marginInlineEnd:8 }}>{busy === r.id ? 'جارٍ التوليد...' : 'قائمة المستندات والأسئلة'}</button><button onClick={() => generateFile(r, 'negotiation')} disabled={busy === r.id} style={{ background:'#6B4E1E', color:'#fff', border:'none', padding:'9px 20px', borderRadius:30, fontFamily:'Cairo', fontWeight:900, fontSize:13, cursor:'pointer', marginInlineEnd:8 }}>{busy === r.id ? 'جارٍ التوليد...' : 'ورقة الموقف التفاوضي (سرّية)'}</button><button onClick={() => generateFile(r, 'valuation')} disabled={busy === r.id} style={{ background:'#9A7B2E', color:'#fff', border:'none', padding:'9px 20px', borderRadius:30, fontFamily:'Cairo', fontWeight:900, fontSize:13, cursor:'pointer', marginInlineEnd:8 }}>{busy === r.id ? 'جارٍ التوليد...' : 'جهّز التقييم المستقل'}</button></>)}<button onClick={() => generateFile(r)} disabled={busy === r.id} style={{ background:'#1A3D34', color:'#fff', border:'none', padding:'9px 20px', borderRadius:30, fontFamily:'Cairo', fontWeight:900, fontSize:13, cursor:'pointer' }}>{busy === r.id ? 'جارٍ التوليد...' : '📄 جهّز الملف الاحترافي'}</button>{r.service_title === 'تجهيز ملف عرض المستثمر والتفاوض' && (<button onClick={() => exportDeck(r.id, e.deliverable, r.company_id)} disabled={busy === 'dl' + r.id} style={{ background:'#9A7B2E', color:'#fff', border:'none', padding:'9px 20px', borderRadius:30, fontFamily:'Cairo', fontWeight:900, fontSize:13, cursor:'pointer', marginInlineStart:8 }}>{busy === 'dl' + r.id ? 'جارٍ التصدير...' : '📎 صدّر الشرائح وارفعها'}</button>)}
                </div>
                {(() => {
                if (!c) {
                  return (
                    <div style={{ marginTop:16, paddingTop:16, borderTop:'1px dashed #EAD9A8' }}>
                      <div style={{ color:'#9A7B2E', fontWeight:900, fontSize:13, marginBottom:8 }}>📄 هذه خدمة بعمولة نجاح — تحتاج عقداً</div>
                      <button onClick={() => createContract(r)} disabled={busy === r.id} style={{ background:'#C9A84C', color:'#1A3D34', border:'none', padding:'9px 20px', borderRadius:30, fontFamily:'Cairo', fontWeight:900, fontSize:13, cursor:'pointer' }}>إنشاء مسودّة العقد</button>
                    </div>
                  )
                }
                const ce = cEdits[c.id] || {}
                const val = (k: string) => ce[k] !== undefined ? ce[k] : (c[k] ?? '')
                const setC = (k: string, v: string) => setCEdits(p => ({ ...p, [c.id]: { ...ce, [k]: v } }))
                const cStat: Record<string, string> = { draft: '📝 مسودّة', issued: '📤 صادر للعميل', signed: '✍️ وقّعه العميل', completed: '🏆 مكتمل (عمولة)' }
                return (
                  <div style={{ marginTop:16, paddingTop:16, borderTop:'1px dashed #EAD9A8' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                      <div style={{ color:'#9A7B2E', fontWeight:900, fontSize:14 }}>📄 عقد {c.contract_type === 'investment' ? 'تجهيز ملف استثماري' : 'تجهيز ملف تمويلي'}</div>
                      <span style={{ fontSize:12, fontWeight:700, color:'#6B8A80' }}>{cStat[c.status] || c.status}</span>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10 }}>
                      <input value={val('client_name')} onChange={e=>setC('client_name', e.target.value)} placeholder="اسم العميل (الطرف الثاني)" style={{ border:'1.5px solid #EAF2EE', borderRadius:10, padding:'8px 12px', fontFamily:'Cairo', fontSize:12.5 }} />
                      <input value={val('client_id_number')} onChange={e=>setC('client_id_number', e.target.value)} placeholder="رقم الهوية" style={{ border:'1.5px solid #EAF2EE', borderRadius:10, padding:'8px 12px', fontFamily:'Cairo', fontSize:12.5 }} />
                      <input value={val('establishment_name')} onChange={e=>setC('establishment_name', e.target.value)} placeholder="اسم المنشأة" style={{ border:'1.5px solid #EAF2EE', borderRadius:10, padding:'8px 12px', fontFamily:'Cairo', fontSize:12.5 }} />
                      <input value={val('establishment_cr')} onChange={e=>setC('establishment_cr', e.target.value)} placeholder="السجل التجاري" style={{ border:'1.5px solid #EAF2EE', borderRadius:10, padding:'8px 12px', fontFamily:'Cairo', fontSize:12.5 }} />
                    </div>
                    {(() => {
                      const ft = String(val('fee_type') || 'percent')
                      const showPct = ft === 'percent' || ft === 'both'
                      const showFix = ft === 'fixed' || ft === 'both'
                      const BASE: Record<string, string> = { financing: 'التمويل المنفَّذ', deal: 'قيمة الصفقة', saving: 'الوفر المتحقق', round: 'قيمة الجولة' }
                      const defBase = c.contract_type === 'acquisition' ? 'deal' : c.contract_type === 'investment' ? 'round' : 'financing'
                      const inp = { border:'1.5px solid #EAF2EE', borderRadius:10, padding:'8px 12px', fontFamily:'Cairo', fontSize:12.5 } as const
                      return (
                        <div style={{ background:'#FBFAF5', border:'1px solid #EAD9A8', borderRadius:12, padding:'12px 14px', marginBottom:10 }}>
                          <div style={{ color:'#9A7B2E', fontWeight:900, fontSize:12.5, marginBottom:8 }}>آلية الأتعاب — أنت تحددها، والعقد يُكتب منها</div>
                          <div style={{ display:'flex', gap:6, marginBottom:10, flexWrap:'wrap' }}>
                            {([['percent','نسبة نجاح فقط'],['fixed','مبلغ ثابت فقط'],['both','ثابت + نسبة نجاح']] as const).map(([k, lb]) => (
                              <button key={k} onClick={()=>setC('fee_type', k)} style={{ padding:'7px 14px', borderRadius:30, cursor:'pointer', fontFamily:'Cairo', fontWeight:900, fontSize:12,
                                background: ft === k ? '#1A3D34' : '#fff', color: ft === k ? '#fff' : '#6B8A80', border: ft === k ? '1.5px solid #1A3D34' : '1.5px solid #EAF2EE' }}>{lb}</button>
                            ))}
                          </div>
                          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                            {showFix && <input value={val('fixed_amount')} onChange={e=>setC('fixed_amount', e.target.value)} type="number" placeholder="المبلغ الثابت (ريال)" style={inp} />}
                            {showPct && <input value={val('fee_percent')} onChange={e=>setC('fee_percent', e.target.value)} type="number" step="0.1" placeholder="نسبة النجاح ٪" style={inp} />}
                            {showPct && <input value={val('success_min')} onChange={e=>setC('success_min', e.target.value)} type="number" placeholder="حد أدنى لأتعاب النجاح (اختياري)" style={inp} />}
                            {showPct && (
                              <select value={String(val('success_base') || defBase)} onChange={e=>setC('success_base', e.target.value)} style={{ ...inp, background:'#fff' }}>
                                {Object.entries(BASE).map(([k, lb]) => <option key={k} value={k}>النسبة على: {lb}</option>)}
                              </select>
                            )}
                          </div>
                          <div style={{ color:'#6B8A80', fontSize:11.5, lineHeight:1.8, marginTop:8 }}>
                            {ft === 'both' ? 'الثابت يُستحق عند التوقيع ولا يُخصم من نسبة النجاح — ويُنص على ذلك في العقد صراحةً.'
                              : ft === 'fixed' ? 'مبلغ واحد عند التوقيع، وينص العقد على ألا نسبة نجاح فيه.'
                              : 'لا مقدّم — لا تُستحق الأتعاب إلا بعد وصول التمويل أو إتمام الصفقة.'}
                          </div>
                        </div>
                      )
                    })()}
                    <div style={{ color:'#9DB3AB', fontSize:11.5, fontWeight:700, marginBottom:4 }}>نص العقد يُولَّد من الحقول أعلاه عند الحفظ — عدّل الحقول لا النص</div>
                    <textarea readOnly value={String(c.contract_body || '')} style={{ width:'100%', minHeight:160, border:'1.5px solid #EAF2EE', borderRadius:12, padding:12, fontFamily:'Cairo', fontSize:12, lineHeight:1.9, color:'#1A3D34', marginBottom:10, whiteSpace:'pre-wrap', background:'#FCFDFC' }} />
                    <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                      <button onClick={() => saveContract(c)} disabled={busy === r.id} style={{ background:'transparent', color:'#6B8A80', border:'1.5px solid #E8F5EF', padding:'8px 18px', borderRadius:30, fontFamily:'Cairo', fontWeight:700, fontSize:12.5, cursor:'pointer' }}>حفظ المسودّة</button>
                      <button onClick={() => saveContract(c, 'issued')} disabled={busy === r.id} style={{ background:'#2E9E7B', color:'#fff', border:'none', padding:'8px 20px', borderRadius:30, fontFamily:'Cairo', fontWeight:900, fontSize:12.5, cursor:'pointer' }}>📤 إصدار العقد للعميل</button>
                      {(c.status === 'signed' || c.status === 'issued') && <button onClick={() => saveContract(c, 'completed')} disabled={busy === r.id} style={{ background:'#1A3D34', color:'#fff', border:'none', padding:'8px 20px', borderRadius:30, fontFamily:'Cairo', fontWeight:900, fontSize:12.5, cursor:'pointer' }}>🏆 إتمام (استحقاق العمولة)</button>}
                    </div>
                    {c.signed_file_url && <a href={'/api/contract-file?redirect=1&id=' + c.id} target="_blank" rel="noopener noreferrer" style={{ display:'inline-block', marginTop:8, color:'#2E9E7B', fontWeight:700, fontSize:12.5 }}>📎 عرض النسخة الموقّعة من العميل</a>}
                  </div>
                )
                })()}
                </>)
              })()}
            </div>
          )
        })}
      </div>
    </div>
  )
}
