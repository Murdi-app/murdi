'use client';
import AdminNav from '@/components/AdminNav';
import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';

type Msg = {
  id: string; entity_name: string; entity_email: string | null;
  entity_language: string; track: string; subject: string;
  message_body: string; status: string; error_note: string | null;
  alt_contact: string | null; contact_method: string | null;
};

const C = { ink:'#1A3D34', green:'#2E9E7B', gray:'#6B8A80', mint:'#E8F5EF', bg:'#F0F5F3', card:'#FBFCFB' };

export default function OutreachPage() {
  const [companyId, setCompanyId] = useState('');
  // قراءة العميل تلقائياً من الرابط (?company_id=...)
  if (typeof window !== 'undefined' && !companyId) {
    const p = new URLSearchParams(window.location.search).get('company_id');
    if (p) { setCompanyId(p); setTimeout(() => { const cid = p; fetch('/api/admin/outreach/manage?company_id=' + cid).then(r => r.json()).then(d => { if (d.ok) setMsgs(d.messages); }); }, 100); }
  }
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [editId, setEditId] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [attachment, setAttachment] = useState<{ file_url: string; file_name: string } | null>(null);
  const [uploading, setUploading] = useState(false);

  const flash = (t: string) => { setNote(t); setTimeout(() => setNote(''), 3000); };

  // جلب الملف المرفق
  const loadAttachment = async (cid: string) => {
    try {
      const r = await fetch('/api/admin/outreach/attachment?company_id=' + cid);
      const d = await r.json();
      if (d.ok) setAttachment(d.attachment);
    } catch {}
  };

  // رفع ملف المخاطبة (PDF)
  const uploadAttachment = async (file: File) => {
    if (!companyId.trim()) { flash('أدخل معرّف العميل أولاً'); return; }
    setUploading(true);
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL as string,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
      );
      const path = companyId.trim() + '/outreach_' + Date.now() + '_' + file.name;
      const { error: upErr } = await supabase.storage.from('contracts').upload(path, file);
      if (upErr) { flash('تعذّر الرفع: ' + upErr.message); setUploading(false); return; }
      const { data: pub } = supabase.storage.from('contracts').getPublicUrl(path);
      const r = await fetch('/api/admin/outreach/attachment', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: companyId.trim(), file_url: pub.publicUrl, file_name: file.name }),
      });
      const d = await r.json();
      if (d.ok) { flash('✓ رُفع الملف'); setAttachment({ file_url: pub.publicUrl, file_name: file.name }); }
      else flash(d.error || 'خطأ');
    } catch {
      flash('تعذّر الرفع');
    }
    setUploading(false);
  };

  // حذف الملف المرفق
  const deleteAttachment = async () => {
    if (!confirm('حذف الملف المرفق؟')) return;
    await fetch('/api/admin/outreach/attachment?company_id=' + companyId.trim(), { method: 'DELETE' });
    setAttachment(null);
    flash('✓ حُذف الملف');
  };


  const load = async (cid: string) => {
    loadAttachment(cid);
    const r = await fetch('/api/admin/outreach/manage?company_id=' + cid);
    const d = await r.json();
    if (d.ok) setMsgs(d.messages);
    else flash(d.error || 'خطأ');
  };

  const generate = async () => {
    if (!companyId.trim()) { flash('أدخل معرّف العميل'); return; }
    setBusy(true); flash('جارٍ التوليد... قد يستغرق دقيقة');
    const r = await fetch('/api/admin/outreach/generate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company_id: companyId.trim() }),
    });
    const d = await r.json();
    setBusy(false);
    if (d.ok) { flash('✓ تم توليد ' + d.generated + ' رسالة من ' + d.total); load(companyId.trim()); }
    else flash(d.error || 'خطأ في التوليد');
  };

  const act = async (id: string, action: string, extra: Record<string, unknown> = {}) => {
    const r = await fetch('/api/admin/outreach/manage', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action, ...extra }),
    });
    const d = await r.json();
    if (d.ok) { flash('✓ تم'); load(companyId.trim()); if (action === 'update') setEditId(''); }
    else flash(d.error || 'خطأ');
  };

  const send = async () => {
    const approved = msgs.filter(m => m.status === 'معتمدة').length;
    if (approved === 0) { flash('لا توجد رسائل معتمدة'); return; }
    if (!confirm('إرسال ' + approved + ' رسالة معتمدة؟')) return;
    setBusy(true); flash('جارٍ الإرسال...');
    const r = await fetch('/api/admin/outreach/send', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company_id: companyId.trim() }),
    });
    const d = await r.json();
    setBusy(false);
    if (d.ok) { flash('✓ أُرسلت ' + d.sent + ' رسالة'); load(companyId.trim()); }
    else flash(d.error || 'خطأ في الإرسال');
  };

  const badge = (m: Msg) => {
    if (m.entity_email && (!m.error_note || m.error_note.includes('مؤكّد'))) return { t:'🟢 إيميل مؤكّد', c:C.green };
    if (m.entity_email) return { t:'🟡 إيميل غير مؤكّد', c:'#C8A84B' };
    return { t:'🔴 لا يوجد إيميل', c:'#C0392B' };
  };

  const statusColor = (s: string) =>
    s === 'معتمدة' ? C.green : s === 'مُرسلة' ? '#2980B9' : s === 'مرفوضة' ? '#C0392B' : C.gray;

  const approvedCount = msgs.filter(m => m.status === 'معتمدة').length;

  return (
    <div style={{ background:C.bg, minHeight:'100vh' }}>
      <AdminNav />
      <div style={{ maxWidth:900, margin:'0 auto', padding:'24px 16px', direction:'rtl' }}>
        <h1 style={{ fontSize:24, fontWeight:900, color:C.ink, marginBottom:6 }}>📨 مخاطبة الجهات</h1>
        <p style={{ color:C.gray, fontSize:13, marginBottom:20 }}>
          توليد رسائل مخصصة لكل جهة مطابقة، مراجعتها، ثم إرسالها بعد الاعتماد.
        </p>

        {/* شريط التوليد */}
        <div style={{ background:C.card, border:'2px solid '+C.mint, borderRadius:16, padding:16, marginBottom:20 }}>
          <label style={{ fontSize:12, fontWeight:900, color:C.gray }}>معرّف العميل (company_id)</label>
          <div style={{ display:'flex', gap:8, marginTop:8, flexWrap:'wrap' }}>
            <input value={companyId} onChange={e => setCompanyId(e.target.value)}
              placeholder="الصق معرّف الشركة"
              style={{ flex:1, minWidth:220, padding:'10px 14px', borderRadius:10, border:'2px solid '+C.mint, fontSize:14 }} />
            <button onClick={generate} disabled={busy}
              style={{ padding:'10px 20px', borderRadius:10, background:C.green, color:'#fff', fontWeight:900, border:'none', fontSize:14, opacity:busy?0.5:1 }}>
              {busy ? 'جارٍ...' : '⚙️ جهّز الرسائل'}
            </button>
            <button onClick={() => load(companyId.trim())} disabled={!companyId.trim()}
              style={{ padding:'10px 16px', borderRadius:10, background:C.mint, color:C.ink, fontWeight:900, border:'none', fontSize:14 }}>
              🔄 تحديث
            </button>
          </div>
        </div>

        {note && <div style={{ background:C.ink, color:'#fff', padding:'10px 16px', borderRadius:10, marginBottom:16, fontSize:13, fontWeight:700 }}>{note}</div>}

        {/* قسم ملف المخاطبة المرفق */}
        {msgs.length > 0 && (
          <div style={{ background:'#FFF8E6', border:'2px solid #E8D9A8', borderRadius:14, padding:16, marginBottom:16 }}>
            <div style={{ color:'#8A6D1A', fontWeight:900, fontSize:14, marginBottom:8 }}>📎 ملف المخاطبة (يرفق مع كل الرسائل)</div>
            {attachment ? (
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8 }}>
                <a href={attachment.file_url} target="_blank" rel="noopener noreferrer" style={{ color:'#2E9E7B', fontWeight:700, fontSize:13 }}>📄 {attachment.file_name || 'الملف المرفق'} (عرض)</a>
                <button onClick={deleteAttachment} style={{ background:'#FDECEA', color:'#C0392B', border:'none', padding:'6px 16px', borderRadius:8, fontWeight:900, fontSize:12.5, cursor:'pointer' }}>حذف</button>
              </div>
            ) : (
              <div>
                <p style={{ color:'#8A6D1A', fontSize:12.5, marginBottom:8 }}>ارفع ملف PDF (جهّزه من «جهّز الملف الاحترافي» واحفظه PDF) ليُرفق مع رسائل الجهات.</p>
                <label style={{ display:'inline-block', background:C.ink, color:'#fff', fontWeight:900, fontSize:13, padding:'9px 20px', borderRadius:10, cursor:'pointer' }}>
                  {uploading ? 'جارٍ الرفع...' : '⬆️ ارفع ملف PDF'}
                  <input type="file" accept="application/pdf" style={{ display:'none' }} disabled={uploading}
                    onChange={e => { const f = e.target.files?.[0]; if (f) uploadAttachment(f); }} />
                </label>
              </div>
            )}
          </div>
        )}

        {/* زر الإرسال */}
        {msgs.length > 0 && (
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, flexWrap:'wrap', gap:8 }}>
            <span style={{ color:C.gray, fontSize:13, fontWeight:700 }}>
              {msgs.length} رسالة · {approvedCount} معتمدة
            </span>
            <button onClick={send} disabled={busy || approvedCount===0}
              style={{ padding:'12px 24px', borderRadius:12, background:approvedCount>0?C.ink:C.gray, color:'#fff', fontWeight:900, border:'none', fontSize:15, opacity:(busy||approvedCount===0)?0.5:1 }}>
              📤 إرسال المعتمدة ({approvedCount})
            </button>
          </div>
        )}

        {/* البطاقات */}
        {msgs.map(m => {
          const b = badge(m);
          return (
            <div key={m.id} style={{ background:C.card, border:'2px solid '+C.mint, borderRadius:16, padding:16, marginBottom:14 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:8, marginBottom:10 }}>
                <div>
                  <span style={{ fontSize:16, fontWeight:900, color:C.ink }}>
                    {m.track === 'funding' ? '🏦' : '💼'} {m.entity_name}
                  </span>
                  <span style={{ marginRight:10, fontSize:12, fontWeight:900, color:b.c }}>{b.t}</span>
                </div>
                <span style={{ fontSize:11, fontWeight:900, color:'#fff', background:statusColor(m.status), padding:'3px 12px', borderRadius:20 }}>{m.status}</span>
              </div>

              {/* الإيميل */}
              <div style={{ fontSize:12, color:C.gray, marginBottom:8 }}>
                البريد: {m.entity_email || '—'} · اللغة: {m.entity_language}
                {m.alt_contact && (
                  <div style={{ marginTop:6, padding:'6px 10px', background:'#FFF8E6', border:'1px solid #E8D9A8', borderRadius:8, color:'#8A6D1A', fontSize:12, fontWeight:700 }}>
                    📎 تواصل بديل ({m.contact_method || 'أخرى'}): {m.alt_contact}
                  </div>
                )}
              </div>

              {editId === m.id ? (
                <div>
                  <input value={editEmail} onChange={e => setEditEmail(e.target.value)} placeholder="إيميل الجهة"
                    style={{ width:'100%', padding:'8px 12px', borderRadius:8, border:'2px solid '+C.mint, marginBottom:8, fontSize:13 }} />
                  <textarea value={editBody} onChange={e => setEditBody(e.target.value)} rows={8}
                    style={{ width:'100%', padding:'10px 12px', borderRadius:8, border:'2px solid '+C.mint, fontSize:13, fontFamily:'inherit' }} />
                  <div style={{ display:'flex', gap:8, marginTop:8 }}>
                    <button onClick={() => act(m.id, 'update', { message_body: editBody, entity_email: editEmail })}
                      style={{ padding:'8px 18px', borderRadius:8, background:C.green, color:'#fff', fontWeight:900, border:'none', fontSize:13 }}>💾 حفظ</button>
                    <button onClick={() => setEditId('')}
                      style={{ padding:'8px 18px', borderRadius:8, background:C.mint, color:C.ink, fontWeight:900, border:'none', fontSize:13 }}>إلغاء</button>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ fontSize:13, fontWeight:700, color:C.ink, marginBottom:4 }}>{m.subject}</div>
                  <div style={{ fontSize:13, color:'#333', whiteSpace:'pre-wrap', lineHeight:1.7, background:C.bg, padding:12, borderRadius:8, marginBottom:10 }}>{m.message_body}</div>
                  {m.status !== 'مُرسلة' && (
                    <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                      {m.status !== 'معتمدة' && (
                        <button onClick={() => act(m.id, 'approve')}
                          style={{ padding:'8px 18px', borderRadius:8, background:C.green, color:'#fff', fontWeight:900, border:'none', fontSize:13 }}>✅ اعتمد</button>
                      )}
                      <button onClick={() => { setEditId(m.id); setEditBody(m.message_body); setEditEmail(m.entity_email||''); }}
                        style={{ padding:'8px 18px', borderRadius:8, background:C.mint, color:C.ink, fontWeight:900, border:'none', fontSize:13 }}>✏️ عدّل</button>
                      <button onClick={() => act(m.id, 'reject')}
                        style={{ padding:'8px 18px', borderRadius:8, background:'#FDECEA', color:'#C0392B', fontWeight:900, border:'none', fontSize:13 }}>❌ تجاهل</button>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}

        {msgs.length === 0 && (
          <div style={{ textAlign:'center', color:C.gray, padding:40, fontSize:14 }}>
            أدخل معرّف العميل واضغط «جهّز الرسائل» لبدء توليد رسائل المخاطبة.
          </div>
        )}
      </div>
    </div>
  );
}
