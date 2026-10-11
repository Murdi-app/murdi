-- الفرص الساخنة: سطر الطلب من الموقع يحمل ملخّص المدخل (١١ أكتوبر)
--
-- صفحة /jadwa صارت تسأل أربعة أسئلة (نوع المشروع، حجمه، ممول أم مستثمر،
-- مساهمة صاحبه) وتكتب ملخّصها سطراً أول في الملاحظة يبدأ بـ«⭐». وكانت ضي ترى
-- «طلب دراسة الجدوى من الموقع» وحده، فلا تعرف أيّ الطلبات أجدّ قبل أن تتصل.
-- فيُلحق السطر الأول بسبب الصفّ متى بدأ بـ«⭐». ولا يتغيّر غيره في المنظر.
do $$
declare d text;
begin
  d := pg_get_viewdef('public.hot_list'::regclass);
  d := replace(d,
    $q$(('طلب «'::text || i.service_title) || '» من الموقع'::text) AS reason$q$,
    $q$((('طلب «'::text || i.service_title) || '» من الموقع'::text) || COALESCE(CASE WHEN COALESCE(i.note, ''::text) ~~ '⭐%'::text THEN ' — '::text || split_part(i.note, chr(10), 1) ELSE NULL::text END, ''::text)) AS reason$q$);
  if position('⭐' in d) = 0 then raise exception 'hot_list: inquiry reason not found'; end if;
  execute 'create or replace view public.hot_list as ' || d;
end $$;
