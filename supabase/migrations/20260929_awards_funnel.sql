-- البند (هـ): القياس بتواريخ في صف الترسية —
-- موثّقة ← وصول لصاحب القرار ← تواصل ← رد ← تأهيل ← عرض ← دفع ← تنفيذ ← إحالات.
-- تُختم في القاعدة من الأحداث نفسها، فيُحسب ما يكتبه المالك وضي وClaude التشغيل سواءً.
-- (reached_at · replied_at · qualified_at موجودة قبلها)
alter table public.contract_awards
  add column if not exists documented_at timestamptz,
  add column if not exists contacted_at timestamptz,
  add column if not exists offered_at timestamptz,
  add column if not exists paid_at timestamptz,
  add column if not exists executing_at timestamptz,
  add column if not exists referred_by uuid references public.contract_awards(id) on delete set null,
  add column if not exists referrals_count integer not null default 0,
  add column if not exists first_referral_at timestamptz;

-- الحالة والخدمة تختمان مراحلهما (أول مرةٍ فقط)
create or replace function public.award_funnel_stamp() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.status in ('qualified','messaged','reminder_call','replied','gap_sent','meeting','priced','paid') then
    new.documented_at := coalesce(new.documented_at, now());
  end if;
  if new.status in ('priced','paid') then new.offered_at := coalesce(new.offered_at, now()); end if;
  if new.status = 'paid' then new.paid_at := coalesce(new.paid_at, now()); end if;
  if new.fit_service is not null then new.qualified_at := coalesce(new.qualified_at, now()); end if;
  if new.replied_at is not null then new.reached_at := coalesce(new.reached_at, new.replied_at); end if;
  return new;
end $$;
drop trigger if exists award_funnel_stamp on public.contract_awards;
create trigger award_funnel_stamp before insert or update on public.contract_awards
  for each row execute function public.award_funnel_stamp();

-- المراسلات: أول صادرٍ «تواصل»، والوارد «رد» و«وصول» (مع تحويل الحالة كما كان)
create or replace function public.award_touch_in_replied() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.direction = 'out' and coalesce(new.outcome, '') <> 'لا يصل لصاحب القرار' then  -- رقمٌ خاطئ ليس تواصلاً
    update contract_awards set contacted_at = coalesce(contacted_at, new.created_at) where id = new.award_id and contacted_at is null;
  elsif new.direction = 'in' then
    update contract_awards
       set status = case when status in ('new','qualified','messaged','reminder_call') then 'replied' else status end,
           replied_at = coalesce(replied_at, new.created_at),
           reached_at = coalesce(reached_at, new.created_at),
           contacted_at = coalesce(contacted_at, new.created_at),
           updated_at = now()
     where id = new.award_id;
  end if;
  return new;
end $$;

-- الإحالة: ترسيةٌ جديدة بـ referred_by تختم أول إحالةٍ للمُحيل وتعدّها
create or replace function public.award_referral_count() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.referred_by is not null and (tg_op = 'INSERT' or old.referred_by is distinct from new.referred_by) then
    update contract_awards set referrals_count = referrals_count + 1, first_referral_at = coalesce(first_referral_at, now())
     where id = new.referred_by;
  end if;
  return null;
end $$;
drop trigger if exists award_referral_count on public.contract_awards;
create trigger award_referral_count after insert or update of referred_by on public.contract_awards
  for each row execute function public.award_referral_count();

-- ما سبق: من السجل الموجود
update public.contract_awards a set
  documented_at = coalesce(a.documented_at, case when a.status in ('qualified','messaged','reminder_call','replied','gap_sent','meeting','priced','paid') then a.created_at end),
  contacted_at = coalesce(a.contacted_at, (select min(t.created_at) from award_touches t where t.award_id = a.id and t.direction = 'out'), a.messaged_at);
