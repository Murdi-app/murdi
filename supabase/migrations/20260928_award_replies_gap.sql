-- الترسيات: (١) كل ردٍّ وارد في award_touches — من الشاشة أو يُكتب مباشرة في
-- القاعدة — يحوّل الترسية إلى replied. (٢) مخزن جدول فجوة السيولة على الترسية.
-- (٣) معايير القطاع ونصوص الجدول في award_settings (لا في الكود — المستودع عام).

create or replace function public.award_touch_in_replied() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.direction = 'in' then
    update contract_awards
       set status = 'replied', replied_at = coalesce(replied_at, new.created_at), updated_at = now()
     where id = new.award_id and status in ('new', 'qualified', 'messaged', 'reminder_call');
  end if;
  return new;
end $$;
revoke all on function public.award_touch_in_replied() from public, anon, authenticated;

drop trigger if exists award_touch_in_replied on public.award_touches;
create trigger award_touch_in_replied after insert on public.award_touches
  for each row execute function public.award_touch_in_replied();

alter table public.contract_awards
  add column if not exists gap_inputs jsonb,
  add column if not exists gap_schedule jsonb,
  add column if not exists gap_pdf_path text,
  add column if not exists gap_generated_at timestamptz;

-- المعايير تقديرية ويعدّلها المالك من شاشته: هامش القطاع، والمدة، وطريقة الصرف،
-- ودورة الصرف الحكومية بالأيام.
insert into public.award_settings (key, value) values
  ('gap_benchmarks', '{"construction":{"margin":0.12,"months":12,"method":"claims","delay_days":90},"om_services":{"margin":0.15,"months":24,"method":"monthly","delay_days":60},"supply_it":{"margin":0.18,"months":6,"method":"claims","delay_days":60},"consulting":{"margin":0.25,"months":12,"method":"claims","delay_days":60},"transport":{"margin":0.15,"months":12,"method":"monthly","delay_days":60},"other":{"margin":0.15,"months":12,"method":"monthly","delay_days":60}}'),
  ('gap_title', 'جدول فجوة السيولة — {tender}'),
  ('gap_estimate_note', 'تقديري ويُضبط بأرقامكم'),
  ('gap_closing_line', 'هذه الفجوة يمكن سدّها.'),
  ('gap_email_subject', 'جدول فجوة السيولة في «{tender}»'),
  ('gap_email_body', E'السلام عليكم ورحمة الله،\nكما وعدناكم، مرفقٌ جدولٌ مختصر يبيّن فجوة السيولة في عقدكم شهراً بشهر: ما يُصرف على التنفيذ، وما يُحصَّل من الجهة، وأعمق نقطةٍ تبلغها الفجوة وتاريخها.\nالأرقام المعلَّمة «تقديري» مبنيةٌ على معيار القطاع، ونضبطها بأرقامكم في مكالمة قصيرة متى ناسبكم.')
on conflict (key) do nothing;
