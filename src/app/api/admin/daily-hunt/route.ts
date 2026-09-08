import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { runDailyHunt } from '@/lib/dailyHunt';
import { requireStaff } from '@/lib/requireStaff';

export const maxDuration = 300;



// GET ?date=YYYY-MM-DD : جلب جولة يوم (افتراضياً اليوم)
export async function GET(req: Request) {
  // الصيد عملُ المساعدة لا عمل المالك — فتُقرأ الجولة بحساب الموظفة أيضاً.
  // وكان المسار محصوراً بالمالك، فكانت هي تصيد بلا أن ترى ما صِيد.
  const { who } = await requireStaff();
  if (!who) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  );
  const url = new URL(req.url);
  const savedOnly = url.searchParams.get('saved') === 'true';
  const date = url.searchParams.get('date') || new Date().toISOString().slice(0, 10);
  if (savedOnly) {
    const { data } = await admin
      .from('daily_leads')
      .select('*')
      .eq('saved', true)
      .order('created_at', { ascending: false });
    return NextResponse.json({ leads: data || [], date: 'saved' });
  }
  const { data } = await admin
    .from('daily_leads')
    .select('*')
    .eq('hunt_date', date)
    .order('category', { ascending: true });
  return NextResponse.json({ leads: data || [], date });
}

// POST : تشغيل جولة صيد جديدة لليوم
export async function POST() {
  const { who } = await requireStaff();
  if (!who) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  );

  // ★ جولة واحدة في اليوم لا أكثر: الجولة تنادي نموذجاً ببحثٍ في الشبكة
  //   على ثلاثة محاور، فتكلّف. وزرٌّ مفتوح أمام موظفة يُضغط مرتين بالخطأ.
  //   ومن أراد إعادتها اليوم فالمالك وحده يملك ذلك.
  const today = new Date().toISOString().slice(0, 10);
  const { count } = await admin.from('daily_leads')
    .select('id', { count: 'exact', head: true }).eq('hunt_date', today);
  if ((count || 0) > 0 && who.role !== 'admin') {
    return NextResponse.json(
      { error: 'صيد اليوم شُغّل مسبقاً — القائمة تحتك جاهزة. وجولة الغد تبدأ بعد منتصف الليل.' },
      { status: 409 }
    );
  }

  try {
    const result = await runDailyHunt();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'فشل الصيد' }, { status: 500 });
  }
}
