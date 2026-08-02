// محرك توليد ملف التمويل/الاستثمار الاحترافي — مُرضي
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-6';

export interface FileClientData {
  companyName: string;
  crNumber?: string;
  sector?: string;
  city?: string;
  goal?: string;
  revenue?: number;
  profit?: number;
  assets?: number;
  liabilities?: number;
  readinessScore?: number;
  verdict?: string;
  valuationEstimate?: string;
  fundingAmount?: number;
  fundingType?: string;
}

export interface GeneratedFile {
  executiveSummary: string;
  companyOverview: string;
  financialPosition: string;
  theRequest: string;
  strengths: string;
  closing: string;
  companyNameEn?: string;
  cityEn?: string;
  sectorEn?: string;
}

export async function generateFileContent(
  client: FileClientData,
  track: 'funding' | 'investment',
  region?: string
): Promise<GeneratedFile> {
  const isInvestment = track === 'investment';
  const isIntl = (region || '').includes('دولي') || (region || '').toLowerCase().includes('intl');
  const docType = isIntl
    ? (isInvestment ? 'investment offering document' : 'financing proposal document')
    : (isInvestment ? 'ملف عرض استثماري' : 'ملف تمويلي');
  const targetAudience = isIntl
    ? (isInvestment ? 'institutional investors' : 'international financing institutions and banks')
    : (isInvestment ? 'المستثمرين المؤسسيين' : 'جهات التمويل والبنوك');
  const num = (n?: number) => n ? n.toLocaleString('en-US') + ' ريال' : '';

  const lines = [
    'الاسم: ' + client.companyName,
    client.crNumber ? 'السجل التجاري: ' + client.crNumber : '',
    client.sector ? 'القطاع: ' + client.sector : '',
    client.city ? 'المدينة: ' + client.city : '',
    client.goal ? 'الهدف: ' + client.goal : '',
    client.revenue ? 'الإيرادات السنوية: ' + num(client.revenue) : '',
    client.profit ? 'صافي الربح: ' + num(client.profit) : '',
    client.assets ? 'إجمالي الأصول: ' + num(client.assets) : '',
    client.liabilities ? 'إجمالي الالتزامات: ' + num(client.liabilities) : '',
    client.valuationEstimate ? 'التقييم التقديري: ' + client.valuationEstimate : '',
    (!isInvestment && client.readinessScore) ? 'درجة الجاهزية: ' + client.readinessScore + '/100' : '',
    client.fundingAmount ? 'المبلغ المطلوب (حدّده المستشار — استخدمه حرفياً ولا تجتهد في تقديره): ' + num(client.fundingAmount) : '',
  ].filter(Boolean).join('\\n');

  const reqLine = isIntl
    ? (isInvestment
        ? 'theRequest: the investment offer — amount sought, use of funds, and value offered to the investor'
        : 'theRequest: the financing request — amount, purpose, and repayment capacity')
    : (isInvestment
        ? 'theRequest: عرض الاستثمار — المبلغ المطلوب وأوجه استخدامه والقيمة المعروضة للمستثمر'
        : 'theRequest: طلب التمويل — المبلغ والغرض والقدرة على السداد');

  const INVEST_RULES = 'قواعد إلزامية لمسار الاستثمار: (1) ممنوع منعاً باتاً ذكر درجة الجاهزية أو أي تقييم داخلي للمنصة، وممنوع أي إشارة إلى نقص في الجاهزية أو الحوكمة أو التوثيق. (2) ممنوع لغة الإقراض بالكامل: لا سداد، ولا خدمة دين، ولا جدارة ائتمانية، ولا قدرة على السداد، ولا وصف المبلغ بأنه تمويل يُسترد — المستثمر يشتري حصة ولا يُسدَّد له. (3) في theRequest اذكر صراحةً الحصة المعروضة والتقييم قبل الجولة إن وردا في البيانات، مع أوجه استخدام رأس المال بالتفصيل. (4) ممنوع إدراج الوعي بالجاهزية أو الرغبة في التحسين أو أي إقرار بنقص ضمن نقاط القوة — نقاط القوة إنجازات محققة فقط. (5) الالتزامات تُذكر مرة واحدة كحقيقة عابرة: لا تُجعل عنواناً ولا أبرز ميزة، ولا تُحسب نسبتها إلى الإيراد. (6) صافي الربح إن وُجد هو الرقم الأبرز، وابدأ به الملخص التنفيذي. ';

  const prompt = (isIntl
    ? 'You are an expert preparing a professional ' + docType + ' at Holol Almurdi Financial Consulting (Murdi). Write the entire content in formal institutional ENGLISH. '
      + 'Address it to ' + targetAudience + '. Use the same 6-section JSON structure and rules described below, but write every section in professional English, no Arabic. '
      + 'Keep the exact same JSON keys. For companyNameEn/cityEn/sectorEn: translate ONLY if the Arabic value is a real, meaningful name; if a field is empty, numeric, or meaningless (e.g. 2, 222, a dash), copy it verbatim and never invent a substitute. Also provide companyNameEn (establishment name in English/transliteration), cityEn (English city e.g. Riyadh), sectorEn (English sector e.g. Trade).\\n\\n'
    : '')
    + 'أنت خبير في إعداد ' + docType + ' احترافي في حلول المرضي للاستشارات المالية (منصة مُرضي).\\n'
    + 'اكتب محتوى ' + docType + ' متكامل ومقنع موجّه إلى ' + targetAudience + '.\\n\\n'
    + 'بيانات الشركة والوضع المالي:\\n' + lines + '\\n\\n'
    + 'اكتب ٦ أقسام احترافية، كل قسم فقرات متماسكة (لا نقاط مختصرة):\\n'
    + '1. executiveSummary: ملخص تنفيذي موجز وقوي (٣-٤ أسطر).\\n'
    + '2. companyOverview: نبذة عن الشركة ونشاطها وموقعها (٤-٥ أسطر).\\n'
    + '3. financialPosition: تحليل الوضع المالي من الأرقام المتاحة، يبرز الجدارة (٤-٥ أسطر). لا تختلق أرقاما.\\n'
    + '4. ' + reqLine + ' (٤-٥ أسطر).\\n'
    + '5. strengths: نقاط القوة التي تبرّر القرار (٤-٥ أسطر سردية).\\n'
    + '6. closing: خاتمة مهنية تدعو للتواصل ودراسة الملف.\\n\\n'
    + 'ضوابط: لا تختلق أرقاماً، لا ضمانات، لا ذكر لأي ذكاء اصطناعي، أسلوب عربي مؤسسي، المحتوى منسوب لحلول المرضي.\\n\\n'
    + 'أرجع JSON نقي فقط بدون أي نص قبله أو بعده:\\n'
    + 'IMPORTANT: do not compare this client to other clients, no ranking claims, no invented facts beyond the figures given. '
    + (isInvestment ? INVEST_RULES : '')
    + 'In theRequest you MUST state a concrete financing/investment ask: an explicit amount or a clear range derived from the client goal or, if absent, a defensible range tied to annual revenue, plus the specific use of funds and the repayment/return basis. Never leave the amount to be decided later. '
    + '{"executiveSummary":"...","companyOverview":"...","financialPosition":"...","theRequest":"...","strengths":"...","closing":"..."}';

  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY as string,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model: MODEL, max_tokens: 8000, tools: [{ name: 'build_file', description: 'file content', input_schema: { type: 'object', properties: { executiveSummary: { type: 'string' }, companyOverview: { type: 'string' }, financialPosition: { type: 'string' }, theRequest: { type: 'string' }, strengths: { type: 'string' }, closing: { type: 'string' }, companyNameEn: { type: 'string' }, cityEn: { type: 'string' }, sectorEn: { type: 'string' } }, required: ['executiveSummary','companyOverview','financialPosition','theRequest','strengths','closing','companyNameEn','cityEn','sectorEn'] } }], tool_choice: { type: 'tool', name: 'build_file' }, messages: [{ role: 'user', content: prompt }] }),
  });

  if (!res.ok) throw new Error('تعذّر توليد الملف (HTTP ' + res.status + ')');

  const data = await res.json();
  const toolUse = (data.content || []).find((b: { type: string; input?: unknown }) => b.type === 'tool_use') as { input?: Record<string, unknown> } | undefined;
  if (!toolUse || !toolUse.input) throw new Error('no tool output stop=' + (data.stop_reason || '?'));
  const parsed = toolUse.input;
  return {
    executiveSummary: String(parsed.executiveSummary || '').trim(),
    companyOverview: String(parsed.companyOverview || '').trim(),
    financialPosition: String(parsed.financialPosition || '').trim(),
    theRequest: String(parsed.theRequest || '').trim(),
    strengths: String(parsed.strengths || '').trim(),
    closing: String(parsed.closing || '').trim(),
    companyNameEn: parsed.companyNameEn ? String(parsed.companyNameEn).trim() : undefined,
    cityEn: parsed.cityEn ? String(parsed.cityEn).trim() : undefined,
    sectorEn: parsed.sectorEn ? String(parsed.sectorEn).trim() : undefined,
  };
}

