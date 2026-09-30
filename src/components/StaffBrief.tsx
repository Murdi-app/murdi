'use client';
import { useEffect, useState } from 'react';

// بطاقة «توجيه اليوم» أعلى شاشة الموظفة — مطويّةٌ بعد قراءتها، ومفتوحةٌ ما لم تُقرأ.

type Brief = { id: string; subject: string; body: string; sent_at: string | null; read_at: string | null };

export default function StaffBrief() {
  const [b, setB] = useState<Brief | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    fetch('/api/staff/brief').then((r) => r.json()).then((d) => {
      if (d?.brief) { setB(d.brief); setOpen(!d.brief.read_at); }
    }).catch(() => null);
  }, []);
  if (!b) return null;
  const read = async () => {
    await fetch('/api/staff/brief', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: b.id }) }).catch(() => null);
    setB({ ...b, read_at: new Date().toISOString() }); setOpen(false);
  };
  return (
    <div style={{ background: b.read_at ? '#fff' : '#FFF8E6', border: '1.5px solid ' + (b.read_at ? '#EAF2EE' : '#E8C766'), borderRadius: 14, padding: '12px 16px', marginBottom: 16 }}>
      <div onClick={() => setOpen(!open)} style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <b style={{ color: '#1A3D34', fontSize: 15 }}>📋 توجيه اليوم {b.read_at ? '✓' : '— جديد'}</b>
        <span style={{ color: '#6B8A80', fontSize: 12.5 }}>{open ? 'طيّ' : 'عرض'}</span>
      </div>
      {open && (
        <>
          <div style={{ whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.95, color: '#1A3D34', marginTop: 10 }}>{b.body}</div>
          {!b.read_at && (
            <button onClick={read} style={{ marginTop: 10, background: '#1A3D34', color: '#fff', border: 0, borderRadius: 8, padding: '8px 22px', fontFamily: 'inherit', fontWeight: 700, cursor: 'pointer' }}>قرأته</button>
          )}
        </>
      )}
    </div>
  );
}
