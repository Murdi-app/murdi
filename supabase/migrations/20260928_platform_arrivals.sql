-- «الوارد» — كل من دخل المنصة في مكانٍ واحد.
--
-- كان تعريف هذا المنظر في القاعدة وحدها، لا في المستودع — فلا يُراجع ولا
-- يُحفظ. ومنه خرجت المبالغ إلى الموظفة: صفّ الدفعة يبني «7900 ريال · مؤكَّد»،
-- وصفّ الطلب «مسعَّر بـ990 ريال». والتنقية في الخادم (`/api/staff/arrivals`
-- يمرّر `detail` على `hideMoney` للموظفة)، والمالك يرى المبلغ كما هو.
-- وأُضيفت تسمية `in_follow_up` — كانت تظهر للموظفة رمزاً إنجليزياً خاماً.
--
-- التعريف الحالي يُقرأ من القاعدة:  select pg_get_viewdef('public.platform_arrivals', true);
-- وهذا الملف سجلّ التعديل الأخير عليه (٢٨ سبتمبر ٢٠٢٦):
do $$
declare d text := pg_get_viewdef('public.platform_arrivals'::regclass);
        a text := 'WHEN ''delivered''::text THEN '' · سُلِّم''::text';
begin
  if position('in_follow_up' in d) > 0 then return; end if;
  execute 'create or replace view public.platform_arrivals as ' || replace(d, a,
    a || ' WHEN ''in_follow_up''::text THEN '' · في المتابعة''::text');
end $$;
