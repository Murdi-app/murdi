import { createClient } from '@supabase/supabase-js';

type CLead = { company_name: string; sector: string; city: string; signal: string; email: string; phone: string; source: string; message: string; call_script?: string };

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string);
}

function parseCLeads(text: string): CLead[] {
  const cleaned = text.replace(/```json|```/g, '').trim();
  const out: CLead[] = [];
  const cleanPhone = (raw: string): string => {
    const p = raw.replace(/[^0-9]/g, '');
    if (p.startsWith('9665') && p.length === 12) return p;
    if (p.startsWith('05') && p.length === 10) return '966' + p.slice(1);
    if (p.startsWith('5') && p.length === 9) return '966' + p;
    if (p.startsWith('9200') && (p.length === 9 || p.length === 10)) return p;
    if (p.startsWith('8001') && p.length >= 10) return p;
    if (p.startsWith('9661') && p.length === 12) return p;
    if (p.startsWith('01') && p.length === 10) return '966' + p.slice(1);
    return '';
  };
  const norm = (o: Record<string, unknown>): CLead => ({
    company_name: String(o.company_name || '').trim(),
    sector: String(o.sector || '').trim(),
    city: String(o.city || '').trim(),
    signal: String(o.signal || '').trim(),
    email: (() => {
      const e = String(o.email || '').trim().toLowerCase();
      if (!e || e.includes('protected') || e.includes('[') || !/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(e)) return '';
      return e;
    })(),
    phone: cleanPhone(String(o.phone || '')),
    source: String(o.source || '').trim(),
    message: String(o.message || '').trim(),
    call_script: String(o.call_script || '').trim(),
  });
  try {
    const start = cleaned.indexOf('{'); const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end > start) {
      const p = JSON.parse(cleaned.slice(start, end + 1));
      if (Array.isArray(p.leads)) return p.leads.map(norm).filter((l: CLead) => l.company_name && (l.email || l.phone));
    }
  } catch { /* تابع */ }
  const objs = cleaned.match(/\{[^{}]*"company_name"[^{}]*\}/g) || [];
  for (const o of objs) { try { out.push(norm(JSON.parse(o))); } catch { /* تجاهل */ } }
  return out.filter((l) => l.company_name && (l.email || l.phone));
}

