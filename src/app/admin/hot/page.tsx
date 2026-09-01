'use client'
import AdminNav from '@/components/AdminNav'
import { useEffect, useMemo, useState } from 'react'

// الفرص الساخنة — الشاشة التي حلّت محلّ «صيد العملاء» و«صيد الفرص».
// ترتيب واحد: من أقرب إلى الدفع، لا من أحدث تسجيلاً. وكل صفّ يحمل سببه
// وخطوته التالية وزرّ اتصال — فلا تحتاج الموظفة أن تسأل بماذا تبدأ.

type Row = {
  source: string; ref_id: string; name: string | null; phone: string | null
  email: string | null; company_id: string | null; tier: number
  reason: string; money: number | null; at: string | null; next_step: string
  touches: number; last_outcome: string | null; last_note: string | null
  last_at: string | null; next_action_at: string | null; state: string
}
type Stats = { due: number; untouched: number; waiting: number; closed: number; money_on_table: number }

const C = { ink: '#1A3D34', soft: '#5E7C73', line: '#E4EFEA', bg: '#F7FBF9', gold: '#C9A84C', red: '#B4622A', green: '#1A6B55' }

const TIERS: Record<number, { label: string; color: string; why: string }> = {
  1: { label: 'مال موقّع لم يُحصَّل', color: C.red, why: 'أقرب ريال إلى الحساب — العقد موقّع والأتعاب لم تصل' },
  2: { label: 'ملف مكتمل بلا عقد', color: C.gold, why: 'أتعب نفسه وأكمل بياناته، ولم يُطلب منه القرار بعد' },
  3: { label: 'أنهى التقييم ولم يُتّصل به', color: C.green, why: 'رفع يده بنفسه وكتب رقمه — أدفأ اسم في القائمة' },
  4: { label: 'سجّل ووقف', color: C.soft, why: 'دخل الباب ولم يُكمل — سؤال واحد يكشف ما أوقفه' },
}
const OUTCOMES = ['لم يرد', 'مهتم', 'طلب معاودة', 'غير مهتم', 'رقم خاطئ', 'تحوّل عميلاً']

const money = (n: number) => new Intl.NumberFormat('en-US').format(Math.round(n))
const dayCount = (d: string | null) => (d ? Math.floor((Date.now() - new Date(d).getTime()) / 86400000) : null)

