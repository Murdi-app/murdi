-- توجيه الصباح للموظفتين — من المنصة نفسها.
--
-- كانت المسوّدتان تُكتبان في مهمةٍ خارج المنصة، ولم تُكتبا منذ ١٦ سبتمبر إلا
-- مرةً يدوياً. فصار `pg_cron` يوقظ `/api/cron/briefs` الساعة ٤:٤٥ بتوقيت الرياض
-- (٠١:٤٥ UTC)، فيكتب المسوّدتين ويرسلهما للمالك بزرّ «اعتمد وأرسل».
-- ولا يخرج شيءٌ إلى الموظفتين قبل ضغطته.

-- «جارٍ الإرسال» حجزٌ للصفّ: ضغطتان على الزرّ لا ترسلان مرتين
alter table public.daily_briefs drop constraint if exists daily_briefs_status_ck;
alter table public.daily_briefs add constraint daily_briefs_status_ck
  check (status = any (array['draft','sending','sent','cancelled']));

create or replace function public.kick_briefs()
returns bigint language sql security definer
set search_path to 'public', 'net', 'pg_temp'
as $$
  select net.http_post(
    url := (select value from app_config where key='site_url') || '/api/cron/briefs',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-cron-secret', (select value from app_config where key='cron_secret')),
    body := '{}'::jsonb
  );
$$;
revoke all on function public.kick_briefs() from public, anon, authenticated;

select cron.unschedule('staff-briefs') where exists (select 1 from cron.job where jobname = 'staff-briefs');
select cron.schedule('staff-briefs', '45 1 * * 0-4', 'select public.kick_briefs();');
