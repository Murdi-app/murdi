-- «قناة الفائزين بالعقود» نظاماً مستمراً — يعمل في غياب الجميع.
-- المنصة مصدر الحقيقة الوحيد. Codex يقرأ ويوصي عبر مفتاحٍ مستقل، وClaude التشغيل
-- أو المالك يقبل التوصية أو يرفضها بسبب — والقبول وحده يكتب، وعبر القيود القائمة.
-- كل الجداول بلا منحٍ للمتصفح: الوصول من مسارات الخادم بمفتاح الخدمة.

-- ═══ ١) مفتاح Codex وسجلّ استدعاءاته ومؤشر قراءته ═══
create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  name text not null,                       -- «Codex»
  key_hash text not null unique,            -- sha256 للمفتاح — لا يُحفظ المفتاح نفسه
  key_prefix text not null,                 -- أول أحرفه للتعرّف في الشاشة
  created_at timestamptz not null default now(),
  created_by text,
  revoked_at timestamptz,
  last_used_at timestamptz
);
create table if not exists public.api_calls (
  id bigserial primary key,
  key_id uuid references public.api_keys(id) on delete set null,
  at timestamptz not null default now(),
  method text not null,
  path text not null,
  status int not null,
  note text
);
create index if not exists api_calls_at_idx on public.api_calls(at desc);
create table if not exists public.feed_cursors (
  key_name text primary key,                -- «Codex»
  acked text,                               -- آخر مؤشرٍ أكّد القارئ استلام ما قبله
  served text,                              -- آخر مؤشرٍ سُلِّم
  updated_at timestamptz not null default now()
);

-- ═══ ٢) صندوق التوصيات ═══
create table if not exists public.award_recommendations (
  id uuid primary key default gen_random_uuid(),
  award_id uuid not null references public.contract_awards(id) on delete cascade,
  kind text not null check (kind in ('decision_maker','contact','hypothesis','service','next_reply','drop','subcontractor','template')),
  value jsonb not null,
  evidence text[] not null default '{}',
  confidence numeric check (confidence is null or (confidence >= 0 and confidence <= 1)),
  fingerprint text not null unique,
  source text not null default 'Codex',
  status text not null default 'pending' check (status in ('pending','accepted','rejected')),
  decided_by text,
  decided_at timestamptz,
  reason text,
  applied text,                             -- ما كُتب فعلاً عند القبول
  created_at timestamptz not null default now()
);
create index if not exists award_recommendations_pending_idx on public.award_recommendations(status, created_at);

-- ═══ ٣) الصادر: رسالةٌ واحدة ببصمةٍ فريدة ═══
create table if not exists public.award_outbox (
  id uuid primary key default gen_random_uuid(),
  award_id uuid not null references public.contract_awards(id) on delete cascade,
  template_key text not null,
  channel text not null check (channel in ('email')),
  fingerprint text not null unique,         -- الفرصة + القالب + القناة
  to_address text not null,
  subject text not null,
  body text not null,
  status text not null default 'pending' check (status in ('pending','sending','sent','failed','cancelled')),
  attempts int not null default 0,
  last_error text,
  next_attempt_at timestamptz not null default now(),
  claimed_at timestamptz,
  sent_at timestamptz,
  external_ref text,
  created_at timestamptz not null default now()
);
create index if not exists award_outbox_due_idx on public.award_outbox(status, next_attempt_at);

-- يحجز رسائل مستحقة للإرسال بلا تزاحم: ما بقي «sending» أكثر من ١٠ دقائق يُستأنف
-- (الإرسال نفسه يحمل مفتاح عدم التكرار = البصمة، فالاستئناف لا يُخرج الرسالة مرتين)
create or replace function public.outbox_claim(n int) returns setof public.award_outbox
language sql security definer set search_path = public as $$
  update award_outbox o set status = 'sending', attempts = o.attempts + 1, claimed_at = now()
   where o.id in (
     select id from award_outbox
      where (status in ('pending','failed') and next_attempt_at <= now())
         or (status = 'sending' and claimed_at < now() - interval '10 minutes')
      order by created_at
      limit greatest(n, 0)
      for update skip locked)
  returning o.*;
