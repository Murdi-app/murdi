-- البند (أ): صاحب القرار — مصدر كل رقمٍ وبريد ورابطه، وتحقق ضي أن الرقم يصل لصاحب القرار.
alter table public.contract_awards
  add column if not exists phone_source text,
  add column if not exists phone_source_url text,
  add column if not exists email_source text,
  add column if not exists email_source_url text,
  add column if not exists phone_check text,
  add column if not exists phone_checked_at timestamptz,
  add column if not exists phone_checked_by text,
  add column if not exists reached_at timestamptz;

alter table public.contract_awards drop constraint if exists contract_awards_phone_check_chk;
alter table public.contract_awards add constraint contract_awards_phone_check_chk
  check (phone_check is null or phone_check in ('yes', 'no'));

-- لا رقم بلا مصدرٍ منشور ورابطه — أيّاً كان الكاتب (الشاشة، المستورد، Claude التشغيل)
alter table public.contract_awards drop constraint if exists contract_awards_phone_sourced_chk;
alter table public.contract_awards add constraint contract_awards_phone_sourced_chk
  check (coalesce(btrim(contact_phone), '') = '' and coalesce(btrim(contact_whatsapp), '') = ''
         or (phone_source_url ~* '^https?://' and coalesce(btrim(phone_source), '') <> ''));

-- رقمٌ جديد يعيد التحقق من أوله
create or replace function public.award_phone_changed() returns trigger
language plpgsql set search_path = public as $$
begin
  if coalesce(new.contact_phone, '') is distinct from coalesce(old.contact_phone, '')
     or coalesce(new.contact_whatsapp, '') is distinct from coalesce(old.contact_whatsapp, '') then
    new.phone_check := null; new.phone_checked_at := null; new.phone_checked_by := null;
  end if;
  return new;
end $$;
drop trigger if exists award_phone_changed on public.contract_awards;
create trigger award_phone_changed before update of contact_phone, contact_whatsapp on public.contract_awards
  for each row execute function public.award_phone_changed();
