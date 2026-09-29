-- ربط Codex/ChatGPT بمُرضي كإضافة MCP بعيدة بمصادقة OAuth 2.1 (PKCE + تسجيل عميلٍ ديناميكي).
-- المالك يوافق من جلسته في murdi.sa، فيستلم ChatGPT رمزه مباشرةً — لا مفتاح يمرّ في أي رسالة.
-- رمز الوصول صفٌّ في api_keys (بصمته وحدها)، فيُلغى من شاشة المالك كأي مفتاح.
create table if not exists public.oauth_clients (
  client_id text primary key,
  client_name text,
  redirect_uris text[] not null,
  created_at timestamptz not null default now()
);
create table if not exists public.oauth_codes (
  code_hash text primary key,
  client_id text not null references public.oauth_clients(client_id) on delete cascade,
  redirect_uri text not null,
  code_challenge text not null,
  scope text,
  expires_at timestamptz not null,
  used_at timestamptz
);
create table if not exists public.oauth_refresh (
  token_hash text primary key,
  client_id text not null references public.oauth_clients(client_id) on delete cascade,
  scope text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);
alter table public.api_keys
  add column if not exists expires_at timestamptz,
  add column if not exists client_id text;
do $$ begin
  execute 'alter table public.oauth_clients enable row level security';
  execute 'alter table public.oauth_codes enable row level security';
  execute 'alter table public.oauth_refresh enable row level security';
  execute 'revoke all on public.oauth_clients, public.oauth_codes, public.oauth_refresh from anon, authenticated';
end $$;
