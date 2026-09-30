-- إشعار المالك مرةً لكل بندٍ يحتاج قراره (مفتاح البند)، يفتح «قناة الفائزين» مباشرة.
create table if not exists public.dr_notified (key text primary key, at timestamptz not null default now());
alter table public.dr_notified enable row level security;
revoke all on public.dr_notified from anon, authenticated;
-- أسئلة التأهيل العامة الست: راجعها Claude بتفويض المالك (٣٠/٩) واعتمدها — لتظهر لضي
update public.award_hypotheses set approved = true, approved_at = now() where approved = false;
