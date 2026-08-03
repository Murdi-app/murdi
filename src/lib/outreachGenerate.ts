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
2. إن لم تجد بريدا مؤكّداً، اقترح بريداً محتملاً منطقياً (info@ أو contact@ نطاق الجهة) وصنّفه "غير مؤكّد".
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
  const trackWord = entity.track === 'funding' ? 'تمويل' : 'استثمار';
  const entityContext = isIntl
    ? 'جهة خارجية تمول السوق السعودي — ابنِ الإقناع على آلية التمويل العابر للحدود، ووجود شريك أو فرع محلي، وتوافق قطاع العميل مع اهتمام الجهة بالسوق السعودي. اكتب بلغة وأسلوب دوليّين احترافيّين يناسبان مؤسسة أجنبية.'
    : 'جهة سعودية محلية — ابنِ الإقناع على الإطار التنظيمي السعودي والقرب والثقة المحلية. اكتب بأسلوب سعودي رسمي مألوف لمؤسسة محلية.'

  const prompt = `أنت كاتب مراسلات رسمية محترف في شركة "حلول المرضي للاستشارات المالية" (منصة مُرضي).
مهمتك: كتابة رسالة بريد إلكتروني رسمية ومهنية موجّهة إلى جهة ${trackWord}، للاستفسار عن إمكانية حصول عميلنا على منتجها.

${entity.track === 'investment'
  ? 'إطار إلزامي — مسار استثمار: العميل يعرض حصة من ملكيته على مستثمر، ولا يطلب قرضاً. اكتب بلغة الملكية: الجولة، الحصة المعروضة، التقييم قبل الجولة، أفق العائد، قابلية التوسع. ممنوع منعاً باتاً ذكر السداد أو الأقساط أو الضمانات أو تمويل الفواتير أو رأس المال العامل أو الجدارة الائتمانية أو أي لفظ إقراضي — المستثمر يشتري حصة ولا يُسدَّد له. حتى إن كان منتج الجهة ديناً مرناً، فاطلب أهلية المشاركة في الجولة لا تسهيلاً ائتمانياً.'
  : 'إطار إلزامي — مسار تمويل: العميل يطلب تسهيلاً ائتمانياً. اكتب بلغة التمويل: المبلغ والغرض وانتظام التدفق والقدرة على السداد. ممنوع عرض أي حصة أو ملكية أو تقييم.'}

═══ معلومات عميلنا ═══
اسم الشركة: ${client.companyName}
${client.sector ? 'القطاع: ' + client.sector : ''}
${client.city ? 'المدينة: ' + client.city : ''}
${client.revenue && client.revenue > 0 ? 'الإيراد السنوي الفعلي: ' + client.revenue.toLocaleString('en-US') + ' ريال' : ''}
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
6. لا تذكر أي ذكاء اصطناعي إطلاقاً — الرسالة من فريق حلول المرضي.
7. اختم بدعوة للتواصل، وتوقيع: "فريق الشراكات — حلول المرضي للاستشارات المالية".
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
    subject: String(parsed.subject || 'استفسار بخصوص أحد عملائنا').trim(),
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
