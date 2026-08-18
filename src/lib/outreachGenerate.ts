// ════════════════════════════════════════════════════════════════
// محرك مخاطبة الجهات — مُرضي
// يولّد رسالة احترافية مخصّصة لكل جهة، ويبحث عن إيميلها ويصنّف الثقة
// ════════════════════════════════════════════════════════════════

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-6';
const MODEL_WRITER = 'claude-sonnet-4-6';

export interface EntityInput {
  provider: string;
  product: string;
  requirements?: string;
  region?: string;
  track: 'funding' | 'investment';
  instrument?: string;
  engagement?: string;
  knownEmail?: string;
}

export interface ClientInput {
  companyName: string;
  sector?: string;
  city?: string;
  goal?: string;
  revenue?: number;
  readinessScore?: number;
  verdict?: string;
  profit?: number;
  roundSize?: number;
  equityOffered?: string;
  preMoney?: string;
  fundAmount?: number;
  fundPurpose?: string;
}

export interface GeneratedMessage {
  subject: string;
  body: string;
  email: string | null;
  emailConfidence: 'مؤكّد' | 'غير مؤكّد' | 'غير متوفّر';
  emailSource: string;
  altContact: string | null;
  contactMethod: string;
  language: 'عربي' | 'إنجليزي';
}