export default function HotPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [view, setView] = useState<'due' | 'waiting' | 'closed'>('due')
  const [open, setOpen] = useState('')
  const [outcome, setOutcome] = useState('لم يرد')
  const [note, setNote] = useState('')
  const [when, setWhen] = useState('')
  const [busy, setBusy] = useState(false)

  const load = () => {
    fetch('/api/admin/hot')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) { setRows(d.rows || []); setStats(d.stats || null) } })
      .catch(() => {})
  }
  useEffect(load, [])

  const log = async (r: Row) => {
    setBusy(true)
    try {
      const res = await fetch('/api/admin/hot', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: r.source, ref_id: r.ref_id, outcome, note, next_action_at: when || null }),
      })
      if (res.ok) { setOpen(''); setNote(''); setWhen(''); setOutcome('لم يرد'); load() }
    } catch { /* الشبكة تسقط أحياناً — الصفّ يبقى مكانه ليُعاد */ }
    setBusy(false)
  }

  const shown = useMemo(() => rows.filter(r => r.state === view), [rows, view])

  const tile = (n: number | string, t: string, c: string) => (
    <div style={{ flex: '1 1 140px', border: '1px solid ' + C.line, borderRadius: 12, padding: '13px 15px', background: '#fff' }}>
      <div style={{ fontSize: 23, fontWeight: 900, color: c, lineHeight: 1.2 }}>{n}</div>
      <div style={{ fontSize: 11.5, color: C.soft, fontWeight: 700, marginTop: 2 }}>{t}</div>
    </div>
  )

  return (
    <div dir="rtl" style={{ fontFamily: 'Cairo,sans-serif', color: C.ink }}>
      <AdminNav />
      <h1 style={{ fontSize: 21, fontWeight: 900, margin: '0 0 4px' }}>الفرص الساخنة</h1>
      <p style={{ fontSize: 12.5, color: C.soft, margin: '0 0 16px', lineHeight: 1.8 }}>
        من هو داخل المنصة أصلاً، مرتَّباً بقربه من الدفع. لا اتصال بارد —
        كل اسم هنا عرف مُرضي بنفسه ووقف عند خطوة واحدة.
      </p>

      {stats && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 18 }}>
          {tile(stats.due, 'تنتظر اتصالاً اليوم', C.ink)}
          {tile(stats.untouched, 'لم تُلمس بعد', C.red)}
          {tile(stats.waiting, 'لها موعد معاودة', C.gold)}
          {tile(money(stats.money_on_table) + ' ﷼', 'موقّع لم يُحصَّل', C.green)}
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {([['due', 'اليوم'], ['waiting', 'تنتظر موعدها'], ['closed', 'مغلقة']] as const).map(([k, l]) => (
          <button key={k} type="button" onClick={() => setView(k)}
            style={{
              padding: '7px 16px', borderRadius: 999, cursor: 'pointer', fontFamily: 'Cairo,sans-serif',
              fontSize: 12, fontWeight: view === k ? 900 : 700,
              background: view === k ? C.ink : '#fff', color: view === k ? '#fff' : C.soft,
              border: '1px solid ' + (view === k ? C.ink : C.line),
            }}>{l}</button>
        ))}
      </div>

      {shown.length === 0 && <p style={{ fontSize: 12.5, color: C.soft }}>لا شيء هنا.</p>}

      <div style={{ display: 'grid', gap: 9 }}>
        {shown.map(r => {
          const t = TIERS[r.tier] || TIERS[4]
          const age = dayCount(r.at)
          const isOpen = open === r.source + r.ref_id
          return (
            <div key={r.source + r.ref_id}
              style={{ border: '1px solid ' + (r.tier === 1 ? '#E8C4B2' : C.line), borderRadius: 12, padding: '13px 15px', background: r.tier === 1 ? '#FFF7F3' : '#fff' }}>

              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'baseline' }}>
                <div>
                  <span style={{ fontSize: 14, fontWeight: 900 }}>{r.name || 'بلا اسم'}</span>
                  {r.phone && (
                    <a href={'tel:' + r.phone} style={{ fontSize: 12.5, color: C.green, marginInlineStart: 10, fontWeight: 800, textDecoration: 'none' }} dir="ltr">
                      📞 {r.phone}
                    </a>
                  )}
                </div>
                <span style={{ fontSize: 10.5, fontWeight: 900, color: '#fff', background: t.color, padding: '3px 10px', borderRadius: 999 }}>
                  {t.label}
                </span>
              </div>

              <div style={{ fontSize: 12, color: C.soft, marginTop: 5, lineHeight: 1.75 }}>
                {r.reason}
                {r.money ? ' · ' + money(Number(r.money)) + ' ﷼' : ''}
                {age !== null ? ' · منذ ' + age + ' يوماً' : ''}
                {r.touches > 0 ? ' · ' + r.touches + ' محاولة' : ''}
              </div>

              <div style={{ fontSize: 12.5, fontWeight: 800, marginTop: 7, color: C.ink }}>
                ← {r.next_step}
              </div>

              {r.last_outcome && (
                <div style={{ fontSize: 11.5, color: C.soft, marginTop: 6, borderTop: '1px dashed ' + C.line, paddingTop: 6 }}>
                  آخر نتيجة: <strong>{r.last_outcome}</strong>
                  {r.last_note ? ' — ' + r.last_note : ''}
                  {r.next_action_at ? ' · معاودة ' + r.next_action_at : ''}
                </div>
              )}

              {!isOpen ? (
                <button type="button" onClick={() => setOpen(r.source + r.ref_id)}
                  style={{ marginTop: 9, padding: '6px 15px', borderRadius: 8, border: '1px solid ' + C.line, background: '#fff', color: C.ink, fontFamily: 'Cairo,sans-serif', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>
                  سجّل نتيجة المكالمة
                </button>
              ) : (
                <div style={{ marginTop: 10, borderTop: '1px solid ' + C.line, paddingTop: 10 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 9 }}>
                    {OUTCOMES.map(o => (
                      <button key={o} type="button" onClick={() => setOutcome(o)}
                        style={{
                          padding: '5px 12px', borderRadius: 999, cursor: 'pointer', fontFamily: 'Cairo,sans-serif',
                          fontSize: 11.5, fontWeight: outcome === o ? 900 : 700,
                          background: outcome === o ? C.ink : '#fff', color: outcome === o ? '#fff' : C.soft,
                          border: '1px solid ' + (outcome === o ? C.ink : C.line),
                        }}>{o}</button>
                    ))}
                  </div>
                  <input value={note} onChange={e => setNote(e.target.value)} placeholder="ماذا قال؟ (اكتبي كلامه هو)"
                    style={{ width: '100%', padding: '9px 11px', borderRadius: 9, border: '1px solid ' + C.line, fontFamily: 'Cairo,sans-serif', fontSize: 12.5, color: C.ink, boxSizing: 'border-box', marginBottom: 8 }} />
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <label style={{ fontSize: 11.5, color: C.soft, fontWeight: 700 }}>معاودة يوم</label>
                    <input type="date" value={when} onChange={e => setWhen(e.target.value)}
                      style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid ' + C.line, fontFamily: 'Cairo,sans-serif', fontSize: 12, color: C.ink }} />
                    <button type="button" disabled={busy} onClick={() => log(r)}
                      style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: C.ink, color: '#fff', fontFamily: 'Cairo,sans-serif', fontWeight: 900, fontSize: 12.5, cursor: 'pointer' }}>
                      {busy ? '…' : 'احفظ'}
                    </button>
                    <button type="button" onClick={() => setOpen('')}
                      style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid ' + C.line, background: '#fff', color: C.soft, fontFamily: 'Cairo,sans-serif', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                      إلغاء
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
