import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { MAX_SESSION_MS } from './requireAdmin';

const ADMIN_EMAIL = 'hololalmurdi.fs@gmail.com';
// أُضيف البريد لأن إشعارات المتصفح تُخزَّن باسم صاحبها: جهاز المالك
// وجهاز الموظفة اشتراكان مختلفان، ولا يجوز أن يصل أحدهما إشعارَ الآخر.
//
// و`job` يفرّق موظفتين ليست صلاحيتهما واحدة — والقسمة **قسمةُ مرحلة**:
// ضي من الباب إلى الدفع، ورغد ما بعد الدفع وجهات التمويل. والفرق يُقرأ من
// الحقل لا من البريد، فتُضاف ثالثة غداً بلا لمس كود.
//
// ★ وكان `StaffJob` و`asJob` مكتوبَين هنا **وفي `@/lib/staffPages` معاً** —
//   نسختان لتعريفٍ واحد، وهو بعينه العطب الذي أوقع «نتيجة المكالمة» و«وجهة
//   الدخول» من قبل. فمن أضاف دوراً ثالثاً في أحدهما وجد الآخر يردّه إلى
//   `assistant` صامتاً. فصار التعريف هناك وحده، ويُستورَد هنا.
export type { StaffJob } from './staffPages';
import { isJob, mayVisit } from './staffPages';
import type { StaffJob } from './staffPages';

export type Who = {
  role: 'admin' | 'staff';
  userId: string;
  email: string;
  canSend: boolean;
  job: StaffJob;
};

export async function requireStaff(): Promise<{ who: Who | null; error: string | null }> {
  try {
    const store = await cookies();
    const sb = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
      { cookies: { getAll: () => store.getAll(), setAll: () => {} } }
    );
    const { data } = await sb.auth.getUser();
    const u = data?.user;
    if (!u) return { who: null, error: 'غير مصرح' };
    const t = Date.parse(String(u.last_sign_in_at || ''));
    if (!t || Date.now() - t > MAX_SESSION_MS) return { who: null, error: 'انتهت الجلسة — يلزم تسجيل الدخول' };
    if (u.email === ADMIN_EMAIL) return { who: { role: 'admin', userId: u.id, email: String(u.email), canSend: true, job: 'assistant' }, error: null };
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string);
    const { data: st } = await admin.from('staff').select('user_id, active, can_send, job').eq('user_id', u.id).maybeSingle();
    if (!st || st.active !== true) return { who: null, error: 'غير مصرح' };
    // دورٌ غير معرَّف لا يُحمل على رغد صامتاً — كان `asJob` يفعل ذلك، فموظفةٌ
    // ثالثة أو خطأٌ إملائي في الحقل تُفتح له شاشاتها ومكتبها بلا تنبيه.
    if (!isJob(st.job)) return { who: null, error: 'دورٌ غير معرَّف لهذا الحساب — راجع المالك' };
    return {
      who: {
        role: 'staff', userId: u.id, email: String(u.email || ''),
        canSend: st.can_send !== false, job: st.job,
      },
      error: null,
    };
  } catch {
    return { who: null, error: 'غير مصرح' };
  }
}

/**
 * حارس الشاشة في الخادم: الموظفة لا تصل إلى مسارٍ إلا إن كانت شاشته من عملها.
 *
 * ★ كانت المسارات كلها تكتفي بـ`requireStaff` — أي «موظفةٌ ما» — والإخفاء في
 *   القائمة وحده يفرّق بين الصفّين. فرغد تستطيع أن تنادي «الفرص الساخنة»
 *   و«الوارد» وتفتح ملف عميلٍ مسعَّر، وضي تنادي متابعة الجهات. وما وصل
 *   الجهازَ وُصل إليه. فصار الحكم هنا، ويُقرأ من `staffPages` نفسه الذي
 *   ترسم منه القائمة — تعريفٌ واحد لا نسختان.
 */
export async function requirePage(href: string): Promise<{ who: Who | null; error: string | null; status: number }> {
  const r = await requireStaff();
  if (!r.who) return { who: null, error: r.error, status: 401 };
  if (r.who.role === 'admin' || mayVisit(r.who.job, href)) return { ...r, status: 200 };
  return { who: null, error: 'هذه الشاشة ليست من عملك', status: 403 };
}

export async function ownsCompany(who: Who, companyId: string): Promise<boolean> {
  if (who.role === 'admin') return true;
  if (!companyId) return false;
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string);
  const { data } = await admin.from('companies').select('assigned_to').eq('id', companyId).maybeSingle();
  return !!data && data.assigned_to === who.userId;
}
