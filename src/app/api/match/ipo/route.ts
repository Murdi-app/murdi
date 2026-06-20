import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { Resend } from 'resend';
import { suggestService, suggestionBox } from '@/lib/serviceSuggestion';

async function generateRecoveryPath(data: Record<string, unknown>): Promise<string> {
  const MODELS = ['claude-opus-4-8', 'claude-sonnet-4-6'];
  const prompt = 'انت مستشار مالي وفق منهجية د. عبدالحكيم المرضي. الشركة متعثرة في سداد ديونها، والادراج في السوق المالي مرفوض نظاما لمن لا ينتظم في التزاماته، فالطرح هدف بعيد يسبقه تعافي واستقرار. '
    + 'بياناتها: ' + JSON.stringify(data) + '. '
    + 'اكتب مسار تعافي واقعيا ومتدرجا يقدر عليه صاحب شركة متعثر فعلا، بلا مبالغة ولا حلول خيالية ولا راس مال كبير. '
    + 'ركز على: اعادة جدولة الديون والتفاوض مع الدائنين، وقف النزيف النقدي وضبط المصروفات، تحسين التدفق النقدي والربحية، استعادة الانتظام في السداد، ثم بعد سنوات من الاستقرار يعاد تقييم جاهزية الطرح. '
    + 'اربط كل خطوة بارقام الشركة الفعلية. اخرج HTML عربي بسيط: <h3>مسار التعافي قبل التفكير في الطرح</h3> ثم <ol> خطوات مرقمة كل خطوة <li> فيها رقم محسوب من بياناتهم. بلا اي اشارة لذكاء اصطناعي او تقنية. ابدا مباشرة بالـHTML.';
  for (const model of MODELS) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY as string, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model, max_tokens: 2000, messages: [{ role: 'user', content: prompt }] }),
      });
      if (!res.ok) continue;
      const j = await res.json();
      const txt = (j.content || []).filter((b: { type: string }) => b.type === 'text').map((b: { text: string }) => b.text).join('').trim();
      if (txt) return txt;
    } catch {}
  }
  return '<h3>مسار التعافي قبل التفكير في الطرح</h3><p>الشركة بحاجة لإعادة هيكلة ديونها واستعادة انتظام السداد قبل أي تفكير في الإدراج.</p>';
}

async function generateIpoReadinessPlan(data: Record<string, unknown>): Promise<string> {
  const MODELS = ['claude-opus-4-8', 'claude-sonnet-4-6'];
  const score = Number((data as { score?: number }).score) || 0;
  const prompt = 'انت مستشار مالي وفق منهجية د. عبدالحكيم المرضي، تكتب لصاحب شركة سعودية سكور جاهزيتها للطرح ' + score + ' من 100 — أي دون عتبة الجاهزية للإدراج. الشركة ليست متعثرة، لكنها تحتاج تجهيزا مؤسسيا قبل الطرح. '
    + 'مهمتك: خطة دقيقة ذكية ترفع جاهزيتها لمتطلبات الإدراج في السوق السعودي (تداول — السوق الرئيسية أو نمو). '
    + 'بيانات الشركة: ' + JSON.stringify(data) + '. '
    + 'حلل الفجوة بدقة وفق متطلبات هيئة السوق المالية: الحوكمة المؤسسية ولوائحها، تشكيل مجلس إدارة بأعضاء مستقلين، لجنة المراجعة، تعيين مراجع خارجي معتمد، توفر قوائم مالية مدققة لعدد السنوات المطلوب، الإفصاح والشفافية، تنويع قاعدة العملاء وتقليل التركّز، استقرار الربحية والنمو. '
    + 'رتب الخطوات حسب الأثر الأكبر على الجاهزية أولا، ولكل خطوة: ماذا يفعل بالضبط، ولماذا تطلبه الهيئة أو يطمئن المستثمر، مربوطة بأرقام الشركة الفعلية. واقعية ومتدرجة. '
    + 'اجعلها 4 الى 6 خطوات مركزة. اخرج HTML عربي بسيط مكتمل: <h3>خطة رفع الجاهزية للطرح</h3> ثم <ol> خطوات مرقمة كل <li> فيها رقم/تفصيل من بياناتهم. بلا اي اشارة لذكاء اصطناعي او تقنية. ابدا مباشرة بالـHTML.';
  for (const model of MODELS) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY as string, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model, max_tokens: 2000, messages: [{ role: 'user', content: prompt }] }),
      });
      if (!res.ok) continue;
      const j = await res.json();
      const txt = (j.content || []).filter((b: { type: string }) => b.type === 'text').map((b: { text: string }) => b.text).join('').trim();
      if (txt) return txt;
    } catch {}
  }
  return '<h3>خطة رفع الجاهزية للطرح</h3><p>تحتاج الشركة بناء الحوكمة المؤسسية، تعيين مراجع خارجي معتمد، تشكيل لجنة مراجعة، وتجهيز القوائم المالية المدققة قبل التقدم للإدراج.</p>';
}

