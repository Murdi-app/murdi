import { NextResponse } from 'next/server';
import { requireStaff } from '@/lib/requireStaff';

// من الجالس أمام الشاشة؟ يُسأل مرة واحدة ليُبنى عليه شريط التبويبات.
// الاعتماد عليه في الإخفاء تجميلي فقط — الحماية الحقيقية في كل مسار على حدة.

export async function GET() {
  const { who, error } = await requireStaff();
  if (error || !who) return NextResponse.json({ role: 'none' }, { status: 401 });
  return NextResponse.json({ role: who.role, can_send: who.canSend });
}
