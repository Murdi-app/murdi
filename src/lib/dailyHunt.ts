import { createClient } from '@supabase/supabase-js';

type Lead = { company_name: string; sector: string; signal: string; contact_phone: string; contact_email: string; contact_social: string; source: string; notes: string; lead_kind: string; hotness: string; entry_angle: string };

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string);
}

function parseLeads(text: string): Lead[] {
  const cleaned = text.replace(/```json|```/g, '').trim();
  const out: Lead[] = [];
  const norm = (o: Record<string, unknown>): Lead => ({
    company_name: String(o.company_name || o.name || '').trim(),
    sector: String(o.sector || '').trim(),
    signal: String(o.signal || '').trim(),
    contact_phone: String(o.contact_phone || o.phone || '').trim(),
    contact_email: String(o.contact_email || o.email || '').trim(),
    contact_social: String(o.contact_social || o.social || '').trim(),
    source: String(o.source || '').trim(),
    notes: String(o.notes || '').trim(),
    lead_kind: String(o.lead_kind || 'direct').trim() === 'scout' ? 'scout' : 'direct',
    hotness: String(o.hotness || '').trim(),
    entry_angle: String(o.entry_angle || '').trim(),
  });
  try {
    const start = cleaned.indexOf('{'); const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end > start) {
      const p = JSON.parse(cleaned.slice(start, end + 1));
      if (Array.isArray(p.leads)) return p.leads.map(norm).filter((l: Lead) => l.company_name);
    }
  } catch { /* تابع */ }
  const objs = cleaned.match(/\{[^{}]*"(?:company_name|name)"[^{}]*\}/g) || [];
  for (const o of objs) { try { out.push(norm(JSON.parse(o))); } catch { /* تجاهل */ } }
  return out.filter((l) => l.company_name);
}

