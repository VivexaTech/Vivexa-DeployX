-- =============================================================================
-- Vivexa DeployX — checkout billing details, tax breakdown and invoices
-- Additive only: existing rows are preserved and new columns have defaults.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- billing_profiles: one saved billing address (+ optional GST details) per user
-- -----------------------------------------------------------------------------
create table if not exists public.billing_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  full_name text not null,
  company_name text,
  email text not null,
  phone text not null,
  address text not null,
  city text not null,
  -- Canonical state/UT code (ISO 3166-2:IN suffix, e.g. 'HR', 'DL').
  state text not null,
  postal_code text not null,
  country text not null default 'IN',
  gst_enabled boolean not null default false,
  gstin text,
  gst_legal_name text,
  gst_address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_profiles_gst_complete check (
    not gst_enabled or (gstin is not null and gst_legal_name is not null)
  )
);
drop trigger if exists billing_profiles_updated_at on public.billing_profiles;
create trigger billing_profiles_updated_at before update on public.billing_profiles
  for each row execute function public.set_updated_at();

alter table public.billing_profiles enable row level security;
drop policy if exists "billing_profiles: read own" on public.billing_profiles;
create policy "billing_profiles: read own" on public.billing_profiles
  for select using (user_id = auth.uid() or public.is_admin());
-- Writes go through the app server (validated, service role) only.

-- -----------------------------------------------------------------------------
-- payments: preserve exactly what was purchased and charged
-- -----------------------------------------------------------------------------
alter table public.payments
  add column if not exists plan_name text,
  add column if not exists base_amount integer,
  add column if not exists taxable_amount integer,
  add column if not exists tax_type text check (tax_type in ('intra_state', 'inter_state', 'none')),
  add column if not exists gst_rate numeric(5, 2) not null default 0,
  add column if not exists cgst_amount integer not null default 0,
  add column if not exists sgst_amount integer not null default 0,
  add column if not exists igst_amount integer not null default 0,
  add column if not exists other_tax_name text,
  add column if not exists other_tax_rate numeric(5, 2) not null default 0,
  add column if not exists other_tax_amount integer not null default 0,
  add column if not exists billing_snapshot jsonb,
  add column if not exists gst_snapshot jsonb,
  add column if not exists paid_at timestamptz;

-- -----------------------------------------------------------------------------
-- invoices: immutable snapshot of customer, company and tax at purchase time
-- -----------------------------------------------------------------------------
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- One invoice per payment: enforced here so retries can never duplicate.
  payment_id uuid not null unique references public.payments (id) on delete cascade,
  plan_id uuid references public.plans (id) on delete set null,
  plan_name text not null,
  billing_cycle public.billing_cycle not null,
  period_start timestamptz,
  period_end timestamptz,
  currency text not null default 'INR',
  base_amount integer not null,
  discount_amount integer not null default 0,
  taxable_amount integer not null,
  tax_type text not null check (tax_type in ('intra_state', 'inter_state', 'none')),
  gst_rate numeric(5, 2) not null default 0,
  cgst_amount integer not null default 0,
  sgst_amount integer not null default 0,
  igst_amount integer not null default 0,
  other_tax_name text,
  other_tax_rate numeric(5, 2) not null default 0,
  other_tax_amount integer not null default 0,
  total_amount integer not null,
  -- Customer snapshot
  customer_name text not null,
  customer_company text,
  customer_email text not null,
  customer_phone text,
  customer_address text,
  customer_city text,
  customer_state text,
  customer_state_code text,
  customer_postal_code text,
  customer_country text,
  customer_gstin text,
  customer_gst_legal_name text,
  customer_gst_address text,
  -- Company (seller) snapshot
  company_name text not null,
  company_logo text,
  company_address text,
  company_phone text,
  company_email text,
  company_gstin text,
  footer_note text,
  tax_note text,
  razorpay_order_id text,
  razorpay_payment_id text,
  status text not null default 'paid' check (status in ('paid', 'refunded', 'void')),
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists invoices_user_idx on public.invoices (user_id, created_at desc);

alter table public.invoices enable row level security;
drop policy if exists "invoices: read own" on public.invoices;
create policy "invoices: read own" on public.invoices
  for select using (user_id = auth.uid() or public.is_admin());

-- -----------------------------------------------------------------------------
-- Gap-free, concurrency-safe invoice numbering: PREFIX-YYYY-000001
-- -----------------------------------------------------------------------------
create table if not exists public.invoice_counters (
  prefix text not null,
  year integer not null,
  last_value integer not null default 0,
  primary key (prefix, year)
);
alter table public.invoice_counters enable row level security;
-- No policies: only the service role / security-definer function touches it.

/**
 * Creates the invoice for a paid payment exactly once. The payment row is
 * locked, so concurrent callers (verify endpoint + webhook) serialise; the
 * second caller receives the existing invoice. The counter increment happens
 * in the same transaction, so numbers are never skipped or reused.
 */
