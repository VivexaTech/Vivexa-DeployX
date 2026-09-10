# Vivexa DeployX

Vivexa DeployX is a production SaaS deployment platform by **Vivexa Tech**. Users connect GitHub, deploy websites, manage domains, subscribe through Razorpay, and receive invoices and email notifications from a Vivexa-branded dashboard.

Underlying hosting is executed through the **Vercel API**. Vivexa DeployX does not claim ownership of that infrastructure.

## Architecture

- **App:** Next.js App Router, TypeScript, Tailwind CSS
- **Auth:** Firebase Authentication (Google) + HTTP-only session cookies
- **Data:** Cloud Firestore via Firebase Admin on the server
- **Git:** GitHub OAuth (server-side token exchange and encrypted storage)
- **Deploy:** Vercel REST API (`lib/vercel`)
- **Billing:** Razorpay Subscriptions + verified webhooks
- **Email:** Resend (`lib/email`)
- **Invoices:** PDFKit on the Node.js runtime
- **Jobs:** Vercel Cron (`/api/cron/*`)

```
app/                 Public site, dashboard, admin, API routes
components/          Marketing, dashboard, and UI primitives
lib/auth             Session and admin UID checks
lib/entitlements     Plan limits and feature flags
lib/firebase         Client + Admin SDK
lib/github           OAuth and repository access
lib/vercel           Projects, deployments, domains
lib/razorpay         Client and webhook verification
lib/email            Resend + templates
lib/invoices         PDF generation
lib/subscriptions    Activation, failures, renewal reminders
lib/projects         Deploy, quota reservation, domain attach
config/              Brand and reserved-subdomain defaults
scripts/             Optional Firestore seed
```

## Local setup

1. Copy environment variables:

```bash
cp .env.example .env.local
```

2. Install and run:

```bash
npm install
npm run dev
```

3. Production checks:

```bash
npm run typecheck
npm run lint
npm run build
```

The app builds without live secrets. Features that need a provider show a configuration error instead of fake success.

## Firebase

1. Create a Firebase project.
2. Enable **Google** sign-in.
3. Create a Firestore database.
4. Add authorized domains (`localhost` and your production host).
5. Put the web config in `NEXT_PUBLIC_FIREBASE_*`.
6. Create a service account and set:

- `FIREBASE_ADMIN_PROJECT_ID`
- `FIREBASE_ADMIN_CLIENT_EMAIL`
- `FIREBASE_ADMIN_PRIVATE_KEY` (keep `\n` escaped)

Deploy rules and indexes:

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

Optional seed (placeholders only — replace real pricing and support yourself):

```bash
npm run seed
```

### Firestore collections

| Path | Purpose |
| --- | --- |
| `users/{uid}` | Profile + authoritative subscription fields |
| `users/{uid}/projects/{projectId}` | Hosted projects (count toward plan limit) |
| `users/{uid}/projects/{projectId}/deployments/{id}` | Deployment history |
| `users/{uid}/projects/{projectId}/domains/{id}` | Platform and custom domains |
| `users/{uid}/invoices/{id}` | Invoice metadata |
| `users/{uid}/notifications/{id}` | In-app notifications |
| `subscriptions/{subscriptionId}` | Razorpay subscription records |
| `payments/{paymentId}` | Payment idempotency / invoice link |
| `webhookEvents/{eventId}` | Razorpay webhook idempotency |
| `githubConnections/{uid}` | Encrypted GitHub tokens (Admin only) |
| `subdomainIndex/{subdomain}` | Unique platform subdomains |
| `domainIndex/{domain}` | Unique custom domains |
| `about/support` | Phone + email |
| `about/company` | About copy |
| `about/reservedSubdomains` | Extra reserved names |
| `about/pricing/plans/{planId}` | Dynamic plans |
| `about/content/projects/{id}` | Public showcase |

Users cannot write subscription, payment, Vercel, or invoice fields from the client. Those updates go through Admin SDK routes.

## Google authentication

1. Firebase console → Authentication → Google.
2. Add the production domain.
3. After Google sign-in, the app posts the ID token to `/api/auth/session` and stores an HTTP-only cookie.

## GitHub OAuth