export async function findEntityEmail(
  entity: EntityInput
): Promise<{ email: string | null; confidence: GeneratedMessage['emailConfidence']; source: string; altContact: string | null; contactMethod: string }> {
  if (entity.knownEmail && entity.knownEmail.includes('@')) {
    return { email: entity.knownEmail.trim(), confidence: 'مؤكّد', source: 'قاعدة بيانات مُرضي', altContact: null, contactMethod: 'إيميل' };
  }

  const prompt = `أنت باحث دقيق عن معلومات التواصل الرسمية للجهات المالية.
مهمتك: إيجاد البريد الإلكتروني الرسمي للتواصل مع الجهة التالية (قسم التمويل/الاستثمار أو التواصل العام).

الجهة: ${entity.provider}
${entity.product ? 'المنتج/الخدمة: ' + entity.product : ''}
${entity.region ? 'المنطقة: ' + entity.region : ''}

ابحث في الموقع الرسمي. رتّب أولوياتك:
1. بريد مؤكّد من الموقع الرسمي.
2. إن لم تجد بريداً مؤكّداً من الموقع الرسمي، أرجع email=null و confidence="غير متوفّر". ممنوع منعاً باتاً تأليف أو تخمين أي بريد (لا info@ ولا contact@ ولا غيرهما) — يُعتمد حينها على alt_contact وحده.
قاعدة إلزامية قصوى: alt_contact لا يجوز أن يكون فارغاً أبداً في أي حالة. حتى لو لم تجد بريداً، يجب أن ترجع في alt_contact طريقة تواصل رسمية واحدة على الأقل — وبالأولوية: رابط صفحة/بوابة التقديم أو نموذج التواصل الرسمي من موقع الجهة، ثم رقم هاتف رسمي، ثم حساب لينكدإن رسمي. كثير من جهات التمويل والاستثمار تستقبل الطلبات عبر بوابة أو نموذج أونلاين فقط بدون بريد معلن — في هذه الحالة رابط البوابة هو الطريق الصحيح وليس بديلاً ثانوياً. ابحث تحديداً عن صفحات مثل: تقديم طلب تمويل، اتصل بنا، خدمات الشركات، Trade Finance، apply/contact-us. اجعل alt_contact نصاً كاملاً يحوي الرابط (أو الرقم) صريحا. أرجع JSON نقي فقط:
{
  "email": "البريد المؤكّد أو المحتمل أو null",
  "confidence": "مؤكّد" إن كان من الموقع الرسمي، أو "غير مؤكّد" إن كان اقتراحاً منطقياً، أو "غير متوفّر" إن لم تجد,
  "source": "وصف موجز للمصدر",
  "alt_contact": "طريقة تواصل بديلة كنص (رابط نموذج أو رقم أو لينكدإن) أو null",
  "contact_method": "إيميل" أو "نموذج" أو "هاتف" أو "لينكدإن"
}

مهم جداً: لا تخترع بريداً. إن لم تجد بريداً رسمياً مؤكّداً، أرجع "غير متوفّر" أو "غير مؤكّد". الدقة أهم من الإجابة.`;

  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY as string,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1200,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) {
      return { email: null, confidence: 'غير متوفّر', source: 'تعذّر البحث', altContact: null, contactMethod: 'إيميل' };
    }

    const data = await res.json();
    const text = (data.content || [])
      .filter((b: { type: string }) => b.type === 'text')
      .map((b: { text: string }) => b.text)
      .join('\n');

    const clean = text.replace(/\`\`\`json|\`\`\`/g, '').trim();
    const m = clean.match(/\{[\s\S]*\}/);
    if (!m) {
      return { email: null, confidence: 'غير متوفّر', source: 'تعذّر التحليل — لا JSON: ' + clean.slice(0, 150), altContact: null, contactMethod: 'إيميل' };
    }
    let parsed;
    try {
      parsed = JSON.parse(m[0]);
    } catch {
      return { email: null, confidence: 'غير متوفّر', source: 'فشل JSON.parse: ' + m[0].slice(0, 150), altContact: null, contactMethod: 'إيميل' };
    }
    const email = parsed.email && String(parsed.email).includes('@') ? String(parsed.email).trim() : null;
    const confidence: GeneratedMessage['emailConfidence'] =
      email === null ? 'غير متوفّر'
      : (parsed.confidence === 'مؤكّد' ? 'مؤكّد' : 'غير مؤكّد');

    const altContact = parsed.alt_contact && String(parsed.alt_contact).trim() && String(parsed.alt_contact) !== 'null' ? String(parsed.alt_contact).trim() : null;
    const contactMethod = String(parsed.contact_method || 'إيميل');
    return { email, confidence, source: String(parsed.source || 'بحث الإنترنت'), altContact, contactMethod };
  } catch {
    return { email: null, confidence: 'غير متوفّر', source: 'خطأ في البحث', altContact: null, contactMethod: 'إيميل' };
  }
}

export async function generateOutreachMessage(
  client: ClientInput,
  entity: EntityInput
): Promise<{ subject: string; body: string; language: 'عربي' | 'إنجليزي' }> {
  const isIntl = (entity.region || '').includes('دولي') || (entity.region || '').toLowerCase().includes('intl');
  const language: 'عربي' | 'إنجليزي' = isIntl ? 'إنجليزي' : 'عربي';
  const inst = entity.instrument || (entity.track === 'investment' ? 'ملكية' : 'دين');
  const isEquity = inst.includes('ملكية');
  const isMezz = !isEquity && inst.includes('مساند');
  const isGuar = inst.includes('ضمان');
  const isAcq = inst.includes('استحواذ');
  const trackWord = isAcq ? 'استحواذ' : isEquity ? 'استثمار' : 'تمويل';
  const entityContext = isIntl
    ? 'جهة خارجية تمول السوق السعودي — ابنِ الإقناع على آلية التمويل العابر للحدود، ووجود شريك أو فرع محلي، وتوافق قطاع العميل مع اهتمام الجهة بالسوق السعودي. اكتب بلغة وأسلوب دوليّين احترافيّين يناسبان مؤسسة أجنبية.'
    : 'جهة سعودية محلية — ابنِ الإقناع على الإطار التنظيمي السعودي والقرب والثقة المحلية. اكتب بأسلوب سعودي رسمي مألوف لمؤسسة محلية.'

  const prompt = `أنت كاتب مراسلات رسمية محترف في شركة "حلول المرضي للاستشارات المالية" (منصة مُرضي).
مهمتك: كتابة رسالة بريد إلكتروني رسمية ومهنية موجّهة إلى جهة ${trackWord}، للاستفسار عن إمكانية حصول عميلنا على منتجها.

${isAcq ? 'إطار إلزامي — جهة استحواذ: هذه الجهة تشتري الشركة كاملة أو حصة أغلبية ولا تشارك في جولة بحصة أقلية. ممنوع دعوتها للمشاركة في جولة، وممنوع عرض نسبة أقلية أو ذكر تقييم قبل الجولة. اكتب استفساراً مهنياً عن اهتمامها بفرصة تملّك في قطاع العميل: صف النشاط والأداء والأصول التي تنتقل مع الصفقة، واطلب معايير الاستحواذ لديها والخطوات والمستندات. ولا تذكر سعراً ولا نطاق ثمن إطلاقاً.' : isGuar ? 'إطار إلزامي — جهة ضمان لا تمويل: هذه الجهة تضمن أو تؤمّن ولا تمنح العميل مالاً. لا تطلب منها تسهيلاً ائتمانياً ولا مبلغاً. اسأل عن شروط تغطية الضمان أو التأمين الائتماني للعميل، وعن الجهة الممولة التي تعمل معها، وعن المستندات اللازمة لدراسة التغطية. ممنوع أي صيغة توحي بأننا نطلب منها المال.' : isMezz ? 'إطار إلزامي — دين مساند: العميل يجمع جولة، والجهة تقدّم تمويلاً مربوطاً بالجولة لا حصة ملكية. اذكر حجم الجولة والغرض وأفق السداد ومصادر التدفق. ممنوع عرض أي حصة أو تقييم أو نسبة ملكية على هذه الجهة.' : isEquity
  ? 'إطار إلزامي — مسار استثمار: العميل يعرض حصة من ملكيته على مستثمر، ولا يطلب قرضاً. اكتب بلغة الملكية: الجولة، الحصة المعروضة، التقييم قبل الجولة، أفق العائد، قابلية التوسع. ممنوع منعاً باتاً ذكر السداد أو الأقساط أو الضمانات أو تمويل الفواتير أو رأس المال العامل أو الجدارة الائتمانية أو أي لفظ إقراضي — المستثمر يشتري حصة ولا يُسدَّد له. حتى إن كان منتج الجهة ديناً مرناً، فاطلب أهلية المشاركة في الجولة لا تسهيلاً ائتمانياً. إلزامي: اذكر في متن الرسالة نصاً وبالأرقام حجم الجولة والحصة المعروضة والتقييم قبل الجولة كما وردت في بيانات العميل أعلاه — رسالة استثمارية بلا هذي الثلاثة ناقصة ولا تصلح للإرسال. ولا تصف الطلب بأنه «مشاركة في منتجات الجهة»، بل دعوة للمشاركة في جولة الشركة.'
  : 'إطار إلزامي — مسار تمويل: العميل يطلب تسهيلاً ائتمانياً. إلزامي: اذكر في متن الرسالة ثلاثة أشياء صراحةً: المبلغ المطلوب بالرقم، والغرض منه محدّداً، ومصدر السداد مشتقّاً من نشاط العميل وتدفقه النقدي. رسالة تمويلية بلا مبلغ وغرض ناقصة ولا تصلح للإرسال؛ وإن لم يرد المبلغ فاشتقّ نطاقاً معقولاً من إيراده السنوي. اكتب بلغة التمويل: المبلغ والغرض وانتظام التدفق والقدرة على السداد. ممنوع عرض أي حصة أو ملكية أو تقييم.'}

═══ معلومات عميلنا ═══
اسم الشركة: ${client.companyName}
${client.sector ? 'القطاع: ' + client.sector : ''}
${client.city ? 'المدينة: ' + client.city : ''}
${client.fundAmount && client.fundAmount > 0 ? 'المبلغ المطلوب: ' + client.fundAmount.toLocaleString('en-US') + ' ريال' : ''}
${client.fundPurpose ? 'الغرض من التمويل: ' + client.fundPurpose : ''}
${client.revenue && client.revenue > 0 ? 'الإيراد السنوي الفعلي: ' + client.revenue.toLocaleString('en-US') + ' ريال' : ''}
${client.profit && client.profit > 0 ? 'صافي الربح السنوي: ' + client.profit.toLocaleString('en-US') + ' ريال' : ''}
${client.roundSize && client.roundSize > 0 ? 'حجم الجولة المطلوب: ' + client.roundSize.toLocaleString('en-US') + ' ريال' : ''}
${client.equityOffered ? 'الحصة المعروضة: ' + client.equityOffered + '%' : ''}
${client.preMoney ? 'التقييم قبل الجولة: ' + client.preMoney + ' ريال' : ''}
${client.goal ? 'الهدف: ' + client.goal : ''}

═══ الجهة المستهدفة ═══
اسم الجهة: ${entity.provider}
المنتج/الخدمة: ${entity.product}
طبيعة الجهة: ${entityContext}
${entity.requirements ? 'متطلبات الجهة: ' + entity.requirements : ''}

═══ ضوابط الكتابة (مهمة) ═══
1. اللغة: ${language === 'عربي' ? 'العربية الفصحى الرسمية' : 'الإنجليزية الرسمية'}.
2. النبرة: مهنية ومقنعة كطرف ثالث خبير يزكّي العميل — لا مجرد استفسار. الطول ١٨٠–٢٥٠ كلمة، كثيفة بلا حشو.
3. عرّف بمُرضي كشركة استشارية سعودية جهّزت ملف العميل ورفعت جاهزيته.
4. اطلب بأدب توضيح إمكانية حصول العميل على المنتج المذكور والخطوات اللازمة.
5. لا تَعِد بنتيجة مضمونة ولا تُبالغ، لكن اذكر الأرقام الفعلية للعميل بثقة (الإيراد والربح) كإشارة قوة. ممنوع منعاً باتاً ذكر درجة الجاهزية أو أي تقييم داخلي لمُرضي — رقم داخلي لا يُعرض على جهة خارجية إطلاقاً.
5ب. ممنوع منعاً باتاً ذكر أي واقعة أو علاقة عن العميل غير مذكورة صراحةً في «معلومات عميلنا» أعلاه — لا حساباً بنكياً، ولا تعاملاً سابقاً مع الجهة، ولا عقداً، ولا أي ادعاء لم يُعطَ لك. استعمل فقط الحقول المعطاة، وإن نقص حقل فلا تخترعه ولا تفترضه.
5ج. ENGLISH-VERSION HARD RULES — these bind you exactly as the Arabic ones do, and you must NOT relax them when writing in English: (a) NEVER write "on behalf of", "acting for", "representing the client", "authorised by the client" or "mandated by". Murdi PREPARED and STRUCTURED the client's financing file and is writing to introduce it; the client alone decides whether to apply and to contract. (b) NEVER commit the client to anything. Do not state or imply that the client is prepared to pay a down payment, provide collateral, accept a rate, sign, or meet any condition — no percentage, no amount, no willingness, unless that exact commitment appears in the client data above. Ask the entity what it requires; never promise what the client will give. (c) State only facts present in the client data. Any figure, ratio, asset, contract, relationship or intention not given to you is forbidden, however plausible. (d) The firm name is written exactly "Murdi Financial Advisory" and the signature exactly "Partnerships Team — Murdi Financial Advisory | partners@murdi.sa".
6. لا تذكر أي ذكاء اصطناعي إطلاقاً — الرسالة من فريق حلول المرضي.
6ب. ممنوع ذكر أي جهة تنظيمية أو لائحة أو ترخيص (هيئة السوق المالية، البنك المركزي، ساما، الأنظمة المعمول بها) — الجهة أدرى بتنظيمها منك، وذكره حشو يوحي بالتشكيك. اكتب أرقام العميل وحدها.
7. اختم بدعوة للتواصل، ثم وقّع حرفياً دون أي تغيير أو إضافة بريد آخر: في الرسالة العربية «فريق الشراكات — حلول المرضي للاستشارات المالية | partners@murdi.sa»، وفي الإنجليزية "Partnerships Team — Murdi Financial Advisory | partners@murdi.sa". البريد الوحيد المسموح هو partners@murdi.sa؛ ممنوع كتابة info@ أو أي بريد سواه.
7ب. ممنوع ربط الرسالة بلحظة إرسالها: لا تكتب «اليوم» ولا «هذا الأسبوع» ولا «حالياً» ولا أي إشارة زمنية توحي بتاريخ محدد، لأن الرسالة قد تُقرأ بعد أسابيع فتبدو قديمة. صف الجولة أو الطلب بصيغة قائمة مستمرة.
8. حلّل مصلحة الجهة تحديداً وابنِ الإقناع عليها: بنك يهمّه أمان السداد وانتظام التدفق والضمان؛ شركة تمويل يهمّها حجم الفرصة وسرعة الدوران وجودة الملف الجاهز؛ مستثمر يهمّه النمو والعائد وقابلية التوسّع؛ جهة خارجية يهمّها آلية التمويل العابر والشريك المحلي. اكتب فقرة تربط قوة العميل بمصلحة هذه الجهة تحديداً.
9. عالِج تردّد الجهة استباقياً: توقّع أبرز تحفّظ قد يمنعها من الرد (قصر عمر التشغيل، غياب ضمان، حجم الطلب) وعالجه بجملة قبل أن تُسأل، مستنداً إلى أن مُرضي جهّزت الملف ورفعت الجاهزية.
10. اختم بطلب رد مكتوب محدّد (الخطوات والمستندات المطلوبة لبدء الدراسة) — لا مكالمة ولا دعوة عامة.

أرجع ردّك بصيغة JSON نقية فقط، بدون أي نص قبله أو بعده:
{
  "subject": "عنوان الإيميل المختصر",
  "body": "نص الرسالة كاملاً"
}`;

  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY as string,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL_WRITER,
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    throw new Error('تعذّر توليد الرسالة (HTTP ' + res.status + ')');
  }

  const data = await res.json();
  const text = (data.content || [])
    .filter((b: { type: string }) => b.type === 'text')
    .map((b: { text: string }) => b.text)
    .join('\n');

  const clean = text.replace(/\`\`\`json|\`\`\`/g, '').trim();
  const m = clean.match(/\{[\s\S]*\}/);
  if (!m) {
    throw new Error('تعذّر تحليل رد التوليد — لا يوجد JSON. أول 200 حرف: ' + clean.slice(0, 200));
  }
  let parsed;
  try {
    parsed = JSON.parse(m[0]);
  } catch (e) {
    throw new Error('فشل JSON.parse: ' + (e instanceof Error ? e.message : String(e)) + ' — المقتطف: ' + m[0].slice(0, 200));
  }
  return {
    subject: (() => {
      const en = language === 'إنجليزي';
      const head = isAcq
        ? (en ? 'Acquisition opportunity enquiry' : 'استفسار عن فرصة تملّك')
        : isGuar
        ? (en ? 'Guarantee coverage enquiry' : 'استفسار عن تغطية ضمان')
        : isMezz
          ? (en ? 'Growth debt enquiry' : 'استفسار تمويلي: دين مساند لجولة نمو')
          : isEquity
            ? (en ? 'Invitation to participate in an investment round' : 'دعوة للمشاركة في جولة استثمارية')
            : (en ? 'Financing facility enquiry' : 'طلب تسهيل تمويلي');
      return head + ' — ' + client.companyName + ' | ' + entity.provider;
    })(),
    body: String(parsed.body || '').trim(),
    language,
  };
}

export async function buildFullOutreach(
  client: ClientInput,
  entity: EntityInput
): Promise<GeneratedMessage> {
  const [msg, emailInfo] = await Promise.all([
    generateOutreachMessage(client, entity),
    findEntityEmail(entity),
  ]);

  return {
    subject: msg.subject,
    body: msg.body,
    language: msg.language,
    email: emailInfo.email,
    emailConfidence: emailInfo.confidence,
    emailSource: emailInfo.source,
    altContact: emailInfo.altContact,
    contactMethod: emailInfo.contactMethod,
  };
}
