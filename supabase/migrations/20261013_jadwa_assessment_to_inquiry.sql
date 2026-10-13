-- ١٣ أكتوبر (المالك): «حاول تعدّل الموضوع بحيث يجون كطلب خدمة». من دخل من إعلان الجدوى واختار
-- «منشأتي قائمة» يُحوَّل إلى تقييم الجاهزية — فيُنشأ له طلبُ «دراسة الجدوى» تلقائياً حين يُكمل
-- التقييم، فيظهر طلبَ خدمةٍ كغيره (وتُكتب له أسئلة الاستشارة)، ويُرفع سطر التقييم المكرّر من القائمة.
-- (طُبّق على القاعدة بالمحتوى نفسه.)
create or replace function public.jadwa_assessment_to_inquiry() returns trigger
language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
declare p9 text;
begin
  if coalesce(new.src, '') !~* 'jadwa' or new.completed is not true or new.phone is null then return new; end if;
  p9 := right(regexp_replace(new.phone, '\D', '', 'g'), 9);
  if length(p9) < 9 then return new; end if;
  if exists (select 1 from service_inquiries i where right(regexp_replace(coalesce(i.phone, ''), '\D', '', 'g'), 9) = p9
             and i.service_title = 'دراسة الجدوى الاقتصادية' and i.created_at > now() - interval '30 days') then
    return new;
  end if;
  insert into service_inquiries (service_title, full_name, company_name, phone, note, src, created_at)
  values ('دراسة الجدوى الاقتصادية', new.full_name, nullif(btrim(coalesce(new.company_name, '')), ''), new.phone,
    '⭐ منشأة قائمة · من إعلان الجدوى · ' || case when new.track = 'استثمار' then 'يبحث عن مستثمر' else 'يبحث عن ممول' end
      || ' · درجة الجاهزية ' || coalesce(new.score, 0) || '/100' || chr(10) || 'من مدخل دراسة الجدوى — أكمل تقييم الجاهزية.',
    new.src, coalesce(new.created_at, now()));
  return new;
end $$;

create trigger trg_jadwa_assessment_to_inquiry after insert or update of completed on public.mini_assessments
  for each row execute function public.jadwa_assessment_to_inquiry();

do $$
declare v text; pat text := 'FROM one_assessment m' || chr(10) || '  WHERE (NOT';
begin
  v := pg_get_viewdef('public.hot_list'::regclass);
  if position(pat in v) = 0 then raise exception 'hot_list definition changed — patch not applied'; end if;
  v := replace(v, pat, 'FROM one_assessment m' || chr(10) || '  WHERE (COALESCE(m.src, '''') !~* ''jadwa'') AND (NOT');
  execute 'create or replace view public.hot_list as ' || v;
end $$;
