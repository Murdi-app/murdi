-- النص الجديد أو المعدَّل جوهرياً ينتظر اعتماد المالك قبل أن يخرج.
-- تعديل المالك من شاشته اعتمادٌ (يختم approved_at / يعيد مفتاح الاعتماد)، وأي تعديلٍ غيره
-- — من Claude التشغيل في القاعدة مثلاً — يُعيد النص إلى «ينتظر الاعتماد».
create or replace function public.template_needs_approval() returns trigger
language plpgsql set search_path = public as $$
begin
  if (new.subject is distinct from old.subject or new.context_paragraph is distinct from old.context_paragraph)
     and new.approved_at is not distinct from old.approved_at then
    new.approved := false;
  end if;
  return new;
end $$;
drop trigger if exists template_needs_approval on public.award_message_templates;
create trigger template_needs_approval before update on public.award_message_templates
  for each row execute function public.template_needs_approval();

-- نصوص الإعدادات التي تخرج للعميل ومفاتيح اعتمادها
create or replace function public.setting_needs_approval() returns trigger
language plpgsql set search_path = public as $$
declare k text := case
  when new.key in ('general_email_subject', 'general_email_body') then 'general_email_approved'
  when new.key in ('whatsapp_template', 'whatsapp_template_general') then 'whatsapp_template_approved'
  when new.key in ('gap_email_subject', 'gap_email_body') then 'gap_email_approved'
  else null end;
begin
  if k is not null and new.value is distinct from old.value then
    update award_settings set value = 'false' where key = k;
  end if;
  return null;
end $$;
drop trigger if exists setting_needs_approval on public.award_settings;
create trigger setting_needs_approval after update on public.award_settings
  for each row execute function public.setting_needs_approval();
