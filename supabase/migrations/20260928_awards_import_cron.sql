-- مستورد الترسيات اليومي من الأخبار — `pg_cron` ٦:٠٠ الرياض (٠٣:٠٠ UTC)،
-- قبل جرد الصباح (٧:٣٠) فيُحسب ما دخل في سطر الترسيات.
create or replace function public.kick_awards_import()
returns bigint language sql security definer
set search_path to 'public', 'net', 'pg_temp'
as $$
  select net.http_post(
    url := (select value from app_config where key='site_url') || '/api/cron/awards-import',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-cron-secret', (select value from app_config where key='cron_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
$$;
revoke all on function public.kick_awards_import() from public, anon, authenticated;
select cron.unschedule('awards-import') where exists (select 1 from cron.job where jobname = 'awards-import');
select cron.schedule('awards-import', '0 3 * * *', 'select public.kick_awards_import();');