// ─── قالب الملف الاحترافي (HTML جاهز للطباعة/حفظ PDF) ───────────

const FIN_DICT: Record<string, string> = {
  'البند': 'Item', 'السنة الأولى (ريال)': 'Year 1 (SAR)', 'السنة الثانية (ريال)': 'Year 2 (SAR)',
  'الإيرادات': 'Revenue', 'تكلفة النشاط (البضاعة/الخدمة)': 'Cost of Sales', 'مجمل الربح': 'Gross Profit',
  'المصروفات التشغيلية': 'Operating Expenses', 'مصروف الإهلاك': 'Depreciation Expense',
  'الربح التشغيلي': 'Operating Profit', 'الزكاة': 'Zakat', 'صافي الربح': 'Net Profit',
  'النقد وما في حكمه (البنوك)': 'Cash and Cash Equivalents', 'الذمم المدينة (صافي)': 'Accounts Receivable (Net)',
  'مخصص الديون المشكوك فيها': 'Allowance for Doubtful Debts', 'المخزون': 'Inventory',
  'أعمال تحت التنفيذ': 'Work in Progress', 'أصول تشغيلية للنشاط': 'Operating Assets',
  'الأصول الثابتة (صافي)': 'Fixed Assets (Net)', 'إجمالي الأصول': 'Total Assets',
  'الذمم الدائنة (موردون)': 'Accounts Payable', 'القروض والتمويل': 'Loans and Financing',
  'دفعات مقدمة من العملاء': 'Customer Advances', 'إيراد مؤجل': 'Deferred Revenue',
  'ضريبة القيمة المضافة المستحقة': 'VAT Payable', 'الزكاة المستحقة': 'Zakat Payable',
  'مخصص نهاية الخدمة': 'End of Service Provision', 'إجمالي الالتزامات': 'Total Liabilities',
  'رأس المال': 'Capital', 'الأرباح المرحّلة (ختامية)': 'Retained Earnings (Closing)',
  'الأرباح المرحّلة — الختامية': 'Retained Earnings — Closing', 'الأرباح المرحّلة — الافتتاحية': 'Retained Earnings — Opening',
  'حساب المالك الجاري': "Owner's Current Account", 'حساب المالك الجاري (دائن)': "Owner's Current Account (Credit)",
  'حساب المالك الجاري (مدين)': "Owner's Current Account (Debit)", 'حركة حساب المالك الجاري': "Movement in Owner's Current Account",
  'إجمالي حقوق الملكية': 'Total Equity', 'إجمالي الالتزامات وحقوق الملكية': 'Total Liabilities and Equity',
  '(+) الإهلاك (غير نقدي)': '(+) Depreciation (Non-Cash)', '(+) صافي ربح السنة': '(+) Net Profit for the Year',
  '(−) التوزيعات': '(−) Distributions', 'التوزيعات/المسحوبات': 'Distributions / Drawings',
  'التغيّر في الذمم المدينة': 'Change in Accounts Receivable', 'التغيّر في المخزون': 'Change in Inventory',
  'التغيّر في الذمم الدائنة': 'Change in Accounts Payable', 'التغيّر في أعمال تحت التنفيذ': 'Change in Work in Progress',
  'التغيّر في الدفعات المقدمة': 'Change in Customer Advances', 'التغيّر في الإيراد المؤجل': 'Change in Deferred Revenue',
  'التغيّر في ضريبة القيمة المضافة': 'Change in VAT', 'التغيّر في الزكاة المستحقة': 'Change in Zakat Payable',
  'التغيّر في مخصص نهاية الخدمة': 'Change in End of Service Provision',
  'التغيّر في أصول النشاط التشغيلية': 'Change in Operating Assets', 'التغيّر في القروض والتمويل': 'Change in Loans and Financing',
  'صافي النقد من التشغيل': 'Net Cash from Operations', 'صافي الحركة في الأصول الثابتة': 'Net Movement in Fixed Assets',
  'صافي النقد من الاستثمار': 'Net Cash from Investing', 'صافي النقد من التمويل': 'Net Cash from Financing',
  'صافي التغيّر في النقد': 'Net Change in Cash', 'النقد الافتتاحي': 'Opening Cash',
  'النقد الختامي (محسوب)': 'Closing Cash (Computed)', 'النقد الختامي بالدفاتر': 'Closing Cash per Books',
  'فرق للمطابقة': 'Reconciliation Difference',
  'الأنشطة التشغيلية': 'Operating Activities',
  'الأنشطة الاستثمارية': 'Investing Activities',
  'الأنشطة التمويلية': 'Financing Activities',
  'مطابقة النقد': 'Cash Reconciliation',
};

