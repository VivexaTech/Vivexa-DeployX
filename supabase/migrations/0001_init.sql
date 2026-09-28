-- =============================================================================
-- Vivexa DeployX — initial schema
-- Run with the Supabase CLI (`supabase db push`) or paste into the SQL editor.
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
create type public.user_role as enum ('user', 'admin', 'super_admin');
create type public.account_status as enum ('active', 'suspended');
create type public.subscription_status as enum ('pending', 'active', 'expired', 'cancelled');
create type public.billing_cycle as enum ('free', 'monthly', 'yearly');
create type public.payment_status as enum ('created', 'paid', 'failed', 'cancelled', 'refunded');
create type public.deployment_status as enum ('queued', 'building', 'ready', 'error', 'cancelled');
create type public.domain_type as enum ('subdomain', 'custom');
create type public.domain_status as enum ('pending', 'verifying', 'verified', 'invalid');
create type public.ticket_status as enum ('open', 'in_progress', 'resolved', 'closed');
create type public.ticket_priority as enum ('low', 'normal', 'high', 'urgent');
create type public.discount_type as enum ('percent', 'fixed');

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- profiles
-- -----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text,
  email text not null,
  avatar_url text,
  role public.user_role not null default 'user',
  status public.account_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_email_idx on public.profiles (email);
create index profiles_role_idx on public.profiles (role);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Security-definer helpers used by RLS policies (avoid recursive policy lookups).
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'super_admin') and status = 'active'
  );
$$;

create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'super_admin' and status = 'active'
  );
$$;

-- Prevent users from changing their own role / status / email through the API.
-- The service role (used only on the server) bypasses this check.
create or replace function public.protect_profile_columns()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Service role (app server) and direct SQL sessions (no JWT) may change these.
  if auth.role() = 'service_role' or auth.uid() is null then
    return new;
  end if;
  if new.role is distinct from old.role
     or new.status is distinct from old.status
     or new.email is distinct from old.email then
    raise exception 'Not allowed to modify protected profile fields';
  end if;
  return new;
end;
$$;
create trigger profiles_protect before update on public.profiles
  for each row execute function public.protect_profile_columns();

-- Create a profile row whenever a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- plans
-- -----------------------------------------------------------------------------
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null default '',
  -- Prices are stored in the smallest currency unit (paise for INR).
  price_monthly integer not null default 0 check (price_monthly >= 0),
  price_yearly integer not null default 0 check (price_yearly >= 0),
  currency text not null default 'INR',
  features jsonb not null default '[]'::jsonb,
  -- NULL limit = unlimited.
  max_projects integer,
  max_deployments_per_month integer,
  max_domains integer,
  max_team_members integer,
  bandwidth_gb integer,
  max_builds_per_month integer,
  is_active boolean not null default true,
  is_featured boolean not null default false,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index plans_active_order_idx on public.plans (is_active, display_order);
create trigger plans_updated_at before update on public.plans
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- coupons
-- -----------------------------------------------------------------------------
create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text,
  discount_type public.discount_type not null,
  discount_value integer not null check (discount_value > 0),
  max_redemptions integer,
  redeemed_count integer not null default 0,
  plan_ids uuid[],
  valid_from timestamptz,
  valid_until timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger coupons_updated_at before update on public.coupons
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- subscriptions
-- -----------------------------------------------------------------------------
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  plan_id uuid not null references public.plans (id),
  status public.subscription_status not null default 'pending',
  billing_cycle public.billing_cycle not null default 'free',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index subscriptions_user_idx on public.subscriptions (user_id, status);
create unique index subscriptions_one_active_per_user
  on public.subscriptions (user_id) where status = 'active';
create trigger subscriptions_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- payments
-- -----------------------------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  plan_id uuid not null references public.plans (id),
  subscription_id uuid references public.subscriptions (id) on delete set null,
  coupon_id uuid references public.coupons (id) on delete set null,
  billing_cycle public.billing_cycle not null,
  order_id text not null unique,
  payment_id text unique,
  razorpay_signature text,
  amount integer not null check (amount >= 0),
  discount_amount integer not null default 0,
  currency text not null default 'INR',
  status public.payment_status not null default 'created',
  failure_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payments_user_idx on public.payments (user_id, created_at desc);
create index payments_status_idx on public.payments (status, created_at desc);
create trigger payments_updated_at before update on public.payments
  for each row execute function public.set_updated_at();

create table public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  payment_id uuid references public.payments (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (coupon_id, payment_id)
);
create index coupon_redemptions_user_idx on public.coupon_redemptions (user_id);

