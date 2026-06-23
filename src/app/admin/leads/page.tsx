'use client';
import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import AdminNav from '@/components/AdminNav';

const ADMIN_EMAIL = 'hololalmurdi.fs@gmail.com';

type Lead = { id: string; full_name: string; phone: string; track: string; score: number; created_at: string; contacted: boolean };

export default function LeadsPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  const sb = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    (async () => {
      const { data: { user } } = await sb.auth.getUser();
      if (!user || user.email !== ADMIN_EMAIL) { router.push('/'); return; }
      setAuthorized(true);
      const { data } = await sb.from('mini_assessments').select('*').order('created_at', { ascending: false });
      setLeads(data || []);
      setLoading(false);
    })();
  }, []);

  const fmt = (d: string) => new Date(d).toLocaleString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const color = (s: number) => s >= 75 ? '#2E9E7B' : s >= 50 ? '#C9A84C' : '#d9772e';

  if (authorized === null) return <div dir="rtl" style={{ fontFamily: 'Cairo', textAlign: 'center', padding: 80, color: '#9DB3AB' }}>جارٍ التحميل…</div>;

  return (
    <div dir="rtl" style={{ fontFamily: 'Cairo', maxWidth: 900, margin: '0 auto', padding: '28px 20px', background: '#FBFCFB', minHeight: '100vh' }}>
      <AdminNav />
      <h1 style={{ color: '#1A3D34', fontSize: 24, fontWeight: 900, margin: 0 }}>📋 العملاء المحتملون</h1>
      <p style={{ color: '#6B8A80', fontSize: 13, marginTop: 4, marginBottom: 20 }}>من أجروا التقييم المصغّر في الواجهة — مرتّبون من الأحدث. ({leads.length})</p>

      {loading ? <div style={{ color: '#9DB3AB', textAlign: 'center', padding: 30 }}>جارٍ تحميل البيانات…</div>
        : leads.length === 0 ? <div style={{ color: '#9DB3AB', textAlign: 'center', padding: 30, background: '#fff', borderRadius: 12, border: '1px solid #EAF2EE' }}>لا يوجد عملاء محتملون بعد.</div>
        : leads.map((l) => (
          <div key={l.id} style={{ background: '#fff', border: '1.5px solid #EAF2EE', borderRadius: 12, padding: '16px 18px', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ color: '#1A3D34', fontSize: 16, fontWeight: 900 }}>{l.full_name || '—'}</div>
              <div style={{ color: '#3A4D47', fontSize: 14, fontWeight: 700, margin: '4px 0' }}>
                <a href={`https://wa.me/966${l.phone.replace(/^0/, '')}`} target="_blank" rel="noopener noreferrer" style={{ color: '#2E9E7B', textDecoration: 'none' }}>📱 {l.phone}</a>
                {l.track && <span style={{ color: '#9DB3AB', marginRight: 10 }}>· {l.track}</span>}
              </div>
              <div style={{ color: '#9DB3AB', fontSize: 12 }}>{fmt(l.created_at)}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 30, fontWeight: 900, color: color(l.score), lineHeight: 1 }}>{l.score}</div>
              <div style={{ fontSize: 11, color: '#9DB3AB' }}>/ 100</div>
            </div>
          </div>
        ))}
    </div>
  );
}