$$;
revoke all on function public.outbox_claim(int) from public, anon, authenticated;

-- ═══ ٤) مكتبة الفرضيات (حسب نوع العقد ومرحلته) — والاعتماد للمالك ═══
create table if not exists public.award_hypotheses (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  stage text not null check (stage in ('early','in_execution')),
  hypothesis text not null,                 -- لا تُعرض على العميل حقيقةً عن وضعه
  question text not null,                   -- ما تسأله ضي
  replies jsonb not null default '{}',      -- الجواب المتوقَّع ← الرد التالي
  approved boolean not null default false,
  approved_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (category, stage)
);

-- ═══ ٥) مهام Codex (محرّك الإحالات وغيره) ═══
create table if not exists public.codex_tasks (
  id uuid primary key default gen_random_uuid(),
  award_id uuid references public.contract_awards(id) on delete cascade,
  kind text not null,                       -- 'referrals' …
  payload jsonb not null default '{}',
  status text not null default 'open' check (status in ('open','done')),
  created_at timestamptz not null default now(),
  done_at timestamptz,
  unique (award_id, kind)
);

-- ═══ ٦) الثقة في مصادر الأسماء (تنبيهات اعتماد) ═══
create table if not exists public.source_trust (
  source text primary key,                  -- 'etimad_alert'
  consecutive_matches int not null default 0,
  trusted boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into public.source_trust (source) values ('etimad_alert') on conflict do nothing;
-- كل تحقّقٍ من تنبيهٍ على صفحة اعتماد: ثلاث مطابقاتٍ متتالية تجعل المصدر موثوقاً، وأيّ خلافٍ يصفّره
create or replace function public.record_source_check(src text, matched boolean) returns public.source_trust
language plpgsql security definer set search_path = public as $$
declare r source_trust;
begin
  insert into source_trust (source) values (src) on conflict do nothing;
  update source_trust set
    consecutive_matches = case when matched then consecutive_matches + 1 else 0 end,
    trusted = case when matched then consecutive_matches + 1 >= 3 else false end,
    updated_at = now()
  where source = src returning * into r;
  return r;
end $$;
revoke all on function public.record_source_check(text, boolean) from public, anon, authenticated;

-- ═══ ٧) أعمدةٌ على الفرصة والمراسلة ═══
alter table public.contract_awards drop constraint if exists contract_awards_source_check;
alter table public.contract_awards add constraint contract_awards_source_check
  check (source = any (array['etimad','tadawul','nomu','linkedin','news','manual','etimad_alert','codex','referral']));
alter table public.contract_awards
  add column if not exists codex_priority numeric,
  add column if not exists codex_flag text check (codex_flag is null or codex_flag in ('dhai_task','needs_dr','none')),
  add column if not exists codex_reason text,
  add column if not exists codex_flag_at timestamptz,
  add column if not exists hypothesis text,
  add column if not exists qualify_question text,
  add column if not exists suggested_service text,
  add column if not exists next_reply text,
  add column if not exists next_step_override text,
  add column if not exists next_at_override timestamptz,
  add column if not exists dr_manual boolean not null default false;
alter table public.award_touches
  add column if not exists said text,                 -- ما قاله العميل بحرفه
  add column if not exists objection text,
  add column if not exists objection_important boolean not null default false,
  add column if not exists appointment_at timestamptz,
  add column if not exists next_step text;
alter table public.award_message_templates
  add column if not exists approved boolean not null default true,
  add column if not exists approved_at timestamptz;

-- الحالة تتغيّر ← الموعد اليدوي السابق لا يبقى معلّقاً عليها
create or replace function public.award_clear_override() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.status is distinct from old.status then
    new.next_step_override := null; new.next_at_override := null;
  end if;
  return new;
end $$;
drop trigger if exists award_clear_override on public.contract_awards;
create trigger award_clear_override before update of status on public.contract_awards
  for each row execute function public.award_clear_override();

