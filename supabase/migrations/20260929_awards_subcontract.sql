-- البند (د): الموردون ومقاولو الباطن — ترسيةٌ مستقلة is_subcontract = true مربوطة بالمقاول الرئيسي.
-- main_contractor اسمه كما ورد، وparent_award_id ترسيته إن وُجدت — ويُربطان أيّهما دخل أولاً.
alter table public.contract_awards
  add column if not exists main_contractor text,
  add column if not exists parent_award_id uuid references public.contract_awards(id) on delete set null;
create index if not exists contract_awards_parent_idx on public.contract_awards(parent_award_id) where parent_award_id is not null;

-- الابن يجد أباه بمفتاح المنشأة
create or replace function public.award_link_parent() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.parent_award_id is null and coalesce(btrim(new.main_contractor), '') <> '' then
    select id into new.parent_award_id from contract_awards
     where org_key = public.award_org_name_key(new.main_contractor) and id <> new.id and status <> 'dropped'
     order by created_at desc limit 1;
  end if;
  if new.parent_award_id is not null or coalesce(btrim(new.main_contractor), '') <> '' then
    new.is_subcontract := true;
  end if;
  return new;
end $$;
drop trigger if exists award_link_parent on public.contract_awards;
create trigger award_link_parent before insert or update of main_contractor, parent_award_id on public.contract_awards
  for each row execute function public.award_link_parent();

-- والأب إن دخل بعد ابنه يلتقطه
create or replace function public.award_adopt_children() returns trigger
language plpgsql set search_path = public as $$
begin
  update contract_awards set parent_award_id = new.id
   where parent_award_id is null and id <> new.id
     and coalesce(btrim(main_contractor), '') <> ''
     and public.award_org_name_key(main_contractor) = new.org_key;
  return null;
end $$;
drop trigger if exists award_adopt_children on public.contract_awards;
create trigger award_adopt_children after insert on public.contract_awards
  for each row execute function public.award_adopt_children();
