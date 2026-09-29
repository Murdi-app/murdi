import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cronAuthorized } from '@/lib/cronAuth';
import { enqueueReady, sendDue, closeNoReply, autoConsult, notifyReplies } from '@/lib/awardsPipeline';
import { logError } from '@/lib/logError';

// قناة الفائزين تعمل وحدها — يوقظها `pg_cron` (المهمة `awards-pipeline`) كل ربع ساعة:
// تصفّ الجاهز · ترسل المستحق (النافذة والسقف والإيقاف في الإعدادات) · تغلق من لا يرد ·
// تولّد الاستشارة لمن ردّ وتأهّل. كل خطوةٍ مستقلة: فشلُ واحدة لا يوقف الباقي.
export const maxDuration = 300;

export async function POST(req: Request) {
  if (!(await cronAuthorized(req))) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string);
  const out: Record<string, unknown> = {};
  const step = async (name: string, fn: () => Promise<unknown>) => {
    try { out[name] = await fn(); } catch (e) { out[name] = { error: e instanceof Error ? e.message : String(e) }; await logError('cron.awardsPipeline.' + name, e, {}); }
  };
  await step('enqueue', () => enqueueReady(sb));
  await step('send', () => sendDue(sb));
  await step('close', () => closeNoReply(sb));
  await step('replies', () => notifyReplies(sb));
  await step('consult', () => autoConsult(sb));
  return NextResponse.json({ ok: true, ...out });
}