async function searchIpoAdvisors(sector: string, market: string, revenue: number): Promise<string> {
  const MODELS = ['claude-opus-4-8', 'claude-sonnet-4-6'];
  const prompt = 'أنت باحث أسواق مال محترف تعمل لصالح د. عبدالحكيم المرضي (حلول المرضي للاستشارات المالية، السعودية). شركة قطاعها "' + sector + '" وإيراداتها السنوية ' + revenue + ' ريال تستهدف الإدراج في ' + market + ' بالسوق السعودي (تداول). ابحث في الويب بدقة ومهنية وقسّم نتائجك إلى ثلاثة أقسام:\n\n'
    + '1) المستشارون الماليون المرخّصون من هيئة السوق المالية السعودية (CMA) الذين يقودون عمليات الطرح والإدراج — ركّز على المرخّصين فعلياً والنشطين في طروحات ' + market + '. لكل واحد: الاسم، ولماذا يناسب حجم وقطاع هذه الشركة، وطريقة تواصل عملية محددة (موقع رسمي/بريد إدارة الترتيب والاستشارات).\n\n'
    + '2) متعهّدو التغطية والمراجعون (المدققون) المعتمدون لدى الهيئة المناسبون لطرح بهذا الحجم.\n\n'
    + '3) طروحات مشابهة حديثة (آخر 2-3 سنوات) في قطاع "' + sector + '" أو قطاع قريب بالسوق السعودي (' + market + '): اسم الشركة، سنة الطرح، حجم الطرح والتغطية إن توفّر، ومن كان مستشارها المالي — كمرجع يستفيد منه صاحب الشركة.\n\n'
    + 'ابدأ بقسم (الخلاصة التنفيذية): أفضل مستشارين ماليَّين للتواصل معهما الآن وسبب الترشيح. ثم التفاصيل بالأقسام الثلاثة أعلاه. ابحث براحتك دون التقيّد بعدد، أدرج فقط الجهات المرخّصة والمناسبة فعلاً لحجم الشركة. اجب بالعربية، مهني ومباشر بلا حشو، وأخرج HTML عربي بسيط (h3 للأقسام، ul/li للقوائم) وابدأ مباشرة بالـHTML بلا أي إشارة لذكاء اصطناعي.';

  for (const model of MODELS) {
    try {
      const messages: { role: string; content: unknown }[] = [{ role: 'user', content: prompt }];
      let textOut = '';
      for (let turn = 0; turn < 10; turn++) {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY as string, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({ model, max_tokens: 5000, messages, tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 12 }] }),
        });
        if (!res.ok) break;
        const data = await res.json();
        const content = (data.content || []) as { type: string; text?: string }[];
        textOut += content.filter((b) => b.type === 'text').map((b) => b.text || '').join(' ');
        if (data.stop_reason === 'pause_turn') { messages.push({ role: 'assistant', content: data.content }); continue; }
        break;
      }
      textOut = textOut.trim();
      if (textOut.length > 80) return textOut;
    } catch {}
  }
  return '<h3>جهات الطرح والإدراج</h3><p>يتولى فريق حلول المرضي ترشيح المستشار المالي المرخّص الأنسب ومرافقتكم في رحلة الإدراج.</p>';
}

