# Vivexa DeployX

**Deploy. Manage. Scale.** — Powered by Vivexa Tech · [deployx.vivexatech.in](https://deployx.vivexatech.in)

## 1. Project overview

Vivexa DeployX is a SaaS deployment management platform. Users sign up, connect GitHub, import a repository, configure the build and environment variables, and deploy with automatic Git deployment on every push. They get live build logs, production URLs, DeployX subdomains and custom domains, plan-based limits, Razorpay billing, support tickets and in-app notifications. Administrators manage users, plans, subscriptions, payments, coupons, support, announcements and platform settings, with every change written to an audit log.

DeployX provides a unified, white-label deployment management experience powered by enterprise cloud build and hosting infrastructure.

**How a deployment works:** DeployX downloads the selected commit from GitHub with the user's OAuth token, bundles the source files, provisions the project configuration with the configured framework, commands and environment variables, starts the deployment on the cloud build engine, and streams real-time status and sanitized logs. Private repositories work without installing a third-party GitHub App. When automatic deployment is enabled, pushes to the configured production branch automatically trigger zero-downtime builds.

## 2. Tech stack

| Area | Technology |
| --- | --- |
| Framework | Next.js 16 (App Router, Turbopack), React 19, TypeScript (strict) |
| Styling | Tailwind CSS v4, Lucide icons, Geist font |
| Auth & database | Supabase Auth + Postgres with Row Level Security |
| Validation | Zod |
| Git & Automation | GitHub OAuth App, REST API & Webhooks (`X-Hub-Signature-256`) |
| Infrastructure | Enterprise Cloud Hosting Engine |
| Payments | Razorpay Orders, Checkout and Webhooks |

## 3. Local setup

Requirements: Node.js 20.9+ and npm.

```bash
npm install
cp .env.example .env.local   # PowerShell: Copy-Item .env.example .env.local
npm run dev
```

Open http://localhost:3000. With no environment variables set, the marketing site works and the dashboard explains which integrations are missing ("Development Mode"). Nothing external is simulated as successful.

Useful scripts:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / server |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript without emitting |
| `npm run test:tax` | Tax calculation unit tests |
| `npm run admin:promote -- you@example.com` | Promote a user to `super_admin` |

## 4. Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. Copy the **Project URL**, **anon key** and **service_role key** from *Project Settings → API* into `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`.
3. Run the migration and seed (see [section 9](#9-database-migration)).
4. In *Authentication → URL Configuration*:
   - **Site URL**: your `NEXT_PUBLIC_APP_URL`
   - **Redirect URLs**: `{NEXT_PUBLIC_APP_URL}/auth/callback`
5. In *Authentication → Providers → Email*, keep **Confirm email** enabled for production. Configure custom SMTP for reliable delivery.

The service role key bypasses RLS and is only used on the server after authorization and plan-limit checks. It must never be exposed to the browser.

## 5. GitHub OAuth setup

1. Go to *GitHub → Settings → Developer settings → OAuth Apps → New OAuth App*.
2. **Homepage URL**: `NEXT_PUBLIC_APP_URL`.
3. **Authorization callback URL**: `{NEXT_PUBLIC_APP_URL}/api/github/callback`.
4. Put the Client ID and a generated Client Secret in `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`.
5. Set `ENCRYPTION_KEY` (`openssl rand -base64 32`, or on Windows `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`). Tokens are encrypted with AES-256-GCM before being stored.

DeployX requests the `repo` and `read:user` scopes so it can list and download private repositories. Use a separate OAuth App for local development (callback `http://localhost:3000/api/github/callback`).

## 6. Razorpay setup

1. Create API keys in the [Razorpay Dashboard](https://dashboard.razorpay.com) (use **Test Mode** keys for development) and set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`.
2. Add a webhook under *Account & Settings → Webhooks*:
   - **URL**: `{NEXT_PUBLIC_APP_URL}/api/webhooks/razorpay`
   - **Secret**: any strong random string → `RAZORPAY_WEBHOOK_SECRET`
   - **Events**: `payment.captured`, `payment.failed`, `order.paid`, `refund.created`, `refund.processed`

Payment flow:

1. Choosing a paid plan opens the checkout modal. The user enters (or reuses) billing details and optional GST details; saved details live in `billing_profiles` (one row per user).
2. `POST /api/billing/quote` returns a server-calculated breakdown for display.
3. `POST /api/razorpay/create-order` validates the billing details, **recalculates** plan price, coupon and tax from the database and settings (the client never sends an amount), saves the billing profile, creates the Razorpay order for the final total and stores the full breakdown plus billing/GST snapshots on the payment.
4. The browser opens Razorpay Checkout.
5. `POST /api/razorpay/verify-payment` verifies the HMAC signature **and** fetches the payment from Razorpay to confirm status, order and amount before activating the plan.
6. The webhook (HMAC-verified, idempotent via `webhook_events`) activates or fails the payment even if the browser closes.
7. After activation the invoice is issued by `create_invoice_for_payment` (Postgres), which locks the payment row, returns the existing invoice on retries and takes the next gap-free number (`PREFIX-YEAR-000001`).

Tax (`src/lib/billing/tax.ts`, integer paise): billing state equal to the seller state → CGST + SGST (half the GST rate each); any other state → IGST. An additional configurable "other tax" is applied on the plan price. GST rate, seller state and the other tax name/rate are set in *Admin → Settings → Tax Settings*; seller details, logo, invoice prefix, tax note and footer in *Admin → Settings → Invoice / Company Details*. Paid checkout stays disabled until the company name and address are set. Invoices snapshot the company, customer and tax details, so later settings changes never alter issued invoices. Invoices are viewed at `/invoices/{id}` and downloaded via the browser's *Save as PDF*. Run `npm run test:tax` for the tax unit tests.

Plans are prepaid for one month or one year and **do not renew automatically**. Renewing the same plan early extends the current period. When a period ends the user falls back to the default plan. Refunds are issued from the Razorpay Dashboard; the webhook records them.

## 7. Vercel setup

1. Create a token at [vercel.com/account/tokens](https://vercel.com/account/tokens) scoped to the account or team that will own deployments → `VERCEL_TOKEN`.
2. If using a team, set `VERCEL_TEAM_ID` (`team_…`, from *Team Settings*).
3. Optionally change `VERCEL_PROJECT_PREFIX` (default `deployx`); provider projects are named `{prefix}-{project-slug}`.
4. Optional: create a webhook in Vercel pointing at `{NEXT_PUBLIC_APP_URL}/api/webhooks/vercel` and set `VERCEL_WEBHOOK_SECRET`. Without it, DeployX polls deployment status while the dashboard is open.

Without `VERCEL_TOKEN`, the dashboard shows: *"Vercel integration is not configured. Configure VERCEL_TOKEN to enable real deployments."* Projects can still be created, but no deployment is started or faked.

## 8. Environment variables

See [`.env.example`](.env.example) for the full, commented list.

| Variable | Scope | Required for |
| --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | public | Redirects, OAuth callback, SEO |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | Accounts |
| `SUPABASE_SERVICE_ROLE_KEY` | **server** | Trusted writes, admin panel |
| `ENCRYPTION_KEY` | **server** | GitHub tokens, environment variables |
| `GITHUB_CLIENT_ID` | server | GitHub import |
| `GITHUB_CLIENT_SECRET` | **server** | GitHub import |
| `VERCEL_TOKEN` | **server** | Deployments and domains |
| `VERCEL_TEAM_ID`, `VERCEL_PROJECT_PREFIX`, `VERCEL_WEBHOOK_SECRET` | server | Optional |
| `DEPLOYX_SUBDOMAIN_BASE` | server | Free subdomains |
| `RAZORPAY_KEY_ID` | server (sent to Checkout) | Payments |
| `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | **server** | Payments |

Only `NEXT_PUBLIC_*` variables and the Razorpay key ID ever reach the browser.

## 9. Database migration

**Supabase SQL Editor:** open *SQL Editor*, paste and run [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql), then [`supabase/seed.sql`](supabase/seed.sql), then [`supabase/migrations/0002_checkout_tax_invoices.sql`](supabase/migrations/0002_checkout_tax_invoices.sql), and [`supabase/migrations/0003_auto_git_deployment.sql`](supabase/migrations/0003_auto_git_deployment.sql). Migration 0003 adds automatic Git deployment tracking (`auto_deploy`, `webhook_secret`, and `production_deployment_id`) with zero downtime on failed commits. Migration 0002 adds `billing_profiles`, `invoices`, `invoice_counters`, tax/snapshot columns on `payments`, default tax/invoice settings and the public `branding` storage bucket for the invoice logo.

**Supabase CLI:**

```bash
supabase link --project-ref <your-project-ref>
supabase db push
psql "$SUPABASE_DB_URL" -f supabase/seed.sql
```

The migration creates all tables, enums, indexes, triggers and RLS policies. End users only get `SELECT` on billing, project and deployment tables; the server performs writes with the service role after authorization. Encrypted columns (`access_token_encrypted`, `value_encrypted`) are not readable by the `anon`/`authenticated` roles.

The seed inserts the Starter (₹1,299/yr), Business (₹4,599/yr) and Enterprise (₹29,999/yr) plans and default platform settings. Plans are editable from **Admin → Plans**.

## 10. Admin setup

There is no default admin account or password. Register normally, then promote yourself:

```bash
npm run admin:promote -- you@example.com
```

or in the Supabase SQL Editor:

```sql
update public.profiles set role = 'super_admin' where email = 'admin@vivexatech.in';
```

Roles: `user`, `admin`, `super_admin`. Admin routes are protected on the server (`requireAdmin`) and every admin server action re-checks the role. Only super admins can change roles or delete plans; nobody can change their own role. Role, status and email columns are protected by a database trigger, so they cannot be changed from the client.

## 11. Production deployment

1. Push the repository to GitHub and import it into Vercel (or any Node.js host).
2. Add every variable from `.env.example` in the project settings, with `NEXT_PUBLIC_APP_URL=https://deployx.vivexatech.in`.
3. Deploy. Build command `npm run build`, output handled by Next.js.
4. Update the Supabase Site URL/Redirect URLs, the GitHub OAuth callback and the Razorpay webhook URL to the production domain.
5. Switch Razorpay to live keys once KYC is complete.
6. Replace every `[PLACEHOLDER]` in the legal pages (Admin → Settings → Legal content, or `src/lib/content/legal.ts`) and have them reviewed by a qualified professional.

Deployment builds run in the background after the API responds (`after()`); routes that start deployments set `maxDuration = 300`, which requires a plan that allows 300-second functions. The rate limiter is in-memory per instance; for multi-region traffic, back `src/lib/security/rate-limit.ts` with a shared store such as Upstash Redis.

## 12. Domain configuration

**App domain.** Add `deployx.vivexatech.in` to the Vercel project hosting DeployX itself and create the DNS record Vercel shows you.

**Free subdomains (`myproject.deployx.vivexatech.in`).** Add the base domain to the Vercel account/team used by `VERCEL_TOKEN` and configure a wildcard (`*.deployx.vivexatech.in`) as instructed by Vercel. Set `DEPLOYX_SUBDOMAIN_BASE` accordingly. Users pick a subdomain in *Domains → Add Domain*.

**Custom domains.** Users add a domain to a deployed project. DeployX shows the DNS records returned by the provider (for example an `A` record for apex domains or a `CNAME` for subdomains, plus any `TXT` verification record) and a **Verify Domain** button. DNS values are always taken from the provider's API and never invented. Statuses: Pending, Verifying, Verified, Invalid.

## 13. Troubleshooting

| Symptom | Fix |
| --- | --- |
| "Development Mode" banner in the dashboard | One or more integrations are not configured. The banner lists which. |
| Redirected to login after signing in | Check the Supabase URL/anon key and that `/auth/callback` is in Supabase Redirect URLs. |
| Admin panel redirects to `/dashboard` | Your profile role is `user`. Promote it (section 10) and sign in again. |
| GitHub authorizes but nothing is saved / `?github=callback` | The callback went to `/auth/callback` (Supabase). Set both `GITHUB_CALLBACK_URL` and the OAuth App's callback URL to `/api/github/callback`. |
| GitHub connect returns `?github=state` | The OAuth state cookie expired or the callback URL doesn't match the OAuth App. Retry from the same domain. |
| `?github=encryption` | `ENCRYPTION_KEY` is missing. |
| Environment variables can't be revealed after changing `ENCRYPTION_KEY` | Values encrypted with the old key can't be decrypted. Restore the old key or re-enter the values. |
| Deployment fails with "Deploy this project…" or provider errors | Check `VERCEL_TOKEN` scope and `VERCEL_TEAM_ID`. Build errors appear in the deployment's log viewer. |
| Deployment exceeds file limit | Raise *Max files per deployment* in Admin → Settings or set a narrower root directory. |
| Payment succeeded but plan not active | Confirm `RAZORPAY_WEBHOOK_SECRET` and the webhook URL; check Admin → Payments for the order status and failure reason. |
| Domain stays Invalid | Compare the DNS records at your registrar with those shown in DeployX; propagation can take up to 48 hours. |
| `npm run build` fails on types | Run `npm run typecheck` and `npm run lint` for detailed output. |
