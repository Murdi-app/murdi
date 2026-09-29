-- المستورد (٣): المنفّذة المدرجة في السوق الرئيسية (تاسي) تُعلَّم «مدرجة» وتُقترح للإسقاط تلقائياً؛
-- ومدرجات نمو تبقى new (أقرب لحجم عملائنا). القائمة جدولٌ يحدّثه المالك وClaude التشغيل —
-- موقع تداول لا يُقرأ آلياً (403)، فلا تُكشط.
create table if not exists public.listed_companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  market text not null check (market in ('tasi', 'nomu')),
  name_key text generated always as (public.award_org_name_key(name)) stored,
  source_url text,
  added_by text,
  created_at timestamptz not null default now(),
  unique (name_key)
);
alter table public.listed_companies enable row level security;
revoke all on public.listed_companies from anon, authenticated;

alter table public.contract_awards
  add column if not exists listed_market text check (listed_market is null or listed_market in ('tasi', 'nomu')),
  add column if not exists drop_suggested text;

-- كل ترسية تُقرأ على القائمة عند دخولها — أيّاً كان الكاتب
create or replace function public.award_mark_listed() returns trigger
language plpgsql set search_path = public as $$
declare m text;
begin
  select market into m from listed_companies where name_key = public.award_org_name_key(new.company_name) limit 1;
  new.listed_market := m;
  if m = 'tasi' and new.status = 'new' and new.drop_suggested is null then
    new.drop_suggested := 'مدرجة في السوق الرئيسية (تاسي) — مقترحة للإسقاط';
  end if;
  return new;
end $$;
drop trigger if exists award_mark_listed on public.contract_awards;
create trigger award_mark_listed before insert or update of company_name on public.contract_awards
  for each row execute function public.award_mark_listed();

-- البذرة: ما أسقطه المالك ٢٩ سبتمبر لأنها مدرجة كبيرة في تاسي
insert into public.listed_companies (name, market, added_by) values
  ('أنابيب الشرق', 'tasi', 'بذرة — إسقاط المالك ٢٩/٩'),
  ('العربية للأنابيب', 'tasi', 'بذرة — إسقاط المالك ٢٩/٩'),
  ('الشركة السعودية لأنابيب الصلب', 'tasi', 'بذرة — إسقاط المالك ٢٩/٩')
on conflict (name_key) do nothing;