export async function POST() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (user === null) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

  const { data: company } = await supabase
    .from('companies')
    .select('id, company_name, cr_number, city, sector, phone, account_status')
    .eq('user_id', user.id)
    .single();

  if (company === null || company.account_status !== 'active') {
    return NextResponse.json({ error: 'الحساب غير مفعّل' }, { status: 403 });
  }

  const { data: fd } = await supabase
    .from('financial_data')
    .select('*')
    .eq('company_id', company.id)
    .eq('assessment_type', 'ipo')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  const { data: rr } = await supabase
    .from('readiness_results')
    .select('readiness_score, verdict, top_obstacles, improvement_plan, months_to_ready, valuation_estimate')
    .eq('company_id', company.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (fd === null) return NextResponse.json({ error: 'لا توجد بيانات تقييم طرح' }, { status: 404 });

  const rev = Number(fd.annual_revenue) || 0;
  const profit = Number(fd.net_profit) || 0;
  const score = rr?.readiness_score ?? 0;
  const yes = (v: unknown) => (v === true ? 'نعم' : 'لا');
  const marketLabel = fd.target_market === 'main' ? 'السوق الرئيسية' : 'السوق الموازي (نمو)';
  const growth = fd.revenue_growth || '';
  let valLo = 0, valHi = 0, valBasis = 'none';
  if (profit > 0) {
    let ml = 6, mh = 8;
    if (growth === 'high') { ml = 8; mh = 10; }
    else if (growth === 'medium') { ml = 7; mh = 9; }
    valLo = profit * ml; valHi = profit * mh; valBasis = 'profit';
  } else if (rev > 0) {
    valBasis = 'loss';
  }
  const fmtSar = (n: number) => Math.round(n).toLocaleString('en-US');
  let valNote = '';
  if (rr?.valuation_estimate) {
    try {
      const v = JSON.parse(rr.valuation_estimate);
      if (typeof v.lo === 'number' && typeof v.hi === 'number' && v.hi > 0) { valLo = v.lo; valHi = v.hi; valBasis = 'profit'; valNote = v.note || ''; }
    } catch {}
  }
  const valuationHtml = valBasis === 'profit'
    ? '<p><b>القيمة السوقية التقديرية:</b> ' + fmtSar(valLo) + ' — ' + fmtSar(valHi) + ' ر.س' + (valNote ? '<br/><span style="color:#6B8A80;font-size:13px">' + valNote + '</span>' : '') + '</p>'
    : '<p><b>القيمة السوقية التقديرية:</b> تحتاج ربحية صافية موجبة للتقدير (الشركة غير ربحية حالياً)</p>';
  const planHtml = (rr?.improvement_plan || []).map((x: string, i: number) => '<li style="margin-bottom:4px">' + (i + 1) + '. ' + x + '</li>').join('');
  const monthsTxt = rr?.months_to_ready ? rr.months_to_ready + ' شهراً' : '—';

  try {
    const isDefaulted = fd?.repayment_status === 'default' || fd?.debt_status === 'late';
    const lowScore = score < 65;
    let recoveryHtml = '';
    let planKind: 'recovery' | 'readiness' | 'qualified' | 'waiting' = score >= 65 ? 'qualified' : 'waiting';
    if (isDefaulted) {
      planKind = 'recovery';
      try { recoveryHtml = await generateRecoveryPath({ ...fd }); } catch {}
    } else if (lowScore) {
      planKind = 'readiness';
      try { recoveryHtml = await generateIpoReadinessPlan({ ...fd, score, sector: fd?.sector || company?.sector }); } catch {}
    }
    let advisorsHtml = '';
    if (planKind === 'qualified') {
      try { advisorsHtml = await searchIpoAdvisors(fd?.sector || company?.sector || 'غير محدد', marketLabel, rev); } catch {}
    }
    const resend = new Resend(process.env.RESEND_API_KEY);
    const obstacleRows = (rr?.top_obstacles || []).map((o: string) =>
      '<li style="margin-bottom:4px">' + o + '</li>'
    ).join('');

    await resend.emails.send({
      from: 'د. عبدالحكيم المرضي <noreply@murdi.sa>',
      to: 'hololalmurdi.fs@gmail.com',
      subject: (isDefaulted ? '⚠️ شركة متعثرة (مسار تعافي) — ' : (score >= 65 ? '🎯 مؤهل طرح — ' : 'تقييم طرح — ')) + company.company_name + ' (درجة ' + score + ')',
      html:
        '<div dir="rtl" style="font-family:Arial">' +
        (isDefaulted
          ? '<div style="background:#FBECEC;border:2px solid #C0564B;border-radius:10px;padding:14px;margin-bottom:14px"><b style="color:#A33;font-size:16px">⚠️ غير مؤهل للطرح حالياً — شركة متعثرة</b><br/>الإجراء: الشركة متعثرة في السداد والإدراج مرفوض نظاماً. الفرصة هنا خدمة <b>إعادة هيكلة وتعافٍ</b> تقدّمها حلول المرضي، تمهّد لاحقاً للطرح.</div>'
          : (score >= 65
          ? '<div style="background:#FBF5E8;border:2px solid #C9A84C;border-radius:10px;padding:14px;margin-bottom:14px"><b style="color:#9A7B2E;font-size:16px">🎯 مؤهل للطرح — فرصة خدمة مدفوعة</b><br/>الإجراء: تواصل مع العميل لعرض خطة الطرح الكاملة (المراحل + التكلفة + تجهيز ملف الهيئة).</div>'
          : '<div style="background:#F0F5F3;border:1px solid #ddd;border-radius:10px;padding:14px;margin-bottom:14px"><b style="color:#6B8A80;font-size:16px">⏳ يحتاج تجهيزاً قبل الطرح — فرصة خدمة تجهيز</b><br/>الإجراء: عرض خطة رفع الجاهزية أدناه على العميل كخدمة تجهيز للطرح.</div>')) +
        '<h2>ملف طرح جديد</h2>' +
        '<p><b>الشركة:</b> ' + company.company_name + ' — سجل: ' + company.cr_number + '</p>' +
        '<p><b>الجوال:</b> ' + (company.phone || '—') + ' | <b>المدينة:</b> ' + (company.city || '—') + ' | <b>القطاع:</b> ' + (fd?.sector || company.sector || '—') + '</p>' +
        '<p><b>IPO Readiness Score:</b> ' + score + ' — ' + (rr?.verdict ?? '—') + '</p>' +
        '<p><b>السوق المقترح:</b> ' + marketLabel + ' | <b>⏱️ المدة التقديرية:</b> ' + monthsTxt + '</p>' +
        (recoveryHtml ? '<hr/><div style="background:#F0F7F4;border-radius:10px;padding:14px;margin-top:10px;white-space:pre-wrap;line-height:1.8">' + recoveryHtml + '</div>' : '') +
        (advisorsHtml ? '<hr/><h3 style="color:#1A3D34;margin-top:16px">🏛️ جهات الطرح والإدراج (بحث مباشر)</h3><div style="background:#FBF8EE;border-radius:10px;padding:14px;margin-top:6px;line-height:1.9">' + advisorsHtml + '</div>' : '') +
        suggestionBox(suggestService({ ...fd }, 'ipo', score)) +
        '<hr/>' +
        '<p style="margin-top:14px"><a href="https://murdi.sa/admin/approvals" style="background:#1A3D34;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold">📂 افتح الملف الكامل في الأدمن</a></p>' +
        '<p style="color:#6B8A80;font-size:12px;margin-top:8px">التفاصيل الكاملة (الأرقام، العوائق، خارطة الطريق، التقييم) في لوحة الأدمن.</p>' +
        '</div>',
    });
  } catch {}

  return NextResponse.json({ ok: true });
}
