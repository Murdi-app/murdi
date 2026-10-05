-- «لم يرد ٣ مرات» نتيجةٌ مُغلِقة تُكتب آلياً بعد ثالث «لم يرد» متتالية (٥ أكتوبر، بأمر المالك)
alter table public.hot_touches drop constraint if exists hot_touches_outcome_chk;
alter table public.hot_touches add constraint hot_touches_outcome_chk check (outcome is null or outcome = any (array['أرسلتُ رسالة','لم يرد','مهتم','طلب معاودة','غير مهتم','غير مؤهل الآن','رقم خاطئ','تحوّل عميلاً','طلب عدم التواصل','لم يرد ٣ مرات']));
alter table public.mini_assessments drop constraint if exists mini_outcome_chk;
alter table public.mini_assessments add constraint mini_outcome_chk check (outcome is null or outcome = any (array['أرسلتُ رسالة','لم يرد','مهتم','طلب معاودة','غير مهتم','غير مؤهل الآن','رقم خاطئ','تحوّل عميلاً','طلب عدم التواصل','لم يرد ٣ مرات']));
alter table public.service_inquiries drop constraint if exists service_inquiries_outcome_chk;
alter table public.service_inquiries add constraint service_inquiries_outcome_chk check (outcome is null or outcome = any (array['أرسلتُ رسالة','لم يرد','مهتم','طلب معاودة','غير مهتم','غير مؤهل الآن','رقم خاطئ','تحوّل عميلاً','طلب عدم التواصل','لم يرد ٣ مرات']));
