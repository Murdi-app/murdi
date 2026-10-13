-- ١٣ أكتوبر (المالك): «ما أبي أكرر مشكلة الوادعي». من دخل من إعلان الجدوى واختار «منشأتي قائمة»
-- يذهب إلى تقييم الجاهزية، فكان يظهر لضي «أنهى التقييم بدرجة ٦٧» كأي تقييم، فلا تعرفه طالبَ جدوى.
-- فصار سطره يقول ذلك صراحةً، ويرتفع إلى صفّ الطلبات (tier 2).
do $$
declare v text;
begin
  v := pg_get_viewdef('public.hot_list'::regclass);
  if position('3 AS tier' in v) = 0 or position('''أنهى التقييم بدرجة ''::text || (COALESCE(m.score, 0))::text) AS reason' in v) = 0 then
    raise exception 'hot_list definition changed — patch not applied';
  end if;
  v := replace(v, '3 AS tier',
    'CASE WHEN COALESCE(m.src, '''') ~~* ''%jadwa%'' THEN 2 ELSE 3 END AS tier');
  v := replace(v, '(''أنهى التقييم بدرجة ''::text || (COALESCE(m.score, 0))::text) AS reason',
    'CASE WHEN COALESCE(m.src, '''') ~~* ''%jadwa%'' THEN (''📊 من إعلان دراسة الجدوى — منشأته قائمة، أنهى التقييم بدرجة ''::text || (COALESCE(m.score, 0))::text) ELSE (''أنهى التقييم بدرجة ''::text || (COALESCE(m.score, 0))::text) END AS reason');
  execute 'create or replace view public.hot_list as ' || v;
end $$;
