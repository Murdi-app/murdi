'use client'

import { useEffect, useState } from 'react'
import AdminNav from '@/components/AdminNav'

// لوحة المتابعة — شاشة من يلاحق مخاطبات الجهات.
//
// تجيب عن سؤال واحد: **أي ملف يقعد ساكتاً الآن؟** ولذلك تبدأ بثلاثة أرقام
// كبيرة لا بجدول: ردٌّ ينتظر تصنيفاً · جهة تأخّرت يومين · عميلٌ دفع ولا
// مخاطبة له. وما دونها تفصيل.
//
// ★ ولا زرّ إرسال فيها إطلاقاً. كل ما يخرج إلى جهة تمويل يمرّ على المالك،
//   وهذه اللوحة تسجّل ما وقع بالهاتف وتصنّف ما وصل — لا تراسل.
//
// ★ ولا رقم عميلٍ فيها ولا مالكه: الرقم الذي يخرج للجهات رقم المكتب وحده،
//   وعرض رقم العميل على شاشةٍ يُغري بنسخه.

const OFFICE = '0560721110'

// اتفاق العدد بالعربية — «7 جهة» خطأ يقرؤه العميل والموظفة معاً
const arEntities = (n: number): string =>
  n === 0 ? 'لا جهات' : n === 1 ? 'جهة واحدة' : n === 2 ? 'جهتان'
  : n <= 10 ? n + ' جهات' : n + ' جهة'

type Row = {
  id: string; entity: string; email: string; track: string
  kind: 'reply' | 'stale' | 'waiting' | 'done'
  sentAt: number | null; daysSince: number | null
  reply: string; replyStatus: string
  officerName: string; officerPhone: string; officerEmail: string
  note: string; calledAt: number | null
}
type Client = { id: string; name: string; city: string; service: string; rows: Row[]; urgent: number; untouched: boolean }

const KIND: Record<string, { t: string; bg: string; fg: string; bd: string }> = {
  reply:   { t: 'وصل رد — صنّفيه', bg: '#EAF7F0', fg: '#1A6B52', bd: '#2E9E7B' },
  stale:   { t: 'عدّى يومين — اتصلي', bg: '#FBEEEC', fg: '#B4453C', bd: '#C0564B' },
  waiting: { t: 'بانتظار الرد', bg: '#FBF7EC', fg: '#8A6D1F', bd: '#E8D9A8' },
  done:    { t: 'مصنَّف', bg: '#F2F5F4', fg: '#7E938C', bd: '#E1EDE8' },
}

const REPLY_KINDS: { k: string; t: string }[] = [
  { k: 'docs', t: 'طلبوا أوراق' },
  { k: 'call', t: 'طلبوا اتصال' },
  { k: 'deflect', t: 'حوّلونا للموقع/الفرع' },
  { k: 'declined', t: 'اعتذروا' },
]