-- Idempotency store for inbound webhooks.
create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_id text not null,
  event_type text not null,
  payload jsonb not null,
  processed_at timestamptz not null default now(),
  unique (provider, event_id)
);

-- -----------------------------------------------------------------------------
-- github_connections (token is AES-256-GCM encrypted by the app server)
-- -----------------------------------------------------------------------------
create table public.github_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  github_user_id bigint not null,
  username text not null,
  avatar_url text,
  scopes text,
  access_token_encrypted text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger github_connections_updated_at before update on public.github_connections
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- projects
-- -----------------------------------------------------------------------------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  slug text not null unique,
  repo_owner text not null,
  repo_name text not null,
  repo_id bigint,
  repo_private boolean not null default false,
  branch text not null default 'main',
  framework text not null default 'other',
  root_directory text not null default '',
  build_command text,
  install_command text,
  output_directory text,
  provider text not null default 'vercel',
  provider_project_id text,
  production_url text,
  latest_deployment_status public.deployment_status,
  last_deployed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index projects_user_idx on public.projects (user_id, created_at desc);
create trigger projects_updated_at before update on public.projects
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- deployments
-- -----------------------------------------------------------------------------
create table public.deployments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status public.deployment_status not null default 'queued',
  target text not null default 'production',
  branch text,
  commit_sha text,
  commit_message text,
  commit_author text,
  provider text not null default 'vercel',
  provider_deployment_id text unique,
  url text,
  inspector_url text,
  error_message text,
  build_started_at timestamptz,
  ready_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index deployments_project_idx on public.deployments (project_id, created_at desc);
create index deployments_user_idx on public.deployments (user_id, created_at desc);
create index deployments_status_idx on public.deployments (status);
create trigger deployments_updated_at before update on public.deployments
  for each row execute function public.set_updated_at();

create table public.deployment_logs (
  id bigint generated always as identity primary key,
  deployment_id uuid not null references public.deployments (id) on delete cascade,
  source text not null default 'deployx',
  level text not null default 'info',
  message text not null,
  created_at timestamptz not null default now()
);
create index deployment_logs_deployment_idx on public.deployment_logs (deployment_id, id);

-- -----------------------------------------------------------------------------
-- domains
-- -----------------------------------------------------------------------------
create table public.domains (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null unique,
  type public.domain_type not null,
  status public.domain_status not null default 'pending',
  ssl_status text not null default 'pending',
  dns_records jsonb not null default '[]'::jsonb,
  verification jsonb not null default '[]'::jsonb,
  last_checked_at timestamptz,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index domains_user_idx on public.domains (user_id);
create index domains_project_idx on public.domains (project_id);
create trigger domains_updated_at before update on public.domains
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- environment_variables (value is AES-256-GCM encrypted by the app server)
-- -----------------------------------------------------------------------------
create table public.environment_variables (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  key text not null check (key ~ '^[A-Za-z_][A-Za-z0-9_]*$'),
  value_encrypted text not null,
  is_secret boolean not null default true,
  targets text[] not null default array['production', 'preview'],
  provider_env_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, key)
);
create trigger environment_variables_updated_at before update on public.environment_variables
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- usage (monthly counters)
-- -----------------------------------------------------------------------------
create table public.usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  period_start date not null,
  deployments_count integer not null default 0,
  builds_count integer not null default 0,
  bandwidth_bytes bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, period_start)
);
create trigger usage_updated_at before update on public.usage
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- support
-- -----------------------------------------------------------------------------
create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  subject text not null check (char_length(subject) between 3 and 200),
  category text not null default 'general',
  priority public.ticket_priority not null default 'normal',
  status public.ticket_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index support_tickets_user_idx on public.support_tickets (user_id, created_at desc);
create index support_tickets_status_idx on public.support_tickets (status);
create trigger support_tickets_updated_at before update on public.support_tickets
  for each row execute function public.set_updated_at();

create table public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  is_staff boolean not null default false,
  message text not null check (char_length(message) between 1 and 10000),
  created_at timestamptz not null default now()
);
create index support_messages_ticket_idx on public.support_messages (ticket_id, created_at);

-- -----------------------------------------------------------------------------
-- notifications
-- -----------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

-- -----------------------------------------------------------------------------
-- admin audit logs & platform settings
-- -----------------------------------------------------------------------------
create table public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.profiles (id) on delete set null,
  action text not null,
  resource_type text not null,
  resource_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index admin_audit_logs_created_idx on public.admin_audit_logs (created_at desc);

