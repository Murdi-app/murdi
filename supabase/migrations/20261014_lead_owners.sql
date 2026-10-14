-- ★ ١٤ أكتوبر (المالك): العملاء مقسومون بالمناصفة بين ضي ورغد — كل موظفة تمسك عميلها
--   من أول اتصال إلى فتح الملف، برقمها. ومن لعميلٍ صفّان (طلب + ملف) يبقى عند صاحبته بالجوال.
create table if not exists public.lead_owners (
  source text not null,
  ref_id text not null,
  owner uuid not null,
  phone9 text,
  assigned_at timestamptz not null default now(),
  primary key (source, ref_id)
);
create index if not exists lead_owners_owner_idx on public.lead_owners(owner);
create index if not exists lead_owners_phone_idx on public.lead_owners(phone9);
alter table public.lead_owners enable row level security;
