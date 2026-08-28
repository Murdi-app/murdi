import { NextResponse } from 'next/server';

// ⛔ مسار معطَّل عمداً.
//
// كان مفتوحاً بلا مصادقة، ويستدعي نموذجاً بألف وخمسمئة رمز في كل نداء،
// ثم يرسل إلى بريد الأدمن رسالةً مبنيةً من مدخلات الطلب ومن مخرَج النموذج،
// بلا هروب — فالمهاجم يتحكم بما يصل صندوقك بصفة «التفاصيل السرّية».
// ولا يستدعيه أي ملف في المنصة.
export async function POST() {
  return NextResponse.json({ error: 'هذا المسار معطَّل' }, { status: 410 });
}
export async function GET() {
  return NextResponse.json({ error: 'هذا المسار معطَّل' }, { status: 410 });
}
