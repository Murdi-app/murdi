import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

export const runtime = 'nodejs';
export const maxDuration = 60;

const ADMIN_EMAIL = 'hololalmurdi.fs@gmail.com';
const LOCAL_CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

async function getAdmin() {
  const cookieStore = await cookies();
  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await sb.auth.getUser();
  if (!user || user.email !== ADMIN_EMAIL) return null;
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  );
}

export async function POST(req: Request) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 });

  let companyId = '', html = '', lang = 'ar', name = '';
  let landscape = false, download = false, kind = 'file';
  try {
    const b = await req.json();
    companyId = String(b.company_id || '');
    html = String(b.html || '');
    lang = b.lang === 'en' ? 'en' : 'ar';
    name = String(b.name || 'murdi-file');
    landscape = b.landscape === true;
    download = b.download === true;
    kind = b.kind === 'deck' ? 'deck' : 'file';
  } catch { return NextResponse.json({ error: 'طلب غير صالح' }, { status: 400 }); }
  if (!companyId || !html) return NextResponse.json({ error: 'بيانات ناقصة' }, { status: 400 });

  let browser = null;
  try {
    const isLocal = process.env.NODE_ENV === 'development';
    browser = await puppeteer.launch({
      args: isLocal ? [] : chromium.args,
      executablePath: isLocal ? LOCAL_CHROME : await chromium.executablePath(),
      headless: true,
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    try { await page.evaluateHandle('document.fonts.ready'); } catch {}
    const pdf = await page.pdf({
      format: 'A4',
      landscape,
      printBackground: true,
      margin: landscape ? { top: '0', bottom: '0', left: '0', right: '0' } : { top: '14mm', bottom: '14mm', left: '10mm', right: '10mm' },
    });
    await browser.close();
    browser = null;

    if (download) {
        return new NextResponse(new Uint8Array(pdf), {
          headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="' + name.replace(/[^A-Za-z0-9._-]/g, '-') + '-' + lang + '.pdf"' },
        });
      }

      const fileName = name.replace(/[^A-Za-z0-9._-]/g, '-') + '-' + lang + '.pdf';
    const path = 'files/' + companyId + '-' + lang + '-' + Date.now() + '.pdf';
    const up = await admin.storage.from('contracts').upload(path, Buffer.from(pdf), {
      contentType: 'application/pdf', upsert: true,
    });
    if (up.error) return NextResponse.json({ error: 'تعذر الرفع: ' + up.error.message }, { status: 500 });

    const { data: pub } = admin.storage.from('contracts').getPublicUrl(path);
    const row: Record<string, unknown> = {
      company_id: companyId,
      uploaded_at: new Date().toISOString(),
      file_url: pub.publicUrl,
      file_name: fileName,
    };
    if (kind === 'deck') {
      if (lang === 'en') { row.deck_url_en = pub.publicUrl; row.deck_name_en = fileName; }
      else { row.deck_url_ar = pub.publicUrl; row.deck_name_ar = fileName; }
    } else if (lang === 'en') { row.file_url_en = pub.publicUrl; row.file_name_en = fileName; }
    else { row.file_url_ar = pub.publicUrl; row.file_name_ar = fileName; }
    const { error } = await admin.from('outreach_attachments').upsert(row, { onConflict: 'company_id' });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, url: pub.publicUrl, name: fileName });
  } catch (e) {
    if (browser) { try { await browser.close(); } catch {} }
    return NextResponse.json({ error: 'تعذر التحويل: ' + String(e).slice(0, 160) }, { status: 500 });
  }
}
