-- أتعاب الاستكمال (٥ أكتوبر، بأمر المالك): موافقة الجهة بخاناتها الإلزامية، ثم «قُيِّد التمويل» يحسب الأتعاب
-- من عقد العميل ويُصدر فاتورةً ضريبية مسوّدةً تنتظر اعتماد المالك.
create table if not exists public.success_fees (
  id uuid primary key default gen_random_uuid(),
  service_request_id uuid not null unique references public.service_requests(id) on delete cascade,
  company_id uuid references public.companies(id),
  contract_id uuid references public.contracts(id),
  funder_name text not null,
  approved_amount numeric not null check (approved_amount > 0),
  expected_disbursement date not null,
  approved_logged_at timestamptz not null default now(),
  approved_logged_by text,
  booked_amount numeric check (booked_amount > 0),
  booked_at timestamptz,
  booked_by text,
  fee_pct numeric,
  vat_rate numeric,
  vat_inclusive boolean,
  fee_net numeric,
  fee_vat numeric,
  fee_total numeric,
  invoice_no text unique,
  invoice_status text not null default 'none' check (invoice_status in ('none','draft','approved','cancelled')),
  invoice_approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.success_fees enable row level security;
create sequence if not exists public.invoice_seq start 1;
insert into public.fee_settings(key, value) values ('seller_vat_number', '""'::jsonb) on conflict (key) do nothing;

create or replace function public.next_invoice_no() returns text language sql security definer set search_path = public as $$
  select 'MRD-' || to_char(now() at time zone 'Asia/Riyadh', 'YYYY') || '-' || lpad(nextval('public.invoice_seq')::text, 4, '0');
$$;
revoke all on function public.next_invoice_no() from public, anon, authenticated;
