import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requirePage } from '@/lib/requireStaff';
import { logError } from '@/lib/logError';
import { displayName, involvesOutreach } from '@/lib/serviceCatalog';
import { PAID_STATUSES } from '@/lib/serviceStatus';
import { isFrozen } from '@/lib/frozen';
import { hideMoney, hidePhones } from '@/lib/staffRedact';

// رحلة الملف بعد الدفع — مصدرٌ واحد تقرؤه الموظفتان (١١ أكتوبر، المالك).
//
// ★ الشكوى بنصّها: «ضي تسلّم رغد عميلاً ثم تسأل: وينه؟ وش صار عليه؟ — ولها نسبة
//   من عندي فهي متخوّفة». فكان لكل موظفةٍ شاشاتها، ولا شاشة تقول أين وصل الملف.
//   فهذا المسار يحسب لكل ملفٍّ مدفوع **مرحلته** من آثاره الحقيقية — لا من حقلٍ
//   يُكتب باليد فيُنسى: ما سجّلته رغد، وكم جهة خوطبت وكم ردّت، وهل وافقت جهة،
//   وهل نزل التمويل.
// ★ تقرؤه رغد لتعمل، وتقرؤه ضي **قراءةً** لتطمئن على عملائها. والكتابة على الملف
//   تبقى في مساراتها كما هي (`/api/staff/desk` و`/api/admin/followup`).
// ★ ولا مال فيه للموظفة: لا مبلغ تمويل ولا سعر ولا نسبة — الجهة وموعد الصرف فقط.

const DAY = 86400_000;

type Stage = 'received' | 'docs' | 'funders' | 'approved' | 'funded' | 'working' | 'delivered';

const STAGE_LABEL: Record<Stage, string> = {
  received: 'استلام — لم يبدأ العمل',
  docs: 'جمع المستندات وتجهيز الملف',
  funders: 'عند جهات التمويل',
  approved: 'وافقت جهة — بانتظار الصرف',
  funded: 'نزل التمويل ✓',
  working: 'قيد التنفيذ',
  delivered: 'سُلّمت الخدمة ✓',
};

const last9 = (p: unknown) => String(p || '').replace(/\D/g, '').slice(-9);

