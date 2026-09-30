-- توجيه الموظفتين يخرج وحده ٧:٣٠ الرياض (٠٤:٣٠ UTC) أحد–خميس إن بقي مسوّدة — بأمر المالك ٣٠/٩.
create or replace function public.kick_briefs_send()
returns bigint language sql security definer
set search_path to 'public', 'net', 'pg_temp'
as $$
  select net.http_post(
    url := (select value from app_config where key='site_url') || '/api/cron/briefs-send',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret', (select value from app_config where key='cron_secret')),
    body := '{}'::jsonb, timeout_milliseconds := 55000);
$$;
revoke all on function public.kick_briefs_send() from public, anon, authenticated;
select cron.unschedule('staff-briefs-send') where exists (select 1 from cron.job where jobname = 'staff-briefs-send');
select cron.schedule('staff-briefs-send', '30 4 * * 0-4', 'select public.kick_briefs_send();');