create or replace function public.create_invoice_for_payment(
  p_payment_id uuid,
  p_company jsonb,
  p_prefix text,
  p_footer text,
  p_tax_note text
)
returns public.invoices
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments;
  v_invoice public.invoices;
  v_sub public.subscriptions;
  v_year integer := extract(year from (now() at time zone 'Asia/Kolkata'))::integer;
  v_prefix text := upper(coalesce(nullif(trim(p_prefix), ''), 'VDX'));
  v_seq integer;
  v_billing jsonb;
  v_gst jsonb;
begin
  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found then
    raise exception 'payment % not found', p_payment_id;
  end if;
  if v_payment.status <> 'paid' then
    raise exception 'payment % is not paid', p_payment_id;
  end if;

  select * into v_invoice from public.invoices where payment_id = p_payment_id;
  if found then
    return v_invoice;
  end if;

  insert into public.invoice_counters as c (prefix, year, last_value)
  values (v_prefix, v_year, 1)
  on conflict (prefix, year) do update set last_value = c.last_value + 1
  returning last_value into v_seq;

  if v_payment.subscription_id is not null then
    select * into v_sub from public.subscriptions where id = v_payment.subscription_id;
  end if;

  v_billing := coalesce(v_payment.billing_snapshot, '{}'::jsonb);
  v_gst := v_payment.gst_snapshot;

  insert into public.invoices (
    invoice_number, user_id, payment_id, plan_id, plan_name, billing_cycle,
    period_start, period_end, currency,
    base_amount, discount_amount, taxable_amount, tax_type, gst_rate,
    cgst_amount, sgst_amount, igst_amount,
    other_tax_name, other_tax_rate, other_tax_amount, total_amount,
    customer_name, customer_company, customer_email, customer_phone,
    customer_address, customer_city, customer_state, customer_state_code,
    customer_postal_code, customer_country,
    customer_gstin, customer_gst_legal_name, customer_gst_address,
    company_name, company_logo, company_address, company_phone, company_email, company_gstin,
    footer_note, tax_note, razorpay_order_id, razorpay_payment_id, status, paid_at
  ) values (
    v_prefix || '-' || v_year || '-' || lpad(v_seq::text, 6, '0'),
    v_payment.user_id, v_payment.id, v_payment.plan_id,
    coalesce(v_payment.plan_name, 'Plan'), v_payment.billing_cycle,
    v_sub.current_period_start, v_sub.current_period_end, v_payment.currency,
    coalesce(v_payment.base_amount, v_payment.amount + v_payment.discount_amount),
    v_payment.discount_amount,
    coalesce(v_payment.taxable_amount, v_payment.amount),
    coalesce(v_payment.tax_type, 'none'), v_payment.gst_rate,
    v_payment.cgst_amount, v_payment.sgst_amount, v_payment.igst_amount,
    v_payment.other_tax_name, v_payment.other_tax_rate, v_payment.other_tax_amount,
    v_payment.amount,
    coalesce(v_billing ->> 'full_name', ''), v_billing ->> 'company_name',
    coalesce(v_billing ->> 'email', ''), v_billing ->> 'phone',
    v_billing ->> 'address', v_billing ->> 'city', v_billing ->> 'state_name', v_billing ->> 'state',
    v_billing ->> 'postal_code', v_billing ->> 'country_name',
    v_gst ->> 'gstin', v_gst ->> 'legal_name', v_gst ->> 'address',
    coalesce(nullif(p_company ->> 'name', ''), 'Company'),
    nullif(p_company ->> 'logo', ''), nullif(p_company ->> 'address', ''),
    nullif(p_company ->> 'phone', ''), nullif(p_company ->> 'email', ''),
    nullif(p_company ->> 'gstin', ''),
    nullif(p_footer, ''), nullif(p_tax_note, ''),
    v_payment.order_id, v_payment.payment_id, 'paid', coalesce(v_payment.paid_at, now())
  )
  returning * into v_invoice;

  return v_invoice;
end;
$$;

revoke all on function public.create_invoice_for_payment(uuid, jsonb, text, text, text) from public, anon, authenticated;
grant execute on function public.create_invoice_for_payment(uuid, jsonb, text, text, text) to service_role;

-- Keep invoice status in sync when a payment is refunded.
create or replace function public.sync_invoice_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'refunded' and old.status is distinct from 'refunded' then
    update public.invoices set status = 'refunded' where payment_id = new.id;
  end if;
  return new;
end;
$$;
drop trigger if exists payments_sync_invoice on public.payments;
create trigger payments_sync_invoice after update of status on public.payments
  for each row execute function public.sync_invoice_status();

-- -----------------------------------------------------------------------------
-- Default tax / invoice settings (admin-editable; existing values untouched)
-- -----------------------------------------------------------------------------
insert into public.platform_settings (key, value, is_public) values
  ('gst_rate', '18', false),
  ('tax_home_state', '"HR"', false),
  ('other_tax_name', '"Platform Tax"', false),
  ('other_tax_rate', '4', false),
  ('invoice_prefix', '"VDX"', false),
  ('invoice_footer', '""', false),
  ('invoice_tax_note', '""', false),
  ('company_name', '""', false),
  ('company_logo_url', '""', false),
  ('company_address', '""', false),
  ('company_phone', '""', false),
  ('company_email', '""', false),
  ('company_gstin', '""', false)
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- Public bucket for the invoice/company logo (uploads via the server only)
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('branding', 'branding', true, 1048576, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;