export function extractStatementTables(raw: string, toEnglish: boolean): string {
  if (!raw) return '';
  const tables = raw.match(/<table[\s\S]*?<\/table>/g);
  if (!tables || tables.length === 0) return '';
  let html = tables.join('');
  if (toEnglish) {
    for (const [ar, en] of Object.entries(FIN_DICT)) {
      html = html.split('>' + ar + '<').join('>' + en + '<');
    }
    html = html.replace(/dir="rtl"/g, 'dir="ltr"').replace(/text-align:right/g, 'text-align:left');
  }
  return html;
}

export function buildFileHTML(
  client: FileClientData,
  content: GeneratedFile,
  track: 'funding' | 'investment',
  region?: string,
  statementsRaw?: string
): string {
  const isInv = track === 'investment';
  const intl = (region || '').includes('دولي') || (region || '').toLowerCase().includes('intl');
  const cAny = content as unknown as Record<string, unknown>;
  const nameOut = intl && cAny.companyNameEn ? String(cAny.companyNameEn) : client.companyName;
  const cityOut = intl && cAny.cityEn ? String(cAny.cityEn) : (client.city || '');
  const sectorOut = intl && cAny.sectorEn ? String(cAny.sectorEn) : (client.sector || '');
  const dirAttr = intl ? 'ltr' : 'rtl';
  const langAttr = intl ? 'en' : 'ar';
  const title = intl
    ? (isInv ? 'Investment Offering' : 'Financing Proposal')
    : (isInv ? 'ملف العرض الاستثماري' : 'الملف التمويلي');
  const L = intl
    ? { exec: 'Executive Summary', company: 'Company Overview', fin: 'Financial Position', req: isInv ? 'The Investment Offer' : 'The Financing Request', strengths: 'Key Strengths', closing: 'Closing', sector: 'Sector', city: 'City', cr: 'CR Number', score: 'Readiness Score', brand: 'HOLOL ALMURDI FINANCIAL CONSULTING' }
    : { exec: 'الملخص التنفيذي', company: 'نبذة عن الشركة', fin: 'الوضع المالي', req: isInv ? 'العرض الاستثماري' : 'طلب التمويل', strengths: 'نقاط القوة', closing: 'الخاتمة', sector: 'القطاع', city: 'المدينة', cr: 'السجل التجاري', score: 'درجة الجاهزية', brand: 'حلول المرضي للاستشارات المالية' };
  const ink = '#1A3D34', gold = '#C9A84C', green = '#2E9E7B', gray = '#6B8A80';
  const today = new Date().toLocaleDateString(intl ? 'en-GB' : 'ar-SA', { year: 'numeric', month: 'long', day: 'numeric' });

  const section = (t: string, body: string) =>
    '<div class="sec"><h2>' + t + '</h2><p>' + String(body).replace(/\\n/g, '<br>') + '</p></div>';

  const facts: ([string, string] | null)[] = [
    sectorOut ? [L.sector, sectorOut] as [string, string] : null,
    cityOut ? [L.city, cityOut] as [string, string] : null,
    client.crNumber ? [L.cr, client.crNumber] as [string, string] : null,
    (!isInv && client.readinessScore) ? [L.score, client.readinessScore + '/100'] as [string, string] : null,
  ].filter(Boolean);

  const factsHTML = (facts.filter(Boolean) as [string, string][]).map(f => '<div class="fact"><span>' + f[0] + '</span><b>' + f[1] + '</b></div>').join('');

  return '<!DOCTYPE html><html dir="' + dirAttr + '" lang="' + langAttr + '"><head><meta charset="utf-8">'
    + '<title>' + title + ' — ' + nameOut + '</title>'
    + '<style>'
    + '@import url("https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap");'
    + '*{margin:0;padding:0;box-sizing:border-box;font-family:Cairo,Arial,sans-serif}'
    + 'body{color:#2A2A2A;line-height:1.9;background:#fff}'
    + '.page{max-width:800px;margin:0 auto;padding:0}'
    + '.cover{background:linear-gradient(135deg,' + ink + ' 0%,#14302a 100%);color:#fff;padding:90px 60px;text-align:center;page-break-after:always}'
    + '.cover .brand{color:' + gold + ';font-size:15px;font-weight:900;letter-spacing:2px;margin-bottom:40px}'
    + '.cover h1{font-size:42px;font-weight:900;margin-bottom:14px}'
    + '.cover .company{font-size:24px;color:' + gold + ';font-weight:700;margin-bottom:50px}'
    + '.cover .date{font-size:14px;opacity:0.8}'
    + '.cover .line{width:70px;height:4px;background:' + gold + ';margin:30px auto;border-radius:2px}'
    + '.content{padding:50px 60px}'
    + '.facts{display:flex;flex-wrap:wrap;gap:14px;margin-bottom:40px;padding-bottom:30px;border-bottom:2px solid #EEE}'
    + '.fact{background:#F0F5F3;border-radius:12px;padding:12px 20px;flex:1;min-width:130px}'
    + '.fact span{display:block;color:' + gray + ';font-size:12px;font-weight:700;margin-bottom:4px}'
    + '.fact b{color:' + ink + ';font-size:17px;font-weight:900}'
    + '.sec{margin-bottom:34px}'
    + '.sec h2{color:' + ink + ';font-size:20px;font-weight:900;margin-bottom:12px;padding-right:16px;border-right:5px solid ' + gold + '}'
    + '.sec p{color:#3A3A3A;font-size:15px;text-align:justify}'
    + '.footer{margin-top:50px;padding-top:24px;border-top:2px solid #EEE;text-align:center;color:' + gray + ';font-size:13px}'
    + '.footer b{color:' + ink + '}'
    + '@media print{.cover{padding:120px 60px}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}'
    + '</style></head><body><div class="page">'
    + '<div class="cover"><div class="brand">' + L.brand + '</div>'
    + '<div class="line"></div>'
    + '<h1>' + title + '</h1>'
    + '<div class="company">' + nameOut + '</div>'
    + '<div class="date">' + today + '</div></div>'
    + '<div class="content">'
    + (factsHTML ? '<div class="facts">' + factsHTML + '</div>' : '')
    + section(L.exec, content.executiveSummary)
    + section(L.company, content.companyOverview)
    + section(L.fin, content.financialPosition)
    + section(L.req, content.theRequest)
    + section(L.strengths, content.strengths)
    + section(L.closing, content.closing)
    + (() => { const t = extractStatementTables(statementsRaw || '', intl); return t ? '<div class="sec"><h2>' + (intl ? 'Financial Statements' : 'القوائم المالية') + '</h2>' + t + '</div>' : ''; })()
    + '<div class="footer"><b>' + L.brand + '</b><br>'
    + (intl ? 'Prepared by Holol Almurdi Financial Consulting per the methodology of Dr. Abdulhakim Almurdi. All rights reserved.</div>' : 'أُعدّ هذا الملف وفق منهجية د. عبدالحكيم المرضي — جميع الحقوق محفوظة</div>')
    + '</div></div></body></html>';
}
