import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/requireAdmin';

// فحص روابط التقديم — مرة لكل جهة لا لكل صف مطابقة.
// كان الفحص يجري على صفوف match_results: ١٬٦٨١ صفاً فُحص منها ٢٨٦ في شهرين،
// وكل عميل جديد يعيد فحص نفس روابط البنوك من الصفر. ومع السجل صار الفحص
// لكل جهة مرة واحدة، فيخدم كل العملاء — الحاليين ومن يأتي بعدهم.
// وإرسال عميل إلى رابط ميت يكسر ثقته بك أنت، لا بالجهة.

export const maxDuration = 60;

const admin = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

const UA = 'Mozilla/5.0 (compatible; MurdiLinkCheck/1.0; +https://murdi.sa)';
const TIMEOUT_MS = 8000;
const RECHECK_DAYS = 30;

type Verdict = { status: string; code: number | null };

async function probe(url: string): Promise<Verdict> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    // HEAD أولاً لأنه أسرع وأخف على الجهة؛ وكثير من مواقع البنوك لا تدعمه فنعيد بـ GET
    let res: Response | null = null;
    try {
      res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: ctl.signal, headers: { 'User-Agent': UA } });
      if (res.status === 405 || res.status === 501 || res.status === 403) res = null;
    } catch { res = null; }

    if (!res) {
      res = await fetch(url, { method: 'GET', redirect: 'follow', signal: ctl.signal, headers: { 'User-Agent': UA } });
    }

    const code = res.status;
    if (code === 404 || code === 410) return { status: 'غير موجودة', code };
    // 401/403 من موقع بنكي يعني غالباً جدار حماية لا صفحة مفقودة — لا نُسقط الجهة بسببه
    if (code === 401 || code === 403 || code === 429) return { status: 'محجوب آلياً', code };
    if (code >= 500) return { status: 'تعذّر الوصول', code };
    if (code >= 200 && code < 400) return { status: 'يعمل', code };
    return { status: 'تعذّر الوصول', code };
  } catch (e) {
    const msg = String(e);
    if (/abort|timeout/i.test(msg)) return { status: 'تعذّر الوصول', code: null };
    return { status: 'غير موجودة', code: null };
  } finally {
    clearTimeout(timer);
  }
}

// يُنادى بطريقين: المدير من متصفحه، أو القاعدة نفسها على جدول عبر pg_cron.
// والسرّ محفوظ في app_config لا في متغيرات البيئة — فلا يحتاج المالك إعداداً،
// ولا يصل السرّ إلى المتصفح لأن الجدول لا يقرؤه إلا service_role.
async function cronAuthorized(req: Request): Promise<boolean> {
  const given = req.headers.get('x-cron-secret') || '';
  if (!given) return false;
  const { data } = await admin().from('app_config').select('value').eq('key', 'cron_secret').maybeSingle();
  const want = String(data?.value || '');
  if (!want || given.length !== want.length) return false;
  // مقارنة ثابتة الزمن: المقارنة العادية تُسرّب طول البادئة الصحيحة
  let diff = 0;
  for (let i = 0; i < want.length; i++) diff |= given.charCodeAt(i) ^ want.charCodeAt(i);
  return diff === 0;
}

export async function POST(req: Request) {
  if (!(await cronAuthorized(req))) {
    const denied = await requireAdmin();
    if (denied) return NextResponse.json({ error: denied }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const limit = Math.min(Math.max(Number(body?.limit) || 15, 1), 30);
  const a = admin();

  const cutoff = new Date(Date.now() - RECHECK_DAYS * 86400000).toISOString();
  // النواة أولاً: جهة ظهرت لعملاء كثيرين رابطُها أهم من اسم ظهر مرة
  const { data: rows, error } = await a.from('funding_entities')
    .select('id, display_name, apply_url, link_checked_at, companies_seen')
    .eq('blocked', false)
    .not('apply_url', 'is', null)
    .neq('apply_url', '')
    .or('link_checked_at.is.null,link_checked_at.lt.' + cutoff)
    .order('companies_seen', { ascending: false })
    .limit(limit);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!rows || rows.length === 0) {
    return NextResponse.json({ ok: true, checked: 0, remaining: 0, done: true });
  }

  const results = await Promise.all(rows.map(async r => {
    const url = String(r.apply_url || '');
    if (!/^https?:\/\//i.test(url)) {
      return { id: r.id, name: r.display_name, status: 'بلا رابط', code: null };
    }
    const v = await probe(url);
    return { id: r.id, name: r.display_name, ...v };
  }));

  const now = new Date().toISOString();
  await Promise.all(results.map(x =>
    a.from('funding_entities')
      .update({ link_status: x.status, link_http_code: x.code, link_checked_at: now, updated_at: now })
      .eq('id', x.id)
  ));

  const { count: remaining } = await a.from('funding_entities')
    .select('id', { count: 'exact', head: true })
    .eq('blocked', false)
    .not('apply_url', 'is', null)
    .neq('apply_url', '')
    .or('link_checked_at.is.null,link_checked_at.lt.' + cutoff);

  const broken = results.filter(x => x.status === 'غير موجودة' || x.status === 'تعذّر الوصول');
  return NextResponse.json({
    ok: true,
    checked: results.length,
    working: results.filter(x => x.status === 'يعمل').length,
    broken: broken.length,
    brokenNames: broken.map(x => x.name).slice(0, 10),
    remaining: remaining || 0,
    done: (remaining || 0) === 0,
  });
}