export async function GET() {
  const { who, error, status } = await requirePage('/admin/journey');
  if (!who) return NextResponse.json({ error: error || 'غير مصرح' }, { status });
  const isStaff = who.role === 'staff';

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string);
  try {
    // الملفات المدفوعة المفتوحة، والمغلقة في آخر ٤٥ يوماً (لتُرى «نزل التمويل» و«سُلّمت»)
    const since = new Date(Date.now() - 45 * DAY).toISOString();
    const { data: reqs, error: rErr } = await sb.from('service_requests')
      .select('id, company_id, service_title, option_key, status, paid_at, updated_at, created_at')
      .in('status', [...PAID_STATUSES])
      .order('paid_at', { ascending: false, nullsFirst: false });
    if (rErr) throw rErr;
    const live = (reqs || []).filter((r) => r.status !== 'completed' || String(r.updated_at || '') >= since);

    const coIds = Array.from(new Set(live.map((r) => String(r.company_id)).filter(Boolean)));
    const reqIds = live.map((r) => String(r.id));
    if (!coIds.length) return NextResponse.json({ ok: true, role: who.role, job: who.role === 'admin' ? 'admin' : who.job, files: [] });

    const [cos, evs, outs, sfs] = await Promise.all([
      sb.from('companies').select('id, company_name, owner_name, phone, admin_note, outreach_paused').in('id', coIds),
      sb.from('deal_events').select('company_id, kind, title, detail, entity_name, created_at').in('company_id', coIds).in('kind', ['file_update', 'file_presented']).order('created_at', { ascending: false }).limit(1000),
      sb.from('outreach_messages').select('company_id, status, sent_at, last_sent_at, last_call_at, reply_at, contact_method').in('company_id', coIds),
      sb.from('success_fees').select('service_request_id, funder_name, approved_logged_at, expected_disbursement, booked_at').in('service_request_id', reqIds),
    ]);
    for (const q of [cos, evs, outs, sfs]) if (q.error) throw q.error;

    // ── مَن تواصل مع العميل قبل الدفع: لمسات «الفرص الساخنة» على منشأته أو على
    //    تقييمه وطلبه من الموقع (يُطابَقان بآخر ٩ أرقام من الجوال). بها تعرف ضي «عميلك».
    const companies = new Map((cos.data || []).map((c) => [String(c.id), c]));
    const phoneToCo = new Map<string, string>();
    for (const c of cos.data || []) { const p = last9(c.phone); if (p.length === 9) phoneToCo.set(p, String(c.id)); }
    const [ma, si] = await Promise.all([
      sb.from('mini_assessments').select('id, phone').not('phone', 'is', null).limit(5000),
      sb.from('service_inquiries').select('id, phone').not('phone', 'is', null).limit(5000),
    ]);
    const refToCo = new Map<string, string>();
    for (const c of coIds) refToCo.set(c, c);
    for (const row of [...(ma.data || []), ...(si.data || [])]) {
      const co = phoneToCo.get(last9(row.phone));
      if (co) refToCo.set(String(row.id), co);
    }
    const refs = Array.from(refToCo.keys());
    const handled = new Map<string, Set<string>>();
    for (let i = 0; i < refs.length; i += 300) {
      const { data: ts } = await sb.from('hot_touches').select('ref_id, actor_name').in('ref_id', refs.slice(i, i + 300));
      for (const t of ts || []) {
        const co = refToCo.get(String(t.ref_id));
        const n = String(t.actor_name || '').trim();
        if (!co || !n) continue;
        const s = handled.get(co) || new Set<string>(); s.add(n); handled.set(co, s);
      }
    }

    const evBy = new Map<string, { kind: string; title: string; detail: string; entity: string; at: string }[]>();
    for (const e of evs.data || []) {
      const k = String(e.company_id); const l = evBy.get(k) || [];
      l.push({ kind: String(e.kind), title: String(e.title || ''), detail: String(e.detail || ''), entity: String(e.entity_name || ''), at: String(e.created_at) });
      evBy.set(k, l);
    }
    const outBy = new Map<string, { sent: number; replied: number; lastAt: number }>();
    for (const m of outs.data || []) {
      if (['مستبعدة', 'موقوفة', 'مسودة'].includes(String(m.status)) && !m.last_call_at) continue;
      const k = String(m.company_id); const o = outBy.get(k) || { sent: 0, replied: 0, lastAt: 0 };
      const touched = m.sent_at || m.last_call_at || m.contact_method === 'phone';
      if (touched) o.sent += 1;
      if (m.reply_at) o.replied += 1;
      for (const d of [m.last_sent_at, m.sent_at, m.last_call_at, m.reply_at]) { const t = Date.parse(String(d || '')); if (t > o.lastAt) o.lastAt = t; }
      outBy.set(k, o);
    }
    const sfBy = new Map((sfs.data || []).map((f) => [String(f.service_request_id), f]));

    const clean = (s: string) => (isStaff ? hidePhones(hideMoney(s, s)) : s);
    const pick = (detail: string, label: string) => {
      const m = detail.split(' · ').find((p) => p.startsWith(label));
      return m ? m.slice(label.length).trim() : '';
    };

    const now = Date.now();
    const files = live.map((r) => {
      const cid = String(r.company_id);
      const co = companies.get(cid);
      const outreach = involvesOutreach(r.service_title, r.option_key);
      const evAll = evBy.get(cid) || [];
      const updates = evAll.filter((e) => e.kind === 'file_update');
      const presented = new Set(evAll.filter((e) => e.kind === 'file_presented').map((e) => e.entity).filter(Boolean)).size;
      const o = outBy.get(cid) || { sent: 0, replied: 0, lastAt: 0 };
      const sf = sfBy.get(String(r.id));

      let stage: Stage;
      if (outreach) {
        stage = sf?.booked_at ? 'funded'
          : sf?.approved_logged_at ? 'approved'
          : (o.sent > 0 || presented > 0) ? 'funders'
          : updates.length > 0 ? 'docs' : 'received';
      } else {
        stage = ['delivered', 'completed'].includes(String(r.status)) ? 'delivered' : updates.length > 0 ? 'working' : 'received';
      }

      const lu = updates[0];
      const lastAt = Math.max(
        Date.parse(String(lu?.at || '')) || 0, o.lastAt,
        Date.parse(String(evAll[0]?.at || '')) || 0,
        Date.parse(String(r.paid_at || '')) || 0,
      );
      const done = stage === 'funded' || stage === 'delivered';
      return {
        request_id: String(r.id),
        company_id: cid,
        name: co?.company_name || 'منشأة',
        owner: co?.owner_name || '',
        phone: co?.phone || '',
        service: displayName(String(r.service_title || '')),
        outreach,
        stage,
        stage_label: STAGE_LABEL[stage],
        paid_at: r.paid_at || null,
        counts: { sent: o.sent, replied: o.replied, presented },
        funder: sf?.funder_name || null,
        expected: sf?.expected_disbursement || null,
        last_update: lu ? clean(lu.title) : '',
        missing: lu ? clean(pick(lu.detail, 'ينقصه:')) : '',
        next: lu ? clean(pick(lu.detail, 'الخطوة التالية:')) : '',
        last_by: lu ? pick(lu.detail, 'سجّلته:') : '',
        last_at: lastAt ? new Date(lastAt).toISOString() : null,
        idle_days: done || !lastAt ? 0 : Math.floor((now - lastAt) / DAY),
        handled_by: Array.from(handled.get(cid) || []),
        paused: isFrozen(co?.admin_note) || co?.outreach_paused === true,
        done,
      };
    });

    const { data: me } = await sb.from('staff').select('name').eq('user_id', who.userId).maybeSingle();
    return NextResponse.json({ ok: true, role: who.role, job: who.role === 'admin' ? 'admin' : who.job, me: me?.name || '', files });
  } catch (e) {
    await logError('staff.journey', e, {});
    return NextResponse.json({ error: 'تعذّر تحميل رحلة الملفات' }, { status: 500 });
  }
}
