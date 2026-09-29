-- البند (ب): «لا تتواصل» — يضعها المالك، وضي (نتيجة «طلب عدم التواصل»)، وClaude التشغيل (من ردود البريد).
-- توقف البريد والاتصال والواتساب للمنشأة كلها، وتمنع إعادة استيرادها بالسجل التجاري أو بالاسم.

-- ١) النتيجة الجديدة في المفردة الواحدة (src/lib/outcomes.ts) — والقيود الأربعة مطابقةٌ لها
do $$
declare t text; c text;
begin
  foreach t in array array['mini_assessments', 'companies', 'hot_touches', 'service_inquiries'] loop
    c := case t when 'mini_assessments' then 'mini_outcome_chk' else t || '_outcome_chk' end;
    execute format('alter table public.%I drop constraint if exists %I', t, c);
    execute format($f$alter table public.%I add constraint %I check (outcome is null or outcome = any (array[
      'أرسلتُ رسالة','لم يرد','مهتم','طلب معاودة','غير مهتم','غير مؤهل الآن','رقم خاطئ','تحوّل عميلاً','طلب عدم التواصل']))$f$, t, c);
  end loop;
end $$;

-- ٢) الحالة وسببها ومن وضعها ومتى
alter table public.contract_awards drop constraint if exists contract_awards_status_check;
alter table public.contract_awards add constraint contract_awards_status_check check (status = any (array[
  'new','qualified','messaged','replied','reminder_call','meeting','gap_sent','priced','paid','dropped','do_not_contact']));
alter table public.contract_awards
  add column if not exists dnc_reason text,
  add column if not exists dnc_at timestamptz,
  add column if not exists dnc_by text;

-- ٣) «لا تتواصل» على ترسيةٍ تسري على المنشأة كلها (بمفتاحها أو سجلّها التجاري) — إلا ما دُفع
create or replace function public.award_dnc_spread() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.status = 'do_not_contact' and old.status is distinct from 'do_not_contact' then
    new.dnc_at := coalesce(new.dnc_at, now());
  end if;
  return new;
end $$;
drop trigger if exists award_dnc_stamp on public.contract_awards;
create trigger award_dnc_stamp before update of status on public.contract_awards
  for each row execute function public.award_dnc_spread();

create or replace function public.award_dnc_propagate() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.status = 'do_not_contact' and old.status is distinct from 'do_not_contact' then
    update contract_awards
       set status = 'do_not_contact', dnc_reason = new.dnc_reason, dnc_by = new.dnc_by, dnc_at = new.dnc_at, updated_at = now()
     where id <> new.id and status not in ('do_not_contact', 'paid')
       and (org_key = new.org_key or (coalesce(btrim(new.cr_number), '') <> '' and cr_number = new.cr_number));
  end if;
  return null;
end $$;
drop trigger if exists award_dnc_propagate on public.contract_awards;
create trigger award_dnc_propagate after update of status on public.contract_awards
  for each row execute function public.award_dnc_propagate();

-- ٤) لا يُعاد استيراد منشأةٍ «لا تتواصل» — من المستورد أو الشاشة أو Claude التشغيل
create or replace function public.award_block_dnc() returns trigger
language plpgsql set search_path = public as $$
declare k text := public.award_org_name_key(new.company_name);
begin
  if exists (
    select 1 from contract_awards
     where status = 'do_not_contact'
       and (org_key = k or (coalesce(btrim(new.cr_number), '') <> '' and cr_number = new.cr_number))
  ) then
    raise exception 'do_not_contact: المنشأة «%» طلبت عدم التواصل — لا تُستورد', new.company_name using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists award_block_dnc on public.contract_awards;
create trigger award_block_dnc before insert on public.contract_awards
  for each row execute function public.award_block_dnc();