async function huntClientsAxis(sectorsLabel: string, dateContext: string, dedupContext: string, count: number): Promise<CLead[]> {
  const prompt = 'أنت باحث تسويق ميداني خبير تعمل لمنصة مُرضي (murdi.sa) — منصة سعودية لقياس جاهزية الشركات للحصول على رأس المال (تمويل، استثمار، طرح) تتبع حلول المرضي للاستشارات المالية.\n\n'
    + 'مهمتك: البحث العميق عن شركات سعودية قائمة ونشطة في القطاعات التالية: ' + sectorsLabel + '، يُرجّح احتياجها لرأس مال (خطة توسع، عقود جديدة، نمو، دخول أسواق، رغبة طرح مستقبلية). استهدف الكيان القانوني الأم فقط — لا فروعاً فردية لسلسلة قائمة.\n\n'
    + dateContext + dedupContext + '\n\n'
    + '=== الدستور الصارم ===\n'
    + '1) شركات سعودية قائمة فقط، صغيرة أو متوسطة (إيراد أو نشاط تقديري من مليون إلى 100 مليون ريال) — الشركات الصغيرة الجادة النامية مرحّب بها تماماً. ممنوع: المدرجة في تداول أو نمو، الكبرى المعروفة، اليونيكورن، من جمع جولة تمويل أو عيّن مستشاراً للطرح.\n'
    + '1ب) استبعاد حاسم لفئة المحل الصغير: المستهدف منشأة لها نشاط قابل للنمو برأس المال (مصنع، شركة لوجستيات، مقاول، شركة تقنية، تاجر جملة، سلسلة ناشئة تسعى للتوسع). استبعد نهائياً المنشأة الفردية نمط-الحياة التي لا تسعى لتمويل أو استثمار: صالون، ورشة سيارات، كوفي/مطعم مفرد، محل تجزئة صغير، مغسلة، بقالة. المعيار: هل لدى الكيان قرار رأسمالي (توسع/تمويل/استثمار)؟ إن لا — استبعده مهما كان صغيراً.\n'
    + '2) الجوال: لا تضع في phone إلا رقم جوال سعودي محمول يبدأ بـ 05 أو 9665 (صالح للواتساب). أرقام الهواتف الثابتة والأرقام الموحدة (تبدأ بـ 011 أو 012 أو 013 أو 920 أو 800) ممنوعة في phone نهائياً — اتركه فارغاً واكتفِ بالإيميل.\n3) الحجم الصارم: المستهدف من مليون إلى 100 مليون ريال. أي شركة مشاريعها أو إيرادها بمئات الملايين = كبيرة مرفوضة. قبل إرجاع القائمة راجعها واحذف كل شركة كبيرة أو مدرجة أو ممولة.\n4) شرط القبول الحاسم: لا تُدرج أي شركة إلا إذا وجدت لها وسيلة تواصل حقيقية منشورة: إيميل رسمي أو رقم جوال/واتساب من موقعها الرسمي أو حسابها الموثق أو دليل أعمال موثوق. لا تخترع أبداً — التلفيق خيانة للمهمة. إن لم تجد وسيلة تواصل فلا تدرج الشركة مهما كانت مغرية.\n'
    + '5) اذكر في signal لماذا هذه الشركة مرشحة (إشارة توسع/عقد/نمو/نشاط) بإيجاز مع المصدر والتاريخ إن وُجد.\n'
    + '6) رابط المصدر في source إلزامي (موقع الشركة أو صفحة الدليل أو الخبر).\n'
    + '7) التنويع: مدن مختلفة (الرياض، جدة، الدمام، الخبر، مكة، المدينة، القصيم، أبها...) وأحجام مختلفة داخل النطاق.\n\n'
    + '=== الرسالة (message) — الأهم ===\n'
    + 'اكتب لكل شركة رسالة عربية مهنية دافئة (3 إلى 4 أسطر) جاهزة للإرسال إيميل أو واتساب، بهذا الهيكل: تحية + إشارة مخصصة لنشاطهم أو توسعهم تحديداً + تعريف موجز: "منصة مُرضي هي منصة سعودية متخصصة في قياس ورفع جاهزية الشركات للحصول على رأس المال — تمويلاً واستثماراً وإدراجاً" + دعوة: "تقدرون تقيسون جاهزية شركتكم مجاناً خلال دقيقتين عبر: https://murdi.sa" + توقيع: "فريق منصة مُرضي — حلول المرضي للاستشارات المالية". بلا أسعار وبلا مبالغات وبلا ضغط بيعي.\n\n'
    + 'استهدف ' + count + ' شركة موثقة. الجودة وصحة بيانات التواصل أهم من العدد — شركة واحدة بإيميل صحيح خير من عشر بلا وسيلة تواصل.\n\n'
    + 'أرجع JSON فقط بلا أي نص آخر وبلا markdown:\n'
    + '{"leads":[{"company_name":"","sector":"","city":"","signal":"","email":"","phone":"","source":"","message":""}]}\n'
    + 'أرجع JSON صالحاً ومكتملاً ومغلقاً بالكامل.';
  try {
    const messages: { role: string; content: unknown }[] = [{ role: 'user', content: prompt }];
    let text = '';
    for (let turn = 0; turn < 10; turn++) {
      let res: Response | null = null;
      for (let attempt = 0; attempt < 4; attempt++) {
        res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY as string, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 8000, messages, tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 18 }] }),
        });
        if (res.ok) break;
        if (res.status === 429 || res.status === 529 || res.status >= 500) { await new Promise((r) => setTimeout(r, 3000 * (attempt + 1))); continue; }
        break;
      }
      if (!res || !res.ok) break;
      const data = await res.json();
      const content = (data.content || []) as { type: string; text?: string }[];
      text += content.filter((b) => b.type === 'text').map((b) => b.text || '').join('');
      if (data.stop_reason === 'pause_turn') { messages.push({ role: 'assistant', content: data.content }); continue; }
      break;
    }
    return parseCLeads(text);
  } catch { return []; }
}

