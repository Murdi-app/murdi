-- الاستشارة المختصرة تُولَّد آلياً بعد نصف ساعة من لصق رد العميل (١٢ أكتوبر، المالك)
alter table public.service_inquiries
  add column if not exists consult_status text,
  add column if not exists consult_tries int not null default 0,
  add column if not exists consult_at timestamptz,
  add column if not exists consult_error text,
  add column if not exists consult_html text,
  add column if not exists consult_code text,
  add column if not exists consult_sent_at timestamptz,
  add column if not exists consult_opened_at timestamptz;
create unique index if not exists service_inquiries_consult_code_key on public.service_inquiries (consult_code) where consult_code is not null;

create or replace function public.kick_inquiry_consults() returns bigint
language sql security definer set search_path to 'public', 'net', 'pg_temp' as $$
  select net.http_post(
    url := (select value from app_config where key='site_url') || '/api/cron/consults',
    headers := jsonb_build_object('Content-Type','application/json',
      'x-cron-secret', (select value from app_config where key='cron_secret')),
    body := '{}'::jsonb, timeout_milliseconds := 290000);
$$;
revoke all on function public.kick_inquiry_consults() from public, anon, authenticated;
select cron.schedule('inquiry-consults', '*/10 * * * *', 'select public.kick_inquiry_consults()');
