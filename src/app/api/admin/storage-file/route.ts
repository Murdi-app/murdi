import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/requireAdmin';

// بعد إغلاق دلو contracts، لم يعد أي رابط عام يفتح. هذه بوابة الأدمن الوحيدة
// لملفات التخزين: تتحقق من الهوية ثم توقّع رابطاً عمره خمس دقائق.
const ALLOWED = new Set(['contracts', 'receipts']);
const TTL = 300;

// القيمة المخزّنة قد تكون مساراً أو رابطاً عاماً قديماً — كلاهما يعود مساراً
export function toPath(bucket: string, stored: string): string {
  for (const m of ['/object/public/' + bucket + '/', '/object/sign/' + bucket + '/']) {
    const i = stored.indexOf(m);
    if (i >= 0) return decodeURIComponent(stored.slice(i + m.length).split('?')[0]);
  }
  return stored.replace(/^\/+/, '');
}

export async function GET(req: Request) {
  const denied = await requireAdmin();
  if (denied) return NextResponse.json({ error: denied }, { status: 401 });

  const q = new URL(req.url).searchParams;
  const bucket = String(q.get('bucket') || 'contracts');
  const raw = String(q.get('path') || '');
  if (!ALLOWED.has(bucket)) return NextResponse.json({ error: 'دلو غير معروف' }, { status: 400 });
  if (!raw) return NextResponse.json({ error: 'path مطلوب' }, { status: 400 });

  const path = toPath(bucket, raw);
  // لا خروج من الدلو ولا مسار فارغ
  if (!path || path.includes('..')) return NextResponse.json({ error: 'مسار غير صالح' }, { status: 400 });

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  );
  const { data, error } = await admin.storage.from(bucket).createSignedUrl(path, TTL);
  if (error || !data) return NextResponse.json({ error: error?.message || 'تعذّر فتح الملف' }, { status: 404 });

  if (q.get('redirect') === '1') {
    const res = NextResponse.redirect(data.signedUrl, 302);
    res.headers.set('Cache-Control', 'no-store, private');
    return res;
  }
  return NextResponse.json({ url: data.signedUrl, expiresIn: TTL });
}
