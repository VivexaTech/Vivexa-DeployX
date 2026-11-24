-- =============================================================================
-- Migration 0004: Multi-Account & Team Vercel Architecture
-- Enables Admin to configure multiple Vercel accounts/teams and assign
-- specific Vercel accounts and teams per user or per project to prevent
-- hitting single-account resource limits.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- vercel_accounts: pool of Vercel accounts / teams managed by platform admins
-- -----------------------------------------------------------------------------
create table if not exists public.vercel_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  token_encrypted text not null,
  team_id text,
  is_default boolean not null default false,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists vercel_accounts_updated_at on public.vercel_accounts;
create trigger vercel_accounts_updated_at before update on public.vercel_accounts
  for each row execute function public.set_updated_at();

-- Enable Row Level Security
alter table public.vercel_accounts enable row level security;

-- Only platform admins have access to inspect or manage Vercel credentials
drop policy if exists "vercel_accounts: admin read" on public.vercel_accounts;
create policy "vercel_accounts: admin read" on public.vercel_accounts
  for select using (public.is_admin());

drop policy if exists "vercel_accounts: admin write" on public.vercel_accounts;
create policy "vercel_accounts: admin write" on public.vercel_accounts
  for all using (public.is_admin());

-- -----------------------------------------------------------------------------
-- Assign Vercel accounts to users (profiles) and projects
-- -----------------------------------------------------------------------------
alter table public.profiles
  add column if not exists vercel_account_id uuid references public.vercel_accounts (id) on delete set null;

alter table public.projects
  add column if not exists vercel_account_id uuid references public.vercel_accounts (id) on delete set null;

-- Indexes for performance
create index if not exists vercel_accounts_is_default_idx
  on public.vercel_accounts (is_default) where is_default = true;

create index if not exists vercel_accounts_is_active_idx
  on public.vercel_accounts (is_active);

create index if not exists profiles_vercel_account_idx
  on public.profiles (vercel_account_id);

create index if not exists projects_vercel_account_idx
  on public.projects (vercel_account_id);
