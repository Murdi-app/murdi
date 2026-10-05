-- أرشيف ما يُرفع من بيانات العميل بأمر المالك (يُعاد إن لزم) — بدل الحذف النهائي (٥ أكتوبر)
create table if not exists public.archived_records (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  company_id uuid,
  row_data jsonb not null,
  reason text,
  archived_at timestamptz not null default now()
);
alter table public.archived_records enable row level security;
