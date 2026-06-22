import { createClient } from '@supabase/supabase-js';

type Lead = { company_name: string; sector: string; signal: string; contact_phone: string; contact_email: string; contact_social: string; source: string; notes: string };

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
  const prompt = 'أنت صائد فرص أعمال خبير رفيع المستوى يعمل لـ د. عبدالحكيم المرضي (حلول المرضي للاستشارات المالية، السعودية). '
    + 'مهمتك: البحث العميق الذكي في كل المصادر المفتوحة عن منشآت سعودية حقيقية (داخل المملكة حصراً) تمثّل فرص عمل لـ' + label + '.\n\n'
    + instruction + '\n\n'
    + '=== دستور الصياد الذكي (التزم به حرفياً) ===\n'
    + '1) الحاجة قبل الإنجاز: اصطد من يحتاج الخدمة الآن، لا من أنجزها وانتهى. تجاهل من أغلق جولة تمويل ضخمة أو وظّف بنوكاً عالمية أو فاز بعقد بمليارات — هؤلاء انتهت حاجتهم.\n'
    + '2) استبعاد الكبار: ممنوع منعاً باتاً إدراج أي شركة مدرجة في تداول، أو شركة كبرى معروفة إعلامياً، أو يونيكورن، أو مدعومة من صندوق الاستثمارات العامة. ركّز على المنشآت الصغيرة والمتوسطة (تقديرياً 1 إلى 300 مليون ريال إيراد) — هؤلاء عملاء حلول المرضي الحقيقيون الذين يحتاجون من يمسك بأيديهم.\n'
    + '3) كل القطاعات مفتوحة بلا استثناء: لا تحصر بحثك في نشاط معيّن. اصطد من أي قطاع (تجارة، صناعة، تقنية، خدمات، مقاولات، زراعة، لوجستيات، صحة، تعليم، سياحة، ترفيه، عقار، وغيرها) — المعيار هو الحاجة والحجم لا نوع النشاط.\n'
    + '4) إثبات الحاجة إلزامي: كل فرصة يجب أن تجيب صراحةً في حقل signal: لماذا يحتاج هذا الكيان الخدمة الآن؟\n'
    + '5) الحداثة صارمة: الإشارة يجب أن تكون حديثة خلال آخر 90 يوماً (يفضّل آخر 30 يوماً). اذكر تاريخ الإشارة في signal. تجاهل أي خبر قديم.\n'
    + '6) ابحث في كل المصادر: مواقع الشركات الرسمية، حسابات التواصل (إنستقرام، تويتر/X، لينكدإن، تيك توك، سناب)، خرائط جوجل، البوابات الحكومية للمنشآت (منشآت، اعتماد/المنافسات، مسك، بادر، الغرف التجارية)، الأخبار المحلية الحديثة.\n\n'
    + 'بيانات التواصل: ابذل جهدك لإيجاد وسيلة تواصل حقيقية واحدة على الأقل (هاتف، إيميل، أو حساب تواصل/موقع). الصغار غالباً تجدهم على إنستقرام أو خرائط جوجل. لا تخترع بيانات أبداً — إن لم تجد، اترك الحقل فارغاً.\n\n'
    + 'استهدف ' + count + ' منشأة مناسبة إن وُجدت — الدقة والحداثة أهم من العدد، لكن ابحث بعمق ولا تبخل بالصالح. لا تكرّر منشأة.\n\n'
    + 'في signal: الإشارة + تاريخها + سبب الحاجة الآن. في notes: ملاحظة مفيدة للتواصل أو حجم الشركة التقديري. في sector: القطاع.\n\n'
    + 'أرجع JSON فقط بلا أي نص آخر وبلا markdown:\n'
    + '{"leads":[{"company_name":"اسم المنشأة","sector":"القطاع","signal":"الإشارة + التاريخ + سبب الحاجة","contact_phone":"هاتف إن وُجد","contact_email":"إيميل إن وُجد","contact_social":"حساب/موقع إن وُجد","source":"رابط المصدر","notes":"ملاحظة + الحجم التقديري"}]}\n'
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
          body: JSON.stringify({ model: 'claude-opus-4-8', max_tokens: 8000, messages, tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 14 }] }),
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
    { label: 'تمويل — منشأة صغيرة صاعدة طموحة', category: 'small_funding', count: 25, instruction: 'ركّز على منشآت سعودية صغيرة نشطة وتنمو وتطمح لتمويل لتوسيع نشاطها — من أي قطاع كان. ابحث في إنستقرام وتيك توك وخرائط جوجل ومواقعها عن علامات صغيرة تتوسّع (تفتح فرعاً جديداً، تطلب موظفين، تعلن نمواً أو مشروعاً). هؤلاء لا يظهرون في الأخبار الكبرى.' },
    { label: 'استثمار — منشأة صغيرة صاعدة تطمح لشريك', category: 'small_investment', count: 25, instruction: 'ركّز على منشآت سعودية صغيرة ذات فكرة أو منتج واعد ونمو مبكّر، تطمح لمستثمر أو شريك استراتيجي — من أي قطاع. ابحث في الحاضنات والمسرّعات، منصات التواصل، معارض ريادة الأعمال، العلامات الناشئة النشطة. الطموح والنمو المبكّر هو الإشارة.' },
    { label: 'تمويل — متوسطة بحاجة عاجلة', category: 'funding_need', count: 20, instruction: 'ركّز على منشآت متوسطة (غير مدرجة) فازت بعقد أو مشروع أكبر من حجمها المعتاد، أو تتوسّع أسرع من قدرتها التمويلية الذاتية — فتحتاج رأس مال عامل عاجلاً. ابحث في المنافسات الحكومية (اعتماد) عن فائزين من الشركات الصغيرة والمتوسطة في أي قطاع.' },
    { label: 'استثمار — متوسطة صاعدة بلا فريق علاقات', category: 'investment_ready', count: 20, instruction: 'ركّز على منشآت متوسطة (غير مدرجة) ذات نمو واضح وقصة قيمة، جاهزة لجولة استثمار لكن تفتقر لفريق علاقات مستثمرين — من أي قطاع. تجاهل من أغلق جولة فعلاً.' },
    { label: 'طرح — كيان متوسط يطمح للإدراج', category: 'ipo_aspirant', count: 20, instruction: 'ركّز على منشآت متوسطة تُظهر طموح طرح مبكّر: تحوّلت حديثاً إلى شركة مساهمة مقفلة، أو أعلنت نية إدراج مستقبلي في السوق الموازي (نمو)، أو تبني حوكمة استعداداً — من أي قطاع. تجاهل المدرجة فعلاً والكبرى.' },
    { label: 'إنقاذ — متوسطة متعثّرة تبحث عن حل', category: 'distress_small', count: 15, instruction: 'ركّز على منشآت صغيرة ومتوسطة (غير مدرجة) تواجه تعثّراً أو ضغط سيولة أو صعوبة سداد وتبحث فعلاً عن حل أو شريك أو إعادة هيكلة — من أي قطاع. تجاهل الشركات المدرجة الكبرى.' },
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
    }));
    await adminClient.from('daily_leads').insert(rows);
    byCategory[r.category] = rows.length;
    total += rows.length;
  }
  return { total, byCategory };
}
