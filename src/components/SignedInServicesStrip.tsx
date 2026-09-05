'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';

// شريطٌ لا يظهر إلا لمن كان داخلاً بحسابه.
//
// صفحة الخدمات واحدة للجميع — للغريب ولصاحب الحساب. لكن صاحب الحساب عنده
// نسخةٌ أقوى داخل ملفه: نفس الخدمات مرتّبةً بما يوقف ملفه هو، ومعها عدد
// الجهات التي تطلب كل نقص. فلا يُترك يقرأ العام وعنده الخاص، ولا يُنقل
// قسراً — يُقال له ويُختار.

export default function SignedInServicesStrip() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const sb = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL as string,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
        );
        const { data } = await sb.auth.getUser();
        if (alive && data?.user) setReady(true);
      } catch { /* زائر عادي — لا شيء */ }
    })();
    return () => { alive = false; };
  }, []);

  if (!ready) return null;

  return (
    <div style={{
      background: '#1A3D34', borderRadius: 14, padding: '15px 20px', marginBottom: 26,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap',
    }}>
      <div style={{ color: '#CFE0DA', fontSize: 13.5, fontWeight: 700, lineHeight: 1.9 }}>
        أنت داخلٌ بحسابك — وفي ملفك نسخةٌ من هذه الخدمات مرتّبةً بما يوقف ملفك أنت،
        ومعها عدد الجهات التي تطلب كل نقص.
      </div>
      <a href="/goal?tab=services" style={{
        background: '#C9A84C', color: '#1A3D34', padding: '10px 22px', borderRadius: 999,
        fontWeight: 900, fontSize: 13.5, textDecoration: 'none', whiteSpace: 'nowrap',
      }}>
        افتح خدماتك ←
      </a>
    </div>
  );
}
