'use client';
import { useEffect, useState } from 'react';

// «ملفي» — مراحل ملف العميل الذي دفع بتواريخها (٨ أكتوبر، بأمر المالك). بلا أسماء جهات.
type Stage = { key: string; label: string; at: string | null; done: boolean };
type File = { id: string; service: string; stages: Stage[] };
const G = '#1A3D34';
const d = (s: string | null) => s ? new Date(s).toLocaleDateString('ar-SA', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

export default function MyFile() {
  const [files, setFiles] = useState<File[]>([]);
  useEffect(() => { fetch('/api/my-file').then((r) => r.json()).then((j) => setFiles(j.files || [])).catch(() => null); }, []);
  if (!files.length) return null;
  return (
    <div className="mb-8">
      {files.map((f) => (
        <div key={f.id} className="rounded-2xl p-5 mb-3" style={{ background: '#fff', border: '1.5px solid #D5E6DE' }}>
          <div className="font-black text-lg mb-3" style={{ color: G }}>ملفي — {f.service}</div>
          <ol className="space-y-3">
            {f.stages.map((s, i) => (
              <li key={s.key} className="flex items-start gap-3">
                <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0"
                  style={{ background: s.done ? G : '#EEF3F1', color: s.done ? '#fff' : '#9DB3AB' }}>{s.done ? '✓' : (i + 1).toLocaleString('ar-SA')}</span>
                <div>
                  <div className="font-black text-sm" style={{ color: s.done ? G : '#9DB3AB' }}>{s.label}</div>
                  {s.at && <div className="text-xs font-bold" style={{ color: '#6B8A80' }}>{d(s.at)}</div>}
                </div>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}
