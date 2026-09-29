-- كل تعديلٍ على الفرصة — من أي كاتب (المسارات، Claude التشغيل في القاعدة، المشغّلات) — يرفع
-- updated_at، فيصل Codex في قراءته التالية. كان الاعتماد على المسارات وحدها يُسقط ما لا تكتبه.
create or replace function public.award_set_updated_at() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end $$;
drop trigger if exists award_set_updated_at on public.contract_awards;
create trigger award_set_updated_at before update on public.contract_awards
  for each row execute function public.award_set_updated_at();
