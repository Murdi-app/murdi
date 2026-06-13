import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

const MODELS = ['claude-fable-5', 'claude-sonnet-4-5-20250929'];

async function searchEligibility(rev: number, profit: number, years: number, market: string): Promise<string> {
  const prompt = 'انت مستشار جاهزية طرح يعمل وفق منهجية د. عبدالحكيم المرضي. ابحث في الويب في المصادر الرسمية السعودية فقط (هيئة السوق المالية cma.org.sa وتداول/السوق الموازي nomu) عن اخر متطلبات وشروط الادراج المعلنة. '
    + 'بيانات الشركة: ايرادات سنوية ' + rev + ' ريال، صافي ربح ' + profit + ' ريال، سنوات تشغيل ' + years + '، السوق المستهدف ' + market + '. '
    + 'اعطِ بالعربية وبشكل مختصر ومباشر: '
    + '(1) قسم (شروط السوق الموازي نمو): الحد الادنى لراس المال، سنوات النشاط، نسبة الطرح، وابرز المتطلبات — بارقامها المعلنة. '
    + '(2) قسم (شروط السوق الرئيسي): نفس النقاط. '
    + '(3) قسم (تقييم وضعك): بناءً على ارقام الشركة اعلاه، هل تنطبق عليها شروط نمو او الرئيسي؟ وما الفجوة المحددة ان وجدت. '
    + 'مهم: اعتمد فقط على ما تجده في مصادر الهيئة الرسمية واذكر المصدر. اذا لم تجد رقما محدثا قل ذلك صراحة بدل التخمين. '
    + 'قواعد: لا تذكر اي ذكاء اصطناعي او تقنية. واختم بسطر: (هذه المتطلبات وفق ما هو معلن وتتغير بقرارات الهيئة — الاعتماد الرسمي يتم عبر مستشار مالي مرخّص من هيئة السوق المالية).';

  let diag = '';
  for (const model of MODELS) {
    try {
      const messages: { role: string; content: unknown }[] = [{ role: 'user', content: prompt }];
      let textOut = '';
      for (let turn = 0; turn < 5; turn++) {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.ANTHROPIC_API_KEY as string,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model,
            max_tokens: 3500,
            messages,
            tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }],
          }),
        });
        if (!res.ok) { diag = model + ' HTTP ' + res.status; break; }
        const data = await res.json();
        const content = (data.content || []) as { type: string; text?: string }[];
        textOut += content.filter((b) => b.type === 'text').map((b) => b.text || '').join(' ');
        if (data.stop_reason === 'pause_turn') { messages.push({ role: 'assistant', content: data.content }); continue; }
        break;
      }
      textOut = textOut.trim();
      if (textOut.length > 80) return textOut;
      if (diag === '') diag = model + ': رد فارغ';
    } catch (e) { diag = model + ' خطأ: ' + (e instanceof Error ? e.message : String(e)); continue; }
  }
  return diag !== '' ? ('تعذّر جلب المتطلبات حالياً (' + diag + '). يمكنك المحاولة لاحقاً أو التواصل مع فريق مُرضي.') : '';
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

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  );
  const { data: company } = await supabase.from('companies').select('id').eq('user_id', user.id).single();
  if (company === null) return NextResponse.json({ eligibility: '' });

  const { data: fd } = await admin
    .from('financial_data').select('*').eq('company_id', company.id)
    .eq('assessment_type', 'ipo').order('created_at', { ascending: false }).limit(1).single();

  const rev = Number(fd?.annual_revenue) || 0;
  const profit = Number(fd?.net_profit) || 0;
  const years = Number(fd?.years_operating) || 0;
  const market = (fd?.target_market as string) || 'nomu';

  const eligibility = await searchEligibility(rev, profit, years, market);
  return NextResponse.json({ eligibility });
}
