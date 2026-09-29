-- القناة تعمل وحدها: `pg_cron` كل ربع ساعة يوقظ /api/cron/awards-pipeline
create or replace function public.kick_awards_pipeline()
returns bigint language sql security definer
set search_path to 'public', 'net', 'pg_temp'
as $$
  select net.http_post(
    url := (select value from app_config where key='site_url') || '/api/cron/awards-pipeline',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-cron-secret', (select value from app_config where key='cron_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 290000
  );
$$;
revoke all on function public.kick_awards_pipeline() from public, anon, authenticated;
select cron.unschedule('awards-pipeline') where exists (select 1 from cron.job where jobname = 'awards-pipeline');
select cron.schedule('awards-pipeline', '*/15 * * * *', 'select public.kick_awards_pipeline();');
