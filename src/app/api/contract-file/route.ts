import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

const ADMIN_EMAIL = 'hololalmurdi.fs@gmail.com';
const BUCKET = 'contracts';
const TTL = 300; // خمس دقائق: يكفي لفتح الملف ولا يكفي لتداوله

// البوابة الوحيدة لملفات دلو contracts — وفيه العقود الموقّعة (بأرقام الهويات)
// وملفات التمويل الكاملة للعملاء. كان الدلو عاماً: أي رابط يُسرّب مرة واحدة
// يبقى مفتوحاً للأبد بلا مصادقة. الآن: مسار محفوظ + رابط موقّع قصير الأجل لمن يملكه.

// الصفوف القديمة خزّنت رابطاً عاماً كاملاً بدل المسار — نستخرج المسار منه
function toPath(stored: string): string {
  const marker = `/object/public/${BUCKET}/`;
  const i = stored.indexOf(marker);
  if (i >= 0) return decodeURIComponent(stored.slice(i + marker.length).split('?')[0]);
  const j = stored.indexOf(`/object/sign/${BUCKET}/`);
  if (j >= 0) return decodeURIComponent(stored.slice(j + `/object/sign/${BUCKET}/`.length).split('?')[0]);
  return stored.replace(/^\/+/, '');
}

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const id = q.get('id');
  // redirect=1 يجعل الرابط وسماً عادياً في الصفحة: نقرة واحدة تفتح الملف
  // دون نافذة يحجبها المتصفح، والرابط الموقّع لا يظهر في شريط العنوان قبل الفحص
  const asRedirect = q.get('redirect') === '1';
  if (!id) return NextResponse.json({ error: 'id مطلوب' }, { status: 400 });

  const store = await cookies();
  const ss = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    { cookies: { getAll: () => store.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await ss.auth.getUser();
  if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  );

  const { data: row } = await admin.from('contracts')
    .select('signed_file_url, company_id').eq('id', id).maybeSingle();
  if (!row || !row.signed_file_url) {
    return NextResponse.json({ error: 'لا توجد نسخة موقّعة' }, { status: 404 });
  }

  // المالك: صاحب المنشأة نفسه، أو المدير
  if (user.email !== ADMIN_EMAIL) {
    const { data: co } = await admin.from('companies')
      .select('id').eq('id', row.company_id).eq('user_id', user.id).maybeSingle();
    if (!co) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  }

  const { data: signed, error } = await admin.storage
    .from(BUCKET).createSignedUrl(toPath(String(row.signed_file_url)), TTL);
  if (error || !signed) {
    return NextResponse.json({ error: error?.message || 'تعذّر فتح الملف' }, { status: 500 });
  }
  if (asRedirect) {
    const res = NextResponse.redirect(signed.signedUrl, 302);
    res.headers.set('Cache-Control', 'no-store, private');
    return res;
  }
  return NextResponse.json({ url: signed.signedUrl, expiresIn: TTL });
}