1. Create a GitHub OAuth App.
2. Homepage URL: `APP_URL`
3. Callback: `{APP_URL}/api/github/callback`
4. Set `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`.
5. For automatic deploys, set `GITHUB_WEBHOOK_SECRET` and use `{APP_URL}/api/github/webhook`.

The Vercel account that owns `VERCEL_TOKEN` must be able to deploy the selected GitHub repositories (connect GitHub on that Vercel team).

## Vercel API

1. Create a Vercel token with access to the team that will host customer projects.
2. Set `VERCEL_TOKEN` and, if needed, `VERCEL_TEAM_ID`.
3. Add `vivexatech.in` (or `MAIN_DOMAIN`) to that Vercel team.
4. Create a wildcard DNS record for customer subdomains.

## Razorpay

1. Create Razorpay **Plans** that match Firestore `razorpayPlanId` values.
2. Set `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `NEXT_PUBLIC_RAZORPAY_KEY_ID`.
3. Webhook URL:

```
https://YOUR_APP_URL/api/webhooks/razorpay
```

4. Subscribe at least to:

- `payment.captured`
- `payment.failed`
- `subscription.authenticated`
- `subscription.activated`
- `subscription.charged`
- `subscription.pending`
- `subscription.halted`
- `subscription.cancelled`
- `subscription.completed`
- `subscription.paused`
- `subscription.resumed`
- `subscription.updated`

5. Put the webhook secret in `RAZORPAY_WEBHOOK_SECRET`.

Checkout success does **not** activate a plan. Webhook verification does.

## Resend

1. Verify your sending domain.
2. Set `RESEND_API_KEY` and `RESEND_FROM_EMAIL`.
3. Emails: subscription success, payment failed, renewal reminder (10 days before).

If Resend is down, payments are not duplicated. The failure is logged and can be retried.

## DNS

### Platform wildcard

```
A / CNAME   *.vivexatech.in    → Vercel (use the values Vercel shows for the domain)
```

Projects can then use `myportfolio.vivexatech.in`. Reserved names (`www`, `app`, `dashboard`, `admin`, `api`, …) are blocked and can be extended in `about/reservedSubdomains`.

### Custom domains

Users add a hostname in the dashboard. DNS records (A / CNAME) come from the Vercel domain config API — they are not hardcoded.

## Vercel deployment

1. Import this repository into Vercel.
2. Set every variable from `.env.example` (except comments).
3. Production URL example: `https://deployx.vivexatech.in` → `APP_URL`.
4. Cron is declared in `vercel.json` with **daily** Hobby-safe schedules only (`0 0 * * *` for renewal reminders). Set `CRON_SECRET`. Vercel sends `Authorization: Bearer CRON_SECRET` automatically. Arbitrary callers are rejected.
5. Renewal reminders run once per day, email subscribers whose renewal is 10 days away, and store `reminderSentForRenewal` + `reminderSentAt` so the same renewal date is never emailed twice. A changed renewal date starts a new reminder cycle.

## Admin

Set `ADMIN_UIDS` to Firebase UIDs. `/admin` and `/api/admin/content` check the authenticated UID on the server. Do not trust a client `isAdmin` flag.

Use `/admin` or the Firebase console to edit plans, support contacts, company copy, and showcase projects.

## Plan enforcement

Every new deployment:

1. Authenticates the Firebase session
2. Checks subscription eligibility
3. Checks plan feature flags
4. Reserves a website slot in a Firestore transaction
5. Talks to Vercel only after the reservation succeeds

Redeploys of an existing project do not consume an extra website slot.

## Production checklist

- [ ] `.env` values set on Vercel
- [ ] Firebase Google auth + authorized domains
- [ ] Firestore rules and indexes deployed
- [ ] Pricing plans active with real `razorpayPlanId` values
- [ ] Support document filled
- [ ] GitHub OAuth callback registered
- [ ] Vercel token + GitHub integration on the same team
- [ ] Wildcard DNS for `MAIN_DOMAIN`
- [ ] Razorpay webhook URL + secret
- [ ] Resend domain verified
- [ ] `ADMIN_UIDS` set
- [ ] `npm run build` succeeds
- [ ] Legal pages reviewed by counsel