-- ما يتغيّر حول الفرصة (مراسلة · توصية · مهمة) يرفع updated_at فيصل Codex في القراءة التالية
create or replace function public.award_bump() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update contract_awards set updated_at = now() where id = new.award_id;
  return null;
end $$;
drop trigger if exists award_bump_touch on public.award_touches;
create trigger award_bump_touch after insert on public.award_touches for each row execute function public.award_bump();
drop trigger if exists award_bump_rec on public.award_recommendations;
create trigger award_bump_rec after insert or update on public.award_recommendations for each row execute function public.award_bump();
drop trigger if exists award_bump_task on public.codex_tasks;
create trigger award_bump_task after insert or update on public.codex_tasks for each row execute function public.award_bump();

-- ═══ ٨) محرّك الإحالات: «دُفع» ← مهمة لـ Codex بأطراف العقد ═══
create or replace function public.award_paid_referrals() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'paid' and old.status is distinct from 'paid' then
    insert into codex_tasks (award_id, kind, payload) values (new.id, 'referrals', jsonb_build_object(
      'company', new.company_name, 'tender', new.tender_title, 'buyer', new.buyer_entity,
      'ask', 'ابحث عن مقاولي الباطن والموردين المرتبطين بهذا العقد — كلٌّ توصيةٌ من نوع subcontractor بمصدرها'))
    on conflict (award_id, kind) do nothing;
  end if;
  return null;
end $$;
drop trigger if exists award_paid_referrals on public.contract_awards;
create trigger award_paid_referrals after update of status on public.contract_awards
  for each row execute function public.award_paid_referrals();

-- ═══ ٩) قبول التوصية ورفضها — دالةٌ واحدة للشاشة ولـ Claude التشغيل من القاعدة ═══
create or replace function public.reject_recommendation(rec uuid, by_name text, why text) returns public.award_recommendations
language plpgsql security definer set search_path = public as $$
declare r award_recommendations;
begin
  if coalesce(btrim(why), '') = '' then raise exception 'سبب الرفض مطلوب'; end if;
  update award_recommendations set status = 'rejected', decided_by = by_name, decided_at = now(), reason = why
   where id = rec and status = 'pending' returning * into r;
  if r.id is null then raise exception 'التوصية غير موجودة أو حُسمت من قبل'; end if;
  return r;
end $$;

