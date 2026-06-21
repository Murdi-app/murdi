import { createClient } from '@supabase/supabase-js';

type Lead = { company_name: string; sector: string; signal: string; contact_phone: string; contact_email: string; contact_social: string; source: string; notes: string };

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string);
}

// parser متين — لا ينكسر مهما كان رد claude
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
  // محاولة 1: JSON كامل
  try {
    const start = cleaned.indexOf('{'); const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end > start) {
      const p = JSON.parse(cleaned.slice(start, end + 1));
      if (Array.isArray(p.leads)) return p.leads.map(norm).filter((l: Lead) => l.company_name);
    }
  } catch { /* تابع */ }
  // محاولة 2: regex لكل كائن فيه company_name أو name
  const objs = cleaned.match(/\{[^{}]*"(?:company_name|name)"[^{}]*\}/g) || [];
  for (const o of objs) {
    try { out.push(norm(JSON.parse(o))); } catch { /* تجاهل */ }
  }
  return out.filter((l) => l.company_name);
}

async function huntAxis(label: string, category: string, instruction: string, count: number): Promise<{ category: string; leads: Lead[] }> {
  const prompt = 'أنت محلل أعمال خبير رفيع المستوى يعمل لـ د. عبدالحكيم المرضي (حلول المرضي للاستشارات المالية، السعودية). '
    + 'مهمتك: البحث العميق والذكي في الويب عن شركات سعودية حقيقية (داخل المملكة حصراً) تمثّل فرص عمل لـ' + label + '.\n\n'
    + instruction + '\n\n'
    + 'معايير صارمة للدقة:\n'
    + '1) شركات سعودية حقيقية موجودة فعلاً (لا أسماء متخيّلة). تحقّق من وجودها.\n'
    + '2) الإشارة حقيقية ومذكورة في مصدر (خبر، إعلان، مناقصة، موقع الشركة) — اذكر المصدر.\n'
    + '3) بيانات التواصل: ابذل جهدك لإيجاد وسيلة تواصل حقيقية واحدة على الأقل (هاتف رسمي، أو إيميل، أو حساب تواصل اجتماعي/لينكدإن). لا تخترع أرقاماً أو إيميلات أبداً — إن لم تجد، اترك الحقل فارغاً.\n'
    + '4) لا تكرّر شركة، ولا تُدرج شركة لا تطابق الإشارة لمجرد ملء العدد.\n\n'
    + 'استهدف ' + count + ' شركة مناسبة إن وُجدت — الدقة أهم من العدد، لكن ابحث بعمق ولا تبخل بالصالح.\n\n'
    + 'في حقل signal: الإشارة المحددة التي تجعلها فرصة (مثلاً: «أعلنت افتتاح 5 فروع جديدة 2026»). في notes: ملاحظة مفيدة للتواصل. '
    + 'في sector: قطاع الشركة.\n\n'
    + 'أرجع JSON فقط بلا أي نص آخر وبلا markdown:\n'
    + '{"leads":[{"company_name":"اسم الشركة","sector":"القطاع","signal":"الإشارة","contact_phone":"هاتف إن وُجد","contact_email":"إيميل إن وُجد","contact_social":"حساب/لينكدإن إن وُجد","source":"رابط المصدر","notes":"ملاحظة"}]}\n'
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
          body: JSON.stringify({ model: 'claude-opus-4-8', max_tokens: 8000, messages, tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 12 }] }),
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
    { label: 'التمويل (توسّع وفروع جديدة)', category: 'funding_expansion', count: 25, instruction: 'ركّز على شركات سعودية أعلنت مؤخراً عن خطط توسّع، افتتاح فروع جديدة، دخول أسواق، أو زيادة طاقة إنتاجية — فهذه تحتاج تمويلاً.' },
    { label: 'التمويل (مناقصات وعقود)', category: 'funding_contracts', count: 25, instruction: 'ركّز على شركات سعودية فازت أو تتنافس على مناقصات أو عقود حكومية/كبرى مؤخراً — فهذه تحتاج رأس مال عامل وتمويل مستخلصات.' },
    { label: 'الاستثمار (نمو وجولات سابقة)', category: 'investment_growth', count: 25, instruction: 'ركّز على شركات سعودية ناشئة أو نامية أعلنت نموّاً قوياً أو حصلت على جولة استثمارية سابقة أو تبحث عن توسّع — مرشّحة لجذب مستثمر.' },
    { label: 'الاستثمار (قطاعات جاذبة)', category: 'investment_sectors', count: 25, instruction: 'ركّز على شركات سعودية واعدة في قطاعات جاذبة للاستثمار (تقنية، صحة، لوجستيات، أغذية، طاقة متجددة) ذات قصة نمو واضحة — مرشّحة لجولة استثمار.' },
    { label: 'الطرح العام (Pre-IPO)', category: 'ipo', count: 15, instruction: 'ركّز على شركات سعودية كبيرة أو متوسطة يُحتمل أنها تستعد للطرح أو في قطاع ينضج نحو الإدراج (تداول / السوق الموازي نمو).' },
    { label: 'خدمة الإنقاذ (تعثّر وإعادة هيكلة)', category: 'distress', count: 10, instruction: 'ركّز على شركات سعودية تواجه تعثّراً مالياً أو تمر بإعادة هيكلة أو صعوبات سداد ظهرت في الأخبار — فرصة لخدمة إعادة هيكلة.' },
  ];

  const results = await Promise.all(axes.map((a) => huntAxis(a.label, a.category, a.instruction, a.count)));

  const adminClient = admin();
  const today = new Date().toISOString().slice(0, 10);
  // امسح جولة اليوم القديمة لتفادي التكرار عند إعادة التشغيل
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
