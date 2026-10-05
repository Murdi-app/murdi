'use client'
import { useEffect, useState } from 'react'
import AdminNav from '@/components/AdminNav'

// أتعاب الاستكمال — موافقات الجهات، وما قُيِّد، والفاتورة الضريبية المسوّدة تنتظر اعتماد المالك.
type Co = { company_name: string | null; cr_number: string | null; owner_name: string | null; city: string | null }
type F = {
  id: string; funder_name: string; approved_amount: number; expected_disbursement: string; approved_logged_by: string | null
  booked_amount: number | null; booked_at: string | null; fee_pct: number | null; vat_rate: number | null; vat_inclusive: boolean | null
  fee_net: number | null; fee_vat: number | null; fee_total: number | null; invoice_no: string | null; invoice_status: string
  invoice_approved_at: string | null; company: Co | null
}
const G = '#1A3D34'
const m = (n: number | null | undefined) => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })
const d = (s: string | null) => s ? new Date(s).toLocaleDateString('ar-SA', { timeZone: 'Asia/Riyadh', day: 'numeric', month: 'long', year: 'numeric' }) : '—'
const ST: Record<string, string> = { none: 'لم يُقيَّد بعد', draft: 'مسوّدة تنتظر اعتمادك', approved: 'معتمدة', cancelled: 'ملغاة' }

export default function FeesPage() {
  const [rows, setRows] = useState<F[]>([])
  const [vat, setVat] = useState('')
  const [err, setErr] = useState('')
  const [show, setShow] = useState('')
  const load = () => fetch('/api/admin/fees').then(async r => { const j = await r.json().catch(() => ({})); if (!r.ok) setErr(j.error || 'تعذّر التحميل'); else { setRows(j.fees || []); setVat(j.seller_vat || '') } })
  useEffect(() => { void load() }, [])
  const act = async (body: Record<string, unknown>) => {
    setErr('')
    const r = await fetch('/api/admin/fees', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const j = await r.json().catch(() => ({})); if (!r.ok) setErr(j.error || 'تعذّر'); else load()
  }
  return (
    <div dir="rtl" style={{ fontFamily: 'Cairo,sans-serif', maxWidth: 940, margin: '0 auto', padding: '24px 16px 60px', color: G }}>
      <AdminNav />
      <h1 style={{ fontSize: 22, fontWeight: 900, margin: '0 0 4px' }}>🧾 أتعاب الاستكمال</h1>
      <p style={{ fontSize: 13, color: '#6B8A80', margin: '0 0 12px', lineHeight: 1.9 }}>
        تسجّل رغد «وافقت الجهة» (الجهة · المبلغ · موعد الصرف)، ثم «قُيِّد التمويل» فتُحسب الأتعاب من نسبة عقد العميل وتصدر فاتورتها مسوّدةً هنا. لا يخرج شيء للعميل قبل اعتمادك.
      </p>
      <div style={{ background: '#fff', border: '1.5px solid #EAF2EE', borderRadius: 12, padding: '10px 14px', marginBottom: 14, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 13 }}>
        الرقم الضريبي للمنشأة (يظهر في الفاتورة):
        <input value={vat} onChange={e => setVat(e.target.value)} dir="ltr" placeholder="3xxxxxxxxxxxxx3" style={{ border: '1px solid #DDE7E2', borderRadius: 8, padding: '6px 10px', fontFamily: 'inherit' }} />
        <button onClick={() => act({ seller_vat: vat })} style={{ background: G, color: '#fff', border: 0, borderRadius: 8, padding: '6px 16px', fontFamily: 'inherit', cursor: 'pointer' }}>حفظ</button>
      </div>
      {err && <div style={{ color: '#C0564B', marginBottom: 10 }}>{err}</div>}
      {rows.length === 0 && <div style={{ color: '#8CA49B' }}>لم تُسجَّل موافقة جهةٍ بعد.</div>}
      {rows.map(f => (
        <div key={f.id} style={{ background: '#fff', border: '1.5px solid #EAF2EE', borderRadius: 14, padding: '12px 16px', marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <div>
              <b>{f.company?.company_name}</b> · {f.funder_name}
              <div style={{ fontSize: 12.5, color: '#6B8A80' }}>
                معتمد {m(f.approved_amount)} ريال · الصرف المتوقع {f.expected_disbursement} · سجّلته {f.approved_logged_by || '—'}
                {f.booked_at && <> · قُيِّد {m(f.booked_amount)} ريال في {d(f.booked_at)}</>}
              </div>
            </div>
            <span style={{ alignSelf: 'center', fontSize: 12, fontWeight: 800, color: f.invoice_status === 'draft' ? '#9A7B2E' : f.invoice_status === 'approved' ? '#1E7A5E' : '#8CA49B' }}>{ST[f.invoice_status]}</span>
          </div>
          {f.fee_total !== null && (
            <div style={{ marginTop: 8, fontSize: 13.5 }}>
              الأتعاب {f.fee_pct}٪: {m(f.fee_net)} + ضريبة {f.vat_rate}٪ {m(f.fee_vat)} = <b>{m(f.fee_total)} ريال</b> (شاملة الضريبة)
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button onClick={() => setShow(show === f.id ? '' : f.id)} style={{ background: '#fff', border: '1px solid ' + G, color: G, borderRadius: 8, padding: '6px 14px', fontFamily: 'inherit', cursor: 'pointer' }}>{show === f.id ? 'إخفاء الفاتورة' : 'عرض الفاتورة ' + f.invoice_no}</button>
                {f.invoice_status === 'draft' && <>
                  <button onClick={() => act({ id: f.id, action: 'approve' })} style={{ background: G, color: '#fff', border: 0, borderRadius: 8, padding: '6px 16px', fontFamily: 'inherit', cursor: 'pointer' }}>اعتمد الفاتورة</button>
                  <button onClick={() => act({ id: f.id, action: 'cancel' })} style={{ background: '#fff', border: '1px solid #C0564B', color: '#C0564B', borderRadius: 8, padding: '6px 14px', fontFamily: 'inherit', cursor: 'pointer' }}>إلغاء</button>
                </>}
              </div>
              {show === f.id && (
                <div style={{ border: '1px solid #DDE7E2', borderRadius: 10, padding: 16, marginTop: 10, lineHeight: 2 }}>
                  <div style={{ textAlign: 'center', fontWeight: 900, fontSize: 17 }}>فاتورة ضريبية{f.invoice_status === 'draft' ? ' — مسوّدة' : ''}</div>
                  <div>رقم الفاتورة: {f.invoice_no} · التاريخ: {d(f.booked_at)}</div>
                  <div>المورِّد: شركة حلول المرضي للاستشارات المالية · الرقم الضريبي: {vat || '— (أدخله أعلاه)'}</div>
                  <div>العميل: {f.company?.company_name} {f.company?.cr_number ? '· س.ت ' + f.company.cr_number : ''} {f.company?.city ? '· ' + f.company.city : ''}</div>
                  <div>البيان: أتعاب استكمال خدمة تجهيز ملف التمويل — {f.fee_pct}٪ من تمويلٍ قدره {m(f.booked_amount)} ريال لدى {f.funder_name}</div>
                  <div>المبلغ قبل الضريبة: {m(f.fee_net)} ريال · ضريبة القيمة المضافة ({f.vat_rate}٪): {m(f.fee_vat)} ريال · <b>الإجمالي: {m(f.fee_total)} ريال</b></div>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
