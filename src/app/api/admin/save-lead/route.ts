import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireStaff } from '@/lib/requireStaff';

// ★ الصيد عملُ المساعدة، وزرّا «احفظ» و«احذف» على بطاقات صيدها هي.
//   وكان المسار محصوراً بالمالك (`requireAdmin` ثم إعادة مقارنة البريد)،
//   فتضغط الموظفة الزرّ فيُردّ 403 وتُعيد الشاشةُ الحالةَ بصمت — زرٌّ
//   يُضغط ولا يحدث شيء ولا رسالة. وهذه قائمتها هي، تُنقّيها بنفسها.
//   والحذف هنا لا يمسّ إلا صفَّ فرصةٍ في جولة يومها، لا بيانات عميل.
const admin = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

// POST { id, saved } : حفظ أو إلغاء حفظ فرصة
export async function POST(req: Request) {
  const { who } = await requireStaff();
  if (!who) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const id: string = body?.id || '';
  const saved: boolean = body?.saved === true;
  if (!id) return NextResponse.json({ error: 'id مطلوب' }, { status: 400 });
  const { error } = await admin().from('daily_leads').update({ saved }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id, saved });
}

// DELETE ?id=... : حذف فرصة نهائياً
export async function DELETE(req: Request) {
  const { who } = await requireStaff();
  if (!who) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id مطلوب' }, { status: 400 });
  const { error } = await admin().from('daily_leads').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id });
}