export default function FollowupPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [counts, setCounts] = useState({ reply: 0, stale: 0, waiting: 0, done: 0 })
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState<string>('')
  const [busy, setBusy] = useState('')
  const [draft, setDraft] = useState<Record<string, { n: string; p: string; e: string; note: string }>>({})
  // نصّ ردٍّ تنسخه من صندوق البريد وتلصقه هنا — لا استقبال آلياً للوارد
  const [reply, setReply] = useState<Record<string, string>>({})

  const load = async () => {
    try {
      const r = await fetch('/api/admin/followup')
      const d = await r.json()
      if (d?.clients) { setClients(d.clients); setCounts(d.counts) }
    } catch {}
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const patch = async (id: string, body: Record<string, unknown>) => {
    setBusy(id)
    try {
      await fetch('/api/admin/followup', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...body }),
      })
      await load()
    } catch {}
    setBusy('')
  }

  const untouched = clients.filter((c) => c.untouched).length

  if (loading) return <div dir="rtl" style={{ padding: 60, textAlign: 'center', fontFamily: 'Cairo', color: '#6B8A80', fontWeight: 800 }}>جارٍ التحميل…</div>

  return (
    <div dir="rtl" style={{ fontFamily: 'Cairo, Tajawal, sans-serif', background: '#F4F7F6', minHeight: '100vh', padding: '22px 16px 60px' }}>
      <AdminNav />
      <div style={{ maxWidth: 980, margin: '0 auto' }}>

        <h1 style={{ fontSize: 24, fontWeight: 900, color: '#1A3D34', margin: '0 0 4px' }}>المتابعة</h1>
        <p style={{ color: '#6B8A80', fontWeight: 700, fontSize: 13, margin: '0 0 18px' }}>
          ما في ملف يقعد ساكت — ابدئي بالأحمر ثم الأخضر.
        </p>

        {/* ثلاثة أرقام تُقرأ من بعيد — لا تحتاج قراءة جدول لتعرف بماذا تبدأ */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
          <Stat n={counts.stale} t="عدّى يومين — اتصلي" bg="#FBEEEC" fg="#B4453C" />
          <Stat n={counts.reply} t="ردود تنتظر تصنيفك" bg="#EAF7F0" fg="#1A6B52" />
          <Stat n={untouched} t="دفعوا وما خوطبوا" bg="#FBF7EC" fg="#8A6D1F" />
          <Stat n={counts.waiting} t="بانتظار الرد" bg="#F2F5F4" fg="#7E938C" />
        </div>

        {clients.length === 0 && (
          <div style={{ background: '#fff', borderRadius: 16, padding: 40, textAlign: 'center', color: '#9DB3AB', fontWeight: 800, border: '1px solid #E1EDE8' }}>
            ما في عملاء للمتابعة الآن
          </div>
        )}

        {clients.map((c) => (
          <div key={c.id} style={{ background: '#fff', border: '1.5px solid ' + (c.untouched ? '#E8D9A8' : '#E1EDE8'), borderRadius: 16, padding: 18, marginBottom: 12 }}>
            <button onClick={() => setOpen(open === c.id ? '' : c.id)}
              style={{ background: 'none', border: 'none', width: '100%', textAlign: 'right', cursor: 'pointer', padding: 0, fontFamily: 'Cairo' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: '#1A3D34' }}>{c.name}</div>
                  <div style={{ fontSize: 12, color: '#6B8A80', fontWeight: 700, marginTop: 2 }}>
                    {c.service}{c.city ? ' · ' + c.city : ''} · {arEntities(c.rows.length)}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  {c.untouched && <Tag t="ما خوطب أحد" bg="#FBF7EC" fg="#8A6D1F" />}
                  {c.urgent > 0 && <Tag t={c.urgent + ' يحتاج عمل'} bg="#FBEEEC" fg="#B4453C" />}
                  <span style={{ color: '#9DB3AB', fontWeight: 900, fontSize: 13 }}>{open === c.id ? '▲' : '▼'}</span>
                </div>
              </div>
            </button>

            {open === c.id && (
              <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
                {c.rows.length === 0 && (
                  <div style={{ background: '#FBF7EC', border: '1px solid #E8D9A8', borderRadius: 12, padding: 14, fontSize: 13, fontWeight: 700, color: '#8A6D1F' }}>
                    هذا العميل دفع وما خرجت له أي رسالة بعد. بلّغي الدكتور عبدالحكيم.
                  </div>
                )}

                {c.rows.map((r) => {
                  const k = KIND[r.kind] || KIND.waiting
                  const d = draft[r.id] || { n: r.officerName, p: r.officerPhone, e: r.officerEmail, note: r.note }
                  const set = (f: 'n' | 'p' | 'e' | 'note', v: string) =>
                    setDraft((prev) => ({ ...prev, [r.id]: { ...d, [f]: v } }))
                  return (
                    <div key={r.id} style={{ background: k.bg, border: '1.5px solid ' + k.bd, borderRadius: 12, padding: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                        <div style={{ fontWeight: 900, fontSize: 14, color: '#1A3D34' }}>{r.entity}</div>
                        <div style={{ fontWeight: 900, fontSize: 11.5, color: k.fg }}>
                          {k.t}{r.daysSince !== null ? ' · ' + r.daysSince + ' يوم' : ''}
                        </div>
                      </div>

                      {r.reply !== '' && (
                        <div style={{ background: '#fff', borderRadius: 9, padding: '9px 12px', fontSize: 12.5, color: '#33544B', lineHeight: 1.9, marginBottom: 8, whiteSpace: 'pre-wrap' }}>
                          {r.reply.slice(0, 600)}
                        </div>
                      )}

                      {/* ★ لصق الرد الواصل على البريد.
                          المنصة لا تستقبل بريداً وارداً، فالردّ يعيش في الصندوق
                          وحده ولا يُرى في الملف. وهذا هو الجسر: تنسخه وتلصقه،
                          فيصير للملف تاريخٌ يقرؤه الدكتور بلا فتح صندوق. */}
                      {(r.kind === 'waiting' || r.kind === 'stale') && (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                          <input value={reply[r.id] || ''} onChange={(e) => setReply((p) => ({ ...p, [r.id]: e.target.value }))}
                            placeholder="وصلني رد على البريد — الصقيه هنا" style={{ ...IN, flex: '1 1 240px' }} />
                          <button disabled={busy === r.id || !(reply[r.id] || '').trim()}
                            onClick={() => patch(r.id, { reply_received: reply[r.id] })}
                            style={{ background: '#2E9E7B', color: '#fff', border: 'none', borderRadius: 20, padding: '8px 18px', fontFamily: 'Cairo', fontWeight: 900, fontSize: 12.5, cursor: 'pointer' }}>
                            ✉️ سجّلي الرد
                          </button>
                        </div>
                      )}

                      {/* تصنيف الرد — أربع خانات لا خامس، وهي نفسها التي في دليلها */}
                      {r.kind === 'reply' && (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                          {REPLY_KINDS.map((x) => (
                            <button key={x.k} disabled={busy === r.id}
                              onClick={() => patch(r.id, { reply_status: x.k })}
                              style={{ background: '#1A3D34', color: '#fff', border: 'none', borderRadius: 20, padding: '7px 14px', fontFamily: 'Cairo', fontWeight: 900, fontSize: 12, cursor: 'pointer' }}>
                              {x.t}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* اسم مسؤول الائتمان — الغرض الوحيد من مكالمة المتابعة */}
                      <div style={{ display: 'grid', gap: 6, gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', marginBottom: 8 }}>
                        <input value={d.n} onChange={(e) => set('n', e.target.value)} placeholder="اسم مسؤول الائتمان" style={IN} />
                        <input value={d.p} onChange={(e) => set('p', e.target.value)} placeholder="رقمه" style={IN} />
                        <input value={d.e} onChange={(e) => set('e', e.target.value)} placeholder="بريده" style={IN} />
                      </div>
                      <input value={d.note} onChange={(e) => set('note', e.target.value)} placeholder="ملاحظتك — وش قالوا بالضبط" style={{ ...IN, width: '100%', marginBottom: 8 }} />

                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button disabled={busy === r.id}
                          onClick={() => patch(r.id, { officer_name: d.n, officer_phone: d.p, officer_email: d.e, staff_note: d.note })}
                          style={{ background: '#1A3D34', color: '#fff', border: 'none', borderRadius: 20, padding: '8px 18px', fontFamily: 'Cairo', fontWeight: 900, fontSize: 12.5, cursor: 'pointer' }}>
                          {busy === r.id ? 'جارٍ الحفظ…' : '💾 احفظي'}
                        </button>
                        {/* «اتصلت اليوم» يُعيد عدّاد اليومين من الصفر — فلا يبقى
                            الصف أحمر بعد أن عُمل فيه، ولا يُنسى بعد أن اخضرّ */}
                        <button disabled={busy === r.id}
                          onClick={() => patch(r.id, { called: true, officer_name: d.n, officer_phone: d.p, officer_email: d.e, staff_note: d.note })}
                          style={{ background: '#C9A84C', color: '#1A3D34', border: 'none', borderRadius: 20, padding: '8px 18px', fontFamily: 'Cairo', fontWeight: 900, fontSize: 12.5, cursor: 'pointer' }}>
                          📞 اتصلت اليوم
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ))}

        <div style={{ background: '#FBEEEC', border: '1.5px solid #F0D6D2', borderRadius: 12, padding: 14, marginTop: 20, fontSize: 12.5, color: '#8A3B33', fontWeight: 700, lineHeight: 1.9 }}>
          <strong>تذكير:</strong> ما نرسل أي شي لجهة تمويل من هنا — كل شي يطلع للجهات يمرّ على الدكتور عبدالحكيم.
          والرقم اللي يُعطى للجهات هو <strong>{OFFICE}</strong> — ورقم العميل ما يطلع أبداً.
        </div>

      </div>
    </div>
  )
}

const IN: React.CSSProperties = {
  padding: '8px 11px', borderRadius: 9, border: '1.5px solid #D9E5DF',
  fontFamily: 'Cairo', fontSize: 12.5, background: '#fff', color: '#12302A',
}

function Stat({ n, t, bg, fg }: { n: number; t: string; bg: string; fg: string }) {
  return (
    <div style={{ flex: '1 1 150px', background: bg, borderRadius: 14, padding: '14px 16px', textAlign: 'center' }}>
      <div style={{ fontSize: 26, fontWeight: 900, color: fg, lineHeight: 1.3 }}>{n}</div>
      <div style={{ fontSize: 11.5, fontWeight: 800, color: fg, opacity: 0.85 }}>{t}</div>
    </div>
  )
}

function Tag({ t, bg, fg }: { t: string; bg: string; fg: string }) {
  return <span style={{ background: bg, color: fg, fontWeight: 900, fontSize: 11, padding: '4px 11px', borderRadius: 20 }}>{t}</span>
}
