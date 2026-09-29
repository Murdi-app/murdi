-- حالة كل فرصة ومسؤولها وخطوتها التالية وموعدها ودرجتها المفسَّرة — تُشتقّ من الرموز القائمة
-- (status وأعمدة المسار والمصادر والاستشارات والتوصيات) فلا حالةَ ثانية تُكتب وتتباعد.
create or replace view public.award_pipeline as
with s as (
  select
    coalesce((select value from award_settings where key = 'early_stage_days'), '30')::int as early_days,
    coalesce((select value from award_settings where key = 'reminder_after_days'), '8')::int as remind_days,
    coalesce((select value from award_settings where key = 'general_email_approved'), 'false') = 'true' as general_ok
),
base as (
  select a.*,
    -- القالب الذي سيُستعمل (القاعدة نفسها في src/lib/awards.ts: kindFor) — ومعتمدٌ هو؟
    case when a.contract_value is null or a.is_subcontract is true or a.source <> 'etimad' then s.general_ok
         else exists (select 1 from award_message_templates t where t.active and t.approved and t.category = a.category
           and t.stage = case when a.awarded_at is not null and a.awarded_at >= current_date - s.early_days then 'early' else 'in_execution' end)
    end as template_ok,
    (coalesce(a.email_source_url, '') ~* '^https?://' and coalesce(a.contact_email, '') <> '')
      or (coalesce(a.phone_source_url, '') ~* '^https?://' and coalesce(a.contact_phone, a.contact_whatsapp, '') <> '') as sourced,
    exists (select 1 from award_recommendations r where r.award_id = a.id and r.status = 'accepted' and r.kind in ('contact', 'decision_maker')) as verified,
    exists (select 1 from consultations c join contract_awards x on x.id = c.award_id
             where x.org_key = a.org_key and c.assessment_type = 'award_gap' and c.status = 'ready') as consult_ready,
    (select max(c.generated_at) from consultations c join contract_awards x on x.id = c.award_id
      where x.org_key = a.org_key and c.assessment_type = 'award_gap' and c.status = 'ready') as consult_at,
    s.remind_days
  from contract_awards a cross join s
),
st as (
  select b.*,
    case
      when b.status = 'do_not_contact' then 'لا تتواصل'
      when b.status = 'dropped' then 'مغلقة'
      when b.status = 'paid' and b.service_request_id is not null then 'انتقلت لرغد'
      when b.status = 'paid' then 'دُفع'
      when b.status in ('gap_sent', 'meeting', 'priced') then 'عُرضت الخدمة'
      when b.consult_ready then 'الاستشارة تنتظر اعتمادي'
      when b.status = 'replied' and b.fit_service is null then 'ردّت'
      when b.status = 'replied' then 'تنتظر بيانات الاستشارة'
      when b.status in ('messaged', 'reminder_call') then 'أُرسلت'
      when not (b.sourced and b.verified) then 'ينقص مصدر'
      when not b.template_ok then 'تنتظر اعتماد نص جديد'
      else 'جاهزة للتواصل'
    end as state
  from base b
),
nx as (
  select t.*,
    case t.state
      when 'ينقص مصدر' then 'Codex'
      when 'تنتظر اعتماد نص جديد' then 'الدكتور'
      when 'جاهزة للتواصل' then 'المنصة'
      when 'أُرسلت' then case when coalesce(t.contact_phone, t.contact_whatsapp) is not null and t.phone_check is distinct from 'no' then 'ضي' else 'Codex' end
      when 'ردّت' then 'ضي'
      when 'تنتظر بيانات الاستشارة' then 'المنصة'
      when 'الاستشارة تنتظر اعتمادي' then 'الدكتور'
      when 'عُرضت الخدمة' then 'ضي'
      when 'دُفع' then 'الدكتور'
      when 'انتقلت لرغد' then 'رغد'
      else null end as responsible,
    case t.state
      when 'ينقص مصدر' then 'صاحب القرار ووسيلة تواصل بمصدرها المنشور — توصية تُقبل'
      when 'تنتظر اعتماد نص جديد' then 'اعتمد القالب الجديد أو المعدَّل'
      when 'جاهزة للتواصل' then 'البريد يخرج آلياً في أول نافذة إرسال'
      when 'أُرسلت' then case when coalesce(t.contact_phone, t.contact_whatsapp) is not null and t.phone_check is distinct from 'no'
                              then 'مكالمة التذكير الوحيدة (اتصال + واتساب)' else 'رقمٌ بمصدره لمكالمة التذكير' end
      when 'ردّت' then 'التأهيل: سؤال الفرضية وتحديد الخدمة'
      when 'تنتظر بيانات الاستشارة' then 'تُولَّد الاستشارة آلياً وتنتظر اعتمادك'
      when 'الاستشارة تنتظر اعتمادي' then 'اعتمد الاستشارة وأرسلها'
      when 'عُرضت الخدمة' then 'متابعة العرض حتى القرار'
      when 'دُفع' then 'اربط الطلب ليصل لرغد'
      when 'انتقلت لرغد' then 'الخدمة والجهات'
      else null end as default_step,
    case t.state
      when 'ينقص مصدر' then t.created_at + interval '2 days'
      when 'تنتظر اعتماد نص جديد' then t.updated_at + interval '1 day'
      when 'جاهزة للتواصل' then t.updated_at + interval '1 day'
      when 'أُرسلت' then coalesce(t.reminder_at, t.messaged_at, t.contacted_at, t.updated_at) + make_interval(days => t.remind_days)
      when 'ردّت' then coalesce(t.replied_at, t.updated_at) + interval '1 day'
      when 'تنتظر بيانات الاستشارة' then coalesce(t.qualified_at, t.updated_at) + interval '1 day'
      when 'الاستشارة تنتظر اعتمادي' then coalesce(t.consult_at, t.updated_at) + interval '1 day'
      when 'عُرضت الخدمة' then coalesce(t.gap_sent_at, t.offered_at, t.updated_at) + interval '3 days'
      when 'دُفع' then coalesce(t.paid_at, t.updated_at) + interval '1 day'
      when 'انتقلت لرغد' then coalesce(t.paid_at, t.updated_at) + interval '2 days'
      else null end as default_at,
    -- الدرجة: القيمة × قرب الإغلاق × جودة وسيلة التواصل (+ أولوية Codex)
    least(1, ln(1 + coalesce(t.contract_value, 0) / 1e6) / ln(51)) as v_pts,
    case t.state when 'ينقص مصدر' then 0.1 when 'تنتظر اعتماد نص جديد' then 0.25 when 'جاهزة للتواصل' then 0.3
      when 'أُرسلت' then 0.4 when 'ردّت' then 0.75 when 'تنتظر بيانات الاستشارة' then 0.8 when 'الاستشارة تنتظر اعتمادي' then 0.85
      when 'عُرضت الخدمة' then 0.9 when 'دُفع' then 1 when 'انتقلت لرغد' then 1 else 0 end as c_pts,
    case when t.phone_check = 'yes' then 1 when t.phone_check = 'no' then 0.2
      when coalesce(t.phone_source_url, '') <> '' then 0.7 when coalesce(t.email_source_url, '') <> '' then 0.5
      when coalesce(t.contact_phone, t.contact_email, '') <> '' then 0.2 else 0.1 end as q_pts
  from st t
)
select n.id, n.org_key, n.company_name, n.status, n.state,
  n.responsible,
  case when n.responsible is null then null else coalesce(n.next_step_override, n.default_step) end as next_step,
  case when n.responsible is null then null else coalesce(n.next_at_override, n.default_at) end as next_at,
  (n.responsible is not null and coalesce(n.next_at_override, n.default_at) < now()) as overdue,
  greatest(0, round(100 * (0.4 * n.v_pts + 0.35 * n.c_pts + 0.25 * n.q_pts)) + coalesce(n.codex_priority, 0))::int as score,
  'القيمة ' || case when n.contract_value is null then 'غير معروفة' else round(n.contract_value / 1e6, 1)::text || ' مليون' end
    || ' · المرحلة «' || n.state || '»'
    || ' · التواصل ' || case when n.phone_check = 'yes' then 'رقمٌ يصل لصاحب القرار' when n.phone_check = 'no' then 'رقمٌ لا يصل'
         when coalesce(n.phone_source_url, '') <> '' then 'رقمٌ بمصدره' when coalesce(n.email_source_url, '') <> '' then 'بريدٌ بمصدره'
         when coalesce(n.contact_phone, n.contact_email, '') <> '' then 'بلا مصدر' else 'لا وسيلة' end
    || case when coalesce(n.codex_priority, 0) <> 0 then ' · أولوية Codex ' || n.codex_priority::text else '' end as score_why,
  n.template_ok, n.sourced, n.verified, n.consult_ready
from nx n;
revoke all on public.award_pipeline from anon, authenticated;
