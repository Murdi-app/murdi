-- مفتاح المنشأة يحذف «الشركة» أيضاً (لا «شركة» وحدها): «الشركة العربية للأنابيب» = «العربية للأنابيب»
create or replace function public.award_org_name_key(name text) returns text
language sql immutable set search_path = public as $$
  select nullif(
    regexp_replace(
      regexp_replace(
        translate(
          regexp_replace(coalesce(name, ''), '[ً-ْـ]', '', 'g'),
          'أإآىة', 'ااايه'),
        '(^|\s)(شركه|شركة|الشركه|الشركة|مؤسسه|مؤسسة|المؤسسه|المؤسسة|المحدوده|المحدودة|ذات|المسؤوليه|المسؤولية|المسئوليه|شخص|واحد)(?=\s|$)', ' ', 'g'),
      '[^ء-يa-zA-Z0-9]', '', 'g'),
    '')
$$;
update public.contract_awards set org_key = public.award_org_name_key(company_name);
update public.listed_companies set name = name;  -- يعيد حساب name_key المولَّد

-- أسماءٌ أخرى للمدرجات نفسها، ومدرجتان في تاسي ظهرتا في أخبار الأسبوع
insert into public.listed_companies (name, market, added_by) values
  ('أنابيب السعودية', 'tasi', 'اسمٌ آخر للشركة السعودية لأنابيب الصلب'),
  ('الحفر العربية', 'tasi', 'أخبار ٢٩/٩'),
  ('المجموعة السعودية للأبحاث والإعلام', 'tasi', 'أخبار ٢٩/٩'),
  ('الأبحاث والإعلام', 'tasi', 'اسمٌ آخر للمجموعة السعودية للأبحاث والإعلام')
on conflict (name_key) do nothing;
