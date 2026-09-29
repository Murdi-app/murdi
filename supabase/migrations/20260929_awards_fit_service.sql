-- البند (ج): التأهيل يحدّد الخدمة — تختارها ضي بعد المكالمة (والمالك يعدّلها).
-- لا نفترض أن كل فائز يحتاج تمويل عقد. والأسعار ليست هنا ولا تصل لضي.
alter table public.contract_awards
  add column if not exists fit_service text,
  add column if not exists qualified_at timestamptz,
  add column if not exists qualified_by text;
alter table public.contract_awards drop constraint if exists contract_awards_fit_service_chk;
alter table public.contract_awards add constraint contract_awards_fit_service_chk check (fit_service is null or fit_service in
  ('contract_finance', 'working_capital', 'feasibility_credit', 'broader_funding', 'not_fit'));
