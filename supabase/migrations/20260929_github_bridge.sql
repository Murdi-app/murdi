-- جسر GitHub الخاص لقناة الفائزين — بلا أسرار: Action المستودع الخاص يثبت هويته بـ OIDC من GitHub.
-- bridge_files: كل ملف توصيةٍ عولج (المسار@بصمة المحتوى) ونتيجته — فلا يُعالج مرتين.
create table if not exists public.bridge_files (
  file_key text primary key,
  path text not null,
  result jsonb not null,
  processed_at timestamptz not null default now()
);
alter table public.bridge_files enable row level security;
revoke all on public.bridge_files from anon, authenticated;
insert into public.award_settings (key, value) values
  ('bridge_repo', 'Murdi-app/murdi-winners-bridge'),   -- المستودع الوحيد المقبول هويّته
  ('bridge_enabled', 'true')
on conflict (key) do nothing;