async function huntCallListAxis(dateContext: string, dedupContext: string): Promise<CLead[]> {
  const prompt = 'أنت باحث ميداني خبير تجهّز قائمة اتصال يومية لفريق مبيعات نسائي يعمل لمنصة مُرضي (murdi.sa) — منصة سعودية لقياس ورفع جاهزية الشركات للحصول على رأس المال، تتبع حلول المرضي للاستشارات المالية.\n\n'
    + 'مهمتك: إيجاد منشآت سعودية قائمة، صغيرة إلى متوسطة واعدة، الموظفة ستتصل عليها مباشرة وتفاوضها على الاشتراك.\n\n'
    + dateContext + dedupContext + '\n\n'
    + '=== شروط القبول الصارمة (كلها إلزامية) ===\n'
    + '1) منشأة سعودية قائمة منذ سنتين فأكثر، نشاطها التقديري من 500 ألف إلى 60 مليون ريال سنوياً. مؤشرات الجدية المطلوبة: فروع أو فريق أو حضور رقمي نشط أو نمو ظاهر. ممنوع: المتناهية الصغر (كشك، حساب فردي، نشاط بلا كيان)، ومن تتجاوز 60 مليوناً، والمدرجة، والممولة من صناديق.\n'
    + '2) رقم التواصل شرط قبول نهائي: لا تُدرج أي منشأة إلا برقم منشور من موقعها أو حسابها الموثق أو دليل أعمال موثوق (خرائط جوجل، دليل الأعمال). الأولوية القصوى للجوال المحمول (05/9665) لأنه يفتح واتساب، ويُقبل الرقم الموحد (920/800) والثابت (01) إن لم يتوفر جوال. ابحث في مواقعهم وحساباتهم عن الجوال أولاً وبجدية. لا تخترع رقماً أبداً — الاختراع خيانة للمهمة وللموظفة التي ستتصل.\n'
    + '3) التنويع إلزامي: قطاعات مختلفة (مطاعم وكافيهات، عيادات ومراكز طبية، تجزئة ومتاجر إلكترونية، خدمات مهنية، ورش ومراكز صيانة، تعليم وتدريب، لوجستيات، صالونات ومراكز عناية، منشآت نسائية، مقاولات صغيرة) ومدن مختلفة.\n'
    + '4) signal: لماذا هذه المنشأة مرشحة الآن (توسع، فرع جديد، نمو، إعلان توظيف، نشاط ملحوظ) بإيجاز مع المصدر.\n'
    + '5) source: رابط المصدر إلزامي.\n\n'
    + '=== سكربت المكالمة (call_script) — الأهم إطلاقاً ===\n'
    + 'اكتب لكل منشأة نص مكالمة هاتفية جاهزاً تقرؤه الموظفة حرفياً، بالعربية الفصيحة المبسطة القريبة، بهذا الهيكل الدقيق:\n'
    + '(الافتتاح): السلام عليكم، معك [اسمي] من منصة مُرضي للاستشارات المالية — أتصل بخصوص [اسم المنشأة]. ثم جملة مخصصة تلمس نشاطهم أو توسعهم المذكور في signal تحديداً.\n'
    + '(الوجع): جملة واحدة تربط وضعهم بحاجة رأس المال.\n'
    + '(العرض): منصة مُرضي تقيس جاهزية منشأتكم للتمويل والاستثمار وتعطيكم خطة واضحة — وأول خطوة تقييم مجاني خلال دقيقتين.\n'
    + '(الإغلاق): أرسل لكم رابط التقييم واتساب على هذا الرقم؟ وبعد ما تشوفون نتيجتكم أتواصل معكم نكمل.\n'
    + '(اعتراض شائع + رد): سطر واحد لأرجح اعتراض من هذه المنشأة تحديداً ورد مقنع مختصر عليه.\n'
    + 'بلا أسعار في المكالمة الأولى، وبلا مبالغات، ونبرة محترمة دافئة.\n\n'
    + 'استهدف 45 منشأة موثقة. الجودة وصحة الجوال أهم من العدد — منشأة واحدة بجوال صحيح خير من عشر بأرقام ميتة.\n\n'
    + 'أرجع JSON فقط بلا أي نص آخر وبلا markdown:\n'
    + '{"leads":[{"company_name":"","sector":"","city":"","signal":"","email":"","phone":"","source":"","message":"","call_script":""}]}\n'
    + 'أرجع JSON صالحاً ومكتملاً ومغلقاً بالكامل.';
  try {
    const messages: { role: string; content: unknown }[] = [{ role: 'user', content: prompt }];
    let text = '';
    for (let turn = 0; turn < 10; turn++) {
      let res: Response | null = null;
      for (let attempt = 0; attempt < 4; attempt++) {
        res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY as string, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 8000, messages, tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 18 }] }),
        });
        if (res.ok) break;
        if (res.status === 429 || res.status === 529 || res.status >= 500) { await new Promise((r) => setTimeout(r, 3000 * (attempt + 1))); continue; }
        break;
      }
      if (!res || !res.ok) break;
      const data = await res.json();
      const content = (data.content || []) as { type: string; text?: string }[];
      text += content.filter((b) => b.type === 'text').map((b) => b.text || '').join('');
      if (data.stop_reason === 'pause_turn') { messages.push({ role: 'assistant', content: data.content }); continue; }
      break;
    }
    return parseCLeads(text).filter((l) => l.phone);
  } catch { return []; }
}

