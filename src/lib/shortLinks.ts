import type { SupabaseClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';

// ★ ١ أكتوبر — لا يرى العميل رابطاً طويلاً ولا رابط supabase. روابط قصيرة على
//   نطاقنا: murdi.sa/c/… للعقد أو السند · /p/… للدفع · /s/… لتعيين كلمة المرور.
//   ولكلٍّ صلاحية محدودة وتُلغى. ورابط كلمة المرور لا يحمل رمزاً: يُولَّد في
//   الخادم لحظة الضغط (`/s/[code]`)، فلا يجلس رمزٌ حيّ في محادثة واتساب.

export type ShortKind = 'c' | 'p' | 's';
export const SHORT_TTL_DAYS: Record<ShortKind, number> = { c: 30, p: 14, s: 7 };
export const SITE = 'https://murdi.sa';

const ALPHA = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
function code(n = 7): string {
  const b = randomBytes(n);
  let out = '';
  for (let i = 0; i < n; i++) out += ALPHA[b[i] % ALPHA.length];
  return out;
}

export type ShortRow = {
  code: string; kind: ShortKind; service_request_id: string | null; contract_id: string | null;
  company_id: string | null; email: string | null; expires_at: string; revoked_at: string | null;
};

/**
 * رابطٌ قصير صالح لهدفه. يُعاد الحيّ إن وُجد لنفس الهدف (فلا تتكاثر الروابط
 * بكل ضغطة)، وإلا يُنشأ جديد.
 */
export async function shortLink(sb: SupabaseClient, kind: ShortKind, target: {
  srId?: string | null; contractId?: string | null; companyId?: string | null; email?: string | null; by?: string;
}): Promise<string> {
  const now = new Date().toISOString();
  let q = sb.from('short_links').select('code').eq('kind', kind).is('revoked_at', null).gt('expires_at', now);
  q = target.contractId ? q.eq('contract_id', target.contractId) : target.srId ? q.eq('service_request_id', target.srId) : q.eq('email', String(target.email || ''));
  const { data: live } = await q.order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (live?.code) return SITE + '/' + kind + '/' + live.code;
  for (let i = 0; i < 4; i++) {
    const c = code();
    const { error } = await sb.from('short_links').insert({
      code: c, kind, service_request_id: target.srId || null, contract_id: target.contractId || null,
      company_id: target.companyId || null, email: target.email || null,
      expires_at: new Date(Date.now() + SHORT_TTL_DAYS[kind] * 86400_000).toISOString(), created_by: target.by || null,
    });
    if (!error) return SITE + '/' + kind + '/' + c;
    if (!/duplicate|unique/i.test(error.message)) throw new Error('تعذّر إنشاء الرابط القصير — ' + error.message);
  }
  throw new Error('تعذّر إنشاء الرابط القصير');
}

/** يقرأ الرابط ويعدّ فتحه — null إن لم يوجد أو انتهى أو أُلغي */
export async function resolveShort(sb: SupabaseClient, kind: ShortKind, c: string): Promise<ShortRow | null> {
  if (!/^[A-Za-z0-9]{5,12}$/.test(c)) return null;
  const { data } = await sb.from('short_links').select('code, kind, service_request_id, contract_id, company_id, email, expires_at, revoked_at')
    .eq('code', c).eq('kind', kind).maybeSingle();
  if (!data || data.revoked_at || Date.parse(String(data.expires_at)) < Date.now()) return null;
  const { data: cur } = await sb.from('short_links').select('opened_count').eq('code', c).maybeSingle();
  await sb.from('short_links').update({ opened_count: Number(cur?.opened_count || 0) + 1, last_opened_at: new Date().toISOString() }).eq('code', c);
  return data as ShortRow;
}

/** يلغي روابط هدفٍ من نوعٍ بعينه */
export async function revokeShort(sb: SupabaseClient, kind: ShortKind, srId: string): Promise<void> {
  await sb.from('short_links').update({ revoked_at: new Date().toISOString() }).eq('kind', kind).eq('service_request_id', srId).is('revoked_at', null);
}