create or replace function public.accept_recommendation(rec uuid, by_name text, why text) returns public.award_recommendations
language plpgsql security definer set search_path = public as $$
declare r award_recommendations; a contract_awards; v jsonb; done text; nid uuid;
begin
  select * into r from award_recommendations where id = rec for update;
  if r.id is null or r.status <> 'pending' then raise exception 'التوصية غير موجودة أو حُسمت من قبل'; end if;
  select * into a from contract_awards where id = r.award_id;
  if a.status = 'do_not_contact' then raise exception 'المنشأة «لا تتواصل» — لا يُكتب لها شيء'; end if;
  v := r.value;
  if r.kind = 'decision_maker' then
    update contract_awards set decision_maker_name = coalesce(v->>'name', decision_maker_name),
      decision_maker_role = coalesce(v->>'role', decision_maker_role), updated_at = now() where id = a.id;
    done := 'صاحب القرار: ' || coalesce(v->>'name', '') || ' — ' || coalesce(v->>'role', '');
  elsif r.kind = 'contact' then
    -- المصدر إلزامي: قيد الهاتف في القاعدة يرفض رقماً بلا مصدرٍ ورابط
    if coalesce(v->>'source_url', '') !~* '^https?://' or coalesce(v->>'source', '') = '' then
      raise exception 'وسيلة التواصل بلا مصدرٍ منشور ورابطه — لا تُقبل';
    end if;
    update contract_awards set
      contact_phone = coalesce(nullif(v->>'phone', ''), contact_phone),
      contact_whatsapp = coalesce(nullif(v->>'whatsapp', ''), contact_whatsapp),
      phone_source = case when coalesce(v->>'phone', v->>'whatsapp', '') <> '' then v->>'source' else phone_source end,
      phone_source_url = case when coalesce(v->>'phone', v->>'whatsapp', '') <> '' then v->>'source_url' else phone_source_url end,
      contact_email = coalesce(nullif(v->>'email', ''), contact_email),
      email_source = case when coalesce(v->>'email', '') <> '' then v->>'source' else email_source end,
      email_source_url = case when coalesce(v->>'email', '') <> '' then v->>'source_url' else email_source_url end,
      updated_at = now()
    where id = a.id;
    done := 'وسيلة تواصل بمصدرها: ' || coalesce(v->>'source', '');
  elsif r.kind = 'hypothesis' then
    update contract_awards set hypothesis = v->>'hypothesis', qualify_question = v->>'question', updated_at = now() where id = a.id;
    done := 'فرضية وسؤال تأهيل';
  elsif r.kind = 'service' then
    update contract_awards set suggested_service = v->>'service', updated_at = now() where id = a.id;
    done := 'خدمة مقترحة (يحسمها تأهيل ضي): ' || coalesce(v->>'service', '');
  elsif r.kind = 'next_reply' then
    update contract_awards set next_reply = v->>'text', updated_at = now() where id = a.id;
    done := 'الرد التالي محفوظ للمراجعة — لا يُرسل';
  elsif r.kind = 'drop' then
    if a.status in ('paid') then raise exception 'لا تُسقط ترسيةٌ مدفوعة'; end if;
    update contract_awards set status = 'dropped', notes = coalesce(notes || E'\n', '') || '[إسقاط بتوصية Codex — ' || coalesce(v->>'reason', '') || ']', updated_at = now() where id = a.id;
    done := 'أُسقطت';
  elsif r.kind = 'subcontractor' then
    if coalesce(v->>'company_name', '') = '' then raise exception 'اسم مقاول الباطن أو المورّد مطلوب'; end if;
    insert into contract_awards (source, company_name, tender_title, category, main_contractor, parent_award_id, is_subcontract, notes)
      values ('codex', v->>'company_name', a.tender_title, a.category, a.company_name, a.id, true,
              'مقاول باطن/مورّد لـ' || a.company_name || ' — توصية Codex: ' || coalesce(array_to_string(r.evidence, ' · '), ''))
      returning id into nid;
    done := 'فرصة جديدة مربوطة بالأم: ' || nid::text;
  elsif r.kind = 'template' then
    done := 'اقتراح قالب/فرضية — ينتظر اعتماد المالك من شاشته';
  end if;
  update award_recommendations set status = 'accepted', decided_by = by_name, decided_at = now(), reason = why, applied = done
   where id = rec returning * into r;
  return r;
end $$;
revoke all on function public.accept_recommendation(uuid, text, text) from public, anon, authenticated;
revoke all on function public.reject_recommendation(uuid, text, text) from public, anon, authenticated;

-- ═══ ١٠) الإعدادات (الحدود في القاعدة لا في الكود) ═══
insert into public.award_settings (key, value) values
  ('outbox_enabled', 'true'),               -- زرّ الإيقاف الكلي
  ('outbox_daily_cap', '15'),
  ('outbox_hours', '8-16'),                 -- بتوقيت الرياض، أحد–خميس
  ('general_email_approved', 'true'),
  ('high_value_min', '5000000'),
  ('close_after_reminder_days', '7')
on conflict (key) do nothing;

-- الجداول الجديدة كلها بلا منحٍ للمتصفح (RLS بلا سياسات)
do $$ begin
  execute 'alter table public.api_keys enable row level security';
  execute 'alter table public.api_calls enable row level security';
  execute 'alter table public.feed_cursors enable row level security';
  execute 'alter table public.award_recommendations enable row level security';
  execute 'alter table public.award_outbox enable row level security';
  execute 'alter table public.award_hypotheses enable row level security';
  execute 'alter table public.codex_tasks enable row level security';
  execute 'alter table public.source_trust enable row level security';
  execute 'revoke all on public.api_keys, public.api_calls, public.feed_cursors, public.award_recommendations, public.award_outbox, public.award_hypotheses, public.codex_tasks, public.source_trust from anon, authenticated';
end $$;
