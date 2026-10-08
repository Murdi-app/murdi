-- البرامج الحكومية لطُعم دراسة الجدوى (٨ أكتوبر). لا يُعرض للعميل إلا ما verified = true،
-- فلا يُكتب له سقفٌ أو شرطٌ لم يُتحقَّق منه.
create table if not exists public.gov_programs (
  id serial primary key,
  name text not null,
  sector_keywords text not null,
  max_text text not null,
  requirement text not null,
  verified boolean not null default false,
  note text,
  sort int not null default 100
);
alter table public.gov_programs enable row level security;
insert into public.gov_programs(name, sector_keywords, max_text, requirement, verified, note, sort) values
('صندوق التنمية الصناعية السعودي', 'صناع|مصنع|تصنيع|إنتاج|انتاج|industrial|manufactur', 'حتى ٧٥٪ من تكلفة المشروع (بحسب المنطقة)', 'دراسة جدوى معتمدة للمشروع الصناعي', true, 'النسبة تختلف بين المناطق الأقل نمواً وغيرها', 10),
('صندوق التنمية الزراعية', 'زراع|مزرع|ثروة حيوانية|دواجن|ألبان|سمك|agri', 'يُحدَّد — راجع المالك', 'دراسة جدوى للمشروع الزراعي', false, 'السقف لم يُتحقَّق منه', 20),
('صندوق التنمية السياحي', 'سياح|فندق|ضياف|منتجع|tour|hotel', 'يُحدَّد — راجع المالك', 'دراسة جدوى للمشروع السياحي', false, 'السقف لم يُتحقَّق منه', 30),
('بنك التنمية الاجتماعية — تمويل المنشآت الصغيرة', '.*', 'يُحدَّد — راجع المالك', 'دراسة جدوى للمشروع الصغير', false, 'السقف والشروط لم يُتحقَّق منها', 90)
on conflict do nothing;