async function huntAxis(label: string, category: string, instruction: string, count: number): Promise<{ category: string; leads: Lead[] }> {
  const prompt = 'أنت صائد فرص أعمال خبير ومحترف يعمل لـ د. عبدالحكيم المرضي (حلول المرضي للاستشارات المالية، السعودية). '
    + 'مهمتك: البحث العميق الذكي والشجاع في كل المصادر المفتوحة عن منشآت سعودية حقيقية (داخل المملكة حصراً) تمثّل فرص عمل لـ' + label + '.\n\n'
    + instruction + '\n\n'
    + '=== دستور الصياد المحترف (التزم به حرفياً) ===\n'
    + '1) شركات فقط لا أفراد: اصطد منشآت/شركات حقيقية، تجاهل الأفراد والطلاب والباحثين عن وظائف.\n'
    + '2) سعودية صغيرة ومتوسطة: داخل المملكة حصراً، تقديرياً 1 إلى 300 مليون ريال. ممنوع منعاً باتاً: المدرجة في تداول، الكبرى المعروفة، اليونيكورن، المدعومة من صندوق الاستثمارات العامة، والأجنبية.\n'
    + '3) صرامة كاملة على من فات أوانه: أي منشأة ذُكر أنها أغلقت/جمعت جولة تمويل أو حصلت على استثمار مؤخراً = استبعاد فوري (فات الأوان، لم تعد تحتاجنا). نريد من الحاجة لديه قائمة الآن.\n'
    + '4) الحداثة صارمة: الإشارة خلال آخر 90 يوماً (يفضّل 30). اذكر تاريخ الإشارة. تجاهل القديم.\n'
    + '5) ابحث بالعربية والإنجليزية في كل المصادر: تويتر/X (مرتع السعوديين الأهم)، إنستقرام، تيك توك، سناب، لينكدإن، يوتيوب، خرائط جوجل، مواقع الشركات، البوابات الحكومية (منشآت، اعتماد/المنافسات، مسك، بادر، الغرف التجارية)، الأخبار المحلية. ابحث بكلمات سعودية حقيقية مثل: أبي تمويل، محتاج تمويل، أبحث عن مستثمر، رأس مال، تمويل مشروعي، دعم مالي، شريك ممول.\n\n'
    + '=== مبدأ الصياد + الكشّاف (مهم جداً) ===\n'
    + 'بعض المراتع الثمينة (تعليقات إنستقرام/تيك توك/سناب) محمية ولا يمكنك دخولها آلياً. لا تتجاهلها أبداً! بل:\n'
    + '- ما تقدر تصطاده بنفسك (منشأة محددة ببياناتها من مصدر مفهرس) → اجعل lead_kind = "direct" واملأ بياناتها.\n'
    + '- ما لا تقدر تدخله (إعلان عليه تعليقات واعدة لكنك لا تصل لمحتواها) → لا تهمله! اجعل lead_kind = "scout"، وفي company_name اكتب وصف المرتع (مثلاً: "إعلان تمويل على حساب شركة كذا")، وفي signal اشرح لماذا هو مرتع واعد، وفي contact_social ضع رابط الإعلان/الحساب/المنصة بدقة، وفي entry_angle اكتب: "ادخلوا تعليقات هذا الإعلان يدوياً — فيه منشآت تطلب تمويلاً". الفريق سيدخله يدوياً ويصطاد.\n\n'
    + 'لكل فرصة (مباشرة كانت أو مرتعاً):\n'
    + '- hotness: قيّم حرارتها بكلمة واحدة: "ساخنة" (حاجة عاجلة واضحة) أو "دافئة" (حاجة محتملة) أو "باردة" (إشارة ضعيفة).\n'
    + '- entry_angle: اكتب زاوية دخول عملية جاهزة — كيف يفتح د. عبدالحكيم الحديث معهم (جملة مقترحة تربط إشارتهم بخدمة حلول المرضي).\n\n'
    + 'بيانات التواصل: ابذل جهدك لإيجاد وسيلة حقيقية (هاتف، إيميل، حساب/موقع). الصغار تجدهم على إنستقرام وخرائط جوجل وتويتر. لا تخترع أبداً — إن لم تجد اترك فارغاً.\n\n'
    + 'استهدف ' + count + ' فرصة مناسبة إن وُجدت — الدقة والحداثة أهم من العدد، لكن ابحث بعمق وشجاعة ولا تبخل بالثمين. لا تكرّر.\n\n'
    + 'في signal: الإشارة + تاريخها + سبب الحاجة الآن. في notes: ملاحظة + الحجم التقديري. في sector: القطاع.\n\n'
    + 'أرجع JSON فقط بلا أي نص آخر وبلا markdown:\n'
    + '{"leads":[{"company_name":"اسم المنشأة أو وصف المرتع","sector":"القطاع","signal":"الإشارة + التاريخ + سبب الحاجة","contact_phone":"","contact_email":"","contact_social":"رابط الحساب/الإعلان إن وُجد","source":"رابط المصدر","notes":"ملاحظة + الحجم","lead_kind":"direct أو scout","hotness":"ساخنة أو دافئة أو باردة","entry_angle":"زاوية الدخول المقترحة"}]}\n'
    + 'أرجع JSON صالحاً ومكتملاً ومغلقاً بالكامل.';
  try {
    const messages: { role: string; content: unknown }[] = [{ role: 'user', content: prompt }];
    let text = '';
    for (let turn = 0; turn < 8; turn++) {
      let res: Response | null = null;
      for (let attempt = 0; attempt < 4; attempt++) {
        res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY as string, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 8000, messages, tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 14 }] }),
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
    return { category, leads: parseLeads(text) };
  } catch { return { category, leads: [] }; }
}

