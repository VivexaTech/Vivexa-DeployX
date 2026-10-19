/**
 * Documentation content. Each section is a list of blocks so pages can be
 * extended without touching layout code. Add new entries to DOCS to publish.
 */
export type DocBlock =
  | { type: "p"; text: string }
  | { type: "h"; text: string }
  | { type: "list"; items: string[] }
  | { type: "code"; text: string }
  | { type: "note"; text: string };

export type DocPage = {
  slug: string;
  title: string;
  description: string;
  group: "Basics" | "Deploying" | "Domains" | "Account";
  blocks: DocBlock[];
};

export const DOCS: DocPage[] = [
  {
    slug: "introduction",
    title: "Introduction",
    description: "What Vivexa DeployX is and how it works.",
    group: "Basics",
    blocks: [
      { type: "p", text: "Vivexa DeployX is a deployment management platform operated by Vivexa Tech. It gives you one dashboard to import GitHub repositories, configure builds, deploy, monitor deployments, and connect domains." },
      { type: "h", text: "How deployments run" },
      { type: "p", text: "DeployX provides an automated, production-grade cloud deployment pipeline. Builds and deployments are managed through a unified dashboard with zero configuration required for popular frameworks." },
      { type: "list", items: ["Your source code is pulled from GitHub on each push or deployment request.", "DeployX packages and builds the application on cloud infrastructure with optimized build caches.", "Build status, live logs and production URLs are streamed in real time to your DeployX dashboard."] },
    ],
  },
  {
    slug: "getting-started",
    title: "Getting Started",
    description: "Create an account, choose a plan and ship your first deployment.",
    group: "Basics",
    blocks: [
      { type: "list", items: ["Create an account at /auth/register and verify your email if required.", "Choose a plan from Billing. The Free plan activates instantly; paid plans are processed through Razorpay.", "Connect GitHub from Settings or the New Project page.", "Import a repository, review the detected build settings, and deploy."] },
      { type: "note", text: "Plan limits (projects, deployments per month, domains) are enforced when you create resources." },
    ],
  },
  {
    slug: "connecting-github",
    title: "Connecting GitHub",
    description: "Authorize DeployX to read your repositories.",
    group: "Basics",
    blocks: [
      { type: "p", text: "DeployX uses GitHub OAuth. When you connect, GitHub asks you to authorize the requested scopes (repo, read:user). The access token is encrypted at rest and only used server-side to list repositories and fetch source code for deployments." },
      { type: "h", text: "Disconnecting" },
      { type: "p", text: "You can disconnect at any time from Settings → GitHub. Disconnecting removes the stored token. You can also revoke access from GitHub → Settings → Applications." },
    ],
  },
  {
    slug: "creating-a-project",
    title: "Creating a Project",
    description: "Import a repository and configure the build.",
    group: "Deploying",
    blocks: [
      { type: "p", text: "The New Project wizard walks you through five steps: select repository, configure project, environment variables, review, and deploy." },
      { type: "h", text: "Framework detection" },
      { type: "p", text: "DeployX inspects package.json and config files to detect Next.js, React (CRA), Vite, Vue, Nuxt, Astro, or static HTML. You can override the framework and any build setting." },
      { type: "list", items: ["Root Directory — where your app lives inside the repository (for monorepos).", "Build Command — e.g. npm run build.", "Install Command — e.g. npm ci.", "Output Directory — e.g. dist or build."] },
    ],
  },
  {
    slug: "deployments",
    title: "Deployments",
    description: "Deploy, redeploy and monitor builds.",
    group: "Deploying",
    blocks: [
      { type: "p", text: "Each deployment builds the latest commit on the project's configured branch. Deployment statuses are Queued, Building, Ready, Error and Cancelled." },
      { type: "code", text: "$ deployx deploy\n\n✓ Repository connected\n✓ Build completed\n✓ Deployment ready" },
      { type: "p", text: "Open a deployment to see the commit, author, build duration, logs and production URL. Logs refresh automatically while the build is running, and secrets are redacted." },
    ],
  },
  {
    slug: "environment-variables",
    title: "Environment Variables",
    description: "Manage secrets and configuration for your builds.",
    group: "Deploying",
    blocks: [
      { type: "p", text: "Add environment variables from Project → Settings. Values are encrypted with AES-256-GCM before they are stored and are hidden by default in the dashboard." },
      { type: "note", text: "Changes to environment variables apply to the next deployment. Redeploy to use new values." },
    ],
  },
  {
    slug: "domains",
    title: "Domains",
    description: "Use a free DeployX subdomain for your project.",
    group: "Domains",
    blocks: [
      { type: "p", text: "Every project can use a DeployX subdomain such as myproject.deployx.vivexatech.in, subject to availability and your plan's domain limit." },
      { type: "p", text: "Subdomains are verified automatically once the infrastructure provider confirms the assignment." },
    ],
  },
  {
    slug: "custom-domains",
    title: "Custom Domains",
    description: "Point your own domain at a DeployX project.",
    group: "Domains",
    blocks: [
      { type: "p", text: "Add a domain such as example.com or www.example.com from the Domains page. DeployX shows the DNS records required by the underlying infrastructure provider — values are fetched live and never guessed." },
      { type: "list", items: ["Apex domains (example.com) typically use an A record.", "Subdomains (www.example.com) typically use a CNAME record.", "Some domains also require a TXT verification record."] },
      { type: "p", text: "After updating DNS, click Verify Domain. DNS changes can take up to 48 hours to propagate. SSL certificates are issued automatically once the domain is verified." },
    ],
  },
  {
    slug: "billing",
    title: "Billing",
    description: "Plans, payments and renewals.",
    group: "Account",
    blocks: [
      { type: "p", text: "Paid plans are prepaid for a monthly or yearly period and processed by Razorpay. Your subscription is activated only after the payment is verified on our servers." },
      { type: "list", items: ["Plans do not auto-renew; renew from Billing before the period ends.", "Upgrading starts a new billing period immediately; remaining time is not prorated.", "When a paid period ends without renewal, your account returns to the Free plan limits."] },
      { type: "p", text: "See the Refund Policy for details on refunds." },
    ],
  },
  {
    slug: "troubleshooting",
    title: "Troubleshooting",
    description: "Fix common build and domain issues.",
    group: "Account",
    blocks: [
      { type: "h", text: "Build fails immediately" },
      { type: "p", text: "Check that the Root Directory, Install Command and Build Command are correct, and that required environment variables are set." },
      { type: "h", text: "\"Integration is not configured\"" },
      { type: "p", text: "The platform operator has not configured that integration (GitHub, Deployment Engine or Razorpay) yet. Contact support." },
      { type: "h", text: "Domain stays in Pending" },
      { type: "p", text: "Confirm the DNS records exactly match the values shown, remove conflicting records, and wait for propagation before verifying again." },
    ],
  },
  {
    slug: "faq",
    title: "FAQ",
    description: "Frequently asked questions.",
    group: "Account",
    blocks: [
      { type: "p", text: "See the full FAQ at /faq for answers about plans, infrastructure, security and support." },
    ],
  },
];

export function getDoc(slug: string): DocPage | undefined {
  return DOCS.find((d) => d.slug === slug);
}
