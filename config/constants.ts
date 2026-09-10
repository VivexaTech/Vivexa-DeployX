export const PLATFORM_NAME = "Vivexa DeployX";
export const COMPANY_NAME = "Vivexa Tech";
export const PRODUCTION_APP_URL = "https://deployx.vivexatech.in";

export const DEFAULT_RESERVED_SUBDOMAINS = [
  "www",
  "app",
  "dashboard",
  "admin",
  "api",
  "mail",
  "support",
  "billing",
  "auth",
  "login",
  "signup",
  "status",
  "deployx",
  "cdn",
  "docs",
  "help",
  "blog",
  "shop",
  "store",
  "ftp",
  "smtp",
  "imap",
  "ns1",
  "ns2",
  "vpn",
  "dev",
  "staging",
  "test",
  "beta",
] as const;

export const HOSTED_PROJECT_STATUSES = [
  "creating",
  "queued",
  "building",
  "deploying",
  "ready",
  "error",
] as const;

export const DEPLOYABLE_SUBSCRIPTION_STATUSES = [
  "active",
  "authenticated",
  "past_due",
] as const;

export const DEFAULT_PLAN_FEATURES = {
  freeSubdomain: true,
  customDomain: false,
  staticWebsite: true,
  dynamicWebsite: false,
  githubDeployment: true,
  customDomains: false,
  environmentVariables: true,
  automaticDeployments: false,
  teamMembers: 1,
  maxDeploymentsPerMonth: null as number | null,
  supportLevel: "standard",
};

export const SESSION_COOKIE_NAME = "deployx_session";
export const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 5;

export const SUBDOMAIN_MIN_LENGTH = 3;
export const SUBDOMAIN_MAX_LENGTH = 40;

export const PROJECT_NAME_MIN = 2;
export const PROJECT_NAME_MAX = 60;

export const RATE_LIMITS = {
  deploy: { limit: 8, windowMs: 60 * 60 * 1000 },
  billing: { limit: 10, windowMs: 60 * 60 * 1000 },
  github: { limit: 40, windowMs: 60 * 60 * 1000 },
  domain: { limit: 20, windowMs: 60 * 60 * 1000 },
  auth: { limit: 30, windowMs: 15 * 60 * 1000 },
};

export const DEFAULT_GRACE_PERIOD_DAYS = 3;
export const RENEWAL_REMINDER_DAYS = 10;

export const BASIC_ABUSE_TERMS = [
  "porn",
  "xxx",
  "sex",
  "nazi",
  "hate",
  "abuse",
  "scam",
  "phish",
];
