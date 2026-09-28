-- =============================================================================
-- Vivexa DeployX — seed data
-- Initial plan values only; admins can edit everything from /admin/plans.
-- Prices are in paise (₹1 = 100 paise).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Plans
-- -----------------------------------------------------------------------------

insert into public.plans
  (
    slug,
    name,
    description,
    price_monthly,
    price_yearly,
    currency,
    features,
    max_projects,
    max_deployments_per_month,
    max_domains,
    max_team_members,
    bandwidth_gb,
    max_builds_per_month,
    is_active,
    is_featured,
    display_order
  )
values

  (
    'starter',
    'Starter',
    'For personal websites, portfolios and small projects.',
    19900,
    129900,
    'INR',
    '[
      "2 projects",
      "20 deployments / month",
      "2 custom domains",
      "DeployX subdomain",
      "Environment variables",
      "Community support"
    ]'::jsonb,
    2,
    20,
    2,
    1,
    50,
    20,
    true,
    false,
    0
  ),

  (
    'business',
    'Business',
    'For freelancers, businesses and growing production projects.',
    69900,
    459900,
    'INR',
    '[
      "5 projects",
      "300 deployments / month",
      "4 custom domains",
      "DeployX subdomain",
      "Environment variables",
      "Priority support"
    ]'::jsonb,
    5,
    300,
    4,
    5,
    250,
    300,
    true,
    true,
    1
  ),

  (
    'enterprise',
    'Enterprise',
    'For organisations with unlimited deployment requirements.',
    399900,
    2999900,
    'INR',
    '[
      "Unlimited projects",
      "Unlimited deployments",
      "Unlimited domains",
      "DeployX subdomain",
      "Environment variables",
      "Up to 25 team members",
      "Dedicated support"
    ]'::jsonb,
    null,
    null,
    null,
    25,
    null,
    null,
    true,
    false,
    2
  )

on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  price_monthly = excluded.price_monthly,
  price_yearly = excluded.price_yearly,
  currency = excluded.currency,
  features = excluded.features,
  max_projects = excluded.max_projects,
  max_deployments_per_month = excluded.max_deployments_per_month,
  max_domains = excluded.max_domains,
  max_team_members = excluded.max_team_members,
  bandwidth_gb = excluded.bandwidth_gb,
  max_builds_per_month = excluded.max_builds_per_month,
  is_active = excluded.is_active,
  is_featured = excluded.is_featured,
  display_order = excluded.display_order;


-- -----------------------------------------------------------------------------
-- Platform Settings
-- -----------------------------------------------------------------------------

insert into public.platform_settings
  (key, value, is_public)
values
  ('platform_name', '"Vivexa DeployX"', true),
  ('logo_url', '""', true),
  ('support_email', '"support@vivexatech.in"', true),
  ('pricing_visible', 'true', true),
  ('maintenance_mode', 'false', true),
  ('signup_enabled', 'true', true),
  ('default_plan_slug', '"starter"', false),
  ('deployments_enabled', 'true', true),
  ('max_upload_files', '5000', false),
  ('legal_terms', '""', true),
  ('legal_privacy', '""', true),
  ('legal_acceptable_use', '""', true),
  ('legal_refund', '""', true),
  ('legal_infrastructure', '""', true)

on conflict (key) do nothing;


-- -----------------------------------------------------------------------------
-- First Admin
-- -----------------------------------------------------------------------------
--
-- No admin password is seeded.
--
-- Register normally through /auth/register, then run:
--
-- update public.profiles
-- set role = 'super_admin'
-- where email = 'you@example.com';
--
-- Alternatively:
--
-- npm run admin:promote -- you@example.com
--
-- -----------------------------------------------------------------------------