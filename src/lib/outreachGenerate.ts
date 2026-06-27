// ════════════════════════════════════════════════════════════════
// محرك مخاطبة الجهات — مُرضي
// يولّد رسالة احترافية مخصّصة لكل جهة، ويبحث عن إيميلها ويصنّف الثقة
// ════════════════════════════════════════════════════════════════

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-6';

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

ابحث في الموقع الرسمي. رتّب أولوياتك: بريد مؤكّد، وإلا اقترح بريداً محتملاً منطقياً (غير مؤكّد)، وابحث عن طريقة تواصل بديلة (نموذج/رقم/لينكدإن). أرجع JSON نقي فقط:
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
        max_tokens: 400,
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
      return { email: null, confidence: 'غير متوفّر', source: 'تعذّر التحليل', altContact: null, contactMethod: 'إيميل' };
    }

    const parsed = JSON.parse(m[0]);
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

  const prompt = `أنت كاتب مراسلات رسمية محترف في شركة "حلول المرضي للاستشارات المالية" (منصة مُرضي).
مهمتك: كتابة رسالة بريد إلكتروني رسمية ومهنية موجّهة إلى جهة ${trackWord}، للاستفسار عن إمكانية حصول عميلنا على منتجها.

═══ معلومات عميلنا ═══
اسم الشركة: ${client.companyName}
${client.sector ? 'القطاع: ' + client.sector : ''}
${client.city ? 'المدينة: ' + client.city : ''}
${client.goal ? 'الهدف: ' + client.goal : ''}

═══ الجهة المستهدفة ═══
اسم الجهة: ${entity.provider}
المنتج/الخدمة: ${entity.product}
${entity.requirements ? 'متطلبات الجهة: ' + entity.requirements : ''}

═══ ضوابط الكتابة (مهمة) ═══
1. اللغة: ${language === 'عربي' ? 'العربية الفصحى الرسمية' : 'الإنجليزية الرسمية'}.
2. النبرة: مهنية، محترمة، موجزة (لا تتجاوز ١٢٠ كلمة في المتن).
3. عرّف بمُرضي كشركة استشارية سعودية جهّزت ملف العميل ورفعت جاهزيته.
4. اطلب بأدب توضيح إمكانية حصول العميل على المنتج المذكور والخطوات اللازمة.
5. لا تَعِد بشيء، ولا تضمن نتيجة، ولا تذكر أرقاماً مالية محدّدة.
6. لا تذكر أي ذكاء اصطناعي إطلاقاً — الرسالة من فريق حلول المرضي.
7. اختم بدعوة للتواصل، وتوقيع: "فريق الشراكات — حلول المرضي للاستشارات المالية".
8. حافظ على السرّية: لا تكشف معلومات مالية حسّاسة للعميل في هذه الرسالة التمهيدية.

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
      model: MODEL,
      max_tokens: 800,
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
    throw new Error('تعذّر تحليل رد التوليد');
  }

  const parsed = JSON.parse(m[0]);
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
