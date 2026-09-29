-- ٢٩ سبتمبر: مفتاح المنشأة (يجمع ترسيات المنشأة الواحدة في استشارة واحدة، ولاحقاً «لا تتواصل»)
-- وتاريخ فتح العروض (يُقدَّر منه بدء التنفيذ: فتح العروض + ٤٥ يوماً).
create or replace function public.award_org_name_key(name text) returns text
language sql immutable set search_path = public as $$
  select nullif(
    regexp_replace(
      regexp_replace(
        translate(
          regexp_replace(coalesce(name, ''), '[ً-ْـ]', '', 'g'),
          'أإآىة', 'ااايه'),
        '(^|\s)(شركه|شركة|مؤسسه|مؤسسة|المحدوده|المحدودة|ذات|المسؤوليه|المسؤولية|المسئوليه|شخص|واحد)(?=\s|$)', ' ', 'g'),
      '[^ء-يa-zA-Z0-9]', '', 'g'),
    '')
$$;

alter table public.contract_awards
  add column if not exists bids_opened_at date,
  add column if not exists org_key text;

create or replace function public.award_set_org_key() returns trigger
language plpgsql set search_path = public as $$
begin
  new.org_key := public.award_org_name_key(new.company_name);
  return new;
end $$;
drop trigger if exists award_set_org_key on public.contract_awards;
create trigger award_set_org_key before insert or update of company_name on public.contract_awards
  for each row execute function public.award_set_org_key();

update public.contract_awards set org_key = public.award_org_name_key(company_name);
create index if not exists contract_awards_org_key_idx on public.contract_awards(org_key);