export async function runDailyHunt(): Promise<{ total: number; byCategory: Record<string, number> }> {
  const axes = [
    { label: 'المراتع — صيد عملاء التمويل من إعلانات شركات التمويل', category: 'reserve_funding', count: 50, instruction: 'ادخل إعلانات شركات ومنصات التمويل السعودية (تمويل المنشآت، تمويل تجاري، تمويل رأس المال العامل) على تويتر/X وإنستقرام وتيك توك ولينكدإن وجوجل ومواقعها. ابحث في التفاعلات والتعليقات والردود العامة عن منشآت سعودية صغيرة ومتوسطة كشفت حاجتها للتمويل (سألت عن الشروط، طلبت تمويلاً، اشتكت من رفض بنك، استفسرت عن منتج تمويلي). هذا مرتع خصب لأن من يعلّق هناك يكشف حاجته بنفسه. ما تصل إليه من تعليقات محمية، سجّله كمرتع (scout) مع رابط الإعلان للفريق.' },
    { label: 'المراتع — صيد عملاء الاستثمار من إعلانات جهات الاستثمار', category: 'reserve_investment', count: 50, instruction: 'ادخل إعلانات شركات وصناديق الاستثمار والحاضنات والمسرّعات السعودية على تويتر/X وإنستقرام ولينكدإن وجوجل ومواقعها. ابحث في التفاعلات والتعليقات العامة عن منشآت سعودية صغيرة ومتوسطة كشفت رغبتها في جذب مستثمر أو شريك (سألت كيف تتقدم، استفسرت عن شروط الاستثمار، عرضت فكرتها). هذا مرتع خصب لأن المعلّق يكشف رغبته بنفسه. ما تصل إليه من تعليقات محمية، سجّله كمرتع (scout) مع رابط الإعلان للفريق.' },
    { label: 'الإشارات الصامتة — تمويل', category: 'silent_funding', count: 9, instruction: 'اصطد القائم النامي الصامت: منشأة سعودية صغيرة-متوسطة قائمة وتعمل، تُظهر علامات نمو مادية حديثة (تفتح فرعاً جديداً، توظّف بكثافة، فازت بعقد أكبر من حجمها، تطلق منتجاً، تنتقل لمقر أكبر) لكن لم يُذكر إطلاقاً أنها بحثت عن تمويل أو جمعته. نموها يفوق قدرتها الذاتية = حاجة تمويل قادمة صامتة. نصطادها قبل أن تبحث.' },
    { label: 'الإشارات الصامتة — استثمار', category: 'silent_investment', count: 8, instruction: 'اصطد القائم النامي الصامت: منشأة سعودية صغيرة-متوسطة بقصة قيمة ونمو واضح، مرشحة لجذب مستثمر، لكن لم يُذكر أنها جمعت جولة أو تبحث عن مستثمر. لديها ما يغري المستثمر لكنها لا تدري أنها جاهزة. نصطادها قبل أن تبحث.' },
    { label: 'الإشارات الصامتة — طرح', category: 'silent_ipo', count: 8, instruction: 'اصطد الكيان المتوسط الصامت المرشح للطرح: منشأة سعودية متوسطة تحوّلت حديثاً لشركة مساهمة مقفلة، أو تبني حوكمة، أو تنمو نحو حجم الإدراج، لكن لم تعلن نية طرح صريحة. مرشحة لخدمة جاهزية الطرح قبل أن تبدأ.' },
  ];

  const results = await Promise.all(axes.map((a) => huntAxis(a.label, a.category, a.instruction, a.count)));

  const adminClient = admin();
  const today = new Date().toISOString().slice(0, 10);
  await adminClient.from('daily_leads').delete().eq('hunt_date', today);

  const byCategory: Record<string, number> = {};
  let total = 0;
  for (const r of results) {
    if (r.leads.length === 0) { byCategory[r.category] = 0; continue; }
    const rows = r.leads.map((l) => ({
      hunt_date: today, category: r.category, company_name: l.company_name, sector: l.sector,
      signal: l.signal, contact_phone: l.contact_phone || null, contact_email: l.contact_email || null,
      contact_social: l.contact_social || null, source: l.source || null, notes: l.notes || null,
      lead_kind: l.lead_kind, hotness: l.hotness || null, entry_angle: l.entry_angle || null,
    }));
    await adminClient.from('daily_leads').insert(rows);
    byCategory[r.category] = rows.length;
    total += rows.length;
  }
  return { total, byCategory };
}