create table public.platform_settings (
  key text primary key,
  value jsonb not null,
  is_public boolean not null default false,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

-- =============================================================================
-- Row Level Security
-- Writes to billing, deployment and project state are performed by the app
-- server with the service role after authorization and plan-limit checks, so
-- end users only receive SELECT on those tables.
-- =============================================================================
alter table public.profiles enable row level security;
alter table public.plans enable row level security;
alter table public.coupons enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;
alter table public.coupon_redemptions enable row level security;
alter table public.webhook_events enable row level security;
alter table public.github_connections enable row level security;
alter table public.projects enable row level security;
alter table public.deployments enable row level security;
alter table public.deployment_logs enable row level security;
alter table public.domains enable row level security;
alter table public.environment_variables enable row level security;
alter table public.usage enable row level security;
alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;
alter table public.notifications enable row level security;
alter table public.admin_audit_logs enable row level security;
alter table public.platform_settings enable row level security;

-- profiles
create policy "profiles: read own" on public.profiles
  for select using (id = auth.uid() or public.is_admin());
create policy "profiles: update own" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- plans: anyone can read active plans, admins can read all
create policy "plans: public read active" on public.plans
  for select using (is_active or public.is_admin());

-- coupons: admin read only (validation happens server-side)
create policy "coupons: admin read" on public.coupons
  for select using (public.is_admin());

-- subscriptions / payments / redemptions / usage: own rows
create policy "subscriptions: read own" on public.subscriptions
  for select using (user_id = auth.uid() or public.is_admin());
create policy "payments: read own" on public.payments
  for select using (user_id = auth.uid() or public.is_admin());
create policy "coupon_redemptions: read own" on public.coupon_redemptions
  for select using (user_id = auth.uid() or public.is_admin());
create policy "usage: read own" on public.usage
  for select using (user_id = auth.uid() or public.is_admin());

-- webhook events: admin read only
create policy "webhook_events: admin read" on public.webhook_events
  for select using (public.is_admin());

-- github connections: own row (token column is additionally hidden below)
create policy "github_connections: read own" on public.github_connections
  for select using (user_id = auth.uid());

-- projects / deployments / domains / env vars: own rows
create policy "projects: read own" on public.projects
  for select using (user_id = auth.uid() or public.is_admin());
create policy "deployments: read own" on public.deployments
  for select using (user_id = auth.uid() or public.is_admin());
create policy "deployment_logs: read own" on public.deployment_logs
  for select using (
    exists (
      select 1 from public.deployments d
      where d.id = deployment_id and (d.user_id = auth.uid() or public.is_admin())
    )
  );
create policy "domains: read own" on public.domains
  for select using (user_id = auth.uid() or public.is_admin());
create policy "environment_variables: read own" on public.environment_variables
  for select using (user_id = auth.uid());

-- support
create policy "support_tickets: read own" on public.support_tickets
  for select using (user_id = auth.uid() or public.is_admin());
create policy "support_tickets: create own" on public.support_tickets
  for insert with check (user_id = auth.uid() and status = 'open');
create policy "support_messages: read own" on public.support_messages
  for select using (
    exists (
      select 1 from public.support_tickets t
      where t.id = ticket_id and (t.user_id = auth.uid() or public.is_admin())
    )
  );
create policy "support_messages: create own" on public.support_messages
  for insert with check (
    author_id = auth.uid()
    and is_staff = false
    and exists (
      select 1 from public.support_tickets t
      where t.id = ticket_id and t.user_id = auth.uid() and t.status <> 'closed'
    )
  );

-- notifications
create policy "notifications: read own" on public.notifications
  for select using (user_id = auth.uid());
create policy "notifications: mark own read" on public.notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- audit logs: admin read only
create policy "admin_audit_logs: admin read" on public.admin_audit_logs
  for select using (public.is_admin());

-- platform settings: public keys readable by all, everything readable by admins
create policy "platform_settings: read" on public.platform_settings
  for select using (is_public or public.is_admin());

-- Column-level protection: never expose encrypted secrets through the Data API.
revoke select on public.github_connections from anon, authenticated;
grant select (id, user_id, github_user_id, username, avatar_url, scopes, created_at, updated_at)
  on public.github_connections to authenticated;

revoke select on public.environment_variables from anon, authenticated;
grant select (id, project_id, user_id, key, is_secret, targets, created_at, updated_at)
  on public.environment_variables to authenticated;

-- Users may only update read_at on their notifications and name/avatar on profiles.
revoke update on public.notifications from anon, authenticated;
grant update (read_at) on public.notifications to authenticated;
revoke update on public.profiles from anon, authenticated;
grant update (name, avatar_url) on public.profiles to authenticated;