export async function runCallListHunt(): Promise<{ total: number }> {
  const now = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const dateContext = '=== التاريخ ===\nتاريخ اليوم: ' + fmt(now) + '. فضّل الإشارات الحديثة (آخر 6 أشهر).';

  const adminClient = admin();
  const { data: prev } = await adminClient.from('client_hunt_leads').select('company_name').order('created_at', { ascending: false }).limit(120);
  const prevNames = Array.from(new Set(((prev || []) as { company_name: string }[]).map((r) => r.company_name)));
  const dedupContext = prevNames.length
    ? '\n\n=== ممنوع التكرار ===\nالمنشآت التالية موجودة عندنا — لا تدرج أياً منها:\n' + prevNames.join('، ')
    : '';

  const results = await Promise.all([
    huntCallListAxis(dateContext, dedupContext),
    huntCallListAxis(dateContext, dedupContext + '\n(ركّز هذه الجولة على مدن ومناطق غير الرياض: جدة، الدمام، الخبر، مكة، المدينة، القصيم، أبها، الطائف، تبوك، حائل)'),
  ]);

  const seen = new Set<string>(prevNames.map((n) => n.trim().toLowerCase()));
  const rows: Record<string, unknown>[] = [];
  for (const leads of results) {
    for (const l of leads) {
      const key = l.company_name.trim().toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({
        hunt_date: fmt(now), company_name: l.company_name, sector: l.sector || null, city: l.city || null,
        signal: l.signal || null, email: l.email || null, phone: l.phone || null,
        source: l.source || null, message: l.message || null, call_script: l.call_script || null, status: 'call_list',
      });
    }
  }
  if (rows.length) await adminClient.from('client_hunt_leads').insert(rows);
  return { total: rows.length };
}

export async function runClientHunt(): Promise<{ total: number }> {
  const now = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const dateContext = '=== التاريخ ===\nتاريخ اليوم: ' + fmt(now) + '. فضّل الإشارات الحديثة (آخر 6 أشهر).';

  const adminClient = admin();
  const { data: prev } = await adminClient.from('client_hunt_leads').select('company_name').order('created_at', { ascending: false }).limit(120);
  const prevNames = Array.from(new Set(((prev || []) as { company_name: string }[]).map((r) => r.company_name)));
  const dedupContext = prevNames.length
    ? '\n\n=== ممنوع التكرار ===\nالشركات التالية موجودة عندنا — لا تدرج أياً منها:\n' + prevNames.join('، ')
    : '';

  const axes = [
    { sectors: 'المقاولات والإنشاءات، التشطيب والديكور، الصيانة والتشغيل', count: 40 },
    { sectors: 'الصناعة والتصنيع، الأغذية والمشروبات، التغليف والبلاستيك والمعادن', count: 40 },
    { sectors: 'التجزئة والتجارة الإلكترونية، المطاعم والكافيهات والامتياز التجاري، سلاسل السوبرماركت', count: 40 },
    { sectors: 'الرعاية الصحية والعيادات والمراكز الطبية، الصيدليات، مراكز التجميل والعناية', count: 40 },
    { sectors: 'التقنية والمنصات والبرمجيات، التسويق والإعلام الرقمي، التعليم والتدريب الخاص', count: 40 },
    { sectors: 'اللوجستيات والنقل والتخزين والشحن، تجارة الجملة والتوزيع، الطاقة والمقاولات المتخصصة، الخدمات العقارية والإدارية', count: 40 },
  ];

  const results = await Promise.all(axes.map((a) => huntClientsAxis(a.sectors, dateContext, dedupContext, a.count)));

  const seen = new Set<string>(prevNames.map((n) => n.trim().toLowerCase()));
  const rows: Record<string, unknown>[] = [];
  for (const leads of results) {
    for (const l of leads) {
      const key = l.company_name.trim().toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({
        hunt_date: fmt(now), company_name: l.company_name, sector: l.sector || null, city: l.city || null,
        signal: l.signal || null, email: l.email || null, phone: l.phone || null,
        source: l.source || null, message: l.message || null, status: 'new',
      });
    }
  }
  if (rows.length) await adminClient.from('client_hunt_leads').insert(rows);
  return { total: rows.length };
}
